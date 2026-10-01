// TEMP diagnostic-branch-only exception for the owner's authorized public Safari capture.
// The original policy is preserved byte-for-byte. All original checks still run.
// Remove this adapter and restore the original blob after evidence retrieval; DO NOT MERGE.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as baseline from "./workflow-security.baseline.mjs";
export { FLOATING_ACTION_EXCEPTIONS, KNOWN_DEBT } from "./workflow-security.baseline.mjs";
export const DIAGNOSTIC_FILE = "ui-f1a-ios-simulator-once.yml";
const WORKFLOW_SHA256 = "61cc5e8d7ffa6295a840e4a62c943e9f6c753ad9e698f86952caf5bf9851af81";
const SCRIPT_SHA256 = "79eb0201499c4015894ac22955c04446cb957e86a794ddd7133dd55fce5f7016";
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

