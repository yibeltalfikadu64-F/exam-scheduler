
'use strict';

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { paginate } = require('../validators/shared');

async function listExamPeriods(query = {}) {
  const pool = database.getPool();

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];

  if (query.search) {
    conditions.push('(name LIKE ? OR term LIKE ?)');
    const search = `%${query.search}%`;
    params.push(search, search);
  }

  if (query.status) {
    conditions.push('status = ?');
    params.push(query.status);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM exam_periods
     ${where}`,
    params
  );

  const total = Number(countRows[0].total);

  const [rows] = await pool.query(
    `SELECT id, uuid, name, term, start_date, end_date,
            status, description, created_at, updated_at
     FROM exam_periods
     ${where}
     ORDER BY start_date DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      name: row.name,
      term: row.term,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getExamPeriodById(id) {
  const [rows] = await database.getPool().query(
    `SELECT id, uuid, name, term, start_date, end_date,
            status, description, created_at, updated_at
     FROM exam_periods
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  if (!rows.length) {
    throw ApiError.notFound('Exam period not found.', {
      code: 'EXAM_PERIOD_NOT_FOUND',
    });
  }

  const row = rows[0];

  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name,
    term: row.term,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Lightweight list for dropdowns. */
async function listOptions() {
  const [rows] = await database.getPool().query(
    `SELECT id, name, term, start_date, end_date, status
     FROM exam_periods
     ORDER BY start_date DESC, id DESC`
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    term: row.term,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
  }));
}

async function findById(id) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, name, term, start_date, end_date, status, description FROM exam_periods WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function requireExamPeriod(id) {
  const row = await findById(id);
  if (!row) throw ApiError.notFound('Exam period not found.', { code: 'EXAM_PERIOD_NOT_FOUND' });
  return row;
}

async function assertNameFree(name, excludeId = null) {
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM exam_periods WHERE name = ? AND (? IS NULL OR id <> ?) LIMIT 1', [name, excludeId, excludeId]);
  if (rows.length) {
    throw ApiError.conflict('An exam period with this name already exists.', {
      code: 'DUPLICATE_EXAM_PERIOD_NAME',
      details: [{ field: 'name', message: 'This exam period name is already in use.' }],
    });
  }
}

/** Dependency counts used to protect destructive operations. */
async function getDependencies(id) {
  const [[scheduleRows], [examRows]] = await Promise.all([
    database.getPool().query('SELECT COUNT(*) AS total FROM exam_schedules WHERE exam_period_id = ?', [id]),
    database.getPool().query('SELECT COUNT(*) AS total FROM exams WHERE exam_period_id = ?', [id]),
  ]);
  return {
    schedules: Number(scheduleRows[0].total),
    exams: Number(examRows[0].total),
  };
}

async function createExamPeriod(input, actor, meta) {
  await assertNameFree(input.name);

  let insertId;
  try {
    const [result] = await database
      .getPool()
      .query(
        `INSERT INTO exam_periods (name, term, start_date, end_date, status, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [input.name, input.term, input.startDate, input.endDate, input.status || 'draft', input.description || null]
      );
    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('An exam period with these unique details already exists.', { code: 'DUPLICATE_ENTRY' });
    }
    throw error;
  }

  const created = await getExamPeriodById(insertId);
  await auditService.record({
    userId: actor.id,
    action: 'exam_period.create',
    entityType: 'exam_period',
    entityId: insertId,
    after: { name: created.name, term: created.term, status: created.status },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return created;
}

const UPDATE_COLUMNS = {
  name: 'name',
  term: 'term',
  startDate: 'start_date',
  endDate: 'end_date',
  status: 'status',
  description: 'description',
};

async function updateExamPeriod(id, input, actor, meta) {
  const before = await requireExamPeriod(id);
  if (input.name !== undefined) await assertNameFree(input.name, id);

  const sets = [];
  const params = [];
  Object.entries(UPDATE_COLUMNS).forEach(([key, column]) => {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(input[key]);
    }
  });

  if (sets.length === 0) return getExamPeriodById(id);

  sets.push('updated_at = NOW()');
  params.push(id);

  try {
    await database.getPool().query(`UPDATE exam_periods SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('An exam period with these unique details already exists.', { code: 'DUPLICATE_ENTRY' });
    }
    throw error;
  }

  const updated = await getExamPeriodById(id);
  await auditService.record({
    userId: actor.id,
    action: 'exam_period.update',
    entityType: 'exam_period',
    entityId: id,
    before: { name: before.name, status: before.status },
    after: { name: updated.name, status: updated.status },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function setExamPeriodStatus(id, status, actor, meta) {
  const before = await requireExamPeriod(id);
  await database
    .getPool()
    .query('UPDATE exam_periods SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);

  const updated = await getExamPeriodById(id);
  await auditService.record({
    userId: actor.id,
    action: 'exam_period.status',
    entityType: 'exam_period',
    entityId: id,
    before: { status: before.status },
    after: { status: updated.status },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

/**
 * Hard-delete an exam period only when nothing depends on it. Deletion is
 * refused when schedules or exams reference the period so the engine's data is
 * never silently cascaded away.
 */
async function deleteExamPeriod(id, actor, meta) {
  const before = await requireExamPeriod(id);
  const dependencies = await getDependencies(id);

  if (dependencies.schedules > 0 || dependencies.exams > 0) {
    throw ApiError.conflict('This exam period cannot be deleted because records depend on it.', {
      code: 'EXAM_PERIOD_IN_USE',
      details: [
        { field: 'schedules', message: `${dependencies.schedules} schedule(s) reference this period.` },
        { field: 'exams', message: `${dependencies.exams} exam(s) reference this period.` },
      ],
    });
  }

  await database.getPool().query('DELETE FROM exam_periods WHERE id = ?', [id]);
  await auditService.record({
    userId: actor.id,
    action: 'exam_period.delete',
    entityType: 'exam_period',
    entityId: id,
    before: { name: before.name, term: before.term, status: before.status },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return { id, deleted: true };
}

module.exports = {
  listExamPeriods,
  listOptions,
  getExamPeriodById,
  getDependencies,
  createExamPeriod,
  updateExamPeriod,
  setExamPeriodStatus,
  deleteExamPeriod,
};
