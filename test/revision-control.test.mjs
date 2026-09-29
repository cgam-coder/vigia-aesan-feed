import assert from "node:assert/strict";
import test from "node:test";
import { buildRevisionShadowPlan, runRevisionShadow, validateControlPolicies } from "../scripts/revision-control.mjs";

const now = Date.parse("2026-09-29T15:10:00.000Z");
const at = (minutes = 10) => new Date(now - minutes * 60000).toISOString();
// Test fixtures only: production receives every SLA and certification requirement from runtime.
const definitions = {
  AESAN:["historical-reconcile", "full-archive", "optional", 1440],
  RAPNA:["current-parity", "current+legacy", "required", 1440],
  RASFF:["reconcile", "operational-2020+", "optional", 360],
  "SAFETY GATE":[null, "recent-index-only", "not-applicable", null],
  OECD:["historical-reconcile", "operational-2020+", "required", 1440],
};
const policy = () => ({ policyVersion:1, policies:Object.entries(definitions).map(([source, [mode, scope, certification, maxAgeMinutes]]) => ({
  source, recent:{ freshMaxAgeMinutes:45, staleMaxAgeMinutes:60 },
  revision:{ required:mode !== null, mode, scope, certification, maxAgeMinutes,
    ...(source === "RAPNA" ? { components:[
      { mode:"current-parity", scope:"current", certification:"required" },
      { mode:"legacy-reconcile", scope:"full-archive", certification:"required" },
    ] } : {}) },
})) });
const state = (source, mode, overrides = {}) => ({ source, mode, status:"completed", cursor:mode === "reconcile" ? 0 : 10,
  cursorKey:"complete", planVersion:mode === "current-parity" ? "rapna-current-parity-v1:2026-09-29:digest" : "persisted-plan",
  totalUnits:10, pagesScanned:10, recordsObserved:100, recordsPersisted:0, newCount:0, updatedCount:0,
  detailFailures:0, pageErrors:0, coverage:"official-index-complete", startedAt:at(20),
  completedAt:at(), lastSuccessAt:at(), lastError:null,
  leaseOwnerId:null, leaseMode:null, leaseExpiresAt:null, ...overrides });
const cert = (source, mode, overrides = {}) => ({ source, mode, cycleId:"certified-cycle", completedAt:at(),
  auditCheckedAt:at(9), totalUnits:10, recordsObserved:100, auditStatus:"passed", coverage:"official-index-complete", ...overrides });
const observations = () => Object.fromEntries(Object.entries(definitions).filter(([, [mode]]) => mode).map(([source, [mode]]) => {
  const body = { recent:state(source, "recent"), lease:null };
  if (source === "RAPNA") Object.assign(body, {
    currentParity:state(source, mode), currentRevisionCertification:cert(source, mode),
    legacyReconcile:state(source, "legacy-reconcile"), legacyRevisionCertification:cert(source, "legacy-reconcile"),
  });
  else Object.assign(body, { [source === "RASFF" ? "reconcile" : "historicalReconcile"]:state(source, mode), revisionCertification:cert(source, mode) });
  return [source, { body, observedAt:at(0) }];
}));
const plan = (o = observations(), p = policy()) => buildRevisionShadowPlan(p, o, { now });
const record = (p, source) => [...p.candidates, ...p.idle, ...p.blocked, ...p.external, ...p.notRequired].find((r) => r.source === source);
const partial = (s) => Object.assign(s, { status:"partial", coverage:"partial", cursor:3, cursorKey:"persisted-key", completedAt:null });

