
'use strict';

/**
 * Course management (Phase 3, module 3).
 *
 * Supports flexible course codes, subject to database constraints.
 * Prerequisite replacement runs inside a transaction.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { assertDepartmentScope } = require('./scope');
const { paginate } = require('../validators/shared');

const SORT_COLUMNS = {
  created_at: 'c.created_at',
  title: 'c.title',
  code: 'c.code',
  credits: 'c.credits',
  is_active: 'c.is_active',
};

const SELECT_COLUMNS = `
  c.id, c.uuid, c.department_id, c.program_id, c.code, c.title,
  c.description, c.credits, c.is_active, c.created_at, c.updated_at,
  d.code AS department_code, d.name AS department_name,
  pr.code AS program_code, pr.name AS program_name,
  (
    SELECT COUNT(*)
    FROM course_prerequisites cp
    WHERE cp.course_id = c.id
  ) AS prerequisite_count
`;

function toPublicCourse(row) {
  if (!row) return null;

  return {
    id: row.id,
    uuid: row.uuid,
    code: row.code,
    title: row.title,
    credits: row.credits,
    description: row.description,
    isActive: Boolean(row.is_active),
    department: row.department_id
      ? {
        id: row.department_id,
        code: row.department_code,
        name: row.department_name,
      }
      : null,
    program: row.program_id
      ? {
        id: row.program_id,
        code: row.program_code,
        name: row.program_name,
      }
      : null,
    prerequisiteCount: Number(row.prerequisite_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildWhere(query = {}) {
  const clauses = [];
  const params = [];

  if (query.search) {
    const like = `%${query.search}%`;

    clauses.push(
      '(c.title LIKE ? OR c.code LIKE ? OR c.description LIKE ?)'
    );

    params.push(like, like, like);
  }

  if (query.departmentId) {
    clauses.push('c.department_id = ?');
    params.push(query.departmentId);
  }

  if (query.programId) {
    clauses.push('c.program_id = ?');
    params.push(query.programId);
  }

  if (query.isActive !== null && query.isActive !== undefined) {
    clauses.push('c.is_active = ?');
    params.push(query.isActive ? 1 : 0);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

async function listCourses(query) {
  const { where, params } = buildWhere(query);
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 10;
  const offset = (page - 1) * limit;

  const column = SORT_COLUMNS[query.sort] || SORT_COLUMNS.code;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';
  const pool = database.getPool();

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM courses c ${where}`,
    params
  );

  const total = Number(countRows[0].total);

  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS}
     FROM courses c
     LEFT JOIN departments d ON d.id = c.department_id
     LEFT JOIN programs pr ON pr.id = c.program_id
     ${where}
     ORDER BY ${column} ${direction}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(toPublicCourse),
    pagination: paginate({ page, limit, total }),
  };
}

async function listOptions({
  departmentId = null,
  programId = null,
} = {}) {
  const clauses = ['c.is_active = 1'];
  const params = [];

  if (departmentId) {
    clauses.push('c.department_id = ?');
    params.push(departmentId);
  }

  if (programId) {
    clauses.push('c.program_id = ?');
    params.push(programId);
  }

  const [rows] = await database.getPool().query(
    `SELECT
       c.id, c.code, c.title, c.credits,
       c.department_id, c.program_id
     FROM courses c
     WHERE ${clauses.join(' AND ')}
     ORDER BY c.code ASC`,
    params
  );

  return rows;
}

async function getPrerequisites(courseId) {
  const [rows] = await database.getPool().query(
    `SELECT c.id, c.code, c.title
     FROM course_prerequisites cp
     JOIN courses c ON c.id = cp.prerequisite_course_id
     WHERE cp.course_id = ?
     ORDER BY c.code ASC`,
    [courseId]
  );

  return rows;
}

async function getPublicById(id) {
  const [rows] = await database.getPool().query(
    `SELECT ${SELECT_COLUMNS}
     FROM courses c
     LEFT JOIN departments d ON d.id = c.department_id
     LEFT JOIN programs pr ON pr.id = c.program_id
     WHERE c.id = ?
     LIMIT 1`,
    [id]
  );

  if (!rows[0]) return null;

  const course = toPublicCourse(rows[0]);
  course.prerequisites = await getPrerequisites(id);

  return course;
}

async function findById(id) {
  const [rows] = await database.getPool().query(
    `SELECT
       id, department_id, program_id, code, title,
       credits, description, is_active
     FROM courses
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function requireCourse(id) {
  const row = await findById(id);

  if (!row) {
    throw ApiError.notFound('Course not found.', {
      code: 'COURSE_NOT_FOUND',
    });
  }

  return row;
}

async function assertDepartmentExists(departmentId) {
  const [rows] = await database.getPool().query(
    'SELECT id FROM departments WHERE id = ? LIMIT 1',
    [departmentId]
  );

  if (!rows.length) {
    throw ApiError.badRequest('Validation failed.', {
      code: 'VALIDATION_ERROR',
      details: [
        {
          field: 'departmentId',
          message: 'The selected department does not exist.',
        },
      ],
    });
  }
}

async function assertProgramInDepartment(programId, departmentId) {
  if (programId === null || programId === undefined) return;

  const [rows] = await database.getPool().query(
    'SELECT id, department_id FROM programs WHERE id = ? LIMIT 1',
    [programId]
  );

  if (!rows.length) {
    throw ApiError.badRequest('Validation failed.', {
      code: 'VALIDATION_ERROR',
      details: [
        {
          field: 'programId',
          message: 'The selected program does not exist.',
        },
      ],
    });
  }

  if (Number(rows[0].department_id) !== Number(departmentId)) {
    throw ApiError.badRequest('Validation failed.', {
      code: 'VALIDATION_ERROR',
      details: [
        {
          field: 'programId',
          message:
            'The selected program does not belong to the chosen department.',
        },
      ],
    });
  }
}

/**
 * Course codes may contain arbitrary characters.
 * They must still be non-empty and satisfy the validator and DB column limits.
 */
