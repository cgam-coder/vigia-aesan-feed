import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assess, assessSilence, parsePolicy, runWatchdog, SOURCES } from '../scripts/freshness-watchdog.mjs';

const NOW = Date.parse('2026-10-02T07:00:00Z');
const stamp = delta => new Date(NOW + delta).toISOString();
const policy = { policyVersion:1, policies:SOURCES.map(source => ({ source,
  recent:{ freshMaxAgeMinutes:45, staleMaxAgeMinutes:60 },
  revision:{ required:source !== 'SAFETY GATE', scope:source === 'SAFETY GATE' ? 'recent-index-only' : 'full-archive',
    maxAgeMinutes:source === 'SAFETY GATE' ? null : 360, certification:source === 'SAFETY GATE' ? 'not-applicable' : 'required' } })) };
const fresh = source => ({ source, status:'fresh', checkedAt:stamp(0), activeLease:false, error:null,
  latestIdentityParity:true, missingOfficialIdentities:[], revisionMismatches:[],
  lastSyncSuccessAt:stamp(-60_000), revisionLastSuccessAt:source === 'SAFETY GATE' ? null : stamp(-60_000),
  revisionStatus:source === 'SAFETY GATE' ? 'not-required' : 'fresh' });
const response = (status, body) => ({ status, json:async () => body });

async function fixture({ nativeStatus=200, nativeBody={outcome:'disabled'}, policyBody=policy } = {}) {
  const calls = [];
  const report = await runWatchdog({ url:'https://local.invalid/api/freshness', token:'fixture-secret',
    clock:() => NOW, log:() => {},
    fetchImpl:async (url, options) => {
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      calls.push(new URL(url).pathname);
      if (new URL(url).pathname === '/api/source-reliability') return response(nativeStatus, nativeBody);
      assert.equal(new URL(url).searchParams.get('policy'), '1');
      return response(200, policyBody);
    } });
  return { report, calls };
}

for (const [name, nativeStatus, nativeBody] of [
  ['legacy 404',404,{}],
  ['legacy disabled',200,{outcome:'disabled'}],
  ['authorization denied',403,{}],
  ['non-native payload claiming freshness',200,{officialParityCertified:true,state:{lastAudit:{finishedAt:stamp(0),states:SOURCES.map(fresh)}}}],
]) test(`${name}: two GETs, UNKNOWN and zero writes`, async () => {
  const {report,calls}=await fixture({nativeStatus,nativeBody});
  assert.deepEqual(calls,['/api/source-reliability','/api/freshness']);
  assert.ok(report.states.every(s=>s.verdict==='UNKNOWN'));
  assert.equal(report.channels.recent.verdict,'UNKNOWN');
  assert.equal(report.allFresh,false);
  assert.equal(report.zeroWrite,true);
});

test('clock, fake version, missing/duplicate policy and false revision labels fail closed', async () => {
  for (const bad of [{...policy,policyVersion:2},{...policy,policies:policy.policies.slice(1)},
    {...policy,policies:[policy.policies[0],...policy.policies.slice(0,4)]}]) {
    assert.equal(parsePolicy(bad),null);
    const {report,calls} = await fixture({policyBody:bad}); assert.equal(report.allFresh,false); assert.equal(calls.length,2);
  }
  const p=parsePolicy(policy).get('AESAN');
  assert.equal(assess({...fresh('AESAN'),revisionStatus:'not-required'},'AESAN',p,NOW).verdict,'HOLD');
  assert.equal(assess({...fresh('AESAN'),lastSyncSuccessAt:stamp(1000)},'AESAN',p,NOW).verdict,'HOLD');
  assert.equal(assess({...fresh('AESAN'),revisionLastSuccessAt:stamp(-400 * 60_000)},'AESAN',p,NOW).verdict,'HOLD');
});
test('expired budget cannot dispatch a second GET', async () => {
  let elapsed = 0;
  const calls = [];
  const report = await runWatchdog({ url:'https://local.invalid/api/freshness', token:'fixture-secret',
    clock:() => NOW, monotonic:() => elapsed, log:() => {},
    fetchImpl:async (url, options) => {
      calls.push(options.method);
      elapsed = 90_001;
      return response(404, {});
    } });
  assert.deepEqual(calls,['GET']);
  assert.equal(report.allFresh,false);
  assert.equal(report.zeroWrite,true);
});
test('silence observer distinguishes trigger/completion/health; never authorizes recovery', () => {
  const run={id:1,event:'schedule',status:'completed',conclusion:'success',updated_at:stamp(-60 * 60_000)};
  assert.equal(assessSilence([run],NOW,45).verdict,'HOLD');
  const latest=assessSilence([{...run,updated_at:stamp(-10 * 60_000)}],NOW,45);
  assert.equal(latest.verdict,'OBSERVED'); assert.equal(latest.officialFreshnessCertified,false);
  assert.equal(latest.recoveryAuthorized,false);
  assert.equal(assessSilence([{...run,event:'push'}],NOW,45).verdict,'UNKNOWN');
  assert.equal(assessSilence([{...run,updated_at:stamp(1000)}],NOW,45).verdict,'UNKNOWN');
});
test('workflow retains writer gate, target, serialization and production secrets only at step scope', () => {
  const workflow=readFileSync(new URL('../.github/workflows/freshness-watchdog.yml',import.meta.url),'utf8');
  assert.match(workflow,/needs: \[writer_gate, runtime_target\]/);
  assert.match(workflow,/timeout-minutes: 35/); assert.match(workflow,/cancel-in-progress: false/);
  assert.match(workflow,/persist-credentials: false/); assert.match(workflow,/node-version: 22/);
  assert.match(workflow,/run: node scripts\/freshness-watchdog.mjs/);
  assert.match(workflow,/branches: \[main\]/); assert.equal((workflow.match(/secrets\.VIGIA_SYNC_TOKEN/g)||[]).length,1);
});


