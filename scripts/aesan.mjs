import { createHash } from "node:crypto";

export const AESAN_ORIGIN = "https://www.aesan.gob.es";
export const AESAN_LIST_URL = `${AESAN_ORIGIN}/alertas/buscador-alertas`;

const MONTHS = new Map([
  ["enero", 0], ["febrero", 1], ["marzo", 2], ["abril", 3], ["mayo", 4], ["junio", 5],
  ["julio", 6], ["agosto", 7], ["septiembre", 8], ["setiembre", 8], ["octubre", 9],
  ["noviembre", 10], ["diciembre", 11],
]);

const NAMED_ENTITIES = new Map([
  ["nbsp", " "], ["amp", "&"], ["quot", "\""], ["apos", "'"], ["lt", "<"], ["gt", ">"],
  ["aacute", "á"], ["eacute", "é"], ["iacute", "í"], ["oacute", "ó"], ["uacute", "ú"],
  ["ntilde", "ñ"], ["Aacute", "Á"], ["Eacute", "É"], ["Iacute", "Í"], ["Oacute", "Ó"],
  ["Uacute", "Ú"], ["Ntilde", "Ñ"], ["uuml", "ü"], ["Uuml", "Ü"],
]);

export function decodeEntities(value = "") {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
    if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return NAMED_ENTITIES.get(code) ?? entity;
  });
}

