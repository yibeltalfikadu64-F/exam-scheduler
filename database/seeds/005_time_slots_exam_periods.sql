-- ============================================================
-- seeds/005_time_slots_exam_periods.sql
-- Reusable exam time slots and two sample exam periods.
-- ============================================================

INSERT INTO time_slots (label, start_time, end_time, order_index) VALUES
  ('Morning 1',   '08:30:00', '10:30:00', 1),
  ('Morning 2',   '11:00:00', '13:00:00', 2),
  ('Afternoon 1', '14:00:00', '16:00:00', 3),
  ('Afternoon 2', '16:30:00', '18:30:00', 4)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  order_index = VALUES(order_index);

INSERT INTO exam_periods (name, term, start_date, end_date, status, description, settings) VALUES
  ('Midterm Examination 2026', '2026-SEM1', '2026-01-12', '2026-01-23', 'draft',
   'Mid-semester examinations for the first semester of 2026.',
   '{"spreadExams": true, "maxExamsPerDayPerCohort": 2, "minRestDays": 1}'),
  ('Final Examination 2026',   '2026-SEM2', '2026-06-01', '2026-06-12', 'draft',
   'End-of-semester examinations for the second semester of 2026.',
   '{"spreadExams": true, "maxExamsPerDayPerCohort": 2, "minRestDays": 1}')
ON DUPLICATE KEY UPDATE
  term = VALUES(term),
  start_date = VALUES(start_date),
  end_date = VALUES(end_date),
  description = VALUES(description),
  settings = VALUES(settings);
