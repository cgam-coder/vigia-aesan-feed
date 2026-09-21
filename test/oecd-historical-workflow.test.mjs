import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const workflow = readFileSync(new URL("../.github/workflows/oecd-historical-reconcile.yml", import.meta.url), "utf8");
const match = workflow.match(/node <<'NODE'\n([\s\S]*?)\n\s*NODE(?:\n|$)/u);
assert.ok(match, "OECD workflow must contain its executable Node script");
const script = match[1].replace(/^ {10}/gmu, "");
const compact = script.replace(/\s+/gu, "");
const env = { VIGIA_OECD_SYNC_URL: "https://runtime.invalid/api/oecd/sync", VIGIA_SYNC_TOKEN: "test-only" };

const state = (overrides = {}) => ({
  source: "OECD", mode: "historical-reconcile", status: "partial", cursor: 2,
  recordsObserved: 10, recordsPersisted: 10, lastError: null,
  leaseOwnerId: null, leaseMode: null, leaseExpiresAt: null, ...overrides,
});
const reply = (value, status = 200) => ({ status, body: { state: value } });

// Execute the actual workflow, not a reimplementation. No real network or timers
// are exposed: HTTP responses, time and logs are fully controlled by each test.
async function execute(responses, { advancePerRequest = 0, recentLastSuccessAt = "auto" } = {}) {
  let now = 0;
  const calls = [], controlCalls = [], logs = [], sleeps = [];
  let latestRecentAt = recentLastSuccessAt === "auto" ? new Date(now).toISOString() : recentLastSuccessAt;
  const result = runInNewContext(`(async () => {\n${script}\n})()`, {
    process: { env },
    Date: { now: () => now },
    AbortSignal: { timeout: (ms) => ({ timeout: ms }) },
    console: { log: (line) => logs.push(line) },
    setTimeout: (resolve, ms) => { sleeps.push(ms); now += ms; resolve(); },
    fetch: async (url, options = {}) => {
      if (url === env.VIGIA_OECD_SYNC_URL + "?observe=1") {
        controlCalls.push({ url, method: options.method ?? "GET" });
        return { status: 200, text: async () => JSON.stringify({ recent:{ lastSuccessAt:latestRecentAt } }) };
      }
      if (url === env.VIGIA_OECD_SYNC_URL + "?mode=recent") {
        controlCalls.push({ url, method: options.method ?? "GET" });
        assert.equal(options.method, "POST");
        latestRecentAt = new Date(now).toISOString();
        return { status: 200, text: async () => JSON.stringify({ state:{
          source:"OECD", mode:"recent", status:"completed", lastSuccessAt:latestRecentAt,
          recordsObserved:159, newCount:0, updatedCount:0, lastError:null,
          leaseOwnerId:null, leaseMode:null, leaseExpiresAt:null,
        } }) };
      }
      assert.equal(url, env.VIGIA_OECD_SYNC_URL + "?mode=historical-reconcile&batchSize=2");
      assert.equal(options.method, "POST");
      const item = typeof responses === "function" ? responses(calls.length) : responses[calls.length];
      calls.push({ url, method: options.method });
      if (calls.length > 2_010 || !item) throw new Error("Unexpected mock request");
      now += advancePerRequest;
      if (item.error) throw item.error;
      return { status: item.status, text: async () => item.raw ?? JSON.stringify(item.body) };
    },
  }, { timeout: 1_000 });
  await result;
  const line = logs.findLast((entry) => entry.startsWith("OECD_HISTORICAL_RECONCILE_STAGE_COMPLETE "));
  assert.ok(line, "workflow must report its terminal stage state");
  return { calls, controlCalls, logs, sleeps, final: JSON.parse(line.slice(line.indexOf(" ") + 1)) };
}

