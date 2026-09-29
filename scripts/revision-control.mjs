const REQUIRED_SOURCES = Object.freeze(["AESAN", "RAPNA", "RASFF", "SAFETY GATE", "OECD"]);
const EXECUTABLE_SOURCES = new Set(["RAPNA", "RASFF", "OECD"]);
const SOURCE_ORDER = new Map(REQUIRED_SOURCES.map((source, index) => [source, index]));
const OBSERVE_PATHS = Object.freeze({
  AESAN:"/api/aesan/sync?observe=1",
  RAPNA:"/api/rapna/sync?observe=1",
  RASFF:"/api/rasff/sync?observe=1",
  OECD:"/api/oecd/sync?observe=1",
});
const EXPECTED_REVISION = Object.freeze({
  AESAN:{ required:true, mode:"historical-reconcile" },
  RAPNA:{ required:true, mode:"current-parity", components:["current-parity", "legacy-reconcile"] },
  RASFF:{ required:true, mode:"reconcile" },
  "SAFETY GATE":{ required:false, mode:null },
  OECD:{ required:true, mode:"historical-reconcile" },
});

const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const iso = (value) => typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
const finiteNonNegative = (value) => Number.isFinite(value) && value >= 0;
const sourceRank = (source) => SOURCE_ORDER.get(source) ?? Number.MAX_SAFE_INTEGER;

function assertRevisionContract(view) {
  const expected = EXPECTED_REVISION[view.source];
  const revision = view.revision;
  if (!expected || !isObject(revision) || revision.required !== expected.required || revision.mode !== expected.mode) {
    throw new Error(`Unexpected revision contract for ${view.source}`);
  }
  if (view.source === "RAPNA") {
    const modes = Array.isArray(revision.components) ? revision.components.map((item) => item?.mode) : [];
    for (const mode of expected.components) {
      if (!modes.includes(mode)) throw new Error(`RAPNA revision component missing: ${mode}`);
    }
  }
}

function validateRecent(view) {
  const recent = view.recent;
  if (!isObject(recent) || !["fresh", "degraded", "stale", "unknown"].includes(recent.status)) {
    throw new Error(`Invalid recent reliability for ${view.source}`);
  }
  if (!finiteNonNegative(recent.freshMaxAgeMinutes) || !finiteNonNegative(recent.staleMaxAgeMinutes) ||
      recent.freshMaxAgeMinutes > recent.staleMaxAgeMinutes) {
    throw new Error(`Invalid recent SLA for ${view.source}`);
  }
}

function validateRevision(view) {
  const revision = view.revision;
  if (!isObject(revision) || !["fresh", "degraded", "stale", "unknown", "not-required"].includes(revision.status)) {
    throw new Error(`Invalid revision reliability for ${view.source}`);
  }
  if (revision.required) {
    if (!finiteNonNegative(revision.maxAgeMinutes) || revision.maxAgeMinutes === 0) {
      throw new Error(`Invalid revision SLA for ${view.source}`);
    }
    if (revision.ageMinutes !== null && !finiteNonNegative(revision.ageMinutes)) {
      throw new Error(`Invalid revision age for ${view.source}`);
    }
  } else if (revision.status !== "not-required") {
    throw new Error(`Non-required revision source ${view.source} must report not-required`);
  }
}

export function validateReliabilitySnapshot(payload, {
  now = Date.now(),
  maxSnapshotAgeMinutes = 30,
  futureToleranceMinutes = 5,
} = {}) {
  if (!isObject(payload) || !Array.isArray(payload.reliability)) {
    throw new Error("Freshness payload does not contain reliability");
  }
  const views = payload.reliability;
  if (views.length !== REQUIRED_SOURCES.length) {
    throw new Error(`Expected ${REQUIRED_SOURCES.length} reliability views, got ${views.length}`);
  }
  const seen = new Set();
  for (const view of views) {
    if (!isObject(view) || !REQUIRED_SOURCES.includes(view.source) || seen.has(view.source)) {
      throw new Error("Reliability sources are missing, duplicated or unsupported");
    }
    seen.add(view.source);
    if (!iso(view.checkedAt)) throw new Error(`Invalid checkedAt for ${view.source}`);
    const ageMs = now - Date.parse(view.checkedAt);
    if (ageMs > maxSnapshotAgeMinutes * 60_000 || ageMs < -futureToleranceMinutes * 60_000) {
      throw new Error(`Reliability snapshot for ${view.source} is outside the control window`);
    }
    if (typeof view.activeLease !== "boolean") throw new Error(`Invalid activeLease for ${view.source}`);
    if (view.error !== null && typeof view.error !== "string") throw new Error(`Invalid error for ${view.source}`);
    validateRecent(view);
    validateRevision(view);
    assertRevisionContract(view);
  }
  for (const source of REQUIRED_SOURCES) {
    if (!seen.has(source)) throw new Error(`Missing reliability source ${source}`);
  }
  return views;
}

