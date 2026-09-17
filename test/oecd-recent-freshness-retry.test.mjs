import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/oecd-recent-freshness-retry.yml", import.meta.url), "utf8");

test("OECD freshness retry runs offset from the normal recent schedule", () => {
  assert.match(workflow, /cron: "2,32 \* \* \* \*"/u);
  assert.match(workflow, /group: vigia-oecd-recent/u);
  assert.match(workflow, /cancel-in-progress: false/u);
});

test("OECD freshness retry is a no-op while recent data is within 45 minutes", () => {
  assert.match(workflow, /const thresholdMs = 45 \* 60_000;/u);
  assert.match(workflow, /ageMs <= thresholdMs/u);
  assert.match(workflow, /OECD_RECENT_FRESH_NOOP/u);
});

test("OECD freshness retry only waits for historical-reconcile lease contention", () => {
  assert.match(workflow, /state\?\.lastSkipReason === "already-running"/u);
  assert.match(workflow, /state\?\.leaseMode === "historical-reconcile"/u);
  assert.match(workflow, /attempt<=15/u);
  assert.match(workflow, /setTimeout\(resolve, 60_000\)/u);
});

test("OECD freshness retry validates completion and fails closed otherwise", () => {
  assert.match(workflow, /response\.status === 200/u);
  assert.match(workflow, /\["partial","completed"\]\.includes\(state\.status\)/u);
  assert.match(workflow, /state\.lastError !== null/u);
  assert.match(workflow, /state\.leaseOwnerId !== null/u);
  assert.match(workflow, /throw new Error\("OECD recent retry failed HTTP/u);
  assert.match(workflow, /could not acquire the source lease within the bounded retry window/u);
});
