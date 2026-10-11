-- ============================================================
-- 018_create_schedule_conflicts.sql
-- Detected hard/soft constraint violations, with resolution tracking.
-- ============================================================

CREATE TABLE IF NOT EXISTS schedule_conflicts (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid                    CHAR(36)     NOT NULL DEFAULT (UUID()),
  exam_schedule_id        INT UNSIGNED NOT NULL,
  exam_schedule_detail_id INT UNSIGNED NULL,
  type                    ENUM(
                            'room_double_booked',
                            'room_capacity',
                            'invigilator_double_booked',
                            'instructor_overlap',
                            'student_overlap',
                            'time_overlap',
                            'room_unavailable',
                            'insufficient_gap',
                            'other'
                          ) NOT NULL,
  severity                ENUM('critical','high','medium','low') NOT NULL DEFAULT 'medium',
  status                  ENUM('open','resolved','ignored') NOT NULL DEFAULT 'open',
  title                   VARCHAR(200) NOT NULL,
  description             TEXT         NULL,
  details                 JSON         NULL,
  resolution              TEXT         NULL,
  resolved_by             INT UNSIGNED NULL,
  resolved_at             DATETIME     NULL,
  ignored_reason          TEXT         NULL,
  created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_schedule_conflicts_uuid (uuid),
  KEY idx_schedule_conflicts_schedule (exam_schedule_id),
  KEY idx_schedule_conflicts_detail (exam_schedule_detail_id),
  KEY idx_schedule_conflicts_status_severity (status, severity),
  KEY idx_schedule_conflicts_type (type),
  CONSTRAINT fk_schedule_conflicts_schedule
    FOREIGN KEY (exam_schedule_id) REFERENCES exam_schedules (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_schedule_conflicts_detail
    FOREIGN KEY (exam_schedule_detail_id) REFERENCES exam_schedule_details (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_schedule_conflicts_resolved_by
    FOREIGN KEY (resolved_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
