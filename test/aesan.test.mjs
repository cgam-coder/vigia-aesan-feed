import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assembleFeed,
  consolidateListCards,
  extractMaterialParagraphs,
  extractOfficialDates,
  extractOfficialResources,
  extractPublishedFields,
  isOfficialAesanAlertUrl,
  notifyingTextFor,
  parseDetail,
  parseLegacyListCards,
  parseListCards,
  previousForCard,
  productClassFor,
  sourceIdentityForHtml,
  stripHtml,
} from "../scripts/aesan.mjs";

const listing = `
<html><body><div class="aesan-section__row">
  <a class="seeMoreCard seeMoreCard--m" href="/alertas/2026_62" title="Advertencia para personas con alergia a la leche: leche no declarada en fideos procedentes de España (Ref ES2026/485)">
    <div class="seeMoreCard-heading"><div class="seeMoreCard-heading__icon">cookie</div><span class="seeMoreCard-heading__value">10 Agosto 2026</span></div>
    <p class="seeMoreCard__text">Advertencia para personas con alergia a la leche</p>
  </a>
  <a class="seeMoreCard seeMoreCard--m" href="/alertas/2026_62" title="Advertencia para personas con alergia a la leche: leche no declarada en fideos procedentes de España (Ref ES2026/485)">
    <span class="seeMoreCard-heading__value">10 Agosto 2026</span>
  </a>
</div></body></html>`;

const detail = `
<html><head><meta name="content-date" content="2026-08-09T22:00:00Z"></head><body>
  <h1 class="aesan-title aesan-title--lg">Advertencia para personas con alergia a la leche: leche no declarada en fideos procedentes de España (Ref ES2026/485)</h1>
  <p>Los datos del producto implicado son:</p>
  <ul>
    <li><p>Nombre del producto: Kit Ramen Curry</p></li>
    <li><p>Marca: Kania</p></li>
    <li><p>Distribuidor: Alimentación Ejemplo, S.L.</p></li>
    <li><p>Número de lote: L2401; L2402</p></li>
  </ul>
  <figure><img src="/dam/jcr:abc/producto.png"></figure>
  <p>Según la información disponible, la distribución inicial ha sido a Galicia, si bien no es descartable que exista distribución a otras comunidades autónomas.</p>
  <p>Como medida de precaución, se recomienda a las personas con alergia a la leche que se abstengan de consumirlo.</p>
  <a href="/alertas/buscador-alertas">Volver</a>
</body></html>`;

test("deduplica las fichas del buscador oficial", () => {
  const cards = parseListCards(listing);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].reference, "ES2026/485");
  assert.equal(cards[0].url, "https://www.aesan.gob.es/alertas/2026_62");
  assert.equal(cards[0].publishedAt, "2026-08-10T12:00:00.000Z");
});

test("normaliza los campos de una ficha oficial", () => {
  const card = parseListCards(listing)[0];
  const alert = parseDetail(detail, card, null, "2026-08-14T10:00:00.000Z");
  assert.equal(alert.reference, "ES2026/485");
  assert.equal(alert.product, "Kit Ramen Curry");
  assert.equal(alert.brand, "Kania");
  assert.equal(alert.provider, "Alimentación Ejemplo, S.L");
  assert.equal(alert.providerRole, "Distribuidor");
  assert.equal(alert.providerKey, "alimentacion ejemplo");
  assert.equal(alert.notifyingText, "");
  assert.match(alert.providerEvidence, /campo oficial/i);
  assert.equal(alert.productClass, "Platos preparados y sopas");
  assert.deepEqual(alert.lots, ["L2401", "L2402"]);
  assert.equal(alert.hazard, "Leche no declarada");
  assert.equal(alert.origin, "España");
  assert.equal(alert.imageUrl, "https://www.aesan.gob.es/dam/jcr:abc/producto.png");
  assert.match(alert.scope, /distribución inicial/i);
  assert.match(alert.action, /se recomienda/i);
  assert.equal(alert.url, "https://www.aesan.gob.es/alertas/2026_62");
});

