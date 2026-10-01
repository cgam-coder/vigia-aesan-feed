// Temporary public UI evidence permission, bound to the complete reviewed workflow.
import {createHash} from 'node:crypto';
import {analyzeWorkflows as analyzePermanent} from './workflow-security.permanent.mjs';
export {loadWorkflows,KNOWN_DEBT,FLOATING_ACTION_EXCEPTIONS} from './workflow-security.permanent.mjs';
export const TEMP_FILE='ui-f1a-appium-certify.yml';
export function temporaryAuthorized(source){return typeof source==='string' && createHash('sha256').update(source).digest('hex')==='784d6d58969446f5702b86f7fb89b3eedf75b907834ee48680e47c5e11690997';}
export function analyzeWorkflows(workflows){
 const result=analyzePermanent(workflows);const source=workflows.get(TEMP_FILE);const ok=temporaryAuthorized(source);
 if(source!==undefined&&!ok)result.violations.push({file:TEMP_FILE,code:'TEMPORARY_WORKFLOW_MISMATCH'});
 if(ok)result.violations=result.violations.filter(v=>!(v.file===TEMP_FILE&&v.code==='UNEXPECTED_PUBLIC_ARTIFACT'));
 return result;
}
