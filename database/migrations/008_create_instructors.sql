-- ============================================================
-- 008_create_instructors.sql
-- Profile extension of `users` for teaching staff.
-- ============================================================

CREATE TABLE IF NOT EXISTS instructors (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid           CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id        INT UNSIGNED NOT NULL,
  department_id  INT UNSIGNED NULL,
  title          VARCHAR(120) NULL,
  expertise      VARCHAR(255) NULL,
  max_load_hours SMALLINT UNSIGNED NOT NULL DEFAULT 12,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_instructors_uuid (uuid),
  UNIQUE KEY uq_instructors_user (user_id),
  KEY idx_instructors_department (department_id),
  CONSTRAINT fk_instructors_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_instructors_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
