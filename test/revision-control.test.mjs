import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRevisionShadowPlan,
  runRevisionShadow,
  validateReliabilitySnapshot,
} from "../scripts/revision-control.mjs";

const checkedAt = "2026-09-29T15:00:00.000Z";
const now = Date.parse("2026-09-29T15:10:00.000Z");

const view = (source, overrides = {}) => {
  const modes = {
    AESAN:{ required:true, mode:"historical-reconcile", scope:"full-archive", maxAgeMinutes:1440, certification:"optional" },
    RAPNA:{ required:true, mode:"current-parity", scope:"current+legacy", maxAgeMinutes:1440, certification:"required",
      components:[
        { mode:"current-parity", scope:"current", certification:"required" },
        { mode:"legacy-reconcile", scope:"full-archive", certification:"required" },
      ] },
    RASFF:{ required:true, mode:"reconcile", scope:"operational-2020+", maxAgeMinutes:360, certification:"optional" },
    "SAFETY GATE":{ required:false, mode:null, scope:"recent-index-only", maxAgeMinutes:null, certification:"not-applicable" },
    OECD:{ required:true, mode:"historical-reconcile", scope:"operational-2020+", maxAgeMinutes:1440, certification:"required" },
  };
  const revision = modes[source];
  return {
    source,
    checkedAt,
    aggregateStatus:"fresh",
    recent:{
      status:"fresh", freshMaxAgeMinutes:45, staleMaxAgeMinutes:60, lastSuccessAt:checkedAt,
      ageMinutes:10, lagMinutes:0, latestIdentityParity:true, missingOfficialIdentities:[], revisionMismatches:[],
    },
    revision:{
      ...revision,
      status:revision.required ? "fresh" : "not-required",
      lastSuccessAt:revision.required ? checkedAt : null,
      ageMinutes:revision.required ? 10 : null,
      cycleStartedAt:null, progress:null, total:null,
    },
    activeLease:false,
    error:null,
    ...overrides,
  };
};

const payload = (changes = {}) => ({
  reliability:["AESAN","RAPNA","RASFF","SAFETY GATE","OECD"].map((source) => changes[source] ?? view(source)),
});

const observations = (changes = {}) => ({
  AESAN:{ lease:null }, RAPNA:{ lease:null }, RASFF:{ lease:null }, OECD:{ lease:null }, ...changes,
});

test("F4A validates exactly the five-source reliability contract", () => {
  assert.equal(validateReliabilitySnapshot(payload(), { now }).length, 5);
  assert.throws(() => validateReliabilitySnapshot({ reliability:payload().reliability.slice(0, 4) }, { now }), /Expected 5/u);
  const duplicate = payload().reliability.slice(); duplicate[4] = duplicate[0];
  assert.throws(() => validateReliabilitySnapshot({ reliability:duplicate }, { now }), /missing, duplicated or unsupported/u);
});

test("F4A rejects a stale control snapshot instead of planning from old evidence", () => {
  const old = view("OECD", { checkedAt:"2026-09-29T14:00:00.000Z" });
  assert.throws(() => buildRevisionShadowPlan(payload({ OECD:old }), observations(), { now, maxSnapshotAgeMinutes:30 }),
    /outside the control window/u);
});

test("Safety Gate remains outside revision orchestration while F2A is on hold", () => {
  const plan = buildRevisionShadowPlan(payload(), observations(), { now });
  assert.deepEqual(plan.notRequired, [{ source:"SAFETY GATE", reason:"revision-not-required" }]);
  assert.equal(plan.candidates.some((item) => item.source === "SAFETY GATE"), false);
});

test("AESAN is visible but remains an external full-archive producer in F4A", () => {
  const aes = view("AESAN");
  aes.revision.status = "stale";
  aes.revision.ageMinutes = 1500;
  const plan = buildRevisionShadowPlan(payload({ AESAN:aes }), observations(), { now });
  assert.equal(plan.external.length, 1);
  assert.equal(plan.external[0].source, "AESAN");
  assert.equal(plan.external[0].lane, "full-archive-producer");
  assert.equal(plan.external[0].actionable, true);
  assert.equal(plan.selected, null);
});

