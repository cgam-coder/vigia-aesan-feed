const base = process.env.VIGIA_BASE_URL;
const headers = { Authorization:`Bearer ${process.env.VIGIA_SYNC_TOKEN}` };
const stage = Number(process.env.RASFF_STAGE ?? "0");
const maxSuccessfulBatches = Number(process.env.MAX_SUCCESSFUL_BATCHES ?? "160");
const requireComplete = process.env.REQUIRE_COMPLETE === "1";
const batchSize = 40;

if (!base || !process.env.VIGIA_SYNC_TOKEN || !Number.isSafeInteger(stage) || stage < 1 ||
    !Number.isSafeInteger(maxSuccessfulBatches) || maxSuccessfulBatches < 1) {
  throw new Error("Invalid RASFF staged-backfill environment");
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const request = async (path, method = "GET") => {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(base + path, {
        method,
        headers,
        redirect:"follow",
        signal:AbortSignal.timeout(600_000),
      });
      const text = await response.text();
      let body;
      try { body = JSON.parse(text); }
      catch { throw new Error(`${method} ${path} returned non-JSON HTTP ${response.status}: ${text.slice(0, 240)}`); }
      return { status:response.status, body };
    } catch (error) {
      last = error;
      if (attempt < 3) await sleep(attempt * 3_000);
    }
  }
  throw last;
};
const call = async (path, method = "GET") => {
  const result = await request(path, method);
  if (result.status !== 200) {
    throw new Error(`${method} ${path} failed HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 500)}`);
  }
  return result.body;
};
const sourceCounts = (audit) => ({
  AESAN:audit.counts.aesanAlerts,
  RAPNA:audit.counts.rapnaAlerts,
  "SAFETY GATE":audit.counts.safetyGateAlerts,
  OECD:audit.counts.oecdAlerts,
});
const assertIntegrity = (audit, label) => {
  const anomalies = Object.entries(audit.integrity).filter(([, value]) => value !== 0);
  const { counts, productDomains:domains, geography, hazards } = audit;
  if (anomalies.length || counts.rasffMissingProductAlerts !== 0 ||
      counts.rasffNullProductDescriptionAlerts !== counts.rasffProductIdWithoutDescriptionAlerts ||
      domains.missingOrStaleDimensionState !== 0 ||
      domains.humanFood + domains.animalFeed + domains.nonFood + domains.unknown !== counts.rasffAlerts ||
      geography.mappedRows + geography.unmappedRows !== geography.rows ||
      geography.originRows + geography.notifyingRows + geography.distributionRows + geography.affectedRows !== geography.rows ||
      geography.alertsWithGeography > counts.rasffAlerts ||
      hazards.mappedRows + hazards.unmappedRows + hazards.unknownRows !== hazards.rows ||
      hazards.alertsWithHazards > counts.rasffAlerts) {
    throw new Error(`${label} audit failed: ${JSON.stringify({ anomalies, counts, domains, geography, hazards })}`);
  }
};
const assertOtherSources = (baseline, audit, label) => {
  const current = sourceCounts(audit);
  for (const source of Object.keys(baseline)) {
    if (current[source] < baseline[source]) {
      throw new Error(`${label}: ${source} regressed from ${baseline[source]} to ${current[source]}`);
    }
  }
};
const compact = (state) => ({
  status:state.status,
  cursor:state.cursor,
  cursorKey:state.cursorKey,
  totalUnits:state.totalUnits,
  pagesScanned:state.pagesScanned,
  recordsObserved:state.recordsObserved,
  recordsPersisted:state.recordsPersisted,
  newCount:state.newCount,
  updatedCount:state.updatedCount,
  detailFailures:state.detailFailures,
  pageErrors:state.pageErrors,
  coverage:state.coverage,
  lastError:state.lastError,
  leaseOwnerId:state.leaseOwnerId,
  leaseMode:state.leaseMode,
  leaseExpiresAt:state.leaseExpiresAt,
});
const transient = (message) => /HTTP (?:429|5\d\d)|fetch failed|timeout|aborted/iu.test(message || "");

let initialObserve;
for (let poll = 1; poll <= 120; poll++) {
  initialObserve = await call("/api/rasff/sync?observe=1");
  if (initialObserve.lease === null) break;
  if (poll % 4 === 0) console.log("BACKFILL_STAGE_WAITING_FOR_LEASE " + JSON.stringify({ stage, poll, lease:initialObserve.lease }));
  await sleep(15_000);
}
if (!initialObserve || initialObserve.lease !== null || !initialObserve.backfill) {
  throw new Error(`Stage ${stage} could not obtain a lease-free RASFF checkpoint`);
}

const initialAudit = (await call("/api/rasff/sync?audit=1")).audit;
assertIntegrity(initialAudit, `stage-${stage}-initial`);
const baselineSources = sourceCounts(initialAudit);
const initialState = initialObserve.backfill;
if (initialState.status !== "completed" &&
    (initialState.cursor < 8475 || initialState.recordsObserved < 8475 || initialState.recordsPersisted < 8160)) {
  throw new Error(`Stage ${stage} detected a backwards checkpoint: ${JSON.stringify(compact(initialState))}`);
}
console.log("BACKFILL_STAGE_INITIAL " + JSON.stringify({ stage, state:compact(initialState), audit:initialAudit }));

let priorCursor = initialState.cursor;
let priorObserved = initialState.recordsObserved;
let priorPersisted = initialState.recordsPersisted;
let priorPageErrors = initialState.pageErrors;
let successfulBatches = 0;
let transientFailures = 0;
let attempts = 0;
let finalState = initialState.status === "completed" ? initialState : null;

