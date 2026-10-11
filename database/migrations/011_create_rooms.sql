-- ============================================================
-- 011_create_rooms.sql
-- Examination rooms. Capacity must be sufficient for assigned candidates.
-- ============================================================

CREATE TABLE IF NOT EXISTS rooms (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid        CHAR(36)     NOT NULL DEFAULT (UUID()),
  building_id INT UNSIGNED NOT NULL,
  name        VARCHAR(50)  NOT NULL,
  floor       TINYINT      NOT NULL DEFAULT 0,
  capacity    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  type        ENUM('lecture','lab','hall','seminar','other') NOT NULL DEFAULT 'lecture',
  equipment   VARCHAR(255) NULL,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rooms_uuid (uuid),
  UNIQUE KEY uq_rooms_building_name (building_id, name),
  KEY idx_rooms_building (building_id),
  KEY idx_rooms_capacity (capacity),
  KEY idx_rooms_active (is_active),
  CONSTRAINT fk_rooms_building
    FOREIGN KEY (building_id) REFERENCES buildings (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
