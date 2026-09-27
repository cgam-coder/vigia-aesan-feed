import { readFile } from "node:fs/promises";
import { resolve4, resolve6, resolveCname, resolveNs } from "node:dns/promises";

const requestPath = process.argv[2];
if (!requestPath) throw new Error("missing request path");
const request = JSON.parse(await readFile(requestPath, "utf8"));
if (
  request?.operation !== "audit" ||
  typeof request?.nonce !== "string" ||
  !/^[A-Za-z0-9._:-]{8,120}$/.test(request.nonce) ||
  Object.keys(request).some((key) => !["operation", "nonce"].includes(key))
) throw new Error("invalid audit request");

const token = process.env.CLOUDFLARE_API_TOKEN;
let accountId = process.env.CLOUDFLARE_ACCOUNT_ID || null;
if (!token) throw new Error("missing Cloudflare API token");
const discoveredAccountIds = new Set();

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

const cfGet = async (path) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = null; }
  if (!response.ok || body?.success !== true) {
    const errors = Array.isArray(body?.errors) ? body.errors.map((x) => x?.message).filter(Boolean) : [];
    throw new Error(`Cloudflare GET ${path} failed HTTP ${response.status}: ${errors.join("; ").slice(0,500)}`);
  }
  return body;
};

const safeResolve = async (fn, host) => {
  try { return await fn(host); }
  catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "ERROR";
    if (["ENODATA","ENOTFOUND","ESERVFAIL"].includes(code)) return [];
    return [`ERROR:${code}`];
  }
};

const probe = async (label, url) => {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
    });
    const body = await response.arrayBuffer();
    console.log("HTTP_PROBE " + JSON.stringify({
      label,
      status: response.status,
      finalUrl: response.url,
      bytes: body.byteLength,
    }));
  } catch (error) {
    console.log("HTTP_PROBE " + JSON.stringify({
      label,
      status: null,
      finalUrl: null,
      error: error instanceof Error ? error.message.slice(0,300) : String(error).slice(0,300),
    }));
  }
};

console.log("PUBLIC_ROUTING_AUDIT " + JSON.stringify({ nonce: request.nonce }));

for (const host of ["nagamealert.com", "www.nagamealert.com", "nagamealert.es", "www.nagamealert.es"]) {
  const [a, aaaa, cname, ns] = await Promise.all([
    safeResolve(resolve4, host),
    safeResolve(resolve6, host),
    safeResolve(resolveCname, host),
    safeResolve(resolveNs, host),
  ]);
  console.log("PUBLIC_DNS " + JSON.stringify({ host, A:a, AAAA:aaaa, CNAME:cname, NS:ns }));
}

await probe("apex", "https://nagamealert.com/");
await probe("www", "https://www.nagamealert.com/");
await probe("es", "https://nagamealert.es/");
await probe("es_www", "https://www.nagamealert.es/");
await probe("worker", "https://vigia-runtime.c-gamiz93.workers.dev/");

const seoProbe = async () => {
  const base = "https://vigia-runtime.c-gamiz93.workers.dev";
  const page = await fetch(base + "/es/", { redirect:"follow", signal:AbortSignal.timeout(60_000) });
  const html = await page.text();
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1]
    ?? null;
  const hreflangs = [...html.matchAll(/hreflang=["']([^"']+)["']/gi)].map((m)=>m[1]).sort();

  const robotsResponse = await fetch(base + "/robots.txt", { redirect:"follow", signal:AbortSignal.timeout(60_000) });
  const robots = await robotsResponse.text();
  const sitemapResponse = await fetch(base + "/sitemap.xml", { redirect:"follow", signal:AbortSignal.timeout(60_000) });
  const sitemap = await sitemapResponse.text();

  console.log("WORKER_SEO " + JSON.stringify({
    pageStatus:page.status,
    canonical,
    hreflangs,
    robotsStatus:robotsResponse.status,
    robotsAllowsPublic:/Allow:\s*\//i.test(robots),
    robotsDisallowAll:/Disallow:\s*\/\s*(?:\r?\n|$)/i.test(robots),
    robotsHasCanonicalHost:robots.includes("https://nagamealert.com"),
    sitemapStatus:sitemapResponse.status,
    sitemapHasCanonicalOrigin:sitemap.includes("https://nagamealert.com"),
    sitemapHasWorkersDev:sitemap.includes("workers.dev"),
  }));
};
await seoProbe();



let cloudflareApiStatus = "unavailable";
try {
  const verify = await cfGet("/user/tokens/verify");
  if (verify?.result?.status !== "active") throw new Error("Cloudflare token is not active");
  console.log("CF_TOKEN " + JSON.stringify({ status: "active" }));
  
  for (const zoneName of ["nagamealert.com", "nagamealert.es"]) {
    const zoneResult = await cfGet(`/zones?name=${encodeURIComponent(zoneName)}&status=active&per_page=50`);
    const zones = Array.isArray(zoneResult.result) ? zoneResult.result : [];
    console.log("CF_ZONE " + JSON.stringify({
      name: zoneName,
      found: zones.length === 1,
      status: zones[0]?.status ?? null,
      nameServers: Array.isArray(zones[0]?.name_servers) ? zones[0].name_servers : [],
      plan: zones[0]?.plan?.name ?? null,
    }));
  
    if (zones.length === 1) {
      const zoneId = zones[0].id;
      if (typeof zones[0]?.account?.id === "string") discoveredAccountIds.add(zones[0].account.id);
      const recordResult = await cfGet(`/zones/${zoneId}/dns_records?per_page=100`);
      const wanted = new Set([zoneName, `www.${zoneName}`]);
      const records = (Array.isArray(recordResult.result) ? recordResult.result : [])
        .filter((row) => wanted.has(row.name))
        .map((row) => ({
          name: row.name,
          type: row.type,
          content: row.content,
          proxied: row.proxied ?? null,
          ttl: row.ttl ?? null,
        }));
      console.log("CF_DNS " + JSON.stringify({ zone: zoneName, records }));
  
      const routeResult = await cfGet(`/zones/${zoneId}/workers/routes`);
      const routes = (Array.isArray(routeResult.result) ? routeResult.result : [])
        .map((row) => ({ pattern: row.pattern, script: row.script ?? null }));
      console.log("CF_WORKER_ROUTES " + JSON.stringify({ zone: zoneName, routes }));
    }
  }
  
  if (!accountId && discoveredAccountIds.size === 1) accountId = [...discoveredAccountIds][0];
  if (accountId) {
    const domainResult = await cfGet(`/accounts/${accountId}/workers/domains`);
    const domains = (Array.isArray(domainResult.result) ? domainResult.result : [])
      .map((row) => ({
        hostname: row.hostname ?? null,
        service: row.service ?? null,
        environment: row.environment ?? null,
        zoneName: row.zone_name ?? null,
      }));
    console.log("CF_WORKER_DOMAINS " + JSON.stringify({ domains }));
  } else {
    console.log("CF_WORKER_DOMAINS " + JSON.stringify({ unavailable:"account-id-not-resolved" }));
  }
  
  
  cloudflareApiStatus = "PASS";
} catch (error) {
  console.log("CF_API_UNAVAILABLE " + JSON.stringify({
    error: error instanceof Error ? error.message.slice(0,500) : String(error).slice(0,500)
  }));
}

console.log("PUBLIC_ROUTING_AUDIT " + JSON.stringify({
  status: cloudflareApiStatus === "PASS" ? "PASS" : "PARTIAL",
  cloudflareApi: cloudflareApiStatus
}));
