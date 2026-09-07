import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/safety-gate-sync.yml', import.meta.url), 'utf8');
const refresh = workflow.split('      - name: Refresh Safety Gate\n')[1].split('        run: |\n')[1]
  .split('\n').map(line => line.startsWith('          ') ? line.slice(10) : line).join('\n');
const completed = { source:'SAFETY GATE', mode:'recent', status:'completed', lastError:null,
  leaseOwnerId:null, leaseMode:null, leaseExpiresAt:null,
  startedAt:'2026-09-07T14:22:44.647Z', completedAt:'2026-09-07T14:25:44.647Z',
  pagesScanned:1, recordsObserved:1, newCount:1, updatedCount:0 };

// Execute the workflow's actual shell + inline parser. Only curl is replaced;
// this records every invocation and never reaches a network or reads a secret.
function runFixture(fixture) {
  const dir = mkdtempSync(join(tmpdir(), 'safety-gate-workflow-'));
  try {
    writeFileSync(join(dir, 'fixture.json'), JSON.stringify(fixture));
    writeFileSync(join(dir, 'curl'), `#!${process.execPath}
const fs=require('node:fs');
const path=require('node:path');
const dir=process.env.RUNNER_TEMP;
const fixture=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json'),'utf8'));
const args=process.argv.slice(2);
const url=args.at(-1);
fs.appendFileSync(path.join(dir,'calls.jsonl'),JSON.stringify(args)+'\\n');
const diagnostic=url.endsWith('?observe=1');
const transport=diagnostic ? (fixture.diagnosticExit||0) : (fixture.transportExit||0);
const output=args[args.indexOf('--output')+1];
const body=diagnostic ? (fixture.observe||{recent:{status:'running'},lease:{ownerId:'alive'}}) : fixture.body;
fs.writeFileSync(output,typeof body==='string'?body:JSON.stringify(body||{}));
process.stdout.write(String(diagnostic?(fixture.diagnosticHttp||200):(fixture.http||0)));
process.exit(transport);
`, { mode:0o755 });
    const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', refresh], {
      encoding:'utf8', timeout:5000,
      env:{ PATH:`${dir}:${process.env.PATH}`, RUNNER_TEMP:dir,
        VIGIA_SAFETY_GATE_SYNC_URL:'https://local.invalid/api/safety-gate/sync',
        VIGIA_SYNC_TOKEN:'local-fixture-only' },
    });
    if (result.error) throw result.error;
    const calls = readFileSync(join(dir, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    const mutations = calls.filter(args => args.includes('POST'));
    assert.equal(mutations.length, 1, 'exactly one mutation per execution');
    assert.equal(mutations[0].at(-1), 'https://local.invalid/api/safety-gate/sync?mode=recent');
    assert.equal(mutations[0][0], '-q', 'ignore implicit curlrc retries/redirects');
    assert.equal(mutations[0].some(arg => arg.startsWith('--retry') || ['--location', '-L'].includes(arg)), false);
    assert.equal(mutations[0][mutations[0].indexOf('--max-time') + 1], '420');
    const diagnostics = calls.filter(args => args.includes('GET'));
    assert.equal(diagnostics.length, result.status === 0 ? 0 : 1);
    if (diagnostics.length) {
      assert.equal(diagnostics[0].at(-1), 'https://local.invalid/api/safety-gate/sync?observe=1');
      assert.equal(diagnostics[0][diagnostics[0].indexOf('--max-time') + 1], '30');
    }
    assert.equal(calls.length, mutations.length + diagnostics.length);
    return result;
  } finally { rmSync(dir, { recursive:true, force:true }); }
}

