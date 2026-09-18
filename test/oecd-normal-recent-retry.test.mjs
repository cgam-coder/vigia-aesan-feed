import assert from 'node:assert/strict';
import test from 'node:test';
import { limits, runNormalRecent } from '../scripts/oecd-normal-recent-retry.mjs';
const completed = { status:'completed', pageErrors:0, detailFailures:0, lastError:null,
  leaseOwnerId:null, leaseMode:null, leaseExpiresAt:null };
const ok = () => new Response(JSON.stringify({ state:completed }), { status:200 });
const fixture = (responses) => {
  const calls = [], waits = [], logs = [];
  return { calls, waits, logs, run:() => runNormalRecent({
    url:'https://example.test/api/oecd/sync', token:'private-test-token',
    log:(value) => logs.push(value), sleep:async (ms) => { waits.push(ms); },
    fetchImpl:async (url, options) => {
      calls.push({ url, options });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      assert.ok(response, 'Unexpected extra request');
      return response;
    },
  }) };
};
test('normal OECD retries a held lease and preserves authorization', async () => {
  const f = fixture([new Response('{"skipped":"sync_lock"}', { status:202 }), ok()]);
  assert.deepEqual(await f.run(), completed);
  assert.equal(f.calls.length, 2); assert.deepEqual(f.waits, [20_000]);
  assert.equal(f.calls[0].options.headers.Authorization, 'Bearer private-test-token');
  assert.equal(f.calls[0].options.method, 'POST'); assert.equal(f.calls[0].options.redirect, 'error');
  assert.equal(new URL(f.calls[0].url).searchParams.get('mode'), 'recent');
  assert.ok(!JSON.stringify(f.logs).includes('private-test-token'));
});
test('normal OECD retries transport errors, 503 non-JSON and rate limits', async () => {
  const f = fixture([new TypeError('network'), new Response('temporary upstream failure', { status:503 }),
    new Response('{}', { status:429 }), ok()]);
  await f.run(); assert.equal(f.calls.length, 4); assert.equal(f.waits.length, 3);
});
for (const status of [400, 401, 403, 404, 409]) {
  test(`normal OECD stops on permanent HTTP ${status}`, async () => {
    const f = fixture([new Response('{}', { status })]);
    await assert.rejects(f.run(), /permanent HTTP/u); assert.equal(f.calls.length, 1); assert.equal(f.waits.length, 0);
  });
}
test('normal OECD retries only lock-related HTTP 409', async () => {
  const f = fixture([new Response('{"error":"SOURCE_BUSY"}', { status:409 }), ok()]);
  await f.run(); assert.equal(f.calls.length, 2);
});
for (const body of ['not JSON', '{}', JSON.stringify({ state:{ ...completed, status:'partial' } }),
  JSON.stringify({ state:{ ...completed, detailFailures:1 } }), JSON.stringify({ state:{ ...completed, leaseOwnerId:'other' } }),
  JSON.stringify({ state:completed, skipped:'sync_lock' })]) {
  test(`normal OECD does not accept invalid completion: ${body}`, async () => {
    const f = fixture([new Response(body, { status:200 })]);
    await assert.rejects(f.run(), /without clean completion/u); assert.equal(f.calls.length, 1);
  });
}
test('normal OECD exhausts the bounded budget with failure, never a skipped success', async () => {
  const f = fixture(Array.from({ length:4 }, () => new Response('{}', { status:202 })));
  await assert.rejects(f.run(), /exhausted 4/u); assert.equal(f.calls.length, 4); assert.equal(f.waits.length, 3);
  assert.equal(limits.attempts * limits.requestMs + (limits.attempts - 1) * limits.delayMs, 780_000);
});
test('normal OECD fails before I/O when credentials or HTTPS are missing', async () => {
  await assert.rejects(runNormalRecent(), /required/u);
  await assert.rejects(runNormalRecent({ url:'http://example.test', token:'x' }), /HTTPS/u);
});
