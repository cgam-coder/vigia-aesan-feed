import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const DB = "nagamealert-staging-db";
const WRANGLER = ["--yes", "wrangler@4.135.0"];
const CUTOFF = "2026-09-21T04:22:30.000Z";
const PAGE_SIZE = 50;

const runD1 = (sql) => {
  const raw = execFileSync("npx", [...WRANGLER, "d1", "execute", DB, "--remote", "--command", sql, "--json"], {
    encoding:"utf8",
    maxBuffer:20 * 1024 * 1024,
    stdio:["ignore", "pipe", "pipe"],
  });
  const parsed = JSON.parse(raw);
  const blocks = Array.isArray(parsed) ? parsed : [parsed];
  const rows = blocks.flatMap((block) => block?.results ?? []);
  const meta = blocks.map((block) => block?.meta ?? {});
  return {
    rows,
    rowsRead:meta.reduce((sum, item) => sum + Number(item.rows_read ?? 0), 0),
    rowsWritten:meta.reduce((sum, item) => sum + Number(item.rows_written ?? 0), 0),
    duration:meta.reduce((sum, item) => sum + Number(item.duration ?? 0), 0),
  };
};

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stable(child)]))
    : value;

const digest = (value) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

const sourcePredicate = (source) => source ? ` AND alerts.source = '${source.replaceAll("'", "''")}'` : "";

const pageKeys = (source, limit) => `WITH page_keys AS MATERIALIZED (
  SELECT alerts.id
  FROM alerts LEFT JOIN alert_dimension_state ds ON ds.alert_id = alerts.id
  WHERE alerts.published_at >= '${CUTOFF}'${sourcePredicate(source)}
  ORDER BY alerts.published_at DESC, alerts.id DESC
  LIMIT ${limit}
)`;

const currentListSql = (source, limit) => `${pageKeys(source, limit)}
SELECT alerts.id, alerts.source,
  (SELECT og.country_code FROM alert_geographies og
    WHERE og.alert_id = alerts.id AND og.role = 'origin' AND og.status = 'mapped'
      AND og.admin_level = 'country' AND og.code_scheme = 'ISO_3166_1_ALPHA2'
    ORDER BY og.country_code LIMIT 1) AS originCountry,
  (SELECT ng.country_code FROM alert_geographies ng
    WHERE ng.alert_id = alerts.id AND ng.role = 'notifying' AND ng.status = 'mapped'
      AND ng.admin_level = 'country' AND ng.code_scheme = 'ISO_3166_1_ALPHA2'
    ORDER BY ng.country_code LIMIT 1) AS notifyingCountry,
  (SELECT rg.country_code FROM alert_geographies rg
    WHERE rg.alert_id = alerts.id AND alerts.source = 'OECD' AND rg.role = 'affected'
      AND rg.status = 'mapped' AND rg.admin_level = 'country' AND rg.code_scheme = 'ISO_3166_1_ALPHA2'
      AND rg.source_field = 'countryName:economy-of-recall'
      AND rg.reason = 'explicit-oecd-economy-of-recall'
    ORDER BY rg.country_code LIMIT 1) AS recallCountry,
  EXISTS(SELECT 1 FROM alert_geographies map_geo WHERE map_geo.alert_id = alerts.id AND map_geo.status = 'mapped' AND (
    (alerts.source = 'AESAN' AND ((map_geo.role IN ('notifying', 'distribution') AND map_geo.admin_level = 'subdivision' AND map_geo.code_scheme = 'ISO_3166_2') OR
      (map_geo.role = 'distribution' AND map_geo.geography_code = 'ES' AND map_geo.admin_level = 'country' AND map_geo.code_scheme = 'ISO_3166_1_ALPHA2'))) OR
    (alerts.source = 'RAPNA' AND map_geo.role = 'notifying' AND map_geo.admin_level = 'subdivision' AND map_geo.code_scheme = 'ISO_3166_2') OR
    (alerts.source = 'RASFF' AND map_geo.role IN ('origin', 'notifying', 'distribution') AND map_geo.admin_level = 'country' AND map_geo.code_scheme = 'ISO_3166_1_ALPHA2') OR
    (alerts.source = 'SAFETY GATE' AND map_geo.role IN ('origin', 'notifying') AND map_geo.admin_level = 'country' AND map_geo.code_scheme = 'ISO_3166_1_ALPHA2') OR
    (alerts.source = 'OECD' AND map_geo.admin_level = 'country' AND map_geo.code_scheme = 'ISO_3166_1_ALPHA2' AND
      (map_geo.role = 'origin' OR (map_geo.role = 'affected' AND map_geo.source_field = 'countryName:economy-of-recall' AND map_geo.reason = 'explicit-oecd-economy-of-recall')))
  )) AS hasMapGeography
FROM alerts
INNER JOIN page_keys ON page_keys.id = alerts.id
ORDER BY alerts.published_at DESC, alerts.id DESC`;

const candidateListSql = (source, limit) => `${pageKeys(source, limit)}
SELECT alerts.id, alerts.source,
  NULL AS originCountry,
  NULL AS notifyingCountry,
  NULL AS recallCountry,
  0 AS hasMapGeography
FROM alerts
INNER JOIN page_keys ON page_keys.id = alerts.id
ORDER BY alerts.published_at DESC, alerts.id DESC`;

