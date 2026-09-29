// Adapter bindings are transport contracts, not a second reliability policy registry.
const ADAPTERS = Object.freeze({
  AESAN:{ path:"/api/aesan/sync?observe=1", lane:"full-archive-producer", modes:{ "historical-reconcile":["historicalReconcile", "revisionCertification"] } },
  RAPNA:{ path:"/api/rapna/sync?observe=1", lane:"current+legacy", modes:{ "current-parity":["currentParity", "currentRevisionCertification"], "legacy-reconcile":["legacyReconcile", "legacyRevisionCertification"] } },
  RASFF:{ path:"/api/rasff/sync?observe=1", lane:"reconcile", modes:{ reconcile:["reconcile", "revisionCertification"] } },
  OECD:{ path:"/api/oecd/sync?observe=1", lane:"historical-reconcile", modes:{ "historical-reconcile":["historicalReconcile", "revisionCertification"] } },
});
const SOURCES = ["AESAN", "RAPNA", "RASFF", "SAFETY GATE", "OECD"];
const object = (x) => Boolean(x && typeof x === "object" && !Array.isArray(x));
const text = (x) => typeof x === "string" && x.length > 0;
const date = (x) => text(x) && Number.isFinite(Date.parse(x));
const count = (x) => Number.isSafeInteger(x) && x >= 0;
const age = (at, now) => date(at) ? (now - Date.parse(at)) / 60_000 : null;
const within = (at, max, now) => date(at) && age(at, now) >= 0 && age(at, now) <= max;
const assert = (ok, reason) => { if (!ok) throw new Error(reason); };

export function validateControlPolicies(payload) {
  assert(payload?.policyVersion === 1 && Array.isArray(payload.policies), "unsupported-policy-contract");
  assert(payload.policies.length === SOURCES.length, "missing-policy-source");
  const seen = new Set();
  for (const p of payload.policies) {
    assert(object(p) && SOURCES.includes(p.source) && !seen.has(p.source), "duplicate-or-unsupported-policy-source");
    seen.add(p.source);
    assert(object(p.recent) && Number.isFinite(p.recent.freshMaxAgeMinutes) && p.recent.freshMaxAgeMinutes > 0 &&
      Number.isFinite(p.recent.staleMaxAgeMinutes) && p.recent.staleMaxAgeMinutes >= p.recent.freshMaxAgeMinutes, "invalid-recent-policy");
    assert(object(p.revision) && typeof p.revision.required === "boolean", "invalid-revision-policy");
    if (p.source === "SAFETY GATE") {
      assert(p.revision.required === false && p.revision.mode === null, "safety-gate-f2-hold");
      continue;
    }
    assert(p.revision.required && Number.isFinite(p.revision.maxAgeMinutes) && p.revision.maxAgeMinutes > 0, "invalid-revision-policy");
    const components = p.revision.components ?? [p.revision];
    const modes = components.map((c) => c.mode);
    assert(modes.length === Object.keys(ADAPTERS[p.source].modes).length && new Set(modes).size === modes.length &&
      modes.includes(p.revision.mode) && modes.every((mode) => Object.hasOwn(ADAPTERS[p.source].modes, mode)), "unsupported-adapter-contract");
    assert(components.every((c) => ["required", "optional"].includes(c.certification)), "invalid-certification-policy");
  }
  return payload.policies;
}

function validateState(state, source, mode) {
  if (state === null) return;
  assert(object(state) && state.source === source && state.mode === mode, "invalid-state-identity");
  assert(["idle", "running", "completed", "partial", "failed", "skipped"].includes(state.status), "invalid-state-status");
  assert(count(state.cursor) && count(state.totalUnits), "invalid-state-cursor");
  for (const key of ["pagesScanned", "recordsObserved", "recordsPersisted", "newCount", "updatedCount", "pageErrors", "detailFailures"]) {
    assert(count(state[key]), "invalid-state-counter:" + key);
  }
  assert(state.lastError === null || text(state.lastError), "invalid-state-error");
  for (const key of ["startedAt", "completedAt", "lastSuccessAt"]) assert(state[key] === null || date(state[key]), "invalid-state-date:" + key);
}

function certificationEvidence(cert, source, mode, maxAgeMinutes, now) {
  const structurallyValid = object(cert) && cert.source === source && cert.mode === mode &&
    cert.auditStatus === "passed" && cert.coverage === "official-index-complete" &&
    text(cert.cycleId) && count(cert.totalUnits) && cert.totalUnits > 0 &&
    count(cert.recordsObserved) && cert.recordsObserved > 0 && date(cert.completedAt) &&
    date(cert.auditCheckedAt) && Date.parse(cert.auditCheckedAt) >= Date.parse(cert.completedAt) &&
    Date.parse(cert.auditCheckedAt) <= now && Date.parse(cert.completedAt) <= now;
  return { certification:cert, certificationStructurallyValid:Boolean(structurallyValid),
    certificationValid:Boolean(structurallyValid && within(cert.completedAt, maxAgeMinutes, now)) };
}