test('independent GitHub supervision uses GET only in native mode and rejects expired or uncertain certificates',async()=>{
  for(const scenario of ['pass','stale','unknown','duplicate']){
    const calls=[];const states=SOURCES.map(fresh);
    if(scenario==='duplicate')states[4]=states[0];
    const report=await runWatchdog({url:'https://local.invalid/api/freshness',token:'fixture-secret',clock:()=>NOW,monotonic:()=>0,log:()=>{},fetchImpl:async(url,options)=>{
      calls.push(options.method);assert.equal(options.method,'GET');
      if(new URL(url).searchParams.has('policy'))return response(200,policy);
      return response(200,{mode:'five-source-coordinated',outcome:'observed',officialParityCertified:scenario!=='unknown',activeLease:false,state:{lastAudit:{finishedAt:stamp(scenario==='stale'?-16*60000:0),allFresh:true,states}}});
    }});
    assert.equal(report.allFresh,scenario==='pass',scenario);assert.equal(report.zeroWrite,true);assert.equal(calls.length,2);
  }
});

test('unknown native ownership never falls through to legacy audit or ingestion POST',async()=>{
  const calls=[];const report=await runWatchdog({url:'https://local.invalid/api/freshness',token:'fixture-secret',clock:()=>NOW,monotonic:()=>0,log:()=>{},fetchImpl:async(url,options)=>{calls.push(options.method);if(new URL(url).searchParams.has('policy'))return response(200,policy);throw Error('lost control read');}});
  assert.equal(report.allFresh,false);assert.deepEqual(calls,['GET','GET']);
});


test('V20 channels: recent observed separately while three historical holds remain and global still fails',async()=>{
  const calls=[],states=SOURCES.map(fresh);
  for(const name of ['RAPNA','RASFF','OECD']){
    const i=SOURCES.indexOf(name);
    states[i]={...states[i],status:'stale',revisionStatus:'stale',revisionLastSuccessAt:stamp(-400*60_000)};
  }
  const native={mode:'five-source-coordinated',outcome:'observed',officialParityCertified:false,activeLease:false,
    state:{ownershipVerifiedAt:stamp(-30*60_000),lastWakeAt:stamp(-60_000),
      attempts:Object.fromEntries(SOURCES.map(s=>[s,{outcome:'completed'}])),
      lastAudit:{finishedAt:stamp(-60_000),allFresh:false,states}}};
  const report=await runWatchdog({url:'https://local.invalid/api/freshness',token:'fixture-secret',
    clock:()=>NOW,monotonic:()=>0,log:()=>{},fetchImpl:async(url,options)=>{
      calls.push({url:String(url),method:options.method});
      assert.equal(options.method,'GET');
      return response(200,new URL(url).searchParams.has('policy')?policy:native);
    }});
  assert.equal(report.allFresh,false);
  assert.equal(report.channels.coordinator.verdict,'OBSERVED');
  assert.equal(report.channels.recent.verdict,'OBSERVED');
  assert.equal(report.channels.historical.verdict,'HOLD');
  assert.deepEqual(report.channels.historical.sources.filter(s=>s.verdict==='HOLD').map(s=>s.source),['RAPNA','RASFF','OECD']);
  assert.equal(report.channels.recent.officialFreshnessCertified,false);
  assert.equal(report.channels.historical.officialFreshnessCertified,false);
  assert.equal(report.channels.recoveryAuthorized,false);
  assert.equal(report.channels.zeroWrite,true);
  assert.equal(calls.length,2);
});

