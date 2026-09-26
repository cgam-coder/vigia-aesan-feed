import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { recoverableGlobalFailure as recoveryPredicate } from "../scripts/rasff-control.mjs";

const workflow = readFileSync(new URL("../.github/workflows/rasff-control.yml", import.meta.url), "utf8");
const controller = readFileSync(new URL("../scripts/rasff-control.mjs", import.meta.url), "utf8");

test("RASFF recent and reconcile lanes are independently serialized", () => {
  assert.match(workflow, /group: vigia-rasff-recent\n\s+cancel-in-progress: false/u);
  assert.match(workflow, /group: vigia-rasff-reconcile\n\s+cancel-in-progress: false/u);
  assert.equal((workflow.match(/group: vigia-rasff-/gu) ?? []).length, 2);
  assert.match(controller, /lane === "recent" && result\.status === "blocked"/u);
});

test("RASFF reconcile cadence and budget can cover the measured 32k corpus with scheduling margin", () => {
  assert.match(workflow, /cron: "17 \* \* \* \*"/u);
  assert.match(workflow, /timeout-minutes: 360/u);
  assert.match(controller, /batchSize=20/u);
  assert.match(controller, /maxBatches = 2_000/u);
  assert.match(controller, /340 \* 60_000/u);
  assert.match(controller, /status:"budget-exhausted"/u);
  assert.doesNotMatch(controller, /mode=reconcile[^\n]*restart/u);
});

test("the persisted checkpoint resumes after the former monotonic-growth failure", () => {
  assert.match(controller, /index changed during cursor recovery/u);
  assert.match(controller, /index changed during batch discovery/u);
  assert.match(controller, /hasAdvanced\(prior, progress\)/u);
  assert.match(controller, /reconcile batch did not advance/u);
  assert.match(controller, /await observe\(transport, deadline\)/u);
});

test("RASFF recognizes only supported transient global errors with a released lease", () => {
  const recoverable = recoveryPredicate;
  const searchUrl = "https://webgate.ec.europa.eu/rasff-window/backend/public/notification/search/consolidated/en/";
  const cleared = { status: "failed", leaseOwnerId: null, leaseMode: null, leaseExpiresAt: null };
  for (const lastError of [
    "D1_ERROR: out of memory: SQLITE_NOMEM",
    "D1_ERROR: internal error; reference = abc123",
    "RASFF agotó el timeout para " + searchUrl,
    "RASFF abortó la petición para " + searchUrl,
    "RASFF sufrió un fallo de red para " + searchUrl,
    "RASFF reconciliation index changed during cursor recovery",
    "RASFF reconciliation index changed during batch discovery",
    "RASFF devolvió HTTP 429 para " + searchUrl,
    "RASFF devolvió HTTP 503 para " + searchUrl,
  ]) {
    assert.equal(recoverable({ ...cleared, lastError }), true, lastError);
    for (const key of ["leaseOwnerId", "leaseMode", "leaseExpiresAt"]) {
      assert.equal(recoverable({ ...cleared, lastError, [key]: "active" }), false, key);
      const missing = { ...cleared, lastError }; delete missing[key];
      assert.equal(recoverable(missing), false, `missing ${key}`);
    }
  }
});

test("RASFF never recovers semantic errors or malformed D1 references as transient failures", () => {
  const recoverable = recoveryPredicate;
  const cleared = { status: "failed", leaseOwnerId: null, leaseMode: null, leaseExpiresAt: null };
  for (const lastError of [
    "identity conflict", "version_count_desynced", "", null,
    "D1_ERROR: internal error; reference = ",
    "D1_ERROR: internal error; reference = ABC123",
    "D1_ERROR: internal error; reference = abc123 trailing",
    "RASFF devolvió HTTP 401 para https://webgate.ec.europa.eu/rasff-window/backend/public/notification/search/consolidated/en/",
  ]) assert.equal(recoverable({ ...cleared, lastError }), false, String(lastError));
  assert.equal(recoverable(null), false);
  assert.equal(recoverable({ ...cleared, status: "completed", lastError: "D1_ERROR: internal error; reference = abc123" }), false);
});

test("a workflow release activates one gated reconcile without restarting the corpus", () => {
  assert.match(workflow, /push:\n\s+branches: \[main\]\n\s+paths:\n\s+- "\.github\/workflows\/rasff-control\.yml"/u);
  assert.match(workflow, /writer_gate:\n\s+uses: \.\/\.github\/workflows\/runtime-writer-gate\.yml/u);
  assert.match(workflow, /runtime_target:\\n\\s+uses: \\.\\/\\.github\\/workflows\\/runtime-writer-target\\.yml/u);\n  assert.equal((workflow.match(/needs: \\[writer_gate, runtime_target\\]/gu) ?? []).length, 2);
  assert.match(workflow, /if: needs\.writer_gate\.outputs\.allowed == 'true' && \(github\.event_name == 'push'/u);
  assert.match(workflow, /node scripts\/rasff-control\.mjs reconcile/u);
  assert.doesNotMatch(workflow, /restart=1/u);
});