test("conserva título, puntuación, mayúsculas, etiquetas y valores oficiales exactos", () => {
  const html = `<html><head><meta name="content-date" content="2026-09-08T22:00:00Z"></head><body>
    <h1 class="aesan-title">Alerta EXACTA: texto fuente. (Ref. ES2026/543)</h1>
    <div class="post-container aesan-bgText"><p>Resumen duplicado que no pertenece al cuerpo.</p></div>
    <div class="post-container">
      <p>Primer párrafo oficial, con puntuación EXACTA.</p>
      <p>Los datos del producto implicado son:</p>
      <ul><li>Nombre del producto: Melatonin Time Release</li><li>Codigo de barras: <i>858047007021</i></li><li>Teperatura: Ambiente</li><li>Campo futuro legítimo: Valor; con punto.</li></ul>
      <p>Segundo párrafo oficial.</p>
      <figure><img alt="Producto alertado" src="/dam/jcr:abc/producto.png"></figure>
      <p><a href="/dam/jcr:def/ficha.pdf">Ficha técnica oficial</a></p>
      <a href="https://third-party.example/documento.pdf">Enlace externo</a>
    </div><a href="/alertas/buscador-alertas">Volver</a></body></html>`;
  const parsed = parseDetail(html, { ...parseListCards(listing)[0], title:"Título de listado", reference:"ES2026/543", url:"https://www.aesan.gob.es/alertas/2026_67" }, null, "2026-09-10T10:00:00.000Z");
  assert.equal(parsed.officialTitle, "Alerta EXACTA: texto fuente. (Ref. ES2026/543)");
  assert.deepEqual(parsed.publishedFields.map(({ label, value }) => ({ label, value })), [
    { label:"Nombre del producto", value:"Melatonin Time Release" },
    { label:"Codigo de barras", value:"858047007021" },
    { label:"Teperatura", value:"Ambiente" },
    { label:"Campo futuro legítimo", value:"Valor; con punto." },
  ]);
  assert.deepEqual(parsed.materialParagraphs.map(({ value }) => value), [
    "Primer párrafo oficial, con puntuación EXACTA.", "Segundo párrafo oficial.",
  ]);
  assert.deepEqual(parsed.resources.map(({ kind, label }) => ({ kind, label })), [
    { kind:"image", label:"Producto alertado" }, { kind:"document", label:"Ficha técnica oficial" },
  ]);
  assert.equal(parsed.sourceRecordSchemaVersion, 2);
  assert.match(parsed.sourceRecordHash, /^[0-9a-f]{64}$/u);
});

test("la extracción material preserva orden, grupos, fechas y solo recursos AESAN", () => {
  const article = `<h1 class="aesan-title">Título</h1><div class="pageInfo__date"><span>calendar_today</span><span>09/09/2026</span></div>
    <div class="post-container"><p>Fecha y hora: 09/09/2026 10:30</p><p>Párrafo uno.</p>
    <ul><li>EAN: 123</li></ul><p>Párrafo dos.<br>CONTINÚA EXACTO.</p><ul><li>Tipo de envase: Caja</li></ul>
    <img src="/dam/jcr:image/uno.jpg"><img src="https://www.aesan.gob.es/dam/jcr:image/dos.jpg">
    <a href="/informacion/material">Material AESAN</a><a href="https://evil.example/a">Ruido</a></div>`;
  assert.deepEqual(extractPublishedFields(article).map(({ label, value, context }) => ({ label, value, context })), [
    { label:"EAN", value:"123", context:"list:0" }, { label:"Tipo de envase", value:"Caja", context:"list:1" },
  ]);
  assert.deepEqual(extractMaterialParagraphs(article).map(({ value }) => value), ["Párrafo uno.", "Párrafo dos.\nCONTINÚA EXACTO."]);
  assert.deepEqual(extractOfficialDates("", article).map(({ label, value }) => ({ label, value })), [
    { label:null, value:"09/09/2026" }, { label:"Fecha y hora", value:"09/09/2026 10:30" },
  ]);
  assert.deepEqual(extractOfficialResources(article, "https://www.aesan.gob.es/alertas/2026_67").map(({ kind, label }) => ({ kind, label })), [
    { kind:"image", label:null }, { kind:"image", label:null }, { kind:"link", label:"Material AESAN" },
  ]);
});

