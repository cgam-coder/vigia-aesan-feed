import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { EXPECTED_SOURCES, validateClosureEvidence } from "../scripts/gh-fixes-closure-verify.mjs";

const NOW = "2026-09-19T20:30:00.000Z";
const COMPLETED = "2026-09-19T19:56:27.271Z";

function revision(source, mode, total = 1, { partial = false } = {}) {
  return {
    source, mode, status:partial ? "partial" : "completed", cursor:partial ? 5 : total,
    totalUnits:total, detailFailures:0, pageErrors:0,
    coverage:partial ? "partial" : "official-index-complete",
    lastSuccessAt:NOW, completedAt:COMPLETED, lastError:null,
  };
}

function audit(counts, integrity) {
  return { checkedAt:NOW, counts, integrity };
}

function freshnessState(source) {
  const needsRevision = source !== "SAFETY GATE";
  return {
    source, status:"fresh", error:null, latestIdentityParity:true,
    missingOfficialIdentities:[], revisionMismatches:[], lastSuccessfulParityAt:NOW,
    revisionStatus:needsRevision ? "fresh" : "not-required",
    revisionLastSuccessAt:needsRevision ? COMPLETED : null,
    revisionProgress:needsRevision ? (source === "RASFF" ? 5 : 1) : null,
    revisionTotal:needsRevision ? (source === "RASFF" ? 10 : 1) : null,
  };
}

function validEvidence() {
  const states = EXPECTED_SOURCES.map(freshnessState);
  return {
    checkedAt:NOW,
    observes:{
      AESAN:{ lease:null, historicalReconcile:revision("AESAN", "historical-reconcile") },
      RAPNA:{ lease:null, currentParity:revision("RAPNA", "current-parity") },
      RASFF:{ lease:null, reconcile:revision("RASFF", "reconcile", 10, { partial:true }) },
      "SAFETY GATE":{ lease:null },
      OECD:{ lease:null, historicalReconcile:revision("OECD", "historical-reconcile") },
    },
    audits:{
      RAPNA:audit({ alerts:10, rapnaAlerts:2, rapnaUniqueReferences:2, rapnaVersions:2,
        rapnaVersionCountSum:2 }, {
        duplicateReferenceGroups:0, invalidIdentities:0, emptyCanonicalRows:0, invalidOfficialUrls:0,
      }),
      RASFF:audit({ alerts:10, rasffAlerts:3, rasffUniqueReferences:3, rasffSourceIdentities:3,
        rasffVersions:4, rasffVersionCountSum:4 }, {
        duplicateReferenceGroups:0, duplicateNotifIdGroups:0, invalidIdentities:0,
        missingOrInvalidSourceIdentities:0, emptyCanonicalRows:0, canonicalIdentityMismatches:0,
        invalidOfficialUrls:0, invalidContentHashes:0, invalidVersionHashes:0,
        versionCountMismatches:0, cutoffViolations:0, missingPublishedAt:0,
      }),
      "SAFETY GATE":audit({ alerts:10, safetyGateAlerts:2, safetyGateUniqueReferences:2,
        safetyGateVersions:2, safetyGateVersionCountSum:3 }, {
        duplicateReferenceGroups:0, invalidIdentities:0, emptyCanonicalRows:0, invalidOfficialUrls:0,
      }),
      OECD:audit({ alerts:10, oecdAlerts:3, oecdUniqueReferences:3, oecdVersions:4,
        oecdVersionCountSum:4 }, {
        duplicateReferenceGroups:0, invalidIdentities:0, emptyCanonicalRows:0, invalidOfficialUrls:0,
        sentinelPublishedDates:3, missingPublishedAt:3, unclassifiedDomains:7548,
      }),
    },
    aesanPreview:{ status:"already-repaired", repaired:false, reference:"ES2026/517", versionCount:2 },
    rasffPreview:{ checkedAt:NOW, dryRun:true, repaired:0, remaining:0, rows:[] },
    freshnessAudit:{ checkedAt:NOW, allFresh:true, states },
    freshnessAuditHttp:200,
    freshnessObserve:{ states:structuredClone(states) },
  };
}

