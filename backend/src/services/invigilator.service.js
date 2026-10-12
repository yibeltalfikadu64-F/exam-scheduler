'use strict';

/**
 * Invigilator management (Phase 6).
 *
 * An invigilator is a profile of an existing staff `users` account (no separate
 * login). Reuses `invigilators`, `invigilator_availability` and the shared
 * `users` / `instructors` / `departments` tables.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { assertDepartmentScope } = require('./scope');
const { paginate, timeToMinutes } = require('../validators/shared');

const SORT_COLUMNS = {
  created_at: 'i.created_at',
  staff_identifier: 'i.staff_identifier',
  full_name: 'u.full_name',
  is_active: 'i.is_active',
};

const SELECT_COLUMNS = `
  i.id, i.uuid, i.user_id, i.instructor_id, i.staff_identifier, i.department_id, i.phone, i.qualification,
  i.max_duties_per_day, i.max_duties_per_period, i.is_active, i.notes, i.created_at, i.updated_at,
  u.full_name, u.username, u.email, u.role, u.is_active AS user_is_active,
  d.code AS department_code, d.name AS department_name,
  (SELECT COUNT(*) FROM invigilator_availability a WHERE a.invigilator_id = i.id) AS availability_count
`;

function toPublicInvigilator(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    staffIdentifier: row.staff_identifier,
    phone: row.phone,
    qualification: row.qualification,
    maxDutiesPerDay: row.max_duties_per_day,
    maxDutiesPerPeriod: row.max_duties_per_period,
    isActive: Boolean(row.is_active),
    notes: row.notes,
    user: row.user_id
      ? { id: row.user_id, fullName: row.full_name, username: row.username, email: row.email, role: row.role, isActive: Boolean(row.user_is_active) }
      : null,
    instructorId: row.instructor_id,
    department: row.department_id ? { id: row.department_id, code: row.department_code, name: row.department_name } : null,
    availabilityCount: Number(row.availability_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validationError(details) {
  return ApiError.badRequest('Validation failed.', { code: 'VALIDATION_ERROR', details });
}

function buildWhere(query, actor) {
  const clauses = [];
  const params = [];
  if (query.search) {
    const like = `%${query.search}%`;
    clauses.push('(i.staff_identifier LIKE ? OR u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)');
    params.push(like, like, like, like);
  }
  if (query.departmentId) {
    clauses.push('i.department_id = ?');
    params.push(query.departmentId);
  }
  if (query.isActive !== null && query.isActive !== undefined) {
    clauses.push('i.is_active = ?');
    params.push(query.isActive ? 1 : 0);
  }
  if (actor && actor.role === 'department_head') {
    clauses.push('i.department_id = ?');
    params.push(actor.departmentId || 0);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function listInvigilators(query, actor) {
  const { where, params } = buildWhere(query, actor);
  const offset = (query.page - 1) * query.limit;
  const column = SORT_COLUMNS[query.sort] || SORT_COLUMNS.created_at;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database
    .getPool()
    .query(`SELECT COUNT(*) AS total FROM invigilators i LEFT JOIN users u ON u.id = i.user_id ${where}`, params);
  const total = Number(countRows[0].total);

  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${SELECT_COLUMNS} FROM invigilators i LEFT JOIN users u ON u.id = i.user_id LEFT JOIN departments d ON d.id = i.department_id ${where} ORDER BY ${column} ${direction}, i.id ASC LIMIT ? OFFSET ?`,
      [...params, query.limit, offset]
    );

  return { items: rows.map(toPublicInvigilator), pagination: paginate({ page: query.page, limit: query.limit, total }) };
}

async function listOptions(departmentId = null) {
  const clauses = ['i.is_active = 1', 'u.is_active = 1', 'u.deleted_at IS NULL'];
  const params = [];
  if (departmentId) {
    clauses.push('i.department_id = ?');
    params.push(departmentId);
  }
  const [rows] = await database
    .getPool()
    .query(
      `SELECT i.id, i.staff_identifier, i.user_id, u.full_name, d.code AS department_code
       FROM invigilators i JOIN users u ON u.id = i.user_id LEFT JOIN departments d ON d.id = i.department_id
       WHERE ${clauses.join(' AND ')} ORDER BY u.full_name ASC`,
      params
    );
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    staffIdentifier: row.staff_identifier,
    fullName: row.full_name,
    departmentCode: row.department_code,
  }));
}

async function getPublicById(id) {
  const [rows] = await database
    .getPool()
    .query(`SELECT ${SELECT_COLUMNS} FROM invigilators i LEFT JOIN users u ON u.id = i.user_id LEFT JOIN departments d ON d.id = i.department_id WHERE i.id = ? LIMIT 1`, [id]);
  return rows[0] ? toPublicInvigilator(rows[0]) : null;
}

async function findById(id) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, user_id, instructor_id, staff_identifier, department_id, is_active, max_duties_per_day, max_duties_per_period FROM invigilators WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function requireInvigilator(id) {
  const row = await findById(id);
  if (!row) throw ApiError.notFound('Invigilator not found.', { code: 'INVIGILATOR_NOT_FOUND' });
  return row;
}

const STAFF_ROLES = ['admin', 'registrar', 'department_head', 'instructor'];

async function requireEligibleUser(userId, excludeInvigilatorId = null) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, full_name, role, department_id, is_active, deleted_at FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!rows.length || rows[0].deleted_at) throw validationError([{ field: 'userId', message: 'The selected user does not exist.' }]);
  const user = rows[0];
  if (!STAFF_ROLES.includes(user.role)) {
    throw validationError([{ field: 'userId', message: 'Only staff accounts (not students) can be invigilators.' }]);
  }
  const [existing] = await database
    .getPool()
    .query('SELECT id FROM invigilators WHERE user_id = ? AND (? IS NULL OR id <> ?) LIMIT 1', [userId, excludeInvigilatorId, excludeInvigilatorId]);
  if (existing.length) {
    throw ApiError.conflict('This user already has an invigilator profile.', {
      code: 'DUPLICATE_INVIGILATOR_USER',
      details: [{ field: 'userId', message: 'This user already has an invigilator profile.' }],
    });
  }
  return user;
}

async function requireDepartment(departmentId) {
  if (departmentId === null || departmentId === undefined) return null;
  const [rows] = await database.getPool().query('SELECT id, code, name FROM departments WHERE id = ? LIMIT 1', [departmentId]);
  if (!rows.length) throw validationError([{ field: 'departmentId', message: 'The selected department does not exist.' }]);
  return rows[0];
}

async function assertStaffIdentifierFree(staffIdentifier, excludeId = null) {
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM invigilators WHERE staff_identifier = ? AND (? IS NULL OR id <> ?) LIMIT 1', [staffIdentifier, excludeId, excludeId]);
  if (rows.length) {
    throw ApiError.conflict('An invigilator with this staff identifier already exists.', {
      code: 'DUPLICATE_STAFF_IDENTIFIER',
      details: [{ field: 'staffIdentifier', message: 'This staff identifier is already in use.' }],
    });
  }
}

/** Link the instructor profile for a user, when one exists. */
async function resolveInstructorId(userId, explicitInstructorId = undefined) {
  if (explicitInstructorId === null || explicitInstructorId === undefined) {
    const [rows] = await database.getPool().query('SELECT id FROM instructors WHERE user_id = ? LIMIT 1', [userId]);
    return rows.length ? rows[0].id : null;
  }
  const [rows] = await database.getPool().query('SELECT id, user_id FROM instructors WHERE id = ? LIMIT 1', [explicitInstructorId]);
  if (!rows.length) throw validationError([{ field: 'instructorId', message: 'The selected instructor does not exist.' }]);
  if (Number(rows[0].user_id) !== Number(userId)) {
    throw validationError([{ field: 'instructorId', message: 'The instructor profile does not belong to the selected user.' }]);
  }
  return rows[0].id;
}

