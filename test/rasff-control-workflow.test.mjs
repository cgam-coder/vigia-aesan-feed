import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/rasff-control.yml", import.meta.url), "utf8");

test("RASFF recent and reconcile lanes are independently serialized", () => {
  assert.match(workflow, /group: vigia-rasff-recent\n\s+cancel-in-progress: false/u);
  assert.match(workflow, /group: vigia-rasff-reconcile\n\s+cancel-in-progress: false/u);
  assert.equal((workflow.match(/group: vigia-rasff-/gu) ?? []).length, 2);
});

test("RASFF reconcile cadence and budget can cover the measured 32k corpus with scheduling margin", () => {
  assert.match(workflow, /cron: "17 \* \* \* \*"/u);
  assert.match(workflow, /timeout-minutes: 360/u);
  assert.match(workflow, /const BATCH_SIZE = 20;/u);
  assert.match(workflow, /const MAX_BATCHES = 2_000;/u);
  assert.match(workflow, /const TIME_BUDGET_MS = 340 \* 60_000;/u);
  assert.match(workflow, /budgetExhausted = true;/u);
  assert.doesNotMatch(workflow, /mode=reconcile[^\n]*restart/u);
});

test("the persisted checkpoint resumes after the former monotonic-growth failure", () => {
  assert.match(workflow, /index changed during cursor recovery/u);
  assert.match(workflow, /index changed during batch discovery/u);
  assert.match(workflow, /D1_ERROR: internal error; reference = \\[a-z0-9\\]/u);
  assert.match(workflow, /state\.cursor <= prior\.cursor/u);
  assert.match(workflow, /RASFF reconcile cursor did not advance/u);
  assert.match(workflow, /finalObserve\.reconcile\?\.status === "failed"/u);
});

test("a workflow release activates one reconcile without restarting the corpus", () => {
  assert.match(workflow, /push:\n\s+branches: \[main\]\n\s+paths:\n\s+- "\.github\/workflows\/rasff-control\.yml"/u);
  assert.match(workflow, /if: github\.event_name == 'push'/u);
  assert.doesNotMatch(workflow, /restart=1/u);
});
