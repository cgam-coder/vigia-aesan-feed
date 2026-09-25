import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  ALERT_TYPES, LANDING_URL, filteredUrl, validateControls, parseFilteredPage,
  scanOfficialTaxonomy, publicationMembers, projectClassification, enrichFeedTaxonomy,
} from "../scripts/aesan-taxonomy.mjs";
import { AESAN_LIST_URL } from "../scripts/aesan.mjs";

const reviewed = JSON.parse(await readFile(new URL("fixtures/aesan-taxonomy-f0-reviewed.json", import.meta.url))).publications;
const feed = JSON.parse(await readFile(new URL("../feed.json", import.meta.url)));
const codes = Object.keys(ALERT_TYPES);
const path = (suffix) => `https://www.aesan.gob.es/alertas/${suffix}`;
const selector = (selected) => `<select id="filter-select" value="${ALERT_TYPES[selected].sourceTypeId}">${codes.map((code) =>
  `<option value="${ALERT_TYPES[code].sourceTypeId}">${ALERT_TYPES[code].officialLabel}</option>`).join("")}</select>`;
const landing = () => codes.map((code) => `<h2 data-section="${ALERT_TYPES[code].officialLabel}"></h2><a href="/alertas/buscador-alertas?type=${ALERT_TYPES[code].sourceTypeId}" title="Ver todas">Ver todas</a>`).join("");
const search = () => selector("general_population");
const page = (code, index, all) => {
  const total = all.length;
  const pages = Math.ceil(total / 20);
  const start = (index - 1) * 20 + 1;
  const end = Math.min(index * 20, total);
  const cards = all.slice(start - 1, end).map((url) => `<a class="seeMoreCard seeMoreCard--m" href="${url}" title="Official">card</a>`).join("");
  const list = Array.from({ length:pages }, (_, i) => i + 1).map((n) =>
    `<li class="pagination__item pagination__number ${n === index ? "pagination__active" : ""}" aria-label="page ${n}"><a href="${n === index ? "#" : filteredUrl(code, n)}">${n}</a></li>`).join("");
  return `${selector(code)}${cards}<div class="result__info">${start} - ${end} de ${total}</div><nav class="pagination">${list}</nav>`;
};
const surfaces = (data) => {
  const html = new Map([[LANDING_URL, landing()], [AESAN_LIST_URL, search()]]);
  for (const code of codes) for (let i = 1; i <= Math.ceil(data[code].length / 20); i++)
    html.set(filteredUrl(code, i), page(code, i, data[code]));
  return { html, fetch:async (url) => {
    if (!html.has(url)) throw new Error(`HTTP 500 ${url}`);
    return html.get(url);
  } };
};
const dataset = () => ({ general_population:Array.from({ length:41 }, (_, i) => path(`2025_${i + 1}`)),
  allergy_intolerance_adverse:[path("2026_37")], food_supplements:[path("2026_67")] });

test("three exact official controls, labels, UUIDs, all pages and extreme duplicate cards", async () => {
  const data = dataset();
  data.general_population.fill(path("2025_13"), 0, 19);
  const { fetch } = surfaces(data);
  const scan = await scanOfficialTaxonomy(fetch);
  assert.deepEqual(Object.fromEntries(scan.metrics.map((x) => [x.code, [x.pages, x.raw, x.unique]])),
    { general_population:[3, 41, 23], allergy_intolerance_adverse:[1, 1, 1], food_supplements:[1, 1, 1] });
  assert.equal(scan.provenance.length, 7);
  assert.equal(scan.memberships.get(path("2025_13"))[0].code, "general_population");
  assert.equal(parseFilteredPage(page("general_population", 3, data.general_population), "general_population", 3).raw, 1);
});

test("single-page filtered response may omit pagination but multi-page cannot", () => {
  const one = [path("2026_67")];
  const withoutPagination = page("food_supplements", 1, one).replace(/<nav class="pagination">[\s\S]*?<\/nav>/u, "");
  const parsed = parseFilteredPage(withoutPagination, "food_supplements", 1);
  assert.equal(parsed.total, 1);
  assert.equal(parsed.lastPage, 1);
  assert.deepEqual(parsed.urls, one);

  const many = Array.from({ length:21 }, (_, i) => path(`2025_${i + 1}`));
  const broken = page("general_population", 1, many).replace(/<nav class="pagination">[\s\S]*?<\/nav>/u, "");
  assert.throws(() => parseFilteredPage(broken, "general_population", 1), /missing pagination general_population page 1/u);
});

