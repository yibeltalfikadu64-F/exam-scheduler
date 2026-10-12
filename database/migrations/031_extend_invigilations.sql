-- ============================================================
-- 031_extend_invigilations.sql
-- Phase 6 — Duty assignments reuse the existing `invigilations` table.
--
-- Adds:
--   * invigilator_id  — the Phase 6 invigilator profile (user_id is kept as the
--     authoritative login reference for backward compatibility).
--   * publish_status / published_at / published_by — draft vs published duty
--     roster, so invigilators are only notified about approved rosters.
--   * assigned_by / assigned_at — who created the duty and when.
--   * status extended with 'cancelled'.
--
-- All statements are additive and idempotent (guarded by information_schema).
-- ============================================================

-- invigilations.invigilator_id ------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invigilations' AND COLUMN_NAME = 'invigilator_id'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE invigilations ADD COLUMN invigilator_id INT UNSIGNED NULL AFTER user_id',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- invigilations.publish_status -----------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invigilations' AND COLUMN_NAME = 'publish_status'
);
SET @ddl := IF(@col_exists = 0,
  "ALTER TABLE invigilations ADD COLUMN publish_status ENUM('draft','published') NOT NULL DEFAULT 'draft' AFTER status",
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- invigilations.published_at --------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invigilations' AND COLUMN_NAME = 'published_at'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE invigilations ADD COLUMN published_at DATETIME NULL AFTER publish_status',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- invigilations.published_by --------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invigilations' AND COLUMN_NAME = 'published_by'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE invigilations ADD COLUMN published_by INT UNSIGNED NULL AFTER published_at',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- invigilations.assigned_by ---------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invigilations' AND COLUMN_NAME = 'assigned_by'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE invigilations ADD COLUMN assigned_by INT UNSIGNED NULL AFTER published_by',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- invigilations.assigned_at ---------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invigilations' AND COLUMN_NAME = 'assigned_at'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE invigilations ADD COLUMN assigned_at DATETIME NULL AFTER assigned_by',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Extend the status enum with 'cancelled' (guarded by the current column type).
SET @col_type := (
  SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invigilations' AND COLUMN_NAME = 'status'
);
SET @ddl := IF(@col_type NOT LIKE '%cancelled%',
  "ALTER TABLE invigilations MODIFY status ENUM('assigned','confirmed','declined','cancelled','completed') NOT NULL DEFAULT 'assigned'",
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Indexes ---------------------------------------------------------------------
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invigilations' AND INDEX_NAME = 'idx_invigilations_invigilator'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE invigilations ADD KEY idx_invigilations_invigilator (invigilator_id)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invigilations' AND INDEX_NAME = 'idx_invigilations_publish'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE invigilations ADD KEY idx_invigilations_publish (publish_status, status)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Foreign keys ----------------------------------------------------------------
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'invigilations' AND CONSTRAINT_NAME = 'fk_invigilations_invigilator'
);
SET @ddl := IF(@fk_exists = 0,
  'ALTER TABLE invigilations ADD CONSTRAINT fk_invigilations_invigilator FOREIGN KEY (invigilator_id) REFERENCES invigilators (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'invigilations' AND CONSTRAINT_NAME = 'fk_invigilations_published_by'
);
SET @ddl := IF(@fk_exists = 0,
  'ALTER TABLE invigilations ADD CONSTRAINT fk_invigilations_published_by FOREIGN KEY (published_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'invigilations' AND CONSTRAINT_NAME = 'fk_invigilations_assigned_by'
);
SET @ddl := IF(@fk_exists = 0,
  'ALTER TABLE invigilations ADD CONSTRAINT fk_invigilations_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
