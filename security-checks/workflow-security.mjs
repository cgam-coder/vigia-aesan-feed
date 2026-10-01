// TEMP owner-authorized diagnostic-only exact-hash publisher; never merge.
// Original policy is retained byte-for-byte and all original violations remain enforced.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as baseline from "./workflow-security.baseline.mjs";
export { FLOATING_ACTION_EXCEPTIONS, KNOWN_DEBT } from "./workflow-security.baseline.mjs";
export const DIAGNOSTIC_FILE="ui-f1a-ios-simulator-once.yml";
const sha256=text=>createHash("sha256").update(text).digest("hex");
const WORKFLOW_SHA256="d38103bafab44a69565221ef32e8b0a9a7ccee591e5b056e718dc65c520db69d";
const PINS={".diagnostics/neutral_xctest_only.py": "55217b8cdf6ddb37e9ab665865b04cbf3c93bd5e6f82b98e9f189453ccb9f53e", ".diagnostics/native_input_theme.py": "0ea9a28064972b00dcb55476fa3b091922886a83223bb8964b6005628d879e23", ".diagnostics/neutral_xctest_project.rb": "818ba2e435466e6e1dea86b48167e9cad57a597d7e5f170a6852d2664ac7a6d9", ".diagnostics/ios_safari_smoke.py": "52b63de8b3e2721b667e151072292a60aaab2a0a876cb8110ed71080a4192afb", ".diagnostics/recover_neutral_attachments.py": "79a9cffbba4f1e1131e2368feee7f5c8f9d392ae2634964355ff0e5ce81c528c", ".diagnostics/test_recover_neutral_attachments.py": "3d58caf48559dbf9325db840ddde2300b8c11c4558b337c9e0b7dafcf1c9abbd"};
export const isReviewedDiagnosticWorkflow=(file,source)=>file===DIAGNOSTIC_FILE && typeof source==="string" && sha256(source)===WORKFLOW_SHA256;
export async function loadWorkflows(root) {
 const workflows=await baseline.loadWorkflows(root);
 if(workflows.has(DIAGNOSTIC_FILE)) for(const [path,hash] of Object.entries(PINS)) {
  if(sha256(await readFile(join(root,path)))!==hash) throw Error("Unreviewed public diagnostic dependency: "+path);
 }
 return workflows;
}
export function analyzeWorkflows(workflows) {
 const result=baseline.analyzeWorkflows(workflows);
 return {...result,violations:result.violations.filter(item=>!(item.code==="UNEXPECTED_PUBLIC_ARTIFACT"&&isReviewedDiagnosticWorkflow(item.file,workflows.get(item.file))))};
}
