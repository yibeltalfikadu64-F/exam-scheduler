-- ============================================================
-- 004_create_courses.sql
-- A program may contain multiple courses; a course belongs to a department.
-- ============================================================

CREATE TABLE IF NOT EXISTS courses (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid          CHAR(36)     NOT NULL DEFAULT (UUID()),
  department_id INT UNSIGNED NOT NULL,
  program_id    INT UNSIGNED NULL,
  code          VARCHAR(20)  NOT NULL,
  title         VARCHAR(200) NOT NULL,
  description   TEXT         NULL,
  credits       TINYINT UNSIGNED NOT NULL DEFAULT 3,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_uuid (uuid),
  UNIQUE KEY uq_courses_code (code),
  KEY idx_courses_department (department_id),
  KEY idx_courses_program (program_id),
  CONSTRAINT fk_courses_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_courses_program
    FOREIGN KEY (program_id) REFERENCES programs (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