test("el primer baseline enriquecido no fabrica una actualización oficial", () => {
  const card = parseListCards(listing)[0];
  const legacy = parseDetail(detail, card, null, "2026-08-14T10:00:00.000Z");
  const previous = { ...legacy };
  delete previous.sourceRecordHash;
  delete previous.sourceRecordSchemaVersion;
  delete previous.officialTitle;
  delete previous.publishedFields;
  delete previous.materialParagraphs;
  delete previous.resources;
  delete previous.officialDates;
  const replay = parseDetail(detail, card, previous, "2026-08-15T10:00:00.000Z");
  assert.equal(replay.contentHash, previous.contentHash);
  assert.equal(replay.versionCount, previous.versionCount);
  assert.equal(replay.updatedAt, previous.updatedAt);
  assert.equal(replay.detectedAt, previous.detectedAt);
  assert.equal(replay.sourceRecordSchemaVersion, 2);
});

const notifyingFixture = async (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("conserva literalmente una frase notificante oficial inequívoca", async () => {
  const html = await notifyingFixture("aesan-notifying-positive.html");
  const text = notifyingTextFor(stripHtml(html));
  assert.match(text, /notificación de alerta trasladada por las autoridades sanitarias de Galicia/i);
  assert.match(text, /SCIRI/);
});

test("no convierte distribución autonómica en evidencia notificante", async () => {
  const html = await notifyingFixture("aesan-notifying-distribution-only.html");
  assert.equal(notifyingTextFor(stripHtml(html)), "");
});

test("no convierte el traslado nacional genérico en una CCAA notificante", async () => {
  const html = await notifyingFixture("aesan-notifying-generic-transfer.html");
  assert.equal(notifyingTextFor(stripHtml(html)), "");
});

test("separa la frase notificante de las menciones territoriales de distribución", async () => {
  const html = await notifyingFixture("aesan-notifying-multiple-territories.html");
  const text = notifyingTextFor(stripHtml(html));
  assert.match(text, /Comunidad Autónoma de Cantabria/);
  assert.doesNotMatch(text, /Islas Baleares|Comunidad Valenciana|Cataluña|Castilla-La Mancha|Andalucía|Madrid/);
});

test("conserva el wording de ampliación cuando una comunidad informa a AESAN", async () => {
  const html = await notifyingFixture("aesan-notifying-community-update.html");
  const text = notifyingTextFor(stripHtml(html));
  assert.match(text, /comunidad autónoma de Castilla y León ha informado a la Agencia Española/i);
});

test("no presenta un notificante extranjero RASFF como CCAA notificante", async () => {
  const html = await notifyingFixture("aesan-notifying-rasff.html");
  assert.equal(notifyingTextFor(stripHtml(html)), "");
});

test("no acepta como CCAA una autoridad nacional aunque el texto mencione SCIRI", () => {
  assert.equal(notifyingTextFor("La Agencia Española de Seguridad Alimentaria y Nutrición ha sido informada por el Ministerio de Sanidad, a través del Sistema Coordinado de Intercambio Rápido de Información (SCIRI), de una incidencia."), "");
});

test("admite variantes territoriales verificadas aunque AESAN use plural o una elipsis", () => {
  const variants = [
    "Como ampliación de la información transmitida, las autoridades sanitarias de la Comunidad Valenciana han informado a la Agencia Española de Seguridad Alimentaria y Nutrición a través del Sistema Coordinado de Intercambio Rápido de Información (SCIRI) de nuevos lotes.",
    "La Agencia Española de Seguridad Alimentaria y Nutrición ha tenido conocimiento, a través del Sistema Coordinado de Intercambio Rápido de Información (SCIRI), de una notificación de alerta trasladada por las autoridades sanitarias Cataluña, relativa a una incidencia.",
  ];
  for (const variant of variants) assert.equal(notifyingTextFor(variant), variant);
});

test("falla cerrado cuando no existe una frase territorial notificante", async () => {
  const html = await notifyingFixture("aesan-notifying-none.html");
  assert.equal(notifyingTextFor(stripHtml(html)), "");
});

test("el campo notificante derivado no amplifica versiones ni cambia el hash", async () => {
  const html = await notifyingFixture("aesan-notifying-positive.html");
  const card = { url:"https://www.aesan.gob.es/alertas/2026_99", title:"Alerta alimentaria (Ref. ES2026/485)", reference:"ES2026/485", publishedAt:"2026-08-10T12:00:00.000Z" };
  const first = parseDetail(html, card, null, "2026-08-14T10:00:00.000Z");
  const previousWithoutField = { ...first };
  delete previousWithoutField.notifyingText;
  const second = parseDetail(html, card, previousWithoutField, "2026-08-15T10:00:00.000Z");
  assert.equal(second.notifyingText, first.notifyingText);
  assert.equal(second.contentHash, first.contentHash);
  assert.equal(second.versionCount, 1);
  assert.equal(second.updatedAt, first.updatedAt);
});

test("no cambia generatedAt cuando el contenido permanece idéntico", () => {
  const card = parseListCards(listing)[0];
  const alert = parseDetail(detail, card, null, "2026-08-14T10:00:00.000Z");
  const first = assembleFeed({ alerts:[] }, [alert], "2026-08-14T10:00:00.000Z");
  const second = assembleFeed(first, [alert], "2026-08-14T10:15:00.000Z");
  assert.equal(second.generatedAt, first.generatedAt);
});

test("un replay full-history sin cambios conserva el feed completo", () => {
  const current = assembleFeed({ alerts:[] }, [], "2026-09-10T10:00:00.000Z", {
    fullSync:true, pagesScanned:9, legacyIndexesScanned:0,
  });
  const replay = assembleFeed(current, [], "2026-09-10T10:15:00.000Z", {
    fullSync:true, pagesScanned:9, legacyIndexesScanned:0,
  });
  assert.deepEqual(replay, current);
});

test("no mezcla dos páginas simultáneas bajo una identidad de fallback", () => {
  const card = parseListCards(listing)[0];
  const original = parseDetail(detail, card, null, "2026-08-14T10:00:00.000Z");
  const update = {
    ...original,
    url:"https://www.aesan.gob.es/alertas/2026_62_ampliacion_1",
    publishedAt:"2026-08-12T22:00:00.000Z",
    isUpdate:true,
    contentHash:"updated-content",
  };
  assert.throws(() => assembleFeed({ alerts:[] }, [original, update], "2026-08-14T10:00:00.000Z"),
    /presente en varias páginas/i);
});

test("elige una sola ficha, la más reciente, antes de normalizar una referencia", () => {
  const original = { url:"https://www.aesan.gob.es/alertas/2026_62", reference:"ES2026/485", publishedAt:"2026-08-10T12:00:00.000Z" };
  const update = { url:"https://www.aesan.gob.es/alertas/2026_62_ampliacion_1", reference:"ES2026/485", publishedAt:"2026-08-12T12:00:00.000Z" };
  assert.deepEqual(consolidateListCards([original, update]), [update]);
});

test("prefiere una ampliación cuando dos fichas comparten referencia y fecha", () => {
  const original = { url:"https://www.aesan.gob.es/alertas/2026_62", title:"Alerta", reference:"ES2026/485", publishedAt:"2026-08-10T12:00:00.000Z" };
  const update = { url:"https://www.aesan.gob.es/alertas/2026_62_ampliacion_1", title:"Ampliación de alerta", reference:"ES2026/485", publishedAt:"2026-08-10T12:00:00.000Z" };
  assert.deepEqual(consolidateListCards([original, update]), [update]);
});

test("una sincronización reciente conserva la cobertura de la última sincronización integral", () => {
  const current = {
    alerts:[],
    archive:{ pagesScanned:58, legacyIndexesScanned:3, lastFullSyncAt:"2026-08-14T11:39:41.462Z" },
  };
  const feed = assembleFeed(current, [], "2026-08-21T06:00:00.000Z", { fullSync:false, pagesScanned:4, legacyIndexesScanned:0 });
  assert.equal(feed.archive.pagesScanned, 58);
  assert.equal(feed.archive.legacyIndexesScanned, 3);
  assert.equal(feed.archive.lastFullSyncAt, current.archive.lastFullSyncAt);
});

test("acepta fichas históricas oficiales y rechaza redes sociales", () => {
  assert.equal(isOfficialAesanAlertUrl("https://www.aesan.gob.es/alertas/2026_62"), true);
  assert.equal(isOfficialAesanAlertUrl("https://www.aesan.gob.es/AECOSAN/web/seguridad_alimentaria/ampliacion/2024_8.htm"), true);
  assert.equal(isOfficialAesanAlertUrl("https://bsky.app/profile/aesan.gob.es/post/example"), false);
});

test("extrae fichas desde el índice histórico heredado", () => {
  const cards = parseLegacyListCards(`
    <a href="/AECOSAN/web/seguridad_alimentaria/alertas_alimentarias/listado/aecosan_listado_alertas_alimentarias.htm">Listado</a>
    <a href="/AECOSAN/web/seguridad_alimentaria/alertas_alimentarias/2025_07.htm" title="Advertencia por alérgenos (Ref. ES2025/041)">Ver alerta</a>
    <a href="/AECOSAN/web/seguridad_alimentaria/ampliacion/INF2021_0056.htm">Ampliación de alerta</a>
  `);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].reference, "ES2025/041");
  assert.equal(cards[1].url, "https://www.aesan.gob.es/AECOSAN/web/seguridad_alimentaria/ampliacion/INF2021_0056.htm");
});

