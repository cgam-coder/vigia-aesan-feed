import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {analyzeWorkflows} from '../../security-checks/workflow-security.mjs';
const file='temp-public-native-ui.yml';
const source=readFileSync(new URL('../../.github/workflows/'+file,import.meta.url),'utf8');
const SHA='e7742f2b894d148c5aec94dbff9e28794b7fb22581be9146238d25b1a462f723';
const check=(s,name=file)=>analyzeWorkflows(new Map([[name,s]])).violations;
test('exact scoped campaign and hash are accepted',()=>{
 assert.equal(createHash('sha256').update(source).digest('hex'),SHA);assert.deepEqual(check(source),[]);
});
for(const [name,from,to] of [
 ['branch','diag/ui-f1a-ios-simulator-20261001','main'],
 ['budget','timeout-minutes: 10','timeout-minutes: 11'],
 ['permissions','contents: read','contents: write'],
 ['path','public-ui-core/evidence.zip','public-ui-core/../credentials'],
 ['runner','runs-on: macos-15','runs-on: macos-15-large'],
 ['gating',"needs.preflight.result == 'success'","always()"],
 ['attempt',"github.run_attempt == '1'",'true'],
 ['action','actions/checkout@11d5960a326750d5838078e36cf38b85af677262','actions/checkout@v4'],
 ['full original suite','npm test','echo omitted'],
 ['contract suite','node --test security-checks/workflow-security.test.mjs','echo omitted'],
]) test('reject mutation '+name,()=>{
 assert.ok(source.includes(from));assert.ok(check(source.replace(from,to)).some(x=>x.code==='UNEXPECTED_PUBLIC_ARTIFACT'));
});
test('reject added secret expression',()=>assert.ok(check(source+'\n# $'+'{{ secrets.ANY_TOKEN }}\n').length));
test('reject renaming the temporary publisher',()=>assert.ok(check(source,'other.yml').some(x=>x.code==='UNEXPECTED_PUBLIC_ARTIFACT')));
test('reject third publisher',()=>{
 const other='jobs:\n  x:\n    steps:\n      - uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02\n        with:\n          path: evidence.json\n';
 assert.ok(analyzeWorkflows(new Map([[file,source],['third.yml',other]])).violations.some(x=>x.file==='third.yml'&&x.code==='UNEXPECTED_PUBLIC_ARTIFACT'));
});
test('removing the temporary file restores the permanent policy',()=>{
 assert.deepEqual(analyzeWorkflows(new Map()).violations,[]);
 assert.ok(check(source.replace('name: TEMP','name: CHANGED')).some(x=>x.code==='UNEXPECTED_PUBLIC_ARTIFACT'));
});
