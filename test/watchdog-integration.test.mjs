import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {publishWatchdogReport,SOURCES} from '../scripts/freshness-watchdog.mjs';
import {classifyWatchdogReport} from '../scripts/watchdog-disposition.mjs';

const NOW=Date.parse('2026-10-31T02:33:12Z');
const stamp=minutes=>new Date(NOW-minutes*60000).toISOString();
const fixture=run=>JSON.parse(readFileSync(new URL(`./fixtures/watchdog/run-${run}.json`,import.meta.url)));
function nativeFixture(healthy=false){
  return {
    now:NOW,
    policy:{policyVersion:1,policies:SOURCES.map(source=>({source,
      recent:{freshMaxAgeMinutes:45,staleMaxAgeMinutes:60},
      revision:{required:source!=='SAFETY GATE',scope:'fixture-only',
        certification:source==='SAFETY GATE'?'not-applicable':'required',maxAgeMinutes:360}}))},
    native:{mode:'five-source-coordinated',outcome:'observed',officialParityCertified:healthy,activeLease:false,
      state:{lastWakeAt:stamp(1),ownershipVerifiedAt:stamp(30),
        attempts:Object.fromEntries(SOURCES.map(source=>[source,{outcome:'completed'}])),revisionAttempts:{},
        lastAudit:{finishedAt:stamp(1),allFresh:healthy,states:SOURCES.map(source=>{
          const held=!healthy&&['RAPNA','RASFF','OECD'].includes(source);
          return {source,status:held?'stale':'fresh',checkedAt:stamp(1),activeLease:false,error:null,
            latestIdentityParity:true,missingOfficialIdentities:[],revisionMismatches:[],
            lastSyncSuccessAt:stamp(2),revisionLastSuccessAt:source==='SAFETY GATE'?null:stamp(held?400:2),
            revisionStatus:source==='SAFETY GATE'?'not-required':held?'stale':'fresh'};
        })}}},
  };
}

for(const [run,level] of [[41160491223,'WARNING'],[41074975519,'CRITICAL'],[41023173963,'CRITICAL']]){
  test(`authentic archived summary ${run}: ${level}, unchanged global verdict and authentic output path`,async()=>{
    const {report,provenance}=fixture(run),original=structuredClone(report);
    assert.equal(provenance.baseline_verified,true);
    const messages=[],summaries=[];
    const decision=await publishWatchdogReport(report,{summaryPath:'mock-summary',
      log:m=>messages.push(m),error:m=>messages.push(m),appendSummary:async(path,text)=>summaries.push(text)});
    assert.equal(decision.level,level);assert.equal(decision.exitCode,level==='CRITICAL'?1:0);
    assert.deepEqual(report,original);assert.equal(report.allFresh,false);
    assert.match(messages.join('\n'),level==='WARNING'?/::warning /:/::error /);
    assert.match(summaries[0],new RegExp(level));assert.match(summaries[0],/WARNING is not a PASS/);
  });
}

for(const [name,mutate] of [
  ['missing auth flag',r=>delete r.authBlocked],
  ['missing audit uncertainty',r=>delete r.auditOutcomeUncertain],
  ['missing recovery uncertainty',r=>delete r.recoveryOutcomeUncertain],
  ['negative recent age',r=>r.states[0].recentAgeMinutes=-1],
  ['nonfinite recent age',r=>r.states[0].recentAgeMinutes=Infinity],
  ['invalid historical age',r=>r.states[1].revisionAgeMinutes='invalid'],
  ['negative historical age',r=>r.states[1].revisionAgeMinutes=-1],
  ['missing coordinator age',r=>delete r.channels.coordinator.auditAgeMinutes],
  ['unexplained source HOLD',r=>r.states[0].verdict='HOLD'],
  ['contradictory revisionFresh',r=>r.states[1].revisionFresh=true],
  ['missing revisionFresh',r=>delete r.states[1].revisionFresh],
  ['hidden historical HOLD',r=>r.channels.historical.sources[1].verdict='OBSERVED'],
  ['aggregate historical UNKNOWN',r=>r.channels.historical.verdict='UNKNOWN'],
  ['source UNKNOWN',r=>r.channels.historical.sources[1].verdict='UNKNOWN'],
  ['duplicate recent source',r=>r.channels.recent.sources[1]=r.channels.recent.sources[0]],
  ['missing state',r=>r.states.pop()],
  ['extra state',r=>r.states.push(r.states[0])],
  ['invalid raw diagnostic',r=>r.evidenceIssues=null],
  ['contradictory raw diagnostic',r=>r.evidenceIssues=['contradictory-native-certificate']],
])test(`summary adversary: ${name} remains CRITICAL`,()=>{
  const r=fixture(41160491223).report;mutate(r);assert.equal(classifyWatchdogReport(r).level,'CRITICAL');
});

