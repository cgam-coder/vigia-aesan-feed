import { createHash } from "node:crypto";
import { AESAN_LIST_URL, decodeEntities, isOfficialAesanAlertUrl } from "./aesan.mjs";

export const ALERT_TYPES = Object.freeze({
  general_population:Object.freeze({ code:"general_population", sourceTypeId:"b5c27f12-7f21-4d2e-bc5c-d5186b4d6259", officialLabel:"Alertas alimentarias de interés para toda la población" }),
  allergy_intolerance_adverse:Object.freeze({ code:"allergy_intolerance_adverse", sourceTypeId:"8c7503b4-b714-4c08-9d8e-0039a2d03624", officialLabel:"Alertas alimentarias para personas con alergias, intolerancias u otros efectos adversos a determinadas sustancias" }),
  food_supplements:Object.freeze({ code:"food_supplements", sourceTypeId:"649ce619-367b-4ad2-96cd-27b905fb6020", officialLabel:"Alertas alimentarias para personas que consumen complementos alimenticios" }),
});
export const LANDING_URL = "https://www.aesan.gob.es/alertas/alertas-alimentarias";
const codes = Object.keys(ALERT_TYPES).sort();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const tags = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "gi"))].map((match) => match[0]);
const attr = (tag, name) => decodeEntities(tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))?.[1] ?? tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))?.[2] ?? "");
const plain = (html) => decodeEntities(html.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ")).trim();
const fail = (reason) => { throw new Error(`AESAN_TAXONOMY_DRIFT ${reason}`); };
const exactTuple = (code) => ({ ...ALERT_TYPES[code] });

export function officialPublicationUrl(value) {
  try {
    const url = new URL(value, "https://www.aesan.gob.es");
    if (url.protocol !== "http:" && url.protocol !== "https:" || url.hostname !== "www.aesan.gob.es" ||
        url.search || url.hash || url.username || url.password ||
        !/^\/alertas\/[^/]+$/u.test(url.pathname) || !isOfficialAesanAlertUrl(url.href)) return null;
    return `https://www.aesan.gob.es${url.pathname}`;
  } catch { return null; }
}

function selector(html) {
  const block = html.match(/<select\b[^>]*\bid\s*=\s*["']filter-select["'][^>]*>([\s\S]*?)<\/select>/iu)?.[1];
  if (!block) fail("missing search selector");
  const options = [...block.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/giu)]
    .filter((match) => !(attr(match[1], "value") === "" && /\bdisabled\b/iu.test(match[1]) && plain(match[2]) === "Tipo de alerta"))
    .map((match) => ({ sourceTypeId:attr(match[1], "value"), officialLabel:plain(match[2]) }));
  if (options.length !== codes.length) fail(`search selector has ${options.length} categories`);
  const found = new Set();
  for (const option of options) {
    const expected = Object.values(ALERT_TYPES).find(({ sourceTypeId }) => sourceTypeId === option.sourceTypeId);
    if (!expected || found.has(expected.code) || option.officialLabel !== expected.officialLabel) fail(`search selector category changed: ${JSON.stringify(option)}`);
    found.add(expected.code);
  }
  return found;
}

function landing(html) {
  const categoryLinks = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']*\/alertas\/buscador-alertas\?type=[^"']+)["'][^>]*>/giu)]
    .map((match) => new URL(decodeEntities(match[1]), LANDING_URL).searchParams.get("type"));
  if (categoryLinks.length !== codes.length || new Set(categoryLinks).size !== codes.length ||
      categoryLinks.some((id) => !Object.values(ALERT_TYPES).some((type) => type.sourceTypeId === id)))
    fail("landing category links changed");
  const headings = [...html.matchAll(/<h2\b[^>]*\bdata-section\s*=\s*["']([^"']+)["'][^>]*>/giu)];
  const relevant = headings.filter((heading) => decodeEntities(heading[1]).startsWith("Alertas alimentarias "));
  if (relevant.length !== codes.length) fail(`landing has ${relevant.length} category headings`);
  const found = new Set();
  for (let i = 0; i < relevant.length; i += 1) {
    const label = decodeEntities(relevant[i][1]);
    const block = html.slice(relevant[i].index, relevant[i + 1]?.index ?? html.length);
    const links = [...block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/giu)].filter((match) => attr(match[1], "title") === "Ver todas");
    if (links.length !== 1) fail(`landing link missing/duplicated: ${label}`);
    const link = new URL(attr(links[0][1], "href"), LANDING_URL);
    const expected = Object.values(ALERT_TYPES).find(({ officialLabel }) => officialLabel === label);
    if (!expected || found.has(expected.code) || link.origin !== "https://www.aesan.gob.es" ||
        link.pathname !== "/alertas/buscador-alertas" || link.searchParams.getAll("type").length !== 1 ||
        link.searchParams.get("type") !== expected.sourceTypeId) fail(`landing category changed: ${label} ${link}`);
    found.add(expected.code);
  }
  return found;
}

