// Temporary public dependency-only evidence permission, bound to the complete reviewed workflow.
import {createHash} from 'node:crypto';
import {analyzeWorkflows as analyzePermanent} from './workflow-security.permanent.mjs';
export {loadWorkflows,KNOWN_DEBT,FLOATING_ACTION_EXCEPTIONS} from './workflow-security.permanent.mjs';
export const TEMP_FILE='ui-f1a-appium-dependencies.yml';
export function temporaryAuthorized(source){return typeof source==='string' && createHash('sha256').update(source).digest('hex')==='10472a254cb018ba2b173d67459228fe71ff9b3abbace43c6fce3b6ab5ad9b80';}
export function analyzeWorkflows(workflows){
 const result=analyzePermanent(workflows);const source=workflows.get(TEMP_FILE);const ok=temporaryAuthorized(source);
 if(source!==undefined&&!ok)result.violations.push({file:TEMP_FILE,code:'TEMPORARY_WORKFLOW_MISMATCH'});
 if(ok)result.violations=result.violations.filter(v=>!(v.file===TEMP_FILE&&v.code==='UNEXPECTED_PUBLIC_ARTIFACT'));
 return result;
}
