-- ============================================================
-- 025_add_section_academic_links.sql
-- Extends the existing `sections` table with optional links to the academic
-- calendar so a section can be tied to a program, academic year and semester.
--
-- Additive and reversible-friendly: nullable columns, ON DELETE SET NULL, and
-- guarded DDL (MariaDB has no ADD COLUMN IF NOT EXISTS / ADD CONSTRAINT IF NOT
-- EXISTS on every supported version).
-- ============================================================

-- section_name ---------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sections' AND COLUMN_NAME = 'section_name'
);
SET @ddl := IF(@col_exists = 0, "ALTER TABLE sections ADD COLUMN section_name VARCHAR(100) NULL AFTER section", 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- program_id ----------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sections' AND COLUMN_NAME = 'program_id'
);
SET @ddl := IF(@col_exists = 0, 'ALTER TABLE sections ADD COLUMN program_id INT UNSIGNED NULL AFTER course_id', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- academic_year_id ----------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sections' AND COLUMN_NAME = 'academic_year_id'
);
SET @ddl := IF(@col_exists = 0, 'ALTER TABLE sections ADD COLUMN academic_year_id INT UNSIGNED NULL AFTER section_name', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- semester_id ---------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sections' AND COLUMN_NAME = 'semester_id'
);
SET @ddl := IF(@col_exists = 0, 'ALTER TABLE sections ADD COLUMN semester_id INT UNSIGNED NULL AFTER academic_year_id', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- program FK ----------------------------------------------------------------
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'sections' AND CONSTRAINT_NAME = 'fk_sections_program'
);
SET @ddl := IF(@fk_exists = 0, 'ALTER TABLE sections ADD CONSTRAINT fk_sections_program FOREIGN KEY (program_id) REFERENCES programs (id) ON DELETE SET NULL ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- academic year FK ----------------------------------------------------------
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'sections' AND CONSTRAINT_NAME = 'fk_sections_academic_year'
);
SET @ddl := IF(@fk_exists = 0, 'ALTER TABLE sections ADD CONSTRAINT fk_sections_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years (id) ON DELETE SET NULL ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- semester FK ---------------------------------------------------------------
SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'sections' AND CONSTRAINT_NAME = 'fk_sections_semester'
);
SET @ddl := IF(@fk_exists = 0, 'ALTER TABLE sections ADD CONSTRAINT fk_sections_semester FOREIGN KEY (semester_id) REFERENCES semesters (id) ON DELETE SET NULL ON UPDATE CASCADE', 'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
