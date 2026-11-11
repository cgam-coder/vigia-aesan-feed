import { pathToFileURL } from 'node:url';
import { appendFile } from 'node:fs/promises';
import { classifyWatchdogReport, watchdogStepSummary, nativeSeverityEvidenceIssues, nativeHistoricalCertificationHolds } from './watchdog-disposition.mjs';

export const SOURCES = Object.freeze(['AESAN', 'RAPNA', 'RASFF', 'SAFETY GATE', 'OECD']);
export const BUDGET = Object.freeze({ global:90_000, read:30_000 });

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


// Observation-only channel split. It never authorizes recovery or replaces allFresh.
// OBSERVED means current evidence was checked, NOT official five-source certification.
export function summarizeNativeChannels(nativeBody, policies, now, transportOk=true) {
  if(!transportOk)return {coordinator:{verdict:'UNKNOWN',wakeAgeMinutes:null,auditAgeMinutes:null},
    recent:{verdict:'UNKNOWN',officialFreshnessCertified:false,sources:SOURCES.map(source=>({source,verdict:'UNKNOWN'}))},
    historical:{verdict:'UNKNOWN',officialFreshnessCertified:false,sources:SOURCES.map(source=>({source,verdict:'UNKNOWN'}))},
    recoveryAuthorized:false,zeroWrite:true};
  const audit=nativeBody?.state?.lastAudit;
  const wakeAge=age(nativeBody?.state?.lastWakeAt,now);
  const auditAge=age(audit?.finishedAt,now);
  const validPolicy=policies instanceof Map && policies.size===SOURCES.length;
  const raw=Array.isArray(audit?.states)?audit.states:[];
  const evidenceComplete=raw.length===SOURCES.length &&
    new Set(raw.map(s=>s?.source)).size===SOURCES.length &&
    SOURCES.every(s=>raw.some(row=>row?.source===s));
  const connected=nativeBody?.mode==='five-source-coordinated' && nativeBody?.outcome==='observed' &&
    nativeBody?.activeLease===false && validPolicy && evidenceComplete &&
    age(nativeBody?.state?.ownershipVerifiedAt,now)!==null &&
    wakeAge!==null && wakeAge<=15 && auditAge!==null && auditAge<=15;
  const coordinatorVerdict=!nativeBody||!validPolicy||!evidenceComplete||wakeAge===null||auditAge===null
    ? 'UNKNOWN' : connected?'OBSERVED':'HOLD';
  const recent=[],historical=[];
  for(const source of SOURCES){
    const state=raw.find(row=>row?.source===source);
    const policy=policies?.get(source);
    const assessment=state&&policy?assess(state,source,policy,now):null;
    const checkedAge=age(state?.checkedAt,now);
    const attempt=nativeBody?.state?.attempts?.[source];
    const reliable=assessment&&assessment.verdict!=='UNKNOWN'&&
      checkedAge!==null&&checkedAge<=policy.recent.freshMaxAgeMinutes &&
      assessment.recentFresh===true&&assessment.parity===true&&state?.error===null&&
      state.activeLease===false && ['fresh','stale'].includes(state.status) &&
      (state.status!=='stale'||state.revisionStatus==='stale') &&
      attempt?.outcome==='completed';
    const missing=!assessment||assessment.verdict==='UNKNOWN'||checkedAge===null||!attempt;
    recent.push({source,verdict:missing?'UNKNOWN':reliable?'OBSERVED':'HOLD'});
    const revisionBlocked=Object.entries(nativeBody?.state?.revisionAttempts??{}).some(([key,attempt])=>
      key.startsWith(source+':') && (['failed','running','unknown'].includes(attempt?.outcome) ||
        (Array.isArray(attempt?.pendingDetails)&&attempt.pendingDetails.length>0)));
    const revisionVerdict=!policy||!assessment||assessment.verdict==='UNKNOWN'
      ? 'UNKNOWN' : !policy.revision.required
        ? state.revisionStatus==='not-required'?'NOT_REQUIRED':'HOLD'
        : state.revisionStatus==='unknown'?'UNKNOWN':revisionBlocked?'HOLD':assessment.revisionFresh?'OBSERVED':'HOLD';
    historical.push({source,verdict:revisionVerdict});
  }
  const combine=(entries,allowed)=>entries.some(x=>x.verdict==='UNKNOWN')?'UNKNOWN'
    :entries.every(x=>allowed.includes(x.verdict))?'OBSERVED':'HOLD';
  const recentVerdict=coordinatorVerdict==='UNKNOWN'?'UNKNOWN'
    :coordinatorVerdict==='HOLD'?'HOLD':combine(recent,['OBSERVED']);
  const historicalVerdict=coordinatorVerdict==='UNKNOWN'?'UNKNOWN'
    :coordinatorVerdict==='HOLD'?'HOLD':combine(historical,['OBSERVED','NOT_REQUIRED']);
  return {
    coordinator:{verdict:coordinatorVerdict,wakeAgeMinutes:wakeAge,auditAgeMinutes:auditAge},
    recent:{verdict:recentVerdict,officialFreshnessCertified:false,sources:recent},
    historical:{verdict:historicalVerdict,officialFreshnessCertified:false,sources:historical},
    recoveryAuthorized:false,zeroWrite:true,
  };
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

export async function runWatchdog({ url, token, fetchImpl=fetch, clock=Date.now,
  monotonic=() => performance.now(), log=record => console.log('WATCHDOG ' + JSON.stringify(record)) }) {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || !token) throw new Error('Invalid watchdog configuration');
  endpoint.search = '';
  const started = monotonic();
  const deadline = started + BUDGET.global;
  const globalSignal = AbortSignal.timeout(BUDGET.global);
  let authBlocked = false;
  const calls = [];
  async function request(target, phase) {
    const remaining = deadline - monotonic();
    if (remaining <= 0) return { ok:false, reason:'budget' };
    const timeoutMs = Math.max(1, Math.floor(Math.min(BUDGET.read, remaining)));
    const call = { phase, source:null, method:'GET', timeoutMs };
    calls.push(call);
    log({ ...call, event:'start', elapsedMs:monotonic() - started });
    try {
      const response = await fetchImpl(target, { method:'GET', redirect:'error',
        headers:{ Authorization:`Bearer ${token}` },
        signal:AbortSignal.any([globalSignal, AbortSignal.timeout(timeoutMs)]) });
      call.http = response.status;
      if ([401,403].includes(response.status)) { authBlocked = true; return { ok:false, reason:'auth' }; }
      if (![200,503].includes(response.status)) return { ok:false, reason:'http', http:response.status };
      let body;
      try { body = await response.json(); } catch { return { ok:false, reason:'json' }; }
      return { ok:true, http:response.status, body };
    } catch { return { ok:false, reason:'transport-or-abort' }; }
    finally { log({ ...call, event:'end', elapsedMs:monotonic() - started }); }
  }
  const freshnessUrl = params => { const target = new URL(endpoint); target.search = new URLSearchParams(params); return target; };
  // This provider observes Cloudflare without invoking ingestion or its watchdog.
  const native=await request(new URL('/api/source-reliability?observe=1',endpoint),'native-heartbeat');
  const nativeMode=native.ok&&native.body?.mode==='five-source-coordinated';
  const policyResult=await request(freshnessUrl({observe:'1',policy:'1'}),'policy');
  const policies=policyResult.ok&&policyResult.http===200?parsePolicy(policyResult.body):null;
  const audit=nativeMode ? native.body?.state?.lastAudit : null,seen=new Set(),states=[];
  const recentAudit=audit&&age(audit.finishedAt,clock())!==null&&age(audit.finishedAt,clock())<=15;
  for(const source of SOURCES){
    const matches=Array.isArray(audit?.states)?audit.states.filter(s=>s?.source===source):[];
    const state=matches.length===1?matches[0]:null;
    if(state)seen.add(source);
    states.push(policies&&state?assess(state,source,policies.get(source),clock()):{source,verdict:'UNKNOWN',reason:'missing-native-official-evidence'});
  }
  const allFresh=Boolean(nativeMode&&native.http===200&&native.body.outcome==='observed'&&native.body.officialParityCertified===true&&native.body.activeLease===false&&recentAudit&&seen.size===5&&states.every(s=>s.verdict==='PASS'));
  const channels=summarizeNativeChannels(native.body,policies,clock(),nativeMode&&native.ok&&native.http===200&&policyResult.ok&&policyResult.http===200&&!authBlocked);
  const report={states,channels,policyVersion:policies?1:null,allFresh,zeroWrite:true,supervisor:'github-observes-cloudflare',recoveryOutcomeUncertain:false,auditOutcomeUncertain:false,authBlocked,elapsedMs:monotonic()-started,calls};
  report.evidenceIssues=nativeSeverityEvidenceIssues(native.body,report,clock());
  report.historicalEvidenceHolds=nativeHistoricalCertificationHolds(native.body);
  log({phase:'summary',...report});return report;
}

