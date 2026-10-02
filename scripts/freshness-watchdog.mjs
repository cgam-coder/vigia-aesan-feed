import { pathToFileURL } from 'node:url';

export const SOURCES = Object.freeze(['AESAN', 'RAPNA', 'RASFF', 'SAFETY GATE', 'OECD']);
const ROUTES = ['aesan', 'rapna', 'rasff', 'safety-gate', 'oecd'];
export const BUDGET = Object.freeze({ global:32 * 60_000, read:30_000, audit:90_000,
  recovery:20 * 60_000, reserve:30_000 });

// Consume the runtime policy; never duplicate or relax its source SLAs.
export function parsePolicy(body) {
  if (body?.policyVersion !== 1 || !Array.isArray(body.policies) || body.policies.length !== 5) return null;
  const policies = new Map();
  for (const p of body.policies) {
    if (!SOURCES.includes(p?.source) || policies.has(p.source) ||
        !Number.isFinite(p.recent?.freshMaxAgeMinutes) || p.recent.freshMaxAgeMinutes <= 0 ||
        !Number.isFinite(p.recent?.staleMaxAgeMinutes) || p.recent.staleMaxAgeMinutes < p.recent.freshMaxAgeMinutes ||
        typeof p.revision?.required !== 'boolean' || typeof p.revision?.scope !== 'string' ||
        !['required', 'optional', 'not-applicable'].includes(p.revision.certification) ||
        (p.revision.required && (!Number.isFinite(p.revision.maxAgeMinutes) || p.revision.maxAgeMinutes <= 0))) return null;
    policies.set(p.source, p);
  }
  return policies;
}

const age = (value, now) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now
  ? (now - Date.parse(value)) / 60_000 : null;

export function assess(state, source, policy, now) {
  const unknown = reason => ({ source, verdict:'UNKNOWN', reason });
  if (!state || state.source !== source || !policy || age(state.checkedAt, now) === null ||
      typeof state.activeLease !== 'boolean' || !['fresh', 'degraded', 'stale', 'unknown'].includes(state.status) ||
      !Object.hasOwn(state, 'error') || !Array.isArray(state.missingOfficialIdentities) ||
      !Array.isArray(state.revisionMismatches)) return unknown('invalid-state-or-clock');
  const recentAge = age(state.lastSyncSuccessAt, now);
  const revisionAge = age(state.revisionLastSuccessAt, now);
  const parity = state.latestIdentityParity === true && state.missingOfficialIdentities.length === 0 && state.revisionMismatches.length === 0;
  const recentFresh = recentAge !== null && recentAge <= policy.recent.freshMaxAgeMinutes;
  const revisionFresh = !policy.revision.required ? state.revisionStatus === 'not-required'
    : state.revisionStatus === 'fresh' && revisionAge !== null && revisionAge <= policy.revision.maxAgeMinutes;
  // revisionStatus is the runtime's certified-policy verdict, not a certificate fabricated by this client.
  return { source, verdict:state.status === 'fresh' && state.error === null && parity && recentFresh && revisionFresh ? 'PASS' : 'HOLD',
    recentAgeMinutes:recentAge, revisionAgeMinutes:revisionAge, scope:policy.revision.scope,
    recentFresh, revisionFresh, parity, reason:state.error === null ? null : 'runtime-source-error' };
}