export function stripHtml(value = "") {
  return decodeEntities(value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:p|li|ul|ol|div|section|article|figure|h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const attribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')`, "i"));
  return decodeEntities(match?.[1] ?? match?.[2] ?? "").trim();
};

const absoluteOfficialUrl = (value) => {
  try {
    const url = new URL(value, AESAN_ORIGIN);
    if (url.hostname !== "aesan.gob.es" && !url.hostname.endsWith(".aesan.gob.es")) return null;
    url.protocol = "https:";
    return url.toString();
  } catch {
    return null;
  }
};

export function isOfficialAesanAlertUrl(value) {
  const url = absoluteOfficialUrl(value);
  if (!url) return false;
  const path = new URL(url).pathname;
  return /^\/alertas\/(?!buscador-alertas(?:\/|$)|alertas-alimentarias(?:\/|$))[^/?#]+/i.test(path) ||
    /^\/AECOSAN\/web\/seguridad_alimentaria\/(?:alertas_alimentarias|ampliacion)\/(?!listado\/)[^/?#]+\.htm$/i.test(path);
}

const normalizeReference = (value = "") => {
  const match = value.match(/ES\s*(20\d{2})\s*[/.\-]\s*(\d+)/i);
  return match ? `ES${match[1]}/${match[2]}` : "";
};

export function parseSpanishDate(value = "") {
  const match = stripHtml(value).normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .match(/\b(\d{1,2})\s+([a-z]+)\s+(20\d{2})\b/i);
  if (!match) return null;
  const month = MONTHS.get(match[2].toLowerCase());
  if (month === undefined) return null;
  return new Date(Date.UTC(Number(match[3]), month, Number(match[1]), 12)).toISOString();
}

const categoryFor = (title, icon = "", body = "") => {
  const value = `${icon} ${title} ${body}`.toLowerCase();
  if (/\bpill\b|complementos? alimenticios?|sildenafilo|tadalafilo/.test(value)) return "supplements";
  if (/\bcookie\b|advertencia|alerg|intoler|no declarad|etiquetado incorrecto/.test(value)) return "allergens";
  return "general";
};

export function parseListCards(html) {
  const cards = new Map();
  const pattern = /<a\b([^>]*\bclass\s*=\s*(?:\"[^\"]*\bseeMoreCard\b[^\"]*\"|'[^']*\bseeMoreCard\b[^']*')[^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const href = absoluteOfficialUrl(attribute(match[1], "href"));
    if (!href || !isOfficialAesanAlertUrl(href)) continue;
    const title = attribute(match[1], "title") || stripHtml(match[2].match(/<p\b[^>]*\bseeMoreCard__text\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    if (!title) continue;
    const dateText = stripHtml(match[2].match(/<[^>]*\bseeMoreCard-heading__value\b[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
    const icon = stripHtml(match[2].match(/<[^>]*\bseeMoreCard-heading__icon\b[^>]*>([\s\S]*?)<\//i)?.[1] ?? "");
    const reference = normalizeReference(title);
    cards.set(href, { url:href, title, reference, publishedAt:parseSpanishDate(dateText), category:categoryFor(title, icon) });
  }
  return [...cards.values()];
}

const fieldMap = (articleHtml) => {
  const fields = new Map();
  for (const item of articleHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = stripHtml(item[1]);
    const match = text.match(/^([^:\n]{2,90})\s*:\s*([\s\S]+)$/);
    if (match) fields.set(match[1].toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, ""), match[2].trim().replace(/[.;]+$/, ""));
  }
  return fields;
};

const findFieldEntry = (fields, labels) => {
  for (const [label, value] of fields) {
    if (labels.some((candidate) => label === candidate || label.startsWith(`${candidate} `))) return { label, value };
  }
  return null;
};

const findField = (fields, labels) => findFieldEntry(fields, labels)?.value ?? "";

export const normalizeEntityKey = (value = "") => stripHtml(value)
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase()
  .replace(/\b(?:s\.?l\.?u?|s\.?a\.?u?|s\.?c\.?|sociedad limitada|sociedad anonima)\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export const productClassFor = (product = "", title = "", alertCategory = "") => {
  const normalized = (value) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const productValue = normalized(product);
  const titleValue = normalized(title);
  const classes = [
    ["Complementos alimenticios", /complemento alimenticio|suplemento|capsul|comprimido|extracto|vitamin|minerales?/],
    ["Carne y productos cárnicos", /carne|carnic|salchich|choriz|fuet|jamon|lomo embuchado|mortadela|hamburgues|pollo|pavo|cerdo|vacuno/],
    ["Pescado y marisco", /pescad|marisc|bacalao|salmon|atun|anchoa|langost|gamba|camaron|mejillon|almeja|calamar|pulpo|necora/],
    ["Leche y productos lácteos", /\bleche\b|lacte|queso|yogur|nata|mantequilla|helado/],
    ["Platos preparados y sopas", /plato preparado|precocinado|sopa|pizza|lasana|tortilla|croqueta|kit ramen/],
    ["Cereales, panadería y pasta", /harina|pan\b|bolleri|galleta|cereal|pasta|fideo|ramen|trigo|centeno|avena|arroz|maiz/],
    ["Bebidas", /bebida|zumo|jugo|cerveza|vino|licor|refresco|infusion|te\b|cafe/],
    ["Frutas y hortalizas", /fruta|hortaliza|verdura|lechuga|espinaca|tomate|patata|seta|manzana|moringa|brotes? germinad/],
    ["Frutos secos y semillas", /fruto seco|almendra|avellana|nuez|pistacho|cacahuete|sesamo|semilla/],
    ["Dulces y confitería", /chocolate|cacao|caramelo|golosina|confiteria|dulce|postre|crema de cacao/],
    ["Condimentos, salsas y especias", /especia|condimento|salsa|canela|pimenton|curcuma|mostaza|mayonesa/],
    ["Aceites y grasas", /aceite|grasa vegetal|margarina/],
  ];
  return classes.find(([, pattern]) => pattern.test(productValue))?.[0] ||
    classes.find(([, pattern]) => pattern.test(titleValue))?.[0] ||
    (alertCategory === "supplements" ? "Complementos alimenticios" : "Otros alimentos");
};

const providerFor = (fields) => {
  const groups = [
    { role:"Fabricante", labels:["fabricante", "empresa fabricante"] },
    { role:"Distribuidor", labels:["distribuidor", "empresa distribuidora"] },
    { role:"Importador", labels:["importador", "empresa importadora"] },
    { role:"Comercializador", labels:["comercializador", "empresa comercializadora"] },
    { role:"Operador alimentario", labels:["operador alimentario", "operador", "empresa responsable", "nombre de la empresa", "empresa", "razon social"] },
  ];
  for (const group of groups) {
    const entry = findFieldEntry(fields, group.labels);
    if (entry?.value) return { name:entry.value, role:group.role, evidence:`Campo oficial: ${entry.label}` };
  }
  return { name:"", role:"", evidence:"" };
};

const inferHazard = (text) => {
  const value = text.toLowerCase();
  const hazards = [
    ["salmonella", "Salmonella spp."], ["listeria", "Listeria monocytogenes"],
    ["escherichia coli", "E. coli"], ["stec", "E. coli STEC"], ["histamina", "Histamina"],
    ["cereulida", "Cereulida"], ["bacillus cereus", "Bacillus cereus"],
    ["toxina botul", "Toxina botulínica"], ["aflatox", "Aflatoxinas"],
    ["sildenafilo", "Sildenafilo"], ["tadalafilo", "Tadalafilo"],
    ["fragmentos de vidrio", "Fragmentos de vidrio"], ["partículas de aluminio", "Partículas de aluminio"],
    ["fragmentos de plástico", "Fragmentos de plástico"], ["fragmentos metálicos", "Fragmentos metálicos"],
    ["cuerpos extraños", "Cuerpos extraños"],
  ];
  let found = hazards.filter(([needle]) => value.includes(needle)).map(([, label]) => label);
  if (found.some((label) => label.startsWith("Fragmentos de ") || label.startsWith("Partículas de "))) {
    found = found.filter((label) => label !== "Cuerpos extraños");
  }
  if (/advertencia|alerg|intoler|no declarad|etiquetado incorrecto/.test(value)) {
    const allergens = [
      ["leche", "Leche no declarada"], ["lactosa", "Lactosa no declarada"], ["gluten", "Gluten no declarado"],
      ["almendra", "Almendra no declarada"], ["huevo", "Huevo no declarado"], ["soja", "Soja no declarada"],
      ["cacahuete", "Cacahuete no declarado"], ["sésamo", "Sésamo no declarado"], ["pescado", "Pescado no declarado"],
      ["sulfit", "Sulfitos no declarados"], ["trigo", "Trigo no declarado"], ["frutos secos", "Frutos secos no declarados"],
    ];
    found.push(...allergens.filter(([needle]) => value.includes(needle)).map(([, label]) => label));
  }
  return [...new Set(found)].join(" · ") || "Consultar publicación oficial";
};

const inferPriority = (text) => {
  const value = text.toLowerCase();
  if (/brote|fallecid|hospitaliz|riesgo grave/.test(value)) return "Crítica";
  if (/salmonella|listeria|escherichia|stec|toxina|cereulida|bacillus|aflatox|sildenafilo|tadalafilo|histamina|vidrio|aluminio|plástico|metal|cuerpos extraños/.test(value)) return "Alta";
  return "Media";
};

const titleProduct = (title) => title.match(/\ben\s+(.+?)(?:\s+procedente(?:s)?\s+de\b|\s*\(Ref\b|[.;]|$)/i)?.[1]
  ?.replace(/^(?:el\s+)?etiquetado\s+(?:incorrecto\s+de\s+al[eé]rgeno\s+\([^)]*\)\s+)?/i, "")
  .trim() ?? "Consultar ficha oficial";

const originFor = (title, fields) => findField(fields, ["pais de origen", "origen"]) ||
  title.match(/procedente(?:s)?\s+de\s+(.+?)(?:\s*\(Ref\b|[.;]|$)/i)?.[1]?.trim() || "No indicado";

const sentences = (text) => text.split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜ])/).map((line) => line.trim()).filter(Boolean);

const scopeFor = (text, category) => sentences(text).find((line) =>
  /distribuci[oó]n (?:inicial|del producto)|distribuido (?:inicialmente|en)|ha sido distribuido/i.test(line))?.slice(0, 360) ||
  (category === "allergens" ? "Colectivo alérgico o intolerante indicado por AESAN" :
    category === "supplements" ? "Personas consumidoras del complemento alimenticio indicado" : "Población general · publicación oficial AESAN");

const actionFor = (text) => sentences(text).find((line) =>
  /(?:como medida de precauci[oó]n,?\s+)?se recomienda|se abstengan de consumir|retirada de (?:los )?productos|\bno consumir\b/i.test(line))?.slice(0, 360) ||
  "Consultar las medidas y recomendaciones incluidas en la ficha oficial de AESAN.";

const listLots = (value) => {
  if (!value) return [];
  if (/^todos? los lotes/i.test(value)) return [value];
  return value.split(/\s*[;,]\s*|\s+y\s+(?=[A-Z0-9])/).map((lot) => lot.trim()).filter(Boolean).slice(0, 20);
};

const digest = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

const articleFragment = (html) => {
  const start = html.search(/<h1\b[^>]*\baesan-title\b/i);
  if (start < 0) return html;
  const end = html.slice(start).search(/<a\b[^>]*href\s*=\s*["']\/alertas\/buscador-alertas["']/i);
  return end < 0 ? html.slice(start) : html.slice(start, start + end);
};

const contentDate = (html) => {
  const tag = html.match(/<meta\b[^>]*\bname\s*=\s*["']content-date["'][^>]*>/i)?.[0] ?? "";
  const value = attribute(tag, "content");
  return value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toISOString() : null;
};

export function parseDetail(html, card, previous = null, detectedAt = new Date().toISOString()) {
  const articleHtml = articleFragment(html);
  const articleText = stripHtml(articleHtml);
  const fields = fieldMap(articleHtml);
  const heading = stripHtml(articleHtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const title = heading || card.title;
  const reference = normalizeReference(title) || card.reference || new URL(card.url).pathname.split("/").filter(Boolean).at(-1);
  const product = findField(fields, ["nombre del producto", "denominacion del producto", "producto"]) || titleProduct(title);
  const brand = findField(fields, ["marca", "nombre de marca", "marca comercial"]);
  const provider = providerFor(fields);
  const lotText = findField(fields, ["numero de lote", "nº de lote", "n° de lote", "lote", "lotes"]);
  const category = categoryFor(title, "", articleText);
  const productClass = productClassFor(product, title, category);
  const image = [...articleHtml.matchAll(/<img\b([^>]*)>/gi)].map((match) => absoluteOfficialUrl(attribute(match[1], "src")))
    .find((url) => url && /\/dam\/jcr:/i.test(url)) ?? null;
  const publishedAt = contentDate(html) || card.publishedAt;
  const contentHash = digest({ title, articleText, image, publishedAt });
  const changed = previous?.contentHash && previous.contentHash !== contentHash;
  const normalized = {
    id:`aesan:${reference}`,
    reference,
    source:"AESAN",
    type:"Alimentaria",
    priority:inferPriority(title),
    title,
    product,
    brand,
    productClass,
    productKey:normalizeEntityKey(product),
    brandKey:normalizeEntityKey(brand),
    provider:provider.name,
    providerKey:normalizeEntityKey(provider.name),
    providerRole:provider.role,
    providerEvidence:provider.evidence,
    hazard:inferHazard(title),
    origin:originFor(title, fields),
    scope:scopeFor(articleText, category),
    action:actionFor(articleText),
    lots:listLots(lotText),
    imageUrl:image,
    url:card.url,
    publishedAt,
    detectedAt:previous?.detectedAt || detectedAt,
    updatedAt:changed ? detectedAt : previous?.updatedAt || publishedAt || detectedAt,
    contentHash,
    versionCount:changed ? (previous.versionCount || 1) + 1 : previous?.versionCount || 1,
    isUpdate:/ampliaci[oó]n|actualizaci[oó]n|correcci[oó]n/i.test(title),
  };
  return normalized;
}

export function cardFallback(card, previous = null, detectedAt = new Date().toISOString()) {
  if (previous) return previous;
  const contentHash = digest(card);
  const product = titleProduct(card.title);
  return {
    id:`aesan:${card.reference || new URL(card.url).pathname.split("/").filter(Boolean).at(-1)}`,
    reference:card.reference || `AESAN/${new URL(card.url).pathname.split("/").filter(Boolean).at(-1)}`,
    source:"AESAN", type:"Alimentaria", priority:inferPriority(card.title), title:card.title,
    product, brand:"", productClass:productClassFor(product, card.title, card.category), productKey:normalizeEntityKey(product), brandKey:"",
    provider:"", providerKey:"", providerRole:"", providerEvidence:"",
    hazard:inferHazard(card.title), origin:originFor(card.title, new Map()),
    scope:card.category === "allergens" ? "Colectivo alérgico o intolerante indicado por AESAN" : "Población general · publicación oficial AESAN",
    action:"Consultar las medidas y recomendaciones incluidas en la ficha oficial de AESAN.", lots:[], imageUrl:null,
    url:card.url, publishedAt:card.publishedAt, detectedAt, updatedAt:card.publishedAt || detectedAt,
    contentHash, versionCount:1, isUpdate:/ampliaci[oó]n|actualizaci[oó]n|correcci[oó]n/i.test(card.title),
  };
}

const feedSignature = (feed) => JSON.stringify({ source:feed.source, archive:feed.archive, alerts:feed.alerts });

export function assembleFeed(currentFeed, currentAlerts, now = new Date().toISOString(), options = {}) {
  const unique = new Map();
  for (const alert of [...currentAlerts].sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))) {
    const selected = unique.get(alert.id);
    if (!selected) unique.set(alert.id, alert);
    else unique.set(alert.id, {
      ...selected,
      isUpdate:selected.isUpdate || alert.isUpdate,
      versionCount:Math.max(selected.versionCount || 1, alert.versionCount || 1, 2),
    });
  }
  const activeAlerts = [...unique.values()];
  const activeIds = new Set(activeAlerts.map((alert) => alert.id));
  const archived = (currentFeed?.alerts ?? []).filter((alert) => !activeIds.has(alert.id));
  const alerts = [...activeAlerts, ...archived]
    .sort((a, b) => (b.publishedAt || b.detectedAt || "").localeCompare(a.publishedAt || a.detectedAt || ""));
  const dated = alerts.map((alert) => alert.publishedAt).filter(Boolean).sort();
  const archive = {
    scope:"Archivo público accesible desde el buscador oficial de AESAN",
    totalAlerts:alerts.length,
    earliestPublishedAt:dated[0] ?? null,
    latestPublishedAt:dated.at(-1) ?? null,
    lastFullSyncAt:options.fullSync ? now : currentFeed?.archive?.lastFullSyncAt ?? null,
    pagesScanned:options.pagesScanned ?? currentFeed?.archive?.pagesScanned ?? null,
  };
  const next = { schemaVersion:1, source:{ name:"AESAN", url:AESAN_LIST_URL }, generatedAt:now, archive, alerts };
  if (currentFeed?.generatedAt && feedSignature(currentFeed) === feedSignature(next)) return { ...next, generatedAt:currentFeed.generatedAt };
  return next;
}

export const previousForCard = (alerts, card) => alerts.find((alert) => alert.url === card.url) ??
  alerts.find((alert) => card.reference && alert.reference === card.reference) ?? null;
