'use strict';

/**
 * Time slot management (Phase 4 — scheduling resources, completed for Phase 5).
 *
 * Reuses the existing `time_slots` table (label, start_time, end_time,
 * order_index, is_active). Slots are global time windows: no two ACTIVE slots
 * may overlap (half-open [start, end)), the start must be before the end, and
 * a delete is refused while any examination schedule detail references the slot.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { paginate, timeToMinutes } = require('../validators/shared');

const SORT_COLUMNS = {
  created_at: 'ts.created_at',
  label: 'ts.label',
  start_time: 'ts.start_time',
  end_time: 'ts.end_time',
  order_index: 'ts.order_index',
  is_active: 'ts.is_active',
};

const SELECT_COLUMNS = `
  ts.id, ts.uuid, ts.label, ts.start_time, ts.end_time, ts.order_index, ts.is_active,
  ts.created_at, ts.updated_at
`;

function durationMinutes(row) {
  if (!row.start_time || !row.end_time) return 0;
  const diff = timeToMinutes(row.end_time) - timeToMinutes(row.start_time);
  return Number.isNaN(diff) ? 0 : Math.max(0, diff);
}

function toPublicTimeSlot(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    label: row.label,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: durationMinutes(row),
    orderIndex: row.order_index,
    isActive: Boolean(row.is_active),
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
    clauses.push('ts.label LIKE ?');
    params.push(like);
  }
  if (query.isActive !== null && query.isActive !== undefined) {
    clauses.push('ts.is_active = ?');
    params.push(query.isActive ? 1 : 0);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function listTimeSlots(query) {
  const { where, params } = buildWhere(query);
  const offset = (query.page - 1) * query.limit;
  const column = SORT_COLUMNS[query.sort] || SORT_COLUMNS.order_index;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database.getPool().query(`SELECT COUNT(*) AS total FROM time_slots ts ${where}`, params);
  const total = Number(countRows[0].total);

  const [rows] = await database
    .getPool()
    .query(`SELECT ${SELECT_COLUMNS} FROM time_slots ts ${where} ORDER BY ${column} ${direction}, ts.id ASC LIMIT ? OFFSET ?`, [
      ...params,
      query.limit,
      offset,
    ]);

  return { items: rows.map(toPublicTimeSlot), pagination: paginate({ page: query.page, limit: query.limit, total }) };
}

/** Active slots ordered by order_index (used by the scheduling engine). */
async function listActive() {
  const [rows] = await database
    .getPool()
    .query(`SELECT ${SELECT_COLUMNS} FROM time_slots ts WHERE ts.is_active = 1 ORDER BY ts.order_index ASC, ts.start_time ASC`);
  return rows.map(toPublicTimeSlot);
}

async function getPublicById(id) {
  const [rows] = await database.getPool().query(`SELECT ${SELECT_COLUMNS} FROM time_slots ts WHERE ts.id = ? LIMIT 1`, [id]);
  return rows[0] ? toPublicTimeSlot(rows[0]) : null;
}

async function findById(id) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, label, start_time, end_time, order_index, is_active FROM time_slots WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function requireTimeSlot(id) {
  const row = await findById(id);
  if (!row) throw ApiError.notFound('Time slot not found.', { code: 'TIME_SLOT_NOT_FOUND' });
  return row;
}

/** Half-open overlap: [aStart, aEnd) and [bStart, bEnd) clash when neither ends before the other starts. */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

async function assertNoOverlap(candidate, excludeId = null) {
  const [rows] = await database
    .getPool()
    .query(
      'SELECT id, start_time, end_time FROM time_slots WHERE (? IS NULL OR id <> ?)',
      [excludeId, excludeId]
    );
  const aStart = timeToMinutes(candidate.startTime);
  const aEnd = timeToMinutes(candidate.endTime);
  const clash = rows.find((row) => overlaps(aStart, aEnd, timeToMinutes(row.start_time), timeToMinutes(row.end_time)));
  if (clash) {
    throw ApiError.conflict('This time slot overlaps an existing time slot.', {
      code: 'TIME_SLOT_OVERLAP',
      details: [{ field: 'startTime', message: `The slot overlaps the existing slot "${clash.id}".` }],
    });
  }
}

