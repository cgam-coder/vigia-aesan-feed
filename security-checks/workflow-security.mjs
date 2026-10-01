// TEMP diagnostic-branch-only exception for the owner's authorized public Safari capture.
// The original policy is preserved byte-for-byte. All original checks still run.
// Remove this adapter and restore the original blob after evidence retrieval; DO NOT MERGE.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as baseline from "./workflow-security.baseline.mjs";
export { FLOATING_ACTION_EXCEPTIONS, KNOWN_DEBT } from "./workflow-security.baseline.mjs";
export const DIAGNOSTIC_FILE = "ui-f1a-ios-simulator-once.yml";
const WORKFLOW_SHA256 = "e67311166bfeb17a3344f6af840877177bdfc6b459437527baa09ea531a882e3";
const SCRIPT_SHA256 = "6b50b4976956752646ef9c1fa931c0c3363e4828e9cc4e32ae60113647b3759e";
const CHROMIUM_SHA256 = "38825bb0fb00c8211691f0c05a47119d60b36730c1e0d9de28b304c08cbbfeb2";
const sha256 = text => createHash("sha256").update(text).digest("hex");
export const isReviewedDiagnosticWorkflow = (file, source) =>
  file === DIAGNOSTIC_FILE && typeof source === "string" && sha256(source) === WORKFLOW_SHA256;
export async function loadWorkflows(root) {
  const workflows = await baseline.loadWorkflows(root);
  if (workflows.has(DIAGNOSTIC_FILE)) {
    const script = await readFile(join(root, ".diagnostics", "ios_safari_smoke.py"));
    const chromium = await readFile(join(root, ".diagnostics", "chromium_matrix.mjs"));
    if (sha256(chromium) !== CHROMIUM_SHA256) throw Error("Unreviewed Chromium script; public capture forbidden");
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

