const SEARCH_URL = "https://webgate.ec.europa.eu/rasff-window/backend/public/notification/search/consolidated/en/";
export const RECENT_TARGET_MS = 35 * 60_000;

export class ResponseLostError extends Error {
  constructor(message, options = {}) { super(message, options); this.name = "ResponseLostError"; }
}

const iso = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
const count = (value) => Number.isSafeInteger(value) && value >= 0;

export function classifyLease(lease, now = Date.now()) {
  if (lease === null || lease === undefined) return { kind:"none", lease:null };
  if (!lease || typeof lease !== "object" || Array.isArray(lease) || lease.source !== "RASFF" ||
      typeof lease.ownerId !== "string" || !lease.ownerId || typeof lease.mode !== "string" || !lease.mode ||
      !iso(lease.acquiredAt) || !iso(lease.heartbeatAt) || !iso(lease.expiresAt) ||
      Date.parse(lease.acquiredAt) > Date.parse(lease.heartbeatAt) ||
      Date.parse(lease.heartbeatAt) > Date.parse(lease.expiresAt)) {
    return { kind:"malformed", lease, error:"RASFF lease is malformed or ambiguous" };
  }
  return { kind:Date.parse(lease.expiresAt) > now ? "live" : "expired", lease };
}

export function reconcileProgress(state) {
  if (!state || typeof state !== "object" || state.source !== "RASFF" || state.mode !== "reconcile" ||
      !["running", "partial", "completed"].includes(state.status) || !count(state.cursor) ||
      !count(state.recordsObserved) || !count(state.recordsPersisted) || !count(state.newCount) ||
      !count(state.updatedCount) || !count(state.detailFailures) || !count(state.pageErrors)) return null;
  return { cursor:state.cursor, recordsObserved:state.recordsObserved, recordsPersisted:state.recordsPersisted,
    newCount:state.newCount, updatedCount:state.updatedCount, detailFailures:state.detailFailures,
    pageErrors:state.pageErrors, status:state.status };
}

export const hasAdvanced = (before, after) => Boolean(before && after && (
  after.recordsObserved > before.recordsObserved || after.cursor > before.cursor ||
  (after.status === "completed" && before.status !== "completed")
));

export const recentDue = (recent, now = Date.now(), targetMs = RECENT_TARGET_MS) =>
  !iso(recent?.lastSuccessAt) || now - Date.parse(recent.lastSuccessAt) >= targetMs;

export const recoverableGlobalFailure = (state) => Boolean(state?.status === "failed" &&
  state.leaseOwnerId === null && state.leaseMode === null && state.leaseExpiresAt === null && (
    state.lastError === "D1_ERROR: out of memory: SQLITE_NOMEM" ||
    /^D1_ERROR: internal error; reference = [a-z0-9]+$/u.test(state.lastError || "") ||
    state.lastError === "RASFF agotó el timeout para " + SEARCH_URL ||
    state.lastError === "RASFF abortó la petición para " + SEARCH_URL ||
    state.lastError === "RASFF sufrió un fallo de red para " + SEARCH_URL ||
    state.lastError === "RASFF reconciliation index changed during cursor recovery" ||
    state.lastError === "RASFF reconciliation index changed during batch discovery" ||
    /^RASFF devolvió HTTP (?:429|5\d\d) para https:\/\/webgate\.ec\.europa\.eu\/rasff-window\/backend\/public\/notification\/search\/consolidated\/en\/$/u.test(state.lastError || "")
  ));

export function createHttpTransport({ base, token, requestTimeoutMs = 600_000, now = () => Date.now() }) {
  if (!base || !token) throw new Error("VIGIA_BASE_URL and VIGIA_SYNC_TOKEN are required");
  const headers = { Authorization:`Bearer ${token}`, "Content-Type":"application/json" };
  return async (path, method = "GET", deadline = Number.POSITIVE_INFINITY) => {
    const remaining = deadline - now();
    if (remaining <= 0) throw new Error(`RASFF control deadline exceeded before ${method} ${path}`);
    const timeout = Math.max(1, Math.min(requestTimeoutMs, remaining));
    let response;
    try {
      response = await fetch(base + path, { method, headers, redirect:"follow", signal:AbortSignal.timeout(timeout) });
    } catch (error) {
      throw new ResponseLostError(`${method} ${path} lost its response`, { cause:error });
    }
    let raw;
    try { raw = await response.text(); }
    catch (error) { throw new ResponseLostError(`${method} ${path} lost its response body`, { cause:error }); }
    let body;
    try { body = JSON.parse(raw); }
    catch (error) { throw new ResponseLostError(`${method} ${path} returned non-JSON HTTP ${response.status}`, { cause:error }); }
    return { http:response.status, body, raw };
  };
}

