-- ============================================================
-- 002_create_users.sql
-- Application accounts and role assignments (single role per user).
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid                  CHAR(36)     NOT NULL DEFAULT (UUID()),
  username              VARCHAR(50)  NOT NULL,
  email                 VARCHAR(100) NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  full_name             VARCHAR(100) NOT NULL,
  role                  ENUM('admin','registrar','department_head','instructor','student')
                        NOT NULL DEFAULT 'student',
  department_id         INT UNSIGNED NULL,
  phone                 VARCHAR(20)  NULL,
  profile_picture       VARCHAR(255) NULL,
  is_active             TINYINT(1)   NOT NULL DEFAULT 1,
  is_verified           TINYINT(1)   NOT NULL DEFAULT 0,
  last_login            DATETIME     NULL,
  failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  account_locked_until  DATETIME     NULL,
  password_reset_token  VARCHAR(255) NULL,
  password_reset_expires DATETIME    NULL,
  last_password_change  DATETIME     NULL,
  preferences           JSON         NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at            DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_uuid (uuid),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_department (department_id),
  KEY idx_users_active (is_active),
  KEY idx_users_reset_token (password_reset_token),
  CONSTRAINT fk_users_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
