// ops/sr271-aesan-official-read.mjs
import { createHash as createHash3 } from "node:crypto";

// lib/aesan-producer/aesan-taxonomy.mjs
import { createHash as createHash2 } from "node:crypto";

// lib/aesan-producer/aesan.mjs
import { createHash } from "node:crypto";
var AESAN_ORIGIN = "https://www.aesan.gob.es";
var AESAN_LIST_URL = `${AESAN_ORIGIN}/alertas/buscador-alertas`;
var MONTHS = /* @__PURE__ */ new Map([
  ["enero", 0],
  ["febrero", 1],
  ["marzo", 2],
  ["abril", 3],
  ["mayo", 4],
  ["junio", 5],
  ["julio", 6],
  ["agosto", 7],
  ["septiembre", 8],
  ["setiembre", 8],
  ["octubre", 9],
  ["noviembre", 10],
  ["diciembre", 11]
]);
var NAMED_ENTITIES = /* @__PURE__ */ new Map([
  ["nbsp", " "],
  ["amp", "&"],
  ["quot", '"'],
  ["apos", "'"],
  ["lt", "<"],
  ["gt", ">"],
  ["aacute", "\xE1"],
  ["eacute", "\xE9"],
  ["iacute", "\xED"],
  ["oacute", "\xF3"],
  ["uacute", "\xFA"],
  ["ntilde", "\xF1"],
  ["Aacute", "\xC1"],
  ["Eacute", "\xC9"],
  ["Iacute", "\xCD"],
  ["Oacute", "\xD3"],
  ["Uacute", "\xDA"],
  ["Ntilde", "\xD1"],
  ["uuml", "\xFC"],
  ["Uuml", "\xDC"]
]);
function decodeEntities(value = "") {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
    if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return NAMED_ENTITIES.get(code) ?? entity;
  });
}
function stripHtml(value = "") {
  return decodeEntities(value.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(?:p|li|ul|ol|div|section|article|figure|h[1-6])\b[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n").trim();
}
var attribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return decodeEntities(match?.[1] ?? match?.[2] ?? "").trim();
};
var absoluteOfficialUrl = (value) => {
  try {
    const url = new URL(value, AESAN_ORIGIN);
    if (url.hostname !== "aesan.gob.es" && !url.hostname.endsWith(".aesan.gob.es")) return null;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
};
var openingTag = (block = "") => block.match(/^<[^>]+>/u)?.[0] ?? "";
var elementBlocks = (html2, tagName) => {
  const blocks = [];
  const opening = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  for (const match of html2.matchAll(opening)) {
    const token = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
    token.lastIndex = match.index;
    let depth = 0;
    let end = -1;
    for (let current = token.exec(html2); current; current = token.exec(html2)) {
      depth += current[0].startsWith("</") ? -1 : 1;
      if (depth === 0) {
        end = token.lastIndex;
        break;
      }
    }
    if (end > match.index) blocks.push({ html: html2.slice(match.index, end), index: match.index });
  }
  return blocks;
};
var classNames = (tag) => new Set(attribute(tag, "class").split(/\s+/u).filter(Boolean));
var materialArticleBody = (articleHtml) => {
  const candidates = elementBlocks(articleHtml, "div").filter(({ html: html2 }) => {
    const names = classNames(openingTag(html2));
    return names.has("post-container") && !names.has("aesan-bgText");
  });
  return candidates.length ? candidates.map(({ html: html2 }) => html2).join("\n") : articleHtml;
};
var exactFieldPair = (value) => {
  const text = stripHtml(value);
  const match = text.match(/^([^:\n]{2,120})\s*:\s*([\s\S]+)$/u);
  return match ? { label: match[1].trim(), value: match[2].trim() } : null;
};
function extractPublishedFields(articleHtml) {
  const body = materialArticleBody(articleHtml);
  const fields = [];
  const lists = elementBlocks(body, "ul");
  for (let group = 0; group < lists.length; group += 1) {
    const pairs = elementBlocks(lists[group].html, "li").map(({ html: html2 }) => exactFieldPair(html2)).filter(Boolean);
    if (!pairs.length) continue;
    for (let position = 0; position < pairs.length; position += 1) {
      fields.push({
        ...pairs[position],
        sourceField: `article.productData[${group}].field[${position}]`,
        order: fields.length,
        section: "product_data",
        context: `list:${group}`
      });
    }
  }
  return fields;
}
var normalizedComparableText = (value) => stripHtml(value).replace(/[\s“”'".,;:()\[\]]+/gu, "").toLocaleLowerCase("es");
function extractMaterialParagraphs(articleHtml) {
  const body = materialArticleBody(articleHtml);
  const paragraphs = [];
  const listItemRanges = elementBlocks(body, "li").map(({ html: html2, index }) => ({ start: index, end: index + html2.length }));
  for (const { html: html2, index } of elementBlocks(body, "p")) {
    if (listItemRanges.some(({ start, end }) => index > start && index < end)) continue;
    const value = stripHtml(html2);
    if (!value || /^Los datos de(?:l| los) productos? implicados? son\s*:?$/iu.test(value) || /^Se adjunta(?:n)? (?:una |las )?im[aá]gen(?:es)? disponible(?:s)?\.?$/iu.test(value) || /^Fecha y hora\s*:/iu.test(value)) continue;
    const links = [...html2.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => stripHtml(match[1])).filter(Boolean);
    if (links.length && normalizedComparableText(value) === normalizedComparableText(links.join(" "))) continue;
    paragraphs.push({ value, sourceField: `article.body.p[${paragraphs.length}]`, order: paragraphs.length, section: "publication" });
  }
  return paragraphs;
}
function extractOfficialResources(articleHtml, officialUrl) {
  const body = materialArticleBody(articleHtml);
  const resources = [];
  const seen = /* @__PURE__ */ new Set();
  const append = (resource) => {
    if (!resource.url || seen.has(resource.url)) return;
    seen.add(resource.url);
    resources.push({ ...resource, order: resources.length });
  };
  for (const match of body.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const url = absoluteOfficialUrl(attribute(tag, "src"));
    if (!url || !/\/dam\/jcr:/iu.test(new URL(url).pathname)) continue;
    append({ kind: "image", url, label: attribute(tag, "alt") || null, sourceField: `article.image[${resources.length}]` });
  }
  for (const { html: html2 } of elementBlocks(body, "a")) {
    const tag = openingTag(html2);
    const url = absoluteOfficialUrl(attribute(tag, "href"));
    const label = stripHtml(html2);
    if (!url || url === officialUrl || /\/alertas\/buscador-alertas\/?$/iu.test(new URL(url).pathname) || !label) continue;
    append({
      kind: /\.pdf(?:$|[?#])/iu.test(url) ? "document" : "link",
      url,
      label,
      sourceField: `article.link[${resources.length}]`
    });
  }
  return resources;
}
function extractOfficialDates(html2, articleHtml) {
  const dates = [];
  const pageInfo = elementBlocks(articleHtml, "div").find(({ html: block }) => classNames(openingTag(block)).has("pageInfo__date"));
  const pageDate = stripHtml(pageInfo?.html ?? "").match(/\b\d{2}\/\d{2}\/20\d{2}\b/u)?.[0] ?? "";
  if (pageDate) dates.push({ label: null, value: pageDate, sourceField: "pageInfo.date", order: dates.length });
  const body = materialArticleBody(articleHtml);
  for (const { html: block } of elementBlocks(body, "p")) {
    const value = stripHtml(block);
    const match = value.match(/^(Fecha y hora)\s*:\s*([\s\S]+)$/iu);
    if (!match) continue;
    const candidate = { label: match[1], value: match[2].trim(), sourceField: `article.date[${dates.length}]`, order: dates.length };
    if (!dates.some((date) => date.label === candidate.label && date.value === candidate.value)) dates.push(candidate);
  }
  return dates;
}
var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var officialPagePath = (value) => {
  const url = absoluteOfficialUrl(value);
  return url ? new URL(url).pathname.replace(/\/+$/u, "") || "/" : null;
};
function sourceIdentityForHtml(html2, officialUrl) {
  const tag = html2.match(/<meta\b[^>]*\bname\s*=\s*["']idAlert["'][^>]*>/i)?.[0] ?? "";
  const idAlert = attribute(tag, "content");
  const pagePath = officialPagePath(officialUrl);
  if (!pagePath) throw new Error(`URL oficial AESAN no v\xE1lida para identidad: ${officialUrl}`);
  if (idAlert) {
    if (!UUID_PATTERN.test(idAlert)) throw new Error(`idAlert AESAN no v\xE1lido en ${pagePath}`);
    return { sourceRecordId: idAlert.toLowerCase(), sourceRecordIdType: "idAlert", officialPagePath: pagePath };
  }
  return {
    sourceRecordId: `official_page_path:${pagePath}`,
    sourceRecordIdType: "official_page_path",
    officialPagePath: pagePath
  };
}
var historyEntry = (alert) => ({
  reference: alert.reference,
  title: alert.title,
  contentHash: alert.contentHash
});
var normalizedReferenceHistory = (entries, current = null) => {
  const unique = /* @__PURE__ */ new Map();
  for (const entry of entries ?? []) {
    if (!entry || typeof entry.reference !== "string" || typeof entry.title !== "string" || typeof entry.contentHash !== "string" || !entry.reference || !entry.title || !entry.contentHash) continue;
    const key = `${entry.reference}\0${entry.contentHash}`;
    if (current && entry.reference === current.reference && entry.contentHash === current.contentHash) continue;
    if (!unique.has(key)) unique.set(key, {
      reference: entry.reference,
      title: entry.title,
      contentHash: entry.contentHash
    });
  }
  return [...unique.values()];
};
var previousReferencesFor = (history, currentReference) => [...new Set(history.map((entry) => entry.reference).filter((reference) => reference && reference !== currentReference))];
function isOfficialAesanAlertUrl(value) {
  const url = absoluteOfficialUrl(value);
  if (!url) return false;
  const path = new URL(url).pathname;
  return /^\/alertas\/(?!buscador-alertas(?:\/|$)|alertas-alimentarias(?:\/|$))[^/?#]+/i.test(path) || /^\/AECOSAN\/web\/seguridad_alimentaria\/(?:alertas_alimentarias|ampliacion)\/(?!listado\/)[^/?#]+\.htm$/i.test(path);
}
var normalizeReference = (value = "") => {
  const match = value.match(/ES\s*(20\d{2})\s*[/.\-]\s*(\d+)/i);
  return match ? `ES${match[1]}/${match[2]}` : "";
};
function parseSpanishDate(value = "") {
  const match = stripHtml(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").match(/\b(\d{1,2})\s+([a-z]+)\s+(20\d{2})\b/i);
  if (!match) return null;
  const month = MONTHS.get(match[2].toLowerCase());
  if (month === void 0) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1]), 12)).toISOString();
}
var categoryFor = (title, icon = "", body = "") => {
  const value = `${icon} ${title} ${body}`.toLowerCase();
  if (/\bpill\b|complementos? alimenticios?|sildenafilo|tadalafilo/.test(value)) return "supplements";
  if (/\bcookie\b|advertencia|alerg|intoler|no declarad|etiquetado incorrecto/.test(value)) return "allergens";
  return "general";
};
function parseListCards(html2) {
  const cards2 = /* @__PURE__ */ new Map();
  const pattern = /<a\b([^>]*\bclass\s*=\s*(?:\"[^\"]*\bseeMoreCard\b[^\"]*\"|'[^']*\bseeMoreCard\b[^']*')[^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html2.matchAll(pattern)) {
    const href = absoluteOfficialUrl(attribute(match[1], "href"));
    if (!href || !isOfficialAesanAlertUrl(href)) continue;
    const title = attribute(match[1], "title") || stripHtml(match[2].match(/<p\b[^>]*\bseeMoreCard__text\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    if (!title) continue;
    const dateText = stripHtml(match[2].match(/<[^>]*\bseeMoreCard-heading__value\b[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
    const icon = stripHtml(match[2].match(/<[^>]*\bseeMoreCard-heading__icon\b[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
    const reference = normalizeReference(title);
    cards2.set(href, { url: href, title, reference, publishedAt: parseSpanishDate(dateText), category: categoryFor(title, icon) });
  }
  return [...cards2.values()];
}
var fieldMap = (articleHtml) => {
  const fields = /* @__PURE__ */ new Map();
  for (const item of articleHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = stripHtml(item[1]);
    const match = text.match(/^([^:\n]{2,90})\s*:\s*([\s\S]+)$/);
    if (match) fields.set(match[1].toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""), match[2].trim().replace(/[.;]+$/, ""));
  }
  return fields;
};
var findFieldEntry = (fields, labels) => {
  for (const [label, value] of fields) {
    if (labels.some((candidate) => label === candidate || label.startsWith(`${candidate} `))) return { label, value };
  }
  return null;
};
var findField = (fields, labels) => findFieldEntry(fields, labels)?.value ?? "";
var normalizeEntityKey = (value = "") => stripHtml(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\b(?:s\.?l\.?u?|s\.?a\.?u?|s\.?c\.?|sociedad limitada|sociedad anonima)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
var productClassFor = (product = "", title = "", alertCategory = "") => {
  const normalized = (value) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const productValue = normalized(product);
  const titleValue = normalized(title);
  const classes = [
    ["Complementos alimenticios", /complemento alimenticio|suplemento|capsul|comprimido|extracto|vitamin|minerales?/],
    ["Carne y productos c\xE1rnicos", /carne|carnic|salchich|choriz|fuet|jamon|lomo embuchado|mortadela|hamburgues|pollo|pavo|cerdo|vacuno/],
    ["Pescado y marisco", /pescad|marisc|bacalao|salmon|atun|anchoa|langost|gamba|camaron|mejillon|almeja|calamar|pulpo|necora/],
    ["Leche y productos l\xE1cteos", /\bleche\b|lacte|queso|yogur|nata|mantequilla|helado/],
    ["Platos preparados y sopas", /plato preparado|precocinado|sopa|pizza|lasana|tortilla|croqueta|kit ramen/],
    ["Cereales, panader\xEDa y pasta", /harina|pan\b|bolleri|galleta|cereal|pasta|fideo|ramen|trigo|centeno|avena|arroz|maiz/],
    ["Bebidas", /bebida|zumo|jugo|cerveza|vino|licor|refresco|infusion|te\b|cafe/],
    ["Frutas y hortalizas", /fruta|hortaliza|verdura|lechuga|espinaca|tomate|patata|seta|manzana|moringa|brotes? germinad/],
    ["Frutos secos y semillas", /fruto seco|almendra|avellana|nuez|pistacho|cacahuete|sesamo|semilla/],
    ["Dulces y confiter\xEDa", /chocolate|cacao|caramelo|golosina|confiteria|dulce|postre|crema de cacao/],
    ["Condimentos, salsas y especias", /especia|condimento|salsa|canela|pimenton|curcuma|mostaza|mayonesa/],
    ["Aceites y grasas", /aceite|grasa vegetal|margarina/]
  ];
  return classes.find(([, pattern]) => pattern.test(productValue))?.[0] || classes.find(([, pattern]) => pattern.test(titleValue))?.[0] || (alertCategory === "supplements" ? "Complementos alimenticios" : "Otros alimentos");
};
var providerFor = (fields) => {
  const groups = [
    { role: "Fabricante", labels: ["fabricante", "empresa fabricante"] },
    { role: "Distribuidor", labels: ["distribuidor", "empresa distribuidora"] },
    { role: "Importador", labels: ["importador", "empresa importadora"] },
    { role: "Comercializador", labels: ["comercializador", "empresa comercializadora"] },
    { role: "Operador alimentario", labels: ["operador alimentario", "operador", "empresa responsable", "nombre de la empresa", "empresa", "razon social"] }
  ];
  for (const group of groups) {
    const entry = findFieldEntry(fields, group.labels);
    if (entry?.value) return { name: entry.value, role: group.role, evidence: `Campo oficial: ${entry.label}` };
  }
  return { name: "", role: "", evidence: "" };
};
var inferHazard = (text) => {
  const value = text.toLowerCase();
  const hazards = [
    ["salmonella", "Salmonella spp."],
    ["listeria", "Listeria monocytogenes"],
    ["escherichia coli", "E. coli"],
    ["stec", "E. coli STEC"],
    ["histamina", "Histamina"],
    ["cereulida", "Cereulida"],
    ["bacillus cereus", "Bacillus cereus"],
    ["toxina botul", "Toxina botul\xEDnica"],
    ["aflatox", "Aflatoxinas"],
    ["sildenafilo", "Sildenafilo"],
    ["tadalafilo", "Tadalafilo"],
    ["fragmentos de vidrio", "Fragmentos de vidrio"],
    ["part\xEDculas de aluminio", "Part\xEDculas de aluminio"],
    ["fragmentos de pl\xE1stico", "Fragmentos de pl\xE1stico"],
    ["fragmentos met\xE1licos", "Fragmentos met\xE1licos"],
    ["cuerpos extra\xF1os", "Cuerpos extra\xF1os"]
  ];
  let found = hazards.filter(([needle]) => value.includes(needle)).map(([, label]) => label);
  if (found.some((label) => label.startsWith("Fragmentos de ") || label.startsWith("Part\xEDculas de "))) {
    found = found.filter((label) => label !== "Cuerpos extra\xF1os");
  }
  if (/advertencia|alerg|intoler|no declarad|etiquetado incorrecto/.test(value)) {
    const allergens = [
      ["leche", "Leche no declarada"],
      ["lactosa", "Lactosa no declarada"],
      ["gluten", "Gluten no declarado"],
      ["almendra", "Almendra no declarada"],
      ["huevo", "Huevo no declarado"],
      ["soja", "Soja no declarada"],
      ["cacahuete", "Cacahuete no declarado"],
      ["s\xE9samo", "S\xE9samo no declarado"],
      ["pescado", "Pescado no declarado"],
      ["sulfit", "Sulfitos no declarados"],
      ["trigo", "Trigo no declarado"],
      ["frutos secos", "Frutos secos no declarados"]
    ];
    found.push(...allergens.filter(([needle]) => value.includes(needle)).map(([, label]) => label));
  }
  return [...new Set(found)].join(" \xB7 ") || "Consultar publicaci\xF3n oficial";
};
var inferPriority = (text) => {
  const value = text.toLowerCase();
  if (/brote|fallecid|hospitaliz|riesgo grave/.test(value)) return "Cr\xEDtica";
  if (/salmonella|listeria|escherichia|stec|toxina|cereulida|bacillus|aflatox|sildenafilo|tadalafilo|histamina|vidrio|aluminio|plástico|metal|cuerpos extraños/.test(value)) return "Alta";
  return "Media";
};
var titleProduct = (title) => title.match(/\ben\s+(.+?)(?:\s+procedente(?:s)?\s+de\b|\s*\(Ref\b|[.;]|$)/i)?.[1]?.replace(/^(?:el\s+)?etiquetado\s+(?:incorrecto\s+de\s+al[eé]rgeno\s+\([^)]*\)\s+)?/i, "").trim() ?? "Consultar ficha oficial";
var originFor = (title, fields) => findField(fields, ["pais de origen", "origen"]) || title.match(/procedente(?:s)?\s+de\s+(.+?)(?:\s*\(Ref\b|[.;]|$)/i)?.[1]?.trim() || "No indicado";
var sentences = (text) => text.split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜ])/).map((line) => line.trim()).filter(Boolean);
var NOTIFYING_SENTENCE_PATTERNS = [
  /\bnotificaci[oó]n de alerta trasladada por las autoridades sanitarias(?:\s+de)?\s+/i,
  /\b(?:agencia española de seguridad alimentaria y nutrici[oó]n|AESAN)\b[\s\S]{0,180}\bha sido informada por\b/i,
  /\b(?:comunidad aut[oó]noma de|comunidad valenciana)\b[\s\S]{0,260}\bha(?:n)? informado a (?:la )?(?:agencia española de seguridad alimentaria y nutrici[oó]n|AESAN)\b/i,
  /\bautoridades (?:competentes|sanitarias) de\b[\s\S]{0,180}\bhan informado a (?:la )?(?:agencia española de seguridad alimentaria y nutrici[oó]n|AESAN)\b/i
];
var SPAIN_AUTONOMOUS_COMMUNITY_PATTERN = /(?:^|[^a-záéíóúüñ])(?:Andalucía|Aragón|Asturias|Illes Balears|Islas Baleares|Baleares|Canarias|Cantabria|Castilla y León|Castilla\s*(?:-\s*)?La Mancha|Cataluña|Catalunya|Ceuta|Melilla|Comunidad Valenciana|Comunitat Valenciana|Extremadura|Galicia|Madrid|Murcia|Navarra|País Vasco|Euskadi|La Rioja)(?=$|[^a-záéíóúüñ])/iu;
var notifyingTextFor = (articleText = "") => sentences(articleText).find((line) => /\bSCIRI\b/i.test(line) && SPAIN_AUTONOMOUS_COMMUNITY_PATTERN.test(line) && NOTIFYING_SENTENCE_PATTERNS.some((pattern) => pattern.test(line))) ?? "";
var scopeFor = (text, category) => sentences(text).find((line) => /distribuci[oó]n (?:inicial|del producto)|distribuido (?:inicialmente|en)|ha sido distribuido/i.test(line))?.slice(0, 360) || (category === "allergens" ? "Colectivo al\xE9rgico o intolerante indicado por AESAN" : category === "supplements" ? "Personas consumidoras del complemento alimenticio indicado" : "Poblaci\xF3n general \xB7 publicaci\xF3n oficial AESAN");
var actionFor = (text) => sentences(text).find((line) => /(?:como medida de precauci[oó]n,?\s+)?se recomienda|se abstengan de consumir|retirada de (?:los )?productos|\bno consumir\b/i.test(line))?.slice(0, 360) || "Consultar las medidas y recomendaciones incluidas en la ficha oficial de AESAN.";
var listLots = (value) => {
  if (!value) return [];
  if (/^todos? los lotes/i.test(value)) return [value];
  return value.split(/\s*[;,]\s*|\s+y\s+(?=[A-Z0-9])/).map((lot) => lot.trim()).filter(Boolean).slice(0, 20);
};
var digest = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
var articleFragment = (html2) => {
  const start = html2.search(/<h1\b[^>]*\baesan-title\b/i);
  if (start < 0) return html2;
  const end = html2.slice(start).search(/<a\b[^>]*href\s*=\s*["']\/alertas\/buscador-alertas["']/i);
  return end < 0 ? html2.slice(start) : html2.slice(start, start + end);
};
var contentDate = (html2) => {
  const tag = html2.match(/<meta\b[^>]*\bname\s*=\s*["']content-date["'][^>]*>/i)?.[0] ?? "";
  const value = attribute(tag, "content");
  return value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString() : null;
};
function parseDetail(html2, card, previous = null, detectedAt = (/* @__PURE__ */ new Date()).toISOString(), suppliedIdentity = null) {
  const articleHtml = articleFragment(html2);
  const articleText = stripHtml(articleHtml);
  const notifyingText = notifyingTextFor(articleText);
  const fields = fieldMap(articleHtml);
  const heading = stripHtml(articleHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const title = heading || card.title;
  const reference = normalizeReference(title) || card.reference || new URL(card.url).pathname.split("/").filter(Boolean).at(-1);
  const product = findField(fields, ["nombre del producto", "denominacion del producto", "producto"]) || titleProduct(title);
  const brand = findField(fields, ["marca", "nombre de marca", "marca comercial"]);
  const provider = providerFor(fields);
  const lotText = findField(fields, ["numero de lote", "n\xBA de lote", "n\xB0 de lote", "lote", "lotes"]);
  const category = categoryFor(title, "", articleText);
  const productClass = productClassFor(product, title, category);
  const officialTitle = title;
  const publishedFields = extractPublishedFields(articleHtml);
  const materialParagraphs = extractMaterialParagraphs(articleHtml);
  const resources = extractOfficialResources(articleHtml, card.url);
  const officialDates = extractOfficialDates(html2, articleHtml);
  const image = resources.find(({ kind }) => kind === "image")?.url ?? null;
  const publishedAt = contentDate(html2) || card.publishedAt;
  const sourceRecordHash = digest({ officialTitle, publishedFields, materialParagraphs, resources, officialDates });
  const previousSourceRecordHash = typeof previous?.sourceRecordHash === "string" && /^[0-9a-f]{64}$/iu.test(previous.sourceRecordHash) ? previous.sourceRecordHash : null;
  const changed = Boolean(previous?.contentHash && previousSourceRecordHash && previousSourceRecordHash !== sourceRecordHash);
  const contentHash = changed ? sourceRecordHash : previous?.contentHash || sourceRecordHash;
  const identity = suppliedIdentity ?? sourceIdentityForHtml(html2, card.url);
  const referenceHistory = normalizedReferenceHistory([
    ...previous?.referenceHistory ?? [],
    ...previous && changed ? [historyEntry(previous)] : []
  ], { reference, contentHash });
  const normalized = {
    id: previous?.id || `aesan:${reference}`,
    reference,
    sourceRecordId: identity.sourceRecordId,
    sourceRecordIdType: identity.sourceRecordIdType,
    sourceRecordSchemaVersion: 2,
    sourceRecordHash,
    previousReferences: previousReferencesFor(referenceHistory, reference),
    referenceHistory,
    source: "AESAN",
    type: "Alimentaria",
    priority: inferPriority(title),
    title,
    product,
    brand,
    productClass,
    productKey: normalizeEntityKey(product),
    brandKey: normalizeEntityKey(brand),
    provider: provider.name,
    providerKey: normalizeEntityKey(provider.name),
    providerRole: provider.role,
    providerEvidence: provider.evidence,
    notifyingText,
    hazard: inferHazard(title),
    origin: originFor(title, fields),
    scope: scopeFor(articleText, category),
    action: actionFor(articleText),
    lots: listLots(lotText),
    imageUrl: image,
    officialTitle,
    publishedFields,
    materialParagraphs,
    resources,
    officialDates,
    url: card.url,
    publishedAt,
    detectedAt: previous?.detectedAt || detectedAt,
    updatedAt: changed ? detectedAt : previous?.updatedAt || publishedAt || detectedAt,
    contentHash,
    versionCount: changed ? (previous.versionCount || 1) + 1 : previous?.versionCount || 1,
    isUpdate: /ampliaci[oó]n|actualizaci[oó]n|correcci[oó]n/i.test(title)
  };
  return normalized;
}

// lib/aesan-producer/aesan-taxonomy.mjs
var ALERT_TYPES = Object.freeze({
  general_population: Object.freeze({ code: "general_population", sourceTypeId: "b5c27f12-7f21-4d2e-bc5c-d5186b4d6259", officialLabel: "Alertas alimentarias de inter\xE9s para toda la poblaci\xF3n" }),
  allergy_intolerance_adverse: Object.freeze({ code: "allergy_intolerance_adverse", sourceTypeId: "8c7503b4-b714-4c08-9d8e-0039a2d03624", officialLabel: "Alertas alimentarias para personas con alergias, intolerancias u otros efectos adversos a determinadas sustancias" }),
  food_supplements: Object.freeze({ code: "food_supplements", sourceTypeId: "649ce619-367b-4ad2-96cd-27b905fb6020", officialLabel: "Alertas alimentarias para personas que consumen complementos alimenticios" })
});
var LANDING_URL = "https://www.aesan.gob.es/alertas/alertas-alimentarias";
var codes = Object.keys(ALERT_TYPES).sort();
var attr = (tag, name) => decodeEntities(tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))?.[1] ?? tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))?.[2] ?? "");
var plain = (html2) => decodeEntities(html2.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ")).trim();
var fail = (reason) => {
  throw new Error(`AESAN_TAXONOMY_DRIFT ${reason}`);
};
var exactTuple = (code) => ({ ...ALERT_TYPES[code] });
function officialPublicationUrl(value) {
  try {
    const url = new URL(value, "https://www.aesan.gob.es");
    if (url.protocol !== "http:" && url.protocol !== "https:" || url.hostname !== "www.aesan.gob.es" || url.search || url.hash || url.username || url.password || !/^\/alertas\/[^/]+$/u.test(url.pathname) || !isOfficialAesanAlertUrl(url.href)) return null;
    return `https://www.aesan.gob.es${url.pathname}`;
  } catch {
    return null;
  }
}
function selector(html2) {
  const block = html2.match(/<select\b[^>]*\bid\s*=\s*["']filter-select["'][^>]*>([\s\S]*?)<\/select>/iu)?.[1];
  if (!block) fail("missing search selector");
  const options = [...block.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/giu)].filter((match) => !(attr(match[1], "value") === "" && /\bdisabled\b/iu.test(match[1]) && plain(match[2]) === "Tipo de alerta")).map((match) => ({ sourceTypeId: attr(match[1], "value"), officialLabel: plain(match[2]) }));
  if (options.length !== codes.length) fail(`search selector has ${options.length} categories`);
  const found = /* @__PURE__ */ new Set();
  for (const option of options) {
    const expected = Object.values(ALERT_TYPES).find(({ sourceTypeId }) => sourceTypeId === option.sourceTypeId);
    if (!expected || found.has(expected.code) || option.officialLabel !== expected.officialLabel) fail(`search selector category changed: ${JSON.stringify(option)}`);
    found.add(expected.code);
  }
  return found;
}
function landing(html2) {
  const categoryLinks = [...html2.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']*\/alertas\/buscador-alertas\?type=[^"']+)["'][^>]*>/giu)].map((match) => new URL(decodeEntities(match[1]), LANDING_URL).searchParams.get("type"));
  if (categoryLinks.length !== codes.length || new Set(categoryLinks).size !== codes.length || categoryLinks.some((id) => !Object.values(ALERT_TYPES).some((type) => type.sourceTypeId === id)))
    fail("landing category links changed");
  const headings = [...html2.matchAll(/<h2\b[^>]*\bdata-section\s*=\s*["']([^"']+)["'][^>]*>/giu)];
  const relevant = headings.filter((heading) => decodeEntities(heading[1]).startsWith("Alertas alimentarias "));
  if (relevant.length !== codes.length) fail(`landing has ${relevant.length} category headings`);
  const found = /* @__PURE__ */ new Set();
  for (let i = 0; i < relevant.length; i += 1) {
    const label = decodeEntities(relevant[i][1]);
    const block = html2.slice(relevant[i].index, relevant[i + 1]?.index ?? html2.length);
    const links = [...block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/giu)].filter((match) => attr(match[1], "title") === "Ver todas");
    if (links.length !== 1) fail(`landing link missing/duplicated: ${label}`);
    const link = new URL(attr(links[0][1], "href"), LANDING_URL);
    const expected = Object.values(ALERT_TYPES).find(({ officialLabel }) => officialLabel === label);
    if (!expected || found.has(expected.code) || link.origin !== "https://www.aesan.gob.es" || link.pathname !== "/alertas/buscador-alertas" || link.searchParams.getAll("type").length !== 1 || link.searchParams.get("type") !== expected.sourceTypeId) fail(`landing category changed: ${label} ${link}`);
    found.add(expected.code);
  }
  return found;
}
function validateControls(landingHtml, searchHtml) {
  const onLanding = landing(landingHtml);
  const onSearch = selector(searchHtml);
  if (codes.some((code) => !onLanding.has(code) || !onSearch.has(code))) fail("landing/search selector mismatch");
}
function filteredUrl(code, page = 1) {
  const type = ALERT_TYPES[code];
  if (!type || !Number.isSafeInteger(page) || page < 1) fail("invalid filtered URL request");
  const url = new URL(page === 1 ? AESAN_LIST_URL : `${AESAN_LIST_URL}/${page}`);
  url.searchParams.set("type", type.sourceTypeId);
  return url.href;
}
function parseFilteredPage(html2, code, page) {
  selector(html2);
  const type = ALERT_TYPES[code];
  const selected = html2.match(/<select\b[^>]*\bid\s*=\s*["']filter-select["'][^>]*\bvalue\s*=\s*["']([^"']+)["']/iu)?.[1];
  if (selected !== type.sourceTypeId) fail(`filtered response type mismatch ${code} page ${page}`);
  const result = html2.match(/<div\b[^>]*\bclass\s*=\s*["']result__info["'][^>]*>([\s\S]*?)<\/div>/iu);
  const range = plain(result?.[1] ?? "").match(/^(\d+)\s*-\s*(\d+)\s+de\s+(\d+)$/u);
  if (!range) fail(`missing result range ${code} page ${page}`);
  const [start, end, total] = range.slice(1).map(Number);
  const lastPage = Math.ceil(total / 20);
  const pagination = html2.match(/<nav\b[^>]*\bclass\s*=\s*["'][^"']*\bpagination\b[^"']*["'][^>]*>[\s\S]*?<\/nav>/iu)?.[0];
  if (!pagination && (lastPage !== 1 || page !== 1)) fail(`missing pagination ${code} page ${page}`);
  let linkedPages = [];
  if (pagination) {
    const active = pagination.match(/<li\b[^>]*\bclass\s*=\s*["'][^"']*\bpagination__active\b[^"']*["'][^>]*\baria-label\s*=\s*["']page\s+(\d+)["']/iu)?.[1];
    if (Number(active) !== page) fail(`wrong active page ${code} page ${page}`);
    linkedPages = [...pagination.matchAll(/<a\b([^>]*)>/giu)].flatMap((match) => {
      const href = attr(match[1], "href");
      if (!href || href === "#") return [];
      const url = new URL(href, AESAN_LIST_URL);
      if (url.hostname !== "www.aesan.gob.es" || url.searchParams.get("type") !== type.sourceTypeId || !/^\/alertas\/buscador-alertas(?:\/\d+)?$/u.test(url.pathname)) fail(`pagination link changed ${code} page ${page}`);
      return [url.pathname === "/alertas/buscador-alertas" ? 1 : Number(url.pathname.split("/").at(-1))];
    });
  }
  const cards2 = [...html2.matchAll(/<a\b([^>]*\bclass\s*=\s*["'][^"']*\bseeMoreCard\b[^"']*["'][^>]*)>[\s\S]*?<\/a>/giu)];
  const urls = cards2.map((match) => officialPublicationUrl(attr(match[1], "href")));
  if (urls.some((url) => !url) || start !== (page - 1) * 20 + 1 || end !== Math.min(page * 20, total) || cards2.length !== end - start + 1 || page > lastPage || linkedPages.some((linked) => linked < 1 || linked > lastPage) || lastPage > 1 && page === 1 && !linkedPages.includes(lastPage) || total < 1) fail(`incomplete filtered page ${code} page ${page}`);
  if (page < lastPage && !linkedPages.includes(page + 1) || page === lastPage && linkedPages.includes(page + 1))
    fail(`pagination continuation changed ${code} page ${page}`);
  return { code, page, total, lastPage, raw: cards2.length, urls };
}
async function scanOfficialTaxonomy(fetchHtml, { maxPages = 200, onPage = () => {
} } = {}) {
  const [landingHtml, searchHtml] = await Promise.all([fetchHtml(LANDING_URL), fetchHtml(AESAN_LIST_URL)]);
  validateControls(landingHtml, searchHtml);
  const provenance = [
    { url: LANDING_URL, sha256: createHash2("sha256").update(landingHtml).digest("hex") },
    { url: AESAN_LIST_URL, sha256: createHash2("sha256").update(searchHtml).digest("hex") }
  ];
  const memberships = /* @__PURE__ */ new Map();
  const metrics = [];
  for (const code of codes) {
    const firstUrl = filteredUrl(code);
    const firstHtml = await fetchHtml(firstUrl);
    const first = parseFilteredPage(firstHtml, code, 1);
    if (first.lastPage > maxPages) fail(`filtered page limit exceeded ${code}: ${first.lastPage}`);
    const pages = [first];
    onPage(firstUrl, firstHtml);
    provenance.push({ url: firstUrl, sha256: createHash2("sha256").update(firstHtml).digest("hex") });
    const pending = Array.from({ length: first.lastPage - 1 }, (_, index) => index + 2);
    const loaded = new Array(pending.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(5, pending.length) }, async () => {
      while (cursor < pending.length) {
        const index = cursor++;
        const page = pending[index];
        loaded[index] = await fetchHtml(filteredUrl(code, page));
      }
    }));
    for (let page = 2; page <= first.lastPage; page += 1) {
      const url = filteredUrl(code, page);
      const html2 = loaded[page - 2];
      const parsed = parseFilteredPage(html2, code, page);
      if (parsed.total !== first.total || parsed.lastPage !== first.lastPage) fail(`filtered pagination shifted ${code} page ${page}`);
      onPage(url, html2);
      provenance.push({ url, sha256: createHash2("sha256").update(html2).digest("hex") });
      pages.push(parsed);
    }
    const unique = new Set(pages.flatMap(({ urls }) => urls));
    metrics.push({ code, pages: pages.length, raw: pages.reduce((n, page) => n + page.raw, 0), unique: unique.size });
    for (const url of unique) {
      const matches = memberships.get(url) ?? [];
      matches.push(exactTuple(code));
      memberships.set(url, matches);
    }
  }
  for (const [url, matches] of memberships) if (matches.length > 1) fail(`publication appears in multiple categories ${url}`);
  return { memberships, metrics, provenance };
}

// ops/sr271-aesan-official-read.mjs
if (Number(process.env.GITHUB_RUN_ATTEMPT) !== 1 || Date.now() > Date.parse("2026-10-09T09:30:00Z")) throw Error("Read probe expired");
var cache = /* @__PURE__ */ new Map();
var requests = 0;
var html = async (url) => {
  if (cache.has(url)) return cache.get(url);
  const u = new URL(url);
  if (u.origin !== "https://www.aesan.gob.es" || !u.pathname.startsWith("/alertas/")) throw Error("Official GET authority guard");
  requests++;
  const r2 = await fetch(url, { method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(25e3) });
  if (!r2.ok) throw Error("Official GET " + r2.status + " " + url);
  const text = await r2.text();
  if (Buffer.byteLength(text) > 2e6) throw Error("Page bound");
  cache.set(url, text);
  return text;
};
var scan = await scanOfficialTaxonomy(html, { maxPages: 40 });
console.log("R13_AESAN_TAXONOMY " + JSON.stringify({ at: (/* @__PURE__ */ new Date()).toISOString(), metrics: scan.metrics, provenance: scan.provenance }));
var cards = [...parseListCards(await html(AESAN_LIST_URL)), ...parseListCards((await html(LANDING_URL)).replace(/\bseeMoreCardSlide\b/gu, "seeMoreCard seeMoreCardSlide"))];
for (const path of ["2026_71", "2026_70", "2026_52_Ampliacion_1"]) {
  const url = "https://www.aesan.gob.es/alertas/" + path, page = await html(url), identity = sourceIdentityForHtml(page, url);
  const card = cards.find((c) => c.url === url) ?? { url, title: "", reference: null, publishedAt: null };
  const parsed = parseDetail(page, card, null, (/* @__PURE__ */ new Date()).toISOString(), identity);
  const headings = [...page.matchAll(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/giu)].map((m) => stripHtml(m[0]));
  const labels = Object.values(ALERT_TYPES).map((t) => ({ code: t.code, count: page.split(t.officialLabel).length - 1, contexts: [...page.matchAll(new RegExp(t.officialLabel.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "gu"))].map((m) => page.slice(Math.max(0, m.index - 300), m.index + t.officialLabel.length + 200)) }));
  console.log("R13_AESAN_PUBLICATION " + JSON.stringify({ url, htmlSha256: createHash3("sha256").update(page).digest("hex"), identity, membership: scan.memberships.get(url) ?? [], listingCard: card, headings, labels, record: { id: parsed.id, reference: parsed.reference, title: parsed.title, sourceRecordHash: parsed.sourceRecordHash, contentHash: parsed.contentHash, publishedAt: parsed.publishedAt, publishedFields: parsed.publishedFields, materialParagraphs: parsed.materialParagraphs, officialDates: parsed.officialDates } }));
}
var root = "https://api.cloudflare.com/client/v4/accounts/9c1807c68493f14259248b5f5782cc6f";
var db = "55596003-1b90-4f66-aad8-decb21205f13";
var sqls = ["SELECT id,reference,url,content_hash,version_count,published_at,updated_at,json_extract(canonical_json,'$.identity') AS identity,json_extract(canonical_json,'$.sourceRecord.aesanAlertClassification') AS classification FROM alerts WHERE source='AESAN' AND reference IN ('ES2026/606','ES2026/604','ES2026/382')", "SELECT * FROM source_sync_state WHERE source='AESAN'", "SELECT owner_id,epoch,expires_at,state_json FROM source_reliability_control WHERE id=1", "SELECT id,source,mode,kind,phase,started_at,deadline,finished_at,receipt_json FROM source_reliability_jobs WHERE id='7eca0f35-ab72-417e-947e-3a0cd9add999'", "SELECT effect_key,job_id,ordinal,committed_at FROM source_reliability_effects WHERE job_id='7eca0f35-ab72-417e-947e-3a0cd9add999'"];
var r = await fetch(root + "/d1/database/" + db + "/query", { method: "POST", headers: { Authorization: "Bearer " + process.env.CF_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ batch: sqls.map((sql) => ({ sql })) }), signal: AbortSignal.timeout(3e4) });
var p = await r.json();
if (!r.ok || !p.success || p.result.some((x) => !x.success || x.meta?.changes || x.meta?.rows_written || x.meta?.served_by_primary !== true)) throw Error("Primary SELECT unconfirmed");
for (let i = 0; i < sqls.length; i++) {
  for (const row of p.result[i].results) if (row.state_json) {
    const state = JSON.parse(row.state_json);
    delete state.ownershipFingerprint;
    row.state_json = JSON.stringify(state);
  }
  console.log("R13_AESAN_SELECT " + JSON.stringify({ sql: sqls[i], rows: p.result[i].results }));
}
console.log("R13_AESAN_READ_COMPLETE " + JSON.stringify({ zeroWrite: true, requests, at: (/* @__PURE__ */ new Date()).toISOString() }));