test("clasifica productos sin confundir la categoría de riesgo", () => {
  assert.equal(productClassFor("Salchichón cular extra", ""), "Carne y productos cárnicos");
  assert.equal(productClassFor("Bacalao en aceite", ""), "Pescado y marisco");
  assert.equal(productClassFor("Kit Ramen Curry", ""), "Platos preparados y sopas");
});

test("conserva más de sesenta alertas en el archivo", () => {
  const alerts = Array.from({ length:75 }, (_, index) => ({
    id:`aesan:ES2025/${index}`,
    reference:`ES2025/${index}`,
    sourceRecordId:`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    sourceRecordIdType:"idAlert",
    source:"AESAN",
    url:`https://www.aesan.gob.es/alertas/2025_${index}`,
    publishedAt:new Date(Date.UTC(2025, 0, index + 1)).toISOString(),
    detectedAt:"2026-08-14T10:00:00.000Z",
    versionCount:1,
    isUpdate:false,
  }));
  const feed = assembleFeed({ alerts:[] }, alerts, "2026-08-14T10:00:00.000Z", { fullSync:true, pagesScanned:25 });
  assert.equal(feed.alerts.length, 75);
  assert.equal(feed.archive.totalAlerts, 75);
  assert.equal(feed.archive.pagesScanned, 25);
});

