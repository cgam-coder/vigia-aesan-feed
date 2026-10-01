// Temporary owner-authorized Appium campaign. Restore the original policy after completion.
import {createHash} from 'node:crypto';
import {analyzeWorkflows as permanent} from './workflow-security.permanent.mjs';
export {loadWorkflows, KNOWN_DEBT, FLOATING_ACTION_EXCEPTIONS} from './workflow-security.permanent.mjs';
export const TEMP_FILE='ui-f1a-appium-once.yml';
export const TEMP_SHA='6638a731b46c3a70b50bc989feac2adc530e9459efc2858cdf81d6fc25b1c487';
export function temporaryAuthorized(source){return typeof source==='string' && createHash('sha256').update(source).digest('hex')===TEMP_SHA;}
export function analyzeWorkflows(workflows){
  const r=permanent(workflows);const source=workflows.get(TEMP_FILE);
  if(source!==undefined && !temporaryAuthorized(source))r.violations.push({file:TEMP_FILE,code:'UNREVIEWED_TEMPORARY_WORKFLOW',message:'Full temporary workflow hash mismatch'});
  if(temporaryAuthorized(source))r.violations=r.violations.filter(v=>!(v.file===TEMP_FILE && v.code==='UNEXPECTED_PUBLIC_ARTIFACT'));
  return r;
}
