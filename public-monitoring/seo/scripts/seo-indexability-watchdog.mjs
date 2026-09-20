const ORIGIN = "https://nagamealert.com";
const SOURCES = ["AESAN", "RAPNA", "RASFF", "SAFETY GATE", "OECD"];
const SEGMENTS = { AESAN:"aesan", RAPNA:"rapna", RASFF:"rasff", "SAFETY GATE":"safety-gate", OECD:"oecd" };
const OFFICIAL_PORTALS = {
  AESAN:"https://www.aesan.gob.es/alertas/buscador-alertas",
  RAPNA:"https://servicios.consumo.gob.es/rapnaPublic/",
  RASFF:"https://webgate.ec.europa.eu/rasff-window/screen/search",
  "SAFETY GATE":"https://ec.europa.eu/safety-gate-alerts/screen/webReport",
  OECD:"https://globalrecalls.oecd.org/",
};

const fail = (message) => { throw new Error(message); };
const expect = (condition, message) => { if (!condition) fail(message); };
const xmlValues = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}>([^<]+)</${tag}>`, "gu"))].map((match) => match[1]);
const stableKey = (value) => Buffer.from(value, "utf8").toString("base64url");
const slug = (value) => value.trim().normalize("NFKD").replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("es")
  .replace(/[’']/gu, "").replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 96).replace(/-+$/gu, "") || "alerta";
const detailUrl = (locale, alert) => `${ORIGIN}/${locale}/${locale === "es" ? "alerta" : "alert"}/${SEGMENTS[alert.source]}/${stableKey(alert.id)}/${slug(alert.title)}`;

async function read(url) {
  const response = await fetch(url, { redirect:"follow", headers:{ "user-agent":"NagameAlert-SEO-Watchdog/1.0" }, signal:AbortSignal.timeout(45_000) });
  return { response, body:await response.text() };
}

const meta = (html, name) => html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, "iu"))?.[1]
  ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, "iu"))?.[1] ?? "";
const link = (html, rel, hreflang) => {
  const tags = html.match(/<link\b[^>]*>/giu) ?? [];
  return tags.find((tag) => new RegExp(`rel=["']${rel}["']`, "iu").test(tag)
    && (!hreflang || new RegExp(`href(?:L|l)ang=["']${hreflang}["']`, "iu").test(tag)))
    ?.match(/href=["']([^"']+)["']/iu)?.[1] ?? "";
};

