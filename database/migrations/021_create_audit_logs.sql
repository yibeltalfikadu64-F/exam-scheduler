-- ============================================================
-- 021_create_audit_logs.sql
-- Append-only trail of security-sensitive and data-changing actions.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid        CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id     INT UNSIGNED NULL,
  action      VARCHAR(80)  NOT NULL,
  entity_type VARCHAR(60)  NULL,
  entity_id   INT UNSIGNED NULL,
  before_data JSON         NULL,
  after_data  JSON         NULL,
  ip_address  VARCHAR(45)  NULL,
  user_agent  VARCHAR(300) NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_audit_logs_uuid (uuid),
  KEY idx_audit_logs_user (user_id),
  KEY idx_audit_logs_entity (entity_type, entity_id),
  KEY idx_audit_logs_action (action),
  KEY idx_audit_logs_created (created_at),
  CONSTRAINT fk_audit_logs_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
