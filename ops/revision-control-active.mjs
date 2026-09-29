import { runRevisionShadow } from "../scripts/revision-control.mjs";

// F4C stage 1: manual wake-up, OECD continuation only, no new cycles or retries.
const SOURCE = "OECD", MODE = "historical-reconcile", BATCH_SIZE = 1;
const POST_BUDGET_MS = 20 * 60_000;
const metrics = ["recordsObserved", "recordsPersisted", "newCount", "updatedCount", "pageErrors", "detailFailures"];
const assert = (ok, reason) => { if (!ok) throw new Error(reason); };
const sourceRecord = (plan) => [...plan.candidates, ...plan.blocked, ...plan.idle].find((r) => r.source === SOURCE);
const component = (r) => r?.components?.find((c) => c.mode === MODE);

export function stagedBlocker(plan, now) {
  const r = sourceRecord(plan);
  if (!r) return "missing-stage-source";
  if (r.blockedReason) return r.blockedReason;
  const evidenceAge = now - Date.parse(r.observedAt);
  if (!Number.isFinite(evidenceAge) || evidenceAge < 0 || evidenceAge > 5 * 60_000) return "live-observation-expired";
  if (!plan.selected) return "idle";
  if (plan.selected.source !== SOURCE || plan.selected.nextMode !== MODE) return "stage-source-not-enabled";
  const c = component(r);
  if (!c?.revisionInProgress || !c.canContinue) return "stage-new-cycle-not-enabled";
  if (!c.state.planVersion?.startsWith("oecd-historical-reconcile-v2:")) return "stage-plan-not-supported";
  // Reserve enough recent freshness for the entire bounded request budget.
  const remaining = r.policy.recent.freshMaxAgeMinutes * 60_000 - (now - Date.parse(r.recent.lastSuccessAt));
  if (!Number.isFinite(remaining) || remaining <= POST_BUDGET_MS) return "recent-budget-priority";
  return null;
}

function fingerprint(r) {
  const c = component(r);
  return JSON.stringify([c.state, c.certification, r.recent.state]);
}

