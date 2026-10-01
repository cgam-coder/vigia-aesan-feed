import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeWorkflows,temporaryAuthorized,TEMP_FILE} from '../../security-checks/workflow-security.mjs';
const source=readFileSync('.github/workflows/'+TEMP_FILE,'utf8');
test('exact whole workflow is authorized and bounded',()=>{
 assert(temporaryAuthorized(source));assert.deepEqual(analyzeWorkflows(new Map([[TEMP_FILE,source]])).violations,[]);
 assert.equal((source.match(/runs-on: macos-15/g)||[]).length,1);
 assert(source.includes("needs.preflight.result == 'success' && github.run_attempt == '1'"));
 assert.doesNotMatch(source,/secrets\.|relaxed-security|allow-insecure|contents: write|write-all/);
});
for(const [name,from,to] of [
 ['budget','timeout-minutes: 30','timeout-minutes: 60'],['branch','diag/ui-f1a-ios-simulator-20261001','main'],
 ['permission','contents: read','contents: write'],['floating action','actions/checkout@11d5960a326750d5838078e36cf38b85af677262','actions/checkout@main'],
 ['retry',"github.run_attempt == '1'",'true'],['preflight gate',"needs.preflight.result == 'success'",'true'],
 ['lock source','run-id: 36931076558','run-id: 1'],['artifact','nagamealert-appium/evidence.zip','*'],
 ['job clock','NA_JOB_STARTED_EPOCH','CLOCK_IGNORED']]){
 test('reject changed '+name,()=>{const changed=source.replace(from,to);assert.notEqual(source,changed);assert(!temporaryAuthorized(changed));assert(analyzeWorkflows(new Map([[TEMP_FILE,changed]])).violations.length);});
}
test('additional or renamed publisher cannot inherit exception',()=>{
 assert(analyzeWorkflows(new Map([[TEMP_FILE,source],['other.yml',source]])).violations.some(v=>v.file==='other.yml'&&v.code==='UNEXPECTED_PUBLIC_ARTIFACT'));
});
