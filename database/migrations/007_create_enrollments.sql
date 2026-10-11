-- ============================================================
-- 007_create_enrollments.sql
-- Students enroll in sections. Drives the "no overlapping exams" rule.
-- ============================================================

CREATE TABLE IF NOT EXISTS enrollments (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid       CHAR(36)     NOT NULL DEFAULT (UUID()),
  student_id INT UNSIGNED NOT NULL,
  section_id INT UNSIGNED NOT NULL,
  status     ENUM('enrolled','dropped','completed') NOT NULL DEFAULT 'enrolled',
  grade      VARCHAR(5)   NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enrollments_uuid (uuid),
  UNIQUE KEY uq_enrollments_student_section (student_id, section_id),
  KEY idx_enrollments_student (student_id),
  KEY idx_enrollments_section (section_id),
  KEY idx_enrollments_status (status),
  CONSTRAINT fk_enrollments_student
    FOREIGN KEY (student_id) REFERENCES students (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_enrollments_section
    FOREIGN KEY (section_id) REFERENCES sections (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
