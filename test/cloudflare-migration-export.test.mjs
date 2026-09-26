import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/cloudflare-migration-export.mjs", import.meta.url));
const TABLES = [
  "alerts","alert_versions","alert_source_identities","alert_aliases","source_checks",
  "source_freshness_state","source_sync_state","source_sync_locks","source_revision_certifications",
  "source_backfill_snapshots","source_backfill_snapshot_chunks","alert_dimension_state",
  "alert_categories","alert_hazards","alert_geographies","alert_actors","dimension_rebuild_state",
];

const guard = "a".repeat(64);
const rowsByTable = Object.fromEntries(TABLES.map((table,index) => [table,
  table === "alerts" ? [{ __rowid:1, id:"aesan:x", value:"uno" },{ __rowid:3, id:"rasff:y", value:"dos" }] :
  table === "alert_versions" ? [{ __rowid:2, id:index + 1, alert_id:"aesan:x", snapshot:"{}" }] : []
]));

const metadata = () => ({
  schemaVersion:1,
  mode:"cloudflare-migration-operational-export",
  migrationLedger:"0012",
  pre2020ArchiveIncluded:false,
  tables:TABLES,
  tableState:TABLES.map((table) => ({
    table, rows:rowsByTable[table].length,
    maxRowid:rowsByTable[table].at(-1)?.__rowid ?? 0,
  })),
  activeLeases:0,
  snapshotGuard:guard,
});

const run = async (mutate) => {
  let requests = 0;
  const server = createServer((request,response) => {
    requests += 1;
    const url = new URL(request.url ?? "/", "http://localhost");
    const table = url.searchParams.get("table") ?? "metadata";
    const token = request.headers.authorization;
    if (token !== "Bearer test-token") {
      response.writeHead(401, { "content-type":"application/json" });
      response.end('{"error":"auth"}');
      return;
    }
    let body;
    if (table === "metadata") body = metadata();
    else {
      const after = Number(url.searchParams.get("after") ?? "0");
      const limit = Number(url.searchParams.get("limit") ?? "25");
      const available = rowsByTable[table].filter((row) => row.__rowid > after);
      const page = available.slice(0, limit);
      body = {
        schemaVersion:1, table, after,
        nextAfter:page.at(-1)?.__rowid ?? null,
        hasMore:available.length > limit,
        snapshotGuard:guard,
        rows:page,
      };
    }
    body = mutate?.({ request:requests, table, body }) ?? body;
    response.writeHead(200, { "content-type":"application/json" });
    response.end(JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const out = await mkdtemp(join(tmpdir(), "nagame-export-test-"));
  try {
    const result = await new Promise((resolve) => {
      const child = spawn(process.execPath, [script], {
        env:{ ...process.env, VIGIA_SYNC_TOKEN:"test-token",
          NAGAMEALERT_SOURCE_BASE:`http://127.0.0.1:${address.port}`,
          NAGAMEALERT_EXPORT_DIR:out },
        stdio:["ignore","pipe","pipe"],
      });
      let stdout=""; let stderr="";
      child.stdout.on("data",(chunk) => stdout += chunk);
      child.stderr.on("data",(chunk) => stderr += chunk);
      child.on("close",(code) => resolve({ code,stdout,stderr }));
    });
    return { result, out, files:await readdir(out) };
  } finally {
    server.close();
  }
};

test("exact migration transport completes all 17 tables and emits one manifest", async () => {
  const { result,out,files } = await run();
  try {
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /CLOUDFLARE_MIGRATION_EXPORT_PASS/u);
    assert.ok(files.includes("export-manifest.json"));
    assert.ok(files.includes("metadata-start.json"));
    assert.ok(files.includes("metadata-end.json"));
    for (const table of TABLES) assert.ok(files.includes(`${table}.ndjson.gz`));
    const manifest=JSON.parse(await readFile(join(out,"export-manifest.json"),"utf8"));
    assert.equal(manifest.tables.length, 17);
    assert.equal(manifest.pre2020ArchiveIncluded,false);
    assert.equal(manifest.migrationLedger,"0012");
    assert.equal(manifest.tables.find((row) => row.table === "alerts").rows,2);
  } finally { await rm(out,{recursive:true,force:true}); }
});

test("transport fails closed when snapshot guard changes", async () => {
  const { result,out } = await run(({ table,body }) =>
    table === "alert_versions" ? { ...body, snapshotGuard:"b".repeat(64) } : body);
  try {
    assert.notEqual(result.code,0);
    assert.match(result.stderr,/snapshot guard|response contract mismatch/iu);
  } finally { await rm(out,{recursive:true,force:true}); }
});

test("transport fails closed on row count mismatch", async () => {
  const { result,out } = await run(({ table,body }) =>
    table === "metadata" ? {
      ...body,
      tableState:body.tableState.map((row) => row.table === "alerts" ? { ...row, rows:3 } : row),
    } : body);
  try {
    assert.notEqual(result.code,0);
    assert.match(result.stderr,/row count/iu);
  } finally { await rm(out,{recursive:true,force:true}); }
});
