-- ============================================================
-- 006_create_students.sql
-- Student records (fictional data only). Linked to a program.
-- ============================================================

CREATE TABLE IF NOT EXISTS students (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid           CHAR(36)     NOT NULL DEFAULT (UUID()),
  student_number VARCHAR(30)  NOT NULL,
  full_name      VARCHAR(150) NOT NULL,
  email          VARCHAR(150) NULL,
  phone          VARCHAR(20)  NULL,
  program_id     INT UNSIGNED NULL,
  year           TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status         ENUM('active','inactive','graduated','suspended') NOT NULL DEFAULT 'active',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_uuid (uuid),
  UNIQUE KEY uq_students_number (student_number),
  KEY idx_students_program (program_id),
  KEY idx_students_status (status),
  CONSTRAINT fk_students_program
    FOREIGN KEY (program_id) REFERENCES programs (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
