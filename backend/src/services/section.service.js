'use strict';

/**
 * Section management (Phase 3, module 4).
 *
 * Reuses the existing `sections` table; `term` remains the human-readable label
 * kept in sync with the linked academic year/semester so existing consumers
 * (exam periods filter by `term`) keep working.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { assertDepartmentScope } = require('./scope');
const { paginate } = require('../validators/shared');

const SORT_COLUMNS = {
  created_at: 's.created_at',
  section: 's.section',
  capacity: 's.capacity',
  term: 's.term',
  is_active: 's.is_active',
};

const SELECT_COLUMNS = `
  s.id, s.uuid, s.course_id, s.program_id, s.section, s.section_name, s.term,
  s.academic_year_id, s.semester_id, s.capacity, s.enrolled_count, s.instructor_id,
  s.is_active, s.created_at, s.updated_at,
  c.code AS course_code, c.title AS course_title, c.department_id AS course_department_id,
  d.code AS department_code, d.name AS department_name,
  p.code AS program_code, p.name AS program_name,
  ay.code AS academic_year_code, ay.name AS academic_year_name,
  sem.name AS semester_name, sem.sequence AS semester_sequence,
  u.full_name AS instructor_name, u.username AS instructor_username
`;

const JOINS = `
  LEFT JOIN courses c ON c.id = s.course_id
  LEFT JOIN departments d ON d.id = c.department_id
  LEFT JOIN programs p ON p.id = s.program_id
  LEFT JOIN academic_years ay ON ay.id = s.academic_year_id
  LEFT JOIN semesters sem ON sem.id = s.semester_id
  LEFT JOIN users u ON u.id = s.instructor_id
`;

function toPublicSection(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    section: row.section,
    sectionName: row.section_name,
    term: row.term,
    capacity: row.capacity,
    enrolledCount: row.enrolled_count,
    isActive: Boolean(row.is_active),
    course: row.course_id ? { id: row.course_id, code: row.course_code, title: row.course_title } : null,
    department: row.course_department_id
      ? { id: row.course_department_id, code: row.department_code, name: row.department_name }
      : null,
    program: row.program_id ? { id: row.program_id, code: row.program_code, name: row.program_name } : null,
    academicYear: row.academic_year_id
      ? { id: row.academic_year_id, code: row.academic_year_code, name: row.academic_year_name }
      : null,
    semester: row.semester_id
      ? { id: row.semester_id, name: row.semester_name, sequence: row.semester_sequence }
      : null,
    instructor: row.instructor_id
      ? { id: row.instructor_id, fullName: row.instructor_name, username: row.instructor_username }
      : null,
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
    clauses.push('(s.section LIKE ? OR s.section_name LIKE ? OR s.term LIKE ? OR c.code LIKE ? OR c.title LIKE ?)');
    params.push(like, like, like, like, like);
  }
  if (query.courseId) {
    clauses.push('s.course_id = ?');
    params.push(query.courseId);
  }
  if (query.programId) {
    clauses.push('s.program_id = ?');
    params.push(query.programId);
  }
  if (query.academicYearId) {
    clauses.push('s.academic_year_id = ?');
    params.push(query.academicYearId);
  }
  if (query.semesterId) {
    clauses.push('s.semester_id = ?');
    params.push(query.semesterId);
  }
  if (query.departmentId) {
    clauses.push('c.department_id = ?');
    params.push(query.departmentId);
  }
  if (query.instructorId) {
    clauses.push('s.instructor_id = ?');
    params.push(query.instructorId);
  }
  if (query.isActive !== null && query.isActive !== undefined) {
    clauses.push('s.is_active = ?');
    params.push(query.isActive ? 1 : 0);
  }

  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function listSections(query) {
  const { where, params } = buildWhere(query);
  const offset = (query.page - 1) * query.limit;
  const column = SORT_COLUMNS[query.sort] || SORT_COLUMNS.section;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database
    .getPool()
    .query(`SELECT COUNT(*) AS total FROM sections s LEFT JOIN courses c ON c.id = s.course_id ${where}`, params);
  const total = Number(countRows[0].total);

  const [rows] = await database
    .getPool()
    .query(`SELECT ${SELECT_COLUMNS} FROM sections s ${JOINS} ${where} ORDER BY ${column} ${direction} LIMIT ? OFFSET ?`, [
      ...params,
      query.limit,
      offset,
    ]);

  return { items: rows.map(toPublicSection), pagination: paginate({ page: query.page, limit: query.limit, total }) };
}

async function getPublicById(id) {
  const [rows] = await database.getPool().query(`SELECT ${SELECT_COLUMNS} FROM sections s ${JOINS} WHERE s.id = ? LIMIT 1`, [id]);
  return rows[0] ? toPublicSection(rows[0]) : null;
}

async function findById(id) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, course_id, program_id, section, section_name, term, academic_year_id, semester_id, capacity, instructor_id, is_active FROM sections WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function requireSection(id) {
  const row = await findById(id);
  if (!row) throw ApiError.notFound('Section not found.', { code: 'SECTION_NOT_FOUND' });
  return row;
}

async function requireCourse(courseId) {
  const [rows] = await database.getPool().query('SELECT id, code, title, department_id, program_id FROM courses WHERE id = ? LIMIT 1', [courseId]);
  if (!rows.length) throw validationError([{ field: 'courseId', message: 'The selected course does not exist.' }]);
  return rows[0];
}

async function requireProgram(programId) {
  const [rows] = await database.getPool().query('SELECT id, department_id FROM programs WHERE id = ? LIMIT 1', [programId]);
  if (!rows.length) throw validationError([{ field: 'programId', message: 'The selected program does not exist.' }]);
  return rows[0];
}

async function requireAcademicYear(academicYearId) {
  const [rows] = await database.getPool().query('SELECT id, code, name FROM academic_years WHERE id = ? LIMIT 1', [academicYearId]);
  if (!rows.length) throw validationError([{ field: 'academicYearId', message: 'The selected academic year does not exist.' }]);
  return rows[0];
}

async function requireSemester(semesterId) {
  const [rows] = await database.getPool().query('SELECT id, academic_year_id, name, sequence FROM semesters WHERE id = ? LIMIT 1', [semesterId]);
  if (!rows.length) throw validationError([{ field: 'semesterId', message: 'The selected semester does not exist.' }]);
  return rows[0];
}

async function requireInstructor(instructorId) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [instructorId]);
  if (!rows.length) throw validationError([{ field: 'instructorId', message: 'The selected instructor does not exist.' }]);
  if (rows[0].role !== 'instructor') {
    throw validationError([{ field: 'instructorId', message: 'The selected user is not an instructor.' }]);
  }
  return rows[0];
}

/** Derive the legacy `term` label from the linked calendar when not supplied. */
function resolveTerm({ term, academicYear, semester }) {
  if (term) return term;
  if (academicYear && semester) return `${academicYear.code} S${semester.sequence}`.slice(0, 30);
  if (academicYear) return academicYear.code.slice(0, 30);
  return null;
}