const correctedIdentity = "60ab5444-518c-4084-b2aa-e00541270e58";
const correctionCard = (reference) => ({
  url:"https://www.aesan.gob.es/alertas/2026_67",
  title:`Alerta por melatonina (Ref. ${reference})`,
  reference,
  publishedAt:"2026-09-08T22:00:00.000Z",
  category:"supplements",
});
const correctionHtml = (reference, idAlert = correctedIdentity) => `<html><head>
  ${idAlert === null ? "" : `<meta name="idAlert" content="${idAlert}">`}
  <meta name="content-date" content="2026-09-08T22:00:00.000Z">
  </head><body><h1 class="aesan-title">Alerta por melatonina (Ref. ${reference})</h1>
  <p>Contenido oficial material estable.</p><a href="/alertas/buscador-alertas">Volver</a></body></html>`;

test("la corrección 243 a 543 conserva una entidad, el ID interno y dos estados semánticos", () => {
  const firstIdentity = sourceIdentityForHtml(correctionHtml("ES2026/243"), correctionCard("ES2026/243").url);
  const first = parseDetail(correctionHtml("ES2026/243"), correctionCard("ES2026/243"), null,
    "2026-09-09T16:27:14.879Z", firstIdentity);
  const secondIdentity = sourceIdentityForHtml(correctionHtml("ES2026/543"), correctionCard("ES2026/543").url);
  const previous = previousForCard([first], correctionCard("ES2026/543"), secondIdentity);
  const second = parseDetail(correctionHtml("ES2026/543"), correctionCard("ES2026/543"), previous,
    "2026-09-10T10:39:37.314Z", secondIdentity);
  assert.equal(first.sourceRecordId, correctedIdentity);
  assert.equal(second.id, "aesan:ES2026/243");
  assert.equal(second.reference, "ES2026/543");
  assert.deepEqual(second.previousReferences, ["ES2026/243"]);
  assert.equal(second.referenceHistory.length, 1);
  assert.equal(second.referenceHistory[0].contentHash, first.contentHash);
  assert.equal(second.versionCount, 2);
  assert.equal(second.updatedAt, "2026-09-10T10:39:37.314Z");
  assert.equal(second.isUpdate, false);
  assert.notEqual(second.contentHash, first.contentHash);
  const feed = assembleFeed({ alerts:[first] }, [second], "2026-09-10T10:39:37.314Z");
  assert.equal(feed.alerts.length, 1);
});

