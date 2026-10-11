-- ============================================================
-- seeds/006_schedule_constraints.sql
-- Default hard and soft constraints for the scheduling engine.
-- These are configurations/definitions, not schedule data.
-- ============================================================

INSERT INTO schedule_constraints (constraint_key, name, type, scope, description, parameters, weight, is_enabled) VALUES
  ('no_student_overlap',        'No student has overlapping exams',        'hard', 'global', 'A student enrolled in two sections must not be scheduled for two exams at overlapping times.', NULL, 1.00, 1),
  ('no_room_double_booking',    'No room is double-booked',                'hard', 'global', 'A room may host at most one exam per time slot and date.',                                    NULL, 1.00, 1),
  ('room_capacity_adequate',    'Room capacity is adequate',               'hard', 'global', 'A room must have capacity greater than or equal to the number of assigned candidates.',       NULL, 1.00, 1),
  ('exam_fits_time_slot',       'Exam duration fits within the time slot', 'hard', 'global', 'The exam duration must not exceed the length of the assigned time slot.',                      NULL, 1.00, 1),
  ('no_invigilator_overlap',    'No invigilator has overlapping duties',   'hard', 'global', 'An instructor must not be assigned to two overlapping invigilation duties.',                   NULL, 1.00, 1),
  ('spread_exams_across_days',  'Spread examinations across available days','soft', 'global', 'Distribute exams across the exam period to reduce student load per day.',                      '{"maxPerDayPerCohort": 2}', 0.70, 1),
  ('respect_rest_period',       'Respect configured rest periods',         'soft', 'global', 'Leave at least the configured gap between exams for a cohort.',                                '{"minRestDays": 1}', 0.50, 1),
  ('balance_room_utilization',  'Balance room utilization',                'soft', 'global', 'Prefer rooms that keep utilization balanced rather than concentrating exams in few rooms.',     NULL, 0.40, 1),
  ('fair_invigilation_load',    'Distribute invigilation duties fairly',   'soft', 'global', 'Assign invigilation so the total load per instructor stays balanced.',                         '{"toleranceHours": 2}', 0.60, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  type = VALUES(type),
  scope = VALUES(scope),
  description = VALUES(description),
  parameters = VALUES(parameters),
  weight = VALUES(weight),
  is_enabled = VALUES(is_enabled);
