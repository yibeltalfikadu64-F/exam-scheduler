'use strict';

/**
 * Schedule constraint configuration (Phase 5).
 *
 * Reads/writes the `schedule_constraints` rows that the scheduling engine
 * consumes (hard vs soft, scope, weight, JSON `parameters`). The engine reads
 * the enabled config through `getEngineConfig()`.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { paginate } = require('../validators/shared');

const SORT_COLUMNS = {
  created_at: 'sc.created_at',
  constraint_key: 'sc.constraint_key',
  name: 'sc.name',
  type: 'sc.type',
  scope: 'sc.scope',
  weight: 'sc.weight',
  is_enabled: 'sc.is_enabled',
};

const SELECT_COLUMNS = `
  sc.id, sc.uuid, sc.constraint_key, sc.name, sc.type, sc.scope, sc.department_id,
  sc.description, sc.parameters, sc.weight, sc.is_enabled, sc.created_at, sc.updated_at
`;

function parseParameters(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function toPublicConstraint(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    constraintKey: row.constraint_key,
    name: row.name,
    type: row.type,
    scope: row.scope,
    departmentId: row.department_id,
    description: row.description,
    parameters: parseParameters(row.parameters),
    weight: Number(row.weight),
    isEnabled: Boolean(row.is_enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildWhere(query) {
  const clauses = [];
  const params = [];
  if (query.search) {
    const like = `%${query.search}%`;
    clauses.push('(sc.constraint_key LIKE ? OR sc.name LIKE ? OR sc.description LIKE ?)');
    params.push(like, like, like);
  }
  if (query.type) {
    clauses.push('sc.type = ?');
    params.push(query.type);
  }
  if (query.scope) {
    clauses.push('sc.scope = ?');
    params.push(query.scope);
  }
  if (query.isEnabled !== null && query.isEnabled !== undefined) {
    clauses.push('sc.is_enabled = ?');
    params.push(query.isEnabled ? 1 : 0);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function listConstraints(query) {
  const { where, params } = buildWhere(query);
  const offset = (query.page - 1) * query.limit;
  const column = SORT_COLUMNS[query.sort] || SORT_COLUMNS.constraint_key;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database.getPool().query(`SELECT COUNT(*) AS total FROM schedule_constraints sc ${where}`, params);
  const total = Number(countRows[0].total);

  const [rows] = await database
    .getPool()
    .query(`SELECT ${SELECT_COLUMNS} FROM schedule_constraints sc ${where} ORDER BY ${column} ${direction}, sc.id ASC LIMIT ? OFFSET ?`, [
      ...params,
      query.limit,
      offset,
    ]);

  return { items: rows.map(toPublicConstraint), pagination: paginate({ page: query.page, limit: query.limit, total }) };
}

async function getPublicById(id) {
  const [rows] = await database.getPool().query(`SELECT ${SELECT_COLUMNS} FROM schedule_constraints sc WHERE sc.id = ? LIMIT 1`, [id]);
  return rows[0] ? toPublicConstraint(rows[0]) : null;
}

async function requireConstraint(id) {
  const row = await getPublicById(id);
  if (!row) throw ApiError.notFound('Schedule constraint not found.', { code: 'CONSTRAINT_NOT_FOUND' });
  return row;
}

async function findByKey(constraintKey) {
  const [rows] = await database
    .getPool()
    .query(`SELECT ${SELECT_COLUMNS} FROM schedule_constraints sc WHERE sc.constraint_key = ? LIMIT 1`, [constraintKey]);
  return rows[0] ? toPublicConstraint(rows[0]) : null;
}

/**
 * Enabled engine configuration keyed by constraint_key with parsed parameters.
 * Used by the scheduling engine to read separation/rest-period settings.
 */
async function getEngineConfig() {
  const [rows] = await database
    .getPool()
    .query('SELECT constraint_key, type, scope, parameters, is_enabled FROM schedule_constraints WHERE is_enabled = 1');
  const config = {};
  for (const row of rows) {
    config[row.constraint_key] = { type: row.type, scope: row.scope, parameters: parseParameters(row.parameters) };
  }
  return config;
}

async function updateConstraint(id, input, actor, meta) {
  const before = await requireConstraint(id);

  if (input.departmentId !== undefined && input.departmentId !== null) {
    const [dept] = await database.getPool().query('SELECT id FROM departments WHERE id = ? LIMIT 1', [input.departmentId]);
    if (!dept.length) throw validationError([{ field: 'departmentId', message: 'The selected department does not exist.' }]);
  }

  const sets = [];
  const params = [];
  const map = {
    constraintKey: 'constraint_key',
    name: 'name',
    type: 'type',
    scope: 'scope',
    departmentId: 'department_id',
    description: 'description',
    parameters: 'parameters',
    weight: 'weight',
    isEnabled: 'is_enabled',
  };
  Object.entries(map).forEach(([key, column]) => {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(key === 'parameters' ? (input[key] === null ? null : JSON.stringify(input[key])) : input[key]);
    }
  });
  if (sets.length === 0) return before;
  sets.push('updated_at = NOW()');
  params.push(id);

  try {
    await database.getPool().query(`UPDATE schedule_constraints SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A schedule constraint with this key already exists.', { code: 'DUPLICATE_CONSTRAINT' });
    }
    throw error;
  }

  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: 'schedule_constraint.update',
    entityType: 'schedule_constraint',
    entityId: id,
    before: { key: before.constraintKey, isEnabled: before.isEnabled },
    after: { key: updated.constraintKey, isEnabled: updated.isEnabled, weight: updated.weight },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

function validationError(details) {
  return ApiError.badRequest('Validation failed.', { code: 'VALIDATION_ERROR', details });
}

module.exports = {
  listConstraints,
  getPublicById,
  requireConstraint,
  findByKey,
  getEngineConfig,
  updateConstraint,
};