-- ============================================================
-- 017_create_invigilations.sql
-- Invigilator assignments to a scheduled exam.
-- `user_id` is the primary invigilator identity; `instructor_id` is an
-- optional link to the instructor profile when the invigilator is teaching staff.
-- ============================================================

CREATE TABLE IF NOT EXISTS invigilations (
  id                      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid                    CHAR(36)     NOT NULL DEFAULT (UUID()),
  exam_schedule_detail_id INT UNSIGNED NOT NULL,
  instructor_id           INT UNSIGNED NULL,
  user_id                 INT UNSIGNED NOT NULL,
  role                    ENUM('lead','invigilator') NOT NULL DEFAULT 'invigilator',
  status                  ENUM('assigned','confirmed','declined','completed') NOT NULL DEFAULT 'assigned',
  notes                   TEXT         NULL,
  created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invigilations_uuid (uuid),
  UNIQUE KEY uq_invigilations_detail_user (exam_schedule_detail_id, user_id),
  KEY idx_invigilations_detail (exam_schedule_detail_id),
  KEY idx_invigilations_user (user_id),
  KEY idx_invigilations_status (status),
  CONSTRAINT fk_invigilations_detail
    FOREIGN KEY (exam_schedule_detail_id) REFERENCES exam_schedule_details (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_invigilations_instructor
    FOREIGN KEY (instructor_id) REFERENCES instructors (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_invigilations_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
