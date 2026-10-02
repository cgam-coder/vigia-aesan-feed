import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const yaml = readFileSync(new URL('../.github/workflows/safety-gate-sync.yml',import.meta.url),'utf8');
const preflight = yaml.split('      - name: Bounded read-plane and authorization preflight\n')[1]
  .split('        run: |\n')[1].split('      - name: Refresh Safety Gate\n')[0]
  .split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');

function fixture(fail={}) {
  const dir=mkdtempSync(join(tmpdir(),'sg-preflight-'));
  try {
    writeFileSync(join(dir,'fixture.json'),JSON.stringify(fail));
    writeFileSync(join(dir,'curl'),`#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');
const dir=process.env.RUNNER_TEMP,fail=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json'),'utf8'));
const args=process.argv.slice(2),url=new URL(args.at(-1));
fs.appendFileSync(path.join(dir,'calls.jsonl'),JSON.stringify(args)+'\\n');
const output=args[args.indexOf('--output')+1],method=args.includes('POST')?'POST':'GET';
if(fail.path===url.pathname && fail.query===url.search){process.stdout.write('000');process.exit(28);}
let status=200,body={};
if(url.pathname==='/api/v2/alerts') body={apiVersion:2,schemaVersion:4,items:[{}]};
else if(url.searchParams.get('mode')==='preflight'){
 const token=args[args.indexOf('--header')+1];
 status=args.includes('--header') && token==='Authorization: Bearer fixture-only-secret' ? 200 : 401;
 const routes={aesan:'AESAN','safety-gate':'SAFETY GATE',rapna:'RAPNA',oecd:'OECD'};
 body={authorized:true,source:routes[url.pathname.split('/')[2]]};
 if(fail.acceptWrong && status===401)status=200;
}else if(url.searchParams.get('mode')) status=405;
fs.writeFileSync(output,JSON.stringify(body));process.stdout.write(String(status));
`,{mode:0o755});
    const result=spawnSync('bash',['--noprofile','--norc','-e','-o','pipefail','-c',preflight],{
      encoding:'utf8',timeout:5000,env:{PATH:`${dir}:${process.env.PATH}`,RUNNER_TEMP:dir,
        VIGIA_BASE_URL:'https://local.invalid',VIGIA_SYNC_TOKEN:'fixture-only-secret'}});
    assert.equal(result.error,undefined);
    const calls=readFileSync(join(dir,'calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(calls.every(c=>c[0]==='-q'),true);
    assert.equal(calls.some(c=>c.includes('--retry')),false);
    assert.equal(calls.filter(c=>c.includes('POST')).every(c=>new URL(c.at(-1)).searchParams.get('mode')==='preflight'),true);
    assert.equal(result.stdout.includes('fixture-only-secret') || result.stderr.includes('fixture-only-secret'),false);
    return {result,calls};
  } finally {rmSync(dir,{recursive:true,force:true});}
}
test('all existing authorization, observation, smoke and method controls remain executable',()=>{
  const {result,calls}=fixture(); assert.equal(result.status,0,result.stderr); assert.equal(calls.length,24);
  assert.match(result.stdout,/All observation GETs are read-only/);
  assert.match(result.stderr,/source=frontend phase=root event=start/);
  assert.match(result.stderr,/source=safety-gate phase=get-snapshot-rejected event=end curlExit=0 http=405/);
});
test('timeout identifies exact GET and prevents refresh; no retry or later request',()=>{
  const {result,calls}=fixture({path:'/api/aesan/sync',query:'?observe=1'});
  assert.equal(result.status,28); assert.equal(calls.at(-1).at(-1),'https://local.invalid/api/aesan/sync?observe=1');
  assert.match(result.stderr,/source=aesan phase=observe event=end curlExit=28 http=000/);
});
test('authentication control failure remains blocking',()=>{
  const {result,calls}=fixture({acceptWrong:true}); assert.notEqual(result.status,0); assert.equal(calls.length,5);
});
test('global preflight budget refuses request after expiry without weakening controls',()=>{
  const functionText=preflight.split('root_code=')[0];
  const result=spawnSync('bash',['-e','-o','pipefail','-c',functionText+'\npreflight_started=$((SECONDS - 111))\npreflight_curl AESAN observe --max-time 30 https://local.invalid'],{encoding:'utf8'});
  assert.equal(result.status,124); assert.match(result.stderr,/event=blocked reason=budget/);
});
