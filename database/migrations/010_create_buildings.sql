-- ============================================================
-- 010_create_buildings.sql
-- Physical buildings that contain examination rooms.
-- ============================================================

CREATE TABLE IF NOT EXISTS buildings (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid       CHAR(36)     NOT NULL DEFAULT (UUID()),
  name       VARCHAR(150) NOT NULL,
  code       VARCHAR(20)  NOT NULL,
  address    VARCHAR(255) NULL,
  floors     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_buildings_uuid (uuid),
  UNIQUE KEY uq_buildings_name (name),
  UNIQUE KEY uq_buildings_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
