-- ============================================================
-- seeds/003_courses.sql
-- Sample courses attached to departments and (where applicable) programs.
-- ============================================================

INSERT INTO courses (department_id, program_id, code, title, credits)
VALUES
  ((SELECT id FROM departments WHERE code = 'SE'), (SELECT id FROM programs WHERE code = 'SE-BSC'), 'SENG3341', 'Principles of Compiler Design',            3),
  ((SELECT id FROM departments WHERE code = 'SE'), (SELECT id FROM programs WHERE code = 'SE-BSC'), 'SENG3441', 'Real Time and Embedded Systems',           3),
  ((SELECT id FROM departments WHERE code = 'SE'), (SELECT id FROM programs WHERE code = 'SE-BSC'), 'SENG5441', 'Software Testing and Quality Assurance',   3),
  ((SELECT id FROM departments WHERE code = 'SE'), (SELECT id FROM programs WHERE code = 'SE-BSC'), 'SENG6241', 'Mobile Application Development',           3),
  ((SELECT id FROM departments WHERE code = 'CS'), (SELECT id FROM programs WHERE code = 'CS-BSC'), 'CSEC2012', 'Data Structures and Algorithms',           4),
  ((SELECT id FROM departments WHERE code = 'CS'), (SELECT id FROM programs WHERE code = 'CS-BSC'), 'CSEC3012', 'Database Systems',                         4),
  ((SELECT id FROM departments WHERE code = 'CS'), (SELECT id FROM programs WHERE code = 'CS-MSC'), 'CSEC5012', 'Advanced Algorithms',                      3),
  ((SELECT id FROM departments WHERE code = 'IT'), (SELECT id FROM programs WHERE code = 'IT-BSC'), 'ITEC2101', 'Web Programming',                          3),
  ((SELECT id FROM departments WHERE code = 'CE'), (SELECT id FROM programs WHERE code = 'CE-BSC'), 'CENG3101', 'Structural Analysis I',                    4),
  ((SELECT id FROM departments WHERE code = 'ME'), (SELECT id FROM programs WHERE code = 'ME-BSC'), 'MENG3201', 'Rock Mechanics',                           3),
  ((SELECT id FROM departments WHERE code = 'EE'), (SELECT id FROM programs WHERE code = 'EE-BSC'), 'EEEN2210', 'Signals and Systems',                      4)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  credits = VALUES(credits),
  department_id = VALUES(department_id),
  program_id = VALUES(program_id);
