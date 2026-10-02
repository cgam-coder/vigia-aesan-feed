import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assess, assessSilence, BUDGET, parsePolicy, runWatchdog, SOURCES } from '../scripts/freshness-watchdog.mjs';

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
const sync = source => ({ recent:{ source, mode:'recent', status:'completed', lastSuccessAt:stamp(-60_000), lastError:null },
  lease:null, backfill:null, snapshot:null });
const response = (status, body) => ({ status, json:async () => body });

async function fixture({ overrides={}, recovery, before, after, advance=0, initialFailure, observationFailure, policyBody=policy } = {}) {
  const calls = []; const logs = [];
  let elapsed = 0;
  let syncReads = 0;
  const report = await runWatchdog({ url:'https://local.invalid/api/freshness', token:'fixture-secret',
    clock:() => NOW + elapsed, monotonic:() => elapsed, log:r => logs.push(r),
    fetchImpl:async (url, options) => {
      url = new URL(url);
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      const source = url.searchParams.get('source');
      const recover = url.searchParams.get('recover');
      calls.push({ path:url.pathname, params:Object.fromEntries(url.searchParams), method:options.method });
      if (url.searchParams.has('policy')) return response(200, policyBody);
      if (url.pathname === '/api/freshness' && options.method === 'GET') {
        if (initialFailure) throw new Error('fixture transport');
        return response(200, { states:SOURCES.map(fresh) });
      }
      if (url.pathname.endsWith('/sync')) {
        const source = SOURCES[['aesan','rapna','rasff','safety-gate','oecd'].indexOf(url.pathname.split('/')[2])];
        if (syncReads++ < 5) { if (source===observationFailure) throw new Error('read failure'); return response(200,sync(source)); }
        return response(200, (syncReads === 6 ? before : after) ?? sync(source));
      }
      if (recover === '1') {
        if (recovery instanceof Error) throw recovery;
        if (recovery?.invalidJson) return { status:200, json:async () => { throw new Error('bad JSON'); } };
        const state = recovery?.state ?? fresh(source);
        return response(recovery?.http ?? (state.status === 'fresh' ? 200 : 503), { allFresh:state.status === 'fresh', states:[state] });
      }
      elapsed += advance;
      const override = overrides[source];
      if (override instanceof Error) throw override;
      if (override?.nullBody) return response(200,null);
      if (override?.invalidJson) return { status:200, json:async () => { throw new Error('fixture-secret'); } };
      if (override?.http && !override.state) return response(override.http, {});
      const state = override?.state ?? fresh(source);
      return response(override?.http ?? (state.status === 'fresh' ? 200 : 503), {
        states:override?.states ?? [state], allFresh:override?.allFresh ?? (state.status === 'fresh') });
    } });
  assert.equal(JSON.stringify(logs).includes('fixture-secret'), false);
  assert.ok(report.elapsedMs <= BUDGET.global || advance > 0);
  return { report, calls, logs };
}
const audits = calls => calls.filter(c => c.params.recover === '0');
const recoveries = calls => calls.filter(c => c.params.recover === '1');
const needsRecovery = source => ({ ...fresh(source), status:'stale', lastSyncSuccessAt:stamp(-65 * 60_000) });

test('all five official audits precede any recovery; persisted GET is not certification', async () => {
  const { report, calls, logs } = await fixture();
  assert.equal(report.allFresh, true); assert.equal(audits(calls).length, 5); assert.equal(recoveries(calls).length, 0);
  assert.equal(calls.slice(0,2).every(c => c.method === 'GET'), true);
  assert.equal(logs.find(l => l.phase === 'persisted-observation' && l.zeroWrite).currentOfficialParityCertified, false);
});
for (const [name, override] of [
  ['transport', new Error('fixture-secret')], ['JSON', { invalidJson:true }], ['null JSON', {nullBody:true}],
  ['missing state', { states:[] }], ['wrong identity', { state:{ ...fresh('AESAN'), source:'RAPNA' } }],
  ['HTTP failure', { http:500 }], ['contradictory allFresh', { allFresh:false }],
  ['future timestamp', { state:{ ...fresh('AESAN'), checkedAt:stamp(1000) } }],
  ['old audit replay', { state:{ ...fresh('AESAN'), checkedAt:stamp(-1000) } }],
]) test(`${name}: all five reads attempted; uncertain audit blocks later POSTs and recovery`, async () => {
  const { report, calls } = await fixture({ overrides:{ AESAN:override, OECD:{ state:needsRecovery('OECD') } } });
  assert.equal(calls.filter(c=>c.path.endsWith('/sync')).length,5);
  assert.equal(audits(calls).length, 1); assert.equal(recoveries(calls).length, 0);
  assert.equal(report.states[0].verdict, 'UNKNOWN'); assert.equal(report.allFresh, false);
  assert.equal(report.states[1].verdict, 'UNKNOWN'); assert.equal(calls.at(-1).method,'GET');
});
test('first source read failure does not suppress the other four observations and audits',async()=>{
  const {report,calls}=await fixture({observationFailure:'AESAN'});
  assert.equal(calls.filter(c=>c.path.endsWith('/sync')).length,5); assert.equal(audits(calls).length,4);
  assert.equal(report.states[0].verdict,'UNKNOWN'); assert.equal(report.states[1].verdict,'PASS');
  assert.equal(recoveries(calls).length,0);
});
for (const http of [401,403]) test(`${http}: auth rejection prevents later action, sources remain UNKNOWN`, async () => {
  const { report, calls } = await fixture({ overrides:{ AESAN:{ http } } });
  assert.equal(audits(calls).length, 1); assert.equal(report.authBlocked, true);
  assert.equal(report.states.every(s => s.verdict === 'UNKNOWN'), true); assert.equal(recoveries(calls).length, 0);
});
test('persisted read failure does not abort official source audits', async () => {
  const { report, calls } = await fixture({ initialFailure:true });
  assert.equal(report.allFresh, true); assert.equal(audits(calls).length, 5);
});
test('valid 503 continues, revision-only stale never triggers recent recovery', async () => {
  const state = { ...fresh('RASFF'), status:'stale', revisionStatus:'stale', revisionLastSuccessAt:stamp(-400 * 60_000) };
  const { report, calls } = await fixture({ overrides:{ RASFF:{ state } } });
  assert.equal(audits(calls).length, 5); assert.equal(recoveries(calls).length, 0);
  assert.equal(report.states[2].verdict, 'HOLD');
});
test('one recovery after all five audits with read-only before and after', async () => {
  const { report, calls } = await fixture({ overrides:{ AESAN:{ state:needsRecovery('AESAN') } } });
  assert.equal(report.allFresh, true); assert.equal(recoveries(calls).length, 1);
  const index = calls.findIndex(c => c.params.recover === '1');
  assert.equal(audits(calls.slice(0,index)).length, 5);
  assert.equal(calls[index-1].method, 'GET'); assert.equal(calls[index+1].method, 'GET');
});
for (const [name, recovery] of [['timeout',new Error('timeout')],['bad response',{invalidJson:true}],
  ['wrong identity',{state:fresh('RAPNA')}],['HTTP error',{http:500}]])
