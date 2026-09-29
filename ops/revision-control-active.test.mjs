import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runBoundedRevisionWake, legacyWorkflowBusy } from "./revision-control-active.mjs";

const now = Date.parse("2026-09-29T16:00:00Z"), at = (age) => new Date(now - age * 60000).toISOString();
const config = {
  AESAN:["historical-reconcile", "optional", 1440], RAPNA:["current-parity", "required", 1440],
  RASFF:["reconcile", "optional", 360], "SAFETY GATE":[null, "not-applicable", null],
  OECD:["historical-reconcile", "required", 1440],
};
const cert = (source, mode) => ({ source, mode, cycleId:"prior-cycle", completedAt:at(60), auditCheckedAt:at(59),
  auditStatus:"passed", coverage:"official-index-complete", totalUnits:10, recordsObserved:100 });
const state = (source, mode) => ({ source, mode, status:"completed", cursor:mode === "reconcile" ? 0 : 10,
  totalUnits:10, planVersion:"persisted-plan", cursorKey:"last-key", startedAt:at(90), completedAt:at(60),
  lastSuccessAt:at(mode === "recent" ? 5 : 60), lastError:null, coverage:"official-index-complete",
  pagesScanned:10, recordsObserved:100, recordsPersisted:0, newCount:0, updatedCount:0, pageErrors:0, detailFailures:0,
  leaseOwnerId:null, leaseMode:null, leaseExpiresAt:null });
function fixture({ change, onGet, postError = false, postChange, skipped = false } = {}) {
  const policies = Object.entries(config).map(([source, [mode, certification, maxAgeMinutes]]) => ({
    source, recent:{ freshMaxAgeMinutes:45, staleMaxAgeMinutes:60 }, revision:{ required:mode !== null,
      mode, certification, maxAgeMinutes, ...(source === "RAPNA" ? { components:[
        { mode:"current-parity", certification:"required" }, { mode:"legacy-reconcile", certification:"required" },
      ] } : {}) },
  }));
  const bodies = Object.fromEntries(Object.entries(config).filter(([, [mode]]) => mode).map(([source, [mode]]) => {
    const body = { recent:state(source, "recent"), lease:null };
    if (source === "RAPNA") Object.assign(body, { currentParity:state(source, mode), currentRevisionCertification:cert(source, mode),
      legacyReconcile:state(source, "legacy-reconcile"), legacyRevisionCertification:cert(source, "legacy-reconcile") });
    else Object.assign(body, { [source === "RASFF" ? "reconcile" : "historicalReconcile"]:state(source, mode), revisionCertification:cert(source, mode) });
    return [source, body];
  }));
  Object.assign(bodies.OECD.historicalReconcile, { status:"partial", cursor:3, coverage:"partial", completedAt:null,
    planVersion:"oecd-historical-reconcile-v2:2026-09-29T10:00:00Z" });
  change?.(bodies);
  const calls = []; let oecdReads = 0;
  const json = (body, status = 200) => ({ status, text:async () => JSON.stringify(body) });
  const fetchImpl = async (url, options) => {
    const u = new URL(url); calls.push({ url:u, method:options.method });
    if (options.method === "POST") {
      assert.equal(u.pathname, "/api/oecd/sync"); assert.equal(u.search, "?mode=historical-reconcile&batchSize=1");
      if (postError) throw Error("lost response");
      const s = bodies.OECD.historicalReconcile;
      if (skipped) return json({ state:{ ...s, status:"skipped", lastSkipReason:"already-running" } }, 202);
      Object.assign(s, { cursor:s.cursor + 1, cursorKey:"next-key", pagesScanned:s.pagesScanned + 1,
        recordsObserved:s.recordsObserved + 5, lastSuccessAt:at(0) });
      postChange?.(s);
      return json({ state:s, revisionCertification:bodies.OECD.revisionCertification });
    }
    assert.equal(options.method, "GET");
    if (u.pathname === "/api/freshness") return json(u.searchParams.has("policy") ? { policyVersion:1, policies } : { states:[] });
    const source = u.pathname.split("/")[2].toUpperCase();
    if (source === "OECD") onGet?.(bodies, ++oecdReads);
    return json(bodies[source]);
  };
  return { calls, fetchImpl };
}
const execute = async (f, options = {}) => runBoundedRevisionWake({ base:"https://runtime.example", token:"fixture-only",
  active:true, clock:() => now, fetchImpl:f.fetchImpl, legacyGuard:async () => false, ...options });
const posts = (f) => f.calls.filter((c) => c.method === "POST").length;

test("stage shadow performs GET only; active does exactly one persisted unit with parity evidence", async () => {
  const shadow = fixture(); const s = await execute(shadow, { active:false });
  assert.equal(posts(shadow), 0); assert.equal(s.zeroWrite, true); assert.equal(s.parity, "NOT_EXECUTED");
  const active = fixture(); const r = await execute(active);
  assert.equal(posts(active), 1); assert.equal(r.mutatingRequests, 1); assert.equal(r.batchSize, 1);
  assert.equal(r.before.components[0].cursor, 3); assert.equal(r.after.components[0].cursor, 4);
  assert.deepEqual(r.delta, { recordsObserved:5, recordsPersisted:0, newCount:0, updatedCount:0, pageErrors:0, detailFailures:0 });
  assert.equal(r.parity, "PASS_SINGLE_BATCH_ONLY"); assert.equal(r.retirementAuthorized, false);
});
test("single-unit budget remains 20min by default and can be lowered for a bounded cycle window", async () => {
  const defaultBudget = fixture({ change:(b) => b.OECD.recent.lastSuccessAt = at(26) });
  const blocked = await execute(defaultBudget);
  assert.equal(blocked.blockedReason, "recent-budget-priority");
  assert.equal(blocked.postBudgetMs, 20 * 60_000);
  assert.equal(posts(defaultBudget), 0);

  const shorter = fixture({ change:(b) => b.OECD.recent.lastSuccessAt = at(36) });
  const passed = await execute(shorter, { postBudgetMs:5 * 60_000 });
  assert.equal(passed.postBudgetMs, 5 * 60_000);
  assert.equal(passed.parity, "PASS_SINGLE_BATCH_ONLY");
  assert.equal(posts(shorter), 1);
});

