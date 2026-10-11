-- ============================================================
-- seeds/001_departments.sql
-- Fictional departments for a representative Ethiopian university.
-- Idempotent: safe to run repeatedly.
-- ============================================================

INSERT INTO departments (name, code, description) VALUES
  ('Software Engineering',   'SE',   'Design, construction and maintenance of software systems'),
  ('Computer Science',       'CS',   'Algorithms, systems, theory and computing foundations'),
  ('Information Technology', 'IT',   'Applied networking, infrastructure and IT services'),
  ('Information Systems',    'IS',   'Information management and enterprise systems'),
  ('Civil Engineering',      'CE',   'Structures, water resources, transport and geotechnics'),
  ('Mining Engineering',     'ME',   'Mineral extraction, rock mechanics and mine planning'),
  ('Electrical Engineering', 'EE',   'Power, control, electronics and communications'),
  ('Applied Mathematics',    'MATH', 'Mathematical modelling and numerical methods')
ON DUPLICATE KEY UPDATE
  code = VALUES(code),
  description = VALUES(description);