test(`${name}: unknown remote recovery outcome, one POST, GET reconciliation cannot manufacture PASS`, async () => {
  const { report, calls, logs } = await fixture({ overrides:{ AESAN:{ state:needsRecovery('AESAN') } }, recovery });
  assert.equal(recoveries(calls).length, 1); assert.equal(report.allFresh, false);
  assert.equal(report.states[0].verdict, 'UNKNOWN'); assert.equal(report.recoveryOutcomeUncertain, true);
  assert.equal(calls.at(-1).method, 'GET'); assert.equal(logs.find(l => l.phase === 'reconcile' && l.zeroWrite).retryAuthorized, false);
});
for (const [name,before] of [['active lease',{ ...sync('AESAN'), lease:{source:'AESAN'} }],
  ['missing lease',{recent:sync('AESAN').recent}],['backfill running',{...sync('AESAN'),backfill:{source:'AESAN',status:'running'}}],
  ['wrong source',sync('OECD')]]) test(`${name}: exclude recovery without bypassing lease/backfill`, async () => {
  const { report,calls } = await fixture({ overrides:{ AESAN:{state:needsRecovery('AESAN')} }, before });
  assert.equal(recoveries(calls).length,0); assert.equal(report.allFresh,false);
});
test('lease still active after successful POST remains UNKNOWN', async () => {
  const {report} = await fixture({overrides:{AESAN:{state:needsRecovery('AESAN')}},after:{...sync('AESAN'),lease:{source:'AESAN'}}});
  assert.equal(report.states[0].verdict,'UNKNOWN'); assert.equal(report.allFresh,false);
});
test('five audit maxima fit before recovery; expired global budget cannot dispatch more POSTs', async () => {
  assert.equal(2 * BUDGET.read + 5 * BUDGET.read + 5 * BUDGET.audit + BUDGET.recovery + 2 * BUDGET.read, BUDGET.global);
  const { report,calls } = await fixture({ advance:7 * 60_000 });
  assert.equal(audits(calls).length,5); assert.equal(recoveries(calls).length,0);
  assert.equal(report.allFresh,false); // earlier observations age/replay inconsistencies cannot turn green
});
test('clock, fake version, missing/duplicate policy and false revision labels fail closed', async () => {
  for (const bad of [{...policy,policyVersion:2},{...policy,policies:policy.policies.slice(1)},
    {...policy,policies:[policy.policies[0],...policy.policies.slice(0,4)]}]) {
    assert.equal(parsePolicy(bad),null);
    const {report,calls} = await fixture({policyBody:bad}); assert.equal(report.allFresh,false); assert.equal(audits(calls).length,0);
  }
  const p=parsePolicy(policy).get('AESAN');
  assert.equal(assess({...fresh('AESAN'),revisionStatus:'not-required'},'AESAN',p,NOW).verdict,'HOLD');
  assert.equal(assess({...fresh('AESAN'),lastSyncSuccessAt:stamp(1000)},'AESAN',p,NOW).verdict,'HOLD');
  assert.equal(assess({...fresh('AESAN'),revisionLastSuccessAt:stamp(-400 * 60_000)},'AESAN',p,NOW).verdict,'HOLD');
});
test('budget exhausted by earlier requests leaves later sources UNKNOWN without dispatch',async()=>{
  const {report,calls}=await fixture({advance:10 * 60_000});
  assert.equal(audits(calls).length,4); assert.equal(report.states[4].verdict,'UNKNOWN');
  assert.equal(report.allFresh,false); assert.equal(recoveries(calls).length,0);
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
