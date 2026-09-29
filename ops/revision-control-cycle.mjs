import { runRevisionShadow } from "../scripts/revision-control.mjs";
import { runBoundedRevisionWake, legacyWorkflowBusy } from "./revision-control-active.mjs";

// F4C stage 2: manual two-unit OECD continuation window.
// Still no new cycles, retries, schedules or scheduler retirement.
const SOURCE = "OECD", MODE = "historical-reconcile";
const MAX_UNITS = 2;
const UNIT_BUDGET_MS = 10 * 60_000;
const WINDOW_BUDGET_MS = 20 * 60_000;
const assert = (ok, reason) => { if (!ok) throw new Error(reason); };
const sourceRecord = (plan) => [...plan.candidates, ...plan.blocked, ...plan.idle].find((r) => r.source === SOURCE);
const component = (r) => r?.components?.find((c) => c.mode === MODE);

export function cycleWindowBlocker(plan, now, windowBudgetMs = WINDOW_BUDGET_MS) {
  const r = sourceRecord(plan);
  if (!r) return "missing-cycle-source";
  if (r.blockedReason) return r.blockedReason;
  const evidenceAge = now - Date.parse(r.observedAt);
  if (!Number.isFinite(evidenceAge) || evidenceAge < 0 || evidenceAge > 5 * 60_000) return "live-observation-expired";
  if (!plan.selected) return "idle";
  if (plan.selected.source !== SOURCE || plan.selected.nextMode !== MODE) return "cycle-source-not-enabled";
  const c = component(r);
  if (!c?.revisionInProgress || !c.canContinue) return "cycle-new-cycle-not-enabled";
  if (!c.state.planVersion?.startsWith("oecd-historical-reconcile-v2:")) return "cycle-plan-not-supported";
  const remaining = r.policy.recent.freshMaxAgeMinutes * 60_000 - (now - Date.parse(r.recent.lastSuccessAt));
  if (!Number.isFinite(remaining) || remaining <= windowBudgetMs) return "recent-cycle-budget-priority";
  return null;
}

