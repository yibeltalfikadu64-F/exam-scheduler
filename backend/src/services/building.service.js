'use strict';

/**
 * Building management (Phase 4 — scheduling resources).
 *
 * Reuses the existing `buildings` table (code, name, address, floors,
 * is_active) plus the Phase-4 `description` column. Supports list/search/
 * filters/pagination, create, read, update, activate/deactivate and a guarded
 * hard delete that refuses while rooms still depend on the building.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { paginate } = require('../validators/shared');

const SORT_COLUMNS = {
  created_at: 'b.created_at',
  name: 'b.name',
  code: 'b.code',
  address: 'b.address',
  floors: 'b.floors',
  is_active: 'b.is_active',
};

const SELECT_COLUMNS = `
  b.id, b.uuid, b.code, b.name, b.address, b.description, b.floors, b.is_active,
  b.created_at, b.updated_at,
  (SELECT COUNT(*) FROM rooms r WHERE r.building_id = b.id) AS room_count,
  (SELECT COUNT(*) FROM rooms r WHERE r.building_id = b.id AND r.is_active = 1) AS active_room_count
`;

function toPublicBuilding(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    code: row.code,
    name: row.name,
    address: row.address,
    description: row.description,
    floors: row.floors,
    isActive: Boolean(row.is_active),
    roomCount: Number(row.room_count || 0),
    activeRoomCount: Number(row.active_room_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildWhere(query) {
  const clauses = [];
  const params = [];
  if (query.search) {
    const like = `%${query.search}%`;
    clauses.push('(b.name LIKE ? OR b.code LIKE ? OR b.address LIKE ?)');
    params.push(like, like, like);
  }
  if (query.isActive !== null && query.isActive !== undefined) {
    clauses.push('b.is_active = ?');
    params.push(query.isActive ? 1 : 0);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function listBuildings(query) {
  const { where, params } = buildWhere(query);
  const offset = (query.page - 1) * query.limit;
  const column = SORT_COLUMNS[query.sort] || SORT_COLUMNS.name;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database.getPool().query(`SELECT COUNT(*) AS total FROM buildings b ${where}`, params);
  const total = Number(countRows[0].total);

  const [rows] = await database
    .getPool()
    .query(`SELECT ${SELECT_COLUMNS} FROM buildings b ${where} ORDER BY ${column} ${direction}, b.id ASC LIMIT ? OFFSET ?`, [
      ...params,
      query.limit,
      offset,
    ]);

  return { items: rows.map(toPublicBuilding), pagination: paginate({ page: query.page, limit: query.limit, total }) };
}

/** Lightweight list for dropdowns (active buildings by default). */
async function listOptions({ includeInactive = false } = {}) {
  const clauses = includeInactive ? '' : 'WHERE is_active = 1';
  const [rows] = await database.getPool().query(`SELECT id, code, name, is_active FROM buildings ${clauses} ORDER BY name ASC`);
  return rows.map((row) => ({ id: row.id, code: row.code, name: row.name, isActive: Boolean(row.is_active) }));
}

async function getPublicById(id) {
  const [rows] = await database.getPool().query(`SELECT ${SELECT_COLUMNS} FROM buildings b WHERE b.id = ? LIMIT 1`, [id]);
  return rows[0] ? toPublicBuilding(rows[0]) : null;
}

async function findById(id) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, code, name, address, description, floors, is_active FROM buildings WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function requireBuilding(id) {
  const row = await findById(id);
  if (!row) throw ApiError.notFound('Building not found.', { code: 'BUILDING_NOT_FOUND' });
  return row;
}

function validationError(details) {
  return ApiError.badRequest('Validation failed.', { code: 'VALIDATION_ERROR', details });
}

async function assertUnique({ code, name }, excludeId = null) {
  const details = [];
  if (code !== undefined && code !== null) {
    const [rows] = await database
      .getPool()
      .query('SELECT id FROM buildings WHERE code = ? AND (? IS NULL OR id <> ?) LIMIT 1', [code, excludeId, excludeId]);
    if (rows.length) details.push({ field: 'code', message: 'This building code is already in use.' });
  }
  if (name !== undefined && name !== null) {
    const [rows] = await database
      .getPool()
      .query('SELECT id FROM buildings WHERE name = ? AND (? IS NULL OR id <> ?) LIMIT 1', [name, excludeId, excludeId]);
    if (rows.length) details.push({ field: 'name', message: 'This building name is already in use.' });
  }
  if (details.length) {
    throw ApiError.conflict('A building with these details already exists.', { code: 'DUPLICATE_BUILDING', details });
  }
}

async function countRooms(buildingId) {
  const [rows] = await database.getPool().query('SELECT COUNT(*) AS total FROM rooms WHERE building_id = ?', [buildingId]);
  return Number(rows[0].total);
}

async function createBuilding(input, actor, meta) {
  await assertUnique({ code: input.code, name: input.name });

  let insertId;
  try {
    const [result] = await database
      .getPool()
      .query('INSERT INTO buildings (code, name, address, description, floors, is_active) VALUES (?, ?, ?, ?, ?, ?)', [
        input.code,
        input.name,
        input.address,
        input.description,
        input.floors,
        Number(input.isActive),
      ]);
    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A building with these details already exists.', { code: 'DUPLICATE_BUILDING' });
    }
    throw error;
  }

  const created = await getPublicById(insertId);
  await auditService.record({
    userId: actor.id,
    action: 'building.create',
    entityType: 'building',
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
  address: 'address',
  description: 'description',
  floors: 'floors',
  isActive: 'is_active',
};

async function updateBuilding(id, input, actor, meta) {
  const before = await requireBuilding(id);

  if (input.code !== undefined || input.name !== undefined) {
    await assertUnique(
      {
        code: input.code !== undefined ? input.code : undefined,
        name: input.name !== undefined ? input.name : undefined,
      },
      id
    );
  }
  if (input.floors === null) throw validationError([{ field: 'floors', message: 'floors cannot be empty.' }]);

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
    await database.getPool().query(`UPDATE buildings SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A building with these details already exists.', { code: 'DUPLICATE_BUILDING' });
    }
    throw error;
  }

  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: 'building.update',
    entityType: 'building',
    entityId: id,
    before: { code: before.code, name: before.name },
    after: { code: updated.code, name: updated.name },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function setBuildingStatus(id, isActive, actor, meta) {
  const before = await requireBuilding(id);
  await database.getPool().query('UPDATE buildings SET is_active = ?, updated_at = NOW() WHERE id = ?', [Number(isActive), id]);
  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: isActive ? 'building.activate' : 'building.deactivate',
    entityType: 'building',
    entityId: id,
    before: { isActive: Boolean(before.is_active) },
    after: { isActive: updated.isActive },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function deleteBuilding(id, actor, meta) {
  const before = await requireBuilding(id);
  const rooms = await countRooms(id);
  if (rooms > 0) {
    throw ApiError.conflict('This building cannot be deleted while rooms still belong to it. Deactivate it instead.', {
      code: 'BUILDING_HAS_ROOMS',
      details: [{ field: 'id', message: `${rooms} room(s) reference this building.` }],
    });
  }

  await database.getPool().query('DELETE FROM buildings WHERE id = ?', [id]);
  await auditService.record({
    userId: actor.id,
    action: 'building.delete',
    entityType: 'building',
    entityId: id,
    before: { code: before.code, name: before.name },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return { id };
}

module.exports = {
  listBuildings,
  listOptions,
  getPublicById,
  findById,
  requireBuilding,
  countRooms,
  createBuilding,
  updateBuilding,
  setBuildingStatus,
  deleteBuilding,
};
