-- ============================================================
-- 005_create_sections.sql
-- A course is delivered in one or more sections per term.
-- ============================================================

CREATE TABLE IF NOT EXISTS sections (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid           CHAR(36)     NOT NULL DEFAULT (UUID()),
  course_id      INT UNSIGNED NOT NULL,
  section        VARCHAR(10)  NOT NULL,
  term           VARCHAR(30)  NOT NULL,
  capacity       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  enrolled_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  instructor_id  INT UNSIGNED NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sections_uuid (uuid),
  UNIQUE KEY uq_sections_course_section_term (course_id, section, term),
  KEY idx_sections_course (course_id),
  KEY idx_sections_instructor (instructor_id),
  KEY idx_sections_term (term),
  CONSTRAINT fk_sections_course
    FOREIGN KEY (course_id) REFERENCES courses (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sections_instructor
    FOREIGN KEY (instructor_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
