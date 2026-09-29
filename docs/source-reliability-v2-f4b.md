# F4B — live independent control evidence

Depends on runtime's authenticated `GET /api/freshness?observe=1&policy=1`
(`policyVersion:1`), derived directly from `SOURCE_RELIABILITY_POLICIES`.
The policy request never opens D1 or reads the persisted watchdog snapshot.
Do not merge this consumer before that runtime contract is deployed and verified.

The shadow reads AESAN, RAPNA, RASFF and OECD `observe=1` independently.
It stamps each successful response with a local `observedAt` after receipt,
and rejects observations older than five minutes or from the future.
An individual read failure blocks only that source; an invalid policy blocks all.
There is no dependency on `freshness.checkedAt`, stored aggregate status, or
watchdog recency. The decision proves readiness from live persisted adapter
state, not a new comparison against the official upstream index.

Each source exposes `recentReady`, `revisionRequired`, `revisionMode`,
`revisionReady`, `revisionInProgress`, `certificationValid`, `leaseActive`,
`actionable`, and `blockedReason`, plus the states, certificates and lease
used to compute them. `revisionReady` means no control blocker; `actionable`
also requires historical work to be due or a valid persisted cycle to continue.
`certificationValid` includes both structural checks and freshness within the
runtime SLA. Optional certification may use a complete terminal state only
when no certificate is present. A present invalid certificate is never bypassed.

RAPNA keeps separate CURRENT and LEGACY component evidence and chooses a
persisted cycle before a new cycle. A CURRENT partial plan from a previous UTC
day is blocked: its existing adapter would otherwise reset on a date rollover.
RASFF completed cursor 0 is terminal. OECD and RAPNA required missing/invalid
certificates produce candidates, while semantic/cursor/state errors block.
Unrecognized persisted errors are conservatively blocked; no transient error
allowlist is introduced in this stage. AESAN remains an external full-archive
producer. Safety Gate is always `revision-not-required`; a policy attempting
to enable it is rejected while F2 remains HOLD.

Priority: active lease blocks; stale/failed recent blocks; structural revision
errors block; valid in-progress cycles precede missing/invalid certificates or
overdue cycles. Overdue ordering uses age beyond each runtime SLA.

All transport is explicit GET, no-cache, no redirects, authenticated at the
existing workflow step. The controller has no writer, POST, restart, schedule,
or cron-retirement capability. Existing update-feed path exclusions cover both
changed files. The existing push-to-main shadow is the production F4B gate;
do not run any candidate until F4B is certified.

Validation: targeted offline planner and workflow tests cover all 13 requested
F4B regressions plus per-source transport failure, malformed/future evidence,
RAPNA date rollover and authoritative runtime policy changes. Runtime tests
verify authentication, exact registry derivation, zero D1 access, no-store,
and compatibility of the pre-existing observation response.

Rollback: revert the feed consumer first, then the runtime policy view if
necessary. Legacy schedules remain available and unchanged throughout.
F4C and F4D are gated on production evidence, not on offline tests alone.
