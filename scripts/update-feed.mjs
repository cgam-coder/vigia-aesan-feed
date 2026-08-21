import { readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { resolve } from "node:path";
import {
  AESAN_LIST_URL,
  assembleFeed,
  cardFallback,
  consolidateListCards,
  parseDetail,
  parseListCards,
  previousForCard,
} from "./aesan.mjs";

const OUTPUT_PATH = resolve(process.env.OUTPUT_PATH || "feed.json");
const RECENT_PAGE_COUNT = Math.max(1, Math.min(20, Number(process.env.AESAN_PAGES || 4)));
const MAX_ARCHIVE_PAGES = Math.max(20, Math.min(600, Number(process.env.AESAN_MAX_ARCHIVE_PAGES || 400)));
const FULL_HISTORY = /^(?:1|true|yes)$/i.test(process.env.AESAN_FULL_HISTORY || "");
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
      const error = new Error(`HTTP ${response.statusCode ?? "desconocido"}`);
      error.statusCode = response.statusCode;
      return rejectRequest(error);
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
      if (error?.statusCode && error.statusCode < 500) break;
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

const archiveDateRange = () => {
  const now = new Date();
  const endDate = [String(now.getUTCDate()).padStart(2, "0"), String(now.getUTCMonth() + 1).padStart(2, "0"), now.getUTCFullYear()].join("/");
  return { startDate:"01/01/2000", endDate };
};

const listUrl = (page, fullHistory = false) => {
  const url = new URL(page === 1 ? AESAN_LIST_URL : `${AESAN_LIST_URL}/${page}`);
  if (fullHistory) {
    const { startDate, endDate } = archiveDateRange();
    url.searchParams.set("filter-initDate", startDate);
    url.searchParams.set("filter-endDate", endDate);
    url.searchParams.set("quantity", "40");
  }
  return url.toString();
};

const lastListPage = (html) => Math.max(1, ...[...html.matchAll(/(?:href|action)\s*=\s*["'][^"']*\/buscador-alertas\/(\d+)(?:[?"'])/gi)]
  .map((match) => Number(match[1])).filter(Number.isFinite));

async function readListPages() {
  if (!FULL_HISTORY) {
    const urls = Array.from({ length:RECENT_PAGE_COUNT }, (_, index) => listUrl(index + 1));
    return { pages:await mapLimit(urls, 2, fetchHtml), legacyPages:[], scanned:urls.length };
  }

  const firstPage = await fetchHtml(listUrl(1, true));
  const declaredLastPage = lastListPage(firstPage);
  if (declaredLastPage > MAX_ARCHIVE_PAGES) throw new Error(`El buscador declara ${declaredLastPage} páginas, por encima del límite de seguridad de ${MAX_ARCHIVE_PAGES}.`);
  const remainingUrls = Array.from({ length:declaredLastPage - 1 }, (_, index) => listUrl(index + 2, true));
  const pages = [firstPage, ...await mapLimit(remainingUrls, 2, fetchHtml)];
  return { pages, legacyPages:[], scanned:pages.length };
}

const searchDiscovery = (html) => ({
  forms:[...html.matchAll(/<form\b[^>]*>/gi)].map((match) => match[0]).slice(0, 20),
  inputs:[...html.matchAll(/<input\b[^>]*>/gi)].map((match) => match[0]).slice(0, 40),
  selects:[...html.matchAll(/<select\b[\s\S]*?<\/select>/gi)].map((match) => match[0].replace(/\s+/g, " ")).slice(0, 20),
  searchLinks:[...new Set([...html.matchAll(/(?:href|action)\s*=\s*["']([^"']*buscador-alertas[^"']*)["']/gi)].map((match) => match[1]))].slice(0, 80),
  scripts:[...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]).slice(0, 40),
});

async function main() {
  const now = new Date().toISOString();
  const current = await readCurrentFeed();
  const listing = await readListPages();
  const pages = listing.pages;
  if (FULL_HISTORY && pages[0]) console.log(`AESAN_SEARCH_DISCOVERY ${JSON.stringify(searchDiscovery(pages[0]))}`);
  const currentCards = pages.flatMap(parseListCards);
  const legacyCards = [];
  const cardsByUrl = new Map(currentCards.map((card) => [card.url, card]));
  const cards = consolidateListCards([...cardsByUrl.values()]);
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

  const feed = assembleFeed(current, alerts, now, {
    fullSync:FULL_HISTORY,
    pagesScanned:listing.scanned,
    legacyIndexesScanned:listing.legacyPages.length,
  });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(feed, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ source:AESAN_LIST_URL, mode:FULL_HISTORY ? "full-history" : "recent", pages:listing.scanned, legacyIndexes:listing.legacyPages.length, currentCards:currentCards.length, legacyCards:legacyCards.length, cards:cards.length, alerts:feed.alerts.length, detailFailures, generatedAt:feed.generatedAt, archive:feed.archive }));
}

await main();
