import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assembleFeed, parseDetail, previousForCard, sourceIdentityForHtml } from "../scripts/aesan.mjs";
import {
  comparePublications, publicationCards, publicationDateEvidence, reconcilePublicationBatch,
} from "../scripts/aesan-publications.mjs";

const fixture = JSON.parse(await readFile(new URL("./fixtures/aesan-publications-177.json", import.meta.url), "utf8"));
const { earlier, later } = fixture;
const first = "2026-09-22T16:00:00.000Z";
const second = "2026-09-22T16:15:00.000Z";
const third = "2026-09-22T16:30:00.000Z";
const clone = (x) => JSON.parse(JSON.stringify(x));
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// Reconstruct an HTML TEST FIXTURE from published fields already stored in Git.
// This is not archived official HTML. Hash equality below proves that the parser
// reconstructs the exact material record; the original records retain provenance.
const htmlFor = (record) => {
  const groups = new Map();
  for (const field of record.publishedFields ?? []) {
    if (!groups.has(field.context)) groups.set(field.context, []);
    groups.get(field.context).push(field);
  }
  const date = record.officialDates?.find((item) => item.sourceField === "pageInfo.date")?.value;
  const id = record.sourceRecordIdType === "idAlert" ? `<meta name="idAlert" content="${esc(record.sourceRecordId)}">` : "";
  return `<html><head>${id}<meta name="content-date" content="${esc(record.publishedAt)}"></head><body>
    <h1 class="aesan-title">${esc(record.officialTitle)}</h1>
    ${date ? `<div class="pageInfo__date">${esc(date)}</div>` : ""}
    <div class="post-container aesan-bgText"><p>${esc(record.action)}</p></div>
    <div class="post-container">${(record.materialParagraphs ?? []).map((p) => `<p>${esc(p.value)}</p>`).join("")}
    ${[...groups.values()].map((group) => `<ul>${group.map((f) => `<li>${esc(f.label)}: ${esc(f.value)}</li>`).join("")}</ul>`).join("")}
    ${(record.officialDates ?? []).filter((d) => d.label === "Fecha y hora").map((d) => `<p>Fecha y hora: ${esc(d.value)}</p>`).join("")}
    ${(record.resources ?? []).map((r) => r.kind === "image" ? `<img src="${esc(r.url)}" alt="${esc(r.label)}">` : `<p><a href="${esc(r.url)}">${esc(r.label)}</a></p>`).join("")}</div>
    <a href="/alertas/buscador-alertas">Volver</a></body></html>`;
};
const observed = (record, card = record) => ({ card, html:htmlFor(record) });
const run = (previous, records, now = first) => reconcilePublicationBatch(previous, records.map((r) => observed(r)), now);
const materialState = (record) => Object.fromEntries([
  "id", "reference", "sourceRecordId", "url", "publishedAt", "contentHash", "sourceRecordHash",
  "versionCount", "updatedAt", "detectedAt", "publishedFields", "referenceHistory", "previousReferences",
].map((key) => [key, record[key]]));

for (const [name, record] of Object.entries({ earlier, later })) {
  test(`Git fixture ${name} reconstructs the exact material hash, UUID, dates and fields`, () => {
    const actual = parseDetail(htmlFor(record), record, null, first);
    assert.equal(actual.sourceRecordHash, record.sourceRecordHash);
    assert.equal(actual.sourceRecordId, record.sourceRecordId);
    assert.deepEqual(actual.publishedFields, record.publishedFields);
    assert.deepEqual(actual.officialDates, record.officialDates);
  });
}

test("ES2026/177 late old publication preserves the live amplification and added lot", () => {
  const [current] = run([later], [earlier]);
  assert.deepEqual(materialState(current), materialState(later));
  assert.match(JSON.stringify(current.publishedFields), /361614/u);
  assert.equal(current.publicationHistory.length, 2);
  assert.deepEqual(new Set(current.publicationHistory.map((p) => p.url)), new Set([earlier.url, later.url]));
  assert.deepEqual(current.publicationHistory.find((p) => p.url === earlier.url).publishedFields, earlier.publishedFields);
});

test("unmodified current publication stays byte-identical before ledger enrichment", () => {
  const [current] = run([later], [later]);
  assert.deepEqual(current, later);
});

