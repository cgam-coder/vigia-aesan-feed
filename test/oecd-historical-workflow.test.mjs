import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/oecd-historical-reconcile.yml", import.meta.url), "utf8");

test("OECD historical reconciliation resumes its checkpoint to completion within one job", () => {
  assert.match(workflow, /timeout-minutes: 225/u);
  assert.match(workflow, /batchSize=2/u);
  assert.match(workflow, /const MAX_BATCHES = 2_000;/u);
  assert.match(workflow, /const TIME_BUDGET_MS = 185 \* 60_000;/u);
  assert.match(workflow, /while \(executed < MAX_BATCHES\)/u);
  assert.match(workflow, /state\.cursor <= previous\.cursor/u);
  assert.match(workflow, /OECD historical reconcile cursor did not advance/u);
  assert.match(workflow, /state\.recordsPersisted < previous\.recordsPersisted/u);
  assert.doesNotMatch(workflow, /state\.recordsObserved <= previous\.recordsObserved/u);
  assert.match(workflow, /attempt <= 5/u);
  assert.match(workflow, /\[429, 500, 502, 503, 504\]/u);
  assert.match(workflow, /OECD_HISTORICAL_RECONCILE_RETRY/u);
  assert.match(workflow, /previous\?\.status !== "completed" && !budgetExhausted/u);
  assert.doesNotMatch(workflow, /restart/u);
});
