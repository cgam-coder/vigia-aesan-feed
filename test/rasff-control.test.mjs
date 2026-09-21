import assert from "node:assert/strict";
import test from "node:test";

import { classifyLease, recentDue, ResponseLostError, runRecentControl, runReconcileControl } from "../scripts/rasff-control.mjs";

const NOW = Date.parse("2026-09-20T06:00:00.000Z");
const liveLease = (ownerId = "owner-a") => ({ source:"RASFF", ownerId, mode:"reconcile",
  acquiredAt:"2026-09-20T05:55:00.000Z", heartbeatAt:"2026-09-20T05:59:00.000Z",
  expiresAt:"2026-09-20T06:10:00.000Z" });
const reconcile = (cursor = 100, status = "partial") => ({ source:"RASFF", mode:"reconcile", status,
  cursor:status === "completed" ? 0 : cursor, cursorKey:status === "completed" ? null : `key-${cursor}`,
  totalUnits:32_596, recordsObserved:cursor, recordsPersisted:0, newCount:0, updatedCount:0,
  detailFailures:0, pageErrors:0, coverage:status === "completed" ? "official-index-complete" : "partial",
  lastError:null, leaseOwnerId:null, leaseMode:null, leaseExpiresAt:null });
const recent = (at = "2026-09-20T05:55:00.000Z") => ({ source:"RASFF", mode:"recent", status:"completed",
  lastSuccessAt:at, leaseOwnerId:null, leaseMode:null, leaseExpiresAt:null });
const observed = ({ lease = null, current = reconcile(), latest = recent() } = {}) => ({ http:200,
  body:{ lease, backfill:{ coverage:"official-index-complete" }, reconcile:current, recent:latest }, raw:"{}" });

test("clasifica leases vigentes, caducados y malformados sin borrarlos", () => {
  assert.equal(classifyLease(liveLease(), NOW).kind, "live");
  assert.equal(classifyLease({ ...liveLease(), expiresAt:"2026-09-20T05:59:59.000Z" }, NOW).kind, "expired");
  assert.equal(classifyLease({ ...liveLease(), heartbeatAt:"not-a-date" }, NOW).kind, "malformed");
  assert.equal(classifyLease(null, NOW).kind, "none");
});

test("recent se ejecuta entre lotes históricos y el reconcile conserva su checkpoint", async () => {
  let current = reconcile(100);
  let latest = recent("2026-09-20T05:00:00.000Z");
  const calls = [];
  const transport = async (path, method) => {
    calls.push(`${method} ${path}`);
    if (path.includes("observe=1")) return observed({ current, latest });
    if (path.includes("mode=recent")) {
      latest = recent("2026-09-20T06:00:01.000Z");
      return { http:200, body:{ state:latest }, raw:"{}" };
    }
    current = reconcile(120);
    return { http:200, body:{ state:current }, raw:"{}" };
  };
  let time = NOW;
  const result = await runReconcileControl({ transport, now:() => time++, sleep:async () => {}, log:() => {},
    deadline:NOW + 60_000, maxBatches:1 });
  assert.equal(result.status, "budget-exhausted");
  assert.equal(result.state.cursor, 120);
  assert.ok(calls.indexOf("POST /api/rasff/sync?mode=recent") <
    calls.indexOf("POST /api/rasff/sync?mode=reconcile&batchSize=20"));
});

test("un lease vigente bloquea y uno caducado delega la decisión a la adquisición atómica", async () => {
  const blocked = await runRecentControl({ transport:async () => observed({ lease:liveLease() }),
    now:() => NOW, sleep:async () => {}, log:() => {}, deadline:NOW + 1, maxAttempts:1 });
  assert.equal(blocked.status, "blocked");

  let posted = false;
  const completed = await runRecentControl({ transport:async (path) => {
    if (path.includes("observe=1")) return observed({ lease:{ ...liveLease(), expiresAt:"2026-09-20T05:59:59.000Z" } });
    posted = true;
    return { http:200, body:{ state:recent("2026-09-20T06:00:01.000Z") }, raw:"{}" };
  }, now:() => NOW, sleep:async () => {}, log:() => {}, deadline:NOW + 10_000 });
  assert.equal(completed.status, "completed");
  assert.equal(posted, true);
});

