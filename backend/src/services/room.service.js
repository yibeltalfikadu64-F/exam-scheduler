'use strict';

/**
 * Room management (Phase 4 — scheduling resources).
 *
 * Reuses `rooms` (building_id, name, floor, capacity, type, equipment,
 * is_active) and the Phase-4 `room_closures` table. A room number is unique
 * within its building; capacity is a positive integer. Hard deletion is
 * refused while examination records reference the room.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { paginate, toDateString, timeToMinutes } = require('../validators/shared');

const SORT_COLUMNS = {
  created_at: 'r.created_at',
  name: 'r.name',
  capacity: 'r.capacity',
  floor: 'r.floor',
  type: 'r.type',
  is_active: 'r.is_active',
};

const SELECT_COLUMNS = `
  r.id, r.uuid, r.building_id, r.name, r.floor, r.capacity, r.type, r.equipment,
  r.is_active, r.created_at, r.updated_at,
  b.code AS building_code, b.name AS building_name, b.is_active AS building_is_active,
  (SELECT COUNT(*) FROM room_closures rc WHERE rc.room_id = r.id) AS closure_count
`;

const CLOSURE_COLUMNS = `
  rc.id, rc.uuid, rc.room_id, rc.start_date, rc.end_date, rc.start_time, rc.end_time,
  rc.reason, rc.created_by, rc.created_at, rc.updated_at
`;

function toPublicRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    buildingId: row.building_id,
    building: row.building_id
      ? { id: row.building_id, code: row.building_code, name: row.building_name, isActive: Boolean(row.building_is_active) }
      : null,
    name: row.name,
    floor: row.floor,
    capacity: row.capacity,
    type: row.type,
    equipment: row.equipment,
    isActive: Boolean(row.is_active),
    closureCount: Number(row.closure_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublicClosure(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    roomId: row.room_id,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
    startTime: row.start_time,
    endTime: row.end_time,
    isFullDay: !row.start_time || !row.end_time,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validationError(details) {
  return ApiError.badRequest('Validation failed.', { code: 'VALIDATION_ERROR', details });
}

function buildWhere(query) {
  const clauses = [];
  const params = [];
  if (query.search) {
    const like = `%${query.search}%`;
    clauses.push('(r.name LIKE ? OR r.equipment LIKE ? OR b.name LIKE ? OR b.code LIKE ?)');
    params.push(like, like, like, like);
  }
  if (query.buildingId) {
    clauses.push('r.building_id = ?');
    params.push(query.buildingId);
  }
  if (query.type) {
    clauses.push('r.type = ?');
    params.push(query.type);
  }
  if (query.minCapacity !== null && query.minCapacity !== undefined) {
    clauses.push('r.capacity >= ?');
    params.push(query.minCapacity);
  }
  if (query.maxCapacity !== null && query.maxCapacity !== undefined) {
    clauses.push('r.capacity <= ?');
    params.push(query.maxCapacity);
  }
  if (query.isActive !== null && query.isActive !== undefined) {
    clauses.push('r.is_active = ?');
    params.push(query.isActive ? 1 : 0);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function listRooms(query) {
  const { where, params } = buildWhere(query);
  const offset = (query.page - 1) * query.limit;
  const column = SORT_COLUMNS[query.sort] || SORT_COLUMNS.name;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database
    .getPool()
    .query(`SELECT COUNT(*) AS total FROM rooms r LEFT JOIN buildings b ON b.id = r.building_id ${where}`, params);
  const total = Number(countRows[0].total);

  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${SELECT_COLUMNS} FROM rooms r LEFT JOIN buildings b ON b.id = r.building_id ${where}
       ORDER BY ${column} ${direction}, r.id ASC LIMIT ? OFFSET ?`,
      [...params, query.limit, offset]
    );

  return { items: rows.map(toPublicRoom), pagination: paginate({ page: query.page, limit: query.limit, total }) };
}

/** Lightweight list for dropdowns (active rooms, optionally by building/type). */
async function listOptions({ buildingId = null, type = null, minCapacity = null } = {}) {
  const clauses = ['r.is_active = 1'];
  const params = [];
  if (buildingId) {
    clauses.push('r.building_id = ?');
    params.push(buildingId);
  }
  if (type) {
    clauses.push('r.type = ?');
    params.push(type);
  }
  if (minCapacity) {
    clauses.push('r.capacity >= ?');
    params.push(minCapacity);
  }
  const [rows] = await database
    .getPool()
    .query(
      `SELECT r.id, r.building_id, r.name, r.capacity, r.type, b.code AS building_code
       FROM rooms r LEFT JOIN buildings b ON b.id = r.building_id
       WHERE ${clauses.join(' AND ')} ORDER BY b.code ASC, r.name ASC`,
      params
    );
  return rows.map((row) => ({
    id: row.id,
    buildingId: row.building_id,
    buildingCode: row.building_code,
    name: row.name,
    capacity: row.capacity,
    type: row.type,
    label: `${row.building_code || ''} ${row.name}`.trim(),
  }));
}