while (!finalState && successfulBatches < maxSuccessfulBatches && attempts < maxSuccessfulBatches * 4) {
  attempts += 1;
  const result = await request(`/api/rasff/sync?mode=backfill&batchSize=${batchSize}`, "POST");
  const state = result.body?.state;
  if (!state || state.source !== "RASFF" || state.mode !== "backfill") {
    throw new Error(`Stage ${stage} attempt ${attempts} returned invalid state: ${JSON.stringify(result.body)}`);
  }
  if (result.status === 503) {
    if (state.status !== "failed" || !transient(state.lastError) || state.cursor !== priorCursor ||
        state.recordsObserved !== priorObserved || state.recordsPersisted !== priorPersisted ||
        state.pageErrors !== priorPageErrors + 1 || state.detailFailures !== 0 ||
        state.leaseOwnerId !== null || state.leaseMode !== null || state.leaseExpiresAt !== null) {
      throw new Error(`Stage ${stage} attempt ${attempts} non-recoverable failure: ${JSON.stringify(compact(state))}`);
    }
    transientFailures += 1;
    priorPageErrors = state.pageErrors;
    console.log("BACKFILL_RECOVERED_HTTP_503 " + JSON.stringify({ stage, attempts, transientFailures, ...compact(state) }));
    await sleep(5_000);
    continue;
  }
  if (result.status !== 200 || !["partial", "completed"].includes(state.status) ||
      state.detailFailures !== 0 || state.lastError !== null || state.pageErrors !== priorPageErrors ||
      state.leaseOwnerId !== null || state.leaseMode !== null || state.leaseExpiresAt !== null) {
    throw new Error(`Stage ${stage} attempt ${attempts} ingestion failure: HTTP ${result.status} ${JSON.stringify(compact(state))}`);
  }
  if ((state.status !== "completed" && state.cursor <= priorCursor) || state.recordsObserved <= priorObserved ||
      state.recordsPersisted < priorPersisted) {
    throw new Error(`Stage ${stage} attempt ${attempts} cursor/counter inconsistency`);
  }
  successfulBatches += 1;
  priorCursor = state.cursor;
  priorObserved = state.recordsObserved;
  priorPersisted = state.recordsPersisted;
  const observed = await call("/api/rasff/sync?observe=1");
  if (observed.lease !== null || !observed.backfill) throw new Error(`Stage ${stage} batch ${successfulBatches} lease failure`);
  for (const key of ["status", "cursor", "cursorKey", "recordsObserved", "recordsPersisted", "newCount",
    "updatedCount", "detailFailures", "pageErrors", "coverage"]) {
    if (observed.backfill[key] !== state[key]) throw new Error(`Stage ${stage} batch ${successfulBatches} observe drift at ${key}`);
  }
  console.log("BACKFILL_STAGE_BATCH " + JSON.stringify({ stage, batch:successfulBatches, attempts, ...compact(state) }));
  if (successfulBatches % 25 === 0 || state.status === "completed") {
    const audit = (await call("/api/rasff/sync?audit=1")).audit;
    assertIntegrity(audit, `stage-${stage}-batch-${successfulBatches}`);
    assertOtherSources(baselineSources, audit, `stage-${stage}-batch-${successfulBatches}`);
    console.log("BACKFILL_STAGE_AUDIT " + JSON.stringify({ stage, batch:successfulBatches, audit }));
  }
  if (state.status === "completed") finalState = state;
}

console.log("BACKFILL_STAGE_SUMMARY " + JSON.stringify({
  stage,
  attempts,
  successfulBatches,
  transientFailures,
  initialCursor:initialState.cursor,
  finalState:compact(finalState ?? (await call("/api/rasff/sync?observe=1")).backfill),
}));

if (!finalState) {
  if (requireComplete) throw new Error(`Final stage ${stage} did not complete the RASFF backfill`);
  process.exit(0);
}
if (finalState.coverage !== "official-index-complete" || finalState.cursor !== 0 || finalState.cursorKey !== null) {
  throw new Error(`Stage ${stage} completed with invalid coverage: ${JSON.stringify(compact(finalState))}`);
}

const official = (await call("/api/rasff/sync?mode=preview-reconcile&cursor=0&batchSize=40", "POST")).preview;
const expectedOperational = official.totalElements - official.archiveSkippedCount;
const finalAudit = (await call("/api/rasff/sync?audit=1")).audit;
const finalObserve = await call("/api/rasff/sync?observe=1");
assertIntegrity(finalAudit, `stage-${stage}-final`);
assertOtherSources(baselineSources, finalAudit, `stage-${stage}-final`);
if (finalObserve.lease !== null || finalObserve.backfill?.status !== "completed" ||
    finalObserve.backfill.coverage !== "official-index-complete" ||
    official.totalElements !== finalState.totalUnits || finalAudit.counts.rasffAlerts !== expectedOperational ||
    finalAudit.counts.rasffUniqueReferences !== finalAudit.counts.rasffAlerts ||
    finalAudit.counts.rasffSourceIdentities !== finalAudit.counts.rasffAlerts ||
    finalAudit.counts.rasffVersions !== finalAudit.counts.rasffVersionCountSum) {
  throw new Error("Final RASFF corpus does not match the official operational universe");
}
console.log("BACKFILL_FINAL_STATE " + JSON.stringify(finalState));
console.log("BACKFILL_FINAL_UNIVERSE " + JSON.stringify({
  totalElements:official.totalElements,
  archiveSkipped:official.archiveSkippedCount,
  expectedOperational,
}));
console.log("BACKFILL_FINAL_AUDIT " + JSON.stringify(finalAudit));
console.log("BACKFILL_FINAL_OBSERVE " + JSON.stringify(finalObserve));