export async function runCycleParityWake({
  base,
  token,
  active = false,
  fetchImpl = fetch,
  clock = Date.now,
  shadow = runRevisionShadow,
  runUnit = runBoundedRevisionWake,
  legacyGuard = async () => { throw Error("legacy-guard-required"); },
  maxUnits = MAX_UNITS,
  unitBudgetMs = UNIT_BUDGET_MS,
  windowBudgetMs = WINDOW_BUDGET_MS,
} = {}) {
  assert(Number.isInteger(maxUnits) && maxUnits >= 1 && maxUnits <= MAX_UNITS, "invalid-cycle-max-units");
  assert(Number.isFinite(unitBudgetMs) && unitBudgetMs > 0 && unitBudgetMs <= UNIT_BUDGET_MS, "invalid-cycle-unit-budget");
  assert(Number.isFinite(windowBudgetMs) && windowBudgetMs > 0 && windowBudgetMs <= WINDOW_BUDGET_MS,
    "invalid-cycle-window-budget");

  const startedAtMs = clock();
  const deadline = startedAtMs + windowBudgetMs;
  const boundedFetch = async (url, options = {}) => {
    const remaining = deadline - clock();
    if (!Number.isFinite(remaining) || remaining <= 0) throw new Error("cycle-window-expired");
    const deadlineSignal = AbortSignal.timeout(Math.max(1, remaining));
    const signal = options.signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([options.signal, deadlineSignal])
      : deadlineSignal;
    return fetchImpl(url, { ...options, signal });
  };

  let initial;
  try {
    initial = await shadow({ base, token, fetchImpl:boundedFetch, clock });
  } catch {
    return {
      stage:"F4C-2-OECD-cycle-window", activeRequested:active, zeroWrite:true,
      mutatingRequests:0, maxMutatingRequests:maxUnits, maxUnits, unitBudgetMs, windowBudgetMs,
      windowStartedAt:new Date(startedAtMs).toISOString(), windowDeadlineAt:new Date(deadline).toISOString(),
      initial:null, units:[], parity:"HOLD", blockedReason:"initial-observation-unavailable",
      schedulerChanges:[], retirementAuthorized:false,
    };
  }

  const report = {
    stage:"F4C-2-OECD-cycle-window",
    activeRequested:active,
    zeroWrite:true,
    mutatingRequests:0,
    maxMutatingRequests:maxUnits,
    maxUnits,
    unitBudgetMs,
    windowBudgetMs,
    windowStartedAt:new Date(startedAtMs).toISOString(),
    windowDeadlineAt:new Date(deadline).toISOString(),
    selected:initial.plan.selected,
    initial,
    units:[],
    cursorStart:component(sourceRecord(initial.plan))?.cursor ?? null,
    cursorEnd:null,
    parity:"NOT_EXECUTED",
    blockedReason:null,
    schedulerChanges:[],
    retirementAuthorized:false,
  };

  report.blockedReason = cycleWindowBlocker(initial.plan, clock(), windowBudgetMs);
  if (report.blockedReason || !active) return report;

  let expectedCursor = report.cursorStart;
  for (let index = 0; index < maxUnits; index += 1) {
    const remaining = deadline - clock();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      report.blockedReason = "cycle-window-expired";
      report.parity = report.units.length ? "HOLD" : "NOT_EXECUTED";
      return report;
    }
    const budget = Math.min(unitBudgetMs, remaining);
    let unit;
    try {
      unit = await runUnit({
        base, token, active:true, fetchImpl:boundedFetch, clock,
        postBudgetMs:budget, legacyGuard,
      });
    } catch {
      report.blockedReason = "unit-execution-unavailable-no-retry";
      report.parity = report.units.length ? "HOLD" : "NOT_EXECUTED";
      return report;
    }
    report.units.push(unit);
    report.mutatingRequests += unit.mutatingRequests ?? 0;
    if (unit.zeroWrite === false) report.zeroWrite = false;

    if (unit.parity !== "PASS_SINGLE_BATCH_ONLY") {
      report.blockedReason = unit.blockedReason ?? `unit-${index + 1}-not-pass`;
      report.parity = index === 0 && unit.parity === "NOT_EXECUTED" ? "NOT_EXECUTED" : "HOLD";
      return report;
    }

    const beforeCursor = component(unit.before)?.cursor;
    const afterCursor = component(unit.after)?.cursor;
    if (!Number.isSafeInteger(expectedCursor) || beforeCursor !== expectedCursor || afterCursor !== expectedCursor + 1) {
      report.blockedReason = "cycle-cursor-discontinuity";
      report.parity = "HOLD";
      return report;
    }
    expectedCursor = afterCursor;
    report.cursorEnd = afterCursor;

    if (clock() > deadline) {
      report.blockedReason = "cycle-window-expired-after-unit";
      report.parity = "HOLD";
      return report;
    }
  }

  if (report.units.length !== maxUnits || report.mutatingRequests !== maxUnits) {
    report.blockedReason = "cycle-unit-count-mismatch";
    report.parity = "HOLD";
    return report;
  }
  report.parity = "PASS_TWO_UNIT_WINDOW";
  return report;
}

async function main() {
  const mode = process.argv[2] ?? "shadow";
  assert(["shadow", "active"].includes(mode), "unsupported-cycle-mode");
  const report = await runCycleParityWake({
    base:process.env.VIGIA_BASE_URL,
    token:process.env.VIGIA_SYNC_TOKEN,
    active:mode === "active",
    legacyGuard:() => legacyWorkflowBusy({ githubToken:process.env.GITHUB_TOKEN }),
  });
  console.log("REVISION_CONTROL_CYCLE " + JSON.stringify(report));
  if (report.parity === "HOLD") process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
