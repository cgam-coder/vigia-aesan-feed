import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflows = [
  ".github/workflows/update-feed.yml",
  ".github/workflows/update-full-feed.yml",
  ".github/workflows/rapna-sync.yml",
  ".github/workflows/safety-gate-sync.yml",
  ".github/workflows/oecd-historical-reconcile.yml",
  ".github/workflows/oecd-recent-freshness-retry.yml",
  ".github/workflows/rasff-control.yml",
  ".github/workflows/freshness-watchdog.yml",
  ".github/workflows/gh-fixes-closure-once.yml",
];

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("runtime writer target defaults to Sites and Cloudflare is not yet ready", () => {
  const config = JSON.parse(read("ops/runtime-write-target.json"));
  assert.deepEqual(config, {
    schemaVersion:1,
    active:"sites",
    sitesBaseUrl:"https://vigia-alertas.csar68.chatgpt.site",
    cloudflareBaseUrl:"https://vigia-runtime.c-gamiz93.workers.dev",
    cloudflareReady:false,
    reason:null,
  });
});

test("target evaluator is fail-closed and pins both allowed origins", () => {
  const source = read("scripts/runtime-write-target.mjs");
  assert.match(source, /active === "cloudflare" && raw\.cloudflareReady !== true/u);
  assert.match(source, /https:\/\/vigia-alertas\.csar68\.chatgpt\.site/u);
  assert.match(source, /https:\/\/vigia-runtime\.c-gamiz93\.workers\.dev/u);
  assert.match(source, /RUNTIME_WRITE_TARGET invalid Sites base URL/u);
  assert.match(source, /RUNTIME_WRITE_TARGET invalid Cloudflare base URL/u);
  assert.match(source, /base_url=/u);
  assert.match(source, /cloudflare_ready=/u);
});

test("every production writer uses the reusable target and has no hardcoded Sites origin", () => {
  for (const path of workflows) {
    const workflow = read(path);
    assert.match(workflow, /runtime_target:\n\s+uses: \.\/\.github\/workflows\/runtime-writer-target\.yml/u, path);
    assert.doesNotMatch(workflow, /https:\/\/vigia-alertas\.csar68\.chatgpt\.site/u, path);
    const writerNeeds = workflow.match(/needs: \[writer_gate, runtime_target\]/gu) ?? [];
    assert.ok(writerNeeds.length >= 1, `${path} has no target dependency`);
    assert.match(workflow, /needs\.runtime_target\.outputs\.base_url/u, `${path} does not consume target output`);
  }
});

test("target proof workflow is network-free", () => {
  const proof = read(".github/workflows/runtime-writer-target-proof.yml");
  assert.match(proof, /runtime_target:/u);
  assert.match(proof, /TARGET_ACTIVE=/u);
  assert.match(proof, /TARGET_BASE=/u);
  assert.doesNotMatch(proof, /curl|fetch\(|chatgpt\.site|workers\.dev/u);
});
