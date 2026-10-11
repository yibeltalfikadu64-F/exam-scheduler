-- ============================================================
-- seeds/002_programs.sql
-- Degree programs under each department. Fictional data.
-- ============================================================

INSERT INTO programs (department_id, name, code, degree_type, duration_years, description)
VALUES
  ((SELECT id FROM departments WHERE code = 'SE'),   'BSc in Software Engineering',   'SE-BSC',   'bachelor', 5, 'Five-year engineering program'),
  ((SELECT id FROM departments WHERE code = 'CS'),   'BSc in Computer Science',       'CS-BSC',   'bachelor', 4, 'Four-year science program'),
  ((SELECT id FROM departments WHERE code = 'IT'),   'BSc in Information Technology', 'IT-BSC',   'bachelor', 4, 'Four-year applied program'),
  ((SELECT id FROM departments WHERE code = 'IS'),   'BSc in Information Systems',    'IS-BSC',   'bachelor', 4, 'Four-year applied program'),
  ((SELECT id FROM departments WHERE code = 'CE'),   'BSc in Civil Engineering',      'CE-BSC',   'bachelor', 5, 'Five-year engineering program'),
  ((SELECT id FROM departments WHERE code = 'ME'),   'BSc in Mining Engineering',     'ME-BSC',   'bachelor', 5, 'Five-year engineering program'),
  ((SELECT id FROM departments WHERE code = 'EE'),   'BSc in Electrical Engineering', 'EE-BSC',   'bachelor', 5, 'Five-year engineering program'),
  ((SELECT id FROM departments WHERE code = 'CS'),   'MSc in Computer Science',       'CS-MSC',   'master',   2, 'Two-year master program')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  degree_type = VALUES(degree_type),
  duration_years = VALUES(duration_years),
  description = VALUES(description);
