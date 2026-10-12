'use strict';

/**
 * Academic calendar service (Phase 3, module 4): academic years + semesters.
 *
 * Calendar-agnostic: `code`/`name` carry whatever labelling the university uses
 * and `start_date`/`end_date` are optional plain dates. Semester dates are kept
 * inside the parent academic year when both are supplied.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { paginate, toDateString } = require('../validators/shared');

const YEAR_SORT_COLUMNS = {
  created_at: 'ay.created_at',
  code: 'ay.code',
  name: 'ay.name',
  start_date: 'ay.start_date',
  is_active: 'ay.is_active',
};

const SEMESTER_SORT_COLUMNS = {
  sequence: 's.sequence',
  name: 's.name',
  start_date: 's.start_date',
  is_active: 's.is_active',
};

const YEAR_SELECT = `
  ay.id, ay.uuid, ay.code, ay.name, ay.start_date, ay.end_date, ay.is_active, ay.created_at, ay.updated_at,
  (SELECT COUNT(*) FROM semesters s WHERE s.academic_year_id = ay.id) AS semester_count
`;

const SEMESTER_SELECT = `
  s.id, s.uuid, s.academic_year_id, s.name, s.sequence, s.start_date, s.end_date, s.is_active, s.created_at, s.updated_at
`;

function toPublicYear(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    code: row.code,
    name: row.name,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
    isActive: Boolean(row.is_active),
    semesterCount: Number(row.semester_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPublicSemester(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    academicYearId: row.academic_year_id,
    name: row.name,
    sequence: row.sequence,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validationError(details) {
  return ApiError.badRequest('Validation failed.', { code: 'VALIDATION_ERROR', details });
}

function assertDateRange(startDate, endDate, field = 'endDate') {
  const start = toDateString(startDate);
  const end = toDateString(endDate);
  if (start && end && end < start) {
    throw validationError([{ field, message: 'The end date cannot be earlier than the start date.' }]);
  }
}

// ---------------------------------------------------------------------------
// Academic years
// ---------------------------------------------------------------------------

async function listAcademicYears(query) {
  const clauses = [];
  const params = [];
  if (query.search) {
    const like = `%${query.search}%`;
    clauses.push('(ay.code LIKE ? OR ay.name LIKE ?)');
    params.push(like, like);
  }
  if (query.isActive !== null && query.isActive !== undefined) {
    clauses.push('ay.is_active = ?');
    params.push(query.isActive ? 1 : 0);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;
  const column = YEAR_SORT_COLUMNS[query.sort] || YEAR_SORT_COLUMNS.code;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database.getPool().query(`SELECT COUNT(*) AS total FROM academic_years ay ${where}`, params);
  const total = Number(countRows[0].total);
  const [rows] = await database
    .getPool()
    .query(`SELECT ${YEAR_SELECT} FROM academic_years ay ${where} ORDER BY ${column} ${direction} LIMIT ? OFFSET ?`, [
      ...params,
      query.limit,
      offset,
    ]);

  return { items: rows.map(toPublicYear), pagination: paginate({ page: query.page, limit: query.limit, total }) };
}

async function listYearOptions() {
  const [rows] = await database
    .getPool()
    .query('SELECT id, code, name, start_date, end_date FROM academic_years WHERE is_active = 1 ORDER BY code DESC');
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
  }));
}

async function getYearById(id) {
  const [rows] = await database.getPool().query(`SELECT ${YEAR_SELECT} FROM academic_years ay WHERE ay.id = ? LIMIT 1`, [id]);
  return rows[0] ? toPublicYear(rows[0]) : null;
}

async function findYearById(id) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, code, name, start_date, end_date, is_active FROM academic_years WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function requireYear(id) {
  const row = await findYearById(id);
  if (!row) throw ApiError.notFound('Academic year not found.', { code: 'ACADEMIC_YEAR_NOT_FOUND' });
  return row;
}

async function assertYearUnique({ code, name }, excludeId = null) {
  const details = [];
  if (code !== undefined && code !== null) {
    const [rows] = await database
      .getPool()
      .query('SELECT id FROM academic_years WHERE code = ? AND (? IS NULL OR id <> ?) LIMIT 1', [code, excludeId, excludeId]);
    if (rows.length) details.push({ field: 'code', message: 'This academic year code is already in use.' });
  }
  if (name !== undefined && name !== null) {
    const [rows] = await database
      .getPool()
      .query('SELECT id FROM academic_years WHERE name = ? AND (? IS NULL OR id <> ?) LIMIT 1', [name, excludeId, excludeId]);
    if (rows.length) details.push({ field: 'name', message: 'This academic year name is already in use.' });
  }
  if (details.length) throw ApiError.conflict('An academic year with these details already exists.', { code: 'DUPLICATE_ACADEMIC_YEAR', details });
}

async function createAcademicYear(input, actor, meta) {
  await assertYearUnique({ code: input.code, name: input.name });
  assertDateRange(input.startDate, input.endDate);

  let insertId;
  try {
    const [result] = await database
      .getPool()
      .query('INSERT INTO academic_years (code, name, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?)', [
        input.code,
        input.name,
        input.startDate,
        input.endDate,
        Number(input.isActive),
      ]);
    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') throw ApiError.conflict('An academic year with these details already exists.', { code: 'DUPLICATE_ENTRY' });
    throw error;
  }

  const created = await getYearById(insertId);
  await auditService.record({ userId: actor.id, action: 'academic_year.create', entityType: 'academic_year', entityId: insertId, after: { code: created.code, name: created.name }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return created;
}

const YEAR_UPDATE_COLUMNS = { code: 'code', name: 'name', startDate: 'start_date', endDate: 'end_date', isActive: 'is_active' };

async function updateAcademicYear(id, input, actor, meta) {
  const before = await requireYear(id);
  if (input.code !== undefined || input.name !== undefined) {
    await assertYearUnique({ code: input.code, name: input.name }, id);
  }
  assertDateRange(
    input.startDate !== undefined ? input.startDate : before.start_date,
    input.endDate !== undefined ? input.endDate : before.end_date
  );

  const sets = [];
  const params = [];
  Object.entries(YEAR_UPDATE_COLUMNS).forEach(([key, column]) => {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(typeof input[key] === 'boolean' ? Number(input[key]) : input[key]);
    }
  });
  if (sets.length === 0) return getYearById(id);
  sets.push('updated_at = NOW()');
  params.push(id);

  try {
    await database.getPool().query(`UPDATE academic_years SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') throw ApiError.conflict('An academic year with these details already exists.', { code: 'DUPLICATE_ENTRY' });
    throw error;
  }

  const updated = await getYearById(id);
  await auditService.record({ userId: actor.id, action: 'academic_year.update', entityType: 'academic_year', entityId: id, before: { code: before.code, name: before.name }, after: { code: updated.code, name: updated.name }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return updated;
}

async function setAcademicYearStatus(id, isActive, actor, meta) {
  const before = await requireYear(id);
  await database.getPool().query('UPDATE academic_years SET is_active = ?, updated_at = NOW() WHERE id = ?', [Number(isActive), id]);
  const updated = await getYearById(id);
  await auditService.record({ userId: actor.id, action: isActive ? 'academic_year.activate' : 'academic_year.deactivate', entityType: 'academic_year', entityId: id, before: { isActive: Boolean(before.is_active) }, after: { isActive: updated.isActive }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return updated;
}

// ---------------------------------------------------------------------------
// Semesters
// ---------------------------------------------------------------------------

function assertWithinYear(semester, year) {
  const details = [];
  const yearStart = toDateString(year.start_date);
  const yearEnd = toDateString(year.end_date);
  const semesterStart = toDateString(semester.startDate);
  const semesterEnd = toDateString(semester.endDate);
  if (yearStart && semesterStart && semesterStart < yearStart) {
    details.push({ field: 'startDate', message: 'The semester start date cannot be before the academic year start date.' });
  }
  if (yearEnd && semesterEnd && semesterEnd > yearEnd) {
    details.push({ field: 'endDate', message: 'The semester end date cannot be after the academic year end date.' });
  }
  if (details.length) throw validationError(details);
}

async function listSemesters(yearId, query) {
  await requireYear(yearId);
  const clauses = ['s.academic_year_id = ?'];
  const params = [yearId];
  if (query.search) {
    clauses.push('s.name LIKE ?');
    params.push(`%${query.search}%`);
  }
  if (query.isActive !== null && query.isActive !== undefined) {
    clauses.push('s.is_active = ?');
    params.push(query.isActive ? 1 : 0);
  }
  const where = `WHERE ${clauses.join(' AND ')}`;
  const offset = (query.page - 1) * query.limit;
  const column = SEMESTER_SORT_COLUMNS[query.sort] || SEMESTER_SORT_COLUMNS.sequence;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database.getPool().query(`SELECT COUNT(*) AS total FROM semesters s ${where}`, params);
  const total = Number(countRows[0].total);
  const [rows] = await database
    .getPool()
    .query(`SELECT ${SEMESTER_SELECT} FROM semesters s ${where} ORDER BY ${column} ${direction} LIMIT ? OFFSET ?`, [
      ...params,
      query.limit,
      offset,
    ]);

  return { items: rows.map(toPublicSemester), pagination: paginate({ page: query.page, limit: query.limit, total }) };
}

async function findSemester(yearId, semesterId) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, academic_year_id, name, sequence, start_date, end_date, is_active FROM semesters WHERE id = ? AND academic_year_id = ? LIMIT 1', [
      semesterId,
      yearId,
    ]);
  return rows[0] || null;
}

async function requireSemester(yearId, semesterId) {
  const row = await findSemester(yearId, semesterId);
  if (!row) throw ApiError.notFound('Semester not found.', { code: 'SEMESTER_NOT_FOUND' });
  return row;
}

async function getSemesterById(yearId, semesterId) {
  const [rows] = await database
    .getPool()
    .query(`SELECT ${SEMESTER_SELECT} FROM semesters s WHERE s.id = ? AND s.academic_year_id = ? LIMIT 1`, [semesterId, yearId]);
  return rows[0] ? toPublicSemester(rows[0]) : null;
}

async function assertSemesterUnique(yearId, { name, sequence }, excludeId = null) {
  const details = [];
  if (name !== undefined && name !== null) {
    const [rows] = await database
      .getPool()
      .query('SELECT id FROM semesters WHERE academic_year_id = ? AND name = ? AND (? IS NULL OR id <> ?) LIMIT 1', [yearId, name, excludeId, excludeId]);
    if (rows.length) details.push({ field: 'name', message: 'A semester with this name already exists for the academic year.' });
  }
  if (sequence !== undefined && sequence !== null) {
    const [rows] = await database
      .getPool()
      .query('SELECT id FROM semesters WHERE academic_year_id = ? AND sequence = ? AND (? IS NULL OR id <> ?) LIMIT 1', [yearId, sequence, excludeId, excludeId]);
    if (rows.length) details.push({ field: 'sequence', message: 'A semester with this sequence already exists for the academic year.' });
  }
  if (details.length) throw ApiError.conflict('A semester with these details already exists.', { code: 'DUPLICATE_SEMESTER', details });
}

async function createSemester(yearId, input, actor, meta) {
  const year = await requireYear(yearId);
  assertDateRange(input.startDate, input.endDate);
  assertWithinYear(input, year);
  await assertSemesterUnique(yearId, { name: input.name, sequence: input.sequence });

  let insertId;
  try {
    const [result] = await database
      .getPool()
      .query('INSERT INTO semesters (academic_year_id, name, sequence, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?)', [
        yearId,
        input.name,
        input.sequence,
        input.startDate,
        input.endDate,
        Number(input.isActive),
      ]);
    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') throw ApiError.conflict('A semester with these details already exists.', { code: 'DUPLICATE_ENTRY' });
    throw error;
  }

  const created = await getSemesterById(yearId, insertId);
  await auditService.record({ userId: actor.id, action: 'semester.create', entityType: 'semester', entityId: insertId, after: { academicYearId: yearId, name: created.name, sequence: created.sequence }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return created;
}

const SEMESTER_UPDATE_COLUMNS = { name: 'name', sequence: 'sequence', startDate: 'start_date', endDate: 'end_date', isActive: 'is_active' };

async function updateSemester(yearId, semesterId, input, actor, meta) {
  const year = await requireYear(yearId);
  const before = await requireSemester(yearId, semesterId);

  if (input.name !== undefined || input.sequence !== undefined) {
    await assertSemesterUnique(yearId, { name: input.name, sequence: input.sequence }, semesterId);
  }

  const effective = {
    startDate: input.startDate !== undefined ? input.startDate : before.start_date,
    endDate: input.endDate !== undefined ? input.endDate : before.end_date,
  };
  assertDateRange(effective.startDate, effective.endDate);
  assertWithinYear(effective, year);

  const sets = [];
  const params = [];
  Object.entries(SEMESTER_UPDATE_COLUMNS).forEach(([key, column]) => {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(typeof input[key] === 'boolean' ? Number(input[key]) : input[key]);
    }
  });
  if (sets.length === 0) return getSemesterById(yearId, semesterId);
  sets.push('updated_at = NOW()');
  params.push(semesterId);

  try {
    await database.getPool().query(`UPDATE semesters SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') throw ApiError.conflict('A semester with these details already exists.', { code: 'DUPLICATE_ENTRY' });
    throw error;
  }

  const updated = await getSemesterById(yearId, semesterId);
  await auditService.record({ userId: actor.id, action: 'semester.update', entityType: 'semester', entityId: semesterId, before: { name: before.name, sequence: before.sequence }, after: { name: updated.name, sequence: updated.sequence }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return updated;
}

async function setSemesterStatus(yearId, semesterId, isActive, actor, meta) {
  const before = await requireSemester(yearId, semesterId);
  await database.getPool().query('UPDATE semesters SET is_active = ?, updated_at = NOW() WHERE id = ?', [Number(isActive), semesterId]);
  const updated = await getSemesterById(yearId, semesterId);
  await auditService.record({ userId: actor.id, action: isActive ? 'semester.activate' : 'semester.deactivate', entityType: 'semester', entityId: semesterId, before: { isActive: Boolean(before.is_active) }, after: { isActive: updated.isActive }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return updated;
}

module.exports = {
  listAcademicYears,
  listYearOptions,
  getYearById,
  createAcademicYear,
  updateAcademicYear,
  setAcademicYearStatus,
  listSemesters,
  getSemesterById,
  createSemester,
  updateSemester,
  setSemesterStatus,
};
