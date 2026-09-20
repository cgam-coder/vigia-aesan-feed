export const EXPECTED_SOURCES = Object.freeze([
  "AESAN",
  "RAPNA",
  "RASFF",
  "SAFETY GATE",
  "OECD",
]);

const AUDIT_SOURCES = Object.freeze(EXPECTED_SOURCES.filter((source) => source !== "AESAN"));
const REVISION_CONTRACT = Object.freeze({
  AESAN:{ observeKey:"historicalReconcile", mode:"historical-reconcile", revisionStatus:"fresh" },
  RAPNA:{ observeKey:"currentParity", mode:"current-parity", revisionStatus:"fresh" },
  RASFF:{ observeKey:"reconcile", mode:"reconcile", revisionStatus:"fresh" },
  "SAFETY GATE":{ observeKey:null, mode:null, revisionStatus:"not-required" },
  OECD:{ observeKey:"historicalReconcile", certificationKey:"revisionCertification",
    mode:"historical-reconcile", revisionStatus:"fresh" },
});

const REQUIRED_INTEGRITY_KEYS = Object.freeze({
  RAPNA:["duplicateReferenceGroups","invalidIdentities","emptyCanonicalRows","invalidOfficialUrls"],
  RASFF:[
    "duplicateReferenceGroups","duplicateNotifIdGroups","invalidIdentities",
    "missingOrInvalidSourceIdentities","emptyCanonicalRows","canonicalIdentityMismatches",
    "invalidOfficialUrls","invalidContentHashes","invalidVersionHashes",
    "versionCountMismatches","cutoffViolations","missingPublishedAt",
  ],
  "SAFETY GATE":["duplicateReferenceGroups","invalidIdentities","emptyCanonicalRows","invalidOfficialUrls"],
  OECD:["duplicateReferenceGroups","invalidIdentities","emptyCanonicalRows","invalidOfficialUrls"],
});

const OECD_DATA_CHARACTERISTICS = Object.freeze([
  "sentinelPublishedDates",
  "missingPublishedAt",
  "unclassifiedDomains",
]);

const REQUIRED_COUNT_KEYS = Object.freeze({
  RAPNA:["alerts","rapnaAlerts","rapnaUniqueReferences","rapnaVersions","rapnaVersionCountSum"],
  RASFF:[
    "alerts","rasffAlerts","rasffUniqueReferences","rasffSourceIdentities",
    "rasffVersions","rasffVersionCountSum",
  ],
  "SAFETY GATE":[
    "alerts","safetyGateAlerts","safetyGateUniqueReferences",
    "safetyGateVersions","safetyGateVersionCountSum",
  ],
  OECD:["alerts","oecdAlerts","oecdUniqueReferences","oecdVersions","oecdVersionCountSum"],
});

function fail(message) {
  throw new Error(message);
}

function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function own(value, key, label) {
  if (!Object.hasOwn(value, key)) fail(`${label}.${key} is required`);
  return value[key];
}

function exactKeys(value, expected, label) {
  const actual = Object.keys(object(value, label));
  const missing = expected.filter((key) => !actual.includes(key));
  const unexpected = actual.filter((key) => !expected.includes(key));
  if (missing.length || unexpected.length)
    fail(`${label} keys invalid (missing=${missing.join(",") || "none"}; unexpected=${unexpected.join(",") || "none"})`);
}