export function validateControls(landingHtml, searchHtml) {
  const onLanding = landing(landingHtml);
  const onSearch = selector(searchHtml);
  if (codes.some((code) => !onLanding.has(code) || !onSearch.has(code))) fail("landing/search selector mismatch");
}

export function filteredUrl(code, page = 1) {
  const type = ALERT_TYPES[code];
  if (!type || !Number.isSafeInteger(page) || page < 1) fail("invalid filtered URL request");
  const url = new URL(page === 1 ? AESAN_LIST_URL : `${AESAN_LIST_URL}/${page}`);
  url.searchParams.set("type", type.sourceTypeId);
  return url.href;
}

export function parseFilteredPage(html, code, page) {
  selector(html);
  const type = ALERT_TYPES[code];
  const selected = html.match(/<select\b[^>]*\bid\s*=\s*["']filter-select["'][^>]*\bvalue\s*=\s*["']([^"']+)["']/iu)?.[1];
  if (selected !== type.sourceTypeId) fail(`filtered response type mismatch ${code} page ${page}`);
  const result = html.match(/<div\b[^>]*\bclass\s*=\s*["']result__info["'][^>]*>([\s\S]*?)<\/div>/iu);
  const range = plain(result?.[1] ?? "").match(/^(\d+)\s*-\s*(\d+)\s+de\s+(\d+)$/u);
  if (!range) fail(`missing result range ${code} page ${page}`);
  const [start, end, total] = range.slice(1).map(Number);
  const pagination = html.match(/<nav\b[^>]*\bclass\s*=\s*["'][^"']*\bpagination\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/iu)?.[0];
  if (!pagination) fail(`missing pagination ${code} page ${page}`);
  const active = pagination.match(/<li\b[^>]*\bclass\s*=\s*["'][^"']*\bpagination__active\b[^"']*["'][^>]*\baria-label\s*=\s*["']page\s+(\d+)["']/iu)?.[1];
  if (Number(active) !== page) fail(`wrong active page ${code} page ${page}`);
  const linkedPages = [...pagination.matchAll(/<a\b([^>]*)>/giu)].flatMap((match) => {
    const href = attr(match[1], "href");
    if (!href || href === "#") return [];
    const url = new URL(href, AESAN_LIST_URL);
    if (url.hostname !== "www.aesan.gob.es" || url.searchParams.get("type") !== type.sourceTypeId ||
        !/^\/alertas\/buscador-alertas(?:\/\d+)?$/u.test(url.pathname)) fail(`pagination link changed ${code} page ${page}`);
    return [url.pathname === "/alertas/buscador-alertas" ? 1 : Number(url.pathname.split("/").at(-1))];
  });
  const lastPage = Math.ceil(total / 20);
  const cards = [...html.matchAll(/<a\b([^>]*\bclass\s*=\s*["'][^"']*\bseeMoreCard\b[^"']*["'][^>]*)>[\s\S]*?<\/a>/giu)];
  const urls = cards.map((match) => officialPublicationUrl(attr(match[1], "href")));
  if (urls.some((url) => !url) || start !== (page - 1) * 20 + 1 ||
      end !== Math.min(page * 20, total) || cards.length !== end - start + 1 ||
      page > lastPage || linkedPages.some((linked) => linked < 1 || linked > lastPage) ||
      lastPage > 1 && page === 1 && !linkedPages.includes(lastPage) || total < 1) fail(`incomplete filtered page ${code} page ${page}`);
  if (page < lastPage && !linkedPages.includes(page + 1) || page === lastPage && linkedPages.includes(page + 1))
    fail(`pagination continuation changed ${code} page ${page}`);
  return { code, page, total, lastPage, raw:cards.length, urls };
}

export async function scanOfficialTaxonomy(fetchHtml, { maxPages = 200, onPage = () => {} } = {}) {
  const [landingHtml, searchHtml] = await Promise.all([fetchHtml(LANDING_URL), fetchHtml(AESAN_LIST_URL)]);
  validateControls(landingHtml, searchHtml);
  const provenance = [{ url:LANDING_URL, sha256:createHash("sha256").update(landingHtml).digest("hex") },
    { url:AESAN_LIST_URL, sha256:createHash("sha256").update(searchHtml).digest("hex") }];
  const memberships = new Map();
  const metrics = [];
  for (const code of codes) {
    const firstUrl = filteredUrl(code);
    const firstHtml = await fetchHtml(firstUrl);
    const first = parseFilteredPage(firstHtml, code, 1);
    if (first.lastPage > maxPages) fail(`filtered page limit exceeded ${code}: ${first.lastPage}`);
    const pages = [first];
    onPage(firstUrl, firstHtml);
    provenance.push({ url:firstUrl, sha256:createHash("sha256").update(firstHtml).digest("hex") });
    const pending = Array.from({ length:first.lastPage - 1 }, (_, index) => index + 2);
    const loaded = new Array(pending.length);
    let cursor = 0;
    await Promise.all(Array.from({ length:Math.min(5, pending.length) }, async () => {
      while (cursor < pending.length) {
        const index = cursor++;
        const page = pending[index];
        loaded[index] = await fetchHtml(filteredUrl(code, page));
      }
    }));
    for (let page = 2; page <= first.lastPage; page += 1) {
      const url = filteredUrl(code, page);
      const html = loaded[page - 2];
      const parsed = parseFilteredPage(html, code, page);
      if (parsed.total !== first.total || parsed.lastPage !== first.lastPage) fail(`filtered pagination shifted ${code} page ${page}`);
      onPage(url, html);
      provenance.push({ url, sha256:createHash("sha256").update(html).digest("hex") });
      pages.push(parsed);
    }
    const unique = new Set(pages.flatMap(({ urls }) => urls));
    metrics.push({ code, pages:pages.length, raw:pages.reduce((n, page) => n + page.raw, 0), unique:unique.size });
    for (const url of unique) {
      const matches = memberships.get(url) ?? [];
      matches.push(exactTuple(code));
      memberships.set(url, matches);
    }
  }
  for (const [url, matches] of memberships) if (matches.length > 1) fail(`publication appears in multiple categories ${url}`);
  return { memberships, metrics, provenance };
}

export function publicationMembers(alert) {
  const items = [{ sourceRecordId:alert.sourceRecordId, sourceRecordIdType:alert.sourceRecordIdType, url:alert.url },
    ...(alert.publicationHistory ?? []), ...(alert.publicationSelection?.members ?? []).map((member) => ({ ...member,
      sourceRecordIdType:(alert.publicationHistory ?? []).find((entry) => entry.sourceRecordId === member.sourceRecordId)?.sourceRecordIdType ?? "idAlert" }))];
  const byUrl = new Map();
  const byId = new Map();
  for (const item of items) {
    if (typeof item.sourceRecordId !== "string" || typeof item.url !== "string" ||
        !officialPublicationUrl(item.url) || officialPublicationUrl(item.url) !== item.url ||
        !(item.sourceRecordIdType === "idAlert" && uuid.test(item.sourceRecordId) ||
          item.sourceRecordIdType === "official_page_path" && item.sourceRecordId === `official_page_path:${new URL(item.url).pathname}`))
      fail(`invalid preserved identity ${alert.reference}`);
    const previous = byUrl.get(item.url);
    if (previous && previous.sourceRecordId !== item.sourceRecordId || byId.has(item.sourceRecordId) && byId.get(item.sourceRecordId) !== item.url)
      fail(`URL↔UUID conflict ${alert.reference} ${item.url}`);
    byUrl.set(item.url, { sourceRecordId:item.sourceRecordId, sourceRecordIdType:item.sourceRecordIdType, url:item.url });
    byId.set(item.sourceRecordId, item.url);
  }
  return [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url, "en") || a.sourceRecordId.localeCompare(b.sourceRecordId, "en"));
}

export function projectClassification(alert, memberships) {
  const publications = publicationMembers(alert).map((member) => ({ ...member,
    matches:[...(memberships.get(member.url) ?? [])].sort((a, b) => a.code.localeCompare(b.code, "en")) }));
  const known = publications.flatMap(({ matches }) => matches);
  const conflict = publications.some(({ matches }) => matches.length > 1) || new Set(known.map(({ code }) => code)).size > 1;
  const status = conflict ? "conflict" : publications.some(({ matches }) => matches.length === 0) ? "unknown" : "known";
  const tuple = status === "known" ? known[0] : null;
  return { schemaVersion:1, status, code:tuple?.code ?? null, sourceTypeId:tuple?.sourceTypeId ?? null,
    officialLabel:tuple?.officialLabel ?? null, publications };
}

export function enrichFeedTaxonomy(feed, scan, { reviewed = [] } = {}) {
  const prior = new Map();
  for (const alert of feed.alerts) for (const publication of alert.aesanAlertClassification?.publications ?? []) {
    const old = prior.get(publication.url);
    if (old && old.sourceRecordId !== publication.sourceRecordId) fail(`prior URL↔UUID conflict ${publication.url}`);
    prior.set(publication.url, publication);
  }
  for (const item of reviewed) if (item.code) {
    const old = prior.get(item.url);
    if (!old) prior.set(item.url, { sourceRecordId:item.sourceRecordId, matches:[exactTuple(item.code)] });
  }
  const identities = new Map();
  const urls = new Map();
  const present = new Set();
  const alerts = feed.alerts.map((alert) => {
    const taxonomy = projectClassification(alert, scan.memberships);
    if (taxonomy.status === "conflict") fail(`conflicting official classifications ${alert.reference}`);
    for (const publication of taxonomy.publications) {
      present.add(publication.url);
      const id = identities.get(publication.sourceRecordId);
      const url = urls.get(publication.url);
      if (id && id !== publication.url || url && url !== publication.sourceRecordId) fail(`URL↔UUID conflict ${publication.url}`);
      identities.set(publication.sourceRecordId, publication.url);
      urls.set(publication.url, publication.sourceRecordId);
      const previous = prior.get(publication.url);
      if (previous && previous.sourceRecordId !== publication.sourceRecordId) fail(`reviewed URL↔UUID conflict ${publication.url}`);
      if (previous?.matches?.length === 1 && publication.matches.length === 1 && previous.matches[0].code !== publication.matches[0].code)
        fail(`unreviewed category change ${publication.url}`);
    }
    return { ...alert, aesanAlertClassification:taxonomy };
  });
  const gaps = [...scan.memberships.keys()].filter((url) => !present.has(url)).sort();
  const unknown = alerts.filter((alert) => alert.aesanAlertClassification.status === "unknown")
    .map((alert) => ({ reference:alert.reference, urls:alert.aesanAlertClassification.publications.filter((p) => !p.matches.length).map((p) => p.url) }));
  const disappeared = [...prior].filter(([url, value]) => value.matches?.length && present.has(url) && !scan.memberships.has(url)).map(([url]) => url);
  return { feed:{ ...feed, alerts }, diagnostics:{ gaps, unknown, disappeared } };
}
