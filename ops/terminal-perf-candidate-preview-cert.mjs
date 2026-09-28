import { createHash } from "node:crypto";

const BASELINE = "https://work-f3b-taxonomy-b1-preview-vigia-runtime.c-gamiz93.workers.dev";
const CANDIDATE = "https://work-terminal-perf-current-query-plan-vigia-runtime.c-gamiz93.workers.dev";

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, stable(child)]))
    : value;
const digest = (value) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");

const getJson = async (base, path, headers = {}) => {
  const response = await fetch(base + path, { headers, redirect:"follow" });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); }
  catch { throw new Error(base + path + " non-JSON HTTP " + response.status + ": " + text.slice(0, 500)); }
  return { response, body, text };
};

const compare = async (path, expectedStatus = 200) => {
  const [left, right] = await Promise.all([getJson(BASELINE, path), getJson(CANDIDATE, path)]);
  if (left.response.status !== expectedStatus || right.response.status !== expectedStatus) {
    throw new Error("status mismatch " + path + " baseline=" + left.response.status + " candidate=" + right.response.status);
  }
  const leftDigest = digest(left.body), rightDigest = digest(right.body);
  if (leftDigest !== rightDigest) {
    throw new Error("semantic mismatch " + path + "\nbaseline=" + JSON.stringify(left.body) + "\ncandidate=" + JSON.stringify(right.body));
  }
  console.log("PERF_PREVIEW_EQUIVALENCE " + JSON.stringify({
    path, status:expectedStatus, digest:leftDigest,
    total:left.body?.total ?? null, returned:left.body?.pagination?.returned ?? null,
  }));
  return left.body;
};

const queries = [
  "/api/terminal/alerts?period=all&country=ALL&source=AESAN&pageSize=50",
  "/api/terminal/alerts?period=all&country=ALL&source=AESAN&aesanType=general_population&pageSize=50",
  "/api/terminal/alerts?period=all&country=ALL&source=AESAN&aesanType=allergy_intolerance_adverse&pageSize=50",
  "/api/terminal/alerts?period=all&country=ALL&source=AESAN&aesanType=food_supplements&pageSize=50",
  "/api/terminal/alerts?period=7d&country=ALL&source=AESAN&pageSize=50",
  "/api/terminal/alerts?period=all&country=ES&source=AESAN&pageSize=50",
  "/api/terminal/alerts?period=all&country=ALL&domain=human_food&source=AESAN&pageSize=50",
  "/api/terminal/alerts?q=sulfitos&period=all&country=ALL&source=AESAN&pageSize=50",
  "/api/terminal/alerts?q=ES2026%2F266&period=all&country=ALL&source=AESAN&pageSize=50",
  "/api/terminal/alerts?q=ES2026%2F382&period=all&country=ALL&source=AESAN&pageSize=50",
  "/api/terminal/alerts?q=ES2026%2F085&period=all&country=ALL&source=AESAN&pageSize=50",
  "/api/terminal/alerts?q=ES2026%2F177&period=all&country=ALL&source=AESAN&pageSize=50",
  "/api/terminal/alerts?q=ES2026%2F517&period=all&country=ALL&source=AESAN&pageSize=50",
];

let first;
for (const path of queries) {
  const body = await compare(path);
  if (path === queries[0]) first = body;
}

if (!first?.pagination?.nextCursor) throw new Error("baseline first page missing cursor");
const cursorPath = "/api/terminal/alerts?period=all&country=ALL&source=AESAN&pageSize=50&cursor=" +
  encodeURIComponent(first.pagination.nextCursor);
await compare(cursorPath);

for (const path of [
  "/api/terminal/alerts?period=all&source=RASFF&aesanType=general_population",
  "/api/terminal/alerts?period=all&aesanType=general_population",
  "/api/terminal/alerts?period=all&source=AESAN&aesanType=not_a_real_type",
]) await compare(path, 400);

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
    totalReads:Object.values(reads).reduce((sum, value) => sum + value, 0),
  };
};

for (const path of [
  "/api/terminal/alerts?period=all&country=ALL&source=AESAN&pageSize=50",
  "/api/terminal/alerts?period=all&country=ALL&source=AESAN&aesanType=allergy_intolerance_adverse&pageSize=50",
  "/api/terminal/alerts?q=sulfitos&period=all&country=ALL&source=AESAN&pageSize=50",
  "/api/terminal/alerts?period=7d&country=ALL&pageSize=50",
]) {
  const [baseline, candidate] = await Promise.all([
    getJson(BASELINE, path, { "X-Nagame-Perf":"1" }),
    getJson(CANDIDATE, path, { "X-Nagame-Perf":"1" }),
  ]);
  if (baseline.response.status !== 200 || candidate.response.status !== 200) throw new Error("perf status mismatch " + path);
  if (digest(baseline.body) !== digest(candidate.body)) throw new Error("perf body mismatch " + path);
  const before = parseRows(baseline.response.headers);
  const after = parseRows(candidate.response.headers);
  if (Object.values(before.writes).some((value) => value !== 0) || Object.values(after.writes).some((value) => value !== 0)) {
    throw new Error("unexpected D1 writes " + path);
  }
  if (!(after.totalReads < before.totalReads)) {
    throw new Error("candidate did not reduce rows_read " + path + " before=" + before.totalReads + " after=" + after.totalReads);
  }
  console.log("PERF_PREVIEW_ROWS " + JSON.stringify({
    path,
    baseline:{ totalReads:before.totalReads, reads:before.reads },
    candidate:{ totalReads:after.totalReads, reads:after.reads },
    reductionPct:Number(((1 - after.totalReads / before.totalReads) * 100).toFixed(4)),
  }));
}

console.log("PERF_PREVIEW_CERT API_EQUIVALENCE=PASS PERF=PASS");