async function checkDetail(url, counterparts) {
  const { response, body } = await read(url);
  expect(response.status === 200, `${url}: HTTP ${response.status}`);
  expect(!/noindex/iu.test(meta(body, "robots")), `${url}: noindex`);
  expect(link(body, "canonical") === url, `${url}: canonical no self`);
  for (const [locale, expected] of Object.entries(counterparts)) {
    expect(link(body, "alternate", locale) === expected, `${url}: hreflang ${locale}`);
  }
  expect(/type=["']application\/ld\+json["']/iu.test(body), `${url}: sin JSON-LD`);
  for (const kind of ["WebPage", "BreadcrumbList", "WebSite"]) expect(body.includes(`\"@type\":\"${kind}\"`), `${url}: JSON-LD sin ${kind}`);
}

async function checkSourcePage(locale, source) {
  const root = locale === "es" ? "fuentes" : "sources";
  const path = `/${locale}/${root}/${SEGMENTS[source]}`;
  const url = `${ORIGIN}${path}`;
  const { response, body } = await read(url);
  expect(response.status === 200, `${url}: HTTP ${response.status}`);
  expect(!/noindex/iu.test(meta(body, "robots")), `${url}: noindex`);
  expect(link(body, "canonical") === url, `${url}: canonical no self`);
  expect(link(body, "alternate", "es") === `${ORIGIN}/es/fuentes/${SEGMENTS[source]}`, `${url}: hreflang es`);
  expect(link(body, "alternate", "en") === `${ORIGIN}/en/sources/${SEGMENTS[source]}`, `${url}: hreflang en`);
  expect(link(body, "alternate", "x-default") === `${ORIGIN}/es/fuentes/${SEGMENTS[source]}`, `${url}: hreflang x-default`);
  expect(/<h1\b[^>]*>[^<]+<\/h1>/iu.test(body), `${url}: sin H1`);
  for (const kind of ["WebPage", "BreadcrumbList"]) expect(body.includes(`\"@type\":\"${kind}\"`), `${url}: JSON-LD sin ${kind}`);
  expect(body.includes(`href=\"${OFFICIAL_PORTALS[source]}\"`), `${url}: sin enlace al portal oficial`);
  expect(new RegExp(`href=\"/${locale}/${locale === "es" ? "alerta" : "alert"}/${SEGMENTS[source]}/`, "u").test(body), `${url}: sin enlace interno a alert detail`);
  return url;
}

async function checkMethodology(locale) {
  const path = `/${locale}/${locale === "es" ? "metodologia" : "methodology"}`;
  const url = `${ORIGIN}${path}`;
  const { response, body } = await read(url);
  expect(response.status === 200, `${url}: HTTP ${response.status}`);
  expect(!/noindex/iu.test(meta(body, "robots")), `${url}: noindex`);
  expect(link(body, "canonical") === url, `${url}: canonical no self`);
  expect(link(body, "alternate", "es") === `${ORIGIN}/es/metodologia`, `${url}: hreflang es`);
  expect(link(body, "alternate", "en") === `${ORIGIN}/en/methodology`, `${url}: hreflang en`);
  expect(link(body, "alternate", "x-default") === `${ORIGIN}/es/metodologia`, `${url}: hreflang x-default`);
  for (const kind of ["WebPage", "BreadcrumbList"]) expect(body.includes(`\"@type\":\"${kind}\"`), `${url}: JSON-LD sin ${kind}`);
}

async function run() {
  const report = { checkedAt:new Date().toISOString(), sources:{}, sitemapChildren:0 };
  const robots = await read(`${ORIGIN}/robots.txt`);
  expect(robots.response.status === 200, "robots.txt no devuelve 200");
  expect(/User-Agent:\s*\*/iu.test(robots.body) && /Allow:\s*\//iu.test(robots.body), "robots.txt no permite el rastreo público");
  expect(!/Disallow:\s*\/(?:es|en)(?:\/|$)/iu.test(robots.body), "robots.txt bloquea una superficie pública");
  expect(robots.body.includes(`Sitemap: ${ORIGIN}/sitemap.xml`), "robots.txt no declara el sitemap canónico");

  const root = await read(`${ORIGIN}/sitemap.xml`);
  expect(root.response.status === 200 && /<sitemapindex\b/iu.test(root.body), "sitemap.xml no es un índice XML válido");
  const children = xmlValues(root.body, "loc");
  report.sitemapChildren = children.length;
  for (const locale of ["es", "en"]) for (const source of SOURCES) {
    const prefix = `${ORIGIN}/sitemaps/alerts-${locale}-${SEGMENTS[source]}-`;
    expect(children.some((url) => url.startsWith(prefix)), `sitemap sin ${source} ${locale}`);
  }

  for (const locale of ["es", "en"]) {
    const rootName = locale === "es" ? "fuentes" : "sources";
    const hubUrl = `${ORIGIN}/${locale}/${rootName}`;
    const hub = await read(hubUrl);
    expect(hub.response.status === 200, `${hubUrl}: HTTP ${hub.response.status}`);
    for (const source of SOURCES) expect(hub.body.includes(`href=\"/${locale}/${rootName}/${SEGMENTS[source]}\"`), `${hubUrl}: sin enlace interno ${source}`);
    for (const official of Object.values(OFFICIAL_PORTALS)) expect(!hub.body.includes(`href=\"${official}\"`), `${hubUrl}: enlace oficial directo en el hub`);
    const staticName = `${ORIGIN}/sitemaps/static-${locale}.xml`;
    const staticSitemap = await read(staticName);
    expect(staticSitemap.response.status === 200, `${staticName}: HTTP ${staticSitemap.response.status}`);
    for (const source of SOURCES) {
      const page = await checkSourcePage(locale, source);
      expect(staticSitemap.body.includes(`<loc>${page}</loc>`), `${staticName}: falta ${page}`);
    }
    await checkMethodology(locale);
  }

  const shardCache = new Map();
  const shardBody = async (url) => {
    if (!shardCache.has(url)) shardCache.set(url, read(url));
    const result = await shardCache.get(url);
    expect(result.response.status === 200 && /<urlset\b/iu.test(result.body), `${url}: sitemap shard inválido`);
    return result.body;
  };

  for (const source of SOURCES) {
    const api = await read(`${ORIGIN}/api/terminal/alerts?period=all&country=ALL&source=${encodeURIComponent(source)}&pageSize=1`);
    expect(api.response.status === 200, `${source}: API newest HTTP ${api.response.status}`);
    const alert = JSON.parse(api.body).items?.[0];
    expect(alert?.source === source, `${source}: newest no disponible`);
    const es = detailUrl("es", alert); const en = detailUrl("en", alert);
    const counterparts = { es, en, "x-default":es };
    for (const [locale, url] of [["es", es], ["en", en]]) {
      const matching = children.filter((child) => child.startsWith(`${ORIGIN}/sitemaps/alerts-${locale}-${SEGMENTS[source]}-`)).reverse();
      let present = false;
      for (const child of matching) if ((await shardBody(child)).includes(`<loc>${url}</loc>`)) { present = true; break; }
      expect(present, `${source}: newest ${locale} no aparece en sitemap`);
      await checkDetail(url, counterparts);
    }
    report.sources[source] = { id:alert.id, reference:alert.reference, es, en };
  }

  for (const locale of ["es", "en"]) {
    const archive = `${ORIGIN}/${locale}/${locale === "es" ? "alertas" : "alerts"}`;
    const clean = await read(archive);
    expect(clean.response.status === 200 && !/noindex/iu.test(meta(clean.body, "robots")), `${archive}: archivo limpio no indexable`);
    const filtered = await read(`${archive}?source=RASFF&period=all`);
    expect(filtered.response.status === 200 && /noindex/iu.test(meta(filtered.body, "robots")), `${archive}: filtro indexable`);
  }
  for (const legal of ["/es/privacidad", "/es/cookies", "/es/aviso-legal", "/en/privacy", "/en/cookies", "/en/legal-notice"]) {
    const page = await read(`${ORIGIN}${legal}`);
    expect(page.response.status === 200 && /noindex/iu.test(meta(page.body, "robots")), `${legal}: legal indexable`);
  }
  console.log(JSON.stringify(report));
}

run().catch((error) => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1; });
