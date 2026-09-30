# SOURCE-RELIABILITY-V2 / F4D — scheduler retirement matrix

Baseline: `vigia-aesan-feed/main@11ee70b4060867217420b6e336d2f700a7b07d0f`

Status: **planning only / zero operational change**.

This document classifies the current GitHub Actions scheduler surface so redundant
recent writers can be retired only after Cloudflare parity is certified. It does
not authorize disabling any workflow or cron.

## Invariants

- Recent ingestion keeps priority over historical work.
- At most one mutating source attempt per Cloudflare wake-up.
- No GitHub schedule is retired before equivalent Cloudflare behavior has live evidence.
- Historical coverage is never reduced to save Actions minutes.
- AESAN remains GitHub-dependent while its producer is the generated feed.
- Safety Gate remains fail-closed while F2A is HOLD.
- Rollback must restore the last certified scheduler mode and GitHub schedules.

## Retirement classification

| Workflow / lane | Current cadence | Role | F4D classification |
|---|---:|---|---|
| `rapna-sync.yml` recent | 23,53 * * * * | RAPNA recent writer | **Candidate after S1/S2/S3 parity closure**. Cloudflare RAPNA is already PASS/LIVE, but keep until F4D authorization. |
| `rapna-sync.yml` CURRENT + LEGACY | 41 4 * * * | historical/revision certification | **Keep** until common revision-control plane proves equivalent CURRENT + LEGACY coverage and certification. |
| `rasff-control.yml` recent | 9,39 * * * * | RASFF recent writer | **Candidate after S1/S2/S3 parity closure**. Cloudflare RASFF is already PASS/LIVE, but keep until F4D authorization. |
| `rasff-control.yml` reconcile | 17 * * * * | RASFF historical/revision lane | **Keep** until revision orchestrator parity is certified. |
| `oecd-recent-freshness-retry.yml` | 2,32 * * * * | OECD recent recovery writer | **Candidate only after S3 PASS/LIVE** and a post-activation evidence window. |
| `safety-gate-sync.yml` OECD lane | 22,52 * * * * | OECD recent writer + bounded gap recovery | **Candidate only after S3 PASS/LIVE**. Remove/split OECD lane without touching Safety Gate. |
| `oecd-historical-reconcile.yml` | 4,9,...,59 * * * * | OECD persistent historical reconcile | **Keep**. It is not equivalent to the Cloudflare recent scheduler; retire only after common revision-control continuation/yield/certification parity. |
| `safety-gate-sync.yml` Safety Gate lane | 7,37 * * * * | Safety Gate recent writer | **Keep / NOT AUTHORIZED** while Safety Gate F2A is HOLD. |
| `freshness-watchdog.yml` | 13,28,43,58 * * * * | five-source freshness audit + bounded recovery | **Keep for now**. It can recover/mutate and therefore requires explicit parity with scheduler observability/recovery before retirement. |
| `update-feed.yml` | 3,18,33,48 * * * * | AESAN feed producer + publish/ingest | **Keep**. Cloudflare does not replace the GitHub feed producer. |
| `update-full-feed.yml` | 27 3 * * * | AESAN full archive producer | **Keep**. Historical coverage must not be reduced. |
| `seo-public-watchdog.yml` | 17 6 * * * | public SEO monitor | **Out of scope / keep**. |
| `revision-control.yml` | manual/push only | common revision-control shadow | **Retain** as staging/diagnostic control plane. |
| `revision-control-active.yml` | manual only | bounded active revision stage | **Retain** until F4 closes. |
| `revision-control-cycle.yml` | manual only | bounded cycle parity stage | **Retain** until F4 closes. |

## Proposed retirement order

### Gate 1 — finish S3 OECD

No retirement is authorized until:

- S3 mode is deployed intentionally;
- an idle natural wake-up is observed;
- a real OECD due execution is observed;
- the one-writer budget remains intact;
- OECD source lease is released after mutation;
- no duplicate/false alert version is created;
- RAPNA and RASFF remain healthy.

### Gate 2 — recent-writer parity

After Gate 1, evaluate the three GitHub recent writer surfaces separately:

1. RAPNA recent in `rapna-sync.yml`;
2. RASFF recent in `rasff-control.yml`;
3. both OECD recent fallbacks (`oecd-recent-freshness-retry.yml` and the OECD lane in `safety-gate-sync.yml`).

For each source require evidence of:

- no missed recent SLA;
- same durable state/cursor semantics;
- no duplicate versions;
- no conflicting lease ownership;
- fail-closed behavior on ambiguous mutation;
- rollback path tested or preserved;
- historical lane unaffected.

Only the recent lane may be removed at this stage.

### Gate 3 — revision/historical consolidation

Historical schedules remain enabled until the common revision-control plane proves:

- bounded continuation from persisted cursor;
- recent-yield behavior;
- source-specific coverage scope preserved;
- complete certification produced under the common schema;
- recovery after interruption;
- no reduction in RAPNA LEGACY, RASFF reconcile, OECD historical or AESAN archive coverage.

Only then can historical cron fragmentation be reduced.

### Gate 4 — watchdog rationalization

`freshness-watchdog.yml` is the final scheduler-adjacent candidate because it is
both an observer and a bounded recovery path. Retire or simplify it only after
Cloudflare provides equivalent freshness detection, recovery gating and
operator-visible evidence for all eligible sources.

## Explicitly outside F4D retirement

- AESAN GitHub feed production.
- Safety Gate writer while F2A is HOLD.
- SEO monitoring.
- CI and manual certification workflows.

## Current authorization

**F4D: NOT AUTHORIZED.**

This matrix is preparatory evidence only. No workflow, cron, writer, D1 state or
production setting is changed by this work.