const observe = async (transport, deadline) => {
  const result = await transport("/api/rasff/sync?observe=1", "GET", deadline);
  if (result.http !== 200 || !result.body || typeof result.body !== "object")
    throw new Error(`RASFF observe failed HTTP ${result.http}`);
  const lease = classifyLease(result.body.lease, Date.now());
  if (lease.kind === "malformed") throw new Error(lease.error);
  return { ...result.body, leaseClassification:lease };
};

const sleepWithin = async (sleep, milliseconds, deadline, now) => {
  const remaining = deadline - now();
  if (remaining <= 0) return false;
  await sleep(Math.min(milliseconds, remaining));
  return now() < deadline;
};

export async function runRecentControl({ transport, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = console.log, deadline = now() + 20 * 60_000, maxAttempts = 4 } = {}) {
  if (typeof transport !== "function") throw new Error("RASFF transport is required");
  const initial = await observe(transport, deadline);
  const baseline = iso(initial.recent?.lastSuccessAt) ? Date.parse(initial.recent.lastSuccessAt) : Number.NEGATIVE_INFINITY;
  let originalError = null;
  for (let attempt = 1; attempt <= maxAttempts && now() < deadline; attempt += 1) {
    const current = attempt === 1 ? initial : await observe(transport, deadline);
    const lease = classifyLease(current.lease, now());
    if (lease.kind === "malformed") throw new Error(lease.error);
    if (lease.kind === "live") {
      log(`RASFF_RECENT_BLOCKED ${JSON.stringify({ attempt, lease:lease.lease })}`);
      if (attempt === maxAttempts || !await sleepWithin(sleep, 15_000, deadline, now))
        return { status:"blocked", state:current.recent ?? null, originalError };
      continue;
    }
    try {
      const result = await transport("/api/rasff/sync?mode=recent", "POST", deadline);
      const state = result.body?.state;
      if (result.http === 200 && state?.source === "RASFF" && state.mode === "recent" && state.status === "completed" &&
          state.leaseOwnerId === null && state.leaseMode === null && state.leaseExpiresAt === null) {
        return { status:"completed", state, originalError };
      }
      if (result.http !== 202 || state?.status !== "skipped")
        throw new Error(`RASFF recent failed HTTP ${result.http}: ${String(result.raw).slice(0, 600)}`);
      log(`RASFF_RECENT_SKIPPED ${JSON.stringify(result.body)}`);
    } catch (error) {
      originalError ??= error;
      log(`RASFF_RECENT_RESPONSE_UNCERTAIN ${JSON.stringify({ attempt, error:String(error) })}`);
    }
    const persisted = await observe(transport, deadline);
    const persistedAt = iso(persisted.recent?.lastSuccessAt) ? Date.parse(persisted.recent.lastSuccessAt) : Number.NEGATIVE_INFINITY;
    if (persistedAt > baseline) return { status:"recovered-after-response-loss", state:persisted.recent, originalError };
    const successor = classifyLease(persisted.lease, now());
    if (successor.kind === "malformed") throw new Error(successor.error);
    if (successor.kind === "live") {
      log(`RASFF_RECENT_SUCCESSOR_LEASE ${JSON.stringify(successor.lease)}`);
      if (attempt === maxAttempts || !await sleepWithin(sleep, 15_000, deadline, now))
        return { status:"blocked", state:persisted.recent ?? null, originalError };
      continue;
    }
    if (attempt < maxAttempts) await sleepWithin(sleep, attempt * 5_000, deadline, now);
  }
  throw new Error(`RASFF recent made no progress within its bounded recovery window; original=${String(originalError)}`,
    { cause:originalError ?? undefined });
}

async function reconcileBatch({ transport, prior, deadline, now, sleep, log, maxAttempts = 5 }) {
  let originalError = null;
  for (let attempt = 1; attempt <= maxAttempts && now() < deadline; attempt += 1) {
    try {
      const result = await transport("/api/rasff/sync?mode=reconcile&batchSize=20", "POST", deadline);
      if (result.http === 202 && result.body?.state?.status === "skipped") return { kind:"blocked", body:result.body, originalError };
      if (result.http === 200) return { kind:"response", body:result.body, originalError };
      if (result.http !== 503 || !recoverableGlobalFailure(result.body?.state))
        throw new Error(`RASFF reconcile failed HTTP ${result.http}: ${String(result.raw).slice(0, 600)}`);
      originalError ??= new Error(`recoverable HTTP 503: ${result.body.state.lastError}`);
    } catch (error) {
      originalError ??= error;
    }
    log(`RASFF_RECONCILE_RESPONSE_UNCERTAIN ${JSON.stringify({ attempt, error:String(originalError) })}`);
    const persisted = await observe(transport, deadline);
    const progress = reconcileProgress(persisted.reconcile);
    if (hasAdvanced(prior, progress)) return { kind:"recovered-after-response-loss",
      body:{ state:persisted.reconcile }, originalError };
    const lease = classifyLease(persisted.lease, now());
    if (lease.kind === "malformed") throw new Error(lease.error, { cause:originalError });
    if (lease.kind === "live") return { kind:"successor-active", body:{ state:persisted.reconcile }, originalError };
    if (attempt < maxAttempts) await sleepWithin(sleep, attempt * 5_000, deadline, now);
  }
  throw new Error(`RASFF reconcile made no progress after bounded recovery; original=${String(originalError)}`,
    { cause:originalError ?? undefined });
}