async function getPublicById(id) {
  const [rows] = await database
    .getPool()
    .query(`SELECT ${SELECT_COLUMNS} FROM rooms r LEFT JOIN buildings b ON b.id = r.building_id WHERE r.id = ? LIMIT 1`, [id]);
  return rows[0] ? toPublicRoom(rows[0]) : null;
}

async function findById(id) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, building_id, name, floor, capacity, type, equipment, is_active FROM rooms WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function requireRoom(id) {
  const row = await findById(id);
  if (!row) throw ApiError.notFound('Room not found.', { code: 'ROOM_NOT_FOUND' });
  return row;
}

async function requireActiveBuilding(buildingId) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, code, name, is_active FROM buildings WHERE id = ? LIMIT 1', [buildingId]);
  if (!rows.length) throw validationError([{ field: 'buildingId', message: 'The selected building does not exist.' }]);
  if (!rows[0].is_active) throw validationError([{ field: 'buildingId', message: 'The selected building is inactive.' }]);
  return rows[0];
}

async function assertRoomNumberUnique(buildingId, name, excludeId = null) {
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM rooms WHERE building_id = ? AND name = ? AND (? IS NULL OR id <> ?) LIMIT 1', [
      buildingId,
      name,
      excludeId,
      excludeId,
    ]);
  if (rows.length) {
    throw ApiError.conflict('A room with this number already exists in the selected building.', {
      code: 'DUPLICATE_ROOM_NUMBER',
      details: [{ field: 'name', message: 'This room number is already used in the selected building.' }],
    });
  }
}

async function countExamReferences(roomId) {
  const [rows] = await database.getPool().query('SELECT COUNT(*) AS total FROM exam_schedule_details WHERE room_id = ?', [roomId]);
  return Number(rows[0].total);
}

