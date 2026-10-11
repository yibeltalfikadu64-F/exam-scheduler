-- ============================================================
-- 009_create_instructor_assignments.sql
-- Which instructor teaches which section, and in what role.
-- ============================================================

CREATE TABLE IF NOT EXISTS instructor_assignments (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid          CHAR(36)     NOT NULL DEFAULT (UUID()),
  instructor_id INT UNSIGNED NOT NULL,
  section_id    INT UNSIGNED NOT NULL,
  role          ENUM('primary','assistant','co_instructor') NOT NULL DEFAULT 'primary',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_instructor_assignments_uuid (uuid),
  UNIQUE KEY uq_instructor_assignments_unique (instructor_id, section_id, role),
  KEY idx_instructor_assignments_instructor (instructor_id),
  KEY idx_instructor_assignments_section (section_id),
  CONSTRAINT fk_instructor_assignments_instructor
    FOREIGN KEY (instructor_id) REFERENCES instructors (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_instructor_assignments_section
    FOREIGN KEY (section_id) REFERENCES sections (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