function componentEvidence(p, c, body, now) {
  const [stateKey, certKey] = ADAPTERS[p.source].modes[c.mode];
  assert(Object.hasOwn(body, stateKey) && Object.hasOwn(body, certKey), "missing-adapter-evidence");
  const state = body[stateKey], cert = body[certKey];
  validateState(state, p.source, c.mode);
  assert(cert === null || object(cert), "invalid-certification-envelope");
  const certification = certificationEvidence(cert, p.source, c.mode, p.revision.maxAgeMinutes, now);
  const inProgress = Boolean(state && ["running", "partial", "failed"].includes(state.status) &&
    date(state.startedAt) && state.totalUnits > 0 && state.cursor < state.totalUnits);
  let error = (state?.lastError || state?.status === "failed") ? "revision-semantic-error" : null;
  if (!state && cert) error = "missing-persisted-revision-state";
  if (state?.status === "skipped") error = "ambiguous-persisted-skip";
  if (state && (state.pageErrors > 0 || state.detailFailures > 0)) error ??= "revision-errors";
  if (state && [state.startedAt, state.completedAt, state.lastSuccessAt].some((at) => at && Date.parse(at) > now)) error = "future-state-timestamp";
  if (state && ["running", "partial"].includes(state.status) && !inProgress) error = "invalid-persisted-cycle";
  if (inProgress && (!text(state.planVersion) || (state.cursor > 0 && !text(state.cursorKey)))) error = "invalid-persisted-cursor";
  // CURRENT parity's adapter starts a new date-based plan at midnight. It cannot
  // safely resume yesterday's partial cursor; do not silently authorize that reset.
  if (inProgress && c.mode === "current-parity" &&
    !state.planVersion?.startsWith("rapna-current-parity-v1:" + new Date(now).toISOString().slice(0, 10) + ":")) error = "adapter-cycle-not-resumable";
  const terminal = Boolean(state?.status === "completed" && state.coverage === "official-index-complete" &&
    date(state.completedAt) && state.totalUnits > 0 && state.recordsObserved > 0 &&
    (c.mode === "reconcile" ? state.cursor === 0 : state.cursor === state.totalUnits));
  if (state?.status === "completed" && !terminal) error = "invalid-terminal-state";
  const successAt = certification.certificationStructurallyValid ? cert.completedAt :
    c.certification === "optional" && cert === null && terminal ? state.completedAt : null;
  const fresh = !error && within(successAt, p.revision.maxAgeMinutes, now) &&
    (c.certification !== "required" || certification.certificationValid);
  return { mode:c.mode, scope:c.scope, certificationRequired:c.certification === "required", state,
    cursor:state?.cursor ?? null, cursorKey:state?.cursorKey ?? null, totalUnits:state?.totalUnits ?? null,
    cycleStartedAt:state?.startedAt ?? null, completedAt:state?.completedAt ?? null,
    lastSuccessAt:state?.lastSuccessAt ?? null, ...certification,
    revisionAgeMinutes:age(successAt, now), revisionFresh:Boolean(fresh), revisionInProgress:inProgress,
    canContinue:inProgress && !error, error };
}

export function buildLiveSourceEvidence(p, observation, now) {
  const base = { source:p.source, observedAt:observation?.observedAt ?? null,
    lane:ADAPTERS[p.source]?.lane ?? null, revisionRequired:p.revision.required, revisionMode:p.revision.mode,
    recentReady:false, revisionReady:false, revisionInProgress:false, certificationValid:false,
    leaseActive:false, actionable:false, blockedReason:null };
  if (p.source === "SAFETY GATE") return { ...base, blockedReason:"revision-not-required" };
  try {
    assert(observation?.readError == null && object(observation?.body), observation?.readError ?? "missing-observation");
    assert(within(observation.observedAt, 5, now), "live-observation-expired");
    const body = observation.body;
    assert(Object.hasOwn(body, "recent") && Object.hasOwn(body, "lease"), "missing-live-state");
    validateState(body.recent, p.source, "recent");
    const lease = body.lease;
    assert(lease === null || (object(lease) && lease.source === p.source && text(lease.ownerId) && text(lease.mode) && date(lease.expiresAt)), "invalid-live-lease");
    base.leaseActive = Boolean(lease && Date.parse(lease.expiresAt) > now);
    const recent = body.recent;
    const recentAgeMinutes = age(recent?.lastSuccessAt, now);
    base.recentReady = Boolean(recent && ["completed", "partial"].includes(recent.status) &&
      !recent.lastError && recent.pageErrors === 0 && recent.detailFailures === 0 &&
      within(recent.lastSuccessAt, p.recent.freshMaxAgeMinutes, now));
    const components = (p.revision.components ?? [p.revision]).map((c) => componentEvidence(p, c, body, now));
    const error = components.find((c) => c.error)?.error ?? null;
    const componentOrder = [...components].sort((a, b) => Number(b.revisionInProgress) - Number(a.revisionInProgress) ||
      Number(a.revisionFresh) - Number(b.revisionFresh));
    const next = componentOrder.find((c) => c.revisionInProgress || !c.revisionFresh) ?? null;
    base.revisionInProgress = components.some((c) => c.revisionInProgress);
    base.certificationValid = components.every((c) => c.certificationValid);
    const fresh = components.every((c) => c.revisionFresh);
    base.blockedReason = base.leaseActive ? "active-lease" : !base.recentReady ? "recent-priority" : error;
    base.revisionReady = base.blockedReason === null;
    base.actionable = base.revisionReady && (base.revisionInProgress || !fresh);
    const ages = components.map((c) => c.revisionAgeMinutes);
    return { ...base, policy:p, recent:{ state:recent, lastSuccessAt:recent?.lastSuccessAt ?? null, ageMinutes:recentAgeMinutes },
      lease, leaseMode:lease?.mode ?? null, leaseExpiresAt:lease?.expiresAt ?? null,
      components, structuralError:error, revisionFresh:fresh, nextMode:next?.mode ?? null,
      revisionAgeMinutes:ages.some((a) => a === null) ? null : Math.max(...ages),
      revisionMaxAgeMinutes:p.revision.maxAgeMinutes,
      // No source is presented as externally verified against its official index.
      evidenceBasis:"live-persisted-adapter-state" };
  } catch (error) {
    return { ...base, actionable:false, revisionReady:false, blockedReason:error.message, structuralError:error.message };
  }
}