async function createRoom(input, actor, meta) {
  await requireActiveBuilding(input.buildingId);
  await assertRoomNumberUnique(input.buildingId, input.name);

  let insertId;
  try {
    const [result] = await database
      .getPool()
      .query('INSERT INTO rooms (building_id, name, floor, capacity, type, equipment, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        input.buildingId,
        input.name,
        input.floor,
        input.capacity,
        input.type,
        input.equipment,
        Number(input.isActive),
      ]);
    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A room with this number already exists in the selected building.', { code: 'DUPLICATE_ROOM_NUMBER' });
    }
    throw error;
  }

  const created = await getPublicById(insertId);
  await auditService.record({
    userId: actor.id,
    action: 'room.create',
    entityType: 'room',
    entityId: insertId,
    after: { buildingId: created.buildingId, name: created.name },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return created;
}

const UPDATE_COLUMNS = {
  buildingId: 'building_id',
  name: 'name',
  floor: 'floor',
  capacity: 'capacity',
  type: 'type',
  equipment: 'equipment',
  isActive: 'is_active',
};

async function updateRoom(id, input, actor, meta) {
  const before = await requireRoom(id);

  const effectiveBuildingId = input.buildingId !== undefined ? input.buildingId : before.building_id;
  if (input.buildingId !== undefined) await requireActiveBuilding(effectiveBuildingId);
  const effectiveName = input.name !== undefined ? input.name : before.name;
  if (input.name !== undefined || input.buildingId !== undefined) {
    await assertRoomNumberUnique(effectiveBuildingId, effectiveName, id);
  }

  const sets = [];
  const params = [];
  Object.entries(UPDATE_COLUMNS).forEach(([key, column]) => {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(typeof input[key] === 'boolean' ? Number(input[key]) : input[key]);
    }
  });
  if (sets.length === 0) return getPublicById(id);
  sets.push('updated_at = NOW()');
  params.push(id);

  try {
    await database.getPool().query(`UPDATE rooms SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A room with this number already exists in the selected building.', { code: 'DUPLICATE_ROOM_NUMBER' });
    }
    throw error;
  }

  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: 'room.update',
    entityType: 'room',
    entityId: id,
    before: { buildingId: before.building_id, name: before.name },
    after: { buildingId: updated.buildingId, name: updated.name },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function setRoomStatus(id, isActive, actor, meta) {
  const before = await requireRoom(id);
  await database.getPool().query('UPDATE rooms SET is_active = ?, updated_at = NOW() WHERE id = ?', [Number(isActive), id]);
  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: isActive ? 'room.activate' : 'room.deactivate',
    entityType: 'room',
    entityId: id,
    before: { isActive: Boolean(before.is_active) },
    after: { isActive: updated.isActive },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function deleteRoom(id, actor, meta) {
  const before = await requireRoom(id);
  const references = await countExamReferences(id);
  if (references > 0) {
    throw ApiError.conflict('This room cannot be deleted while examination records reference it. Deactivate it instead.', {
      code: 'ROOM_IN_USE',
      details: [{ field: 'id', message: `${references} examination record(s) reference this room.` }],
    });
  }

  await database.getPool().query('DELETE FROM rooms WHERE id = ?', [id]);
  await auditService.record({
    userId: actor.id,
    action: 'room.delete',
    entityType: 'room',
    entityId: id,
    before: { buildingId: before.building_id, name: before.name },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return { id };
}

// ---------------------------------------------------------------------------
// Room closures
// ---------------------------------------------------------------------------

async function listClosures(roomId) {
  await requireRoom(roomId);
  const [rows] = await database
    .getPool()
    .query(`SELECT ${CLOSURE_COLUMNS} FROM room_closures rc WHERE rc.room_id = ? ORDER BY rc.start_date ASC, rc.start_time ASC`, [roomId]);
  return rows.map(toPublicClosure);
}

async function findClosureRow(roomId, closureId) {
  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${CLOSURE_COLUMNS} FROM room_closures rc WHERE rc.id = ? AND rc.room_id = ? LIMIT 1`,
      [closureId, roomId]
    );
  return rows[0] || null;
}

async function requireClosure(roomId, closureId) {
  const row = await findClosureRow(roomId, closureId);
  if (!row) throw ApiError.notFound('Room closure not found.', { code: 'CLOSURE_NOT_FOUND' });
  return row;
}

function datesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

function closureWindowOverlaps(candidate, existing) {
  const candidateFullDay = !candidate.startTime || !candidate.endTime;
  const existingFullDay = !existing.start_time || !existing.end_time;
  if (candidateFullDay || existingFullDay) return true;
  const aStart = timeToMinutes(candidate.startTime);
  const aEnd = timeToMinutes(candidate.endTime);
  const bStart = timeToMinutes(existing.start_time);
  const bEnd = timeToMinutes(existing.end_time);
  // Half-open [start, end): touching windows do not overlap.
  return aStart < bEnd && bStart < aEnd;
}

async function assertNoClosureOverlap(roomId, candidate, excludeId = null) {
  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${CLOSURE_COLUMNS} FROM room_closures rc WHERE rc.room_id = ? AND (? IS NULL OR rc.id <> ?)`,
      [roomId, excludeId, excludeId]
    );
  const candidateStart = toDateString(candidate.startDate);
  const candidateEnd = toDateString(candidate.endDate);
  const clash = rows.find(
    (row) =>
      datesOverlap(candidateStart, candidateEnd, toDateString(row.start_date), toDateString(row.end_date)) &&
      closureWindowOverlaps(candidate, row)
  );
  if (clash) {
    throw ApiError.conflict('This closure overlaps an existing closure for the room.', {
      code: 'CLOSURE_OVERLAP',
      details: [{ field: 'startDate', message: 'The closure overlaps an existing closure for this room.' }],
    });
  }
}

async function createClosure(roomId, input, actor, meta) {
  await requireRoom(roomId);
  const closure = { startDate: input.startDate, endDate: input.endDate, startTime: input.startTime, endTime: input.endTime };
  await assertNoClosureOverlap(roomId, closure);

  const [result] = await database
    .getPool()
    .query(
      'INSERT INTO room_closures (room_id, start_date, end_date, start_time, end_time, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [roomId, input.startDate, input.endDate, input.startTime, input.endTime, input.reason, actor.id]
    );

  const created = toPublicClosure(await findClosureRow(roomId, result.insertId));
  await auditService.record({
    userId: actor.id,
    action: 'room.closure.create',
    entityType: 'room_closure',
    entityId: result.insertId,
    after: { roomId, startDate: created.startDate, endDate: created.endDate },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return created;
}

async function updateClosure(roomId, closureId, input, actor, meta) {
  await requireRoom(roomId);
  const before = await requireClosure(roomId, closureId);

  const effective = {
    startDate: input.startDate !== undefined ? input.startDate : toDateString(before.start_date),
    endDate: input.endDate !== undefined ? input.endDate : toDateString(before.end_date),
    startTime: input.startTime !== undefined ? input.startTime : before.start_time,
    endTime: input.endTime !== undefined ? input.endTime : before.end_time,
  };

  if (effective.endDate < effective.startDate) {
    throw validationError([{ field: 'endDate', message: 'The end date cannot be earlier than the start date.' }]);
  }
  const hasStart = Boolean(effective.startTime);
  const hasEnd = Boolean(effective.endTime);
  if (hasStart !== hasEnd) {
    throw validationError([{ field: 'endTime', message: 'Provide both a start and end time, or leave both empty for a full-day closure.' }]);
  }
  if (hasStart && effective.endTime <= effective.startTime) {
    throw validationError([{ field: 'endTime', message: 'The end time must be after the start time.' }]);
  }

  await assertNoClosureOverlap(roomId, effective, closureId);

  const sets = [];
  const params = [];
  const map = { startDate: 'start_date', endDate: 'end_date', startTime: 'start_time', endTime: 'end_time', reason: 'reason' };
  Object.entries(map).forEach(([key, column]) => {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(input[key]);
    }
  });
  if (sets.length === 0) return toPublicClosure(before);
  sets.push('updated_at = NOW()');
  params.push(closureId);

  await database.getPool().query(`UPDATE room_closures SET ${sets.join(', ')} WHERE id = ?`, params);
  const updated = toPublicClosure(await findClosureRow(roomId, closureId));
  await auditService.record({
    userId: actor.id,
    action: 'room.closure.update',
    entityType: 'room_closure',
    entityId: closureId,
    before: { startDate: toDateString(before.start_date), endDate: toDateString(before.end_date) },
    after: { startDate: updated.startDate, endDate: updated.endDate },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function deleteClosure(roomId, closureId, actor, meta) {
  await requireRoom(roomId);
  const before = await requireClosure(roomId, closureId);
  await database.getPool().query('DELETE FROM room_closures WHERE id = ?', [closureId]);
  await auditService.record({
    userId: actor.id,
    action: 'room.closure.delete',
    entityType: 'room_closure',
    entityId: closureId,
    before: { roomId, startDate: toDateString(before.start_date), endDate: toDateString(before.end_date) },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return { id: closureId };
}

/**
 * Returns the first closure that blocks `[startTime, endTime)` on `date`, or
 * null when the room is open. `startTime`/`endTime` are optional: when omitted
 * any same-day closure blocks the room.
 */
async function findBlockingClosure(roomId, date, startTime = null, endTime = null) {
  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${CLOSURE_COLUMNS} FROM room_closures rc
       WHERE rc.room_id = ? AND rc.start_date <= ? AND rc.end_date >= ?
       ORDER BY rc.start_date ASC LIMIT 50`,
      [roomId, date, date]
    );
  return (
    rows.find((row) => {
      if (!row.start_time || !row.end_time) return true;
      if (startTime === null || endTime === null) return true;
      const aStart = timeToMinutes(startTime);
      const aEnd = timeToMinutes(endTime);
      const bStart = timeToMinutes(row.start_time);
      const bEnd = timeToMinutes(row.end_time);
      return aStart < bEnd && bStart < aEnd;
    }) || null
  );
}

module.exports = {
  listRooms,
  listOptions,
  getPublicById,
  findById,
  requireRoom,
  createRoom,
  updateRoom,
  setRoomStatus,
  deleteRoom,
  countExamReferences,
  listClosures,
  createClosure,
  updateClosure,
  deleteClosure,
  findBlockingClosure,
};
