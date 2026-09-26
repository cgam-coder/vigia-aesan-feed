import { appendFile, readFile } from "node:fs/promises";

const path = new URL("../ops/runtime-writer-target.json", import.meta.url);
const raw = JSON.parse(await readFile(path, "utf8"));
const allowed = new Set(["schemaVersion", "target"]);
const targets = Object.freeze({
  sites:"https://vigia-alertas.csar68.chatgpt.site",
  cloudflare:"https://vigia-runtime.c-gamiz93.workers.dev",
});

if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
  throw new Error("RUNTIME_WRITER_TARGET invalid configuration");
}
if (Object.keys(raw).some((key) => !allowed.has(key))) {
  throw new Error("RUNTIME_WRITER_TARGET unexpected configuration key");
}
if (raw.schemaVersion !== 1 || typeof raw.target !== "string" || !(raw.target in targets)) {
  throw new Error("RUNTIME_WRITER_TARGET invalid configuration contract");
}

const baseUrl = targets[raw.target];
console.log(`RUNTIME_WRITER_TARGET=${raw.target} base=${baseUrl}`);

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT,
    `target=${raw.target}\nbase_url=${baseUrl}\n`,
    "utf8");
}
