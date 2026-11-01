import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {runWatchdog,SOURCES} from '../scripts/freshness-watchdog.mjs';
import {classifyWatchdogReport,watchdogStepSummary} from '../scripts/watchdog-disposition.mjs';
const load=name=>JSON.parse(readFileSync(new URL('./fixtures/watchdog/'+name,import.meta.url)));
const archived=load('run-41231581014.json').report;
const projection=load('native-182-projection.json');
const now=Date.parse(projection.now);
const gate={protocol:'v35-audit-only-reader-v1',allow:false,consumerAllow:true,
  reason:'V35_AUDIT_ONLY_READER',cycles:0,unsafe:0,legacyUnresolved:0};
const policy={policyVersion:1,policies:SOURCES.map(source=>({source,
  recent:{freshMaxAgeMinutes:45,staleMaxAgeMinutes:60},revision:{required:source!=='SAFETY GATE',
  scope:source==='SAFETY GATE'?'recent-index-only':'full-archive',maxAgeMinutes:source==='RASFF'?360:1440,
  certification:source==='SAFETY GATE'?'not-applicable':'required'}}))};
function scenario(){
  // D1 evidence is original. Lease release and affirmative gate are explicit
  // isolated scenarios; no positive HTTP gate was captured from production.
  const body=structuredClone(projection.native);
  body.activeLease=false;body.certificationGate=structuredClone(gate);return body;
}
async function observe(body){
  const before=structuredClone(body),calls=[];
  const report=await runWatchdog({url:'https://fixture.invalid/api/freshness',token:'fixture-only',
    clock:()=>now,monotonic:()=>0,log:()=>{},fetchImpl:async(url,options)=>{
      calls.push(options.method);assert.equal(options.method,'GET');
      return {status:200,json:async()=>new URL(url).searchParams.has('policy')?policy:body};
    }});
  assert.deepEqual(body,before);assert.deepEqual(calls,['GET','GET']);return report;
}

test('authentic run 41231581014 remains CRITICAL; both recorded blockers independently suffice',()=>{
  assert.ok(archived.states.every(s=>s.recentFresh&&s.parity));
  assert.equal(archived.channels.coordinator.auditAgeMinutes,16.502233333333333);
  assert.equal(classifyWatchdogReport(archived).level,'CRITICAL');
  const auditOnly=structuredClone(archived);auditOnly.evidenceIssues=[];
  assert.equal(classifyWatchdogReport(auditOnly).reason,'coordinator-or-recent-not-verified');
  const unknownOnly=structuredClone(archived);unknownOnly.channels.coordinator.verdict='OBSERVED';
  unknownOnly.channels.recent.verdict='OBSERVED';unknownOnly.channels.coordinator.auditAgeMinutes=1;
  assert.equal(classifyWatchdogReport(unknownOnly).reason,'contradictory-or-unknown-native-evidence');
});
test('authentic coordinator timestamps reproduce nominal schedule expiry without a missed wake',()=>{
  const finish=Date.parse('2026-10-31T18:37:13.437Z');
  const earlier=Date.parse('2026-10-31T18:51:12.335Z');
  const nextStart=Date.parse('2026-10-31T18:56:04.915Z');
  const nextFinish=Date.parse('2026-10-31T18:56:29.775Z');
  assert.ok(earlier-finish<15*60000);assert.ok(nextStart-finish>15*60000);
  assert.equal(nextFinish-finish,1156338); // 19.2723 minutes, authentic telemetry
  const github=Date.parse('2026-10-31T18:53:43.571Z');
  assert.ok(github>finish+15*60000&&github<nextFinish);
});
test('D1 unknown attempt is real and preserved, not an unrecognized outcome spelling',async()=>{
  const body=scenario();delete body.certificationGate;
  const r=await observe(body);assert.ok(r.evidenceIssues.includes('unknown-historical-attempt'));
  assert.equal(classifyWatchdogReport(r).level,'CRITICAL');
  assert.equal(body.state.revisionAttempts['RAPNA:current-parity'].outcome,'unknown');
});
test('exact native-classified historical UNKNOWN can be WARNING with fresh coordinator; never global PASS',async()=>{
  const body=scenario(),r=await observe(body),c=classifyWatchdogReport(r);
  assert.deepEqual(r.evidenceIssues,[]);assert.equal(c.level,'WARNING');assert.equal(c.exitCode,0);
  assert.equal(r.allFresh,false);assert.equal(c.globalOfficialAllFresh,false);
  assert.equal(r.channels.historical.verdict,'HOLD');assert.equal(r.channels.recent.verdict,'OBSERVED');
  assert.equal(c.preservedHistoricalUnknowns[0].originalOutcome,'unknown');
  assert.match(watchdogStepSummary(c),/Preserved historical UNKNOWN.*RAPNA:current-parity/);
  assert.equal(body.state.revisionAttempts['RAPNA:current-parity'].outcome,'unknown');
});
for(const [name,change] of [
  ['missing gate',b=>delete b.certificationGate],
  ['wrong protocol',b=>b.certificationGate.protocol='unverified'],
  ['consumer denied',b=>b.certificationGate.consumerAllow=false],
  ['consumer missing',b=>delete b.certificationGate.consumerAllow],
  ['global allow claimed',b=>b.certificationGate.allow=true],
  ['wrong gate reason',b=>b.certificationGate.reason='REVISION_UNRESOLVED'],
  ['unsafe gate',b=>b.certificationGate.unsafe=1],
  ['legacy unresolved',b=>b.certificationGate.legacyUnresolved=1],
  ['missing census',b=>delete b.certificationGate.cycles],
  ['string census',b=>b.certificationGate.cycles='0'],
  ['other job identity',b=>b.state.revisionAttempts['RAPNA:current-parity'].id='other'],
  ['other reason',b=>b.state.revisionAttempts['RAPNA:current-parity'].reason='prior-revision-outcome-unconfirmed-no-retry'],
  ['persistence uncertainty',b=>b.state.revisionAttempts['RAPNA:current-parity'].reason='SOURCE_PERSISTENCE_OUTCOME_UNKNOWN: durable effect'],
  ['pending details',b=>b.state.revisionAttempts['RAPNA:current-parity'].pendingDetails=[{reference:'unconfirmed'}]],
  ['missing pending details',b=>delete b.state.revisionAttempts['RAPNA:current-parity'].pendingDetails],
  ['wrong source/mode',b=>{b.state.revisionAttempts['OECD:current-parity']=b.state.revisionAttempts['RAPNA:current-parity'];delete b.state.revisionAttempts['RAPNA:current-parity'];}],
  ['additional unknown',b=>b.state.revisionAttempts['RASFF:reconcile'].outcome='unknown'],
])test(`native resolution guard rejects ${name}`,async()=>{
  const body=scenario();change(body);const r=await observe(body);
  assert.ok(r.evidenceIssues.includes('unknown-historical-attempt'),name);
  assert.equal(classifyWatchdogReport(r).level,'CRITICAL');
});
for(const [name,change] of [
  ['audit at 16.50 minutes',b=>b.state.lastAudit.finishedAt=new Date(now-16.502233333333333*60000).toISOString()],
  ['stale heartbeat',b=>b.state.lastWakeAt=new Date(now-16*60000).toISOString()],
  ['active coordinator lease',b=>b.activeLease=true],
  ['RECENT parity',b=>b.state.lastAudit.states[2].latestIdentityParity=false],
  ['RECENT expiry',b=>b.state.lastAudit.states[2].lastSyncSuccessAt=new Date(now-46*60000).toISOString()],
  ['source UNKNOWN',b=>b.state.lastAudit.states[2].status='unknown'],
])test(`native classified historical HOLD never masks ${name}`,async()=>{
  const b=scenario();change(b);assert.equal(classifyWatchdogReport(await observe(b)).level,'CRITICAL');
});
test('audit threshold remains precisely 15 minutes, not a grace window',async()=>{
  for(const [age,level] of [[15,'WARNING'],[15+1/60000,'CRITICAL']]){
    const b=scenario();b.state.lastAudit.finishedAt=new Date(now-age*60000).toISOString();
    assert.equal(classifyWatchdogReport(await observe(b)).level,level);
  }
});
test('existing native-held UNKNOWN prevents HEALTHY even with otherwise fresh history',async()=>{
  const b=scenario();b.officialParityCertified=true;b.state.lastAudit.allFresh=true;
  for(const s of b.state.lastAudit.states){s.status='fresh';s.revisionStatus=s.source==='SAFETY GATE'?'not-required':'fresh';
    s.revisionLastSuccessAt=s.source==='SAFETY GATE'?null:new Date(now-60000).toISOString();}
  assert.equal(classifyWatchdogReport(await observe(b)).level,'CRITICAL');
});

