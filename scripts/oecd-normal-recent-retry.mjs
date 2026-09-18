import { pathToFileURL } from 'node:url';

export const limits = Object.freeze({ attempts:4, requestMs:180_000, delayMs:20_000 });
const lockReason = /sync_lock|SOURCE_BUSY|CONCURRENT_LEASE|D1_WRITE_WINDOW|SQLITE_BUSY/i;

/** Retry only transient failures. A skipped/partial run is never completion. */
export async function runNormalRecent({ url, token, fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = (value) => console.log(JSON.stringify(value)),
} = {}) {
  if (!url || !token) throw new Error('OECD URL/token are required');
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:') throw new Error('OECD URL must use HTTPS');
  endpoint.searchParams.set('mode', 'recent');

  for (let attempt = 1; attempt <= limits.attempts; attempt++) {
    let response;
    let body;
    try {
      response = await fetchImpl(endpoint.href, {
        method:'POST', redirect:'error', headers:{ Authorization:`Bearer ${token}` },
        signal:AbortSignal.timeout(limits.requestMs),
      });
      // Consume the body inside the same timeout/error boundary as the request.
      const text = await response.text();
      try { body = JSON.parse(text); } catch { body = null; }
    } catch {
      log({ step:'oecd_recent', attempt, outcome:'transport_error' });
    }

    if (response && body !== undefined) {
      const state = body?.state;
      log({ step:'oecd_recent', attempt, http:response.status,
        state:typeof state?.status === 'string' ? state.status : null });
      const reason = [body?.skipped, body?.error, state?.lastSkipReason, state?.lastError]
        .filter((value) => typeof value === 'string').join(' ');
      const retryable = response.status === 202 || response.status === 429 ||
        (response.status >= 500 && response.status <= 599) ||
        (response.status === 409 && lockReason.test(reason));
      if (response.status === 200) {
        if (state?.status !== 'completed' || body?.skipped != null ||
            state?.pageErrors !== 0 || state?.detailFailures !== 0 || state?.lastError !== null ||
            state?.leaseOwnerId !== null || state?.leaseMode !== null || state?.leaseExpiresAt !== null) {
          throw new Error('OECD recent returned HTTP 200 without clean completion');
        }
        return state;
      }
      if (!retryable) throw new Error(`OECD recent permanent HTTP failure: ${response.status}`);
    }
    if (attempt < limits.attempts) await sleep(limits.delayMs);
  }
  throw new Error(`OECD recent exhausted ${limits.attempts} attempts without clean completion`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runNormalRecent({ url:process.env.VIGIA_OECD_SYNC_URL, token:process.env.VIGIA_SYNC_TOKEN })
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