test('summary failure escalates even healthy/warning to CRITICAL without warning annotation',async()=>{
  for(const report of [fixture(41160491223).report,null]){
    const messages=[];
    const c=await publishWatchdogReport(report,{summaryPath:'unwritable',log:m=>messages.push(m),error:m=>messages.push(m),
      appendSummary:async()=>{throw Error('fixture-secret');}});
    assert.equal(c.level,'CRITICAL');assert.equal(c.exitCode,1);
    assert.match(messages.join('\n'),/::error /);assert.doesNotMatch(messages.join('\n'),/::warning |fixture-secret/);
  }
});

const preload=`import {readFileSync,appendFileSync} from 'node:fs';
const f=JSON.parse(readFileSync(process.env.WATCHDOG_FIXTURE,'utf8'));
Date.now=()=>f.now;
globalThis.fetch=async(input,options)=>{
 const u=new URL(input);
 if(u.origin!=='https://fixture.invalid'||options.method!=='GET'||options.headers.Authorization!=='Bearer fixture-secret')
   throw Error('unmocked network forbidden');
 appendFileSync(process.env.WATCHDOG_CALLS,JSON.stringify({path:u.pathname,search:u.search,method:options.method})+'\\n');
 const policy=u.pathname==='/api/freshness'&&u.searchParams.get('policy')==='1';
 if(!policy&&u.pathname!=='/api/source-reliability')throw Error('unexpected route');
 const error=policy?f.policyError:f.nativeError;
 if(error==='transport')throw Error('fixture-secret');
 if(error==='timeout')throw new DOMException('fixture-secret','TimeoutError');
 return {status:(policy?f.policyHttp:f.nativeHttp)??200,json:async()=>{
   if(error==='json')throw Error('fixture-secret');
   return policy?f.policy:f.native;
 }};
};`;

function cli(f,{invalidConfig=false,summaryFailure=false,noSummary=false}={}){
  const dir=mkdtempSync(join(tmpdir(),'nagame-watchdog-'));
  try{
    writeFileSync(join(dir,'preload.mjs'),preload);writeFileSync(join(dir,'fixture.json'),JSON.stringify(f));
    const env={PATH:process.env.PATH,WATCHDOG_FIXTURE:join(dir,'fixture.json'),WATCHDOG_CALLS:join(dir,'calls'),
      VIGIA_FRESHNESS_URL:invalidConfig?'http://fixture.invalid/api/freshness':'https://fixture.invalid/api/freshness',
      VIGIA_SYNC_TOKEN:'fixture-secret'};
    if(!noSummary)env.GITHUB_STEP_SUMMARY=summaryFailure?dir:join(dir,'summary');
    const result=spawnSync(process.execPath,['--import',join(dir,'preload.mjs'),
      fileURLToPath(new URL('../scripts/freshness-watchdog.mjs',import.meta.url))],{env,encoding:'utf8',timeout:5000});
    assert.equal(result.signal,null);assert.ifError(result.error);
    const output=result.stdout+'\n'+result.stderr;
    assert.doesNotMatch(output,/fixture-secret|Bearer /);
    const lines=result.stdout.split('\n');
    const report=lines.find(s=>s.startsWith('WATCHDOG {"phase":"summary"'));
    const decision=lines.find(s=>s.startsWith('WATCHDOG_DISPOSITION '));
    const calls=existsSync(join(dir,'calls'))?readFileSync(join(dir,'calls'),'utf8').trim().split('\n').map(JSON.parse):[];
    assert.ok(calls.every(c=>c.method==='GET'));
    return {status:result.status,output,calls,
      report:report?JSON.parse(report.slice('WATCHDOG '.length)):null,
      decision:decision?JSON.parse(decision.slice('WATCHDOG_DISPOSITION '.length)):null,
      summary:existsSync(join(dir,'summary'))?readFileSync(join(dir,'summary'),'utf8'):''};
  }finally{rmSync(dir,{recursive:true,force:true});}
}