test("amplification then original then amplification replays never create extra versions", () => {
  let current = run([], [earlier])[0];
  assert.equal(current.versionCount, 1);
  current = run([current], [later], second)[0];
  assert.equal(current.versionCount, 2);
  const baseline = clone(current);
  for (let i = 0; i < 10; i += 1) current = run([current], i % 2 ? [later] : [earlier], third)[0];
  assert.deepEqual(current, baseline);
});

test("legacy counters are not silently reset or promoted to claimed official publication counts", () => {
  const [current] = run([later], [earlier, later]);
  assert.equal(current.versionCount, 54);
  assert.equal(current.publicationHistory.length, 2);
  assert.equal(current.updatedAt, later.updatedAt);
});

test("late history enrichment is idempotent and does not alter semantic dates or hashes", () => {
  const enriched = run([later], [earlier, later])[0];
  const before = assembleFeed({ alerts:[] }, [enriched], first);
  const after = assembleFeed(before, run(before.alerts, [later, earlier, earlier], second), second);
  assert.deepEqual(after, before);
});

test("no initial state: one case and complete two-publication source ledger in either arrival order", () => {
  const forward = run([], [earlier, later])[0];
  const reverse = run([], [later, earlier])[0];
  assert.deepEqual(forward, reverse);
  assert.equal(forward.url, later.url);
  assert.equal(forward.versionCount, 1); // first imported state, not invented past ingestion events
  assert.equal(forward.publicationHistory.length, 2);
  assert.equal(assembleFeed({ alerts:[] }, [forward], first).alerts.length, 1);
});

test("details, not incorrect listing dates, determine the current publication", () => {
  const wrongCard = { ...earlier, publishedAt:"2026-12-31T12:00:00.000Z" };
  const [current] = reconcilePublicationBatch([], [observed(earlier, wrongCard), observed(later)], first);
  assert.equal(current.url, later.url);
  assert.equal(current.publishedAt, later.publishedAt);
});

test("twenty repeated official cards stay one URL request while different publication pages survive", () => {
  const cards = publicationCards([...Array(20).fill(later), earlier, { ...later, url:`${later.url}#section` }]);
  assert.equal(cards.length, 2);
  assert.deepEqual(new Set(cards.map((c) => new URL(c.url).pathname)), new Set(["/alertas/2026_26", "/alertas/2026_26_amp"]));
  const [current] = run([], [...Array(20).fill(later)]);
  assert.equal(current.versionCount, 1);
  assert.equal(current.publicationHistory, undefined);
});

test("repeat an identical assembled observation without manufacturing version 2", () => {
  const current = run([], [later])[0];
  const feed = assembleFeed({ alerts:[] }, [current, current, clone(current)], first);
  assert.equal(feed.alerts.length, 1);
  assert.equal(feed.alerts[0].versionCount, 1);
  const replay = assembleFeed(feed, [current, current], second);
  assert.deepEqual(replay, feed);
});

test("same publication can receive a genuine in-place correction", () => {
  const original = run([], [later])[0];
  const corrected = clone(later);
  corrected.materialParagraphs[0].value += " Rectificación oficial de prueba.";
  const current = run([original], [corrected], second)[0];
  assert.equal(current.versionCount, 2);
  assert.notEqual(current.sourceRecordHash, original.sourceRecordHash);
  assert.equal(current.updatedAt, second);
  assert.equal(current.publicationHistory.length, 2);
  assert.deepEqual(run([current], [corrected], third)[0], current);
});

test("legitimate same-page reference correction preserves stable ID and registered reference history", () => {
  const original = clone(earlier);
  original.reference = "ES2026/243";
  original.officialTitle = original.title = "Alerta de prueba (Ref. ES2026/243)";
  original.url = "https://www.aesan.gob.es/alertas/2026_67";
  const previous = run([], [original])[0];
  const corrected = { ...original, reference:"ES2026/543", title:"Alerta de prueba (Ref. ES2026/543)", officialTitle:"Alerta de prueba (Ref. ES2026/543)" };
  const [current] = run([previous], [corrected], second);
  assert.equal(current.id, previous.id);
  assert.equal(current.reference, "ES2026/543");
  assert.deepEqual(current.previousReferences, ["ES2026/243"]);
  assert.equal(current.versionCount, 2);
  assert.equal(current.publicationHistory.length, 2);
});

