-- ============================================================
-- 003_create_programs.sql
-- A department may offer multiple programs (degree tracks).
-- ============================================================

CREATE TABLE IF NOT EXISTS programs (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid           CHAR(36)     NOT NULL DEFAULT (UUID()),
  department_id  INT UNSIGNED NOT NULL,
  name           VARCHAR(150) NOT NULL,
  code           VARCHAR(20)  NOT NULL,
  degree_type    ENUM('bachelor','master','phd','diploma','certificate') NOT NULL DEFAULT 'bachelor',
  duration_years TINYINT UNSIGNED NOT NULL DEFAULT 4,
  description    TEXT         NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_programs_uuid (uuid),
  UNIQUE KEY uq_programs_code (code),
  UNIQUE KEY uq_programs_department_code (department_id, code),
  KEY idx_programs_department (department_id),
  CONSTRAINT fk_programs_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