async function assertCodeFree(code, excludeId = null) {
  const [rows] = await database.getPool().query(
    `SELECT id
     FROM courses
     WHERE code = ?
       AND (? IS NULL OR id <> ?)
     LIMIT 1`,
    [code, excludeId, excludeId]
  );

  if (rows.length) {
    throw ApiError.conflict('A course with this code already exists.', {
      code: 'DUPLICATE_COURSE_CODE',
      details: [
        {
          field: 'code',
          message: 'This course code is already in use.',
        },
      ],
    });
  }
}

const UPDATE_COLUMNS = {
  departmentId: 'department_id',
  programId: 'program_id',
  code: 'code',
  title: 'title',
  credits: 'credits',
  description: 'description',
  isActive: 'is_active',
};

async function createCourse(input, actor, meta = {}) {
  assertDepartmentScope(actor, input.departmentId);

  await assertDepartmentExists(input.departmentId);
  await assertProgramInDepartment(input.programId, input.departmentId);
  await assertCodeFree(input.code);

  let insertId;

  try {
    const [result] = await database.getPool().query(
      `INSERT INTO courses
       (
         department_id, program_id, code, title,
         description, credits, is_active
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.departmentId,
        input.programId ?? null,
        input.code,
        input.title,
        input.description ?? null,
        input.credits,
        Number(input.isActive),
      ]
    );

    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict(
        'A course with these unique details already exists.',
        { code: 'DUPLICATE_ENTRY' }
      );
    }

    throw error;
  }

  const created = await getPublicById(insertId);

  await auditService.record({
    userId: actor.id,
    action: 'course.create',
    entityType: 'course',
    entityId: insertId,
    after: {
      code: created.code,
      title: created.title,
      departmentId: created.department?.id,
    },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return created;
}

async function updateCourse(id, input, actor, meta = {}) {
  const before = await requireCourse(id);

  assertDepartmentScope(actor, before.department_id);

  const departmentId =
    input.departmentId !== undefined
      ? input.departmentId
      : before.department_id;

  if (input.departmentId !== undefined) {
    assertDepartmentScope(actor, input.departmentId);
    await assertDepartmentExists(input.departmentId);
  }

  if (
    input.programId !== undefined ||
    input.departmentId !== undefined
  ) {
    const programId =
      input.programId !== undefined
        ? input.programId
        : before.program_id;

    await assertProgramInDepartment(programId, departmentId);
  }

  if (input.code !== undefined) {
    await assertCodeFree(input.code, id);
  }

  const sets = [];
  const params = [];

  for (const [key, column] of Object.entries(UPDATE_COLUMNS)) {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);

      let value = input[key];

      if (typeof value === 'boolean') {
        value = Number(value);
      }

      if (key === 'programId' && value === '') {
        value = null;
      }

      if (key === 'description' && value === '') {
        value = null;
      }

      params.push(value);
    }
  }

  if (!sets.length) {
    return getPublicById(id);
  }

  sets.push('updated_at = NOW()');
  params.push(id);

  try {
    await database.getPool().query(
      `UPDATE courses
       SET ${sets.join(', ')}
       WHERE id = ?`,
      params
    );
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict(
        'A course with these unique details already exists.',
        { code: 'DUPLICATE_ENTRY' }
      );
    }

    throw error;
  }

  const updated = await getPublicById(id);

  await auditService.record({
    userId: actor.id,
    action: 'course.update',
    entityType: 'course',
    entityId: id,
    before: {
      code: before.code,
      title: before.title,
    },
    after: {
      code: updated.code,
      title: updated.title,
    },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return updated;
}

async function setCourseStatus(id, isActive, actor, meta = {}) {
  const before = await requireCourse(id);

  assertDepartmentScope(actor, before.department_id);

  await database.getPool().query(
    `UPDATE courses
     SET is_active = ?, updated_at = NOW()
     WHERE id = ?`,
    [Number(isActive), id]
  );

  const updated = await getPublicById(id);

  await auditService.record({
    userId: actor.id,
    action: isActive ? 'course.activate' : 'course.deactivate',
    entityType: 'course',
    entityId: id,
    before: {
      isActive: Boolean(before.is_active),
    },
    after: {
      isActive: updated.isActive,
    },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return updated;
}

async function replacePrerequisites(courseId, ids, actor, meta = {}) {
  const course = await requireCourse(courseId);

  assertDepartmentScope(actor, course.department_id);

  if (ids.includes(Number(courseId))) {
    throw ApiError.badRequest('Validation failed.', {
      code: 'VALIDATION_ERROR',
      details: [
        {
          field: 'prerequisiteIds',
          message: 'A course cannot be its own prerequisite.',
        },
      ],
    });
  }

  if (ids.length) {
    const placeholders = ids.map(() => '?').join(', ');

    const [rows] = await database.getPool().query(
      `SELECT id
       FROM courses
       WHERE id IN (${placeholders})`,
      ids
    );

    if (rows.length !== ids.length) {
      throw ApiError.badRequest('Validation failed.', {
        code: 'VALIDATION_ERROR',
        details: [
          {
            field: 'prerequisiteIds',
            message: 'One or more prerequisite courses do not exist.',
          },
        ],
      });
    }
  }

  await database.withTransaction(async (connection) => {
    await connection.query(
      'DELETE FROM course_prerequisites WHERE course_id = ?',
      [courseId]
    );

    if (ids.length) {
      const values = ids.map(() => '(?, ?)').join(', ');
      const params = [];

      ids.forEach((prerequisiteId) => {
        params.push(courseId, prerequisiteId);
      });

      await connection.query(
        `INSERT INTO course_prerequisites
         (course_id, prerequisite_course_id)
         VALUES ${values}`,
        params
      );
    }
  });

  await auditService.record({
    userId: actor.id,
    action: 'course.prerequisites.replace',
    entityType: 'course',
    entityId: courseId,
    after: {
      prerequisiteIds: ids,
    },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return getPublicById(courseId);
}

/** Dependency counts used before deleting / deactivating a course. */
async function getCourseDependencies(id) {
  const [[sectionRows], [examRows], [enrollmentRows], [prereqRows]] = await Promise.all([
    database.getPool().query('SELECT COUNT(*) AS total FROM sections WHERE course_id = ?', [id]),
    database.getPool().query('SELECT COUNT(*) AS total FROM exams WHERE course_id = ?', [id]),
    database.getPool().query(
      'SELECT COUNT(*) AS total FROM enrollments e JOIN sections s ON s.id = e.section_id WHERE s.course_id = ?',
      [id]
    ),
    database.getPool().query(
      'SELECT COUNT(*) AS total FROM course_prerequisites WHERE course_id = ? OR prerequisite_course_id = ?',
      [id, id]
    ),
  ]);
  const counts = {
    sections: Number(sectionRows[0].total),
    exams: Number(examRows[0].total),
    enrollments: Number(enrollmentRows[0].total),
    prerequisites: Number(prereqRows[0].total),
  };
  // Prerequisites are cascaded safely; sections/exams/enrollments are not.
  return {
    ...counts,
    canDelete: counts.sections === 0 && counts.exams === 0 && counts.enrollments === 0,
  };
}

/**
 * Hard-delete a course only when it is not referenced by sections, exams or
 * enrollments. Deleting otherwise would cascade-delete sections (and their
 * enrollments) and exams, so the operation is refused.
 */
async function deleteCourse(id, actor, meta) {
  const before = await requireCourse(id);
  const dependencies = await getCourseDependencies(id);

  if (!dependencies.canDelete) {
    throw ApiError.conflict('This course cannot be deleted because records depend on it.', {
      code: 'COURSE_IN_USE',
      details: [
        { field: 'sections', message: `${dependencies.sections} section(s) reference this course.` },
        { field: 'exams', message: `${dependencies.exams} exam(s) reference this course.` },
        { field: 'enrollments', message: `${dependencies.enrollments} enrollment(s) reference sections of this course.` },
      ],
    });
  }

  try {
    await database.getPool().query('DELETE FROM courses WHERE id = ?', [id]);
  } catch (error) {
    if (error && (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED')) {
      throw ApiError.conflict('This course is still referenced by other records.', { code: 'COURSE_IN_USE' });
    }
    throw error;
  }

  await auditService.record({
    userId: actor.id,
    action: 'course.delete',
    entityType: 'course',
    entityId: id,
    before: { code: before.code, title: before.title },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return { id, deleted: true };
}

module.exports = {
  listCourses,
  listOptions,
  getPublicById,
  getPrerequisites,
  getCourseDependencies,
  createCourse,
  updateCourse,
  setCourseStatus,
  replacePrerequisites,
  deleteCourse,
};
