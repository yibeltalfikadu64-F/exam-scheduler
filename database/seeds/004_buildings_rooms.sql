-- ============================================================
-- seeds/004_buildings_rooms.sql
-- Buildings, rooms and an initial capacity-history row per room.
-- ============================================================

INSERT INTO buildings (name, code, address, floors) VALUES
  ('Main Hall',        'MH',  'Central Campus, Block A',          3),
  ('Science Block',    'SB',  'Central Campus, Block B',          4),
  ('Engineering Wing', 'EW',  'Engineering Campus, Block E',      3),
  ('IT Center',        'ITC', 'Central Campus, IT Building',      2)
ON DUPLICATE KEY UPDATE
  address = VALUES(address),
  floors = VALUES(floors);

INSERT INTO rooms (building_id, name, floor, capacity, type, equipment) VALUES
  ((SELECT id FROM buildings WHERE code = 'MH'),  'A101', 1,  60, 'lecture', 'projector, whiteboard'),
  ((SELECT id FROM buildings WHERE code = 'MH'),  'A102', 1,  60, 'lecture', 'projector, whiteboard'),
  ((SELECT id FROM buildings WHERE code = 'MH'),  'A201', 2, 120, 'hall',    'projector, sound system'),
  ((SELECT id FROM buildings WHERE code = 'MH'),  'A202', 2,  40, 'seminar', 'whiteboard'),
  ((SELECT id FROM buildings WHERE code = 'SB'),  'S101', 1,  50, 'lecture', 'projector'),
  ((SELECT id FROM buildings WHERE code = 'SB'),  'S102', 1,  50, 'lecture', 'projector'),
  ((SELECT id FROM buildings WHERE code = 'SB'),  'S201', 2,  30, 'lab',     'computers, projector'),
  ((SELECT id FROM buildings WHERE code = 'SB'),  'S202', 2,  30, 'lab',     'computers'),
  ((SELECT id FROM buildings WHERE code = 'EW'),  'E101', 1,  80, 'lecture', 'projector, whiteboard'),
  ((SELECT id FROM buildings WHERE code = 'EW'),  'E102', 1,  80, 'lecture', 'projector'),
  ((SELECT id FROM buildings WHERE code = 'EW'),  'E201', 2,  45, 'lab',     'equipment'),
  ((SELECT id FROM buildings WHERE code = 'ITC'), 'T101', 1, 100, 'hall',    'projector, sound system'),
  ((SELECT id FROM buildings WHERE code = 'ITC'), 'T102', 1,  45, 'seminar', 'whiteboard'),
  ((SELECT id FROM buildings WHERE code = 'ITC'), 'T201', 2,  35, 'lab',     'computers')
ON DUPLICATE KEY UPDATE
  floor = VALUES(floor),
  capacity = VALUES(capacity),
  type = VALUES(type),
  equipment = VALUES(equipment);

-- Initial capacity history: effective from the start of the seeded exam term.
INSERT INTO room_capacities (room_id, capacity, effective_from, note)
SELECT r.id, r.capacity, '2026-01-01', 'Initial seeded capacity'
FROM rooms r
ON DUPLICATE KEY UPDATE
  capacity = VALUES(capacity),
  note = VALUES(note);