test("drift: fourth category, UUID, label, missing control and landing/search disagreement", () => {
  const base = landing();
  const searchHtml = search();
  validateControls(base, searchHtml);
  for (const mutated of [
    searchHtml.replace("</select>", "<option value=\"00000000-0000-4000-8000-000000000000\">Cuarta</option></select>"),
    searchHtml.replaceAll(ALERT_TYPES.general_population.sourceTypeId, "00000000-0000-4000-8000-000000000000"),
    searchHtml.replace(ALERT_TYPES.general_population.officialLabel, "Label changed"),
    searchHtml.replace(/<option[^>]*>Alertas alimentarias de interés para toda la población<\/option>/u, ""),
  ]) assert.throws(() => validateControls(base, mutated), /AESAN_TAXONOMY_DRIFT/u);
  assert.throws(() => validateControls(base.replace(ALERT_TYPES.general_population.sourceTypeId, "00000000-0000-4000-8000-000000000000"), searchHtml), /AESAN_TAXONOMY_DRIFT/u);
});

test("drift: broken/changed pagination, failed page, duplicated cross-category URL", async () => {
  const data = dataset();
  const broken = surfaces(data);
  broken.html.set(filteredUrl("general_population", 2), broken.html.get(filteredUrl("general_population", 2)).replace("21 - 40", "21 - 39"));
  await assert.rejects(scanOfficialTaxonomy(broken.fetch), /incomplete filtered page/u);
  const missing = surfaces(data);
  missing.html.delete(filteredUrl("general_population", 3));
  await assert.rejects(scanOfficialTaxonomy(missing.fetch), /HTTP 500/u);
  const conflicting = surfaces({ ...data, allergy_intolerance_adverse:[data.general_population[0]] });
  await assert.rejects(scanOfficialTaxonomy(conflicting.fetch), /multiple categories/u);
});

test("F0 offline replay: preserved taxonomy, ES382 unknown and current feed publications integrated", () => {
  assert.equal(reviewed.length, 166);
  const counts = Object.fromEntries(codes.map((code) => [code, reviewed.filter((x) => x.code === code).length]));
  assert.deepEqual(counts, { general_population:80, allergy_intolerance_adverse:71, food_supplements:14 });
  const memberships = new Map(reviewed.filter((x) => x.code).map((item) => [item.url, [ALERT_TYPES[item.code]]]));
  const gaps = ["2025_13", "2025_13_Amp", "2025_05"].map(path);
  for (const url of gaps) memberships.set(url, [ALERT_TYPES.general_population]);
  const { feed:enriched, diagnostics } = enrichFeedTaxonomy(feed, { memberships }, { reviewed });
  assert.equal(enriched.alerts.length, 128);
  assert.deepEqual(diagnostics.gaps, []);
  assert.deepEqual(diagnostics.unknown, [{ reference:"ES2026/382", urls:[path("2026_52_Ampliacion_1")] }]);
  assert.deepEqual(enriched.alerts.reduce((acc, alert) => {
    const taxonomy = alert.aesanAlertClassification;
    acc[taxonomy.code ?? taxonomy.status] = (acc[taxonomy.code ?? taxonomy.status] ?? 0) + 1;
    return acc;
  }, {}), { general_population:59, allergy_intolerance_adverse:53, food_supplements:14, unknown:1 });
  for (const [reference, code, count] of [
    ["ES2026/266", "allergy_intolerance_adverse", 1], ["ES2026/085", "allergy_intolerance_adverse", 2],
    ["ES2026/177", "general_population", 3], ["ES2026/517", "allergy_intolerance_adverse", 2],
  ]) {
    const alert = enriched.alerts.find((x) => x.reference === reference);
    assert.equal(alert.aesanAlertClassification.code, code, reference);
    assert.equal(alert.aesanAlertClassification.publications.length, count, reference);
  }
  assert.equal(enriched.alerts.find((x) => x.reference === "ES2026/266").productClass, "Complementos alimenticios");
  const es382 = enriched.alerts.find((x) => x.reference === "ES2026/382").aesanAlertClassification;
  assert.equal(es382.status, "unknown");
  assert.equal(es382.code, null);
  assert.equal(es382.publications.find((x) => x.url === path("2026_52")).matches[0].code, "allergy_intolerance_adverse");
  assert.deepEqual(es382.publications.find((x) => x.url === path("2026_52_Ampliacion_1")).matches, []);
  const strip = (alert) => { const copy = { ...alert }; delete copy.aesanAlertClassification; return copy; };
  assert.deepEqual(enriched.alerts.map(strip), feed.alerts.map(strip));
  assert.deepEqual(enriched.alerts.flatMap(publicationMembers).filter((x) => x.url === path("2025_13")), []);
  assert.deepEqual(enrichFeedTaxonomy(enriched, { memberships }, { reviewed }).feed, enriched);
  const single = enriched.alerts.map((x) => Buffer.byteLength(JSON.stringify(x.aesanAlertClassification)));
  const before = Buffer.byteLength(JSON.stringify(feed, null, 2) + "\n");
  const after = Buffer.byteLength(JSON.stringify(enriched, null, 2) + "\n");
  console.log(JSON.stringify({ before, after, increase:after - before, percent:100 * (after - before) / before, maxObject:Math.max(...single) }));
});

