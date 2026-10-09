CREATE TABLE `alert_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alert_id` text NOT NULL,
	`content_hash` text NOT NULL,
	`snapshot` text NOT NULL,
	`detected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_versions_alert_hash_unique` ON `alert_versions` (`alert_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `alert_versions_alert_id_idx` ON `alert_versions` (`alert_id`);--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`source` text NOT NULL,
	`type` text NOT NULL,
	`priority` text DEFAULT 'Media' NOT NULL,
	`title` text NOT NULL,
	`product` text DEFAULT 'No especificado' NOT NULL,
	`brand` text DEFAULT '' NOT NULL,
	`hazard` text DEFAULT 'Consultar publicación oficial' NOT NULL,
	`origin` text DEFAULT 'No indicado' NOT NULL,
	`scope` text DEFAULT 'No indicado' NOT NULL,
	`action` text DEFAULT 'Consultar publicación oficial' NOT NULL,
	`lots` text DEFAULT '[]' NOT NULL,
	`image_url` text,
	`url` text NOT NULL,
	`published_at` text,
	`detected_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`content_hash` text NOT NULL,
	`version_count` integer DEFAULT 1 NOT NULL,
	`is_update` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alerts_reference_unique` ON `alerts` (`reference`);--> statement-breakpoint
CREATE INDEX `alerts_published_at_idx` ON `alerts` (`published_at`);--> statement-breakpoint
CREATE INDEX `alerts_source_idx` ON `alerts` (`source`);--> statement-breakpoint
CREATE TABLE `source_checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`checked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`status` text NOT NULL,
	`found_count` integer DEFAULT 0 NOT NULL,
	`changed_count` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `source_checks_source_date_idx` ON `source_checks` (`source`,`checked_at`);
ALTER TABLE `alerts` ADD `product_class` text DEFAULT 'Sin clasificar' NOT NULL;--> statement-breakpoint
ALTER TABLE `alerts` ADD `product_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `alerts` ADD `brand_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `alerts` ADD `provider` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `alerts` ADD `provider_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `alerts` ADD `provider_role` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `alerts` ADD `provider_evidence` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `alerts_product_key_idx` ON `alerts` (`product_key`);--> statement-breakpoint
CREATE INDEX `alerts_brand_key_idx` ON `alerts` (`brand_key`);--> statement-breakpoint
CREATE INDEX `alerts_provider_key_idx` ON `alerts` (`provider_key`);
DROP INDEX `alerts_reference_unique`;--> statement-breakpoint
ALTER TABLE `alerts` ADD `canonical_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `alerts_source_reference_unique` ON `alerts` (`source`,`reference`);
CREATE TABLE `source_sync_state` (
	`source` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`total_units` integer DEFAULT 0 NOT NULL,
	`pages_scanned` integer DEFAULT 0 NOT NULL,
	`records_observed` integer DEFAULT 0 NOT NULL,
	`records_persisted` integer DEFAULT 0 NOT NULL,
	`new_count` integer DEFAULT 0 NOT NULL,
	`updated_count` integer DEFAULT 0 NOT NULL,
	`detail_failures` integer DEFAULT 0 NOT NULL,
	`page_errors` integer DEFAULT 0 NOT NULL,
	`oldest_published_at` text,
	`newest_published_at` text,
	`coverage` text DEFAULT 'unknown' NOT NULL,
	`started_at` text,
	`last_success_at` text,
	`completed_at` text,
	`last_error` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_sync_state_source_mode_unique` ON `source_sync_state` (`source`,`mode`);--> statement-breakpoint
CREATE INDEX `source_sync_state_status_idx` ON `source_sync_state` (`status`);

CREATE TABLE `source_backfill_snapshot_chunks` (
	`snapshot_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`chunk_text` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_backfill_snapshot_chunks_unique` ON `source_backfill_snapshot_chunks` (`snapshot_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `source_backfill_snapshot_chunks_snapshot_idx` ON `source_backfill_snapshot_chunks` (`snapshot_id`);--> statement-breakpoint
CREATE TABLE `source_backfill_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`purpose` text NOT NULL,
	`created_at` text NOT NULL,
	`alert_count` integer NOT NULL,
	`source_alert_count` integer NOT NULL,
	`version_count` integer NOT NULL,
	`checksum` text NOT NULL,
	`source_data_checksum` text NOT NULL,
	`status` text NOT NULL,
	`backfill_started_at` text,
	`restored_at` text
);
--> statement-breakpoint
CREATE INDEX `source_backfill_snapshots_source_created_idx` ON `source_backfill_snapshots` (`source`,`created_at`);--> statement-breakpoint
CREATE INDEX `source_backfill_snapshots_status_idx` ON `source_backfill_snapshots` (`status`);--> statement-breakpoint
CREATE TABLE `source_sync_locks` (
	`source` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`mode` text NOT NULL,
	`acquired_at` text NOT NULL,
	`heartbeat_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `source_sync_locks_expires_at_idx` ON `source_sync_locks` (`expires_at`);--> statement-breakpoint
ALTER TABLE `source_sync_state` ADD `lease_owner_id` text;--> statement-breakpoint
ALTER TABLE `source_sync_state` ADD `lease_mode` text;--> statement-breakpoint
ALTER TABLE `source_sync_state` ADD `lease_expires_at` text;--> statement-breakpoint
ALTER TABLE `source_sync_state` ADD `last_skipped_at` text;--> statement-breakpoint
ALTER TABLE `source_sync_state` ADD `last_skip_reason` text;--> statement-breakpoint
ALTER TABLE `source_sync_state` ADD `last_skipped_owner_id` text;
ALTER TABLE `source_sync_state` ADD `plan_version` text;--> statement-breakpoint
ALTER TABLE `source_sync_state` ADD `cursor_key` text;
CREATE INDEX `alerts_query_date_id_idx` ON `alerts` (`published_at`,`id`);--> statement-breakpoint
CREATE INDEX `alerts_query_source_date_id_idx` ON `alerts` (`source`,`published_at`,`id`);--> statement-breakpoint
CREATE INDEX `alerts_reference_idx` ON `alerts` (`reference`);
CREATE TABLE `alert_actors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alert_id` text NOT NULL,
	`role` text NOT NULL,
	`actor_key` text NOT NULL,
	`raw_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`source_field` text NOT NULL,
	`evidence` text NOT NULL,
	`mapping_version` text NOT NULL,
	FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_actors_semantic_unique` ON `alert_actors` (`alert_id`,`role`,`actor_key`,`source_field`);--> statement-breakpoint
CREATE INDEX `alert_actors_alert_role_idx` ON `alert_actors` (`alert_id`,`role`);--> statement-breakpoint
CREATE INDEX `alert_actors_role_key_alert_idx` ON `alert_actors` (`role`,`actor_key`,`alert_id`);--> statement-breakpoint
CREATE TABLE `alert_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alert_id` text NOT NULL,
	`category_key` text NOT NULL,
	`raw_value` text NOT NULL,
	`source_normalized` text NOT NULL,
	`canonical_code` text NOT NULL,
	`status` text NOT NULL,
	`source_field` text NOT NULL,
	`evidence_type` text NOT NULL,
	`reason` text NOT NULL,
	`mapping_version` text NOT NULL,
	FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "alert_categories_status_check" CHECK("alert_categories"."status" IN ('mapped', 'unmapped', 'unknown'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_categories_alert_key_unique` ON `alert_categories` (`alert_id`,`category_key`);--> statement-breakpoint
CREATE INDEX `alert_categories_code_alert_idx` ON `alert_categories` (`canonical_code`,`alert_id`);--> statement-breakpoint
CREATE INDEX `alert_categories_alert_idx` ON `alert_categories` (`alert_id`);--> statement-breakpoint
CREATE TABLE `alert_dimension_state` (
	`alert_id` text PRIMARY KEY NOT NULL,
	`source_content_hash` text NOT NULL,
	`mapping_version` text NOT NULL,
	`product_domain` text NOT NULL,
	`category_status` text NOT NULL,
	`hazard_status` text NOT NULL,
	`geography_status` text NOT NULL,
	`actor_status` text NOT NULL,
	`affects_spain` text NOT NULL,
	`affects_spain_reason` text NOT NULL,
	`derived_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "alert_dimension_state_product_domain_check" CHECK("alert_dimension_state"."product_domain" IN ('food', 'non_food', 'unknown')),
	CONSTRAINT "alert_dimension_state_category_status_check" CHECK("alert_dimension_state"."category_status" IN ('mapped', 'unmapped', 'unknown')),
	CONSTRAINT "alert_dimension_state_hazard_status_check" CHECK("alert_dimension_state"."hazard_status" IN ('mapped', 'unmapped', 'unknown')),
	CONSTRAINT "alert_dimension_state_geography_status_check" CHECK("alert_dimension_state"."geography_status" IN ('mapped', 'partial', 'unmapped', 'unknown')),
	CONSTRAINT "alert_dimension_state_actor_status_check" CHECK("alert_dimension_state"."actor_status" IN ('mapped', 'unknown')),
	CONSTRAINT "alert_dimension_state_affects_spain_check" CHECK("alert_dimension_state"."affects_spain" IN ('true', 'false', 'unknown'))
);
--> statement-breakpoint
CREATE INDEX `alert_dimension_state_domain_alert_idx` ON `alert_dimension_state` (`product_domain`,`alert_id`);--> statement-breakpoint
CREATE INDEX `alert_dimension_state_spain_alert_idx` ON `alert_dimension_state` (`affects_spain`,`alert_id`);--> statement-breakpoint
CREATE TABLE `alert_geographies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alert_id` text NOT NULL,
	`role` text NOT NULL,
	`geography_key` text NOT NULL,
	`geography_code` text NOT NULL,
	`code_scheme` text NOT NULL,
	`country_code` text NOT NULL,
	`subdivision_code` text NOT NULL,
	`admin_level` text NOT NULL,
	`raw_value` text NOT NULL,
	`source` text NOT NULL,
	`source_field` text NOT NULL,
	`evidence_type` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`mapping_version` text NOT NULL,
	FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "alert_geographies_role_check" CHECK("alert_geographies"."role" IN ('origin', 'notifying', 'distribution', 'affected')),
	CONSTRAINT "alert_geographies_status_check" CHECK("alert_geographies"."status" IN ('mapped', 'unmapped')),
	CONSTRAINT "alert_geographies_admin_level_check" CHECK("alert_geographies"."admin_level" IN ('country', 'subdivision', 'territory', 'unknown'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_geographies_semantic_unique` ON `alert_geographies` (`alert_id`,`role`,`geography_key`,`source_field`);--> statement-breakpoint
CREATE INDEX `alert_geographies_alert_role_idx` ON `alert_geographies` (`alert_id`,`role`);--> statement-breakpoint
CREATE INDEX `alert_geographies_role_geography_alert_idx` ON `alert_geographies` (`role`,`geography_code`,`alert_id`);--> statement-breakpoint
CREATE INDEX `alert_geographies_role_country_alert_idx` ON `alert_geographies` (`role`,`country_code`,`alert_id`);--> statement-breakpoint
CREATE INDEX `alert_geographies_role_subdivision_alert_idx` ON `alert_geographies` (`role`,`subdivision_code`,`alert_id`);--> statement-breakpoint
CREATE TABLE `alert_hazards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alert_id` text NOT NULL,
	`hazard_key` text NOT NULL,
	`raw_value` text NOT NULL,
	`source_normalized` text NOT NULL,
	`canonical_code` text NOT NULL,
	`status` text NOT NULL,
	`source_field` text NOT NULL,
	`evidence_type` text NOT NULL,
	`reason` text NOT NULL,
	`mapping_version` text NOT NULL,
	FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "alert_hazards_status_check" CHECK("alert_hazards"."status" IN ('mapped', 'unmapped', 'unknown'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_hazards_alert_key_unique` ON `alert_hazards` (`alert_id`,`hazard_key`);--> statement-breakpoint
CREATE INDEX `alert_hazards_code_alert_idx` ON `alert_hazards` (`canonical_code`,`alert_id`);--> statement-breakpoint
CREATE INDEX `alert_hazards_alert_idx` ON `alert_hazards` (`alert_id`);--> statement-breakpoint
CREATE TABLE `dimension_rebuild_state` (
	`source` text PRIMARY KEY NOT NULL,
	`mapping_version` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`cursor_alert_id` text,
	`scanned_count` integer DEFAULT 0 NOT NULL,
	`candidate_relation_count` integer DEFAULT 0 NOT NULL,
	`write_count` integer DEFAULT 0 NOT NULL,
	`mapped_count` integer DEFAULT 0 NOT NULL,
	`unknown_count` integer DEFAULT 0 NOT NULL,
	`unmapped_count` integer DEFAULT 0 NOT NULL,
	`ambiguous_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`lease_owner_id` text,
	`lease_expires_at` text,
	`last_error` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "dimension_rebuild_state_mode_check" CHECK("dimension_rebuild_state"."mode" IN ('dry_run', 'apply')),
	CONSTRAINT "dimension_rebuild_state_status_check" CHECK("dimension_rebuild_state"."status" IN ('idle', 'running', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `dimension_rebuild_state_status_idx` ON `dimension_rebuild_state` (`status`);

CREATE TABLE `alert_aliases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`alias_type` text NOT NULL,
	`alias_value` text NOT NULL,
	`alert_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "alert_aliases_type_check" CHECK("alert_aliases"."alias_type" IN ('reference', 'alert_id')),
	CONSTRAINT "alert_aliases_nonempty_check" CHECK(length(trim("alert_aliases"."alias_value")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_aliases_source_type_value_unique` ON `alert_aliases` (`source`,`alias_type`,`alias_value`);--> statement-breakpoint
CREATE INDEX `alert_aliases_alert_id_idx` ON `alert_aliases` (`alert_id`);--> statement-breakpoint
CREATE TABLE `alert_source_identities` (
	`source` text NOT NULL,
	`source_record_id` text NOT NULL,
	`alert_id` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "alert_source_identities_nonempty_check" CHECK(length(trim("alert_source_identities"."source_record_id")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_source_identities_source_record_unique` ON `alert_source_identities` (`source`,`source_record_id`);--> statement-breakpoint
CREATE INDEX `alert_source_identities_source_alert_idx` ON `alert_source_identities` (`source`,`alert_id`);
CREATE TABLE `__new_alert_dimension_state` (
  `alert_id` text PRIMARY KEY NOT NULL,
  `source_content_hash` text NOT NULL,
  `mapping_version` text NOT NULL,
  `product_domain` text NOT NULL,
  `category_status` text NOT NULL,
  `hazard_status` text NOT NULL,
  `geography_status` text NOT NULL,
  `actor_status` text NOT NULL,
  `affects_spain` text NOT NULL,
  `affects_spain_reason` text NOT NULL,
  `derived_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT "alert_dimension_state_product_domain_check" CHECK("__new_alert_dimension_state"."product_domain" IN ('human_food','animal_feed','non_food','unknown')),
  CONSTRAINT "alert_dimension_state_category_status_check" CHECK("__new_alert_dimension_state"."category_status" IN ('mapped','unmapped','unknown')),
  CONSTRAINT "alert_dimension_state_hazard_status_check" CHECK("__new_alert_dimension_state"."hazard_status" IN ('mapped','unmapped','unknown')),
  CONSTRAINT "alert_dimension_state_geography_status_check" CHECK("__new_alert_dimension_state"."geography_status" IN ('mapped','partial','unmapped','unknown')),
  CONSTRAINT "alert_dimension_state_actor_status_check" CHECK("__new_alert_dimension_state"."actor_status" IN ('mapped','unknown')),
  CONSTRAINT "alert_dimension_state_affects_spain_check" CHECK("__new_alert_dimension_state"."affects_spain" IN ('true','false','unknown'))
);
--> statement-breakpoint
INSERT INTO `__new_alert_dimension_state` (`alert_id`,`source_content_hash`,`mapping_version`,`product_domain`,`category_status`,`hazard_status`,`geography_status`,`actor_status`,`affects_spain`,`affects_spain_reason`,`derived_at`)
SELECT `alert_id`,`source_content_hash`,`mapping_version`,CASE WHEN `product_domain`='food' THEN 'human_food' ELSE `product_domain` END,`category_status`,`hazard_status`,`geography_status`,`actor_status`,`affects_spain`,`affects_spain_reason`,`derived_at` FROM `alert_dimension_state`;
--> statement-breakpoint
DROP TABLE `alert_dimension_state`;
--> statement-breakpoint
ALTER TABLE `__new_alert_dimension_state` RENAME TO `alert_dimension_state`;
--> statement-breakpoint
CREATE INDEX `alert_dimension_state_domain_alert_idx` ON `alert_dimension_state` (`product_domain`,`alert_id`);
--> statement-breakpoint
CREATE INDEX `alert_dimension_state_spain_alert_idx` ON `alert_dimension_state` (`affects_spain`,`alert_id`);

CREATE TABLE `source_freshness_state` (
	`source` text PRIMARY KEY NOT NULL,
	`checked_at` text NOT NULL,
	`status` text NOT NULL,
	`official_latest_identity` text,
	`official_latest_published_at` text,
	`official_latest_updated_at` text,
	`nagame_latest_identity` text,
	`nagame_latest_published_at` text,
	`nagame_latest_updated_at` text,
	`latest_identity_parity` integer DEFAULT false NOT NULL,
	`sample_official_count` integer DEFAULT 0 NOT NULL,
	`sample_nagame_count` integer DEFAULT 0 NOT NULL,
	`missing_official_identities` text DEFAULT '[]' NOT NULL,
	`unexpected_nagame_identities` text DEFAULT '[]' NOT NULL,
	`revision_mismatches` text DEFAULT '[]' NOT NULL,
	`last_sync_success_at` text,
	`sync_age_minutes` integer,
	`lag_minutes` integer,
	`active_lease` integer DEFAULT false NOT NULL,
	`last_successful_parity_at` text,
	`error` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "source_freshness_state_status_check" CHECK("source_freshness_state"."status" IN ('fresh', 'degraded', 'stale', 'unknown'))
);
--> statement-breakpoint
CREATE INDEX `source_freshness_state_status_checked_idx` ON `source_freshness_state` (`status`,`checked_at`);
ALTER TABLE `source_freshness_state` ADD `revision_status` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `source_freshness_state` ADD `revision_last_success_at` text;--> statement-breakpoint
ALTER TABLE `source_freshness_state` ADD `revision_age_minutes` integer;--> statement-breakpoint
ALTER TABLE `source_freshness_state` ADD `revision_cycle_started_at` text;--> statement-breakpoint
ALTER TABLE `source_freshness_state` ADD `revision_progress` integer;--> statement-breakpoint
ALTER TABLE `source_freshness_state` ADD `revision_total` integer;
CREATE TABLE `source_revision_certifications` (
	`source` text NOT NULL,
	`mode` text NOT NULL,
	`cycle_id` text NOT NULL,
	`completed_at` text NOT NULL,
	`total_units` integer NOT NULL,
	`records_observed` integer NOT NULL,
	`coverage` text NOT NULL,
	`audit_status` text NOT NULL,
	`audit_checked_at` text NOT NULL,
	`evidence_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "source_revision_certifications_coverage_check" CHECK("source_revision_certifications"."coverage" = 'official-index-complete'),
	CONSTRAINT "source_revision_certifications_audit_check" CHECK("source_revision_certifications"."audit_status" = 'passed')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_revision_certifications_source_mode_unique` ON `source_revision_certifications` (`source`,`mode`);--> statement-breakpoint
CREATE INDEX `source_revision_certifications_completed_idx` ON `source_revision_certifications` (`completed_at`);
ALTER TABLE `alerts` ADD `aesan_taxonomy_status` text GENERATED ALWAYS AS (CASE WHEN source = 'AESAN' AND json_valid(canonical_json) THEN json_extract(canonical_json, '$.sourceRecord.aesanAlertClassification.status') ELSE NULL END) VIRTUAL;--> statement-breakpoint
ALTER TABLE `alerts` ADD `aesan_taxonomy_code` text GENERATED ALWAYS AS (CASE WHEN source = 'AESAN' AND json_valid(canonical_json) THEN json_extract(canonical_json, '$.sourceRecord.aesanAlertClassification.code') ELSE NULL END) VIRTUAL;--> statement-breakpoint
CREATE INDEX `alerts_aesan_taxonomy_known_code_id_idx` ON `alerts` (`aesan_taxonomy_code`,`id`) WHERE "alerts"."source" = 'AESAN' AND "alerts"."aesan_taxonomy_status" = 'known';
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
