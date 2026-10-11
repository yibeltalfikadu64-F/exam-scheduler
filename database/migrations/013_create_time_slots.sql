-- ============================================================
-- 013_create_time_slots.sql
-- Reusable exam time slots (morning/afternoon blocks).
-- ============================================================

CREATE TABLE IF NOT EXISTS time_slots (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid        CHAR(36)     NOT NULL DEFAULT (UUID()),
  label       VARCHAR(50)  NOT NULL,
  start_time  TIME         NOT NULL,
  end_time    TIME         NOT NULL,
  order_index SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_time_slots_uuid (uuid),
  UNIQUE KEY uq_time_slots_range (start_time, end_time),
  KEY idx_time_slots_order (order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
