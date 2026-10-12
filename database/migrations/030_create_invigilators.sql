-- ============================================================
-- 030_create_invigilators.sql
-- Phase 6 — Invigilator management.
--
-- An invigilator is a PROFILE extension of an existing `users` account (no
-- separate login). `staff_identifier` is the university staff number and is
-- unique. When the staff member also has an `instructors` profile it is linked
-- (instructor_id) so the invigilation engine can apply teaching rules.
--
-- Supporting configuration:
--   * invigilator_availability  — recurring weekly availability windows and
--     blackout windows (day_of_week 1=Mon .. 7=Sun). No rows => unrestricted.
--   * invigilation_settings     — a single global row of policy defaults.
--   * invigilation_requirements — per-room / per-exam-type required counts that
--     override the global default.
--
-- All statements are additive and idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS invigilators (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid                  CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id               INT UNSIGNED NOT NULL,
  instructor_id         INT UNSIGNED NULL,
  staff_identifier      VARCHAR(40)  NOT NULL,
  department_id         INT UNSIGNED NULL,
  phone                 VARCHAR(20)  NULL,
  qualification         VARCHAR(150) NULL,
  max_duties_per_day    SMALLINT UNSIGNED NULL,
  max_duties_per_period SMALLINT UNSIGNED NULL,
  is_active             TINYINT(1)   NOT NULL DEFAULT 1,
  notes                 TEXT         NULL,
  created_by            INT UNSIGNED NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invigilators_uuid (uuid),
  UNIQUE KEY uq_invigilators_user (user_id),
  UNIQUE KEY uq_invigilators_staff (staff_identifier),
  KEY idx_invigilators_department (department_id),
  KEY idx_invigilators_active (is_active),
  CONSTRAINT fk_invigilators_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_invigilators_instructor
    FOREIGN KEY (instructor_id) REFERENCES instructors (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_invigilators_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_invigilators_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invigilator_availability (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid           CHAR(36)     NOT NULL DEFAULT (UUID()),
  invigilator_id INT UNSIGNED NOT NULL,
  day_of_week    TINYINT UNSIGNED NOT NULL, -- 1=Monday .. 7=Sunday (ISO)
  start_time     TIME         NOT NULL,
  end_time       TIME         NOT NULL,
  is_available   TINYINT(1)   NOT NULL DEFAULT 1, -- 0 = blackout window
  effective_from DATE         NULL,
  effective_to   DATE         NULL,
  note           VARCHAR(200) NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invigilator_availability_uuid (uuid),
  UNIQUE KEY uq_invigilator_availability_window (invigilator_id, day_of_week, start_time, end_time),
  KEY idx_invigilator_availability_inv (invigilator_id),
  CONSTRAINT fk_invigilator_availability_inv
    FOREIGN KEY (invigilator_id) REFERENCES invigilators (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invigilation_settings (
  id                            TINYINT UNSIGNED  NOT NULL DEFAULT 1,
  default_required_invigilators TINYINT UNSIGNED  NOT NULL DEFAULT 1,
  default_max_duties_per_day    SMALLINT UNSIGNED NOT NULL DEFAULT 2,
  default_max_duties_per_period SMALLINT UNSIGNED NOT NULL DEFAULT 10,
  preparation_minutes           SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  handover_minutes              SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  prevent_own_course            TINYINT(1)        NOT NULL DEFAULT 1,
  updated_by                    INT UNSIGNED      NULL,
  created_at                    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_invigilation_settings_updated_by
    FOREIGN KEY (updated_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exactly one global settings row.
INSERT IGNORE INTO invigilation_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS invigilation_requirements (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid           CHAR(36)     NOT NULL DEFAULT (UUID()),
  scope          ENUM('room','exam_type') NOT NULL,
  room_id        INT UNSIGNED NULL,
  exam_type      VARCHAR(30)  NULL,
  required_count TINYINT UNSIGNED NOT NULL DEFAULT 1,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  note           VARCHAR(200) NULL,
  created_by     INT UNSIGNED NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invigilation_requirements_uuid (uuid),
  KEY idx_invigilation_requirements_scope (scope),
  KEY idx_invigilation_requirements_room (room_id),
  KEY idx_invigilation_requirements_type (exam_type),
  CONSTRAINT fk_invigilation_requirements_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_invigilation_requirements_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
