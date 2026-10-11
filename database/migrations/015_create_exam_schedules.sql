-- ============================================================
-- 015_create_exam_schedules.sql
-- A versioned schedule within an exam period. Draft, published and archived
-- versions are distinguished; each generated/adjusted schedule is a new row.
-- ============================================================

CREATE TABLE IF NOT EXISTS exam_schedules (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid           CHAR(36)     NOT NULL DEFAULT (UUID()),
  exam_period_id INT UNSIGNED NOT NULL,
  version        INT UNSIGNED NOT NULL DEFAULT 1,
  name           VARCHAR(150) NULL,
  status         ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  published_by   INT UNSIGNED NULL,
  published_at   DATETIME     NULL,
  notes          TEXT         NULL,
  created_by     INT UNSIGNED NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_exam_schedules_uuid (uuid),
  UNIQUE KEY uq_exam_schedules_period_version (exam_period_id, version),
  KEY idx_exam_schedules_period (exam_period_id),
  KEY idx_exam_schedules_status (status),
  CONSTRAINT fk_exam_schedules_period
    FOREIGN KEY (exam_period_id) REFERENCES exam_periods (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_exam_schedules_published_by
    FOREIGN KEY (published_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_exam_schedules_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
