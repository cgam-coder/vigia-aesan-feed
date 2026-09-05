import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assembleFeed, consolidateListCards, isOfficialAesanAlertUrl, notifyingTextFor, parseDetail, parseLegacyListCards, parseListCards, productClassFor, stripHtml } from "../scripts/aesan.mjs";

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

test("consolida una ampliación y su ficha original bajo una referencia", () => {
  const card = parseListCards(listing)[0];
  const original = parseDetail(detail, card, null, "2026-08-14T10:00:00.000Z");
  const update = {
    ...original,
    url:"https://www.aesan.gob.es/alertas/2026_62_ampliacion_1",
    publishedAt:"2026-08-12T22:00:00.000Z",
    isUpdate:true,
    contentHash:"updated-content",
  };
  const feed = assembleFeed({ alerts:[] }, [original, update], "2026-08-14T10:00:00.000Z");
  assert.equal(feed.alerts.length, 1);
  assert.equal(feed.alerts[0].url, update.url);
  assert.equal(feed.alerts[0].versionCount, 2);
  assert.equal(feed.alerts[0].isUpdate, true);
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
    source:"AESAN",
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
