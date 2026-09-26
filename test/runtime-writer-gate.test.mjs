import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflows = [
  [".github/workflows/update-feed.yml", ["update"]],
  [".github/workflows/update-full-feed.yml", ["update"]],
  [".github/workflows/rapna-sync.yml", ["sync", "current_parity"]],
  [".github/workflows/safety-gate-sync.yml", ["safety_gate", "oecd"]],
  [".github/workflows/oecd-historical-reconcile.yml", ["reconcile"]],
  [".github/workflows/oecd-recent-freshness-retry.yml", ["retry-recent-if-stale"]],
  [".github/workflows/rasff-control.yml", ["recent", "reconcile"]],
  [".github/workflows/freshness-watchdog.yml", ["parity"]],
  [".github/workflows/gh-fixes-closure-once.yml", ["repair-and-verify"]],
];

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const jobBlock = (workflow, job) => {
  const lines = workflow.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === `  ${job}:`);
  assert.notEqual(start, -1, `missing job ${job}`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^  [A-Za-z0-9_-]+:\s*$/u.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join("\n");
};

test("runtime writer gate defaults open and has a strict contract", () => {
  const config = JSON.parse(read("ops/runtime-write-freeze.json"));
  assert.deepEqual(config, { schemaVersion:1, frozen:false, reason:null });
  const guard = read("scripts/runtime-write-guard.mjs");
  assert.match(guard, /RUNTIME_WRITE_GATE/u);
  assert.match(guard, /allowed=/u);
  assert.match(guard, /frozen=/u);
  assert.match(guard, /process\.env\.GITHUB_OUTPUT/u);
});

test("every production D1 writer is gated by the reusable writer gate", () => {
  let writerJobs = 0;
  for (const [path, jobs] of workflows) {
    const workflow = read(path);
    assert.match(workflow, /writer_gate:\n\s+uses: \.\/\.github\/workflows\/runtime-writer-gate\.yml/u, path);
    for (const job of jobs) {
      const block = jobBlock(workflow, job);
      writerJobs += 1;
      assert.match(block, /needs: (?:writer_gate|\\[writer_gate, runtime_target\\])/u, `${path}:${job} missing writer gate dependency`);
      assert.match(block, /if: needs\.writer_gate\.outputs\.allowed == 'true'/u,
        `${path}:${job} missing gate condition`);
    }
  }
  assert.equal(writerJobs, 12);
});

test("proof workflow exercises both open and frozen branches without a production endpoint", () => {
  const proof = read(".github/workflows/runtime-writer-gate-proof.yml");
  assert.match(proof, /simulated_writer:/u);
  assert.match(proof, /needs\.writer_gate\.outputs\.allowed == 'true'/u);
  assert.match(proof, /frozen_observer:/u);
  assert.match(proof, /needs\.writer_gate\.outputs\.frozen == 'true'/u);
  assert.doesNotMatch(proof, /chatgpt\.site|workers\.dev|curl|fetch\(/u);
});
