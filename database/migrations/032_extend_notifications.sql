-- ============================================================
-- 032_extend_notifications.sql
-- Phase 6 — Database-backed notification queue.
--
-- Extends the existing `notifications` table with:
--   * event_type    — the domain event that produced the notification.
--   * entity_type / entity_id — the related record (exam, schedule, duty...).
--   * dedupe_key    — a unique key that makes notification creation idempotent
--     so a retried request never sends a duplicate.
--   * retry_count / last_error / next_attempt_at — safe retry bookkeeping for
--     email delivery.
--
-- All statements are additive and idempotent (guarded by information_schema).
-- ============================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'event_type'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE notifications ADD COLUMN event_type VARCHAR(60) NULL AFTER uuid',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'entity_type'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE notifications ADD COLUMN entity_type VARCHAR(60) NULL AFTER event_type',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'entity_id'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE notifications ADD COLUMN entity_id INT UNSIGNED NULL AFTER entity_type',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'dedupe_key'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE notifications ADD COLUMN dedupe_key VARCHAR(190) NULL AFTER meta',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'retry_count'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE notifications ADD COLUMN retry_count TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER dedupe_key',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'last_error'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE notifications ADD COLUMN last_error VARCHAR(500) NULL AFTER retry_count',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'next_attempt_at'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE notifications ADD COLUMN next_attempt_at DATETIME NULL AFTER last_error',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Unique dedupe key (NULLs are exempt in MySQL/MariaDB, so only rows with a key
-- are de-duplicated).
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'uq_notifications_dedupe'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE notifications ADD UNIQUE KEY uq_notifications_dedupe (dedupe_key)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notifications_event'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE notifications ADD KEY idx_notifications_event (event_type)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notifications_dispatch'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE notifications ADD KEY idx_notifications_dispatch (channel, status, next_attempt_at)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
