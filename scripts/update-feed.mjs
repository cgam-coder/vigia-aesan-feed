import { readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { resolve } from "node:path";
import {
  AESAN_LIST_URL,
  assembleFeed,
  cardFallback,
  parseDetail,
  parseListCards,
  previousForCard,
} from "./aesan.mjs";

const OUTPUT_PATH = resolve(process.env.OUTPUT_PATH || "feed.json");
const PAGE_COUNT = Math.max(1, Math.min(10, Number(process.env.AESAN_PAGES || 4)));
const USER_AGENT = "VIGIA-AESAN-Feed/1.0 (+https://github.com/cgam-coder/vigia-aesan-feed)";
const TLS_CERTIFICATE_ERRORS = new Set([
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

const wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));

const requestHtml = (value, allowInvalidCertificate = false, redirects = 0) => new Promise((resolveRequest, rejectRequest) => {
  const url = new URL(value);
  const client = url.protocol === "https:" ? https : http;
  const request = client.get(url, {
    family:4,
    headers:{ Accept:"text/html,application/xhtml+xml", "Accept-Encoding":"identity", "Accept-Language":"es-ES,es;q=0.9", "User-Agent":USER_AGENT },
    rejectUnauthorized:!allowInvalidCertificate,
    timeout:35_000,
  }, (response) => {
    if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      response.resume();
      if (redirects >= 5) return rejectRequest(new Error("Demasiadas redirecciones"));
      return resolveRequest(requestHtml(new URL(response.headers.location, url).toString(), allowInvalidCertificate, redirects + 1));
    }
    if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
      response.resume();
      return rejectRequest(new Error(`HTTP ${response.statusCode ?? "desconocido"}`));
    }
    const chunks = [];
    let size = 0;
    response.on("data", (chunk) => {
      size += chunk.length;
      if (size > 5_000_000) request.destroy(new Error("Respuesta HTML demasiado grande"));
      else chunks.push(chunk);
    });
    response.on("end", () => resolveRequest(Buffer.concat(chunks).toString("utf8")));
  });
  request.on("timeout", () => request.destroy(new Error("Tiempo de espera agotado")));
  request.on("error", rejectRequest);
});

async function fetchHtml(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      let html;
      try {
        html = await requestHtml(url);
      } catch (error) {
        if (!TLS_CERTIFICATE_ERRORS.has(error?.code)) throw error;
        console.warn(`AESAN presenta una cadena TLS no verificable (${error.code}); se reintenta únicamente contra el mismo dominio oficial.`);
        html = await requestHtml(url, true);
      }
      if (!/<html|<!doctype/i.test(html)) throw new Error("La respuesta no contiene HTML");
      return html;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 1_500);
    }
  }
  const detail = lastError instanceof Error ? `${lastError.code ? `${lastError.code}: ` : ""}${lastError.message}` : "error desconocido";
  throw new Error(`No se pudo consultar ${url}: ${detail}`);
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length:Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function readCurrentFeed() {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
  } catch {
    return { schemaVersion:1, source:{ name:"AESAN", url:AESAN_LIST_URL }, generatedAt:null, alerts:[] };
  }
}

async function main() {
  const now = new Date().toISOString();
  const current = await readCurrentFeed();
  const listUrls = Array.from({ length:PAGE_COUNT }, (_, index) => index === 0 ? AESAN_LIST_URL : `${AESAN_LIST_URL}/${index + 1}`);
  const pages = await mapLimit(listUrls, 2, fetchHtml);
  const cardsByUrl = new Map(pages.flatMap(parseListCards).map((card) => [card.url, card]));
  const cards = [...cardsByUrl.values()];
  if (!cards.length) throw new Error("AESAN respondió, pero no se identificaron fichas de alerta en el buscador oficial");

  let detailFailures = 0;
  const alerts = await mapLimit(cards, 3, async (card) => {
    const previous = previousForCard(current.alerts ?? [], card);
    try {
      return parseDetail(await fetchHtml(card.url), card, previous, now);
    } catch (error) {
      detailFailures += 1;
      console.warn(`Ficha no disponible ${card.url}: ${error instanceof Error ? error.message : "error desconocido"}`);
      return cardFallback(card, previous, now);
    }
  });

  const feed = assembleFeed(current, alerts, now);
  await writeFile(OUTPUT_PATH, `${JSON.stringify(feed, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ source:AESAN_LIST_URL, pages:PAGE_COUNT, cards:cards.length, alerts:feed.alerts.length, detailFailures, generatedAt:feed.generatedAt }));
}

await main();
