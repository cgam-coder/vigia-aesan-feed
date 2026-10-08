import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceExecutionOwner} from '../scripts/source-execution-owner.mjs';
const run=async(status,body)=>{let calls=0;const result=await sourceExecutionOwner({baseUrl:'https://vigia-runtime.c-gamiz93.workers.dev',token:'fixture',fetchImpl:async(input,init)=>{calls++;assert.equal(init.method,'GET');assert.equal(new URL(input).pathname,'/api/source-reliability');return Response.json(body,{status});}});assert.equal(calls,1);return result;};
test('native ownership suppresses legacy producers even when watchdog is HOLD',async()=>{for(const status of [200,503])assert.deepEqual(await run(status,{mode:'five-source-coordinated',outcome:'HOLD',officialParityCertified:false}),{legacyAllowed:false,nativeOwned:true,reason:'native-execution-owner'});});
test('legacy producers require a known previous runtime contract',async()=>{assert.equal((await run(404,{})).legacyAllowed,true);assert.equal((await run(200,{mode:'rapna-rasff-oecd-pilot',outcome:'disabled'})).legacyAllowed,true);for(const [status,body] of [[401,{}],[500,{}],[200,{mode:'future-mode',outcome:'disabled'}],[200,{}],[503,{outcome:'disabled',mode:null}]])await assert.rejects(run(status,body));});
test('lost ownership response never authorizes takeover',async()=>{await assert.rejects(sourceExecutionOwner({baseUrl:'https://vigia-runtime.c-gamiz93.workers.dev',token:'fixture',fetchImpl:async()=>{throw Error('lost response');}}));});
test('all recent and revision legacy jobs share native ownership arbitration while AESAN publication remains active',()=>{
  for(const file of ['safety-gate-sync.yml','rapna-sync.yml','rasff-control.yml','oecd-historical-reconcile.yml']){const yaml=readFileSync(new URL('../.github/workflows/'+file,import.meta.url),'utf8');const jobs=(yaml.match(/needs: \[writer_gate, runtime_target, native_owner(?:, current_parity)?\]/g)||[]).length;assert.ok(jobs>=1,file);assert.equal((yaml.match(/needs\.native_owner\.outputs\.legacy_allowed == 'true'/g)||[]).length,jobs,file);assert.match(yaml,/uses: \.\/\.github\/workflows\/source-execution-owner.yml/);}
  for(const file of ['update-feed.yml','update-full-feed.yml','freshness-watchdog.yml'])assert.doesNotMatch(readFileSync(new URL('../.github/workflows/'+file,import.meta.url),'utf8'),/needs\.native_owner/);
});