test("actual detail reference overrides a stale index reference without selecting an unrelated previous case", () => {
  const actual = run([later], [later])[0];
  const [current] = reconcilePublicationBatch([actual], [observed(later, { ...later, reference:"ES2026/535" })], second);
  assert.equal(current.id, later.id);
  assert.equal(current.reference, later.reference);
  assert.equal(current.versionCount, actual.versionCount);
});

test("same-page UUID replacement remains a blocking identity error", () => {
  const impostor = { ...later, sourceRecordId:earlier.sourceRecordId };
  assert.throws(() => run([later], [impostor]), /cambió de UUID|UUID_CONFLICT/u);
});

test("same UUID on multiple paths is rejected even when one path exists only in the prior feed", () => {
  const conflict = { ...earlier, sourceRecordId:later.sourceRecordId };
  assert.throws(() => run([later], [conflict]), /MULTIPLE_PATHS/u);
  assert.throws(() => run([], [later, conflict]), /MULTIPLE_PATHS/u);
});

test("conflicting payloads for one page in the same batch fail, never choose by arrival order", () => {
  const changed = clone(later);
  changed.materialParagraphs[0].value += " Cambio contradictorio en el mismo lote.";
  assert.throws(() => run([later], [later, changed]), /CONFLICTING_PUBLICATION_RESPONSES/u);
});

test("indistinguishable publication order fails instead of ranking by title or URL", () => {
  const a = { ...earlier, publishedAt:later.publishedAt, officialDates:later.officialDates };
  assert.throws(() => run([], [a, later]), /ORDER_UNPROVEN/u);
});

test("two exact official times in the same date establish the order", () => {
  const a = { ...earlier, publishedAt:later.publishedAt, officialDates:[
    { label:null, value:"02/04/2026", sourceField:"pageInfo.date", order:0 },
    { label:"Fecha y hora", value:"02/04/2026 09:30", sourceField:"article.date[1]", order:1 },
  ] };
  assert.equal(run([], [a, later])[0].url, later.url);
});

test("same-day amplification with an explicit official link can establish succession without invented time", () => {
  const a = { ...earlier, publishedAt:later.publishedAt, officialDates:later.officialDates.slice(0, 1) };
  const b = clone(later);
  b.officialDates = b.officialDates.slice(0, 1);
  b.resources.push({ kind:"link", url:a.url, label:"Publicación anterior", sourceField:`article.link[${b.resources.length}]`, order:b.resources.length });
  assert.equal(run([], [a, b])[0].url, later.url);
});

test("missing or contradictory chronology is not repaired from ingestion timestamps", () => {
  const a = { ...earlier, publishedAt:null, officialDates:[] };
  assert.throws(() => run([later], [a]), /ORDER_UNPROVEN/u);
  assert.throws(() => comparePublications({ ...earlier, publishedAt:later.publishedAt }, later), /DATE_CONFLICT/u);
});

test("UTC prior evening and the corresponding Madrid publication date agree", () => {
  assert.equal(publicationDateEvidence(later).day, "2026-04-02");
  assert.equal(publicationDateEvidence(earlier).day, "2026-04-01");
});

test("transport failure does not downgrade existing material to a card or fake a source snapshot", () => {
  const [current] = reconcilePublicationBatch([later], [{ card:earlier, html:null }], first);
  assert.deepEqual(current, later);
});

test("corrupted source ledger fails closed and does not overwrite the previous feed", () => {
  const previous = run([later], [earlier])[0];
  previous.publicationHistory[0].publishedFields[0].value = "Contenido alterado";
  assert.throws(() => run([previous], [later]), /INVALID_PUBLICATION_HISTORY/u);
});

test("different cases with the same title/product remain separate", () => {
  const a = clone(earlier);
  const b = clone(later);
  a.reference = "ES2026/701";
  b.reference = "ES2026/702";
  a.officialTitle = a.title = "Título compartido sin referencia";
  b.officialTitle = b.title = a.title;
  const current = run([], [a, b]);
  assert.equal(current.length, 2);
  assert.deepEqual(new Set(current.map((r) => r.reference)), new Set([a.reference, b.reference]));
});

