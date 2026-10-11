-- ============================================================
-- 022_link_department_head_fk.sql
-- Adds the deferred circular FK: departments.head_id -> users.id.
-- Guarded so re-running is safe (MariaDB has no ADD CONSTRAINT IF NOT EXISTS).
-- ============================================================

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'departments'
    AND CONSTRAINT_NAME = 'fk_departments_head'
);

SET @ddl := IF(
  @fk_exists = 0,
  'ALTER TABLE departments ADD CONSTRAINT fk_departments_head FOREIGN KEY (head_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE',
  'DO 0'
);

PREPARE add_head_fk FROM @ddl;
EXECUTE add_head_fk;
DEALLOCATE PREPARE add_head_fk;
