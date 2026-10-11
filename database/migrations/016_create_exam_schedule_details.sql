-- ============================================================
-- 016_create_exam_schedule_details.sql
-- The individual scheduled exam entries within a schedule version.
--
-- The unique key (schedule, date, slot, room) is a hard room double-booking
-- guard *within a schedule version*. Cross-version and student/invigilator
-- conflicts are detected by the scheduling engine (Phase 7).
-- ============================================================

CREATE TABLE IF NOT EXISTS exam_schedule_details (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid              CHAR(36)     NOT NULL DEFAULT (UUID()),
  exam_schedule_id  INT UNSIGNED NOT NULL,
  section_id        INT UNSIGNED NOT NULL,
  room_id           INT UNSIGNED NOT NULL,
  time_slot_id      INT UNSIGNED NOT NULL,
  exam_date         DATE         NOT NULL,
  start_time        TIME         NOT NULL,
  end_time          TIME         NOT NULL,
  duration_minutes  SMALLINT UNSIGNED NOT NULL DEFAULT 120,
  total_students    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  invigilator_count TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status            ENUM('draft','scheduled','confirmed','cancelled','completed') NOT NULL DEFAULT 'scheduled',
  notes             TEXT         NULL,
  created_by        INT UNSIGNED NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exam_schedule_details_uuid (uuid),
  UNIQUE KEY uq_exam_schedule_details_room_slot (exam_schedule_id, exam_date, time_slot_id, room_id),
  KEY idx_esd_schedule (exam_schedule_id),
  KEY idx_esd_section (section_id),
  KEY idx_esd_room (room_id),
  KEY idx_esd_slot (time_slot_id),
  KEY idx_esd_date (exam_date),
  KEY idx_esd_status (status),
  CONSTRAINT fk_esd_schedule
    FOREIGN KEY (exam_schedule_id) REFERENCES exam_schedules (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_esd_section
    FOREIGN KEY (section_id) REFERENCES sections (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_esd_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_esd_time_slot
    FOREIGN KEY (time_slot_id) REFERENCES time_slots (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_esd_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