test("duplicate current references with different stable IDs are not merged by convenience", () => {
  const a = { ...earlier, id:"aesan:incorrect-duplicate" };
  assert.throws(() => run([a, later], [earlier]), /AMBIGUOUS_PREVIOUS_CASE/u);
});

test("recent and full replays preserve unobserved archive records and existing archive coverage", async () => {
  const realFeed = JSON.parse(await readFile(new URL("../feed.json", import.meta.url), "utf8"));
  const current = reconcilePublicationBatch(realFeed.alerts, [observed(earlier), observed(later)], first);
  const once = assembleFeed(realFeed, current, first);
  assert.equal(once.alerts.length, realFeed.alerts.length);
  assert.deepEqual(once.alerts.filter((r) => r.reference !== later.reference), realFeed.alerts.filter((r) => r.reference !== later.reference));
  const twice = assembleFeed(once, reconcilePublicationBatch(once.alerts, [observed(earlier)], second), second);
  assert.deepEqual(twice, once);
  assert.equal(twice.archive.lastFullSyncAt, realFeed.archive.lastFullSyncAt);
});

// Run the production CLI with mocked HTTP transports and a temporary OUTPUT_PATH.
// No source, runtime or D1 request is issued; unexpected network targets fail.
const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
const { tmpdir } = await import("node:os");
const { join } = await import("node:path");
const { spawnSync } = await import("node:child_process");
const { fileURLToPath } = await import("node:url");
const networkMock = `
import http from 'node:http'; import https from 'node:https';
import { EventEmitter } from 'node:events';
import { readFileSync, appendFileSync } from 'node:fs';
const routes=JSON.parse(readFileSync(process.env.QA_ROUTES,'utf8'));
const get=(url, options, callback)=>{
 const request=new EventEmitter(); request.destroy=(error)=>{queueMicrotask(()=>request.emit('error',error));return request;};
 setImmediate(()=>{
   const key=(url.pathname+url.search in routes)?url.pathname+url.search:url.pathname;
   if(url.protocol!=='https:'||url.hostname!=='www.aesan.gob.es'||!(key in routes)){
     request.emit('error',Object.assign(new Error('QA_UNEXPECTED_NETWORK_TARGET'),{code:'QA_DENIED'})); return;
   }
   appendFileSync(process.env.QA_REQUESTS,JSON.stringify({url:url.toString()})+'\\n');
   const response=new EventEmitter(); response.statusCode=200; response.headers={}; response.resume=()=>{};
   callback(response); response.emit('data',Buffer.from(routes[key])); response.emit('end');
 }); return request;
};
http.get=get; https.get=get; globalThis.fetch=()=>{throw new Error('QA_UNEXPECTED_FETCH');};
`;
const listHtml = (records, lastPage = null, landing = false) => `<html><body>${records.map((record) => {
  const day = publicationDateEvidence(record).day?.slice(-2) ?? "01";
  return `<a class="${landing ? "seeMoreCardSlide" : "seeMoreCard"}" href="${record.url}" title="${esc(record.title)}"><span class="seeMoreCard-heading__value">${day} Abril 2026</span></a>`;
}).join("")}${lastPage ? `<a href="/alertas/buscador-alertas/${lastPage}?quantity=40">Última</a>` : ""}</body></html>`;

