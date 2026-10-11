-- ============================================================
-- 019_create_schedule_constraints.sql
-- Configurable hard/soft constraints used by the scheduling engine.
-- ============================================================

CREATE TABLE IF NOT EXISTS schedule_constraints (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid           CHAR(36)     NOT NULL DEFAULT (UUID()),
  constraint_key VARCHAR(60)  NOT NULL,
  name           VARCHAR(150) NOT NULL,
  type           ENUM('hard','soft') NOT NULL DEFAULT 'hard',
  scope          ENUM('global','department','program') NOT NULL DEFAULT 'global',
  department_id  INT UNSIGNED NULL,
  description    TEXT         NULL,
  parameters     JSON         NULL,
  weight         DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  is_enabled     TINYINT(1)   NOT NULL DEFAULT 1,
  created_by     INT UNSIGNED NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_schedule_constraints_uuid (uuid),
  UNIQUE KEY uq_schedule_constraints_key (constraint_key),
  KEY idx_schedule_constraints_type (type),
  KEY idx_schedule_constraints_scope (scope),
  KEY idx_schedule_constraints_department (department_id),
  CONSTRAINT fk_schedule_constraints_department
    FOREIGN KEY (department_id) REFERENCES departments (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_schedule_constraints_created_by
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
