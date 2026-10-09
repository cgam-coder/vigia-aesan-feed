-- Additive and separately applied before activating the runtime/runner.
-- Application rollback leaves this append-only evidence intact.
CREATE TABLE source_reliability_effects (
  effect_key TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  source TEXT NOT NULL,
  mode TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  manifest_json TEXT NOT NULL CHECK(json_valid(manifest_json)),
  committed_at TEXT,
  result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
  UNIQUE(job_id, ordinal)
);
CREATE INDEX source_reliability_effects_job ON source_reliability_effects(job_id, ordinal);
CREATE TABLE source_reliability_recovery_plans (
 old_job_id TEXT NOT NULL,
 part INTEGER NOT NULL,
 manifest_hash TEXT NOT NULL,
 payload TEXT NOT NULL,
 PRIMARY KEY(old_job_id, part)
);
CREATE TABLE source_reliability_recoveries (
 old_job_id TEXT PRIMARY KEY,
 recovery_id TEXT UNIQUE NOT NULL,
 manifest_hash TEXT NOT NULL,
 original_job_json TEXT NOT NULL,
 original_state_json TEXT NOT NULL,
 receipt_json TEXT NOT NULL,
 committed_at TEXT NOT NULL
);
