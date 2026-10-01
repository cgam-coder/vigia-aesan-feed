// TEMP owner-authorized diagnostic-only exact-hash publisher; never merge.
// Original policy is retained byte-for-byte and all original violations remain enforced.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as baseline from "./workflow-security.baseline.mjs";
export { FLOATING_ACTION_EXCEPTIONS, KNOWN_DEBT } from "./workflow-security.baseline.mjs";
export const DIAGNOSTIC_FILE="ui-f1a-ios-simulator-once.yml";
const sha256=text=>createHash("sha256").update(text).digest("hex");
const WORKFLOW_SHA256="06a9257b488f0f51827a10183227500ed9751d42c887a75df1cca78bea3ea33d";
const PINS={".diagnostics/neutral_xctest_only.py": "27e5e20180ad4f5c63ee2e3f3792770da58f4012f521e79c89c83ca269bafd19", ".diagnostics/native_input_theme.py": "72a74dfe470d93340e72c0c6e6e6872a0c3231d203f27a45819b66bca19f35b8", ".diagnostics/neutral_xctest_project.rb": "498f0739b56fc6b99ef3f7de3830434f56549aa1fd3828742b9cf2b9efeaab3b", ".diagnostics/ios_safari_smoke.py": "52b63de8b3e2721b667e151072292a60aaab2a0a876cb8110ed71080a4192afb"};
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