const cases=[
  ['historical-only',()=>{},'WARNING'],
  ['known failed historical attempt',f=>f.native.state.revisionAttempts['RASFF:reconcile']={outcome:'failed',pendingDetails:[]},'WARNING'],
  ['known pending historical work',f=>f.native.state.revisionAttempts['RASFF:reconcile']={outcome:'partial',pendingDetails:[{reference:'fixture'}]},'WARNING'],
  ['healthy',()=>{},'HEALTHY',true],
  ['RASFF identity parity',f=>f.native.state.lastAudit.states[2].latestIdentityParity=false],
  ['expired RECENT',f=>f.native.state.lastAudit.states[0].lastSyncSuccessAt=stamp(46)],
  ['missing RECENT completion',f=>delete f.native.state.attempts.AESAN],
  ['active lease',f=>f.native.activeLease=true],
  ['unverified owner',f=>delete f.native.state.ownershipVerifiedAt],
  ['stale coordinator',f=>f.native.state.lastWakeAt=stamp(16)],
  ['future coordinator',f=>f.native.state.lastWakeAt=stamp(-1)],
  ['future audit',f=>f.native.state.lastAudit.finishedAt=stamp(-1)],
  ['future source check',f=>f.native.state.lastAudit.states[1].checkedAt=stamp(-1)],
  ['expired source check',f=>f.native.state.lastAudit.states[1].checkedAt=stamp(46)],
  ['invalid source check',f=>f.native.state.lastAudit.states[1].checkedAt='invalid'],
  ['future RECENT success',f=>f.native.state.lastAudit.states[1].lastSyncSuccessAt=stamp(-1)],
  ['future historical success',f=>f.native.state.lastAudit.states[1].revisionLastSuccessAt=stamp(-1)],
  ['invalid historical success',f=>f.native.state.lastAudit.states[1].revisionLastSuccessAt='invalid'],
  ['known historical HOLD with no prior success',f=>f.native.state.lastAudit.states[1].revisionLastSuccessAt=null,'WARNING'],
  ['fresh history without success',f=>{f.native.state.lastAudit.states[0].revisionLastSuccessAt=null;}],
  ['missing source',f=>f.native.state.lastAudit.states.pop()],
  ['duplicate source',f=>f.native.state.lastAudit.states[4]=f.native.state.lastAudit.states[0]],
  ['wrong source',f=>f.native.state.lastAudit.states[1].source='UNTRUSTED'],
  ['source error',f=>f.native.state.lastAudit.states[1].error='failed'],
  ['native UNKNOWN',f=>f.native.state.lastAudit.states[1].status='unknown'],
  ['historical UNKNOWN',f=>f.native.state.lastAudit.states[1].revisionStatus='unknown'],
  ['unknown historical attempt',f=>f.native.state.revisionAttempts['RAPNA:reconcile']={outcome:'unknown'}],
  ['invalid historical attempt',f=>f.native.state.revisionAttempts['RAPNA:reconcile']={}],
  ['contradictory source status',f=>f.native.state.lastAudit.states[1].status='fresh'],
  ['contradictory global claim',f=>f.native.officialParityCertified=true],
  ['contradictory audit claim',f=>f.native.state.lastAudit.allFresh=true],
  ['missing global claim',f=>delete f.native.officialParityCertified],
  ['native 401',f=>f.nativeHttp=401],['native 403',f=>f.nativeHttp=403],
  ['policy 401',f=>f.policyHttp=401],['policy 403',f=>f.policyHttp=403],
  ['native 503',f=>f.nativeHttp=503],['policy 503',f=>f.policyHttp=503],
  ['native 500',f=>f.nativeHttp=500],['policy 500',f=>f.policyHttp=500],
  ['native transport',f=>f.nativeError='transport'],['policy transport',f=>f.policyError='transport'],
  ['native timeout',f=>f.nativeError='timeout'],['policy timeout',f=>f.policyError='timeout'],
  ['native JSON',f=>f.nativeError='json'],['policy JSON',f=>f.policyError='json'],
  ['invalid policy',f=>f.policy.policies.pop()],
];
for(const [name,mutate,level='CRITICAL',healthy=false] of cases)test(`isolated CLI: ${name} -> ${level}`,()=>{
  const f=nativeFixture(healthy);mutate(f);const result=cli(f);
  assert.equal(result.status,level==='CRITICAL'?1:0,result.output);
  assert.equal(result.decision?.level,level,result.output);
  assert.equal(result.report.allFresh,healthy,name);
  assert.equal(result.calls.length,2,name);
  assert.match(result.summary,new RegExp(level));
  assert.match(result.summary,/WARNING is not a PASS/);
  if(level==='WARNING')assert.match(result.output,/::warning /);
  if(level==='CRITICAL')assert.match(result.output,/::error /);
  if(level==='HEALTHY')assert.doesNotMatch(result.output,/::warning |::error /);
});

test('CLI: configuration error fails before fetch and emits GitHub error',()=>{
  const result=cli(nativeFixture(),{invalidConfig:true});assert.equal(result.status,1);
  assert.equal(result.calls.length,0);assert.match(result.output,/::error /);
});
test('CLI: unavailable summary remains CRITICAL, code 1',()=>{
  const result=cli(nativeFixture(true),{summaryFailure:true});assert.equal(result.status,1);
  assert.equal(result.decision.level,'CRITICAL');assert.equal(result.decision.reason,'github-summary-unavailable');
  assert.match(result.output,/::error /);assert.doesNotMatch(result.output,/::warning /);
});
test('CLI: local execution without GitHub summary does not require one',()=>{
  const result=cli(nativeFixture(),{noSummary:true});assert.equal(result.status,0);
  assert.equal(result.decision.level,'WARNING');assert.equal(result.report.allFresh,false);
});

test('classification is stateless: repeated historical HOLD is WARNING each time, never suppresses critical transition',()=>{
  const r=fixture(41160491223).report;
  assert.equal(classifyWatchdogReport(r).level,'WARNING');assert.equal(classifyWatchdogReport(r).level,'WARNING');
  r.states[2].parity=false;assert.equal(classifyWatchdogReport(r).level,'CRITICAL');
});

