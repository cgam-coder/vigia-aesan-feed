// Temporary owner-authorized PUBLIC UI evidence exception. Remove after this campaign.
// The original policy is retained byte-for-byte and all its checks still execute.
import { createHash } from 'node:crypto';
import { analyzeWorkflows as analyzePermanent } from './workflow-security.permanent.mjs';
export { loadWorkflows, KNOWN_DEBT, FLOATING_ACTION_EXCEPTIONS } from './workflow-security.permanent.mjs';
const FILE = 'temp-public-native-ui.yml';
const SHA = 'e7742f2b894d148c5aec94dbff9e28794b7fb22581be9146238d25b1a462f723';
export function analyzeWorkflows(workflows) {
  const result = analyzePermanent(workflows);
  const source = workflows.get(FILE);
  const authorized = typeof source === 'string' && createHash('sha256').update(source).digest('hex') === SHA;
  if (source !== undefined && !authorized) {
    result.violations.push({file:FILE,line:null,code:'TEMPORARY_WORKFLOW_MISMATCH',message:'Temporary campaign must match its entire owner-reviewed workflow.'});
  }
  if (authorized) {
    result.violations = result.violations.filter(v => !(v.file === FILE && v.code === 'UNEXPECTED_PUBLIC_ARTIFACT'));
  }
  return result;
}
