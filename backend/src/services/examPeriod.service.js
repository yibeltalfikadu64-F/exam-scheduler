
'use strict';

const database = require('../config/database');
const ApiError = require('../utils/ApiError');

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

module.exports = {
  listExamPeriods,
  getExamPeriodById,
};