test("repetir 543 no cambia hash, versión, updatedAt ni generatedAt", () => {
  const identity = sourceIdentityForHtml(correctionHtml("ES2026/543"), correctionCard("ES2026/543").url);
  const firstVersion = parseDetail(correctionHtml("ES2026/243"), correctionCard("ES2026/243"), null,
    "2026-09-09T16:27:14.879Z", identity);
  const current = parseDetail(correctionHtml("ES2026/543"), correctionCard("ES2026/543"), firstVersion,
    "2026-09-10T10:39:37.314Z", identity);
  const replayPrevious = previousForCard([current], correctionCard("ES2026/543"), identity);
  const replay = parseDetail(correctionHtml("ES2026/543"), correctionCard("ES2026/543"), replayPrevious,
    "2026-09-10T12:47:56.602Z", identity);
  assert.equal(replay.contentHash, current.contentHash);
  assert.equal(replay.versionCount, 2);
  assert.equal(replay.updatedAt, current.updatedAt);
  assert.deepEqual(replay.referenceHistory, current.referenceHistory);
  const firstFeed = assembleFeed({ alerts:[] }, [current], "2026-09-10T10:39:37.314Z");
  const replayFeed = assembleFeed(firstFeed, [replay], "2026-09-10T12:47:56.602Z");
  assert.equal(replayFeed.generatedAt, firstFeed.generatedAt);
});

test("colapsa de forma determinista el duplicado legado 243/543 sin una tercera versión", () => {
  const identity = sourceIdentityForHtml(correctionHtml("ES2026/543"), correctionCard("ES2026/543").url);
  const old = parseDetail(correctionHtml("ES2026/243"), correctionCard("ES2026/243"), null,
    "2026-09-09T16:27:14.879Z", identity);
  const corrected = {
    ...parseDetail(correctionHtml("ES2026/543"), correctionCard("ES2026/543"), old,
      "2026-09-10T10:39:37.314Z", identity),
    id:"aesan:ES2026/543",
  };
  const previous = previousForCard([old, corrected], correctionCard("ES2026/543"), identity);
  const replay = parseDetail(correctionHtml("ES2026/543"), correctionCard("ES2026/543"), previous,
    "2026-09-10T12:47:56.602Z", identity);
  const feed = assembleFeed({ alerts:[old, corrected] }, [replay], "2026-09-10T12:47:56.602Z");
  assert.equal(feed.alerts.length, 1);
  assert.equal(feed.alerts[0].id, old.id);
  assert.equal(feed.alerts[0].versionCount, 2);
  assert.equal(feed.alerts[0].referenceHistory.length, 1);
});