const geographySql = (ids) => `SELECT alert_id AS alertId, role,
  geography_code AS geographyCode, country_code AS countryCode, admin_level AS adminLevel,
  code_scheme AS codeScheme, source_field AS sourceField, reason
FROM alert_geographies INDEXED BY alert_geographies_alert_role_idx
WHERE status = 'mapped' AND alert_id IN (${ids.map((id) => `'${String(id).replaceAll("'", "''")}'`).join(", ")})
ORDER BY alert_id, role, country_code, geography_code, source_field, reason`;

const groupGeographies = (rows) => {
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row.alertId) ?? [];
    list.push(row);
    grouped.set(row.alertId, list);
  }
  return grouped;
};

const hydrate = (row, geographies) => {
  const country = (role) => geographies.find((geo) =>
    geo.role === role && geo.adminLevel === "country" && geo.codeScheme === "ISO_3166_1_ALPHA2")?.countryCode ?? null;
  const recallCountry = row.source === "OECD"
    ? geographies.find((geo) => geo.role === "affected" && geo.adminLevel === "country" &&
      geo.codeScheme === "ISO_3166_1_ALPHA2" && geo.sourceField === "countryName:economy-of-recall" &&
      geo.reason === "explicit-oecd-economy-of-recall")?.countryCode ?? null
    : null;
  const hasMapGeography = geographies.some((geo) => {
    if (row.source === "AESAN") return ((geo.role === "notifying" || geo.role === "distribution") &&
      geo.adminLevel === "subdivision" && geo.codeScheme === "ISO_3166_2") ||
      (geo.role === "distribution" && geo.geographyCode === "ES" && geo.adminLevel === "country" &&
        geo.codeScheme === "ISO_3166_1_ALPHA2");
    if (row.source === "RAPNA") return geo.role === "notifying" && geo.adminLevel === "subdivision" &&
      geo.codeScheme === "ISO_3166_2";
    if (row.source === "RASFF") return (geo.role === "origin" || geo.role === "notifying" || geo.role === "distribution") &&
      geo.adminLevel === "country" && geo.codeScheme === "ISO_3166_1_ALPHA2";
    if (row.source === "SAFETY GATE") return (geo.role === "origin" || geo.role === "notifying") &&
      geo.adminLevel === "country" && geo.codeScheme === "ISO_3166_1_ALPHA2";
    return geo.adminLevel === "country" && geo.codeScheme === "ISO_3166_1_ALPHA2" &&
      (geo.role === "origin" || (geo.role === "affected" && geo.sourceField === "countryName:economy-of-recall" &&
        geo.reason === "explicit-oecd-economy-of-recall"));
  });
  return {
    id:row.id,
    source:row.source,
    originCountry:country("origin"),
    notifyingCountry:country("notifying"),
    recallCountry,
    hasMapGeography:hasMapGeography ? 1 : 0,
  };
};

const normalizeCurrent = (row) => ({
  id:row.id,
  source:row.source,
  originCountry:row.originCountry ?? null,
  notifyingCountry:row.notifyingCountry ?? null,
  recallCountry:row.recallCountry ?? null,
  hasMapGeography:Number(row.hasMapGeography ?? 0),
});

const cases = [
  { name:"default-7d-50", source:null, limit:PAGE_SIZE + 1 },
  { name:"default-7d-1", source:null, limit:2 },
  { name:"rasff-7d-50", source:"RASFF", limit:PAGE_SIZE + 1 },
  { name:"safety-gate-7d-50", source:"SAFETY GATE", limit:PAGE_SIZE + 1 },
  { name:"aesan-7d-50", source:"AESAN", limit:PAGE_SIZE + 1 },
  { name:"oecd-7d-50", source:"OECD", limit:PAGE_SIZE + 1 },
];

const output = [];
for (const testCase of cases) {
  const current = runD1(currentListSql(testCase.source, testCase.limit));
  if (current.rowsWritten !== 0) throw new Error(testCase.name + " current wrote rows");

  const candidateList = runD1(candidateListSql(testCase.source, testCase.limit));
  if (candidateList.rowsWritten !== 0) throw new Error(testCase.name + " candidate list wrote rows");

  const ids = candidateList.rows.map((row) => row.id);
  const geography = ids.length ? runD1(geographySql(ids)) : { rows:[], rowsRead:0, rowsWritten:0, duration:0 };
  if (geography.rowsWritten !== 0) throw new Error(testCase.name + " geography wrote rows");

  const grouped = groupGeographies(geography.rows);
  const hydrated = candidateList.rows.map((row) => hydrate(row, grouped.get(row.id) ?? []));
  const baseline = current.rows.map(normalizeCurrent);

  const baselineDigest = digest(baseline);
  const candidateDigest = digest(hydrated);
  if (baselineDigest !== candidateDigest) {
    throw new Error(testCase.name + " semantic mismatch\ncurrent=" + JSON.stringify(baseline) + "\ncandidate=" + JSON.stringify(hydrated));
  }

  const candidateRowsRead = candidateList.rowsRead + geography.rowsRead;
  const reduction = current.rowsRead > 0 ? 1 - candidateRowsRead / current.rowsRead : 0;
  const row = {
    name:testCase.name,
    items:ids.length,
    current:{ rowsRead:current.rowsRead, duration:current.duration },
    candidate:{
      listRowsRead:candidateList.rowsRead,
      geographyRowsRead:geography.rowsRead,
      totalRowsRead:candidateRowsRead,
      duration:candidateList.duration + geography.duration,
    },
    reductionPct:Number((reduction * 100).toFixed(4)),
    digest:baselineDigest,
  };
  output.push(row);
  console.log("TERMINAL_LIST_PLAN " + JSON.stringify(row));
}

const summary = {
  cases:output.length,
  allEquivalent:true,
  minimumReductionPct:Math.min(...output.map((row) => row.reductionPct)),
  output,
};
console.log("TERMINAL_LIST_PLAN_SUMMARY " + JSON.stringify(summary));