test('V20 channels: stale coordinator, missing recent completion, active lease and invalid parity fail closed',async()=>{
  const base={mode:'five-source-coordinated',outcome:'observed',officialParityCertified:false,activeLease:false,
    state:{ownershipVerifiedAt:stamp(-30*60_000),lastWakeAt:stamp(-60_000),
      attempts:Object.fromEntries(SOURCES.map(s=>[s,{outcome:'completed'}])),
      lastAudit:{finishedAt:stamp(-60_000),allFresh:false,states:SOURCES.map(fresh)}}};
  for(const [name,update,expectedRecent] of [
    ['stale-heartbeat', n=>{n.state.lastWakeAt=stamp(-16*60_000);},'HOLD'],
    ['missing-attempt', n=>{delete n.state.attempts.AESAN;},'UNKNOWN'],
    ['unfinished-attempt', n=>{n.state.attempts.RASFF.outcome='unknown';},'HOLD'],
    ['active-control-lease', n=>{n.activeLease=true;},'HOLD'],
    ['identity-mismatch', n=>{n.state.lastAudit.states[4].latestIdentityParity=false;},'HOLD'],
    ['duplicate-source', n=>{n.state.lastAudit.states[4]=n.state.lastAudit.states[0];},'UNKNOWN'],
    ['expired-official-audit', n=>{n.state.lastAudit.finishedAt=stamp(-16*60_000);},'HOLD'],
  ]){
    const native=structuredClone(base);update(native);
    const report=await runWatchdog({url:'https://local.invalid/api/freshness',token:'fixture-secret',
      clock:()=>NOW,monotonic:()=>0,log:()=>{},fetchImpl:async(url,options)=>{
        assert.equal(options.method,'GET');
        return response(200,new URL(url).searchParams.has('policy')?policy:native);
      }});
    assert.equal(report.allFresh,false,name);
    assert.equal(report.channels.recent.verdict,expectedRecent,name);
    assert.equal(report.channels.recoveryAuthorized,false,name);
    assert.equal(report.calls.length,2,name);
  }
});

test('V20 channels: healthy recent and historical is only observed, never a new official certificate',async()=>{
  const native={mode:'five-source-coordinated',outcome:'observed',officialParityCertified:true,activeLease:false,
    state:{ownershipVerifiedAt:stamp(-30*60_000),lastWakeAt:stamp(-60_000),
      attempts:Object.fromEntries(SOURCES.map(s=>[s,{outcome:'completed'}])),
      lastAudit:{finishedAt:stamp(-60_000),allFresh:true,states:SOURCES.map(fresh)}}};
  const report=await runWatchdog({url:'https://local.invalid/api/freshness',token:'fixture-secret',
    clock:()=>NOW,monotonic:()=>0,log:()=>{},fetchImpl:async(url,options)=>{
      assert.equal(options.method,'GET');
      return response(200,new URL(url).searchParams.has('policy')?policy:native);
    }});
  assert.equal(report.allFresh,true);
  assert.equal(report.channels.recent.verdict,'OBSERVED');
  assert.equal(report.channels.historical.verdict,'OBSERVED');
  assert.equal(report.channels.recent.officialFreshnessCertified,false);
});

