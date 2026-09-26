import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/runtime-writer-freeze-cert.yml", import.meta.url), "utf8");

test("freeze certification is main-only, read-only and actions-aware", () => {
  assert.match(workflow, /branches: \[main\]/u);
  assert.match(workflow, /"ops\/runtime-write-freeze\.json"/u);
  assert.match(workflow, /actions: read/u);
  assert.match(workflow, /contents: read/u);
  assert.doesNotMatch(workflow, /--request\s+POST|method:\s*["']POST["']|\bDELETE\b|\bPATCH\b|\bPUT\b/u);
});

test("freeze certification waits only for pre-freeze production writers", () => {
  const paths = [
    "update-feed.yml",
    "update-full-feed.yml",
    "rapna-sync.yml",
    "safety-gate-sync.yml",
    "oecd-historical-reconcile.yml",
    "oecd-recent-freshness-retry.yml",
    "rasff-control.yml",
    "freshness-watchdog.yml",
    "gh-fixes-closure-once.yml",
  ];
  for (const path of paths) assert.match(workflow, new RegExp(path.replaceAll(".", "\\."), "u"), path);
  assert.match(workflow, /run\.head_sha!==freezeSha/u);
  assert.match(workflow, /statuses=\["in_progress","queued","requested","waiting","pending"\]/u);
  assert.match(workflow, /attempt<=60/u);
  assert.match(workflow, /15_000/u);
});

test("freeze certification requires Sites and page-only V2 source export", () => {
  assert.match(workflow, /test "\$ACTIVE_TARGET" = "sites"/u);
  assert.match(workflow, /https:\/\/vigia-alertas\.csar68\.chatgpt\.site/u);
  assert.match(workflow, /NAGAMEALERT_OPERATIONAL_D1_EXPORT_V2/u);
  assert.match(workflow, /mode:"page"/u);
  assert.doesNotMatch(workflow, /mode=manifest|mode:"manifest"|sqlite_schema|sqlite_sequence|d1_migrations/u);
  assert.match(workflow, /evidenceBasis:"page-only-v2-export"/u);
});

test("freeze certification proves all runtime lease surfaces are idle", () => {
  for (const table of [
    "source_sync_locks",
    "source_sync_state",
    "source_freshness_state",
    "dimension_rebuild_state",
  ]) assert.match(workflow, new RegExp(table, "u"), table);
  assert.match(workflow, /locks\.length!==0/u);
  assert.match(workflow, /lease_owner_id!==null/u);
  assert.match(workflow, /lease_mode!==null/u);
  assert.match(workflow, /lease_expires_at!==null/u);
  assert.match(workflow, /row\.status==="running"/u);
  assert.match(workflow, /RUNTIME_WRITE_FREEZE_SOURCE_CERT/u);
});
