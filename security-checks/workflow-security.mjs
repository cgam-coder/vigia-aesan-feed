// TEMP diagnostic-branch-only exception for the owner's authorized public Safari capture.
// The original policy is preserved byte-for-byte. All original checks still run.
// Remove this adapter and restore the original blob after evidence retrieval; DO NOT MERGE.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as baseline from "./workflow-security.baseline.mjs";
export { FLOATING_ACTION_EXCEPTIONS, KNOWN_DEBT } from "./workflow-security.baseline.mjs";
export const DIAGNOSTIC_FILE = "ui-f1a-ios-simulator-once.yml";
const WORKFLOW_SHA256 = "3d9a4e8431216a198548a1b204f7f8c5a395117adae8e180e08e295f4ff905c6";
const SCRIPT_SHA256 = "96e23695b1916c5d59b8e7bea38369b5f505f5180a85da8b0ae7ff9eef9f9ea5";
const CHROMIUM_SHA256 = "dee9d130f0c3e3b66003012bbd00c9b669872a389d1f5df17c0d2f3f3e04883d";
const sha256 = text => createHash("sha256").update(text).digest("hex");
export const isReviewedDiagnosticWorkflow = (file, source) =>
  file === DIAGNOSTIC_FILE && typeof source === "string" && sha256(source) === WORKFLOW_SHA256;
export async function loadWorkflows(root) {
  const workflows = await baseline.loadWorkflows(root);
  if (workflows.has(DIAGNOSTIC_FILE)) {
    const osProbe=await readFile(join(root,".diagnostics","native_ui_probe.py"));
    const osProject=await readFile(join(root,".diagnostics","native_ui_project.rb"));
    if(sha256(osProbe)!=="ab2117268e4224b1df484d552e0bc2b16265cdf035f5c81c4177a86682e1f86e" || sha256(osProject)!=="413b2a9afff6e04db12000e18bd3cfe2792380fbb29439314a93c0394c526342") throw Error("Unreviewed native UI harness");
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

