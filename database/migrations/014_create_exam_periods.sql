-- ============================================================
-- 014_create_exam_periods.sql
-- An exam period (e.g. "Midterm 2026") spanning a date range.
-- ============================================================

CREATE TABLE IF NOT EXISTS exam_periods (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid        CHAR(36)     NOT NULL DEFAULT (UUID()),
  name        VARCHAR(150) NOT NULL,
  term        VARCHAR(30)  NOT NULL,
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  status      ENUM('draft','open','published','closed','archived') NOT NULL DEFAULT 'draft',
  description TEXT         NULL,
  settings    JSON         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exam_periods_uuid (uuid),
  UNIQUE KEY uq_exam_periods_name (name),
  KEY idx_exam_periods_term (term),
  KEY idx_exam_periods_status (status),
  KEY idx_exam_periods_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
