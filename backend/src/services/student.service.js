'use strict';

/**
 * Student management + enrollment (Phase 3, module 5).
 *
 * Reuses the existing `students` and `enrollments` tables. Department is derived
 * from the student's program (single source of truth) rather than duplicated.
 * Section membership is managed through enrollments, keeping `sections.enrolled_count`
 * consistent inside transactions.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { assertDepartmentScope } = require('./scope');
const { paginate } = require('../validators/shared');

const SORT_COLUMNS = {
  created_at: 's.created_at',
  student_number: 's.student_number',
  full_name: 's.full_name',
  year: 's.year',
  status: 's.status',
};

const SELECT_COLUMNS = `
  s.id, s.uuid, s.student_number, s.full_name, s.email, s.phone, s.program_id, s.user_id, s.year, s.status,
  s.created_at, s.updated_at,
  pr.code AS program_code, pr.name AS program_name,
  d.id AS department_id, d.code AS department_code, d.name AS department_name,
  (SELECT COUNT(*) FROM enrollments e WHERE e.student_id = s.id AND e.status = 'enrolled') AS enrolled_count
`;

const JOINS = `
  LEFT JOIN programs pr ON pr.id = s.program_id
  LEFT JOIN departments d ON d.id = pr.department_id
`;

function toPublicStudent(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    studentNumber: row.student_number,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    year: row.year,
    status: row.status,
    hasAccount: Boolean(row.user_id),
    userId: row.user_id,
    program: row.program_id ? { id: row.program_id, code: row.program_code, name: row.program_name } : null,
    department: row.department_id
      ? { id: row.department_id, code: row.department_code, name: row.department_name }
      : null,
    enrolledCount: Number(row.enrolled_count || 0),
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
    clauses.push('(s.full_name LIKE ? OR s.student_number LIKE ? OR s.email LIKE ?)');
    params.push(like, like, like);
  }
  if (query.programId) {
    clauses.push('s.program_id = ?');
    params.push(query.programId);
  }
  if (query.departmentId) {
    clauses.push('pr.department_id = ?');
    params.push(query.departmentId);
  }
  if (query.year) {
    clauses.push('s.year = ?');
    params.push(query.year);
  }
  if (query.status) {
    clauses.push('s.status = ?');
    params.push(query.status);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function listStudents(query) {
  const { where, params } = buildWhere(query);
  const offset = (query.page - 1) * query.limit;
  const column = SORT_COLUMNS[query.sort] || SORT_COLUMNS.student_number;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database
    .getPool()
    .query(`SELECT COUNT(*) AS total FROM students s LEFT JOIN programs pr ON pr.id = s.program_id ${where}`, params);
  const total = Number(countRows[0].total);

  const [rows] = await database
    .getPool()
    .query(`SELECT ${SELECT_COLUMNS} FROM students s ${JOINS} ${where} ORDER BY ${column} ${direction} LIMIT ? OFFSET ?`, [
      ...params,
      query.limit,
      offset,
    ]);

  return { items: rows.map(toPublicStudent), pagination: paginate({ page: query.page, limit: query.limit, total }) };
}

async function getStudentById(id) {
  const [rows] = await database.getPool().query(`SELECT ${SELECT_COLUMNS} FROM students s ${JOINS} WHERE s.id = ? LIMIT 1`, [id]);
  return rows[0] ? toPublicStudent(rows[0]) : null;
}

async function findStudentById(id) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, student_number, full_name, program_id, user_id, year, status FROM students WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

async function requireStudent(id) {
  const row = await findStudentById(id);
  if (!row) throw ApiError.notFound('Student not found.', { code: 'STUDENT_NOT_FOUND' });
  return row;
}

async function assertProgramExists(programId) {
  if (programId === null || programId === undefined) return;
  const [rows] = await database.getPool().query('SELECT id, department_id FROM programs WHERE id = ? LIMIT 1', [programId]);
  if (!rows.length) throw validationError([{ field: 'programId', message: 'The selected program does not exist.' }]);
  return rows[0];
}

async function assertUserIsStudent(userId) {
  if (userId === null || userId === undefined) return;
  const [rows] = await database.getPool().query('SELECT id, role FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [userId]);
  if (!rows.length) throw validationError([{ field: 'userId', message: 'The selected user does not exist.' }]);
  if (rows[0].role !== 'student') throw validationError([{ field: 'userId', message: 'The selected user is not a student account.' }]);
}

async function assertNumberFree(studentNumber, excludeId = null) {
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM students WHERE student_number = ? AND (? IS NULL OR id <> ?) LIMIT 1', [studentNumber, excludeId, excludeId]);
  if (rows.length) {
    throw ApiError.conflict('A student with this number already exists.', {
      code: 'DUPLICATE_STUDENT_NUMBER',
      details: [{ field: 'studentNumber', message: 'This student number is already in use.' }],
    });
  }
}

async function assertAccountFree(userId, excludeId = null) {
  if (userId === null || userId === undefined) return;
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM students WHERE user_id = ? AND (? IS NULL OR id <> ?) LIMIT 1', [userId, excludeId, excludeId]);
  if (rows.length) {
    throw ApiError.conflict('This user account is already linked to another student.', {
      code: 'DUPLICATE_STUDENT_ACCOUNT',
      details: [{ field: 'userId', message: 'This account is already linked to a student record.' }],
    });
  }
}

async function createStudent(input, actor, meta) {
  const program = await assertProgramExists(input.programId);
  if (program) assertDepartmentScope(actor, program.department_id);
  await assertUserIsStudent(input.userId);
  await assertNumberFree(input.studentNumber);
  await assertAccountFree(input.userId);

  let insertId;
  try {
    const [result] = await database
      .getPool()
      .query('INSERT INTO students (student_number, full_name, email, phone, program_id, user_id, year, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        input.studentNumber,
        input.fullName,
        input.email,
        input.phone,
        input.programId,
        input.userId,
        input.year,
        input.status,
      ]);
    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') throw ApiError.conflict('A student with these unique details already exists.', { code: 'DUPLICATE_ENTRY' });
    throw error;
  }

  const created = await getStudentById(insertId);
  await auditService.record({ userId: actor.id, action: 'student.create', entityType: 'student', entityId: insertId, after: { studentNumber: created.studentNumber, fullName: created.fullName }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return created;
}

const UPDATE_COLUMNS = {
  studentNumber: 'student_number',
  fullName: 'full_name',
  email: 'email',
  phone: 'phone',
  programId: 'program_id',
  userId: 'user_id',
  year: 'year',
  status: 'status',
};

async function updateStudent(id, input, actor, meta) {
  const before = await requireStudent(id);
  if (before.program_id) {
    const existingProgram = await assertProgramExists(before.program_id);
    if (existingProgram) assertDepartmentScope(actor, existingProgram.department_id);
  }
  if (input.programId !== undefined && input.programId !== null) {
    const program = await assertProgramExists(input.programId);
    if (program) assertDepartmentScope(actor, program.department_id);
  }
  if (input.userId !== undefined) await assertUserIsStudent(input.userId);
  if (input.studentNumber !== undefined) await assertNumberFree(input.studentNumber, id);
  if (input.userId !== undefined) await assertAccountFree(input.userId, id);

  const sets = [];
  const params = [];
  Object.entries(UPDATE_COLUMNS).forEach(([key, column]) => {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(input[key]);
    }
  });
  if (sets.length === 0) return getStudentById(id);
  sets.push('updated_at = NOW()');
  params.push(id);

  try {
    await database.getPool().query(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') throw ApiError.conflict('A student with these unique details already exists.', { code: 'DUPLICATE_ENTRY' });
    throw error;
  }

  const updated = await getStudentById(id);
  await auditService.record({ userId: actor.id, action: 'student.update', entityType: 'student', entityId: id, before: { studentNumber: before.student_number, status: before.status }, after: { studentNumber: updated.studentNumber, status: updated.status }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return updated;
}

async function setStudentStatus(id, status, actor, meta) {
  const before = await requireStudent(id);
  if (before.program_id) {
    const program = await assertProgramExists(before.program_id);
    if (program) assertDepartmentScope(actor, program.department_id);
  }

  await database.getPool().query('UPDATE students SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
  const updated = await getStudentById(id);
  await auditService.record({ userId: actor.id, action: 'student.status', entityType: 'student', entityId: id, before: { status: before.status }, after: { status }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return updated;
}

// ---------------------------------------------------------------------------
// Enrollments (student <-> section)
// ---------------------------------------------------------------------------

const ENROLLMENT_SELECT = `
  e.id, e.uuid, e.student_id, e.section_id, e.status, e.grade, e.created_at, e.updated_at,
  sec.section, sec.section_name, sec.term, sec.course_id,
  c.code AS course_code, c.title AS course_title,
  ay.id AS academic_year_id, ay.code AS academic_year_code,
  sem.id AS semester_id, sem.name AS semester_name
`;

const ENROLLMENT_JOINS = `
  LEFT JOIN sections sec ON sec.id = e.section_id
  LEFT JOIN courses c ON c.id = sec.course_id
  LEFT JOIN academic_years ay ON ay.id = sec.academic_year_id
  LEFT JOIN semesters sem ON sem.id = sec.semester_id
`;

function toPublicEnrollment(row) {
  return {
    id: row.id,
    uuid: row.uuid,
    status: row.status,
    grade: row.grade,
    section: row.section_id
      ? {
          id: row.section_id,
          section: row.section,
          sectionName: row.section_name,
          term: row.term,
          course: row.course_id ? { id: row.course_id, code: row.course_code, title: row.course_title } : null,
          academicYear: row.academic_year_id ? { id: row.academic_year_id, code: row.academic_year_code } : null,
          semester: row.semester_id ? { id: row.semester_id, name: row.semester_name } : null,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listEnrollments(studentId) {
  await requireStudent(studentId);
  const [rows] = await database
    .getPool()
    .query(`SELECT ${ENROLLMENT_SELECT} FROM enrollments e ${ENROLLMENT_JOINS} WHERE e.student_id = ? ORDER BY e.created_at DESC`, [studentId]);
  return rows.map(toPublicEnrollment);
}

async function getEnrollment(studentId, enrollmentId) {
  const [rows] = await database
    .getPool()
    .query(`SELECT ${ENROLLMENT_SELECT} FROM enrollments e ${ENROLLMENT_JOINS} WHERE e.student_id = ? AND e.id = ? LIMIT 1`, [studentId, enrollmentId]);
  return rows[0] ? toPublicEnrollment(rows[0]) : null;
}

async function addEnrollment(studentId, sectionId, actor, meta) {
  await requireStudent(studentId);

  const [sectionRows] = await database
    .getPool()
    .query('SELECT id, capacity, enrolled_count, is_active FROM sections WHERE id = ? LIMIT 1', [sectionId]);
  if (!sectionRows.length) throw validationError([{ field: 'sectionId', message: 'The selected section does not exist.' }]);
  const section = sectionRows[0];
  if (!section.is_active) throw validationError([{ field: 'sectionId', message: 'The selected section is not active.' }]);

  const [existing] = await database
    .getPool()
    .query('SELECT id, status FROM enrollments WHERE student_id = ? AND section_id = ? LIMIT 1', [studentId, sectionId]);

  if (existing.length && existing[0].status !== 'dropped') {
    throw ApiError.conflict('The student is already enrolled in this section.', { code: 'ALREADY_ENROLLED' });
  }

  if (!existing.length && Number(section.capacity) > 0 && Number(section.enrolled_count) >= Number(section.capacity)) {
    throw ApiError.conflict('The section has reached its capacity.', { code: 'CAPACITY_EXCEEDED' });
  }

  let enrollmentId;
  await database.withTransaction(async (connection) => {
    if (existing.length) {
      enrollmentId = existing[0].id;
      await connection.query('UPDATE enrollments SET status = ?, updated_at = NOW() WHERE id = ?', ['enrolled', enrollmentId]);
    } else {
      const [result] = await connection.query('INSERT INTO enrollments (student_id, section_id, status) VALUES (?, ?, ?)', [studentId, sectionId, 'enrolled']);
      enrollmentId = result.insertId;
    }
    await connection.query('UPDATE sections SET enrolled_count = enrolled_count + 1 WHERE id = ?', [sectionId]);
  });

  await auditService.record({ userId: actor.id, action: 'enrollment.create', entityType: 'enrollment', entityId: enrollmentId, after: { studentId, sectionId }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return getEnrollment(studentId, enrollmentId);
}

async function setEnrollmentStatus(studentId, enrollmentId, status, actor, meta) {
  await requireStudent(studentId);
  const [rows] = await database
    .getPool()
    .query('SELECT id, student_id, section_id, status FROM enrollments WHERE id = ? AND student_id = ? LIMIT 1', [enrollmentId, studentId]);
  if (!rows.length) throw ApiError.notFound('Enrollment not found.', { code: 'ENROLLMENT_NOT_FOUND' });
  const enrollment = rows[0];
  if (enrollment.status === status) return getEnrollment(studentId, enrollmentId);

  const wasEnrolled = enrollment.status === 'enrolled';
  const willEnroll = status === 'enrolled';

  await database.withTransaction(async (connection) => {
    await connection.query('UPDATE enrollments SET status = ?, updated_at = NOW() WHERE id = ?', [status, enrollmentId]);
    if (wasEnrolled && !willEnroll) {
      await connection.query('UPDATE sections SET enrolled_count = GREATEST(enrolled_count - 1, 0) WHERE id = ?', [enrollment.section_id]);
    } else if (!wasEnrolled && willEnroll) {
      await connection.query('UPDATE sections SET enrolled_count = enrolled_count + 1 WHERE id = ?', [enrollment.section_id]);
    }
  });

  await auditService.record({ userId: actor.id, action: 'enrollment.status', entityType: 'enrollment', entityId: enrollmentId, before: { status: enrollment.status }, after: { status }, ipAddress: meta.ip, userAgent: meta.userAgent });
  return getEnrollment(studentId, enrollmentId);
}

/** Dependency counts used before deleting a student. */
async function getStudentDependencies(id) {
  const [[enrollmentRows], [scheduledRows]] = await Promise.all([
    database.getPool().query('SELECT COUNT(*) AS total FROM enrollments WHERE student_id = ?', [id]),
    database.getPool().query(
      `SELECT COUNT(DISTINCT esd.id) AS total
         FROM enrollments e
         JOIN exam_schedule_details esd ON esd.section_id = e.section_id
        WHERE e.student_id = ?`,
      [id]
    ),
  ]);
  const counts = {
    enrollments: Number(enrollmentRows[0].total),
    scheduledExams: Number(scheduledRows[0].total),
  };
  return { ...counts, canDelete: counts.enrollments === 0 && counts.scheduledExams === 0 };
}

