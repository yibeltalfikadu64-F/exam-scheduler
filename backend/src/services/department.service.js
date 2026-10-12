'use strict';

/**
 * Department management (Phase 3, module 1).
 *
 * Reuses the existing `departments` table (code, name, description, head_id,
 * is_active). Supports list/search/pagination, create, read, update and
 * activate/deactivate. Hard deletion is intentionally NOT exposed: deactivating
 * keeps programs/courses that reference the department from being orphaned.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { paginate } = require('../validators/shared');

const SORT_COLUMNS = {
  created_at: 'd.created_at',
  name: 'd.name',
  code: 'd.code',
  is_active: 'd.is_active',
};

const SELECT_COLUMNS = `
  d.id, d.uuid, d.code, d.name, d.description, d.head_id, d.is_active, d.created_at, d.updated_at,
  h.full_name AS head_name, h.username AS head_username,
  (SELECT COUNT(*) FROM programs p WHERE p.department_id = d.id) AS program_count,
  (SELECT COUNT(*) FROM courses c WHERE c.department_id = d.id) AS course_count
`;

function toPublicDepartment(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    code: row.code,
    name: row.name,
    description: row.description,
    headId: row.head_id,
    head: row.head_id ? { id: row.head_id, fullName: row.head_name, username: row.head_username } : null,
    isActive: Boolean(row.is_active),
    programCount: Number(row.program_count || 0),
    courseCount: Number(row.course_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildWhere(query) {
  const clauses = [];
  const params = [];

  if (query.search) {
    const like = `%${query.search}%`;
    clauses.push('(d.name LIKE ? OR d.code LIKE ? OR d.description LIKE ?)');
    params.push(like, like, like);
  }
  if (query.isActive !== null && query.isActive !== undefined) {
    clauses.push('d.is_active = ?');
    params.push(query.isActive ? 1 : 0);
  }
  if (query.headId) {
    clauses.push('d.head_id = ?');
    params.push(query.headId);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function listDepartments(query) {
  const { where, params } = buildWhere(query);
  const offset = (query.page - 1) * query.limit;
  const column = SORT_COLUMNS[query.sort] || SORT_COLUMNS.name;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database.getPool().query(`SELECT COUNT(*) AS total FROM departments d ${where}`, params);
  const total = Number(countRows[0].total);

  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${SELECT_COLUMNS}
       FROM departments d
       LEFT JOIN users h ON h.id = d.head_id
       ${where}
       ORDER BY ${column} ${direction}
       LIMIT ? OFFSET ?`,
      [...params, query.limit, offset]
    );

  return {
    items: rows.map(toPublicDepartment),
    pagination: paginate({ page: query.page, limit: query.limit, total }),
  };
}

/** Lightweight list for dropdowns. */
async function listOptions() {
  const [rows] = await database.getPool().query('SELECT id, code, name FROM departments ORDER BY name ASC');
  return rows;
}

async function getPublicById(id) {
  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${SELECT_COLUMNS} FROM departments d LEFT JOIN users h ON h.id = d.head_id WHERE d.id = ? LIMIT 1`,
      [id]
    );
  return rows[0] ? toPublicDepartment(rows[0]) : null;
}

async function findById(id) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, code, name, description, head_id, is_active FROM departments WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function requireDepartment(id) {
  const row = await findById(id);
  if (!row) throw ApiError.notFound('Department not found.', { code: 'DEPARTMENT_NOT_FOUND' });
  return row;
}

async function assertCodeFree(code, excludeId = null) {
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM departments WHERE code = ? AND (? IS NULL OR id <> ?) LIMIT 1', [code, excludeId, excludeId]);
  if (rows.length) {
    throw ApiError.conflict('A department with this code already exists.', {
      code: 'DUPLICATE_DEPARTMENT_CODE',
      details: [{ field: 'code', message: 'This department code is already in use.' }],
    });
  }
}

async function assertNameFree(name, excludeId = null) {
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM departments WHERE name = ? AND (? IS NULL OR id <> ?) LIMIT 1', [name, excludeId, excludeId]);
  if (rows.length) {
    throw ApiError.conflict('A department with this name already exists.', {
      code: 'DUPLICATE_DEPARTMENT_NAME',
      details: [{ field: 'name', message: 'This department name is already in use.' }],
    });
  }
}

async function assertHeadExists(headId) {
  if (headId === null || headId === undefined) return;
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [headId]);
  if (!rows.length) {
    throw ApiError.badRequest('Validation failed.', {
      code: 'VALIDATION_ERROR',
      details: [{ field: 'headId', message: 'The selected head user does not exist.' }],
    });
  }
}

async function createDepartment(input, actor, meta) {
  await assertCodeFree(input.code);
  await assertNameFree(input.name);
  await assertHeadExists(input.headId);

  let insertId;
  try {
    const [result] = await database
      .getPool()
      .query('INSERT INTO departments (code, name, description, head_id, is_active) VALUES (?, ?, ?, ?, ?)', [
        input.code,
        input.name,
        input.description,
        input.headId,
        Number(input.isActive),
      ]);
    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A department with these unique details already exists.', { code: 'DUPLICATE_ENTRY' });
    }
    throw error;
  }

  const created = await getPublicById(insertId);
  await auditService.record({
    userId: actor.id,
    action: 'department.create',
    entityType: 'department',
    entityId: insertId,
    after: { code: created.code, name: created.name },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return created;
}

const UPDATE_COLUMNS = {
  code: 'code',
  name: 'name',
  description: 'description',
  headId: 'head_id',
  isActive: 'is_active',
};

async function updateDepartment(id, input, actor, meta) {
  const before = await requireDepartment(id);

  if (input.code !== undefined) await assertCodeFree(input.code, id);
  if (input.name !== undefined) await assertNameFree(input.name, id);
  if (input.headId !== undefined) await assertHeadExists(input.headId);

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
    await database.getPool().query(`UPDATE departments SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A department with these unique details already exists.', { code: 'DUPLICATE_ENTRY' });
    }
    throw error;
  }

  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: 'department.update',
    entityType: 'department',
    entityId: id,
    before: { code: before.code, name: before.name },
    after: { code: updated.code, name: updated.name },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function setDepartmentStatus(id, isActive, actor, meta) {
  const before = await requireDepartment(id);
  await database
    .getPool()
    .query('UPDATE departments SET is_active = ?, updated_at = NOW() WHERE id = ?', [Number(isActive), id]);

  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: isActive ? 'department.activate' : 'department.deactivate',
    entityType: 'department',
    entityId: id,
    before: { isActive: Boolean(before.is_active) },
    after: { isActive: updated.isActive },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

/** Dependency counts (programs/courses) shown before deactivation. */
async function getDependencies(id) {
  const [[programRows], [courseRows]] = await Promise.all([
    database.getPool().query('SELECT COUNT(*) AS total FROM programs WHERE department_id = ?', [id]),
    database.getPool().query('SELECT COUNT(*) AS total FROM courses WHERE department_id = ?', [id]),
  ]);
  return { programs: Number(programRows[0].total), courses: Number(courseRows[0].total) };
}

module.exports = {
  listDepartments,
  listOptions,
  getPublicById,
  getDependencies,
  createDepartment,
  updateDepartment,
  setDepartmentStatus,
};