test("F2 read-only 62-page capture replays exact current metrics and SHA-256 fixtures", async () => {
  const capture = JSON.parse(await readFile(new URL("fixtures/aesan-taxonomy-f2-capture.json", import.meta.url)));
  assert.equal(capture.capturedDateUtc, "2026-09-24");
  assert.equal(capture.pages.length, 62);
  const pages = new Map();
  for (const page of capture.pages) {
    assert.equal(createHash("sha256").update(page.html).digest("hex"), page.fixtureSha256);
    assert.match(page.rawSha256, /^[0-9a-f]{64}$/u);
    pages.set(page.url, page.html);
  }
  const scan = await scanOfficialTaxonomy(async (url) => {
    assert.ok(pages.has(url), `missing captured page ${url}`);
    return pages.get(url);
  });
  assert.deepEqual(Object.fromEntries(scan.metrics.map((m) => [m.code, [m.pages, m.raw, m.unique]])), {
    allergy_intolerance_adverse:[25, 497, 71], food_supplements:[5, 98, 14], general_population:[30, 581, 83],
  });
  assert.equal(scan.memberships.size, 168);
  const { diagnostics } = enrichFeedTaxonomy(feed, scan, { reviewed });
  assert.deepEqual(diagnostics.gaps, []);
  assert.deepEqual(diagnostics.disappeared, []);
  assert.deepEqual(diagnostics.unknown, [{ reference:"ES2026/382", urls:[path("2026_52_Ampliacion_1")] }]);
});

test("conflict wins over unknown; prior changes and URL↔UUID conflict block generation", () => {
  const original = feed.alerts.find((x) => x.reference === "ES2026/382");
  const members = publicationMembers(original);
  const membership = new Map([[members[0].url, [ALERT_TYPES.general_population, ALERT_TYPES.allergy_intolerance_adverse]]]);
  assert.equal(projectClassification(original, membership).status, "conflict");
  membership.set(members[0].url, [ALERT_TYPES.allergy_intolerance_adverse]);
  membership.set(members[1].url, [ALERT_TYPES.general_population]);
  assert.equal(projectClassification(original, membership).status, "conflict");
  assert.throws(() => enrichFeedTaxonomy(feed, { memberships:membership }, { reviewed }), /unreviewed category change|conflicting official/u);
  const changed = { ...original, publicationHistory:[{ ...original.publicationHistory[0], url:original.url }] };
  assert.throws(() => publicationMembers(changed), /URL↔UUID conflict/u);
});

test("failed scan leaves an existing OUTPUT_PATH byte-identical", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesan-taxonomy-"));
  const target = join(dir, "feed.json");
  const sentinel = Buffer.from("previous production feed\n");
  try {
    await writeFile(target, sentinel);
    const broken = surfaces(dataset());
    broken.html.delete(filteredUrl("general_population", 2));
    await assert.rejects((async () => {
      const scan = await scanOfficialTaxonomy(broken.fetch);
      await writeFile(target, JSON.stringify(enrichFeedTaxonomy(feed, scan, { reviewed }).feed));
    })(), /HTTP 500/u);
    assert.deepEqual(await readFile(target), sentinel);
  } finally { await rm(dir, { recursive:true, force:true }); }
});
