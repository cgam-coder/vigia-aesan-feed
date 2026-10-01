// TEMP diagnostic-branch-only exception for the owner's authorized public Safari capture.
// The original policy is preserved byte-for-byte. All original checks still run.
// Remove this adapter and restore the original blob after evidence retrieval; DO NOT MERGE.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as baseline from "./workflow-security.baseline.mjs";
export { FLOATING_ACTION_EXCEPTIONS, KNOWN_DEBT } from "./workflow-security.baseline.mjs";
export const DIAGNOSTIC_FILE = "ui-f1a-ios-simulator-once.yml";
const WORKFLOW_SHA256 = "ed43b2f2c1090309bd8d1fd837c9494cf7e4fa80f0c2ddbf7aa976a070a39ee3";
const SCRIPT_SHA256 = "2b27806072266ed5b0908b702426fc6ea9911bb077bce36b9fc890ccc835092d";
const sha256 = text => createHash("sha256").update(text).digest("hex");
export const isReviewedDiagnosticWorkflow = (file, source) =>
  file === DIAGNOSTIC_FILE && typeof source === "string" && sha256(source) === WORKFLOW_SHA256;
export async function loadWorkflows(root) {
  const workflows = await baseline.loadWorkflows(root);
  if (workflows.has(DIAGNOSTIC_FILE)) {
    const script = await readFile(join(root, ".diagnostics", "ios_safari_smoke.py"));
    if (sha256(script) !== SCRIPT_SHA256) throw Error("Unreviewed diagnostic script; public capture forbidden");
  }
  return workflows;
}
export function analyzeWorkflows(workflows) {
  const result = baseline.analyzeWorkflows(workflows);
  return { ...result, violations: result.violations.filter(item =>
    !(item.code === "UNEXPECTED_PUBLIC_ARTIFACT" &&
      isReviewedDiagnosticWorkflow(item.file, workflows.get(item.file)))) };
}
