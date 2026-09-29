# F4C staged bounded orchestrator

Prerequisite F4B PASS: runtime PR165, feed PR76, production shadow36597928942.

Stage 1 is manual-only (`revision-control-active.yml`, default shadow). It uses
F4B's live contract to select the global candidate, then enables **only OECD
continuation of an existing v2 historical cycle**. Other source adapters and new
cycles remain staged out. AESAN stays external and Safety Gate stays excluded.
No schedules, restarts, cursor arguments, parser changes or runtime changes.

At most one POST, fixed `batchSize=1`, 20-minute request budget, no mutation
retry. The source must retain enough recent freshness for that budget. The
existing recent scheduler retains priority; this stage yields instead of
manually triggering recent ingestion. An active/queued legacy OECD workflow
blocks the canary even between its per-batch leases. The runtime source lease
still arbitrates an invocation starting after the final check. HTTP202 means
skip, never retry. Both states and certificates must remain unchanged across
preflight observations. Unknown mutation outcome is HOLD, with no retry.

Reports preserve before/response/after state, recent freshness, lease,
certificate, cursor and counter deltas. Existing OECD legacy selects the same
historical lane but uses batches of2; the canary uses1. Its run/queue status is
read without cancelling jobs. A single-batch parity result is **not** full-cycle,
SLA or scheduler-retirement certification. Persisted changes require further
integrity review; the initial canary only certifies zero-change parity. A blocked
or idle workflow may exit successfully but has parity NOT_EXECUTED, never PASS.

All legacy workflows and crons are retained. OECD12 wake-ups/hour remain.
F4C remains HOLD until real bounded execution and sufficient cycle/certificate
parity are observed. F4D is not authorized by a single batch. Rollback: stop
manual dispatches or revert this additive stage; existing schedulers never move.

The module/tests live under ops so control-only changes do not match AESAN's
scripts/** or test/** regeneration triggers. Existing production workflows are unchanged; offline CI adds ops/** to its path filters.
