import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const ORIGIN = "https://nagamealert.com";
export const HOME_SNAPSHOT_TARGETS = Object.freeze([
  { name:"es", path:"/es/", canonicalPath:"/es/", indexable:true, discovery:true, invalidQuery:false },
  { name:"en", path:"/en/", canonicalPath:"/en/", indexable:true, discovery:true, invalidQuery:false },
  { name:"es-filter", path:"/es/?source=RASFF", canonicalPath:"/es/", indexable:false, discovery:false, invalidQuery:false },
  { name:"es-utm", path:"/es/?utm_source=linkedin&utm_medium=social", canonicalPath:"/es/", indexable:false, discovery:false, invalidQuery:false },
  { name:"en-utm", path:"/en/?utm_source=linkedin&utm_medium=social", canonicalPath:"/en/", indexable:false, discovery:false, invalidQuery:false },
  { name:"es-archive-utm", path:"/es/alertas?utm_source=linkedin&utm_medium=social", canonicalPath:"/es/alertas", indexable:false, discovery:false, invalidQuery:false },
  { name:"en-archive-utm", path:"/en/alerts?utm_source=linkedin&utm_medium=social", canonicalPath:"/en/alerts", indexable:false, discovery:false, invalidQuery:false },
  { name:"es-invalid", path:"/es/?seo_invalid_parameter=1", canonicalPath:"/es/", indexable:false, discovery:false, invalidQuery:true },
]);

// Inspect generated HTTP HTML without treating hydration strings as real links.
export function extractHomepageSignals(html) {
  const markup = html.replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, "");
  const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gu)]
    .map((match) => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]]));
  const tags = [...markup.matchAll(/<(?:meta|link|a|aside|section)\b[^>]*>/giu)]
    .map(([tag]) => ({ tag:tag.match(/^<(\w+)/u)[1].toLowerCase(), attrs:attributes(tag) }));
  const canonicals = tags.filter(({ tag, attrs }) => tag === "link" && /(?:^|\s)canonical(?:\s|$)/iu.test(attrs.rel ?? ""));
  const robots = tags.filter(({ tag, attrs }) => tag === "meta" && /^(?:robots|googlebot)$/iu.test(attrs.name ?? ""));
  const alertLinks = tags.filter(({ tag, attrs }) => {
    if (tag !== "a" || !attrs.href) return false;
    try { const url = new URL(attrs.href, ORIGIN); return url.origin === ORIGIN && /^\/(?:es\/alerta|en\/alert)\//u.test(url.pathname); }
    catch { return false; }
  });
  return {
    canonical:canonicals.length === 1 ? canonicals[0].attrs.href ?? null : null,
    robots:robots.map(({ attrs }) => attrs.content ?? "").join(", "),
    homeDiscovery:tags.some(({ attrs }) => /^(?:Publicaciones recientes|Recent publications)$/u.test(attrs["aria-label"] ?? "")) ? "present" : "absent",
    rawAlertLinks:alertLinks.length,
    invalidQuery:/La URL contiene una consulta no válida|The URL contains an invalid query/iu.test(markup),
    headings:[...markup.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu)].map((match) => match[1].replace(/<[^>]*>/gu, "")),
  };
}

// Evaluate HTTP evidence, never the checked-out commit or Google's index coverage.
// The negative control verifies that the invalid-query detector actually works.
export function validateHomepageSnapshot(report) {
  const failures = [];
  const pages = Array.isArray(report?.pages) ? report.pages : [];
  for (const target of HOME_SNAPSHOT_TARGETS) {
    const url = `${ORIGIN}${target.path}`;
    const matches = pages.filter((page) => page?.url === url);
    const reject = (message) => failures.push(`${target.name}: ${message}`);
    if (matches.length !== 1) { reject(`expected one HTTP observation, received ${matches.length}`); continue; }
    const page = matches[0];
    if (page.error) reject(`fetch failed: ${page.error}`);
    if (page.status !== 200) reject(`HTTP ${page.status ?? "unknown"}`);
    if (page.canonical !== `${ORIGIN}${target.canonicalPath}`) reject("canonical is not the expected clean URL");
    const directives = `${page.robots ?? ""},${page.xRobots ?? ""}`;
    const blocksIndexing = /\b(?:noindex|none)\b/iu.test(directives);
    if (target.indexable && blocksIndexing) reject("clean homepage is blocked by robots directives");
    if (!target.indexable && !blocksIndexing) reject("query variant is missing noindex");
    if (/\b(?:nofollow|none)\b/iu.test(directives)) reject("homepage links are blocked by nofollow");
    if (page.invalidQuery !== target.invalidQuery) reject(target.invalidQuery
      ? "negative control did not detect the deliberately invalid query"
      : "valid landing page shows an invalid-query error, or the detector is missing");
    if (target.discovery) {
      if (page.homeDiscovery !== "present") reject("server-rendered recent-publications block is absent");
      if (!Number.isInteger(page.rawAlertLinks) || page.rawAlertLinks < 1) reject("no real alert anchors in script-free HTTP markup");
    }
  }
  return { status:failures.length ? "FAIL" : "PASS", checkedPages:HOME_SNAPSHOT_TARGETS.length, failures,
    note:"Public HTTP contract result only. This does not identify the deployed commit, prove the cause of absent SSR content, or measure Google indexing." };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.argv[2]) throw new Error("Usage: node scripts/seo-home-contracts.mjs <homepages.json>");
    const verdict = validateHomepageSnapshot(JSON.parse(await readFile(process.argv[2], "utf8")));
    console.log(JSON.stringify(verdict, null, 2));
    if (verdict.status !== "PASS") process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
