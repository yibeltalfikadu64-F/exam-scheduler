-- ============================================================
-- 029_create_exams.sql
-- Phase 5 — Exam records + scheduling links.
--
-- 1. `exams`: a standalone examination record (course + section + term),
--    exam type (midterm/final/supplementary/...), duration, required room
--    type/capacity, a WORKING enrollment_count recomputed from real
--    `enrollments` rows by the exam service (never trusted from the client),
--    and a lifecycle status.
-- 2. `exam_schedule_details.exam_id`: nullable link so an allocation can be
--    traced back to the exam it schedules (added guardedly).
-- 3. Extends `exam_schedules.status` with the extra lifecycle states used by
--    the scheduling engine (generated, reviewed, cancelled).
-- ============================================================

CREATE TABLE IF NOT EXISTS exams (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid               CHAR(36)     NOT NULL DEFAULT (UUID()),
  course_id          INT UNSIGNED NOT NULL,
  section_id         INT UNSIGNED NOT NULL,
  exam_period_id     INT UNSIGNED NULL,
  academic_year_id   INT UNSIGNED NULL,
  semester_id        INT UNSIGNED NULL,
  exam_type          ENUM('midterm','final','supplementary','quiz','practical','other') NOT NULL DEFAULT 'final',
  title              VARCHAR(200) NOT NULL,
  duration_minutes   SMALLINT UNSIGNED NOT NULL DEFAULT 120,
  required_room_type ENUM('lecture','lab','hall','seminar','other') NULL,
  required_capacity  INT UNSIGNED NULL,
  enrollment_count   INT UNSIGNED NOT NULL DEFAULT 0,
  status             ENUM('draft','scheduled','published','cancelled','completed') NOT NULL DEFAULT 'draft',
  notes              TEXT NULL,
  created_by         INT UNSIGNED NULL,
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exams_uuid (uuid),
  UNIQUE KEY uq_exams_section_type_period (section_id, exam_type, exam_period_id),
  KEY idx_exams_course (course_id),
  KEY idx_exams_period (exam_period_id),
  KEY idx_exams_status (status),
  KEY idx_exams_type (exam_type),
  KEY idx_exams_academic (academic_year_id, semester_id),
  CONSTRAINT fk_exams_course
    FOREIGN KEY (course_id) REFERENCES courses (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_exams_section
    FOREIGN KEY (section_id) REFERENCES sections (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_exams_period
    FOREIGN KEY (exam_period_id) REFERENCES exam_periods (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_exams_academic_year
    FOREIGN KEY (academic_year_id) REFERENCES academic_years (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_exams_semester
    FOREIGN KEY (semester_id) REFERENCES semesters (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_exams_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- exam_schedule_details.exam_id -------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exam_schedule_details' AND COLUMN_NAME = 'exam_id'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE exam_schedule_details ADD COLUMN exam_id INT UNSIGNED NULL AFTER exam_schedule_id',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exam_schedule_details' AND INDEX_NAME = 'idx_esd_exam'
);
SET @ddl := IF(@idx_exists = 0,
  'ALTER TABLE exam_schedule_details ADD KEY idx_esd_exam (exam_id)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'exam_schedule_details' AND CONSTRAINT_NAME = 'fk_esd_exam'
);
SET @ddl := IF(@fk_exists = 0,
  'ALTER TABLE exam_schedule_details ADD CONSTRAINT fk_esd_exam FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE ON UPDATE CASCADE',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- exam_schedules.status lifecycle states ------------------------------------------
SET @col_type := (
  SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exam_schedules' AND COLUMN_NAME = 'status'
);
SET @ddl := IF(@col_type NOT LIKE '%generated%',
  "ALTER TABLE exam_schedules MODIFY status ENUM('draft','generated','reviewed','published','cancelled','archived') NOT NULL DEFAULT 'draft'",
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;