export function assessSilence(runs, now, maxSilenceMinutes) {
  if (!Number.isFinite(now) || !Number.isFinite(maxSilenceMinutes) || maxSilenceMinutes <= 0 || !Array.isArray(runs))
    return { verdict:'UNKNOWN', reason:'invalid-observation' };
  // A trigger/job success is not proof that five official audits happened.
  const completed = runs.filter(r => r.event === 'schedule' && r.status === 'completed' &&
    age(r.updated_at, now) !== null).sort((a,b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
  if (!completed) return { verdict:'UNKNOWN', reason:'no-completed-scheduled-run' };
  const silenceMinutes = age(completed.updated_at, now);
  return { verdict:silenceMinutes > maxSilenceMinutes ? 'HOLD' : 'OBSERVED',
    silenceMinutes, runId:completed.id, conclusion:completed.conclusion,
    officialFreshnessCertified:false, recoveryAuthorized:false };
}

function safeToRecover(body, source, now) {
  if (!body || !Object.hasOwn(body, 'lease') || body.lease !== null ||
      body.recent?.source !== source || body.recent?.mode !== 'recent' ||
      !['completed', 'partial', 'failed', 'idle', 'skipped'].includes(body.recent.status)) return false;
  if (body.backfill && (body.backfill.source !== source || !['completed', 'idle'].includes(body.backfill.status))) return false;
  if (body.snapshot && !['backfill-completed', 'ready'].includes(body.snapshot.status)) return false;
  return !body.recent.lastSuccessAt || age(body.recent.lastSuccessAt, now) !== null;
}

export async function runWatchdog({ url, token, fetchImpl=fetch, clock=Date.now,
  monotonic=() => performance.now(), log=record => console.log('WATCHDOG ' + JSON.stringify(record)) }) {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || !token) throw new Error('Invalid watchdog configuration');
  endpoint.search = '';
  const started = monotonic();
  const wallStarted = clock();
  const deadline = started + BUDGET.global;
  const globalSignal = AbortSignal.timeout(BUDGET.global);
  let authBlocked = false;
  let uncertain = false;
  let auditOutcomeUncertain = false;
  let writeBlocked = false;
  const calls = [];
  async function request(target, method, phase, source, cap) {
    const remaining = deadline - monotonic() - (phase === 'reconcile' ? 0 : BUDGET.reserve);
    if (remaining <= 0) return { ok:false, reason:'budget' };
    const timeoutMs = Math.max(1, Math.floor(Math.min(cap, remaining)));
    const call = { phase, source, method, timeoutMs };
    calls.push(call);
    log({ ...call, event:'start', elapsedMs:monotonic() - started });
    try {
      const response = await fetchImpl(target, { method, redirect:'error',
        headers:{ Authorization:`Bearer ${token}` },
        signal:AbortSignal.any([globalSignal, AbortSignal.timeout(timeoutMs)]) });
      call.http = response.status;
      if ([401,403].includes(response.status)) { authBlocked = true; return { ok:false, reason:'auth' }; }
      if (![200,503].includes(response.status)) return { ok:false, reason:'http' };
      let body;
      try { body = await response.json(); } catch { return { ok:false, reason:'json' }; }
      return { ok:true, http:response.status, body };
    } catch { return { ok:false, reason:'transport-or-abort' }; }
    finally { log({ ...call, event:'end', elapsedMs:monotonic() - started }); }
  }
  const freshnessUrl = params => { const target = new URL(endpoint); target.search = new URLSearchParams(params); return target; };
  const syncUrl = source => new URL(`/api/${ROUTES[SOURCES.indexOf(source)]}/sync?observe=1`, endpoint);
  const policyResult = await request(freshnessUrl({ observe:'1', policy:'1' }), 'GET', 'policy', null, BUDGET.read);
  const policies = policyResult.ok && policyResult.http === 200 ? parsePolicy(policyResult.body) : null;
  // Persisted evidence is read-only and explicitly historical, even when its label says fresh.
  const persisted = authBlocked ? { ok:false, reason:'auth' }
    : await request(freshnessUrl({ observe:'1' }), 'GET', 'persisted-observation', null, BUDGET.read);
  log({ phase:'persisted-observation', zeroWrite:true, currentOfficialParityCertified:false,
    sourceCount:persisted.ok && Array.isArray(persisted.body?.states) ? persisted.body.states.length : 0 });
  const results = new Map(SOURCES.map(source => [source, { source, verdict:'UNKNOWN', reason:'not-evaluated' }]));
  const states = new Map();
  const observed = new Set();
  // Isolate READ failures before any audit/recovery POST. These five reads
  // ensure a failed first source cannot hide the other sources' operational state.
  if (policies) for (const source of SOURCES) {
    if (authBlocked) break;
    const r = await request(syncUrl(source), 'GET', 'source-observation', source, BUDGET.read);
    if (r.ok && r.http === 200 && r.body?.recent?.source === source && r.body.recent.mode === 'recent' &&
        Object.hasOwn(r.body,'lease')) observed.add(source);
    log({ phase:'source-observation', source, zeroWrite:true, observed:observed.has(source),
      currentOfficialParityCertified:false, reason:observed.has(source) ? null : r.reason ?? 'invalid-observation' });
  }
  let auditsComplete = Boolean(policies);
  if (policies) for (const source of SOURCES) {
    if (authBlocked) { auditsComplete = false; results.set(source, { source, verdict:'UNKNOWN', reason:'auth-blocked' }); continue; }
    if (writeBlocked || !observed.has(source)) { auditsComplete = false;
      results.set(source,{source,verdict:'UNKNOWN',reason:writeBlocked ? 'prior-audit-outcome-unconfirmed' : 'source-observation-failed'}); continue; }
    // This audit persists freshness evidence. recover=0 does NOT mean zero-write.
    const r = await request(freshnessUrl({ audit:'1', recover:'0', source }), 'POST', 'audit', source, BUDGET.audit);
    const state = r.ok && Array.isArray(r.body?.states) && r.body.states.length === 1 ? r.body.states[0] : null;
    const assessment = assess(state, source, policies.get(source), clock());
    if (!r.ok || assessment.verdict === 'UNKNOWN' || r.body?.allFresh !== (state?.status === 'fresh') ||
        r.http !== (r.body?.allFresh ? 200 : 503) || Date.parse(state?.checkedAt) < wallStarted) {
      auditsComplete = false;
      results.set(source, { source, verdict:'UNKNOWN', reason:r.reason ?? 'invalid-audit-response' });
      writeBlocked = true;
      auditOutcomeUncertain = !authBlocked && r.reason !== 'budget';
      if (!authBlocked) {
        const reconciliation = await request(freshnessUrl({observe:'1'}),'GET','reconcile',source,BUDGET.read);
        log({phase:'audit-reconcile',source,zeroWrite:true,observationReceived:reconciliation.ok,
          remoteOutcomeKnown:false,retryAuthorized:false});
      }
    } else { states.set(source, state); results.set(source, assessment); }
    log({ phase:'audit', zeroWrite:false, recoveryRequested:false, ...results.get(source) });
  }
  // Complete all observations first. At most ONE recovery POST in this job; never retry it.
  // A revision-only HOLD needs its ordinary historical lane, not repeated recent ingestion.
  if (auditsComplete && !authBlocked) {
    const offset = Math.floor(wallStarted / (15 * 60_000)) % SOURCES.length;
    const ordered = [...SOURCES.slice(offset), ...SOURCES.slice(0,offset)];
    const source = ordered.find(s => { const state = states.get(s); const a = results.get(s);
      return a.verdict === 'HOLD' && state.error === null && state.activeLease === false && (!a.recentFresh || !a.parity); });
    if (source && deadline - monotonic() >= BUDGET.recovery + 2 * BUDGET.read + BUDGET.reserve) {
      const before = await request(syncUrl(source), 'GET', 'before-recovery', source, BUDGET.read);
      if (before.ok && before.http === 200 && safeToRecover(before.body, source, clock()) && !authBlocked) {
        const recoveryStartedAt = clock();
        const recovery = await request(freshnessUrl({ audit:'1', recover:'1', source }), 'POST', 'recovery', source, BUDGET.recovery);
        const state = recovery.ok && Array.isArray(recovery.body?.states) && recovery.body.states.length === 1 ? recovery.body.states[0] : null;
        const a = assess(state, source, policies.get(source), clock());
        uncertain = !recovery.ok || a.verdict === 'UNKNOWN' || recovery.body.allFresh !== (state?.status === 'fresh') ||
          recovery.http !== (recovery.body.allFresh ? 200 : 503) || Date.parse(state?.checkedAt) < recoveryStartedAt;
        // An aborted client never proves remote termination. Reconcile via GET only.
        const after = authBlocked ? { ok:false, reason:'auth' }
          : await request(syncUrl(source), 'GET', 'reconcile', source, BUDGET.read);
        const reconciled = after.ok && after.http === 200 && safeToRecover(after.body, source, clock()) &&
          ['completed','partial'].includes(after.body.recent.status) && after.body.recent.lastError === null &&
          Date.parse(after.body.recent.lastSuccessAt) >= Date.parse(state?.lastSyncSuccessAt);
        log({ phase:'reconcile', source, zeroWrite:true, remoteOutcomeKnown:!uncertain && reconciled,
          leaseReleased:Boolean(after.ok && after.body && Object.hasOwn(after.body, 'lease') && after.body.lease === null),
          retryAuthorized:false });
        if (uncertain || !reconciled) results.set(source, { source, verdict:'UNKNOWN', reason:'recovery-outcome-unconfirmed' });
        else { states.set(source,state); results.set(source,a); }
      } else results.set(source, { source, verdict:'HOLD', reason:before.reason ?? 'lease-backfill-or-state-blocked' });
    }
  }
  for (const [source,state] of states) if (results.get(source).verdict === 'PASS')
    results.set(source, assess(state, source, policies.get(source), clock()));
  const report = { states:SOURCES.map(s => results.get(s)), policyVersion:policies ? 1 : null,
    allFresh:monotonic() <= deadline && !uncertain && !auditOutcomeUncertain && !authBlocked && SOURCES.every(s => results.get(s).verdict === 'PASS'),
    recoveryOutcomeUncertain:uncertain, auditOutcomeUncertain, authBlocked, elapsedMs:monotonic() - started, calls };
  log({ phase:'summary', ...report });
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await runWatchdog({ url:process.env.VIGIA_FRESHNESS_URL, token:process.env.VIGIA_SYNC_TOKEN });
    if (!report.allFresh) process.exitCode = 1;
  } catch { console.error('Watchdog configuration or execution failed closed'); process.exitCode = 1; }
}
