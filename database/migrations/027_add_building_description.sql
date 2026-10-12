-- ============================================================
-- 027_add_building_description.sql
-- Phase 4 (scheduling resources): buildings get an optional free-text
-- description. `address` remains the building "location".
--
-- Additive and guarded (MariaDB has no ADD COLUMN IF NOT EXISTS on every
-- supported version).
-- ============================================================

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'buildings' AND COLUMN_NAME = 'description'
);
SET @ddl := IF(@col_exists = 0, 'ALTER TABLE buildings ADD COLUMN description TEXT NULL AFTER address', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