async function countExamReferences(slotId) {
  const [rows] = await database
    .getPool()
    .query('SELECT COUNT(*) AS total FROM exam_schedule_details WHERE time_slot_id = ?', [slotId]);
  return Number(rows[0].total);
}

async function createTimeSlot(input, actor, meta) {
  await assertNoOverlap({ startTime: input.startTime, endTime: input.endTime });

  let insertId;
  try {
    const [result] = await database
      .getPool()
      .query('INSERT INTO time_slots (label, start_time, end_time, order_index, is_active) VALUES (?, ?, ?, ?, ?)', [
        input.label,
        input.startTime,
        input.endTime,
        input.orderIndex,
        Number(input.isActive),
      ]);
    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A time slot with these times already exists.', { code: 'DUPLICATE_TIME_SLOT' });
    }
    throw error;
  }

  const created = await getPublicById(insertId);
  await auditService.record({
    userId: actor.id,
    action: 'time_slot.create',
    entityType: 'time_slot',
    entityId: insertId,
    after: { label: created.label, startTime: created.startTime, endTime: created.endTime },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return created;
}

async function updateTimeSlot(id, input, actor, meta) {
  const before = await requireTimeSlot(id);

  const effectiveStart = input.startTime !== undefined ? input.startTime : before.start_time;
  const effectiveEnd = input.endTime !== undefined ? input.endTime : before.end_time;
  if (input.startTime !== undefined || input.endTime !== undefined) {
    await assertNoOverlap({ startTime: effectiveStart, endTime: effectiveEnd }, id);
  }

  const sets = [];
  const params = [];
  const map = { label: 'label', startTime: 'start_time', endTime: 'end_time', orderIndex: 'order_index', isActive: 'is_active' };
  Object.entries(map).forEach(([key, column]) => {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(typeof input[key] === 'boolean' ? Number(input[key]) : input[key]);
    }
  });
  if (sets.length === 0) return getPublicById(id);
  sets.push('updated_at = NOW()');
  params.push(id);

  try {
    await database.getPool().query(`UPDATE time_slots SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A time slot with these times already exists.', { code: 'DUPLICATE_TIME_SLOT' });
    }
    throw error;
  }

  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: 'time_slot.update',
    entityType: 'time_slot',
    entityId: id,
    before: { label: before.label, startTime: before.start_time, endTime: before.end_time },
    after: { label: updated.label, startTime: updated.startTime, endTime: updated.endTime },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function setTimeSlotStatus(id, isActive, actor, meta) {
  const before = await requireTimeSlot(id);
  await database.getPool().query('UPDATE time_slots SET is_active = ?, updated_at = NOW() WHERE id = ?', [Number(isActive), id]);
  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: isActive ? 'time_slot.activate' : 'time_slot.deactivate',
    entityType: 'time_slot',
    entityId: id,
    before: { isActive: Boolean(before.is_active) },
    after: { isActive: updated.isActive },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function deleteTimeSlot(id, actor, meta) {
  const before = await requireTimeSlot(id);
  const references = await countExamReferences(id);
  if (references > 0) {
    throw ApiError.conflict('This time slot cannot be deleted while examination records reference it. Deactivate it instead.', {
      code: 'TIME_SLOT_IN_USE',
      details: [{ field: 'id', message: `${references} examination record(s) reference this time slot.` }],
    });
  }

  await database.getPool().query('DELETE FROM time_slots WHERE id = ?', [id]);
  await auditService.record({
    userId: actor.id,
    action: 'time_slot.delete',
    entityType: 'time_slot',
    entityId: id,
    before: { label: before.label, startTime: before.start_time, endTime: before.end_time },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return { id };
}

module.exports = {
  listTimeSlots,
  listActive,
  getPublicById,
  findById,
  requireTimeSlot,
  createTimeSlot,
  updateTimeSlot,
  setTimeSlotStatus,
  deleteTimeSlot,
  countExamReferences,
};