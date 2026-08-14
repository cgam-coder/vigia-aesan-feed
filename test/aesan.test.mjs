import test from "node:test";
import assert from "node:assert/strict";
import { assembleFeed, parseDetail, parseListCards } from "../scripts/aesan.mjs";

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
  assert.deepEqual(alert.lots, ["L2401", "L2402"]);
  assert.equal(alert.hazard, "Leche no declarada");
  assert.equal(alert.origin, "España");
  assert.equal(alert.imageUrl, "https://www.aesan.gob.es/dam/jcr:abc/producto.png");
  assert.match(alert.scope, /distribución inicial/i);
  assert.match(alert.action, /se recomienda/i);
  assert.equal(alert.url, "https://www.aesan.gob.es/alertas/2026_62");
});

test("no cambia generatedAt cuando el contenido permanece idéntico", () => {
  const card = parseListCards(listing)[0];
  const alert = parseDetail(detail, card, null, "2026-08-14T10:00:00.000Z");
  const first = assembleFeed({ alerts:[] }, [alert], "2026-08-14T10:00:00.000Z");
  const second = assembleFeed(first, [alert], "2026-08-14T10:15:00.000Z");
  assert.equal(second.generatedAt, first.generatedAt);
});
