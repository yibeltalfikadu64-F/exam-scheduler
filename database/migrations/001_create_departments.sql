-- ============================================================
-- 001_create_departments.sql
-- Academic departments. `head_id` FK is added in 022 once `users` exists.
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid         CHAR(36)     NOT NULL DEFAULT (UUID()),
  name         VARCHAR(150) NOT NULL,
  code         VARCHAR(20)  NOT NULL,
  description  TEXT         NULL,
  head_id      INT UNSIGNED NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_uuid (uuid),
  UNIQUE KEY uq_departments_name (name),
  UNIQUE KEY uq_departments_code (code),
  KEY idx_departments_head (head_id),
  KEY idx_departments_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
