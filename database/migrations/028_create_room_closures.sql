-- ============================================================
-- 028_create_room_closures.sql
-- Phase 4 (scheduling resources): periods during which a room cannot host an
-- exam (maintenance, renovation, events, accessibility work...).
--
-- A closure covers a date range. When `start_time`/`end_time` are NULL the room
-- is closed for the whole day(s); otherwise only the [start_time, end_time)
-- window is blocked. Times are plain TIME values compared on the same date —
-- no calendar system (Ethiopian/Gregorian) is assumed.
-- ============================================================

CREATE TABLE IF NOT EXISTS room_closures (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid       CHAR(36)     NOT NULL DEFAULT (UUID()),
  room_id    INT UNSIGNED NOT NULL,
  start_date DATE         NOT NULL,
  end_date   DATE         NOT NULL,
  start_time TIME         NULL,
  end_time   TIME         NULL,
  reason     VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_room_closures_uuid (uuid),
  KEY idx_room_closures_room (room_id),
  KEY idx_room_closures_dates (room_id, start_date, end_date),
  CONSTRAINT fk_room_closures_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_room_closures_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
