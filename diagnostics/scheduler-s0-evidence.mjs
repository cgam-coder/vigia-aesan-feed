import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const endpoint = 'https://api.cloudflare.com/client/v4/accounts/9c1807c68493f14259248b5f5782cc6f/workers/observability/telemetry/query';
export const query = {
  queryId: 'vigia-s0-evidence-20260929', dry: true, view: 'events', limit: 200,
  timeframe: { from: Date.parse('2026-09-29T19:19:00Z'), to: Date.parse('2026-09-29T19:32:00Z') },
  parameters: { filterCombination: 'and', filters: [
    { key: '$metadata.service', operation: 'eq', type: 'string', value: 'vigia-runtime' },
  ], needle: { value: 'recent-scheduler', isRegex: false, matchCase: true } },
};
const fields = new Set(('component schemaVersion stage triggerProvider scheduledTime cron zeroWrite requestExecuted mutationAttempts evidenceBasis officialFreshnessCertified kind source recentAgeMinutes recentReady activeLease leaseMode leaseExpiresAt lastSuccessAt requiredAction blockedReason error observedAt durationMs outcome sourcesObserved readErrors').split(' '));
function pick(object, keys) {
  return Object.fromEntries(Object.entries(object ?? {}).filter(([key,value]) => keys.has(key) &&
    (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) || (typeof value === 'string' && value.length <= 200))));
}
export function extract(event) {
  const found = [];
  function visit(value, depth = 0) {
    if (depth > 10) return;
    if (typeof value === 'string' && value.startsWith('{')) {
      try { visit(JSON.parse(value), depth + 1); } catch { /* not a JSON log */ }
    } else if (value && typeof value === 'object') {
      if (value.component === 'recent-scheduler' && value.stage === 'S0' && ['source','wake-up'].includes(value.kind)) found.push(pick(value, fields));
      else for (const child of Object.values(value)) visit(child, depth + 1);
    }
  }
  visit(event);
  const metadata = pick(event.$metadata, new Set(['id','service','origin','trigger','requestId','spanId','traceId','timestamp','type']));
  const workers = pick(event.$workers ?? event.source?.$workers, new Set(['scriptName','requestId','eventType','outcome','cpuTimeMs','wallTimeMs']));
  const workerEvent = pick((event.$workers ?? event.source?.$workers)?.event, new Set(['cron','scheduledTime']));
  return found.map(record => ({ record, metadata, workers, workerEvent, timestamp: event.timestamp ?? null }));
}
export async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  let report = { status: 'HOLD', operation: 'cloudflare-observability-dry-query', query, events: [] };
  if (!token) report.reason = 'credential-not-configured';
  else {
    try {
      const response = await fetch(endpoint, { method: 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(query), signal: AbortSignal.timeout(45000) });
      report.httpStatus = response.status;
      if (!response.ok) report.reason = [401,403].includes(response.status) ? 'credential-not-authorized' : 'query-rejected';
      else {
        const body = await response.json();
        if (body.success === false || body.errors?.length) report.reason = 'query-api-error';
        else {
          const events = body.result?.events?.events ?? [];
          report.events = events.flatMap(extract);
          report.returnedEventCount = events.length;
          report.matchingEventCount = body.result?.events?.count ?? null;
          report.queryStatus = body.result?.run?.status ?? null;
          report.status = report.events.length ? 'EVIDENCE_RETRIEVED' : 'HOLD';
          if (!report.events.length) report.reason = 'no-scheduler-events';
        }
      }
    } catch { report.reason = 'bounded-query-failed'; }
  }
  // Never output raw API bodies, arbitrary logs, headers or credentials.
  let output = JSON.stringify(report, null, 2);
  if (token && output.includes(token)) output = JSON.stringify({ status: 'HOLD', reason: 'output-secret-guard' });
  await writeFile('scheduler-s0-evidence.json', output + '\n');
  console.log(output);
  if (report.status !== 'EVIDENCE_RETRIEVED') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