async function assertSectionUnique(courseId, section, term, excludeId = null) {
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM sections WHERE course_id = ? AND section = ? AND term = ? AND (? IS NULL OR id <> ?) LIMIT 1', [
      courseId,
      section,
      term,
      excludeId,
      excludeId,
    ]);
  if (rows.length) {
    throw ApiError.conflict('A section with this code already exists for the course and term.', {
      code: 'DUPLICATE_SECTION',
      details: [{ field: 'section', message: 'This section code is already used for the course in this term.' }],
    });
  }
}

/** Resolve + validate the optional calendar/program links for a section. */
async function resolveLinks(input, course) {
  let programId = input.programId !== undefined ? input.programId : null;
  if (programId !== undefined && programId !== null) {
    const program = await requireProgram(programId);
    if (Number(program.department_id) !== Number(course.department_id)) {
      throw validationError([{ field: 'programId', message: 'The selected program does not belong to the course department.' }]);
    }
  }

  let academicYear = null;
  let semester = null;
  if (input.academicYearId !== undefined && input.academicYearId !== null) {
    academicYear = await requireAcademicYear(input.academicYearId);
  }
  if (input.semesterId !== undefined && input.semesterId !== null) {
    semester = await requireSemester(input.semesterId);
    if (!academicYear || Number(semester.academic_year_id) !== Number(academicYear.id)) {
      throw validationError([{ field: 'semesterId', message: 'The selected semester does not belong to the chosen academic year.' }]);
    }
  }

  return { programId, academicYear, semester };
}

const INSERT_COLUMNS = [
  'course_id',
  'program_id',
  'section',
  'section_name',
  'term',
  'academic_year_id',
  'semester_id',
  'capacity',
  'instructor_id',
  'is_active',
];