const taxonomyTypes = {
  general_population:["b5c27f12-7f21-4d2e-bc5c-d5186b4d6259", "Alertas alimentarias de interés para toda la población"],
  allergy_intolerance_adverse:["8c7503b4-b714-4c08-9d8e-0039a2d03624", "Alertas alimentarias para personas con alergias, intolerancias u otros efectos adversos a determinadas sustancias"],
  food_supplements:["649ce619-367b-4ad2-96cd-27b905fb6020", "Alertas alimentarias para personas que consumen complementos alimenticios"],
};
const taxonomyReviewed = JSON.parse(await readFile(new URL("fixtures/aesan-taxonomy-f0-reviewed.json", import.meta.url))).publications;
function addTaxonomyRoutes(routes, seed) {
  const selectors = (code) => `<select id="filter-select" value="${taxonomyTypes[code][0]}">${Object.values(taxonomyTypes)
    .map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select>`;
  const landingControls = Object.values(taxonomyTypes).map(([id, label]) =>
    `<h2 data-section="${label}"></h2><a href="/alertas/buscador-alertas?type=${id}" title="Ver todas">Ver todas</a>`).join("");
  routes["/alertas/alertas-alimentarias"] += landingControls;
  routes["/alertas/buscador-alertas"] += selectors("general_population");
  for (const [code, [id]] of Object.entries(taxonomyTypes)) {
    const urls = taxonomyReviewed.filter((item) => item.code === code).map((item) => item.url);
    const total = urls.length;
    const pages = Math.ceil(total / 20);
    for (let page = 1; page <= pages; page++) {
      const start = (page - 1) * 20 + 1;
      const end = Math.min(page * 20, total);
      const cards = urls.slice(start - 1, end).map((url) => `<a class="seeMoreCard" href="${url}">card</a>`).join("");
      const links = Array.from({ length:pages }, (_, index) => index + 1).map((number) =>
        `<li class="pagination__item ${number === page ? "pagination__active" : ""}" aria-label="page ${number}"><a href="${number === page ? "#" : `/alertas/buscador-alertas/${number}?type=${id}`}">${number}</a></li>`).join("");
      routes[`/alertas/buscador-alertas${page === 1 ? "" : `/${page}`}?type=${id}`] =
        `<html>${selectors(code)}${cards}<div class="result__info">${start} - ${end} de ${total}</div><nav class="pagination">${links}</nav></html>`;
    }
  }
  const known = new Map(taxonomyReviewed.map((item) => [item.url, item.sourceRecordId]));
  for (const alert of seed.alerts ?? []) for (const item of [alert, ...(alert.publicationHistory ?? [])])
    known.set(item.url, item.sourceRecordId);
  for (const [url, id] of known) {
    const pathname = new URL(url).pathname;
    if (!(pathname in routes)) routes[pathname] = `<html><meta name="idAlert" content="${id}"></html>`;
  }
  return routes;
}

async function cliRun(seed, routes, full = false) {
  const dir = await mkdtemp(join(tmpdir(), "aesan-publication-qa-"));
  try {
    const output = join(dir, "feed.json");
    const routePath = join(dir, "routes.json");
    const requests = join(dir, "requests.jsonl");
    const originalBytes = `${JSON.stringify(seed, null, 2)}\n`;
    await writeFile(output, originalBytes);
    await writeFile(routePath, JSON.stringify(addTaxonomyRoutes(routes, seed)));
    await writeFile(requests, "");
    const processResult = spawnSync(process.execPath, [
      `--import=data:text/javascript,${encodeURIComponent(networkMock)}`,
      fileURLToPath(new URL("../scripts/update-feed.mjs", import.meta.url)),
    ], { encoding:"utf8", timeout:20_000, maxBuffer:2_000_000,
      env:{ OUTPUT_PATH:output, QA_ROUTES:routePath, QA_REQUESTS:requests,
        AESAN_PAGES:"4", AESAN_FULL_HISTORY:full ? "1" : "0", AESAN_MAX_ARCHIVE_PAGES:"400" } });
    const bytes = await readFile(output, "utf8");
    const called = (await readFile(requests, "utf8")).trim().split("\n").filter(Boolean).map((row) => JSON.parse(row).url);
    return { ...processResult, bytes, originalBytes, feed:JSON.parse(bytes), called };
  } finally { await rm(dir, { recursive:true, force:true }); }
}
const recentRoutes = (cards) => ({
  "/alertas/buscador-alertas":listHtml(cards),
  "/alertas/buscador-alertas/2":listHtml(cards),
  "/alertas/buscador-alertas/3":listHtml(cards),
  "/alertas/buscador-alertas/4":listHtml(cards),
  "/alertas/alertas-alimentarias":listHtml(cards, null, true),
  [new URL(earlier.url).pathname]:htmlFor(earlier),
  [new URL(later.url).pathname]:htmlFor(later),
});

