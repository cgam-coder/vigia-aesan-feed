import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const caller = readFileSync(new URL("../../../.github/workflows/seo-public-watchdog.yml", import.meta.url), "utf8");
const snapshot = readFileSync(new URL("../../../.github/workflows/seo-public-snapshot.yml", import.meta.url), "utf8");
const block = (yaml, key) => yaml.match(new RegExp(`^${key}:\\n((?:[ \\t].*|)\\n)*`, "mu"))?.[0] ?? "";

test("one daily public schedule invokes the same-commit full snapshot", () => {
  assert.match(block(caller, "on"), /^  schedule:\n    - cron: "17 6 \* \* \*"$/mu);
  assert.equal((caller.match(/^[ \t]*-[ \t]*cron:/gmu) ?? []).length, 1);
  assert.doesNotMatch(block(snapshot, "on"), /^  schedule:/mu);
  assert.match(block(caller, "jobs"), /^    uses: \.\/\.github\/workflows\/seo-public-snapshot\.yml$/mu);
  assert.doesNotMatch(block(caller, "jobs"), /^    (?:steps|runs-on):/mu);
});

test("snapshot is callable and both workflows retain manual dispatch", () => {
  assert.match(block(snapshot, "on"), /^  workflow_call:/mu);
  for (const yaml of [caller, snapshot]) assert.match(block(yaml, "on"), /^  workflow_dispatch:/mu);
});

test("PR and main checks are limited to the isolated public package", () => {
  assert.match(block(caller, "on"), /^  pull_request:/mu);
  assert.match(block(caller, "on"), /^  push:\n    branches: \[main\]/mu);
  assert.doesNotMatch(block(snapshot, "on"), /^  (?:pull_request|push):/mu);
  for (const path of ["public-monitoring/seo/**", ".github/workflows/seo-public-watchdog.yml", ".github/workflows/seo-public-snapshot.yml"]) {
    assert.equal(block(caller, "on").split(`- "${path}"`).length - 1, 2, path);
  }
});

test("both workflows keep read-only permission and no production credentials", () => {
  for (const yaml of [caller, snapshot]) {
    assert.equal(block(yaml, "permissions").trim(), "permissions:\n  contents: read");
    assert.doesNotMatch(yaml, /pull_request_target|secrets[.:]|permissions: write-all|VIGIA_SYNC_TOKEN|vigia-runtime/u);
    assert.match(yaml, /if: github.repository == 'cgam-coder\/vigia-aesan-feed'/u);
  }
  assert.match(snapshot, /persist-credentials: false/u);
});

test("one snapshot runs each complete public audit exactly once", () => {
  assert.equal((snapshot.match(/node scripts\/seo-indexability-watchdog\.mjs/gu) ?? []).length, 1);
  assert.equal((snapshot.match(/node scripts\/seo-home-contracts\.mjs seo-validation-evidence\/homepages\.json/gu) ?? []).length, 1);
  assert.doesNotMatch(caller, /node scripts\//u);
  assert.match(snapshot, /HOME_SNAPSHOT_TARGETS, extractHomepageSignals/u);
});

test("contracts and evidence survive earlier failure without hiding errors", () => {
  for (const step of ["Enforce homepage discovery and campaign landing contracts", "Verify existing five-source SEO contracts against production", "Preserve raw evidence"]) {
    assert.ok(snapshot.includes(`- name: ${step}\n        if: always()`), step);
  }
  assert.equal((snapshot.match(/set -o pipefail/gu) ?? []).length, 2);
  assert.doesNotMatch(snapshot, /continue-on-error:\s*true/u);
  assert.match(snapshot, /\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/u);
});

test("wiring is tested before fetching production and output is package-local", () => {
  assert.match(snapshot, /node --test tests\/seo-home-contracts\.test\.mjs tests\/seo-workflow-wiring\.test\.mjs/u);
  assert.ok(snapshot.indexOf("Test HTTP evidence extraction and workflow wiring") < snapshot.indexOf("Capture live homepage HTML"));
  assert.match(snapshot, /working-directory: public-monitoring\/seo/u);
  assert.match(snapshot, /path: public-monitoring\/seo\/seo-validation-evidence\//u);
});

test("standard runner, bounded time and evidence retention remain", () => {
  assert.match(snapshot, /runs-on: ubuntu-latest/u);
  assert.match(snapshot, /timeout-minutes: 15/u);
  assert.match(snapshot, /retention-days: 7/u);
  assert.match(snapshot, /NOT the deployed commit/u);
  assert.match(snapshot, /No Google indexing status is claimed/u);
  assert.doesNotMatch(snapshot, /npm (?:ci|install)|cache:|git push|repository_dispatch|\/sync|\/freshness/u);
  const uses = [...snapshot.matchAll(/uses: ([^\s]+)/gu)].map((match) => match[1]);
  assert.equal(uses.length, 3);
  for (const action of uses) assert.match(action, /^actions\/(?:checkout|setup-node|upload-artifact)@[a-f0-9]{40}$/u);
});

test("reviewed HTTP scripts match the release manifest without importing the application", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(Object.keys(manifest.files).sort(), ["scripts/seo-home-contracts.mjs", "scripts/seo-indexability-watchdog.mjs", "tests/seo-home-contracts.test.mjs"]);
  for (const [path, expected] of Object.entries(manifest.files)) {
    const bytes = readFileSync(new URL(`../${path}`, import.meta.url));
    assert.equal(createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"), expected, path);
    if (path.startsWith("scripts/")) assert.doesNotMatch(bytes.toString("utf8"), /Authorization|Bearer |VIGIA_SYNC_TOKEN|vigia-runtime|method:\s*["'](?:POST|PUT|PATCH|DELETE)/u);
  }
});