function liveObservedLease(source, observation, now) {
  if (!isObject(observation) || observation.lease === null || observation.lease === undefined) return false;
  const lease = observation.lease;
  if (!isObject(lease) || lease.source !== source || !iso(lease.expiresAt) || typeof lease.ownerId !== "string" ||
      lease.ownerId.length === 0 || typeof lease.mode !== "string" || lease.mode.length === 0) {
    throw new Error(`Malformed live lease for ${source}`);
  }
  return Date.parse(lease.expiresAt) > now;
}

function activeRevisionCycle(revision) {
  return iso(revision.cycleStartedAt) &&
    Number.isSafeInteger(revision.progress) && revision.progress > 0 &&
    Number.isSafeInteger(revision.total) && revision.total > 0 &&
    revision.progress < revision.total;
}

function severity(view) {
  if (activeRevisionCycle(view.revision)) return 4;
  if (view.revision.status === "stale") return 3;
  if (view.revision.status === "unknown") return 2;
  if (view.revision.status === "degraded") return 1;
  return 0;
}

function laneFor(source) {
  if (source === "RAPNA") return "current+legacy";
  if (source === "RASFF") return "reconcile";
  if (source === "OECD") return "historical-reconcile";
  if (source === "AESAN") return "full-archive-producer";
  return null;
}

export function buildRevisionShadowPlan(payload, observations = {}, options = {}) {
  const now = options.now ?? Date.now();
  const views = validateReliabilitySnapshot(payload, { ...options, now });
  const candidates = [];
  const blocked = [];
  const idle = [];
  const external = [];
  const notRequired = [];

  for (const view of views) {
    if (!view.revision.required) {
      notRequired.push({ source:view.source, reason:"revision-not-required" });
      continue;
    }

    const observedLease = liveObservedLease(view.source, observations[view.source], now);
    const leaseActive = view.activeLease || observedLease;
    const cycleActive = activeRevisionCycle(view.revision);
    const needsRevision = cycleActive || view.revision.status !== "fresh";
    const blockedReason = view.error ? "source-error" :
      leaseActive ? "active-lease" :
      view.recent.status !== "fresh" ? "recent-priority" : null;

    const record = {
      source:view.source,
      lane:laneFor(view.source),
      revisionStatus:view.revision.status,
      revisionAgeMinutes:view.revision.ageMinutes,
      revisionMaxAgeMinutes:view.revision.maxAgeMinutes,
      progress:view.revision.progress,
      total:view.revision.total,
      cycleActive,
      blockedReason,
    };

    if (view.source === "AESAN") {
      external.push({ ...record, actionable:needsRevision && blockedReason === null });
      continue;
    }

    if (!EXECUTABLE_SOURCES.has(view.source)) throw new Error(`Unsupported executable source ${view.source}`);
    if (blockedReason) {
      blocked.push(record);
      continue;
    }
    if (!needsRevision) {
      idle.push(record);
      continue;
    }
    candidates.push({ ...record, severity:severity(view) });
  }

  candidates.sort((left, right) =>
    right.severity - left.severity ||
    (right.revisionAgeMinutes ?? -1) - (left.revisionAgeMinutes ?? -1) ||
    sourceRank(left.source) - sourceRank(right.source));

  return {
    mode:"shadow",
    zeroWrite:true,
    selected:candidates[0] ?? null,
    candidates,
    blocked,
    idle,
    external,
    notRequired,
  };
}

async function fetchJson(fetchImpl, url, token) {
  const response = await fetchImpl(url, {
    headers:{ Authorization:`Bearer ${token}` },
    redirect:"follow",
    signal:AbortSignal.timeout(60_000),
  });
  const raw = await response.text();
  let body;
  try { body = JSON.parse(raw); } catch {
    throw new Error(`Revision control received non-JSON HTTP ${response.status} from ${url}`);
  }
  if (response.status !== 200) {
    throw new Error(`Revision control read failed HTTP ${response.status} from ${url}: ${raw.slice(0, 500)}`);
  }
  return body;
}

export async function runRevisionShadow({
  base,
  token,
  fetchImpl = fetch,
  now = Date.now(),
  maxSnapshotAgeMinutes = 30,
} = {}) {
  if (typeof base !== "string" || !/^https:\/\//u.test(base)) throw new Error("VIGIA_BASE_URL must be HTTPS");
  if (typeof token !== "string" || token.length === 0) throw new Error("VIGIA_SYNC_TOKEN is required");
  const root = base.replace(/\/+$/u, "");
  const freshness = await fetchJson(fetchImpl, root + "/api/freshness?observe=1", token);
  const observations = {};
  for (const [source, path] of Object.entries(OBSERVE_PATHS)) {
    observations[source] = await fetchJson(fetchImpl, root + path, token);
  }
  const plan = buildRevisionShadowPlan(freshness, observations, { now, maxSnapshotAgeMinutes });
  return { checkedAt:new Date(now).toISOString(), plan };
}

async function main() {
  const mode = process.argv[2] ?? "shadow";
  if (mode !== "shadow") throw new Error("F4A supports shadow mode only");
  const result = await runRevisionShadow({
    base:process.env.VIGIA_BASE_URL,
    token:process.env.VIGIA_SYNC_TOKEN,
  });
  console.log("REVISION_CONTROL_SHADOW " + JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
