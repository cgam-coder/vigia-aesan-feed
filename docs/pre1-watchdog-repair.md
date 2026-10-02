# PRE1 — watchdog client and Safety Gate preflight repair

Candidate only. Production publication is HOLD pending current Worker, D1,
rollback and applicable authorization. Based on feed/main
`11ee70b4060867217420b6e336d2f700a7b07d0f`; runtime stays
`31c896fdd4d64878f4d66d2cc1084a8bb36ebdbd`.

## Behavior

The watchdog first reads runtime policy v1 and persisted freshness using GET.
Persisted labels are historical evidence, not current official parity. Five
independent source GETs come before any POST; a failed first read does not
suppress the four later observations. It then attempts eligible official audits
separately, using POST audit=1&recover=0. These audit requests persist freshness
evidence: they are explicitly NOT zero-write. An uncertain POST result stops
later POSTs and triggers GET-only reconciliation; unperformed audits stay
UNKNOWN even when their operational reads succeeded. A 401/403 blocks subsequent
authenticated actions. Redirects
fail closed. Error text, tokens and arbitrary response bodies are not logged.

Recovery starts only after five valid audit responses. A revision-only HOLD
does not trigger recent ingestion. At most one recover=1 POST is dispatched per
job, selected from eligible recent/parity failures in a rotating source order.
Before it, GET observe=1 must confirm source identity, no lease and no running
backfill. The server remains responsible for atomic lease/fencing and exclusion;
the read is not an atomic substitute. Afterward a read-only GET reconciles lease
release and recent state. An uncertain recovery response stays UNKNOWN even if
the subsequent observation looks completed. There is no client mutation retry.
Existing server-internal recovery behavior is unchanged; this client bound is
one HTTP request, not one internal batch or one server-side attempt.

Runtime policy supplies source SLAs and revision scopes. The client does not
create certificates or certify a Safety Gate archive from recent-index parity.
RAPNA/OECD certification validity remains the runtime evaluator's responsibility.
The final report rechecks ages after recovery; earlier PASS labels cannot mask
expired observations. Strict clock validation may produce HOLD if clocks differ.

## Budget and tradeoff

- Global client deadline: 32 minutes inside the existing 35-minute job.
- Two initial GETs: at most 30 seconds each.
- Five independent source GETs: at most 30 seconds each.
- Five audit-only POSTs: at most 90 seconds each.
- One recovery POST: at most 20 minutes.
- Before/after GETs: at most 30 seconds each.
- Each request is also constrained by remaining global budget, with a 30-second
  reconciliation reserve. Recovery is omitted unless the full remaining budget
  fits. Omission is not a successful recovery; unresolved sources stay HOLD.

The 32-minute envelope bounds the client, not remote work after client abort.
One recovery request can leave several sources awaiting ordinary work or a
future naturally scheduled job. No new workflow/dispatch/retry is introduced.
An audit-only timeout can still leave an evidence-state write pending remotely;
no repeated audit or later POST is sent and recovery is suppressed for the job.

The Safety Gate preflight retains every existing smoke, authentication,
read-only and mutating-GET rejection check. It logs phase/source/start/end/status
without secrets and has a 110-second combined network budget within the existing
120-second step. Later checks fail closed if prior calls consume that budget.
Its cross-source coupling remains deliberate pending real phase evidence.

## Silence and remaining gates

`assessSilence` evaluates an independently supplied list of scheduled completions.
It distinguishes observed invocation from certified official freshness, rejects
invalid/future clocks and never authorizes recovery. It is a tested evaluator,
NOT a deployed independent observer. No new observer/cron/activation has been
wired. A monitor sharing GitHub scheduling cannot prove absence of GitHub-wide
silence; production Cloudflare S0 telemetry must be reread before choosing that
repair. S0 remains zero-write and is not the full watchdog.

Before merge, note that changing either workflow (or the watchdog script path)
on main immediately triggers existing production jobs. Offline branch CI is safe;
merge/push to main is a production activation and stays HOLD. No cron retirement,
Safety Gate delta, OECD S3, historical scheduling, iOS or UI #185 change is included.
F4C cycle/cadence certification and terminal #183 archive certification remain open.

## Validation

Run `npm test` without production credentials. New tests exercise source failure
isolation, auth rejection, stale/invalid clocks, policy versions, global budget,
one recovery POST, uncertain outcomes, leases/backfill, before/after observations,
revision-only HOLD, preflight phase diagnostics and every existing preflight
control. The ten original CP0 baseline scenarios/results are retained unchanged.

Real natural-cycle validation has not run for this candidate. Do not equate
offline tests or Actions CI with a production continuity PASS.