test("active source lease, stale recent, insufficient recent budget and semantic failures block before POST", async () => {
  for (const [reason, change] of [
    ["active-lease", (b) => b.OECD.lease = { source:"OECD", mode:"recent", ownerId:"legacy", expiresAt:at(-10) }],
    ["recent-priority", (b) => b.OECD.recent.lastSuccessAt = at(46)],
    ["recent-budget-priority", (b) => b.OECD.recent.lastSuccessAt = at(26)],
    ["revision-semantic-error", (b) => b.OECD.historicalReconcile.lastError = "unknown semantic failure"],
    ["stage-plan-not-supported", (b) => b.OECD.historicalReconcile.planVersion = "unsupported-plan"],
  ]) {
    const f = fixture({ change }), r = await execute(f);
    assert.equal(r.blockedReason, reason); assert.equal(posts(f), 0); assert.equal(r.parity, "NOT_EXECUTED");
  }
});
test("legacy activity and unavailable activity fail closed without cancelling or writing", async () => {
  for (const [legacyGuard, reason] of [[async () => true, "legacy-scheduler-active"],
    [async () => { throw Error("unavailable"); }, "legacy-activity-unavailable"]]) {
    const f = fixture(), r = await execute(f, { legacyGuard });
    assert.equal(r.blockedReason, reason); assert.equal(posts(f), 0);
  }
});
test("second preflight catches cursor drift and a newly acquired lease", async () => {
  for (const [reason, change] of [
    ["control-evidence-changed", (b) => b.OECD.historicalReconcile.cursor++],
    ["active-lease", (b) => b.OECD.lease = { source:"OECD", mode:"historical-reconcile", ownerId:"new-owner", expiresAt:at(-10) }],
  ]) {
    const f = fixture({ onGet:(b, n) => { if (n === 2) change(b); } }), r = await execute(f);
    assert.equal(r.blockedReason, reason); assert.equal(posts(f), 0);
  }
});
test("stage cannot start a cycle or bypass a more-prioritized source", async () => {
  const freshCycle = fixture({ change:(b) => { b.OECD.historicalReconcile = state("OECD", "historical-reconcile"); b.OECD.revisionCertification = null; } });
  assert.equal((await execute(freshCycle)).blockedReason, "stage-new-cycle-not-enabled"); assert.equal(posts(freshCycle), 0);
  const other = fixture({ change:(b) => { Object.assign(b.RASFF.reconcile, { status:"partial", cursor:2, completedAt:null }); b.RASFF.revisionCertification = null; } });
  assert.equal((await execute(other)).blockedReason, "stage-source-not-enabled"); assert.equal(posts(other), 0);
});
test("ambiguous POST, skipped lease and parity failure never trigger a second mutation", async () => {
  for (const [options, reason, parity] of [
    [{ postError:true }, "mutation-outcome-unknown-no-retry", "HOLD"],
    [{ skipped:true }, "adapter-lease-or-state-skip", "NOT_EXECUTED"],
    [{ postChange:(s) => s.cursor = 0 }, "cursor-or-cycle-parity-failed", "HOLD"],
    [{ postChange:(s) => { s.recordsPersisted++; s.updatedCount++; } }, "changed-records-require-integrity-review", "HOLD"],
  ]) {
    const f = fixture(options), r = await execute(f);
    assert.equal(r.blockedReason, reason); assert.equal(r.parity, parity); assert.equal(posts(f), 1);
    assert.equal(r.zeroWrite, false);
  }
});
test("legacy status guard queries unfinished states and handles old active jobs", async () => {
  const queries = [];
  const result = await legacyWorkflowBusy({ githubToken:"fixture-only", fetchImpl:async (url, options) => {
    queries.push(new URL(url).searchParams.get("status")); assert.equal(options.method, "GET");
    return { status:200, text:async () => JSON.stringify({ total_count:queries.length === 2 ? 1 : 0 }) };
  } });
  assert.equal(result, true); assert.deepEqual(queries, ["in_progress", "queued"]);
});
test("manual default-shadow workflow adds no scheduler and avoids AESAN trigger paths", () => {
  const workflow = readFileSync(new URL("../.github/workflows/revision-control-active.yml", import.meta.url), "utf8");
  assert.doesNotMatch(workflow, /^\s*(push|schedule):/mu); assert.match(workflow, /default: shadow/u);
  assert.match(workflow, /cancel-in-progress: false/u); assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /run: node ops\/revision-control-active.mjs/u);
  for (const path of ["ops/revision-control-active.mjs", "ops/revision-control-active.test.mjs", ".github/workflows/revision-control-active.yml", "docs/source-reliability-v2-f4c.md"]) {
    assert.ok(!path.startsWith("scripts/") && !path.startsWith("test/") && path !== ".github/workflows/update-feed.yml");
  }
});