test("accepts complete closure evidence and legitimate OECD data characteristics", () => {
  const result = validateClosureEvidence(validEvidence());
  assert.deepEqual(result.sources, EXPECTED_SOURCES);
  assert.equal(result.rasffCompletedAt, COMPLETED);
});

test("rejects absent audits and absent or empty integrity objects", () => {
  const absentAudit = validEvidence();
  delete absentAudit.audits.RAPNA;
  assert.throws(() => validateClosureEvidence(absentAudit), /audits keys invalid/u);

  const absentIntegrity = validEvidence();
  delete absentIntegrity.audits.RASFF.integrity;
  assert.throws(() => validateClosureEvidence(absentIntegrity), /integrity is required/u);

  const emptyIntegrity = validEvidence();
  emptyIntegrity.audits["SAFETY GATE"].integrity = {};
  assert.throws(() => validateClosureEvidence(emptyIntegrity), /integrity must not be empty/u);
});

test("rejects a missing required structural key", () => {
  const evidence = validEvidence();
  delete evidence.audits.RASFF.integrity.invalidVersionHashes;
  assert.throws(() => validateClosureEvidence(evidence), /invalidVersionHashes is required/u);
});

test("rejects null, string, negative and non-integer counters", () => {
  for (const invalid of [null, "3", -1, 1.5]) {
    const evidence = validEvidence();
    evidence.audits.RASFF.counts.rasffAlerts = invalid;
    assert.throws(() => validateClosureEvidence(evidence), /non-negative safe integer/u);
  }
});

test("rejects real RASFF count inequality after validating types", () => {
  for (const key of ["rasffUniqueReferences", "rasffSourceIdentities"]) {
    const evidence = validEvidence();
    evidence.audits.RASFF.counts[key] = 2;
    assert.throws(() => validateClosureEvidence(evidence), /RASFF alert\/(reference|identity) counts differ/u);
  }
  const versions = validEvidence();
  versions.audits.RASFF.counts.rasffVersionCountSum = 5;
  assert.throws(() => validateClosureEvidence(versions), /RASFF version\/version-count sum differs/u);
});

test("rejects duplicate, omitted and unexpected freshness sources", () => {
  const duplicate = validEvidence();
  duplicate.freshnessAudit.states[4].source = "AESAN";
  assert.throws(() => validateClosureEvidence(duplicate), /duplicate source AESAN/u);

  const omitted = validEvidence();
  omitted.freshnessAudit.states.pop();
  assert.throws(() => validateClosureEvidence(omitted), /exactly five sources/u);

  const unexpected = validEvidence();
  unexpected.freshnessAudit.states[4].source = "OTHER";
  assert.throws(() => validateClosureEvidence(unexpected), /unexpected source OTHER/u);
});

test("rejects allFresh true when an individual state is stale or revision-invalid", () => {
  const stale = validEvidence();
  stale.freshnessAudit.states[2].status = "stale";
  assert.throws(() => validateClosureEvidence(stale), /RASFF.status must be fresh/u);

  const invalidRevision = validEvidence();
  invalidRevision.freshnessAudit.states[2].revisionStatus = "stale";
  assert.throws(() => validateClosureEvidence(invalidRevision), /RASFF.revisionStatus must be fresh/u);
});

test("workflow imports the tested validator and keeps bounded timeouts coherent", () => {
  const workflow = readFileSync(new URL("../.github/workflows/gh-fixes-closure-verify.yml", import.meta.url), "utf8");
  assert.match(workflow, /import \{ validateClosureEvidence \} from "\.\/scripts\/gh-fixes-closure-verify\.mjs";/u);
  assert.match(workflow, /const summary=validateClosureEvidence\(evidence\);/u);
  assert.match(workflow, /timeout-minutes: 20/u);
  assert.match(workflow, /REQUEST_TIMEOUT_MS=120_000/u);
  assert.match(workflow, /LEASE_WAIT_ATTEMPTS=20, LEASE_WAIT_MS=15_000/u);
  assert.doesNotMatch(workflow, /1_800_000/u);
});