test("OECD keeps bounded checkpoint continuation independent of source formatting", () => {
  assert.match(workflow, /timeout-minutes:\s*225/u);
  const prefix = script.slice(0, script.search(/while\s*\(executed\s*</u));
  const config = runInNewContext(prefix + "\n({ MAX_BATCHES, deadline })", {
    process: { env }, Date: { now: () => 0 },
  }, { timeout: 1_000 });
  assert.equal(config.MAX_BATCHES, 2_000);
  assert.equal(config.deadline, 185 * 60_000);
  assert.ok(compact.includes("while(executed<MAX_BATCHES)"));
  assert.ok(compact.includes("state.cursor<=previous.cursor"));
  assert.ok(compact.includes("state.recordsPersisted<previous.recordsPersisted"));
  assert.ok(!compact.includes("state.recordsObserved<=previous.recordsObserved"));
  assert.ok(compact.includes("attempt<=5"));
  assert.ok(compact.includes("[429,500,502,503,504]"));
  assert.ok(compact.includes('previous?.status!=="completed"&&!budgetExhausted'));
  assert.doesNotMatch(workflow, /restart/u);
});


test("OECD yields to recent before the next historical batch when recent is stale", async () => {
  const result = await execute([
    reply(state()), reply(state({ status: "completed", cursor: 0 })),
  ], { recentLastSuccessAt:null });
  assert.equal(result.calls.length, 2);
  assert.deepEqual(result.controlCalls.map(({ url, method }) => [url, method]), [
    [env.VIGIA_OECD_SYNC_URL + "?observe=1", "GET"],
    [env.VIGIA_OECD_SYNC_URL + "?mode=recent", "POST"],
  ]);
  assert.equal(result.final.recentYields, 1);
  assert.equal(result.final.state.status, "completed");
});

test("OECD advances the persisted cursor even when a batch contains no new records", async () => {
  const result = await execute([
    reply(state()), reply(state({ cursor: 4 })), reply(state({ status: "completed", cursor: 0 })),
  ]);
  assert.equal(result.calls.length, 3);
  assert.equal(result.final.executed, 3);
  assert.equal(result.final.state.status, "completed");
  assert.equal(result.final.budgetExhausted, false);
});

for (const status of [429, 500, 502, 503, 504]) {
  test(`OECD retries transient HTTP ${status} without restarting the sweep`, async () => {
    const result = await execute([
      { status, body: {} }, reply(state({ status: "completed", cursor: 0 })),
    ]);
    assert.equal(result.calls.length, 2);
    assert.deepEqual(result.sleeps, [5_000]);
    assert.equal(result.final.state.status, "completed");
  });
}

test("OECD preserves checkpoint through five persisted upstream failures and cooldown", async () => {
  const failure = reply(state({ status: "failed", lastError: "OECD respondió con estado 503" }), 503);
  const result = await execute([
    reply(state()), ...Array(5).fill(failure), reply(state({ status: "completed", cursor: 0 })),
  ]);
  assert.equal(result.calls.length, 7);
  assert.equal(result.final.executed, 2);
  assert.equal(result.final.upstreamFailures, 1);
  assert.ok(result.sleeps.includes(60_000));
});

test("OECD retries an occupied lease without counting it as completed work", async () => {
  const result = await execute([
    reply(state({ status: "skipped" }), 202), reply(state({ status: "completed", cursor: 0 })),
  ]);
  assert.equal(result.final.skipped, 1);
  assert.equal(result.final.executed, 1);
  assert.deepEqual(result.sleeps, [30_000]);
});

test("OECD rejects a stalled cursor and a regressing persisted counter", async () => {
  await assert.rejects(execute([reply(state()), reply(state())]), /cursor did not advance/u);
  await assert.rejects(execute([
    reply(state()), reply(state({ cursor: 4, recordsPersisted: 9 })),
  ]), /persisted counter regressed/u);
});

test("OECD rejects semantic errors, wrong sources and uncleared leases", async () => {
  for (const override of [
    { source: "RASFF" }, { mode: "recent" }, { status: "failed" },
    { lastError: "identity conflict" }, { leaseOwnerId: "active" },
    { leaseMode: "historical-reconcile" }, { leaseExpiresAt: "2099-01-01" },
  ]) {
    await assert.rejects(execute([reply(state(override))]), /contract failed/u);
  }
  await assert.rejects(execute([{ status: 401, body: {} }]), /failed HTTP 401/u);
});

test("OECD does not certify a partial sweep when the time budget is exhausted", async () => {
  const result = await execute([reply(state())], { advancePerRequest: 185 * 60_000 });
  assert.equal(result.calls.length, 1);
  assert.equal(result.final.budgetExhausted, true);
  assert.equal(result.final.state.status, "partial");
});

test("OECD fails closed at the batch ceiling if the sweep never completes", async () => {
  await assert.rejects(execute((index) => reply(state({ cursor: index + 1 }))), /did not complete/u);
});