test('scheduled serialization, bounded preflight, shell syntax and single mutation', () => {
  assert.match(workflow, /schedule:\n\s+- cron: "7,37 \* \* \* \*"/);
  assert.match(workflow, /group: vigia-safety-gate-recent\n\s+cancel-in-progress: false/);
  assert.match(workflow, /timeout-minutes: 10/);
  assert.match(workflow, /name: Bounded read-plane and authorization preflight\n\s+timeout-minutes: 2/);
  assert.equal((refresh.match(/--request POST/g) || []).length, 1);
  assert.doesNotMatch(refresh, /--retry|--location|\b(?:for|while)\b/);
  const syntax = spawnSync('bash', ['-n'], { input:refresh, encoding:'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  assert.equal(120 + 420 + 30 + 30, 600);
});

test('completed with cleared lease passes', () => {
  const result = runFixture({ http:200, body:{ state:completed } });
  assert.equal(result.status, 0, result.stderr);
});

const incident = { skipped:'already-running', state:{ ...completed, status:'skipped',
  pagesScanned:0, recordsObserved:0, newCount:0, updatedCount:0, completedAt:null,
  startedAt:'2026-09-07T14:22:44.647Z', updatedAt:'2026-09-07T14:22:44.582Z',
  leaseOwnerId:'fa607f7e-7b5d-40ac-8d04-465dfc9aad5d', leaseMode:'recent',
  leaseExpiresAt:'2026-09-07T14:37:44.582Z' } };
const failures = [
  ['exact incident already-running', { http:202, body:incident }],
  ['backfill-active', { http:202, body:{ skipped:'backfill-active', state:{ ...completed, status:'skipped' } } }],
  ...['skipped', 'failed', 'partial', 'running', 'idle'].map(status => [status, { http:200, body:{ state:{ ...completed, status } } }]),
  ['malformed JSON', { http:200, body:'{broken' }],
  ['missing state', { http:200, body:{} }],
  ['HTTP 500 even with completed', { http:500, body:{ state:completed } }],
  ['HTTP 202 even with completed', { http:202, body:{ state:completed } }],
  ['redirect', { http:307, body:{ state:completed } }],
  ['transport timeout', { http:0, transportExit:28 }],
  ['timeout even if body looks completed', { http:200, transportExit:28, body:{ state:completed } }],
  ['wrong source', { http:200, body:{ state:{ ...completed, source:'RAPNA' } } }],
  ['wrong mode', { http:200, body:{ state:{ ...completed, mode:'backfill' } } }],
  ['non-null error', { http:200, body:{ state:{ ...completed, lastError:'' } } }],
  ...['leaseOwnerId', 'leaseMode', 'leaseExpiresAt', 'lastError'].map(key => [
    `missing ${key}`, { http:200, body:{ state:Object.fromEntries(Object.entries(completed).filter(([k]) => k !== key)) } },
  ]),
  ...['leaseOwnerId', 'leaseMode', 'leaseExpiresAt'].map(key => [
    `uncleared ${key}`, { http:200, body:{ state:{ ...completed, [key]:'uncleared' } } },
  ]),
  ['missing started', { http:200, body:{ state:{ ...completed, startedAt:null } } }],
  ['invalid completion', { http:200, body:{ state:{ ...completed, completedAt:'nonsense' } } }],
  ['reversed completion', { http:200, body:{ state:{ ...completed, completedAt:'2026-09-06T00:00:00Z' } } }],
  ['contradictory skipped metadata', { http:200, body:{ state:completed, skipped:'already-running' } }],
  ['diagnostic timeout cannot rescue timeout', { http:0, transportExit:28, diagnosticExit:28 }],
  ['diagnostic completed cannot rescue timeout', { http:0, transportExit:28, observe:{ recent:completed, lease:null } }],
  ['diagnostic malformed cannot rescue partial', { http:200, body:{ state:{ ...completed, status:'partial' } }, observe:'broken' }],
];
for (const [name, fixture] of failures) test(`${name} fails with one POST and read-only diagnostic`, () => {
  const result = runFixture(fixture);
  assert.notEqual(result.status, 0, result.stdout);
  if (fixture.transportExit) assert.equal(result.status, fixture.transportExit);
});

// Optional external evidence joins actual runtime outputs to this exact shell;
// ordinary upstream tests require neither the runtime repo nor its dependencies.
if (process.env.WORK19G_AN_RUNTIME_FIXTURES) {
  const fixtures = JSON.parse(readFileSync(process.env.WORK19G_AN_RUNTIME_FIXTURES, 'utf8'));
  assert.deepEqual(fixtures.map(f => f.scenario).sort(), ['A', 'B', 'C', 'D']);
  for (const fixture of fixtures) test(`cross-repo ${fixture.scenario}: runtime output through workflow`, () => {
    const result = runFixture({ ...fixture, body:{ state:fixture.state, skipped:fixture.skipped } });
    assert.equal(result.status === 0, ['A', 'D'].includes(fixture.scenario), result.stderr);
  });
}
