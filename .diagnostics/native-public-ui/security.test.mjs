import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeWorkflows} from '../../security-checks/workflow-security.mjs';
const name='temp-public-native-ui.yml';
const source=readFileSync(new URL('../../.github/workflows/'+name,import.meta.url),'utf8');
const analyze=(n,s)=>analyzeWorkflows(new Map([[n,s]])).violations;
test('exact public UI campaign is narrowly authorized',()=>assert.deepEqual(analyze(name,source),[]));
for(const [label,change] of [
 ['different body',s=>s+'\n# changed\n'],
 ['different branch',s=>s.replaceAll('diag/ui-f1a-ios-simulator-20261001','main')],
 ['writer permission',s=>s.replace('contents: read','contents: write')],
 ['secret expression',s=>s+'\n# ${{ secrets.VIGIA_SYNC_TOKEN }}\n'],
 ['broad upload',s=>s.replace('${{ runner.temp }}/public-ui-core/evidence.zip','.')],
 ['different runner budget',s=>s.replace('timeout-minutes: 10','timeout-minutes: 11')],
 ['floating action',s=>s.replace('checkout@11d5960a326750d5838078e36cf38b85af677262','checkout@main')]
])test('reject '+label,()=>assert.ok(analyze(name,change(source)).some(x=>x.code==='UNEXPECTED_PUBLIC_ARTIFACT')));
test('renaming cannot carry the exception',()=>assert.ok(analyze('another.yml',source).some(x=>x.code==='UNEXPECTED_PUBLIC_ARTIFACT')));