async function createInvigilator(input, actor, meta) {
  const user = await requireEligibleUser(input.userId);
  const departmentId = input.departmentId !== undefined ? input.departmentId : user.department_id;
  assertDepartmentScope(actor, departmentId);
  await requireDepartment(departmentId);
  await assertStaffIdentifierFree(input.staffIdentifier);
  const instructorId = await resolveInstructorId(input.userId, input.instructorId);

  let insertId;
  try {
    const [result] = await database.getPool().query(
      `INSERT INTO invigilators
         (user_id, instructor_id, staff_identifier, department_id, phone, qualification, max_duties_per_day, max_duties_per_period, is_active, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.userId,
        instructorId,
        input.staffIdentifier,
        departmentId,
        input.phone !== undefined ? input.phone : null,
        input.qualification !== undefined ? input.qualification : null,
        input.maxDutiesPerDay !== undefined ? input.maxDutiesPerDay : null,
        input.maxDutiesPerPeriod !== undefined ? input.maxDutiesPerPeriod : null,
        input.isActive === undefined ? 1 : Number(input.isActive),
        input.notes !== undefined ? input.notes : null,
        actor.id,
      ]
    );
    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('An invigilator with these unique details already exists.', { code: 'DUPLICATE_INVIGILATOR' });
    }
    throw error;
  }

  const created = await getPublicById(insertId);
  await auditService.record({
    userId: actor.id,
    action: 'invigilator.create',
    entityType: 'invigilator',
    entityId: insertId,
    after: { userId: input.userId, staffIdentifier: input.staffIdentifier },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return created;
}

const UPDATE_COLUMNS = {
  staffIdentifier: 'staff_identifier',
  departmentId: 'department_id',
  phone: 'phone',
  qualification: 'qualification',
  maxDutiesPerDay: 'max_duties_per_day',
  maxDutiesPerPeriod: 'max_duties_per_period',
  isActive: 'is_active',
  notes: 'notes',
  instructorId: 'instructor_id',
};

async function updateInvigilator(id, input, actor, meta) {
  const before = await requireInvigilator(id);
  assertDepartmentScope(actor, before.department_id);
  if (input.staffIdentifier !== undefined) await assertStaffIdentifierFree(input.staffIdentifier, id);
  if (input.departmentId !== undefined) {
    assertDepartmentScope(actor, input.departmentId);
    await requireDepartment(input.departmentId);
  }
  if (input.instructorId !== undefined) {
    input = { ...input, instructorId: await resolveInstructorId(before.user_id, input.instructorId) };
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
    await database.getPool().query(`UPDATE invigilators SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('An invigilator with these unique details already exists.', { code: 'DUPLICATE_INVIGILATOR' });
    }
    throw error;
  }

  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: 'invigilator.update',
    entityType: 'invigilator',
    entityId: id,
    before: { staffIdentifier: before.staff_identifier, isActive: Boolean(before.is_active) },
    after: { staffIdentifier: updated.staffIdentifier, isActive: updated.isActive },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function setInvigilatorStatus(id, isActive, actor, meta) {
  const before = await requireInvigilator(id);
  assertDepartmentScope(actor, before.department_id);
  await database.getPool().query('UPDATE invigilators SET is_active = ?, updated_at = NOW() WHERE id = ?', [Number(isActive), id]);
  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: isActive ? 'invigilator.activate' : 'invigilator.deactivate',
    entityType: 'invigilator',
    entityId: id,
    before: { isActive: Boolean(before.is_active) },
    after: { isActive: updated.isActive },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function countDuties(invigilatorId) {
  const [rows] = await database
    .getPool()
    .query("SELECT COUNT(*) AS total FROM invigilations WHERE invigilator_id = ? AND status <> 'cancelled'", [invigilatorId]);
  return Number(rows[0].total);
}

async function deleteInvigilator(id, actor, meta) {
  const before = await requireInvigilator(id);
  assertDepartmentScope(actor, before.department_id);
  const duties = await countDuties(id);
  if (duties > 0) {
    throw ApiError.conflict('This invigilator has duty assignments and cannot be deleted. Deactivate them instead.', {
      code: 'INVIGILATOR_HAS_DUTIES',
      details: [{ field: 'id', message: `${duties} duty assignment(s) reference this invigilator.` }],
    });
  }
  await database.getPool().query('DELETE FROM invigilators WHERE id = ?', [id]);
  await auditService.record({
    userId: actor.id,
    action: 'invigilator.delete',
    entityType: 'invigilator',
    entityId: id,
    before: { staffIdentifier: before.staff_identifier },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return { id };
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

async function listAvailability(invigilatorId) {
  await requireInvigilator(invigilatorId);
  const [rows] = await database
    .getPool()
    .query('SELECT * FROM invigilator_availability WHERE invigilator_id = ? ORDER BY day_of_week ASC, start_time ASC', [invigilatorId]);
  return rows.map((row) => ({
    id: row.id,
    uuid: row.uuid,
    dayOfWeek: Number(row.day_of_week),
    startTime: row.start_time,
    endTime: row.end_time,
    isAvailable: Boolean(row.is_available),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    note: row.note,
  }));
}

async function replaceAvailability(invigilatorId, windows, actor, meta) {
  await requireInvigilator(invigilatorId);
  const normalized = [];
  const seen = new Set();
  windows.forEach((window, index) => {
    const day = Number(window.dayOfWeek);
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      throw validationError([{ field: `windows[${index}].dayOfWeek`, message: 'dayOfWeek must be between 1 (Monday) and 7 (Sunday).' }]);
    }
    const start = timeToMinutes(window.startTime);
    const end = timeToMinutes(window.endTime);
    if (start === null || Number.isNaN(start) || end === null || Number.isNaN(end) || start >= end) {
      throw validationError([{ field: `windows[${index}]`, message: 'Each window needs a valid startTime before endTime.' }]);
    }
    const key = `${day}|${window.startTime}|${window.endTime}`;
    if (seen.has(key)) {
      throw validationError([{ field: `windows[${index}]`, message: 'Duplicate availability window.' }]);
    }
    seen.add(key);
    normalized.push({
      dayOfWeek: day,
      startTime: window.startTime,
      endTime: window.endTime,
      isAvailable: window.isAvailable === undefined ? true : window.isAvailable,
      effectiveFrom: window.effectiveFrom !== undefined ? window.effectiveFrom : null,
      effectiveTo: window.effectiveTo !== undefined ? window.effectiveTo : null,
      note: window.note !== undefined ? window.note : null,
    });
  });

  return database.withTransaction(async (conn) => {
    await conn.query('DELETE FROM invigilator_availability WHERE invigilator_id = ?', [invigilatorId]);
    if (normalized.length) {
      const values = normalized.map((window) => [
        invigilatorId,
        window.dayOfWeek,
        window.startTime,
        window.endTime,
        Number(window.isAvailable),
        window.effectiveFrom,
        window.effectiveTo,
        window.note,
      ]);
      await conn.query(
        `INSERT INTO invigilator_availability (invigilator_id, day_of_week, start_time, end_time, is_available, effective_from, effective_to, note) VALUES ?`,
        [values]
      );
    }
    await auditService.record({
      userId: actor.id,
      action: 'invigilator.availability.update',
      entityType: 'invigilator',
      entityId: invigilatorId,
      after: { windows: normalized.length },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return listAvailability(invigilatorId);
  });
}

module.exports = {
  listInvigilators,
  listOptions,
  getPublicById,
  findById,
  requireInvigilator,
  createInvigilator,
  updateInvigilator,
  setInvigilatorStatus,
  deleteInvigilator,
  listAvailability,
  replaceAvailability,
};
