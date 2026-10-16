-- ============================================================
-- 033_create_system_settings.sql
-- Phase 7 — Real, database-backed system settings.
--
-- A small key/value catalogue of University-wide configuration used by the
-- "System Settings" administration module. Each row declares its own value
-- type so the API can validate and coerce values before they are persisted.
--
-- `is_public = 1` marks settings that are safe to expose to any authenticated
-- user (branding / theme); everything else is administrator-managed.
--
-- Additive and idempotent: creates the table with IF NOT EXISTS and inserts
-- default rows with INSERT IGNORE so administrator edits are never overwritten
-- by re-running the migration.
-- ============================================================

CREATE TABLE IF NOT EXISTS system_settings (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  uuid          CHAR(36)      NOT NULL DEFAULT (UUID()),
  setting_key   VARCHAR(80)   NOT NULL,
  category      VARCHAR(40)   NOT NULL DEFAULT 'general',
  label         VARCHAR(150)  NOT NULL,
  description   VARCHAR(255)  NULL,
  value_type    ENUM('string','number','boolean','json') NOT NULL DEFAULT 'string',
  setting_value TEXT          NULL,
  is_public     TINYINT(1)    NOT NULL DEFAULT 0,
  updated_by    INT UNSIGNED  NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_system_settings_uuid (uuid),
  UNIQUE KEY uq_system_settings_key (setting_key),
  KEY idx_system_settings_category (category),
  CONSTRAINT fk_system_settings_updated_by
    FOREIGN KEY (updated_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default catalogue. INSERT IGNORE keeps any value an administrator has
-- already saved (the unique key is setting_key).
INSERT IGNORE INTO system_settings
  (setting_key, category, label, description, value_type, setting_value, is_public)
VALUES
  ('institution.name', 'branding', 'Institution name',
   'Full name of the university shown across the application.', 'string',
   'University Exam Scheduler', 1),
  ('institution.short_name', 'branding', 'Short name',
   'Abbreviated institution name used in compact headers.', 'string',
   'UES', 1),
  ('branding.default_theme', 'branding', 'Default theme',
   'Theme new sessions start with (light or dark).', 'string',
   'light', 1),
  ('academic.default_academic_year_id', 'academic', 'Default academic year',
   'Academic year pre-selected when creating records.', 'number', NULL, 0),
  ('academic.default_semester_id', 'academic', 'Default semester',
   'Semester pre-selected when creating records.', 'number', NULL, 0),
  ('academic.default_exam_period_id', 'academic', 'Default exam period',
   'Exam period pre-selected on the generate-schedule page.', 'number', NULL, 0),
  ('scheduling.default_exam_duration_minutes', 'scheduling', 'Default exam duration (minutes)',
   'Fallback duration for new examination records.', 'number', '120', 0),
  ('scheduling.default_rest_interval_minutes', 'scheduling', 'Minimum rest between exams (minutes)',
   'Minimum gap a student should have between two examinations.', 'number', '30', 0),
  ('scheduling.max_exams_per_day', 'scheduling', 'Max exams per section per day',
   'Upper bound used by the scheduling engine for a single section.', 'number', '2', 0),
  ('scheduling.default_required_invigilators', 'scheduling', 'Default invigilators per exam',
   'Fallback number of invigilators required per scheduled exam.', 'number', '2', 0),
  ('notifications.email_enabled', 'notifications', 'Email notifications',
   'Queue email copies of notifications (requires SMTP configuration).', 'boolean',
   'false', 0),
  ('notifications.schedule_change_alerts', 'notifications', 'Schedule change alerts',
   'Notify students and instructors when a schedule is published or cancelled.', 'boolean',
   'true', 0),
  ('notifications.reminder_lead_days', 'notifications', 'Exam reminder lead time (days)',
   'How many days before an exam a reminder notification should be produced.', 'number',
   '3', 0);
