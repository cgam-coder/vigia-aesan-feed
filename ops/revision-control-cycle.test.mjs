import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runCycleParityWake, cycleWindowBlocker } from "./revision-control-cycle.mjs";

const now = Date.parse("2026-09-29T17:00:00Z");
const at = (age) => new Date(now - age * 60_000).toISOString();
const record = (cursor = 3, recentAge = 1) => ({
  source:"OECD",
  observedAt:new Date(now).toISOString(),
  lane:"historical-reconcile",
  blockedReason:null,
  nextMode:"historical-reconcile",
  policy:{ recent:{ freshMaxAgeMinutes:45 } },
  recent:{ lastSuccessAt:at(recentAge) },
  components:[{
    mode:"historical-reconcile",
    revisionInProgress:true,
    canContinue:true,
    cursor,
    state:{ cursor, planVersion:"oecd-historical-reconcile-v2:test" },
  }],
});
const plan = (cursor = 3, recentAge = 1) => {
  const r = record(cursor, recentAge);
  return { selected:r, candidates:[r], blocked:[], idle:[] };
};
const shadow = (p) => async () => ({ plan:p });
const unit = ({ before, after, parity = "PASS_SINGLE_BATCH_ONLY", blockedReason = null,
  mutatingRequests = 1, zeroWrite = false, advanceClock = 0, clockState } = {}) => async () => {
  if (clockState && advanceClock) clockState.value += advanceClock;
  return {
    before:record(before),
    after:record(after),
    parity,
    blockedReason,
    mutatingRequests,
    zeroWrite,
  };
};

test("cycle shadow performs no unit mutation", async () => {
  let calls = 0;
  const r = await runCycleParityWake({
    base:"https://runtime.example", token:"fixture", active:false,
    clock:() => now, shadow:shadow(plan()), runUnit:async () => { calls++; },
  });
  assert.equal(calls, 0);
  assert.equal(r.zeroWrite, true);
  assert.equal(r.parity, "NOT_EXECUTED");
  assert.equal(r.maxMutatingRequests, 2);
});

test("active cycle executes exactly two sequential units and certifies the bounded window", async () => {
  const units = [unit({ before:3, after:4 }), unit({ before:4, after:5 })];
  let index = 0;
  const r = await runCycleParityWake({
    base:"https://runtime.example", token:"fixture", active:true,
    clock:() => now, shadow:shadow(plan(3)), runUnit:async (...args) => units[index++](...args),
  });
  assert.equal(index, 2);
  assert.equal(r.mutatingRequests, 2);
  assert.equal(r.zeroWrite, false);
  assert.equal(r.cursorStart, 3);
  assert.equal(r.cursorEnd, 5);
  assert.equal(r.parity, "PASS_TWO_UNIT_WINDOW");
  assert.equal(r.retirementAuthorized, false);
});

test("cycle requires the full 20-minute recent reserve before starting", () => {
  assert.equal(cycleWindowBlocker(plan(3, 26), now), "recent-cycle-budget-priority");
  assert.equal(cycleWindowBlocker(plan(3, 24), now), null);
});

test("a blocked first unit remains NOT_EXECUTED and never calls a second unit", async () => {
  let calls = 0;
  const r = await runCycleParityWake({
    base:"https://runtime.example", token:"fixture", active:true,
    clock:() => now, shadow:shadow(plan(3)),
    runUnit:async () => {
      calls++;
      return { parity:"NOT_EXECUTED", blockedReason:"legacy-scheduler-active", mutatingRequests:0, zeroWrite:true };
    },
  });
  assert.equal(calls, 1);
  assert.equal(r.parity, "NOT_EXECUTED");
  assert.equal(r.blockedReason, "legacy-scheduler-active");
});

test("a failed second unit makes the whole window HOLD without a third mutation", async () => {
  let calls = 0;
  const r = await runCycleParityWake({
    base:"https://runtime.example", token:"fixture", active:true,
    clock:() => now, shadow:shadow(plan(3)),
    runUnit:async () => {
      calls++;
      return calls === 1
        ? { before:record(3), after:record(4), parity:"PASS_SINGLE_BATCH_ONLY", mutatingRequests:1, zeroWrite:false }
        : { parity:"HOLD", blockedReason:"mutation-outcome-unknown-no-retry", mutatingRequests:1, zeroWrite:false };
    },
  });
  assert.equal(calls, 2);
  assert.equal(r.parity, "HOLD");
  assert.equal(r.blockedReason, "mutation-outcome-unknown-no-retry");
});

test("an unavailable unit fails closed without retrying", async () => {
  let calls = 0;
  const r = await runCycleParityWake({
    base:"https://runtime.example", token:"fixture", active:true,
    clock:() => now, shadow:shadow(plan(3)),
    runUnit:async () => { calls++; throw Error("network unavailable"); },
  });
  assert.equal(calls, 1);
  assert.equal(r.parity, "NOT_EXECUTED");
  assert.equal(r.blockedReason, "unit-execution-unavailable-no-retry");
  assert.equal(r.mutatingRequests, 0);
});

test("cursor discontinuity is HOLD even when the child unit reports pass", async () => {
  const r = await runCycleParityWake({
    base:"https://runtime.example", token:"fixture", active:true,
    clock:() => now, shadow:shadow(plan(3)),
    runUnit:unit({ before:4, after:5 }),
  });
  assert.equal(r.parity, "HOLD");
  assert.equal(r.blockedReason, "cycle-cursor-discontinuity");
});

test("the 20-minute global window fails closed if time expires after a unit", async () => {
  const clockState = { value:now };
  const r = await runCycleParityWake({
    base:"https://runtime.example", token:"fixture", active:true,
    clock:() => clockState.value, shadow:shadow(plan(3)),
    runUnit:unit({ before:3, after:4, advanceClock:21 * 60_000, clockState }),
  });
  assert.equal(r.parity, "HOLD");
  assert.equal(r.blockedReason, "cycle-window-expired-after-unit");
});

test("cycle workflow is manual-only and shares the stage-1 concurrency exclusion", () => {
  const workflow = readFileSync(new URL("../.github/workflows/revision-control-cycle.yml", import.meta.url), "utf8");
  assert.doesNotMatch(workflow, /^\s*(push|schedule):/mu);
  assert.match(workflow, /default: shadow/u);
  assert.match(workflow, /group: vigia-revision-control-bounded/u);
  assert.match(workflow, /cancel-in-progress: false/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /node ops\/revision-control-cycle.mjs/u);
});
