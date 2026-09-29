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


## Stage 1 production evidence

Three consecutive active canaries on the same persisted OECD v2 cycle passed the
single-unit contract without scheduler retirement:

- cursor 1970 -> 1971, recordsObserved +7, persisted/new/updated 0/0/0;
- cursor 1971 -> 1972, recordsObserved +0, persisted/new/updated 0/0/0;
- cursor 1972 -> 1973, recordsObserved +0, persisted/new/updated 0/0/0.

All three retained the same planVersion/startedAt/totalUnits, released the lease,
reported zero page/detail errors and preserved the prior completed certificate
byte-for-byte while the current cycle remained partial. Each observed the legacy
OECD scheduler idle at both mutation guards.

Stage 1 batch-level parity is therefore PASS. This still does not prove cadence,
full-cycle or scheduler-replacement parity and does not authorize F4D.

## Stage 2 bounded cycle window

Stage 2 adds a separate manual-only workflow:
`revision-control-cycle.yml`.

It remains OECD-continuation-only and cannot start a new cycle. It shares the
same concurrency group as Stage 1, so both control workflows cannot overlap.

The production contract is fixed in code, not user-configurable:

- maximum 2 persisted OECD units per wake-up;
- `batchSize=1` per unit;
- maximum 10-minute POST budget per unit;
- maximum 20-minute whole-window budget;
- the initial live evidence must retain more than 20 minutes of recent freshness;
- recent/lease/semantic/cycle gates are re-evaluated inside every unit;
- active/queued legacy OECD work is checked by each unit before mutation;
- no mutation retry;
- ambiguous or unavailable unit outcome stops the window fail-closed;
- cursor continuity is checked between units;
- any changed historical record still requires the existing integrity-review gate;
- a completed two-unit window reports `PASS_TWO_UNIT_WINDOW`.

The window additionally bounds network requests against a whole-window deadline.
A blocked first unit is NOT_EXECUTED. A failure after any successful mutation is
HOLD and no further unit is submitted.

Stage 2 remains manual and additive. It introduces no schedule and changes no
legacy scheduler. Even `PASS_TWO_UNIT_WINDOW` does not authorize F4D; it is
evidence that one common wake-up can safely sustain more than one persisted
revision unit before any cadence replacement is considered.
