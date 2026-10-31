import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyWatchdogReport,watchdogStepSummary,SOURCE_NAMES} from '../scripts/watchdog-disposition.mjs';

function report({historicalHolds=['RAPNA','RASFF','OECD'],allFresh=false}={}) {
  const states=SOURCE_NAMES.map(source=>({
    source, verdict:historicalHolds.includes(source)?'HOLD':'PASS',
    recentFresh:true, parity:true, reason:null,
    recentAgeMinutes:1, revisionAgeMinutes:source==='SAFETY GATE'?null:historicalHolds.includes(source)?400:1,
    revisionFresh:!historicalHolds.includes(source),
  }));
  return {
    policyVersion:1, supervisor:'github-observes-cloudflare',
    authBlocked:false,recoveryOutcomeUncertain:false,auditOutcomeUncertain:false,zeroWrite:true,
    allFresh,states,
    calls:[{phase:'native-heartbeat',method:'GET',http:200},{phase:'policy',method:'GET',http:200}],
    channels:{
      coordinator:{verdict:'OBSERVED',wakeAgeMinutes:1,auditAgeMinutes:1},recoveryAuthorized:false,zeroWrite:true,
      recent:{verdict:'OBSERVED',officialFreshnessCertified:false,
        sources:SOURCE_NAMES.map(source=>({source,verdict:'OBSERVED'}))},
      historical:{verdict:historicalHolds.length?'HOLD':'OBSERVED',officialFreshnessCertified:false,
        sources:SOURCE_NAMES.map(source=>({source,verdict:source==='SAFETY GATE'?'NOT_REQUIRED':historicalHolds.includes(source)?'HOLD':'OBSERVED'}))},
    },
  };
}

function outcome(r){return classifyWatchdogReport(r)}
test('five RECENT observed + historical HOLD = nonpassing global WARNING, no repeated failure exit',()=>{
  const r=report();const c=outcome(r);
  assert.equal(c.level,'WARNING');assert.equal(c.exitCode,0);
  assert.equal(c.globalOfficialAllFresh,false);assert.equal(r.allFresh,false);
  assert.deepEqual(c.historicalHolds,['RAPNA','RASFF','OECD']);
  assert.match(watchdogStepSummary(c),/WARNING is not a PASS/);
});
test('real global certification retains HEALTHY without faking historical completion',()=>{
  const c=outcome(report({historicalHolds:[],allFresh:true}));
  assert.equal(c.level,'HEALTHY');assert.equal(c.exitCode,0);
  assert.equal(c.globalOfficialAllFresh,true);
});
test('recent parity false stays CRITICAL even if historical HOLD exists',()=>{
  const r=report();r.states[2].parity=false;r.channels.recent.sources[2].verdict='HOLD';r.channels.recent.verdict='HOLD';
  assert.equal(outcome(r).level,'CRITICAL');
});
test('coordinator stale, unknown, or stopped is CRITICAL',()=>{
  for(const v of ['HOLD','UNKNOWN']){const r=report();r.channels.coordinator.verdict=v;assert.equal(outcome(r).exitCode,1)}
});
test('recent evidence missing, UNKNOWN, or HOLD is CRITICAL',()=>{
  for(const v of ['HOLD','UNKNOWN']){const r=report();r.channels.recent.verdict=v;assert.equal(outcome(r).exitCode,1)}
});
test('historical UNKNOWN is not silently reduced to WARNING',()=>{
  const r=report();r.channels.historical.sources[1].verdict='UNKNOWN';
  assert.equal(outcome(r).level,'CRITICAL');
});
test('only Safety Gate may be NOT_REQUIRED under the current five-source contract',()=>{
  const r=report();r.channels.historical.sources[0].verdict='NOT_REQUIRED';
  assert.equal(outcome(r).level,'CRITICAL');
});
test('bad zeroWrite or any recovery claim is CRITICAL',()=>{
  for(const key of ['zeroWrite','recoveryAuthorized']){const r=report();
    if(key==='zeroWrite')r.zeroWrite=false;else r.channels.recoveryAuthorized=true;
    assert.equal(outcome(r).level,'CRITICAL',key)}
});
test('auth and uncertain remote operations always fail closed',()=>{
  for(const key of ['authBlocked','recoveryOutcomeUncertain','auditOutcomeUncertain']){
    const r=report();r[key]=true;assert.equal(outcome(r).level,'CRITICAL',key)
  }
});
test('unknown provenance, policy or channel certificates fail closed',()=>{
  for(const key of ['policyVersion','supervisor']){
    const r=report();r[key]=key==='policyVersion'?2:'unverified';assert.equal(outcome(r).level,'CRITICAL')
  }
  const r=report();r.channels.recent.officialFreshnessCertified=true;
  assert.equal(outcome(r).level,'CRITICAL');
});
test('native transport must be exactly two successful GET calls',()=>{
  for(const change of [r=>r.calls[0].method='POST',r=>r.calls[1].http=503,
    r=>r.calls.pop(),r=>r.calls[0].phase='recovery']){
    const r=report();change(r);assert.equal(outcome(r).level,'CRITICAL')
  }
});
test('duplicated or missing source cannot be downgraded',()=>{
  const r=report();r.states[1].source='AESAN';assert.equal(outcome(r).level,'CRITICAL');
  const x=report();x.channels.historical.sources.pop();assert.equal(outcome(x).level,'CRITICAL');
});
test('inconsistent global certificate fails closed',()=>{
  const r=report({allFresh:true});assert.equal(outcome(r).level,'CRITICAL');
  const x=report({historicalHolds:[],allFresh:false});assert.equal(outcome(x).level,'CRITICAL');
});
test('source error, fresh age or identity doubt is CRITICAL',()=>{
  for(const mutate of [r=>r.states[4].reason='runtime-source-error',r=>r.states[4].recentFresh=false,r=>r.states[4].verdict='UNKNOWN']){
    const r=report();mutate(r);assert.equal(outcome(r).level,'CRITICAL')
  }
});
test('summary renders fixed enum and never grants recovery',()=>{
  for(const r of [report(),report({historicalHolds:[],allFresh:true})]){
    const c=outcome(r),s=watchdogStepSummary(c);
    assert.match(s,/Mutations or recovery authorized by this classification: \*\*NO\*\*/);
    assert.ok(!s.includes('fixture-secret'));
  }
});