test("un lease malformado detiene el control y un sucesor vigente no se interfiere", async () => {
  await assert.rejects(() => runRecentControl({ transport:async () => observed({ lease:{ ...liveLease(), expiresAt:"bad" } }),
    now:() => NOW, sleep:async () => {}, log:() => {} }), /malformed or ambiguous/u);
  let observations = 0;
  const result = await runRecentControl({ transport:async (path) => {
    if (path.includes("observe=1")) {
      observations += 1;
      return observed({ lease:observations === 1 ? null : liveLease("successor") });
    }
    throw new ResponseLostError("lost");
  }, now:() => NOW, sleep:async () => {}, log:() => {}, deadline:NOW + 1, maxAttempts:1 });
  assert.equal(result.status, "blocked");
  assert.equal(result.originalError?.message, "lost");
});

test("respuesta perdida tras persistir se recupera por checkpoint sin repetir la mutación", async () => {
  let current = reconcile(100);
  let posts = 0;
  const transport = async (path) => {
    if (path.includes("observe=1")) return observed({ current });
    posts += 1;
    current = reconcile(120);
    throw new ResponseLostError("HTTP 500 non-JSON original");
  };
  let time = NOW;
  const result = await runReconcileControl({ transport, now:() => time++, sleep:async () => {}, log:() => {},
    deadline:NOW + 60_000, maxBatches:1 });
  assert.equal(posts, 1);
  assert.equal(result.state.cursor, 120);
});

test("respuesta perdida antes de persistir solo reintenta tras observar ausencia de progreso", async () => {
  let current = reconcile(100);
  let posts = 0;
  const transport = async (path) => {
    if (path.includes("observe=1")) return observed({ current });
    posts += 1;
    if (posts === 1) throw new ResponseLostError("network before persist");
    current = reconcile(120);
    return { http:200, body:{ state:current }, raw:"{}" };
  };
  let time = NOW;
  const result = await runReconcileControl({ transport, now:() => time++, sleep:async () => {}, log:() => {},
    deadline:NOW + 60_000, maxBatches:1 });
  assert.equal(posts, 2);
  assert.equal(result.state.cursor, 120);
});

test("el umbral de recent se calcula por última finalización real", () => {
  assert.equal(recentDue(recent("2026-09-20T05:26:00.000Z"), NOW), false);
  assert.equal(recentDue(recent("2026-09-20T05:25:00.000Z"), NOW), true);
});

test("un checkpoint failed recuperable se reanuda desde el cursor persistido", async () => {
  const searchUrl = "https://webgate.ec.europa.eu/rasff-window/backend/public/notification/search/consolidated/en/";
  let current = { ...reconcile(100, "failed"), lastError:"RASFF devolvió HTTP 503 para " + searchUrl,
    leaseOwnerId:null, leaseMode:null, leaseExpiresAt:null };
  let posts = 0, time = NOW;
  const logs = [];
  const result = await runReconcileControl({ transport:async (path) => {
    if (path.includes("observe=1")) return observed({ current });
    posts += 1;
    current = reconcile(120);
    return { http:200, body:{ state:current }, raw:"{}" };
  }, now:() => time++, sleep:async () => {}, log:(line) => logs.push(line),
  deadline:NOW + 60_000, maxBatches:1 });
  assert.equal(posts, 1);
  assert.equal(result.state.cursor, 120);
  assert.ok(logs.some((line) => line.startsWith("RASFF_RECONCILE_RESUMING_RECOVERABLE_CHECKPOINT ")));
});

test("un checkpoint failed semántico sigue fallando cerrado", async () => {
  const current = { ...reconcile(100, "failed"), lastError:"identity conflict",
    leaseOwnerId:null, leaseMode:null, leaseExpiresAt:null };
  await assert.rejects(() => runReconcileControl({ transport:async () => observed({ current }),
    now:() => NOW, sleep:async () => {}, log:() => {} }), /semantically failed/u);
});