export async function publishWatchdogReport(report, { summaryPath=process.env.GITHUB_STEP_SUMMARY,
  log=message=>console.log(message), error=message=>console.error(message), appendSummary=appendFile }={}) {
  let decision = classifyWatchdogReport(report);
  if (summaryPath) {
    try { await appendSummary(summaryPath, watchdogStepSummary(decision), 'utf8'); }
    catch {
      decision=Object.freeze({...decision,level:'CRITICAL',exitCode:1,reason:'github-summary-unavailable'});
      error('::error title=NagameAlert watchdog evidence::GitHub watchdog summary unavailable');
    }
  }
  log('WATCHDOG_DISPOSITION ' + JSON.stringify(decision));
  if (decision.level === 'WARNING') log('::warning title=NagameAlert historical HOLD::RECENT observed; historical certification pending');
  if (decision.level === 'CRITICAL') error('::error title=NagameAlert critical watchdog::RECENT, coordinator, parity or evidence requires investigation');
  return decision;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await runWatchdog({ url:process.env.VIGIA_FRESHNESS_URL, token:process.env.VIGIA_SYNC_TOKEN });
    const decision = await publishWatchdogReport(report);
    if (decision.exitCode !== 0) process.exitCode = decision.exitCode;
  } catch { console.error('::error title=NagameAlert critical watchdog::Watchdog configuration or execution failed closed'); process.exitCode = 1; }
}

