import { createHash } from "node:crypto";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { join } from "node:path";
import { createGzip } from "node:zlib";

const SOURCE_BASE = (process.env.NAGAMEALERT_SOURCE_BASE || "https://vigia-alertas.csar68.chatgpt.site").replace(/\/$/u, "");
const TOKEN = process.env.VIGIA_SYNC_TOKEN || "";
const OUT = process.env.NAGAMEALERT_EXPORT_DIR || "export";

const TABLES = [
  "alerts",
  "alert_versions",
  "alert_source_identities",
  "alert_aliases",
  "source_checks",
  "source_freshness_state",
  "source_sync_state",
  "source_sync_locks",
  "source_revision_certifications",
  "source_backfill_snapshots",
  "source_backfill_snapshot_chunks",
  "alert_dimension_state",
  "alert_categories",
  "alert_hazards",
  "alert_geographies",
  "alert_actors",
  "dimension_rebuild_state",
];

if (!TOKEN) throw new Error("VIGIA_SYNC_TOKEN is required");
mkdirSync(OUT, { recursive:true });

const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b))
      .map(([key,item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const sha = (value) => createHash("sha256").update(value).digest("hex");
const endpoint = (params) => `${SOURCE_BASE}/api/admin/cloudflare-migration/export?${new URLSearchParams(params)}`;

async function getRaw(params) {
  const response = await fetch(endpoint(params), {
    method:"GET",
    headers:{
      Authorization:`Bearer ${TOKEN}`,
      Accept:"application/json",
      "User-Agent":"NagameAlert-Cloudflare-Migration/1.0",
    },
    redirect:"manual",
    signal:AbortSignal.timeout(120_000),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (response.status !== 200) {
    throw new Error(`export HTTP ${response.status}: ${bytes.toString("utf8").slice(0,500)}`);
  }
  const type = response.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) throw new Error(`unexpected content-type ${type}`);
  return { bytes, json:JSON.parse(bytes.toString("utf8")) };
}

function validateMetadata(body) {
  if (body?.schemaVersion !== 1 || body?.mode !== "cloudflare-migration-operational-export") {
    throw new Error("unexpected export metadata schema");
  }
  if (body.migrationLedger !== "0012") throw new Error(`unexpected ledger ${body.migrationLedger}`);
  if (body.pre2020ArchiveIncluded !== false) throw new Error("pre-2020 archive must be excluded");
  if (body.activeLeases !== 0) throw new Error(`active leases present: ${body.activeLeases}`);
  if (!Array.isArray(body.tables) || stableJson([...body.tables].sort()) !== stableJson([...TABLES].sort())) {
    throw new Error("operational table allowlist mismatch");
  }
  if (!Array.isArray(body.tableState) || body.tableState.length !== TABLES.length) {
    throw new Error("table state inventory mismatch");
  }
  if (typeof body.snapshotGuard !== "string" || !/^[a-f0-9]{64}$/u.test(body.snapshotGuard)) {
    throw new Error("invalid snapshot guard");
  }
}

const startRaw = await getRaw({ table:"metadata" });
validateMetadata(startRaw.json);
const start = startRaw.json;
writeFileSync(join(OUT, "metadata-start.json"), startRaw.bytes);

const expected = new Map(start.tableState.map((state) => [state.table, state]));
const manifest = {
  schemaVersion:1,
  sourceBase:SOURCE_BASE,
  createdAt:new Date().toISOString(),
  snapshotGuard:start.snapshotGuard,
  migrationLedger:start.migrationLedger,
  pre2020ArchiveIncluded:false,
  tables:[],
};

const writeChunk = async (stream, chunk) => {
  if (!stream.write(chunk)) await once(stream, "drain");
};

for (const table of TABLES) {
  const state = expected.get(table);
  if (!state || !Number.isSafeInteger(state.rows) || state.rows < 0 ||
      !Number.isSafeInteger(state.maxRowid) || state.maxRowid < 0) {
    throw new Error(`invalid metadata for ${table}`);
  }

  const pageLimit = table === "source_backfill_snapshot_chunks" ? 5 : 25;
  const raw = createWriteStream(join(OUT, `${table}.ndjson.gz`));
  const gzip = createGzip({ level:9 });
  gzip.pipe(raw);
  const digest = createHash("sha256");
  const pages = [];
  let after = 0;
  let rows = 0;
  let pageNo = 0;
  let lastRowid = 0;

  try {
    while (true) {
      const response = await getRaw({ table, after:String(after), limit:String(pageLimit) });
      const body = response.json;
      pageNo += 1;
      if (body?.schemaVersion !== 1 || body.table !== table || body.after !== after ||
          body.snapshotGuard !== start.snapshotGuard || !Array.isArray(body.rows) ||
          typeof body.hasMore !== "boolean") {
        throw new Error(`${table} page ${pageNo}: response contract mismatch`);
      }
      const pageDigest = createHash("sha256");
      let previous = after;
      for (const record of body.rows) {
        const rowid = record?.__rowid;
        if (!Number.isSafeInteger(rowid) || rowid <= previous) {
          throw new Error(`${table} page ${pageNo}: non-increasing rowid`);
        }
        previous = rowid;
        const row = { ...record };
        delete row.__rowid;
        const line = stableJson(row) + "\n";
        digest.update(line);
        pageDigest.update(line);
        await writeChunk(gzip, line);
        rows += 1;
        lastRowid = rowid;
      }

      const expectedNext = body.rows.length ? lastRowid : null;
      if (body.nextAfter !== expectedNext) throw new Error(`${table} page ${pageNo}: nextAfter mismatch`);
      pages.push({
        page:pageNo,
        after,
        nextAfter:body.nextAfter,
        rows:body.rows.length,
        payloadSha256:sha(response.bytes),
        rowSha256:pageDigest.digest("hex"),
      });

      if (!body.hasMore) break;
      if (body.nextAfter === null || body.nextAfter <= after) {
        throw new Error(`${table} page ${pageNo}: invalid continuation`);
      }
      after = body.nextAfter;
    }
  } finally {
    gzip.end();
    await once(raw, "close");
  }

  if (rows !== state.rows) throw new Error(`${table}: row count ${rows} != ${state.rows}`);
  if ((rows === 0 ? 0 : lastRowid) !== state.maxRowid) {
    throw new Error(`${table}: max rowid mismatch ${lastRowid} != ${state.maxRowid}`);
  }

  manifest.tables.push({
    table,
    rows,
    maxRowid:state.maxRowid,
    pages:pageNo,
    rowSha256:digest.digest("hex"),
    pageManifestSha256:sha(stableJson(pages)),
    pageManifest:pages,
  });
  console.log(`exported ${table}: ${rows} rows / ${pageNo} pages`);
}

const endRaw = await getRaw({ table:"metadata" });
validateMetadata(endRaw.json);
const end = endRaw.json;
writeFileSync(join(OUT, "metadata-end.json"), endRaw.bytes);

if (end.snapshotGuard !== start.snapshotGuard) throw new Error("snapshot guard changed during export");
if (stableJson(end.tableState) !== stableJson(start.tableState)) throw new Error("table inventory changed during export");
if (end.activeLeases !== 0) throw new Error("active lease appeared during export");

manifest.completedAt = new Date().toISOString();
manifest.tableInventorySha256 = sha(stableJson(start.tableState));
manifest.manifestSha256 = sha(stableJson({
  schemaVersion:manifest.schemaVersion,
  snapshotGuard:manifest.snapshotGuard,
  migrationLedger:manifest.migrationLedger,
  tableInventorySha256:manifest.tableInventorySha256,
  tables:manifest.tables.map(({ table,rows,maxRowid,pages,rowSha256,pageManifestSha256 }) =>
    ({ table,rows,maxRowid,pages,rowSha256,pageManifestSha256 })),
}));
writeFileSync(join(OUT, "export-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`CLOUDFLARE_MIGRATION_EXPORT_PASS guard=${manifest.snapshotGuard} manifest=${manifest.manifestSha256} tables=${manifest.tables.length}`);
