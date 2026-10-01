import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {analyzeWorkflows,temporaryAuthorized,TEMP_FILE} from '../../security-checks/workflow-security.mjs';
const source=readFileSync('.github/workflows/'+TEMP_FILE,'utf8');
const only=s=>new Map([[TEMP_FILE,s]]);
test('exact Appium workflow passes unchanged permanent analyzer plus bounded exception',()=>{
 assert.equal(temporaryAuthorized(source),true);assert.deepEqual(analyzeWorkflows(only(source)).violations,[]);
 assert.equal((source.match(/runs-on: macos-15/g)||[]).length,1);
 assert.match(source,/timeout-minutes: 30/);assert.match(source,/needs: preflight/);
 assert.doesNotMatch(source,/secrets\.|relaxed-security|allow-insecure/);
});
for(const [name,from,to] of [
 ['budget','timeout-minutes: 30','timeout-minutes: 60'],
 ['branch','diag/ui-f1a-ios-simulator-20261001','main'],
 ['permissions','contents: read','contents: write'],
 ['floating ref','actions/checkout@11d5960a326750d5838078e36cf38b85af677262','actions/checkout@v4'],
 ['path','nagamealert-appium/evidence.zip','*'],
 ['retry',"github.run_attempt == '1'",'true'],
 ['preflight gate',"needs.preflight.result == 'success'",'true'],
 ['script','runner.py','unknown.py'],
 ])test('reject altered '+name,()=>{
 const changed=source.replace(from,to);assert.notEqual(changed,source);assert.equal(temporaryAuthorized(changed),false);
 assert.ok(analyzeWorkflows(only(changed)).violations.length>0);
 });
test('reject another public artifact publisher even with the same body',()=>{
 const r=analyzeWorkflows(new Map([[TEMP_FILE,source],['unreviewed.yml',source]]));
 assert.ok(r.violations.some(x=>x.file==='unreviewed.yml'&&x.code==='UNEXPECTED_PUBLIC_ARTIFACT'));
});
test('permanent analyzer kept byte-identical',()=>{
 const b=readFileSync('security-checks/workflow-security.permanent.mjs');
 assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex'),'cc587d88a1cbd5bdb64ac6c69fc8d6ca66cf83e2');
});
