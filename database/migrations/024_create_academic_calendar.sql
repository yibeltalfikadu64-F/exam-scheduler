-- ============================================================
-- 024_create_academic_calendar.sql
-- Configurable academic calendar: academic years and their semesters.
--
-- Dates are stored as plain DATE values and are NOT tied to any specific
-- calendar system (Gregorian, Ethiopian, ...). Universities label years with
-- their own `code`/`name`; dates are optional so a calendar can be defined in
-- phases. Additive: creates new tables only.
-- ============================================================

CREATE TABLE IF NOT EXISTS academic_years (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid       CHAR(36)     NOT NULL DEFAULT (UUID()),
  code       VARCHAR(30)  NOT NULL,
  name       VARCHAR(100) NOT NULL,
  start_date DATE         NULL,
  end_date   DATE         NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_academic_years_uuid (uuid),
  UNIQUE KEY uq_academic_years_code (code),
  UNIQUE KEY uq_academic_years_name (name),
  KEY idx_academic_years_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS semesters (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  uuid             CHAR(36)     NOT NULL DEFAULT (UUID()),
  academic_year_id INT UNSIGNED NOT NULL,
  name             VARCHAR(100) NOT NULL,
  sequence         TINYINT UNSIGNED NOT NULL DEFAULT 1,
  start_date       DATE         NULL,
  end_date         DATE         NULL,
  is_active        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_semesters_uuid (uuid),
  UNIQUE KEY uq_semesters_year_sequence (academic_year_id, sequence),
  UNIQUE KEY uq_semesters_year_name (academic_year_id, name),
  KEY idx_semesters_year (academic_year_id),
  CONSTRAINT fk_semesters_academic_year
    FOREIGN KEY (academic_year_id) REFERENCES academic_years (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
