import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { assembleFeed, parseDetail, previousForCard, sourceIdentityForHtml } from "../scripts/aesan.mjs";
import {
  comparePublications, publicationCards, publicationDateEvidence, reconcilePublicationBatch,
} from "../scripts/aesan-publications.mjs";

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

// Exact normalized material from the captured official pages; htmlFor creates
// TEST HTML, not a claimed archive of the original HTTP response.
const parallel085 = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/aesan-parallel-085.json.gz', import.meta.url))).toString('utf8'));
const brava085 = parallel085.previous;
const sulfitos085 = parallel085.secondary;
const co085 = (prev = [parallel085.previous], pubs = [brava085, sulfitos085], at = first) => run(prev, pubs, at)[0];
for (const page of [brava085, sulfitos085]) {
  test(`reviewed ES2026/085 ${page.url}: reconstructed fixture has the exact official material hash`, () => {
    const actual = parseDetail(htmlFor(page), page, null, first);
    assert.equal(actual.sourceRecordHash, page.sourceRecordHash);
    assert.deepEqual(actual.publishedFields, page.publishedFields);
    assert.deepEqual(actual.officialDates, page.officialDates);
  });
}
test('reviewed co-publications retain both materials without asserting chronological superiority', () => {
  assert.equal(comparePublications(brava085, sulfitos085), null);
  const current = co085();
  assert.deepEqual(materialState(current), materialState(parallel085.previous));
  assert.equal(current.publicationSelection.status, 'parallel_publications');
  assert.equal(current.publicationSelection.chronological, false);
  assert.equal(current.publicationHistory.length, 2);
  for (const source of [brava085, sulfitos085]) {
    const actual=current.publicationHistory.find((p) => p.sourceRecordId===source.sourceRecordId);
    assert.deepEqual(actual.publishedFields, source.publishedFields);
    assert.deepEqual(actual.materialParagraphs, source.materialParagraphs);
    assert.deepEqual(actual.officialDates, source.officialDates);
  }
  assert.match(JSON.stringify(current.publicationHistory), /sulfitos/u);
  assert.match(JSON.stringify(current.publicationHistory), /SALSA BRAVA/u);
});
test('co-publication order and repeated cards do not change the primary or version count', () => {
  assert.deepEqual(co085(), co085([parallel085.previous], [sulfitos085, brava085, sulfitos085]));
  assert.equal(co085().versionCount, parallel085.previous.versionCount);
});
test('partial replays retain the verified companion, annotation and complete material', () => {
  const baseline=co085(); let current=baseline;
  for(const pubs of [[brava085],[sulfitos085],[brava085,sulfitos085],[sulfitos085,brava085]]) {
    current=co085([current],pubs,second);
    assert.deepEqual(current,baseline);
  }
});
test('both reviewed pages without prior state use the documented presentation anchor, not a latest claim', () => {
  const a=co085([], [brava085,sulfitos085]);const b=co085([], [sulfitos085,brava085]);
  assert.deepEqual(a,b);assert.equal(a.url,brava085.url);assert.equal(a.versionCount,1);
  assert.equal(a.publicationSelection.chronological,false);
});
test('reviewed parallel material cannot silently repoint an existing primary identity', () => {
  assert.throws(() => co085([sulfitos085]), /PARALLEL_ANCHOR_CONFLICT/u);
});
test('unknown same-reference original pages at the same time remain blocking', () => {
  const other={...sulfitos085,sourceRecordId:'a597e99a-50f8-4b01-8dc4-a250b7c58d62'};
  assert.throws(() => co085([parallel085.previous],[brava085,other]), /PARALLEL_PUBLICATION_REVIEW_REQUIRED/u);
});
test('the reviewed identity cannot be moved to another path', () => {
  const other={...sulfitos085,url:'https://www.aesan.gob.es/alertas/unreviewed-page'};
  assert.throws(() => co085([parallel085.previous],[brava085,other]), /PARALLEL_PUBLICATION_REVIEW_REQUIRED/u);
});
test('an extra unreviewed publication is not swallowed by the parallel policy', () => {
  const extra={...sulfitos085,url:'https://www.aesan.gob.es/alertas/extra',sourceRecordId:'a597e99a-50f8-4b01-8dc4-a250b7c58d62'};
  assert.throws(() => co085([parallel085.previous],[brava085,sulfitos085,extra]), /PARALLEL_PUBLICATION_REVIEW_REQUIRED/u);
});
test('a newly declared amendment cannot inherit the reviewed original-publication exception', () => {
  const current=co085();const revised=clone(sulfitos085);
  revised.officialTitle=revised.title='Ampliación: '+revised.officialTitle;
  assert.throws(() => co085([current],[brava085,revised]), /PARALLEL_PUBLICATION_REVIEW_REQUIRED/u);
});
test('removing exact time evidence cannot establish a reviewed concurrent pair', () => {
  const revised={...sulfitos085,officialDates:sulfitos085.officialDates.slice(0,1)};
  assert.throws(() => co085([parallel085.previous],[brava085,revised]), /PARALLEL_PUBLICATION_REVIEW_REQUIRED/u);
});
test('an invalid parallel annotation cannot be silently dropped or fixed from arrival order', () => {
  for(const corrupt of [
    (x)=>{x.publicationSelection.chronological=true;},
    (x)=>{x.publicationSelection.members[1]=clone(x.publicationSelection.members[0]);},
    (x)=>{x.publicationSelection.members[1].sourceRecordHash='0'.repeat(64);},
    (x)=>{x.publicationHistory[1].publishedFields[0].value='alterado';},
  ]){const current=co085();corrupt(current);assert.throws(()=>co085([current],[brava085]),/INVALID_PUBLICATION_SELECTION|INVALID_PUBLICATION_HISTORY/u);}
});
test('co-publication enrichment is byte-stable on feed replay without manufacturing semantic versions', () => {
  const current=co085();const before=assembleFeed({alerts:[]},[current],first);
  const after=assembleFeed(before,[co085(before.alerts,[brava085],second)],second);
  assert.deepEqual(after,before);
});
test('a later date on a member of the reviewed pair cannot silently imply replacement', () => {
  const changed=clone(sulfitos085);changed.publishedAt='2026-02-20T23:00:00.000Z';
  changed.officialDates=[{label:null,value:'21/02/2026',sourceField:'pageInfo.date',order:0},
    {label:'Fecha y hora',value:'21/02/2026 14:30',sourceField:'article.date[1]',order:1}];
  assert.throws(()=>co085([parallel085.previous],[brava085,changed]),/PARALLEL_PUBLICATION_REVIEW_REQUIRED/u);
});
test('a legitimate sibling-page correction is preserved once without inventing primary changes', () => {
  const previous=co085();const changed=clone(sulfitos085);
  changed.materialParagraphs[0].value+=' Rectificación material de prueba.';
  const current=co085([previous],[changed],second);
  assert.deepEqual(materialState(current),materialState(previous));
  assert.equal(current.publicationHistory.length,3);
  assert.notEqual(current.publicationSelection.members[1].sourceRecordHash,previous.publicationSelection.members[1].sourceRecordHash);
  assert.deepEqual(co085([current],[changed],third),current);
});