test("falla cerrado ante referencia compartida por UUID distintos o UUID compartido por páginas distintas", () => {
  const base = parseDetail(correctionHtml("ES2026/543"), correctionCard("ES2026/543"), null,
    "2026-09-10T10:39:37.314Z");
  assert.throws(() => assembleFeed({ alerts:[] }, [base, {
    ...base, id:"aesan:conflict", url:"https://www.aesan.gob.es/alertas/2026_98",
    sourceRecordId:"9ec7a359-320e-4d55-bfaa-daa4d4e6920d",
  }]), /referencia.+identidades distintas/i);
  assert.throws(() => assembleFeed({ alerts:[] }, [base, {
    ...base, id:"aesan:other-page", reference:"ES2026/999", url:"https://www.aesan.gob.es/alertas/2026_99",
  }]), /varias páginas/i);
});

test("usa fallback de ruta explícito y adopta después UUID sin duplicar el ID interno", () => {
  const fallbackHtml = correctionHtml("ES2026/243", null);
  const fallbackIdentity = sourceIdentityForHtml(fallbackHtml, correctionCard("ES2026/243").url);
  assert.deepEqual(fallbackIdentity, {
    sourceRecordId:"official_page_path:/alertas/2026_67",
    sourceRecordIdType:"official_page_path",
    officialPagePath:"/alertas/2026_67",
  });
  const fallback = parseDetail(fallbackHtml, correctionCard("ES2026/243"), null,
    "2026-09-09T16:27:14.879Z", fallbackIdentity);
  const uuidIdentity = sourceIdentityForHtml(correctionHtml("ES2026/243"), correctionCard("ES2026/243").url);
  const previous = previousForCard([fallback], correctionCard("ES2026/243"), uuidIdentity);
  const promoted = parseDetail(correctionHtml("ES2026/243"), correctionCard("ES2026/243"), previous,
    "2026-09-10T10:00:00.000Z", uuidIdentity);
  assert.equal(promoted.id, fallback.id);
  assert.equal(promoted.sourceRecordId, correctedIdentity);
  assert.equal(promoted.versionCount, 1);
});

test("el contrato candidato conserva unicidad completa de identidad, página, ID y referencia", () => {
  const identity = sourceIdentityForHtml(correctionHtml("ES2026/543"), correctionCard("ES2026/543").url);
  const first = parseDetail(correctionHtml("ES2026/243"), correctionCard("ES2026/243"), null,
    "2026-09-09T16:27:14.879Z", identity);
  const previous = previousForCard([first], correctionCard("ES2026/543"), identity);
  const corrected = parseDetail(correctionHtml("ES2026/543"), correctionCard("ES2026/543"), previous,
    "2026-09-10T10:39:37.314Z", identity);
  const unchanged = Array.from({ length:126 }, (_, index) => ({
    id:`aesan:fixture-${index}`,
    reference:`ES2025/${String(index).padStart(3, "0")}`,
    sourceRecordId:`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    sourceRecordIdType:"idAlert",
    source:"AESAN",
    title:`Publicación fixture ${index}`,
    url:`https://www.aesan.gob.es/alertas/2025_${index}`,
    publishedAt:"2025-01-01T00:00:00.000Z",
    detectedAt:"2025-01-01T00:00:00.000Z",
    updatedAt:"2025-01-01T00:00:00.000Z",
    contentHash:`fixture-${index}`,
    versionCount:1,
  }));
  const feed = assembleFeed({ alerts:[] }, [...unchanged, corrected], "2026-09-10T10:39:37.314Z");
  assert.equal(feed.alerts.length, 127);
  for (const field of ["id", "sourceRecordId", "url", "reference"]) {
    assert.equal(new Set(feed.alerts.map((alert) => alert[field])).size, feed.alerts.length, field);
  }
  const publication = feed.alerts.find((alert) => alert.url.endsWith("/alertas/2026_67"));
  assert.equal(publication.id, "aesan:ES2026/243");
  assert.equal(publication.reference, "ES2026/543");
  assert.equal(publication.sourceRecordId, correctedIdentity);
  assert.deepEqual(publication.previousReferences, ["ES2026/243"]);
  assert.equal(publication.referenceHistory.length, 1);
  assert.equal(publication.versionCount, 2);
});