export function buildRevisionShadowPlan(policyPayload, observations = {}, { now = Date.now() } = {}) {
  const policies = validateControlPolicies(policyPayload);
  const plan = { mode:"shadow", zeroWrite:true, observedAt:new Date(now).toISOString(), selected:null,
    candidates:[], blocked:[], idle:[], external:[], notRequired:[] };
  for (const p of policies) {
    const record = buildLiveSourceEvidence(p, observations[p.source], now);
    if (!record.revisionRequired) plan.notRequired.push(record);
    else if (p.source === "AESAN") plan.external.push(record);
    else if (record.blockedReason) plan.blocked.push(record);
    else if (record.actionable) plan.candidates.push(record);
    else plan.idle.push(record);
  }
  // Missing/invalid certification is maximally overdue. Otherwise order by time
  // beyond the runtime SLA, not by raw age across different SLAs.
  const overdue = (x) => x.revisionAgeMinutes === null ? Number.MAX_SAFE_INTEGER : x.revisionAgeMinutes - x.revisionMaxAgeMinutes;
  plan.candidates.sort((a, b) => Number(b.revisionInProgress) - Number(a.revisionInProgress) ||
    overdue(b) - overdue(a) || SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source));
  plan.selected = plan.candidates[0] ?? null;
  return plan;
}

async function fetchJson(fetchImpl, url, token) {
  const response = await fetchImpl(url, { method:"GET", headers:{ Authorization:`Bearer ${token}` },
    redirect:"error", cache:"no-store", signal:AbortSignal.timeout(60_000) });
  if (response.status !== 200) throw new Error("observe-http-" + response.status);
  try { return JSON.parse(await response.text()); } catch { throw new Error("observe-invalid-json"); }
}

export async function runRevisionShadow({ base, token, fetchImpl = fetch, clock = Date.now } = {}) {
  assert(typeof base === "string" && /^https:\/\//u.test(base), "VIGIA_BASE_URL must be HTTPS");
  assert(text(token), "VIGIA_SYNC_TOKEN is required");
  const root = new URL(base);
  assert(!root.username && !root.password && !root.search && !root.hash && root.pathname === "/", "invalid-runtime-base");
  const policyPayload = await fetchJson(fetchImpl, root.origin + "/api/freshness?observe=1&policy=1", token);
  const policies = validateControlPolicies(policyPayload);
  const observations = {};
  await Promise.all(policies.filter((p) => p.revision.required).map(async (p) => {
    try {
      const body = await fetchJson(fetchImpl, root.origin + ADAPTERS[p.source].path, token);
      observations[p.source] = { body, observedAt:new Date(clock()).toISOString() };
    } catch (error) {
      // Do not echo upstream response bodies, request headers, or raw exceptions.
      const readError = /^observe-(http-\d+|invalid-json)$/u.test(error.message) ? error.message : "observe-read-failed";
      observations[p.source] = { body:null, readError, observedAt:new Date(clock()).toISOString() };
    }
  }));
  const plan = buildRevisionShadowPlan(policyPayload, observations, { now:clock() });
  return { observedAt:plan.observedAt, plan };
}

async function main() {
  const mode = process.argv[2] ?? "shadow";
  if (mode !== "shadow") throw new Error("F4B supports shadow mode only");
  const result = await runRevisionShadow({ base:process.env.VIGIA_BASE_URL, token:process.env.VIGIA_SYNC_TOKEN });
  console.log("REVISION_CONTROL_SHADOW " + JSON.stringify(result));
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