/**
 * Hard-delete a student only when they have no enrollments (and therefore no
 * examination assignments). Enrollments cascade on delete, so this is refused
 * while the student is enrolled anywhere.
 */
async function deleteStudent(id, actor, meta) {
  const before = await requireStudent(id);
  const dependencies = await getStudentDependencies(id);

  if (!dependencies.canDelete) {
    throw ApiError.conflict('This student cannot be deleted because enrollment records depend on them.', {
      code: 'STUDENT_IN_USE',
      details: [
        { field: 'enrollments', message: `${dependencies.enrollments} enrollment(s) reference this student.` },
        { field: 'scheduledExams', message: `${dependencies.scheduledExams} scheduled exam(s) involve this student's sections.` },
      ],
    });
  }

  try {
    await database.getPool().query('DELETE FROM students WHERE id = ?', [id]);
  } catch (error) {
    if (error && (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED')) {
      throw ApiError.conflict('This student is still referenced by other records.', { code: 'STUDENT_IN_USE' });
    }
    throw error;
  }

  await auditService.record({
    userId: actor.id,
    action: 'student.delete',
    entityType: 'student',
    entityId: id,
    before: { studentNumber: before.student_number, fullName: before.full_name },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return { id, deleted: true };
}

module.exports = {
  listStudents,
  getStudentById,
  getStudentDependencies,
  createStudent,
  updateStudent,
  setStudentStatus,
  listEnrollments,
  addEnrollment,
  setEnrollmentStatus,
  deleteStudent,
};