async function createSection(input, actor, meta) {
  const course = await requireCourse(input.courseId);
  assertDepartmentScope(actor, course.department_id);

  const { programId, academicYear, semester } = await resolveLinks(input, course);
  if (input.instructorId !== undefined && input.instructorId !== null) await requireInstructor(input.instructorId);

  const term = resolveTerm({ term: input.term, academicYear, semester });
  if (!term) throw validationError([{ field: 'term', message: 'Provide a term, or select an academic year/semester.' }]);

  await assertSectionUnique(input.courseId, input.section, term);

  const values = [
    input.courseId,
    programId,
    input.section,
    input.sectionName,
    term,
    academicYear ? academicYear.id : null,
    semester ? semester.id : null,
    input.capacity,
    input.instructorId !== undefined ? input.instructorId : null,
    Number(input.isActive),
  ];

  let insertId;
  try {
    const [result] = await database
      .getPool()
      .query(`INSERT INTO sections (${INSERT_COLUMNS.join(', ')}) VALUES (${INSERT_COLUMNS.map(() => '?').join(', ')})`, values);
    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A section with these details already exists.', { code: 'DUPLICATE_SECTION' });
    }
    throw error;
  }

  const created = await getPublicById(insertId);
  await auditService.record({ userId: actor.id, action: 'section.create', entityType: 'section', entityId: insertId, after: { courseId: created.course && created.course.id, section: created.section, term: created.term }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return created;
}

const UPDATE_COLUMNS = {
  courseId: 'course_id',
  programId: 'program_id',
  section: 'section',
  sectionName: 'section_name',
  term: 'term',
  academicYearId: 'academic_year_id',
  semesterId: 'semester_id',
  capacity: 'capacity',
  instructorId: 'instructor_id',
  isActive: 'is_active',
};

async function updateSection(id, input, actor, meta) {
  const before = await requireSection(id);
  const course = await requireCourse(input.courseId !== undefined ? input.courseId : before.course_id);
  assertDepartmentScope(actor, course.department_id);

  const { programId, academicYear, semester } = await resolveLinks(
    {
      programId: input.programId !== undefined ? input.programId : before.program_id,
      academicYearId: input.academicYearId !== undefined ? input.academicYearId : before.academic_year_id,
      semesterId: input.semesterId !== undefined ? input.semesterId : before.semester_id,
    },
    course
  );

  if (input.instructorId !== undefined && input.instructorId !== null) await requireInstructor(input.instructorId);

  const term = resolveTerm({
    term: input.term !== undefined ? input.term : before.term,
    academicYear,
    semester,
  });
  const sectionCode = input.section !== undefined ? input.section : before.section;
  if (!term) throw validationError([{ field: 'term', message: 'Provide a term, or select an academic year/semester.' }]);
  await assertSectionUnique(course.id, sectionCode, term, id);

  const sets = [];
  const params = [];
  Object.entries(UPDATE_COLUMNS).forEach(([key, column]) => {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(typeof input[key] === 'boolean' ? Number(input[key]) : input[key]);
    }
  });

  // Keep the derived/validated links and term in sync even when not passed in.
  const sync = {
    program_id: programId,
    academic_year_id: academicYear ? academicYear.id : null,
    semester_id: semester ? semester.id : null,
  };
  const touched = new Set(sets.map((set) => set.split(' = ')[0]));
  Object.entries(sync).forEach(([column, value]) => {
    if (!touched.has(column)) {
      sets.push(`${column} = ?`);
      params.push(value);
    }
  });
  if (!touched.has('term')) {
    sets.push('term = ?');
    params.push(term);
  }

  if (sets.length === 0) return getPublicById(id);
  sets.push('updated_at = NOW()');
  params.push(id);

  try {
    await database.getPool().query(`UPDATE sections SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A section with these details already exists.', { code: 'DUPLICATE_SECTION' });
    }
    throw error;
  }

  const updated = await getPublicById(id);
  await auditService.record({ userId: actor.id, action: 'section.update', entityType: 'section', entityId: id, before: { section: before.section, term: before.term }, after: { section: updated.section, term: updated.term }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return updated;
}

async function setSectionStatus(id, isActive, actor, meta) {
  const before = await requireSection(id);
  const course = await requireCourse(before.course_id);
  assertDepartmentScope(actor, course.department_id);

  await database.getPool().query('UPDATE sections SET is_active = ?, updated_at = NOW() WHERE id = ?', [Number(isActive), id]);
  const updated = await getPublicById(id);
  await auditService.record({ userId: actor.id, action: isActive ? 'section.activate' : 'section.deactivate', entityType: 'section', entityId: id, before: { isActive: Boolean(before.is_active) }, after: { isActive: updated.isActive }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return updated;
}

module.exports = {
  listSections,
  getPublicById,
  createSection,
  updateSection,
  setSectionStatus,
};