export async function runReconcileControl({ transport, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = console.log, deadline = now() + 340 * 60_000, maxBatches = 2_000 } = {}) {
  if (typeof transport !== "function") throw new Error("RASFF transport is required");
  let current = await observe(transport, deadline);
  const initialLease = classifyLease(current.lease, now());
  if (initialLease.kind === "malformed") throw new Error(initialLease.error);
  if (initialLease.kind === "live") return { status:"blocked", executed:0, state:current.reconcile ?? null };
  if (current.backfill?.coverage !== "official-index-complete") throw new Error("RASFF historical coverage is not complete");
  if (current.reconcile?.status === "failed" && !recoverableGlobalFailure(current.reconcile))
    throw new Error(`RASFF reconcile is semantically failed: ${current.reconcile.lastError}`);
  let prior = reconcileProgress(current.reconcile?.status === "completed" || !current.reconcile ? {
    source:"RASFF", mode:"reconcile", status:"partial", cursor:0, recordsObserved:0, recordsPersisted:0,
    newCount:0, updatedCount:0, detailFailures:0, pageErrors:0,
  } : current.reconcile);
  if (!prior) throw new Error("RASFF reconcile checkpoint is malformed");
  let executed = 0;
  for (let index = 1; index <= maxBatches && now() < deadline; index += 1) {
    current = await observe(transport, deadline);
    if (recentDue(current.recent, now())) {
      const recent = await runRecentControl({ transport, now, sleep, log,
        deadline:Math.min(deadline, now() + 20 * 60_000), maxAttempts:4 });
      log(`RASFF_RECONCILE_YIELDED_TO_RECENT ${JSON.stringify({ index, status:recent.status,
        lastSuccessAt:recent.state?.lastSuccessAt ?? null, originalError:recent.originalError ? String(recent.originalError) : null })}`);
      if (!recent.state || recentDue(recent.state, now())) return { status:"blocked-recent", executed, state:current.reconcile ?? null };
    }
    const result = await reconcileBatch({ transport, prior, deadline, now, sleep, log });
    if (["blocked", "successor-active"].includes(result.kind)) return { status:result.kind, executed,
      state:result.body?.state ?? null, originalError:result.originalError };
    const state = result.body?.state;
    const progress = reconcileProgress(state);
    if (!progress || !hasAdvanced(prior, progress)) throw new Error(`RASFF reconcile batch did not advance: ${JSON.stringify(state)}`);
    if (state.status === "partial" && (!state.cursorKey || state.coverage !== "partial"))
      throw new Error(`RASFF reconcile partial state is invalid: ${JSON.stringify(state)}`);
    if (state.status === "completed" && (state.cursor !== 0 || state.cursorKey !== null ||
        state.coverage !== "official-index-complete")) throw new Error(`RASFF reconcile terminal state is invalid: ${JSON.stringify(state)}`);
    if (state.leaseOwnerId !== null || state.leaseMode !== null || state.leaseExpiresAt !== null)
      throw new Error(`RASFF reconcile response retained a lease: ${JSON.stringify(state)}`);
    executed += 1;
    log(`RASFF_RECONCILE_BATCH ${JSON.stringify({ index, recovery:result.kind, state,
      originalError:result.originalError ? String(result.originalError) : null })}`);
    prior = progress;
    if (state.status === "completed") return { status:"completed", executed, state };
  }
  return { status:"budget-exhausted", executed, state:(await observe(transport, deadline)).reconcile ?? null };
}

async function main() {
  const lane = process.argv[2];
  const now = () => Date.now();
  const transport = createHttpTransport({ base:process.env.VIGIA_BASE_URL, token:process.env.VIGIA_SYNC_TOKEN, now });
  const result = lane === "recent" ? await runRecentControl({ transport, now }) :
    lane === "reconcile" ? await runReconcileControl({ transport, now }) : null;
  if (!result) throw new Error("Usage: node scripts/rasff-control.mjs <recent|reconcile>");
  console.log(`RASFF_${lane.toUpperCase()}_STAGE_COMPLETE ${JSON.stringify(result)}`);
  if (result.status === "blocked-recent" || lane === "recent" && result.status === "blocked") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