export async function runBoundedRevisionWake({ base, token, active = false, fetchImpl = fetch,
  clock = Date.now, legacyGuard = async () => { throw Error("legacy-guard-required"); } } = {}) {
  const initial = await runRevisionShadow({ base, token, fetchImpl, clock });
  const report = { stage:"F4C-1-OECD-continuation", activeRequested:active, zeroWrite:true,
    mutatingRequests:0, maxMutatingRequests:1, batchSize:BATCH_SIZE, selected:initial.plan.selected,
    initial, before:null, response:null, after:null, delta:null, parity:"NOT_EXECUTED", blockedReason:null,
    legacyComparison:{ workflow:"oecd-historical-reconcile.yml", lane:MODE, batchSize:2,
      basis:"existing-workflow-contract", observedBusy:null },
    schedulerChanges:[], retirementAuthorized:false };
  report.blockedReason = stagedBlocker(initial.plan, clock());
  if (report.blockedReason || !active) return report;
  try { report.legacyComparison.observedBusy = await legacyGuard(); }
  catch { report.blockedReason = "legacy-activity-unavailable"; return report; }
  if (report.legacyComparison.observedBusy !== false) {
    report.blockedReason = "legacy-scheduler-active"; return report;
  }
  // Re-read all control inputs immediately before a possible mutation.
  const fresh = await runRevisionShadow({ base, token, fetchImpl, clock });
  report.before = sourceRecord(fresh.plan);
  report.blockedReason = stagedBlocker(fresh.plan, clock());
  if (report.blockedReason) return report;
  if (fingerprint(sourceRecord(initial.plan)) !== fingerprint(report.before)) {
    report.blockedReason = "control-evidence-changed"; return report;
  }
  try { report.legacyComparison.observedBusy = await legacyGuard(); }
  catch { report.blockedReason = "legacy-activity-unavailable"; return report; }
  if (report.legacyComparison.observedBusy !== false) {
    report.blockedReason = "legacy-scheduler-active"; return report;
  }
  // Account for time spent observing diagnostics and scheduler activity.
  report.blockedReason = stagedBlocker(fresh.plan, clock());
  if (report.blockedReason) return report;
  const requestedAt = new Date(clock()).toISOString();
  report.zeroWrite = false; // A submitted request may write even if its response is lost.
  report.mutatingRequests = 1;
  let response, body;
  try {
    response = await fetchImpl(new URL("/api/oecd/sync?mode=historical-reconcile&batchSize=1", base), {
      method:"POST", headers:{ Authorization:`Bearer ${token}` }, redirect:"error", cache:"no-store",
      signal:AbortSignal.timeout(POST_BUDGET_MS),
    });
    body = JSON.parse(await response.text());
  } catch {
    report.blockedReason = "mutation-outcome-unknown-no-retry"; report.parity = "HOLD"; return report;
  }
  report.response = { requestedAt, status:response.status, state:body?.state ?? null,
    certification:body?.revisionCertification ?? null };
  // Re-observe without retries or further POSTs even on an ambiguous failure.
  try {
    const after = await runRevisionShadow({ base, token, fetchImpl, clock });
    report.after = sourceRecord(after.plan);
  } catch {
    report.blockedReason = "post-observation-unavailable-no-retry"; report.parity = "HOLD"; return report;
  }
  if (response.status === 202 && body?.state?.status === "skipped") {
    report.blockedReason = "adapter-lease-or-state-skip"; report.parity = "NOT_EXECUTED"; return report;
  }
  try {
    const before = component(report.before), current = body?.state, observed = component(report.after);
    assert(response.status === 200 && current?.source === SOURCE && current.mode === MODE &&
      ["partial", "completed"].includes(current.status) && current.lastError === null, "adapter-response-failed");
    assert(current.planVersion === before.state.planVersion && current.startedAt === before.cycleStartedAt &&
      current.totalUnits === before.totalUnits && current.cursor === before.cursor + BATCH_SIZE,
      "cursor-or-cycle-parity-failed");
    assert(current.leaseOwnerId === null && current.leaseMode === null && current.leaseExpiresAt === null,
      "adapter-lease-not-released");
    assert(Date.parse(current.lastSuccessAt) >= Date.parse(requestedAt), "adapter-success-timestamp-invalid");
    const delta = Object.fromEntries(metrics.map((key) => [key, current[key] - before.state[key]]));
    assert(Object.values(delta).every((x) => Number.isSafeInteger(x) && x >= 0), "counter-regression");
    report.delta = delta;
    assert(delta.recordsPersisted === delta.newCount + delta.updatedCount, "persistence-counter-mismatch");
    assert(delta.pageErrors === 0 && delta.detailFailures === 0, "batch-errors");
    assert(report.after?.recentReady && !report.after.leaseActive && !report.after.structuralError,
      "post-observation-not-ready");
    assert(JSON.stringify(observed?.state) === JSON.stringify(current), "post-observation-changed");
    assert(JSON.stringify(observed?.certification) === JSON.stringify(body.revisionCertification), "certification-divergence");
    if (current.status === "partial") assert(JSON.stringify(before.certification) === JSON.stringify(body.revisionCertification), "partial-certification-changed");
    else assert(observed?.certificationValid, "completed-certification-invalid");
    // Zero-change gives a precise false-version check for this first canary.
    // Real updates require further integrity evidence before active parity PASS.
    assert(delta.recordsPersisted === 0, "changed-records-require-integrity-review");
    report.parity = "PASS_SINGLE_BATCH_ONLY";
  } catch (error) { report.blockedReason = error.message; report.parity = "HOLD"; }
  return report;
}

export async function legacyWorkflowBusy({ fetchImpl = fetch, githubToken } = {}) {
  assert(githubToken, "legacy-activity-auth-required");
  // Query unfinished states directly; do not miss an old running job by listing
  // only the most recent scheduled wake-ups. Never cancel a legacy job.
  for (const status of ["in_progress", "queued", "waiting", "pending", "requested"]) {
    const response = await fetchImpl("https://api.github.com/repos/cgam-coder/vigia-aesan-feed/actions/workflows/oecd-historical-reconcile.yml/runs?status=" + status + "&per_page=1", {
      method:"GET", headers:{ Authorization:`Bearer ${githubToken}`, Accept:"application/vnd.github+json" },
      redirect:"error", signal:AbortSignal.timeout(30_000),
    });
    assert(response.status === 200, "legacy-activity-read-failed");
    const body = JSON.parse(await response.text());
    assert(Number.isSafeInteger(body.total_count) && body.total_count >= 0, "legacy-activity-invalid");
    if (body.total_count > 0) return true;
  }
  return false;
}

async function main() {
  const mode = process.argv[2] ?? "shadow";
  assert(["shadow", "active"].includes(mode), "unsupported-stage-mode");
  const report = await runBoundedRevisionWake({ base:process.env.VIGIA_BASE_URL,
    token:process.env.VIGIA_SYNC_TOKEN, active:mode === "active",
    legacyGuard:() => legacyWorkflowBusy({ githubToken:process.env.GITHUB_TOKEN }) });
  console.log("REVISION_CONTROL_BOUNDED " + JSON.stringify(report));
  if (report.parity === "HOLD") process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
