import { appendFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";

const path = new URL("../ops/runtime-write-freeze.json", import.meta.url);
const raw = JSON.parse(await readFile(path, "utf8"));
const allowed = new Set(["schemaVersion", "frozen", "reason"]);

if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
  throw new Error("RUNTIME_WRITE_GATE invalid configuration");
}
if (Object.keys(raw).some((key) => !allowed.has(key))) {
  throw new Error("RUNTIME_WRITE_GATE unexpected configuration key");
}
if (raw.schemaVersion !== 1 || typeof raw.frozen !== "boolean") {
  throw new Error("RUNTIME_WRITE_GATE invalid configuration contract");
}
if (raw.reason !== null && (typeof raw.reason !== "string" || raw.reason.length > 200)) {
  throw new Error("RUNTIME_WRITE_GATE invalid reason");
}

const state = raw.frozen ? "FROZEN" : "OPEN";
const reason = raw.reason ?? (raw.frozen ? "unspecified" : "normal-operation");
console.log(`RUNTIME_WRITE_GATE=${state} reason=${reason}`);

if (process.env.GITHUB_OUTPUT) {
  const outputReason = String(reason).replace(/[\r\n]/gu, " ").slice(0, 200);
  await appendFile(process.env.GITHUB_OUTPUT,
    `allowed=${raw.frozen ? "false" : "true"}\nfrozen=${raw.frozen ? "true" : "false"}\nreason=${outputReason}\n`,
    "utf8");
}

if (raw.frozen) process.exit(0);
