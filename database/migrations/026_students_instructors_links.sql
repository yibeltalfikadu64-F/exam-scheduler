-- ============================================================
-- 026_students_instructors_links.sql
-- Phase 3, module 5.
--   students.user_id        -> optional link to a login account
--   instructors.staff_number-> optional unique staff identifier
-- Additive and guarded.
-- ============================================================

-- students.user_id -----------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'user_id'
);
SET @ddl := IF(@col_exists = 0, 'ALTER TABLE students ADD COLUMN user_id INT UNSIGNED NULL AFTER uuid', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND INDEX_NAME = 'uq_students_user'
);
SET @ddl := IF(@idx_exists = 0, 'ALTER TABLE students ADD UNIQUE KEY uq_students_user (user_id)', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND CONSTRAINT_NAME = 'fk_students_user'
);
SET @ddl := IF(@fk_exists = 0, 'ALTER TABLE students ADD CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- instructors.staff_number ---------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'instructors' AND COLUMN_NAME = 'staff_number'
);
SET @ddl := IF(@col_exists = 0, 'ALTER TABLE instructors ADD COLUMN staff_number VARCHAR(30) NULL AFTER uuid', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'instructors' AND INDEX_NAME = 'uq_instructors_staff_number'
);
SET @ddl := IF(@idx_exists = 0, 'ALTER TABLE instructors ADD UNIQUE KEY uq_instructors_staff_number (staff_number)', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
