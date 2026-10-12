-- ============================================================
-- 023_create_course_prerequisites.sql
-- Optional self-referencing prerequisite links between courses.
-- Additive: does not alter or conflict with the existing `courses` table.
-- ============================================================

CREATE TABLE IF NOT EXISTS course_prerequisites (
  id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid                   CHAR(36)     NOT NULL DEFAULT (UUID()),
  course_id              INT UNSIGNED NOT NULL,
  prerequisite_course_id INT UNSIGNED NOT NULL,
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_prerequisites_uuid (uuid),
  UNIQUE KEY uq_course_prerequisites_pair (course_id, prerequisite_course_id),
  KEY idx_course_prerequisites_course (course_id),
  KEY idx_course_prerequisites_prereq (prerequisite_course_id),
  CONSTRAINT fk_course_prerequisites_course
    FOREIGN KEY (course_id) REFERENCES courses (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_course_prerequisites_prereq
    FOREIGN KEY (prerequisite_course_id) REFERENCES courses (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_course_prerequisites_self CHECK (course_id <> prerequisite_course_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
