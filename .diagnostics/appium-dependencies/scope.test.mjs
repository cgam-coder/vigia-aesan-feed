import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeWorkflows,temporaryAuthorized,TEMP_FILE} from '../../security-checks/workflow-security.mjs';
const s=readFileSync('.github/workflows/'+TEMP_FILE,'utf8');
test('dependency-only exact workflow',()=>{assert(temporaryAuthorized(s));assert.deepEqual(analyzeWorkflows(new Map([[TEMP_FILE,s]])).violations,[]);assert.doesNotMatch(s,/runs-on: macos|secrets\.|relaxed-security|allow-insecure/);});
for(const [k,a,b] of [['budget','timeout-minutes: 10','timeout-minutes: 60'],['branch','diag/ui-f1a-ios-simulator-20261001','main'],['permissions','contents: read','contents: write'],['platform','runs-on: ubuntu-latest','runs-on: macos-15'],['retry',"github.run_attempt == '1'",'true'],['artifact','appium-reviewed-deps/package.json','*']])test('reject changed '+k,()=>{const t=s.replace(a,b);assert.notEqual(s,t);assert(!temporaryAuthorized(t));assert(analyzeWorkflows(new Map([[TEMP_FILE,t]])).violations.length);});
test('reject additional publisher',()=>assert(analyzeWorkflows(new Map([[TEMP_FILE,s],['unknown.yml',s]])).violations.some(v=>v.file==='unknown.yml'&&v.code==='UNEXPECTED_PUBLIC_ARTIFACT')));
