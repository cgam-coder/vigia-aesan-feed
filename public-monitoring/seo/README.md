# NagameAlert public SEO monitoring

This package checks publicly accessible HTTP pages, robots, sitemaps, canonical/hreflang links, structured data, source hubs and eight homepage/campaign URL contracts. It does not ingest alerts, repair records, identify a deployed commit or measure Google indexing.

The daily audit is scheduled at 06:17 UTC, with manual execution and path-scoped PR/main checks. It uses standard Ubuntu runners, Node built-ins only, no package install or dependency cache, read-only repository permissions and no production secrets. Only this package and workflow definitions are checked out. Public HTML and reports are retained for seven days; they are deliberately public evidence, not private server logs.

Run the offline tests from this directory with:

```sh
node --test tests/seo-home-contracts.test.mjs tests/seo-workflow-wiring.test.mjs
```

`manifest.json` identifies the reviewed HTTP-contract files by Git blob hash. Update the manifest and the private integration reference together when intentionally changing those contracts. This guards accidental drift; it is not a replacement for reviewing workflow changes or securing repository access.

The package is outside root `scripts/` and `test/`: changes must not trigger AESAN full-history publication or extraordinary source recovery. Existing source schedules, controller code, credentials and the feed artifact are outside this package.

GitHub may delay scheduled jobs and may disable public schedules after 60 days without repository activity. Check the latest successful daily run in Actions; absence of execution is not a successful audit. Do not manufacture commits to keep a schedule alive. Re-enable through authorized account controls when needed. A schedule configured in YAML is not proof that a future run has occurred.

Standard public runners do not consume the private minute allowance. This does not certify provider-wide zero cost, unlimited storage, hosting/database quotas or indefinite availability. No billing changes are made by this package.

Migration procedure: retain the previous scheduled auditor until this public workflow has passed on its integrated revision, then remove only the duplicate private schedule. Keep private PR/manual checks and private application tests. If public monitoring breaks, repair it or restore the previous private daily schedule through a reviewed change; never erase or ignore a failed audit.
