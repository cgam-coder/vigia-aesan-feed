const BASE = "https://nagamealert.com";
const INCLUDED_ROWS_MONTH = 25_000_000_000;

const baseline = {
  "default-7d-50":6292189,
  "default-7d-page2":6433101,
  "default-7d-1":965820,
  "default-30d-50":6301920,
  "country-es-7d-50":1886013,
  "domain-human-food-7d-50":7135541,
  "source-aesan-7d-50":415243,
  "source-rapna-7d-50":33747,
  "source-rasff-7d-50":32234041,
  "source-safety-gate-7d-50":32545007,
  "source-oecd-7d-50":716224,
  "aesan-all-50":19724203,
  "aesan-all-allergy-50":7723255,
  "aesan-search-sulfitos":1354861,
};

const parseRows = (headers) => {
  const raw = headers.get("x-nagame-d1-rows") ?? "";
  if (!raw) throw new Error("missing X-Nagame-D1-Rows");
  const reads = {}, writes = {};
  for (const token of raw.split(",")) {
    const [key, value] = token.trim().split("=");
    const n = Number(value);
    if (!key || !Number.isFinite(n)) continue;
    if (key.endsWith(".rows_read")) reads[key.replace(/\.rows_read$/u, "")] = n;
    if (key.endsWith(".rows_written")) writes[key.replace(/\.rows_written$/u, "")] = n;
  }
  return {
    reads,
    writes,
    totalRows:Object.values(reads).reduce((sum, value) => sum + value, 0),
  };
};

const probe = async (name, params) => {
  const url = new URL("/api/terminal/alerts", BASE);
  for (const [key, value] of params) url.searchParams.append(key, value);
  const started = performance.now();
  const response = await fetch(url, { headers:{ "X-Nagame-Perf":"1" }, redirect:"follow" });
  const elapsedMs = performance.now() - started;
  const text = await response.text();
  if (response.status !== 200) throw new Error(name + " HTTP " + response.status + " " + text.slice(0, 500));
  const body = JSON.parse(text);
  const rows = parseRows(response.headers);
  if (Object.values(rows.writes).some((value) => value !== 0)) {
    throw new Error(name + " wrote D1 rows: " + JSON.stringify(rows.writes));
  }
  if (!(rows.totalRows < 250_000)) {
    throw new Error(name + " cost gate failed: " + rows.totalRows + " rows_read");
  }
  const before = baseline[name];
  const reductionPct = before
    ? Number(((1 - rows.totalRows / before) * 100).toFixed(4))
    : null;
  if ((name === "default-7d-50" || name === "default-30d-50") && !(reductionPct >= 95)) {
    throw new Error(name + " reduction gate failed: " + reductionPct + "%");
  }
  const result = {
    name,
    totalRows:rows.totalRows,
    reads:rows.reads,
    writes:rows.writes,
    reductionPct,
    routeServerTiming:response.headers.get("server-timing"),
    wallMs:Number(elapsedMs.toFixed(1)),
    total:body?.total ?? null,
    returned:body?.pagination?.returned ?? null,
    hasMore:body?.pagination?.hasMore ?? null,
    pageSize:body?.pagination?.pageSize ?? null,
    source:body?.query?.source ?? null,
    period:body?.query?.period ?? null,
    country:body?.query?.country ?? null,
    aesanType:body?.query?.aesanType ?? null,
    nextCursor:body?.pagination?.nextCursor ?? null,
  };
  console.log("PERF_F1_PROD " + JSON.stringify({...result,nextCursor:result.nextCursor ? "[present]" : null}));
  return result;
};

const results = [];
const first = await probe("default-7d-50", [
  ["period","7d"],["country","ALL"],["pageSize","50"],
]);
results.push(first);
if (!first.nextCursor) throw new Error("default 7d first page missing cursor");
results.push(await probe("default-7d-page2", [
  ["period","7d"],["country","ALL"],["pageSize","50"],["cursor",first.nextCursor],
]));
results.push(await probe("default-7d-1", [
  ["period","7d"],["country","ALL"],["pageSize","1"],
]));
results.push(await probe("default-30d-50", [
  ["period","30d"],["country","ALL"],["pageSize","50"],
]));
results.push(await probe("country-es-7d-50", [
  ["period","7d"],["country","ES"],["pageSize","50"],
]));
results.push(await probe("domain-human-food-7d-50", [
  ["period","7d"],["country","ALL"],["domain","human_food"],["pageSize","50"],
]));
for (const [name, source] of [
  ["source-aesan-7d-50","AESAN"],
  ["source-rapna-7d-50","RAPNA"],
  ["source-rasff-7d-50","RASFF"],
  ["source-safety-gate-7d-50","SAFETY GATE"],
  ["source-oecd-7d-50","OECD"],
]) {
  results.push(await probe(name, [
    ["period","7d"],["country","ALL"],["source",source],["pageSize","50"],
  ]));
}
results.push(await probe("aesan-all-50", [
  ["period","all"],["country","ALL"],["source","AESAN"],["pageSize","50"],
]));
results.push(await probe("aesan-all-allergy-50", [
  ["period","all"],["country","ALL"],["source","AESAN"],["aesanType","allergy_intolerance_adverse"],["pageSize","50"],
]));
results.push(await probe("aesan-search-sulfitos", [
  ["q","sulfitos"],["period","all"],["country","ALL"],["source","AESAN"],["pageSize","50"],
]));

const default7d = results.find((row) => row.name === "default-7d-50");
const default30d = results.find((row) => row.name === "default-30d-50");
const max = results.toSorted((a,b)=>b.totalRows-a.totalRows)[0];
const summary = {
  cases:results.length,
  maxRowsRead:{name:max.name,totalRows:max.totalRows},
  default7d:{
    totalRows:default7d.totalRows,
    reductionPct:default7d.reductionPct,
    includedRequestsPerMonth:Math.floor(INCLUDED_ROWS_MONTH/default7d.totalRows),
  },
  default30d:{
    totalRows:default30d.totalRows,
    reductionPct:default30d.reductionPct,
    includedRequestsPerMonth:Math.floor(INCLUDED_ROWS_MONTH/default30d.totalRows),
  },
  allUnder250k:results.every((row)=>row.totalRows<250_000),
};
console.log("PERF_F1_PROD_SUMMARY " + JSON.stringify(summary));
if (!summary.allUnder250k) throw new Error("not all production perf cases are below 250k");
console.log("PERF_F1_PRODUCTION_COST_GATE status=PASS");
