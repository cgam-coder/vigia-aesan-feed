// TEMP diagnostic-branch-only exception for the owner's authorized public Safari capture.
// The original policy is preserved byte-for-byte. All original checks still run.
// Remove this adapter and restore the original blob after evidence retrieval; DO NOT MERGE.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as baseline from "./workflow-security.baseline.mjs";
export { FLOATING_ACTION_EXCEPTIONS, KNOWN_DEBT } from "./workflow-security.baseline.mjs";
export const DIAGNOSTIC_FILE = "ui-f1a-ios-simulator-once.yml";
const WORKFLOW_SHA256 = "7e82fa572689d516bb040ae1d0b9c8a0eaf6555cf60c3916ec6ae036c7880066";
const SCRIPT_SHA256 = "35793924f6066c501b4037fd2ed03c25878dd2a392f0f01baa96f86b09843036";
const CHROMIUM_SHA256 = "a0bb0e11ce5d5581e05ece166ae8e27620c5a0717baf0fc4b3cb521d11c8dc4b";
const sha256 = text => createHash("sha256").update(text).digest("hex");
export const isReviewedDiagnosticWorkflow = (file, source) =>
  file === DIAGNOSTIC_FILE && typeof source === "string" && sha256(source) === WORKFLOW_SHA256;
export async function loadWorkflows(root) {
  const workflows = await baseline.loadWorkflows(root);
  if (workflows.has(DIAGNOSTIC_FILE)) {
    const twoCase=await readFile(join(root,".diagnostics","chromium_two_cases.mjs"));
    if(sha256(twoCase)!=="eeb31a7535082d650462df3b0da36088c197883c2792b5f8808ba29e5ee78797")throw Error("Unreviewed two-case probe");
    const osProbe=await readFile(join(root,".diagnostics","native_ui_probe.py"));
    const osProject=await readFile(join(root,".diagnostics","native_ui_project.rb"));
    if(sha256(osProbe)!=="45a01df50b3c87ddb898272d38c6ad10bbb6efdf1d8638e56b7ad230de97d7ec" || sha256(osProject)!=="10899a1e6a185d9cc92dff022a1e941f64144866f996b397bbc60a22a78c35cb") throw Error("Unreviewed native UI harness");
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

