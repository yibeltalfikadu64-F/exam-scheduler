'use strict';

/**
 * Instructor management (Phase 3, module 5).
 * Reuses the existing `instructors` table (a profile extension of `users`).
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { assertDepartmentScope } = require('./scope');
const { paginate } = require('../validators/shared');

const SORT_COLUMNS = {
  created_at: 'i.created_at',
  staff_number: 'i.staff_number',
  max_load_hours: 'i.max_load_hours',
  is_active: 'i.is_active',
};

const SELECT_COLUMNS = `
  i.id, i.uuid, i.user_id, i.staff_number, i.department_id, i.title, i.expertise, i.max_load_hours,
  i.is_active, i.created_at, i.updated_at,
  u.full_name AS user_full_name, u.username AS user_username, u.email AS user_email,
  d.code AS department_code, d.name AS department_name
`;

function toPublicInstructor(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    staffNumber: row.staff_number,
    title: row.title,
    expertise: row.expertise,
    maxLoadHours: row.max_load_hours,
    isActive: Boolean(row.is_active),
    user: row.user_id
      ? { id: row.user_id, fullName: row.user_full_name, username: row.user_username, email: row.user_email }
      : null,
    department: row.department_id
      ? { id: row.department_id, code: row.department_code, name: row.department_name }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validationError(details) {
  return ApiError.badRequest('Validation failed.', { code: 'VALIDATION_ERROR', details });
}

async function listInstructors(query) {
  const clauses = [];
  const params = [];
  if (query.search) {
    const like = `%${query.search}%`;
    clauses.push('(i.staff_number LIKE ? OR u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR i.title LIKE ?)');
    params.push(like, like, like, like, like);
  }
  if (query.departmentId) {
    clauses.push('i.department_id = ?');
    params.push(query.departmentId);
  }
  if (query.isActive !== null && query.isActive !== undefined) {
    clauses.push('i.is_active = ?');
    params.push(query.isActive ? 1 : 0);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;
  const column = SORT_COLUMNS[query.sort] || SORT_COLUMNS.staff_number;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database.getPool().query(`SELECT COUNT(*) AS total FROM instructors i LEFT JOIN users u ON u.id = i.user_id ${where}`, params);
  const total = Number(countRows[0].total);
  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${SELECT_COLUMNS} FROM instructors i LEFT JOIN users u ON u.id = i.user_id LEFT JOIN departments d ON d.id = i.department_id ${where} ORDER BY ${column} ${direction} LIMIT ? OFFSET ?`,
      [...params, query.limit, offset]
    );

  return { items: rows.map(toPublicInstructor), pagination: paginate({ page: query.page, limit: query.limit, total }) };
}

async function listOptions(departmentId = null) {
  const clauses = ['i.is_active = 1'];
  const params = [];
  if (departmentId) {
    clauses.push('i.department_id = ?');
    params.push(departmentId);
  }
  const [rows] = await database.getPool().query(
    `SELECT i.id, i.staff_number, i.user_id, u.full_name FROM instructors i LEFT JOIN users u ON u.id = i.user_id WHERE ${clauses.join(' AND ')} ORDER BY u.full_name ASC`,
    params
  );
  return rows.map((row) => ({ id: row.id, userId: row.user_id, staffNumber: row.staff_number, fullName: row.full_name }));
}

async function getInstructorById(id) {
  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${SELECT_COLUMNS} FROM instructors i LEFT JOIN users u ON u.id = i.user_id LEFT JOIN departments d ON d.id = i.department_id WHERE i.id = ? LIMIT 1`,
      [id]
    );
  return rows[0] ? toPublicInstructor(rows[0]) : null;
}

async function findInstructorById(id) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, user_id, staff_number, department_id, title, expertise, max_load_hours, is_active FROM instructors WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function requireInstructor(id) {
  const row = await findInstructorById(id);
  if (!row) throw ApiError.notFound('Instructor not found.', { code: 'INSTRUCTOR_NOT_FOUND' });
  return row;
}

async function assertUserIsInstructor(userId) {
  const [rows] = await database.getPool().query('SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [userId]);
  if (!rows.length) throw validationError([{ field: 'userId', message: 'The selected user does not exist.' }]);
  if (rows[0].role !== 'instructor') throw validationError([{ field: 'userId', message: 'The selected user is not an instructor account.' }]);
}

async function assertDepartmentExists(departmentId) {
  if (departmentId === null || departmentId === undefined) return;
  const [rows] = await database.getPool().query('SELECT id FROM departments WHERE id = ? LIMIT 1', [departmentId]);
  if (!rows.length) throw validationError([{ field: 'departmentId', message: 'The selected department does not exist.' }]);
}

async function assertUserFree(userId, excludeId = null) {
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM instructors WHERE user_id = ? AND (? IS NULL OR id <> ?) LIMIT 1', [userId, excludeId, excludeId]);
  if (rows.length) {
    throw ApiError.conflict('This user already has an instructor profile.', {
      code: 'DUPLICATE_INSTRUCTOR_USER',
      details: [{ field: 'userId', message: 'This user already has an instructor profile.' }],
    });
  }
}

async function assertStaffNumberFree(staffNumber, excludeId = null) {
  if (!staffNumber) return;
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM instructors WHERE staff_number = ? AND (? IS NULL OR id <> ?) LIMIT 1', [staffNumber, excludeId, excludeId]);
  if (rows.length) {
    throw ApiError.conflict('An instructor with this staff number already exists.', {
      code: 'DUPLICATE_STAFF_NUMBER',
      details: [{ field: 'staffNumber', message: 'This staff number is already in use.' }],
    });
  }
}

async function createInstructor(input, actor, meta) {
  assertDepartmentScope(actor, input.departmentId);
  await assertUserIsInstructor(input.userId);
  await assertDepartmentExists(input.departmentId);
  await assertUserFree(input.userId);
  await assertStaffNumberFree(input.staffNumber);

  let insertId;
  try {
    const [result] = await database
      .getPool()
      .query('INSERT INTO instructors (user_id, staff_number, department_id, title, expertise, max_load_hours, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        input.userId,
        input.staffNumber,
        input.departmentId,
        input.title,
        input.expertise,
        input.maxLoadHours,
        Number(input.isActive),
      ]);
    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') throw ApiError.conflict('An instructor with these unique details already exists.', { code: 'DUPLICATE_ENTRY' });
    throw error;
  }

  const created = await getInstructorById(insertId);
  await auditService.record({ userId: actor.id, action: 'instructor.create', entityType: 'instructor', entityId: insertId, after: { userId: created.user && created.user.id, staffNumber: created.staffNumber }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return created;
}

const UPDATE_COLUMNS = {
  staffNumber: 'staff_number',
  departmentId: 'department_id',
  title: 'title',
  expertise: 'expertise',
  maxLoadHours: 'max_load_hours',
  isActive: 'is_active',
};

async function updateInstructor(id, input, actor, meta) {
  const before = await requireInstructor(id);
  assertDepartmentScope(actor, before.department_id);
  if (input.departmentId !== undefined) {
    assertDepartmentScope(actor, input.departmentId);
    await assertDepartmentExists(input.departmentId);
  }
  if (input.staffNumber !== undefined) await assertStaffNumberFree(input.staffNumber, id);

  const sets = [];
  const params = [];
  Object.entries(UPDATE_COLUMNS).forEach(([key, column]) => {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(typeof input[key] === 'boolean' ? Number(input[key]) : input[key]);
    }
  });
  if (sets.length === 0) return getInstructorById(id);
  sets.push('updated_at = NOW()');
  params.push(id);

  try {
    await database.getPool().query(`UPDATE instructors SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') throw ApiError.conflict('An instructor with these unique details already exists.', { code: 'DUPLICATE_ENTRY' });
    throw error;
  }

  const updated = await getInstructorById(id);
  await auditService.record({ userId: actor.id, action: 'instructor.update', entityType: 'instructor', entityId: id, before: { staffNumber: before.staff_number }, after: { staffNumber: updated.staffNumber }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return updated;
}

async function setInstructorStatus(id, isActive, actor, meta) {
  const before = await requireInstructor(id);
  assertDepartmentScope(actor, before.department_id);

  await database.getPool().query('UPDATE instructors SET is_active = ?, updated_at = NOW() WHERE id = ?', [Number(isActive), id]);
  const updated = await getInstructorById(id);
  await auditService.record({ userId: actor.id, action: isActive ? 'instructor.activate' : 'instructor.deactivate', entityType: 'instructor', entityId: id, before: { isActive: Boolean(before.is_active) }, after: { isActive: updated.isActive }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return updated;
}

module.exports = {
  listInstructors,
  listOptions,
  getInstructorById,
  createInstructor,
  updateInstructor,
  setInstructorStatus,
};