test("fresh recent and fresh revision idle; valid OECD certification is authoritative", () => {
  const p = plan(); assert.equal(p.selected, null); assert.equal(p.idle.length, 3);
  assert.equal(record(p, "OECD").certificationValid, true);
  assert.equal(p.zeroWrite, true);
});
test("recent age follows runtime policy without feed SLA duplication", () => {
  const o = observations(); o.OECD.body.recent.lastSuccessAt = at(46);
  assert.equal(record(plan(o), "OECD").blockedReason, "recent-priority");
  const p = policy(); p.policies.find((p) => p.source === "OECD").recent.freshMaxAgeMinutes = 50;
  assert.equal(record(plan(o, p), "OECD").blockedReason, null);
});
test("fresh timestamp cannot hide recent semantic failure", () => {
  const o = observations(); o.RASFF.body.recent.lastError = "identity mismatch";
  assert.equal(record(plan(o), "RASFF").blockedReason, "recent-priority");
});
test("active recent lease blocks; expired lease does not", () => {
  const o = observations(); o.RASFF.body.lease = { source:"RASFF", mode:"recent", ownerId:"owner", expiresAt:at(-5) };
  assert.equal(record(plan(o), "RASFF").blockedReason, "active-lease");
  o.RASFF.body.lease.expiresAt = at(1);
  assert.equal(record(plan(o), "RASFF").leaseActive, false);
});
test("persisted partial revision outranks expired certification without cursor reset", () => {
  const o = observations(); partial(o.RASFF.body.reconcile); o.OECD.body.revisionCertification.completedAt = at(1500);
  const before = structuredClone(o), p = plan(o);
  assert.equal(p.selected.source, "RASFF"); assert.equal(p.selected.nextMode, "reconcile");
  assert.equal(p.selected.components[0].cursor, 3); assert.equal(p.selected.components[0].canContinue, true);
  assert.deepEqual(o, before);
});
test("expired certificate is a candidate and required missing certificate cannot idle", () => {
  for (const certification of [null, cert("OECD", "historical-reconcile", { completedAt:at(1500) }),
    cert("OECD", "historical-reconcile", { auditStatus:"failed" })]) {
    const o = observations(); o.OECD.body.revisionCertification = certification;
    const p = plan(o); assert.equal(p.selected.source, "OECD"); assert.equal(p.selected.certificationValid, false);
  }
});
test("semantic errors and structural cursor failures fail closed", () => {
  for (const changes of [{ status:"failed", lastError:"plan drift" }, { pageErrors:1 }, { detailFailures:1 },
    { cursor:11 }, { cursorKey:null }, { planVersion:null }]) {
    const o = observations(); partial(o.OECD.body.historicalReconcile); Object.assign(o.OECD.body.historicalReconcile, changes);
    const r = record(plan(o), "OECD"); assert.ok(r.blockedReason); assert.equal(r.actionable, false);
  }
});
test("Safety Gate remains outside F4 even if observation is absent", () => {
  const p = plan(); assert.equal(p.notRequired[0].source, "SAFETY GATE");
  assert.equal(p.notRequired[0].blockedReason, "revision-not-required");
  const bad = policy(); bad.policies.find((p) => p.source === "SAFETY GATE").revision.required = true;
  assert.throws(() => plan(observations(), bad), /safety-gate-f2-hold/);
});
test("RAPNA requires both certifications and preserves adapter selection", () => {
  const o = observations(); o.RAPNA.body.legacyRevisionCertification = null;
  let r = record(plan(o), "RAPNA"); assert.equal(r.lane, "current+legacy");
  assert.equal(r.nextMode, "legacy-reconcile"); assert.equal(r.certificationValid, false);
  partial(o.RAPNA.body.currentParity);
  r = record(plan(o), "RAPNA"); assert.equal(r.nextMode, "current-parity");
  o.RAPNA.body.currentParity.planVersion = "rapna-current-parity-v1:2026-09-28:digest";
  assert.equal(record(plan(o), "RAPNA").blockedReason, "adapter-cycle-not-resumable");
});
test("RASFF terminal cursor zero is never an active cycle", () => {
  const r = record(plan(), "RASFF"); assert.equal(r.revisionInProgress, false); assert.equal(r.actionable, false);
});
test("unknown certificate source, mode, audit order or future timestamps cannot certify", () => {
  for (const change of [{ source:"AESAN" }, { mode:"recent" }, { auditCheckedAt:at(30) },
    { completedAt:at(-1) }, { auditCheckedAt:at(-1) }, { coverage:"partial" }, { totalUnits:0 }]) {
    const o = observations(); Object.assign(o.OECD.body.revisionCertification, change);
    assert.equal(record(plan(o), "OECD").certificationValid, false);
    assert.equal(plan(o).selected.source, "OECD");
  }
});
test("missing live fields, invalid leases, expired observations and future recent time fail closed per source", () => {
  for (const change of [(o) => delete o.RASFF.body.lease, (o) => o.RASFF.body.lease = {},
    (o) => o.RASFF.observedAt = at(6), (o) => delete o.RASFF.body.reconcile,
    (o) => o.RASFF.body.recent.lastSuccessAt = at(-1)]) {
    const o = observations(); change(o); const p = plan(o);
    assert.ok(record(p, "RASFF").blockedReason); assert.equal(record(p, "OECD").blockedReason, null);
  }
});
test("AESAN remains an external producer with live evidence", () => {
  const o = observations(); o.AESAN.body.revisionCertification.completedAt = at(1500);
  const p = plan(o); assert.equal(p.selected, null); assert.equal(p.external[0].actionable, true);
  assert.equal(p.external[0].lane, "full-archive-producer");
});
test("policy contract rejects missing sources and missing RAPNA components", () => {
  const p = policy(); p.policies.pop(); assert.throws(() => validateControlPolicies(p), /missing-policy-source/);
  const q = policy(); q.policies[1].revision.components.pop(); assert.throws(() => validateControlPolicies(q), /unsupported-adapter-contract/);
});
test("GET-only independently timed observations ignore arbitrarily old watchdog data", async () => {
  const o = observations(), calls = []; let clock = now;
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname; calls.push({ url, options });
    if (path === "/api/freshness") {
      assert.equal(new URL(url).searchParams.get("policy"), "1");
      return { status:200, text:async () => JSON.stringify({ ...policy(), checkedAt:"2000-01-01T00:00:00Z", reliability:[] }) };
    }
    const source = path.split("/")[2].toUpperCase(); clock += 1000;
    return { status:200, text:async () => JSON.stringify(o[source].body) };
  };
  const result = await runRevisionShadow({ base:"https://runtime.example", token:"test-only", fetchImpl, clock:() => clock });
  assert.equal(result.plan.idle.length, 3); assert.equal(result.plan.zeroWrite, true);
  assert.ok(result.plan.idle.every((r) => Date.parse(r.observedAt) > now));
  assert.equal(calls.length, 5);
  assert.ok(calls.every(({ options }) => options.method === "GET" && options.redirect === "error" && options.cache === "no-store" && options.headers.Authorization === "Bearer test-only"));
});
test("one failed observe endpoint blocks only that source and suppresses upstream payload", async () => {
  const o = observations();
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/api/freshness") return { status:200, text:async () => JSON.stringify(policy()) };
    if (path.includes("rasff")) return { status:503, text:async () => { throw Error("must not expose upstream body"); } };
    return { status:200, text:async () => JSON.stringify(o[path.split("/")[2].toUpperCase()].body) };
  };
  const { plan:p } = await runRevisionShadow({ base:"https://runtime.example", token:"test-only", fetchImpl, clock:() => now });
  assert.equal(record(p, "RASFF").blockedReason, "observe-http-503"); assert.equal(p.idle.length, 2);
});