test('V20 F1: HTTP 503 with valid native data or valid policy cannot certify either channel', async()=>{
  const native={mode:'five-source-coordinated',outcome:'observed',activeLease:false,officialParityCertified:true,
    state:{ownershipVerifiedAt:stamp(-30*60_000),lastWakeAt:stamp(-60_000),
      attempts:Object.fromEntries(SOURCES.map(source=>[source,{outcome:'completed'}])),
      revisionAttempts:{},lastAudit:{finishedAt:stamp(-60_000),allFresh:true,states:SOURCES.map(fresh)}}};
  for (const failure of ['native-503','policy-503']){
    const calls=[];
    const report=await runWatchdog({url:'https://local.invalid/api/freshness',token:'fixture-secret',
      clock:()=>NOW,monotonic:()=>0,log:()=>{},fetchImpl:async(url,options)=>{
        assert.equal(options.method,'GET');
        const isPolicy=new URL(url).searchParams.has('policy');
        calls.push({method:options.method,isPolicy});
        return response((failure==='native-503'&&!isPolicy)||(failure==='policy-503'&&isPolicy)?503:200,isPolicy?policy:native);
      }});
    assert.equal(report.allFresh,false,failure);
    assert.equal(report.channels.coordinator.verdict,'UNKNOWN',failure);
    assert.equal(report.channels.recent.verdict,'UNKNOWN',failure);
    assert.equal(report.channels.historical.verdict,'UNKNOWN',failure);
    assert.ok(report.channels.recent.sources.every(x=>x.verdict==='UNKNOWN'),failure);
    assert.equal(report.zeroWrite,true,failure);
    assert.equal(report.channels.recoveryAuthorized,false,failure);
    assert.deepEqual(calls.map(x=>x.method),['GET','GET'],failure);
  }
});

test('V20 F1: ambiguous 503 with disabled legacy payload must not trigger POST fallback',async()=>{
  const calls=[];
  const report=await runWatchdog({url:'https://local.invalid/api/freshness',token:'fixture-secret',
    clock:()=>NOW,monotonic:()=>0,log:()=>{},fetchImpl:async(url,options)=>{
      calls.push(options.method);
      if(new URL(url).searchParams.has('policy'))return response(200,policy);
      return response(503,{mode:'disabled',outcome:'disabled'});
    }});
  assert.equal(report.allFresh,false);
  assert.equal(report.channels.coordinator.verdict,'UNKNOWN');
  assert.equal(report.channels.recent.verdict,'UNKNOWN');
  assert.equal(report.channels.recoveryAuthorized,false);
  assert.deepEqual(calls,['GET','GET']);
});

test('V20 F1: failed, unknown and pending historical attempts prevent historical observation despite fresh timestamp',async()=>{
  for(const [outcome,pendingDetails] of [
    ['failed',[]],['unknown',[]],['running',[]],['partial',[{reference:'test',notifId:1}]]
  ]){
    const native={mode:'five-source-coordinated',outcome:'observed',activeLease:false,officialParityCertified:false,
      state:{ownershipVerifiedAt:stamp(-30*60_000),lastWakeAt:stamp(-60_000),
        attempts:Object.fromEntries(SOURCES.map(source=>[source,{outcome:'completed'}])),
        revisionAttempts:{'RASFF:reconcile':{outcome,pendingDetails}},
        lastAudit:{finishedAt:stamp(-60_000),allFresh:false,states:SOURCES.map(fresh)}}};
    const calls=[];
    const report=await runWatchdog({url:'https://local.invalid/api/freshness',token:'fixture-secret',
      clock:()=>NOW,monotonic:()=>0,log:()=>{},fetchImpl:async(url,options)=>{
        calls.push(options.method);
        return response(200,new URL(url).searchParams.has('policy')?policy:native);
      }});
    assert.equal(report.channels.recent.verdict,'OBSERVED',outcome);
    assert.equal(report.channels.historical.verdict,'HOLD',outcome);
    assert.equal(report.channels.historical.sources.find(s=>s.source==='RASFF').verdict,'HOLD',outcome);
    assert.equal(report.allFresh,false,outcome);
    assert.deepEqual(calls,['GET','GET'],outcome);
  }
});

test('watchdog preserves 15-minute schedule and routes exit through severity policy',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/freshness-watchdog.yml',import.meta.url),'utf8');
  const script=readFileSync(new URL('../scripts/freshness-watchdog.mjs',import.meta.url),'utf8');
  assert.match(workflow,/cron: "13,28,43,58 \* \* \* \*"/);
  assert.match(workflow,/timeout-minutes: 35/);
  assert.match(script,/let decision = classifyWatchdogReport\(report\);/);
  assert.match(script,/const decision = await publishWatchdogReport\(report\);/);
  assert.match(script,/if \(decision\.exitCode !== 0\) process\.exitCode = decision\.exitCode;/);
  assert.doesNotMatch(script,/method:\s*['"]POST['"]|recover:\s*['"]1['"]/);
});
