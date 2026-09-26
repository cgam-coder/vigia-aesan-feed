import { appendFile, readFile } from "node:fs/promises";

const path = new URL("../ops/runtime-write-target.json", import.meta.url);
const raw = JSON.parse(await readFile(path, "utf8"));
const allowed = new Set([
  "schemaVersion", "active", "sitesBaseUrl", "cloudflareBaseUrl", "cloudflareReady", "reason"
]);

if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
  throw new Error("RUNTIME_WRITE_TARGET invalid configuration");
}
if (Object.keys(raw).some((key) => !allowed.has(key))) {
  throw new Error("RUNTIME_WRITE_TARGET unexpected configuration key");
}
if (raw.schemaVersion !== 1 || !["sites", "cloudflare"].includes(raw.active)) {
  throw new Error("RUNTIME_WRITE_TARGET invalid configuration contract");
}
if (raw.sitesBaseUrl !== "https://vigia-alertas.csar68.chatgpt.site") {
  throw new Error("RUNTIME_WRITE_TARGET invalid Sites base URL");
}
if (raw.cloudflareBaseUrl !== "https://vigia-runtime.c-gamiz93.workers.dev") {
  throw new Error("RUNTIME_WRITE_TARGET invalid Cloudflare base URL");
}
if (typeof raw.cloudflareReady !== "boolean") {
  throw new Error("RUNTIME_WRITE_TARGET invalid readiness flag");
}
if (raw.reason !== null && (typeof raw.reason !== "string" || raw.reason.length > 200)) {
  throw new Error("RUNTIME_WRITE_TARGET invalid reason");
}
if (raw.active === "cloudflare" && raw.cloudflareReady !== true) {
  throw new Error("RUNTIME_WRITE_TARGET cloudflare target is not ready");
}

const baseUrl = raw.active === "sites" ? raw.sitesBaseUrl : raw.cloudflareBaseUrl;
const reason = raw.reason ?? (raw.active === "sites" ? "sites-active" : "cloudflare-active");

console.log(
  "RUNTIME_WRITE_TARGET active=" + raw.active +
  " cloudflareReady=" + String(raw.cloudflareReady) +
  " baseUrl=" + baseUrl +
  " reason=" + reason
);

if (process.env.GITHUB_OUTPUT) {
  const outputReason = String(reason).replace(/[\r\n]/gu, " ").slice(0, 200);
  await appendFile(process.env.GITHUB_OUTPUT,
    "active=" + raw.active + "\n" +
    "base_url=" + baseUrl + "\n" +
    "cloudflare_ready=" + String(raw.cloudflareReady) + "\n" +
    "reason=" + outputReason + "\n",
    "utf8");
}