function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} must be a non-negative safe integer`);
  return value;
}

function isoDate(value, label) {
  if (typeof value !== "string" || !value || !Number.isFinite(Date.parse(value))) fail(`${label} must be an ISO date`);
  return value;
}

function array(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || !value) fail(`${label} must be a non-empty string`);
  return value;
}

function validateLease(observe, source) {
  const lease = own(observe, "lease", `observes.${source}`);
  if (lease === null) return null;
  object(lease, `observes.${source}.lease`);
  if (own(lease, "source", `observes.${source}.lease`) !== source)
    fail(`observes.${source}.lease.source is invalid`);
  nonEmptyString(own(lease, "ownerId", `observes.${source}.lease`), `observes.${source}.lease.ownerId`);
  const mode = nonEmptyString(own(lease, "mode", `observes.${source}.lease`), `observes.${source}.lease.mode`);
  const acquiredAt = isoDate(own(lease, "acquiredAt", `observes.${source}.lease`),
    `observes.${source}.lease.acquiredAt`);
  const heartbeatAt = isoDate(own(lease, "heartbeatAt", `observes.${source}.lease`),
    `observes.${source}.lease.heartbeatAt`);
  const expiresAt = isoDate(own(lease, "expiresAt", `observes.${source}.lease`),
    `observes.${source}.lease.expiresAt`);
  if (Date.parse(acquiredAt) > Date.parse(heartbeatAt) || Date.parse(heartbeatAt) > Date.parse(expiresAt))
    fail(`observes.${source}.lease timestamps are inconsistent`);
  if (source === "RASFF" && mode !== "reconcile") fail("RASFF has an incompatible active lease");
  if (source === "OECD" && mode !== "historical-reconcile") fail("OECD has an incompatible active lease");
  if (source !== "RASFF" && source !== "OECD") fail(`observes.${source} has an incompatible active lease`);
  return lease;
}

function validateRevisionState(source, observe, lease) {
  const contract = REVISION_CONTRACT[source];
  if (!contract.observeKey) return;
  const state = object(own(observe, contract.observeKey, `observes.${source}`),
    `observes.${source}.${contract.observeKey}`);
  if (own(state, "source", `observes.${source}.${contract.observeKey}`) !== source)
    fail(`observes.${source}.${contract.observeKey}.source is invalid`);
  if (own(state, "mode", `observes.${source}.${contract.observeKey}`) !== contract.mode)
    fail(`observes.${source}.${contract.observeKey}.mode is invalid`);
  const status = own(state, "status", `observes.${source}.${contract.observeKey}`);
  const allowed = source === "RASFF" || source === "OECD" ? ["running","partial","completed"] : ["completed"];
  if (!allowed.includes(status)) fail(`observes.${source}.${contract.observeKey}.status is invalid`);
  const cursor = count(own(state, "cursor", `observes.${source}.${contract.observeKey}`),
    `observes.${source}.${contract.observeKey}.cursor`);
  const total = count(own(state, "totalUnits", `observes.${source}.${contract.observeKey}`),
    `observes.${source}.${contract.observeKey}.totalUnits`);
  if (total === 0) fail(`observes.${source}.${contract.observeKey}.totalUnits must be positive`);
  count(own(state, "detailFailures", `observes.${source}.${contract.observeKey}`),
    `observes.${source}.${contract.observeKey}.detailFailures`);
  count(own(state, "pageErrors", `observes.${source}.${contract.observeKey}`),
    `observes.${source}.${contract.observeKey}.pageErrors`);
  isoDate(own(state, "lastSuccessAt", `observes.${source}.${contract.observeKey}`),
    `observes.${source}.${contract.observeKey}.lastSuccessAt`);
  const completedValue = own(state, "completedAt", `observes.${source}.${contract.observeKey}`);
  const completedAt = completedValue === null ? null : isoDate(completedValue,
    `observes.${source}.${contract.observeKey}.completedAt`);
  if (status === "running") {
    if (!lease || lease.mode !== contract.mode) fail(`${source} running state lacks its ${contract.mode} lease`);
    if (own(state, "leaseOwnerId", `observes.${source}.${contract.observeKey}`) !== lease.ownerId ||
        own(state, "leaseMode", `observes.${source}.${contract.observeKey}`) !== lease.mode)
      fail(`${source} running state disagrees with its active lease`);
    isoDate(own(state, "leaseExpiresAt", `observes.${source}.${contract.observeKey}`),
      `observes.${source}.${contract.observeKey}.leaseExpiresAt`);
    if (own(state, "coverage", `observes.${source}.${contract.observeKey}`) !== "partial")
      fail(`observes.${source}.${contract.observeKey}.coverage is not partial`);
  } else if (status === "completed") {
    if (cursor !== 0 && cursor !== total) fail(`observes.${source}.${contract.observeKey}.cursor is not terminal`);
    if (own(state, "coverage", `observes.${source}.${contract.observeKey}`) !== "official-index-complete")
      fail(`observes.${source}.${contract.observeKey}.coverage is not complete`);
  } else if (own(state, "coverage", `observes.${source}.${contract.observeKey}`) !== "partial") {
    fail(`observes.${source}.${contract.observeKey}.coverage is not partial`);
  }
  const failures = state.detailFailures;
  const lastError = own(state, "lastError", `observes.${source}.${contract.observeKey}`);
  if (failures === 0 && lastError !== null)
    fail(`observes.${source}.${contract.observeKey}.lastError must be null without detail failures`);
  if (failures > 0) {
    if (source !== "RASFF" || status !== "completed" || state.coverage !== "official-index-complete")
      fail(`observes.${source}.${contract.observeKey} has uncertified deferred details`);
    if (typeof lastError !== "string" || !lastError.includes(`${failures} detalles RASFF diferidos`))
      fail(`observes.${source}.${contract.observeKey}.lastError does not certify deferred details`);
    if (state.pageErrors < failures)
      fail(`observes.${source}.${contract.observeKey}.pageErrors is inconsistent with deferred details`);
  }
  if (source === "OECD" && (lastError !== null || state.detailFailures !== 0 || state.pageErrors !== 0))
    fail("observes.OECD.historicalReconcile contains an uncertified current-cycle error");
  if (source !== "OECD" && completedAt === null)
    fail(`observes.${source}.${contract.observeKey}.completedAt is required`);
  if (source === "OECD" && status === "completed" && completedAt === null)
    fail("observes.OECD.historicalReconcile.completedAt is required for a completed cycle");
  return completedAt;
}

function validateRevisionCertification(source, observe) {
  const contract = REVISION_CONTRACT[source];
  if (!contract.certificationKey) return null;
  const label = `observes.${source}.${contract.certificationKey}`;
  const certification = object(own(observe, contract.certificationKey, `observes.${source}`), label);
  if (own(certification, "source", label) !== source || own(certification, "mode", label) !== contract.mode)
    fail(`${label} identity is invalid`);
  nonEmptyString(own(certification, "cycleId", label), `${label}.cycleId`);
  const completedAt = isoDate(own(certification, "completedAt", label), `${label}.completedAt`);
  const total = count(own(certification, "totalUnits", label), `${label}.totalUnits`);
  if (total === 0) fail(`${label}.totalUnits must be positive`);
  count(own(certification, "recordsObserved", label), `${label}.recordsObserved`);
  if (own(certification, "coverage", label) !== "official-index-complete") fail(`${label}.coverage is invalid`);
  if (own(certification, "auditStatus", label) !== "passed") fail(`${label}.auditStatus must be passed`);
  const auditCheckedAt = isoDate(own(certification, "auditCheckedAt", label), `${label}.auditCheckedAt`);
  if (Date.parse(auditCheckedAt) < Date.parse(completedAt)) fail(`${label} audit precedes completion`);
  const evidence = object(own(certification, "evidence", label), `${label}.evidence`);
  const audit = object(own(evidence, "audit", `${label}.evidence`), `${label}.evidence.audit`);
  if (isoDate(own(audit, "checkedAt", `${label}.evidence.audit`), `${label}.evidence.audit.checkedAt`) !== auditCheckedAt)
    fail(`${label}.auditCheckedAt disagrees with its evidence`);
  validateAudit("OECD", audit);
  return completedAt;
}

function validateObserves(observes) {
  exactKeys(observes, EXPECTED_SOURCES, "observes");
  const completedAt = {};
  for (const source of EXPECTED_SOURCES) {
    const observe = object(observes[source], `observes.${source}`);
    const lease = validateLease(observe, source);
    const currentCompletedAt = validateRevisionState(source, observe, lease) ?? null;
    completedAt[source] = validateRevisionCertification(source, observe) ?? currentCompletedAt;
  }
  return completedAt;
}

function validateAudit(source, audit) {
  audit = object(audit, `audits.${source}`);
  isoDate(own(audit, "checkedAt", `audits.${source}`), `audits.${source}.checkedAt`);
  const counts = object(own(audit, "counts", `audits.${source}`), `audits.${source}.counts`);
  for (const key of REQUIRED_COUNT_KEYS[source]) count(own(counts, key, `audits.${source}.counts`),
    `audits.${source}.counts.${key}`);
  const integrity = object(own(audit, "integrity", `audits.${source}`), `audits.${source}.integrity`);
  if (!Object.keys(integrity).length) fail(`audits.${source}.integrity must not be empty`);
  const required = REQUIRED_INTEGRITY_KEYS[source];
  for (const key of required) count(own(integrity, key, `audits.${source}.integrity`),
    `audits.${source}.integrity.${key}`);
  if (source === "OECD") {
    for (const key of OECD_DATA_CHARACTERISTICS) count(own(integrity, key, `audits.${source}.integrity`),
      `audits.${source}.integrity.${key}`);
  }
  for (const [key,value] of Object.entries(integrity)) {
    count(value, `audits.${source}.integrity.${key}`);
    if (!(source === "OECD" && OECD_DATA_CHARACTERISTICS.includes(key)) && value !== 0)
      fail(`audits.${source}.integrity.${key} must be zero`);
  }
  if (source === "RASFF") {
    if (counts.rasffAlerts !== counts.rasffUniqueReferences)
      fail("RASFF alert/reference counts differ");
    if (counts.rasffAlerts !== counts.rasffSourceIdentities)
      fail("RASFF alert/identity counts differ");
    if (counts.rasffVersions !== counts.rasffVersionCountSum)
      fail("RASFF version/version-count sum differs");
  }
}

function validateAudits(audits) {
  exactKeys(audits, AUDIT_SOURCES, "audits");
  for (const source of AUDIT_SOURCES) validateAudit(source, audits[source]);
}

function validateAesanPreview(preview) {
  preview = object(preview, "aesanPreview");
  if (own(preview, "status", "aesanPreview") !== "already-repaired" ||
      own(preview, "repaired", "aesanPreview") !== false)
    fail("AESAN repair is not idempotently verified");
  if (own(preview, "reference", "aesanPreview") !== "ES2026/517") fail("AESAN reference is invalid");
  if (count(own(preview, "versionCount", "aesanPreview"), "aesanPreview.versionCount") !== 2)
    fail("AESAN versionCount must be 2");
}

function validateRasffPreview(preview) {
  preview = object(preview, "rasffPreview");
  isoDate(own(preview, "checkedAt", "rasffPreview"), "rasffPreview.checkedAt");
  if (own(preview, "dryRun", "rasffPreview") !== true) fail("RASFF preview must be dry-run");
  if (count(own(preview, "remaining", "rasffPreview"), "rasffPreview.remaining") !== 0)
    fail("RASFF preview has remaining repairs");
  if (count(own(preview, "repaired", "rasffPreview"), "rasffPreview.repaired") !== 0)
    fail("RASFF preview unexpectedly repaired rows");
  if (array(own(preview, "rows", "rasffPreview"), "rasffPreview.rows").length !== 0)
    fail("RASFF preview rows must be empty");
}

function validateFreshnessStates(states, label, completedAt) {
  states = array(states, `${label}.states`);
  if (states.length !== EXPECTED_SOURCES.length) fail(`${label}.states must contain exactly five sources`);
  const bySource = new Map();
  for (const value of states) {
    const state = object(value, `${label}.state`);
    const source = own(state, "source", `${label}.state`);
    if (!EXPECTED_SOURCES.includes(source)) fail(`${label} contains unexpected source ${String(source)}`);
    if (bySource.has(source)) fail(`${label} contains duplicate source ${source}`);
    bySource.set(source, state);
  }
  for (const source of EXPECTED_SOURCES) {
    const state = bySource.get(source);
    if (!state) fail(`${label} omits source ${source}`);
    if (own(state, "status", `${label}.${source}`) !== "fresh") fail(`${label}.${source}.status must be fresh`);
    if (own(state, "error", `${label}.${source}`) !== null) fail(`${label}.${source}.error must be null`);
    if (own(state, "latestIdentityParity", `${label}.${source}`) !== true)
      fail(`${label}.${source}.latestIdentityParity must be true`);
    if (array(own(state, "missingOfficialIdentities", `${label}.${source}`),
      `${label}.${source}.missingOfficialIdentities`).length !== 0)
      fail(`${label}.${source}.missingOfficialIdentities must be empty`);
    if (array(own(state, "revisionMismatches", `${label}.${source}`),
      `${label}.${source}.revisionMismatches`).length !== 0)
      fail(`${label}.${source}.revisionMismatches must be empty`);
    isoDate(own(state, "lastSuccessfulParityAt", `${label}.${source}`),
      `${label}.${source}.lastSuccessfulParityAt`);
    const contract = REVISION_CONTRACT[source];
    if (own(state, "revisionStatus", `${label}.${source}`) !== contract.revisionStatus)
      fail(`${label}.${source}.revisionStatus must be ${contract.revisionStatus}`);
    if (contract.revisionStatus === "not-required") {
      for (const key of ["revisionLastSuccessAt","revisionProgress","revisionTotal"])
        if (own(state, key, `${label}.${source}`) !== null) fail(`${label}.${source}.${key} must be null`);
      continue;
    }
    const revisionAt = isoDate(own(state, "revisionLastSuccessAt", `${label}.${source}`),
      `${label}.${source}.revisionLastSuccessAt`);
    const progress = count(own(state, "revisionProgress", `${label}.${source}`),
      `${label}.${source}.revisionProgress`);
    const total = count(own(state, "revisionTotal", `${label}.${source}`),
      `${label}.${source}.revisionTotal`);
    if (total === 0 || progress > total) fail(`${label}.${source} revision progress is invalid`);
    if (completedAt[source] !== revisionAt)
      fail(`${label}.${source}.revisionLastSuccessAt disagrees with observed completedAt`);
  }
}

function validateFreshness(evidence, completedAt) {
  const audit = object(own(evidence, "freshnessAudit", "evidence"), "freshnessAudit");
  if (own(evidence, "freshnessAuditHttp", "evidence") !== 200) fail("freshnessAuditHttp must be 200");
  if (own(audit, "allFresh", "freshnessAudit") !== true) fail("freshnessAudit.allFresh must be true");
  validateFreshnessStates(own(audit, "states", "freshnessAudit"), "freshnessAudit", completedAt);
  const observe = object(own(evidence, "freshnessObserve", "evidence"), "freshnessObserve");
  validateFreshnessStates(own(observe, "states", "freshnessObserve"), "freshnessObserve", completedAt);
}

export function validateClosureEvidence(evidence) {
  evidence = object(evidence, "evidence");
  isoDate(own(evidence, "checkedAt", "evidence"), "evidence.checkedAt");
  const completedAt = validateObserves(own(evidence, "observes", "evidence"));
  validateAudits(own(evidence, "audits", "evidence"));
  validateAesanPreview(own(evidence, "aesanPreview", "evidence"));
  validateRasffPreview(own(evidence, "rasffPreview", "evidence"));
  validateFreshness(evidence, completedAt);
  return {
    sources:[...EXPECTED_SOURCES],
    rasffCompletedAt:completedAt.RASFF,
    oecdCompletedAt:completedAt.OECD,
  };
}
