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

if (raw.frozen) {
  console.error("RUNTIME_WRITE_GATE=FROZEN reason=" + (raw.reason ?? "unspecified"));
  process.exit(78);
}

console.log("RUNTIME_WRITE_GATE=OPEN");
