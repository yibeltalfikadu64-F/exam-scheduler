'use strict';

/**
 * Program management (Phase 3, module 2).
 *
 * Reuses the existing `programs` table. Department heads may only manage
 * programs that belong to their own department (departmentId is never trusted
 * from the client — it is checked against the authenticated user).
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { paginate } = require('../validators/shared');

const SORT_COLUMNS = {
  created_at: 'p.created_at',
  name: 'p.name',
  code: 'p.code',
  degree_type: 'p.degree_type',
  duration_years: 'p.duration_years',
  is_active: 'p.is_active',
};

const SELECT_COLUMNS = `
  p.id, p.uuid, p.department_id, p.code, p.name, p.degree_type, p.duration_years, p.description,
  p.is_active, p.created_at, p.updated_at,
  d.code AS department_code, d.name AS department_name,
  (SELECT COUNT(*) FROM courses c WHERE c.program_id = p.id) AS course_count
`;

function toPublicProgram(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    code: row.code,
    name: row.name,
    degreeType: row.degree_type,
    durationYears: row.duration_years,
    description: row.description,
    isActive: Boolean(row.is_active),
    department: row.department_id
      ? { id: row.department_id, code: row.department_code, name: row.department_name }
      : null,
    courseCount: Number(row.course_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Department heads are confined to their own department. */
function assertDepartmentScope(actor, departmentId) {
  if (actor && actor.role === 'department_head' && Number(departmentId) !== Number(actor.departmentId)) {
    throw ApiError.forbidden('Department heads may only manage records in their own department.', {
      code: 'DEPARTMENT_SCOPE',
    });
  }
}

function buildWhere(query) {
  const clauses = [];
  const params = [];

  if (query.search) {
    const like = `%${query.search}%`;
    clauses.push('(p.name LIKE ? OR p.code LIKE ? OR p.description LIKE ?)');
    params.push(like, like, like);
  }
  if (query.departmentId) {
    clauses.push('p.department_id = ?');
    params.push(query.departmentId);
  }
  if (query.degreeType) {
    clauses.push('p.degree_type = ?');
    params.push(query.degreeType);
  }
  if (query.isActive !== null && query.isActive !== undefined) {
    clauses.push('p.is_active = ?');
    params.push(query.isActive ? 1 : 0);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function listPrograms(query) {
  const { where, params } = buildWhere(query);
  const offset = (query.page - 1) * query.limit;
  const column = SORT_COLUMNS[query.sort] || SORT_COLUMNS.name;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database.getPool().query(`SELECT COUNT(*) AS total FROM programs p ${where}`, params);
  const total = Number(countRows[0].total);

  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${SELECT_COLUMNS}
       FROM programs p
       LEFT JOIN departments d ON d.id = p.department_id
       ${where}
       ORDER BY ${column} ${direction}
       LIMIT ? OFFSET ?`,
      [...params, query.limit, offset]
    );

  return {
    items: rows.map(toPublicProgram),
    pagination: paginate({ page: query.page, limit: query.limit, total }),
  };
}

async function listOptions(departmentId = null) {
  const params = [];
  let where = 'WHERE p.is_active = 1';
  if (departmentId) {
    where += ' AND p.department_id = ?';
    params.push(departmentId);
  }
  const [rows] = await database.getPool().query(
    `SELECT p.id, p.code, p.name, p.department_id FROM programs p ${where} ORDER BY p.name ASC`,
    params
  );
  return rows;
}

async function getPublicById(id) {
  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${SELECT_COLUMNS} FROM programs p LEFT JOIN departments d ON d.id = p.department_id WHERE p.id = ? LIMIT 1`,
      [id]
    );
  return rows[0] ? toPublicProgram(rows[0]) : null;
}

async function findById(id) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, department_id, code, name, degree_type, duration_years, description, is_active FROM programs WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function requireProgram(id) {
  const row = await findById(id);
  if (!row) throw ApiError.notFound('Program not found.', { code: 'PROGRAM_NOT_FOUND' });
  return row;
}

async function assertDepartmentExists(departmentId) {
  const [rows] = await database.getPool().query('SELECT id FROM departments WHERE id = ? LIMIT 1', [departmentId]);
  if (!rows.length) {
    throw ApiError.badRequest('Validation failed.', {
      code: 'VALIDATION_ERROR',
      details: [{ field: 'departmentId', message: 'The selected department does not exist.' }],
    });
  }
}

async function assertCodeFree(code, excludeId = null) {
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM programs WHERE code = ? AND (? IS NULL OR id <> ?) LIMIT 1', [code, excludeId, excludeId]);
  if (rows.length) {
    throw ApiError.conflict('A program with this code already exists.', {
      code: 'DUPLICATE_PROGRAM_CODE',
      details: [{ field: 'code', message: 'This program code is already in use.' }],
    });
  }
}

const UPDATE_COLUMNS = {
  departmentId: 'department_id',
  code: 'code',
  name: 'name',
  degreeType: 'degree_type',
  durationYears: 'duration_years',
  description: 'description',
  isActive: 'is_active',
};

async function createProgram(input, actor, meta) {
  assertDepartmentScope(actor, input.departmentId);
  await assertDepartmentExists(input.departmentId);
  await assertCodeFree(input.code);

  let insertId;
  try {
    const [result] = await database
      .getPool()
      .query(
        'INSERT INTO programs (department_id, code, name, degree_type, duration_years, description, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [input.departmentId, input.code, input.name, input.degreeType, input.durationYears, input.description, Number(input.isActive)]
      );
    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A program with these unique details already exists.', { code: 'DUPLICATE_ENTRY' });
    }
    throw error;
  }

  const created = await getPublicById(insertId);
  await auditService.record({
    userId: actor.id,
    action: 'program.create',
    entityType: 'program',
    entityId: insertId,
    after: { code: created.code, name: created.name, departmentId: created.department && created.department.id },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return created;
}

async function updateProgram(id, input, actor, meta) {
  const before = await requireProgram(id);
  assertDepartmentScope(actor, before.department_id);

  if (input.departmentId !== undefined) {
    assertDepartmentScope(actor, input.departmentId);
    await assertDepartmentExists(input.departmentId);
  }
  if (input.code !== undefined) await assertCodeFree(input.code, id);

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
    await database.getPool().query(`UPDATE programs SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A program with these unique details already exists.', { code: 'DUPLICATE_ENTRY' });
    }
    throw error;
  }

  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: 'program.update',
    entityType: 'program',
    entityId: id,
    before: { code: before.code, name: before.name },
    after: { code: updated.code, name: updated.name },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function setProgramStatus(id, isActive, actor, meta) {
  const before = await requireProgram(id);
  assertDepartmentScope(actor, before.department_id);

  await database.getPool().query('UPDATE programs SET is_active = ?, updated_at = NOW() WHERE id = ?', [Number(isActive), id]);

  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: isActive ? 'program.activate' : 'program.deactivate',
    entityType: 'program',
    entityId: id,
    before: { isActive: Boolean(before.is_active) },
    after: { isActive: updated.isActive },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

module.exports = {
  listPrograms,
  listOptions,
  getPublicById,
  createProgram,
  updateProgram,
  setProgramStatus,
};