test("real recent CLI: duplicated older pages cannot roll back the preserved amplification", async () => {
  const seed = JSON.parse(await readFile(new URL("../feed.json", import.meta.url), "utf8"));
  seed.alerts = seed.alerts.filter((record) => record.reference !== later.reference).concat([later]);
  const result = await cliRun(seed, recentRoutes(Array(20).fill(earlier)));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.feed.alerts.length, seed.alerts.length);
  assert.deepEqual(materialState(result.feed.alerts.find((r) => r.reference === later.reference)), materialState(later));
  assert.equal(result.called.filter((url) => new URL(url).pathname === "/alertas/2026_26").length, 1);
  const replay = await cliRun(result.feed, recentRoutes(Array(20).fill(earlier)));
  assert.equal(replay.status, 0, replay.stderr);
  assert.equal(replay.bytes, result.bytes);
});

test("real recent CLI: a distinct last-window-page publication survives duplicates and is fetched once", async () => {
  const routes = recentRoutes(Array(20).fill(earlier));
  routes["/alertas/buscador-alertas/4"] = listHtml([earlier, later, later]);
  const result = await cliRun({ schemaVersion:1, alerts:[] }, routes);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.feed.alerts.length, 1);
  assert.equal(result.feed.alerts[0].url, later.url);
  assert.equal(result.feed.alerts[0].publicationHistory.length, 2);
  assert.equal(result.called.filter((url) => new URL(url).pathname === "/alertas/2026_26_amp").length, 1);
});

test("real full CLI: scans the declared paginator and retains both publication sources without duplicate alerts", async () => {
  const routes = {
    ...recentRoutes([earlier]),
    "/alertas/buscador-alertas":listHtml(Array(20).fill(earlier), 2),
    "/alertas/buscador-alertas/2":listHtml(Array(20).fill(later)),
  };
  const result = await cliRun({ schemaVersion:1, alerts:[] }, routes, true);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.feed.archive.pagesScanned, 2);
  assert.equal(result.feed.alerts.length, 1);
  assert.equal(result.feed.alerts[0].url, later.url);
  assert.equal(result.feed.alerts[0].publicationHistory.length, 2);
  assert.equal(result.called.filter((url) => new URL(url).pathname === "/alertas/2026_26").length, 1);
  assert.equal(result.called.filter((url) => new URL(url).pathname === "/alertas/2026_26_amp").length, 1);
});

test("real CLI: ambiguous chronology fails before writing OUTPUT_PATH", async () => {
  const ambiguous = { ...earlier, publishedAt:later.publishedAt, officialDates:later.officialDates };
  const routes = recentRoutes([ambiguous, later]);
  routes["/alertas/2026_26"] = htmlFor(ambiguous);
  const seed = { schemaVersion:1, alerts:[later], generatedAt:first };
  const result = await cliRun(seed, routes);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AESAN_PUBLICATION_ORDER_UNPROVEN/u);
  assert.equal(result.bytes, result.originalBytes);
});


test("whole-archive differential: reconstructed responses preserve the baseline parser current fields", async () => {
  const feed = JSON.parse(await readFile(new URL("../feed.json", import.meta.url), "utf8"));
  const observations = feed.alerts.map((record) => observed(record));
  const expected = observations.map(({ card, html }) => {
    const identity = sourceIdentityForHtml(html, card.url);
    const raw = parseDetail(html, card, null, first, identity);
    return parseDetail(html, card, previousForCard(feed.alerts, raw, identity), first, identity);
  });
  const actual = reconcilePublicationBatch(feed.alerts, observations, first);
  assert.equal(actual.length, expected.length);
  const withoutLedger = ({ publicationHistory:_history, publicationSelection:_selection, ...record }) => record;
  assert.deepEqual(actual.map(withoutLedger), expected.map(withoutLedger));
});

test("real CLI: incomplete landing card hydration reuses the same fetched detail", async () => {
  const routes = recentRoutes([earlier]);
  routes["/alertas/alertas-alimentarias"] = `<html><body><a class="seeMoreCardSlide" href="${earlier.url}" title="Ver alerta">Ver alerta</a></body></html>`;
  const result = await cliRun({ schemaVersion:1, alerts:[] }, routes);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.called.filter((url) => new URL(url).pathname === "/alertas/2026_26").length, 1);
  assert.equal(result.feed.alerts[0].reference, earlier.reference);
});