for(const [name,mutate,level] of [
  ['classified historical hold',()=>{},'WARNING'],
  ['expired audit',b=>b.state.lastAudit.finishedAt=new Date(now-16.502233333333333*60000).toISOString(),'CRITICAL'],
  ['unclassified unknown',b=>delete b.certificationGate,'CRITICAL'],
])test(`CLI residual: ${name} -> ${level}`,()=>{
  const dir=mkdtempSync(join(tmpdir(),'nagame-residual-'));
  try{
    const b=scenario();mutate(b);writeFileSync(join(dir,'responses.json'),JSON.stringify({body:b,policy,now}));
    writeFileSync(join(dir,'preload.mjs'),`import {readFileSync} from 'node:fs';
      const f=JSON.parse(readFileSync(process.env.RESPONSES));Date.now=()=>f.now;
      globalThis.fetch=async(u,o)=>{if(new URL(u).origin!=='https://fixture.invalid'||o.method!=='GET')throw Error('unmocked transport');
      return {status:200,json:async()=>new URL(u).searchParams.has('policy')?f.policy:f.body};};`);
    const p=spawnSync(process.execPath,['--import',join(dir,'preload.mjs'),fileURLToPath(new URL('../scripts/freshness-watchdog.mjs',import.meta.url))],
      {encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH,RESPONSES:join(dir,'responses.json'),VIGIA_FRESHNESS_URL:'https://fixture.invalid/api/freshness',VIGIA_SYNC_TOKEN:'fixture-only',GITHUB_STEP_SUMMARY:join(dir,'summary')}});
    assert.ifError(p.error);assert.equal(p.status,level==='CRITICAL'?1:0,p.stdout+p.stderr);
    const decision=JSON.parse(p.stdout.split('\n').find(l=>l.startsWith('WATCHDOG_DISPOSITION ')).slice('WATCHDOG_DISPOSITION '.length));
    assert.equal(decision.level,level);assert.equal(decision.globalOfficialAllFresh,false);
    assert.match(p.stdout+p.stderr,level==='WARNING'?/::warning /:/::error /);
    assert.match(readFileSync(join(dir,'summary'),'utf8'),/WARNING is not a PASS/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
