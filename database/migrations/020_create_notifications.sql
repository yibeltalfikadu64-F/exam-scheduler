-- ============================================================
-- 020_create_notifications.sql
-- In-app / email / SMS notifications per user.
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid         CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id      INT UNSIGNED NOT NULL,
  title        VARCHAR(200) NOT NULL,
  message      TEXT         NOT NULL,
  type         ENUM('info','success','warning','error','announcement') NOT NULL DEFAULT 'info',
  priority     ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  channel      ENUM('in_app','email','sms') NOT NULL DEFAULT 'in_app',
  status       ENUM('pending','sent','failed','scheduled') NOT NULL DEFAULT 'pending',
  link         VARCHAR(500) NULL,
  meta         JSON         NULL,
  read_at      DATETIME     NULL,
  scheduled_at DATETIME     NULL,
  sent_at      DATETIME     NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifications_uuid (uuid),
  KEY idx_notifications_user (user_id),
  KEY idx_notifications_unread (user_id, read_at),
  KEY idx_notifications_status (status),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
