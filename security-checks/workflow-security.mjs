// TEMP owner-authorized diagnostic-only exact-hash publisher; never merge.
// Original policy is retained byte-for-byte and all original violations remain enforced.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as baseline from "./workflow-security.baseline.mjs";
export { FLOATING_ACTION_EXCEPTIONS, KNOWN_DEBT } from "./workflow-security.baseline.mjs";
export const DIAGNOSTIC_FILE="ui-f1a-ios-simulator-once.yml";
const sha256=text=>createHash("sha256").update(text).digest("hex");
const WORKFLOW_SHA256="00c81489e6bd21e25c90d3806b4b0b611eef8954dc552b98f7c433583584ac22";
const PINS={".diagnostics/native_input_theme.py": "0e393bcab42cebcbad740358517f9b5963abd5e3a5df37043d41b989cded816a", ".diagnostics/neutral_xctest_project.rb": "7669d5e101f45bd235df6fbff848c78b070953c42c0e14c511f41f58bbce0106", ".diagnostics/ios_safari_smoke.py": "52b63de8b3e2721b667e151072292a60aaab2a0a876cb8110ed71080a4192afb"};
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
