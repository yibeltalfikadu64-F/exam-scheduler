-- ============================================================
-- 012_create_room_capacities.sql
--
-- JUSTIFICATION: room capacity is not a fixed scalar. Rooms are reconfigured
-- between exam periods (seating layout, renovation, temporary closures), and
-- the scheduling engine must be able to reason about the capacity that applied
-- on a given date. Keeping a dated history lets published schedules remain
-- auditable ("this room seated 60 on 2026-01-12") even after the room changes.
--
-- `rooms.capacity` remains the current/effective capacity for convenience.
-- ============================================================

CREATE TABLE IF NOT EXISTS room_capacities (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid           CHAR(36)     NOT NULL DEFAULT (UUID()),
  room_id        INT UNSIGNED NOT NULL,
  capacity       SMALLINT UNSIGNED NOT NULL,
  effective_from DATE         NOT NULL,
  effective_to   DATE         NULL,
  note           VARCHAR(255) NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_room_capacities_uuid (uuid),
  UNIQUE KEY uq_room_capacities_room_from (room_id, effective_from),
  KEY idx_room_capacities_room (room_id),
  CONSTRAINT fk_room_capacities_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
