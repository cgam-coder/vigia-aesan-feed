import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/revision-control.yml", import.meta.url), "utf8");
const script = readFileSync(new URL("../scripts/revision-control.mjs", import.meta.url), "utf8");
const aesanUpdateWorkflow = readFileSync(new URL("../.github/workflows/update-feed.yml", import.meta.url), "utf8");

test("F4A shadow has no schedule and cannot mutate production", () => {
  assert.doesNotMatch(workflow, /^\s*schedule:/mu);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /node scripts\/revision-control\.mjs shadow/u);
  assert.doesNotMatch(script, /method\s*:\s*["']POST["']/u);
  assert.match(script, /zeroWrite:true/u);
});

test("F4A keeps production credentials at one authenticated step scope", () => {
  const lines = workflow.split(/\r?\n/u).filter((line) => /VIGIA_SYNC_TOKEN:\s*\$\{\{\s*secrets\.VIGIA_SYNC_TOKEN\s*\}\}/u.test(line));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\s{10}VIGIA_SYNC_TOKEN:/u);
  assert.match(workflow, /permissions:\n\s+contents: read/u);
  assert.match(workflow, /persist-credentials:\s*false/u);
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/u);
});

test("F4A consumes the shared reliability endpoint and source observe contracts", () => {
  assert.match(script, /\/api\/freshness\?observe=1/u);
  for (const source of ["aesan", "rapna", "rasff", "oecd"]) {
    assert.match(script, new RegExp(`/api/${source}/sync\\?observe=1`, "u"));
  }
  assert.match(script, /recent-priority/u);
  assert.match(script, /active-lease/u);
  assert.match(script, /revision-not-required/u);
});

test("F4A control-plane-only changes do not trigger AESAN feed regeneration", () => {
  for (const exclusion of [
    "!scripts/revision-control.mjs",
    "!test/revision-control.test.mjs",
    "!test/revision-control-workflow.test.mjs",
  ]) assert.match(aesanUpdateWorkflow, new RegExp(exclusion.replaceAll(".", "\\."), "u"));
});