test("an active persisted revision cycle outranks a merely stale source", () => {
  const rasff = view("RASFF");
  rasff.revision.status = "fresh";
  rasff.revision.cycleStartedAt = "2026-09-29T14:50:00.000Z";
  rasff.revision.progress = 120;
  rasff.revision.total = 1000;
  const oecd = view("OECD");
  oecd.revision.status = "stale";
  oecd.revision.ageMinutes = 1500;
  const plan = buildRevisionShadowPlan(payload({ RASFF:rasff, OECD:oecd }), observations(), { now });
  assert.equal(plan.selected.source, "RASFF");
  assert.equal(plan.selected.cycleActive, true);
  assert.deepEqual(plan.candidates.map((item) => item.source), ["RASFF", "OECD"]);
});

test("a fresh terminal RASFF zero cursor is not mistaken for an active cycle", () => {
  const rasff = view("RASFF");
  rasff.revision.cycleStartedAt = "2026-09-29T14:00:00.000Z";
  rasff.revision.progress = 0;
  rasff.revision.total = 1000;
  const plan = buildRevisionShadowPlan(payload({ RASFF:rasff }), observations(), { now });
  assert.equal(plan.selected, null);
  assert.equal(plan.idle.some((item) => item.source === "RASFF"), true);
  assert.equal(plan.idle.find((item) => item.source === "RASFF").cycleActive, false);
});

test("recent freshness always has priority over historical revision", () => {
  const oecd = view("OECD");
  oecd.revision.status = "stale";
  oecd.recent = { ...oecd.recent, status:"degraded" };
  const plan = buildRevisionShadowPlan(payload({ OECD:oecd }), observations(), { now });
  assert.equal(plan.selected, null);
  assert.equal(plan.blocked[0].source, "OECD");
  assert.equal(plan.blocked[0].blockedReason, "recent-priority");
});

test("a live source lease blocks the shadow candidate even if the stored view missed it", () => {
  const rapna = view("RAPNA");
  rapna.revision.status = "stale";
  const plan = buildRevisionShadowPlan(payload({ RAPNA:rapna }), observations({
    RAPNA:{ lease:{ source:"RAPNA", ownerId:"recent-owner", mode:"recent",
      expiresAt:"2026-09-29T15:20:00.000Z" } },
  }), { now });
  assert.equal(plan.selected, null);
  assert.equal(plan.blocked[0].blockedReason, "active-lease");
});

test("RAPNA exposes the combined CURRENT+LEGACY lane without mutating either component", () => {
  const rapna = view("RAPNA");
  rapna.revision.status = "stale";
  rapna.revision.ageMinutes = 1500;
  const plan = buildRevisionShadowPlan(payload({ RAPNA:rapna }), observations(), { now });
  assert.equal(plan.selected.source, "RAPNA");
  assert.equal(plan.selected.lane, "current+legacy");
  assert.equal(plan.zeroWrite, true);
});

test("runRevisionShadow performs authenticated GET-only reads", async () => {
  const calls = [];
  const bodies = new Map([
    ["/api/freshness?observe=1", payload()],
    ["/api/aesan/sync?observe=1", { lease:null }],
    ["/api/rapna/sync?observe=1", { lease:null }],
    ["/api/rasff/sync?observe=1", { lease:null }],
    ["/api/oecd/sync?observe=1", { lease:null }],
  ]);
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({ path:parsed.pathname + parsed.search, method:options.method ?? "GET", auth:options.headers?.Authorization });
    const body = bodies.get(parsed.pathname + parsed.search);
    assert.ok(body, "unexpected shadow URL " + parsed.pathname + parsed.search);
    return { status:200, text:async () => JSON.stringify(body) };
  };
  const result = await runRevisionShadow({
    base:"https://runtime.example", token:"shadow-token", fetchImpl, now,
  });
  assert.equal(result.plan.zeroWrite, true);
  assert.equal(calls.length, 5);
  assert.ok(calls.every((call) => call.method === "GET"));
  assert.ok(calls.every((call) => call.auth === "Bearer shadow-token"));
});
