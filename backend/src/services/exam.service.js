'use strict';

/**
 * Exam management (Phase 5).
 *
 * An exam is the schedulable unit: a course, an optional section, an exam
 * type, duration, optional room requirements, optional exam period/calendar
 * links, and a lifecycle status.
 *
 * The stored enrollment_count is a cache. The public enrollmentCount is
 * recomputed from real enrollments rows whenever an exam is retrieved.
 *
 * Consistency rules:
 *   - The selected section, if provided, must belong to the selected course.
 *   - Section calendar links must not contradict explicitly selected links.
 *   - A semester must belong to the selected academic year.
 *   - Duplicate exams of the same type and period are rejected.
 *   - Exams may be created without a section.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { assertDepartmentScope } = require('./scope');
const { paginate } = require('../validators/shared');

const SORT_COLUMNS = {
  created_at: 'e.created_at',
  title: 'e.title',
  exam_type: 'e.exam_type',
  status: 'e.status',
  duration_minutes: 'e.duration_minutes',
  exam_date: 'ep.start_date',
};

const SELECT_COLUMNS = `
  e.id, e.uuid, e.course_id, e.section_id, e.exam_period_id,
  e.academic_year_id, e.semester_id,
  e.exam_type, e.title, e.duration_minutes, e.required_room_type,
  e.required_capacity, e.enrollment_count, e.status, e.notes,
  e.created_by, e.created_at, e.updated_at,
  c.code AS course_code, c.title AS course_title,
  c.department_id AS course_department_id, c.program_id AS course_program_id,
  d.code AS department_code, d.name AS department_name,
  sec.section, sec.section_name, sec.term,
  sec.capacity AS section_capacity, sec.is_active AS section_is_active,
  sec.instructor_id AS section_instructor_id,
  ay.code AS academic_year_code, ay.name AS academic_year_name,
  sem.name AS semester_name, sem.sequence AS semester_sequence,
  ep.name AS period_name, ep.term AS period_term,
  ep.start_date AS period_start_date, ep.end_date AS period_end_date,
  ep.status AS period_status,
  (
    SELECT COUNT(*)
    FROM enrollments en
    WHERE en.section_id = e.section_id
      AND en.status = 'enrolled'
  ) AS live_enrollment_count,
  (
    SELECT COUNT(*)
    FROM exam_schedule_details esd
    JOIN exam_schedules es ON es.id = esd.exam_schedule_id
    WHERE esd.exam_id = e.id
      AND es.status <> 'cancelled'
      AND esd.status <> 'cancelled'
  ) AS scheduled_count
`;

const JOINS = `
  LEFT JOIN courses c ON c.id = e.course_id
  LEFT JOIN departments d ON d.id = c.department_id
  LEFT JOIN sections sec ON sec.id = e.section_id
  LEFT JOIN academic_years ay ON ay.id = e.academic_year_id
  LEFT JOIN semesters sem ON sem.id = e.semester_id
  LEFT JOIN exam_periods ep ON ep.id = e.exam_period_id
`;

const SCHEDULED_EXISTS = `EXISTS (
  SELECT 1
  FROM exam_schedule_details esd
  JOIN exam_schedules es ON es.id = esd.exam_schedule_id
  WHERE esd.exam_id = e.id
    AND es.status <> 'cancelled'
    AND esd.status <> 'cancelled'
)`;

function validationError(details) {
  return ApiError.badRequest('Validation failed.', {
    code: 'VALIDATION_ERROR',
    details,
  });
}

function toPublicExam(row) {
  if (!row) return null;

  const enrollmentCount =
    row.live_enrollment_count !== undefined
      ? Number(row.live_enrollment_count)
      : Number(row.enrollment_count || 0);

  return {
    id: row.id,
    uuid: row.uuid,
    title: row.title,
    examType: row.exam_type,
    durationMinutes: row.duration_minutes,
    requiredRoomType: row.required_room_type,
    requiredCapacity: row.required_capacity,
    enrollmentCount,
    status: row.status,
    notes: row.notes,

    course: row.course_id
      ? {
        id: row.course_id,
        code: row.course_code,
        title: row.course_title,
      }
      : null,

    department: row.course_department_id
      ? {
        id: row.course_department_id,
        code: row.department_code,
        name: row.department_name,
      }
      : null,

    programId: row.course_program_id,

    section: row.section_id
      ? {
        id: row.section_id,
        section: row.section,
        sectionName: row.section_name,
        term: row.term,
        capacity: row.section_capacity,
        isActive: Boolean(row.section_is_active),
        instructorId: row.section_instructor_id,
      }
      : null,

    academicYear: row.academic_year_id
      ? {
        id: row.academic_year_id,
        code: row.academic_year_code,
        name: row.academic_year_name,
      }
      : null,

    semester: row.semester_id
      ? {
        id: row.semester_id,
        name: row.semester_name,
        sequence: row.semester_sequence,
      }
      : null,

    examPeriod: row.exam_period_id
      ? {
        id: row.exam_period_id,
        name: row.period_name,
        term: row.period_term,
        startDate: row.period_start_date,
        endDate: row.period_end_date,
        status: row.period_status,
      }
      : null,

    isScheduled: Number(row.scheduled_count || 0) > 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Build exam list filters.
 */
function buildWhere(query, actor) {
  const clauses = [];
  const params = [];

  if (query.search) {
    const like = `%${query.search}%`;

    clauses.push(`
      (
        e.title LIKE ?
        OR c.code LIKE ?
        OR c.title LIKE ?
        OR sec.section LIKE ?
        OR sec.section_name LIKE ?
      )
    `);

    params.push(like, like, like, like, like);
  }

  if (query.courseId) {
    clauses.push('e.course_id = ?');
    params.push(query.courseId);
  }

  if (query.sectionId) {
    clauses.push('e.section_id = ?');
    params.push(query.sectionId);
  }

  if (query.departmentId) {
    clauses.push('c.department_id = ?');
    params.push(query.departmentId);
  }

  if (query.programId) {
    clauses.push('c.program_id = ?');
    params.push(query.programId);
  }

  if (query.semesterId) {
    clauses.push('e.semester_id = ?');
    params.push(query.semesterId);
  }

  if (query.academicYearId) {
    clauses.push('e.academic_year_id = ?');
    params.push(query.academicYearId);
  }

  if (query.examPeriodId) {
    clauses.push('e.exam_period_id = ?');
    params.push(query.examPeriodId);
  }

  if (query.examType) {
    clauses.push('e.exam_type = ?');
    params.push(query.examType);
  }

  if (query.status) {
    clauses.push('e.status = ?');
    params.push(query.status);
  }

  if (query.scheduleStatus === 'scheduled') {
    clauses.push(SCHEDULED_EXISTS);
  } else if (query.scheduleStatus === 'unscheduled') {
    clauses.push(`NOT ${SCHEDULED_EXISTS}`);
  }

  if (actor && actor.role === 'department_head') {
    clauses.push('c.department_id = ?');
    params.push(actor.departmentId || 0);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

/**
 * List exams with filtering, sorting, and pagination.
 */
async function listExams(query, actor) {
  const { where, params } = buildWhere(query, actor);

  const offset = (query.page - 1) * query.limit;
  const column = SORT_COLUMNS[query.sort] || SORT_COLUMNS.created_at;
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database.getPool().query(
    `SELECT COUNT(*) AS total
     FROM exams e
     LEFT JOIN courses c ON c.id = e.course_id
     LEFT JOIN sections sec ON sec.id = e.section_id
     ${where}`,
    params
  );

  const total = Number(countRows[0].total);

  const [rows] = await database.getPool().query(
    `SELECT ${SELECT_COLUMNS}
     FROM exams e
     ${JOINS}
     ${where}
     ORDER BY ${column} ${direction}, e.id ASC
     LIMIT ? OFFSET ?`,
    [...params, query.limit, offset]
  );

  return {
    items: rows.map(toPublicExam),
    pagination: paginate({
      page: query.page,
      limit: query.limit,
      total,
    }),
  };
}

/**
 * Get one exam in public API format.
 */
async function getPublicById(id) {
  const [rows] = await database.getPool().query(
    `SELECT ${SELECT_COLUMNS}
     FROM exams e
     ${JOINS}
     WHERE e.id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] ? toPublicExam(rows[0]) : null;
}

/**
 * Find the database record used internally by exam operations.
 */
async function findById(id) {
  const [rows] = await database.getPool().query(
    `SELECT
       id, course_id, section_id, exam_period_id,
       academic_year_id, semester_id, exam_type, title,
       duration_minutes, required_room_type, required_capacity,
       enrollment_count, status
     FROM exams
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function requireExam(id) {
  const row = await findById(id);

  if (!row) {
    throw ApiError.notFound('Exam not found.', {
      code: 'EXAM_NOT_FOUND',
    });
  }

  return row;
}

/**
 * Return the real enrollment count for a section.
 * Exams without a section have zero enrollments.
 */
async function computeEnrollmentCount(sectionId, connection = null) {
  if (!sectionId) return 0;

  const runner = connection || database.getPool();

  const [rows] = await runner.query(
    `SELECT COUNT(*) AS total
     FROM enrollments
     WHERE section_id = ?
       AND status = 'enrolled'`,
    [sectionId]
  );

  return Number(rows[0].total);
}

async function requireCourse(courseId) {
  const [rows] = await database.getPool().query(
    `SELECT id, code, title, department_id, program_id, is_active
     FROM courses
     WHERE id = ?
     LIMIT 1`,
    [courseId]
  );

  if (!rows.length) {
    throw validationError([
      {
        field: 'courseId',
        message: 'The selected course does not exist.',
      },
    ]);
  }

  return rows[0];
}

async function requireSectionRow(sectionId) {
  const [rows] = await database.getPool().query(
    `SELECT
       id, course_id, academic_year_id, semester_id,
       term, is_active
     FROM sections
     WHERE id = ?
     LIMIT 1`,
    [sectionId]
  );

  if (!rows.length) {
    throw validationError([
      {
        field: 'sectionId',
        message: 'The selected section does not exist.',
      },
    ]);
  }

  return rows[0];
}

async function requireAcademicYear(academicYearId) {
  const [rows] = await database.getPool().query(
    `SELECT id, code, name
     FROM academic_years
     WHERE id = ?
     LIMIT 1`,
    [academicYearId]
  );

  if (!rows.length) {
    throw validationError([
      {
        field: 'academicYearId',
        message: 'The selected academic year does not exist.',
      },
    ]);
  }

  return rows[0];
}

async function requireSemester(semesterId) {
  const [rows] = await database.getPool().query(
    `SELECT id, academic_year_id, name, sequence
     FROM semesters
     WHERE id = ?
     LIMIT 1`,
    [semesterId]
  );

  if (!rows.length) {
    throw validationError([
      {
        field: 'semesterId',
        message: 'The selected semester does not exist.',
      },
    ]);
  }

  return rows[0];
}

async function requireExamPeriod(examPeriodId) {
  const [rows] = await database.getPool().query(
    `SELECT id, name, term, start_date, end_date, status
     FROM exam_periods
     WHERE id = ?
     LIMIT 1`,
    [examPeriodId]
  );

  if (!rows.length) {
    throw validationError([
      {
        field: 'examPeriodId',
        message: 'The selected exam period does not exist.',
      },
    ]);
  }

  if (rows[0].status === 'archived') {
    throw validationError([
      {
        field: 'examPeriodId',
        message: 'The selected exam period is archived and cannot accept exams.',
      },
    ]);
  }

  return rows[0];
}

/**
 * Resolve and validate course, optional section, academic year, semester,
 * and exam period links.
 *
 * undefined: derive the calendar link from the section when possible.
 * null: explicitly no link.
 */
async function resolveExamLinks({
  courseId,
  sectionId,
  academicYearId,
  semesterId,
  examPeriodId,
}) {
  const course = await requireCourse(courseId);
  let section = null;

  if (sectionId !== undefined && sectionId !== null) {
    section = await requireSectionRow(sectionId);

    if (Number(section.course_id) !== Number(courseId)) {
      throw validationError([
        {
          field: 'sectionId',
          message: 'The selected section does not belong to the selected course.',
        },
      ]);
    }

    if (
      academicYearId &&
      section.academic_year_id &&
      Number(academicYearId) !== Number(section.academic_year_id)
    ) {
      throw validationError([
        {
          field: 'academicYearId',
          message: 'The academic year does not match the section.',
        },
      ]);
    }

    if (
      semesterId &&
      section.semester_id &&
      Number(semesterId) !== Number(section.semester_id)
    ) {
      throw validationError([
        {
          field: 'semesterId',
          message: 'The semester does not match the section.',
        },
      ]);
    }
  }

  let yearId =
    academicYearId === undefined
      ? section?.academic_year_id || null
      : academicYearId;

  let semId =
    semesterId === undefined
      ? section?.semester_id || null
      : semesterId;

  if (yearId) {
    await requireAcademicYear(yearId);
  }

  if (semId) {
    const semester = await requireSemester(semId);

    if (
      yearId &&
      Number(semester.academic_year_id) !== Number(yearId)
    ) {
      throw validationError([
        {
          field: 'semesterId',
          message: 'The selected semester does not belong to the chosen academic year.',
        },
      ]);
    }

    if (!yearId) {
      yearId = semester.academic_year_id;
    }
  }

  if (examPeriodId) {
    await requireExamPeriod(examPeriodId);
  }

  return {
    course,
    section,
    academicYearId: yearId || null,
    semesterId: semId || null,
  };
}

/**
 * Generate a readable title when the client does not provide one.
 */
function buildExamTitle(course, examType, suppliedTitle) {
  if (typeof suppliedTitle === 'string' && suppliedTitle.trim()) {
    return suppliedTitle.trim();
  }

  const typeLabel = String(examType || 'exam')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return `${course.code} — ${course.title} — ${typeLabel} Exam`;
}

/**
 * Prevent duplicate exams.
 *
 * Section-based exams are checked by section, type, and period.
 * Exams without a section are checked by course, type, period, year, semester.
 */
async function assertExamUnique(
  courseId,
  sectionId,
  examType,
  examPeriodId,
  academicYearId,
  semesterId,
  excludeId = null
) {
  let sql;
  let params;

  if (sectionId !== null && sectionId !== undefined) {
    sql = `
      SELECT id
      FROM exams
      WHERE section_id = ?
        AND exam_type = ?
    `;
    params = [sectionId, examType];
  } else {
    sql = `
      SELECT id
      FROM exams
      WHERE course_id = ?
        AND section_id IS NULL
        AND exam_type = ?
    `;
    params = [courseId, examType];

    if (academicYearId == null) {
      sql += ' AND academic_year_id IS NULL';
    } else {
      sql += ' AND academic_year_id = ?';
      params.push(academicYearId);
    }

    if (semesterId == null) {
      sql += ' AND semester_id IS NULL';
    } else {
      sql += ' AND semester_id = ?';
      params.push(semesterId);
    }
  }

  if (examPeriodId == null) {
    sql += ' AND exam_period_id IS NULL';
  } else {
    sql += ' AND exam_period_id = ?';
    params.push(examPeriodId);
  }

  if (excludeId !== null && excludeId !== undefined) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }

  const [rows] = await database.getPool().query(`${sql} LIMIT 1`, params);

  if (rows.length) {
    throw ApiError.conflict(
      'An exam of this type already exists for the selected course or section and period.',
      {
        code: 'DUPLICATE_EXAM',
        details: [
          {
            field: 'examType',
            message: 'This exam type is already recorded for the selected period.',
          },
        ],
      }
    );
  }
}

/**
 * Create an exam.
 */
async function createExam(input, actor, meta) {
  const sectionId = input.sectionId ?? null;

  const links = await resolveExamLinks({
    courseId: input.courseId,
    sectionId,
    academicYearId: input.academicYearId,
    semesterId: input.semesterId,
    examPeriodId: input.examPeriodId,
  });

  assertDepartmentScope(actor, links.course.department_id);

  const title = buildExamTitle(
    links.course,
    input.examType,
    input.title
  );

  await assertExamUnique(
    input.courseId,
    sectionId,
    input.examType,
    input.examPeriodId,
    links.academicYearId,
    links.semesterId
  );

  const enrollmentCount = await computeEnrollmentCount(sectionId);

  let insertId;

  try {
    const [result] = await database.getPool().query(
      `INSERT INTO exams (
         course_id,
         section_id,
         exam_period_id,
         academic_year_id,
         semester_id,
         exam_type,
         title,
         duration_minutes,
         required_room_type,
         required_capacity,
         enrollment_count,
         status,
         notes,
         created_by
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.courseId,
        sectionId,
        input.examPeriodId ?? null,
        links.academicYearId,
        links.semesterId,
        input.examType,
        title,
        input.durationMinutes,
        input.requiredRoomType ?? null,
        input.requiredCapacity ?? null,
        enrollmentCount,
        input.status ?? 'draft',
        input.notes ?? null,
        actor.id,
      ]
    );

    insertId = result.insertId;
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict(
        'An exam of this type already exists for the selected course or section and period.',
        { code: 'DUPLICATE_EXAM' }
      );
    }

    throw error;
  }

  const created = await getPublicById(insertId);

  await auditService.record({
    userId: actor.id,
    action: 'exam.create',
    entityType: 'exam',
    entityId: insertId,
    after: {
      courseId: input.courseId,
      sectionId,
      examType: input.examType,
      title,
      enrollmentCount,
    },
    ipAddress: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return created;
}

/**
 * Update an exam.
 */
async function updateExam(id, input, actor, meta) {
  const before = await requireExam(id);

  const effectiveCourseId =
    input.courseId !== undefined ? input.courseId : before.course_id;

  const effectiveSectionId =
    input.sectionId !== undefined ? input.sectionId : before.section_id;

  const effectiveYearId =
    input.academicYearId !== undefined
      ? input.academicYearId
      : before.academic_year_id;

  const effectiveSemId =
    input.semesterId !== undefined
      ? input.semesterId
      : before.semester_id;

  const effectivePeriodId =
    input.examPeriodId !== undefined
      ? input.examPeriodId
      : before.exam_period_id;

  const effectiveType =
    input.examType !== undefined ? input.examType : before.exam_type;

  const links = await resolveExamLinks({
    courseId: effectiveCourseId,
    sectionId: effectiveSectionId,
    academicYearId: effectiveYearId,
    semesterId: effectiveSemId,
    examPeriodId: effectivePeriodId,
  });

  assertDepartmentScope(actor, links.course.department_id);

  await assertExamUnique(
    effectiveCourseId,
    effectiveSectionId,
    effectiveType,
    effectivePeriodId,
    links.academicYearId,
    links.semesterId,
    id
  );

  const sectionChanged =
    Number(effectiveSectionId || 0) !== Number(before.section_id || 0);

  const enrollmentCount = sectionChanged
    ? await computeEnrollmentCount(effectiveSectionId)
    : before.enrollment_count;

  const sets = [];
  const params = [];

  const map = {
    examType: 'exam_type',
    title: 'title',
    durationMinutes: 'duration_minutes',
    requiredRoomType: 'required_room_type',
    requiredCapacity: 'required_capacity',
    status: 'status',
    notes: 'notes',
  };

  Object.entries(map).forEach(([key, column]) => {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(input[key]);
    }
  });

  const sync = {
    course_id: effectiveCourseId,
    section_id: effectiveSectionId ?? null,
    exam_period_id: effectivePeriodId ?? null,
    academic_year_id: links.academicYearId,
    semester_id: links.semesterId,
    enrollment_count: enrollmentCount,
  };

  const touched = new Set(sets.map((set) => set.split(' = ')[0]));

  Object.entries(sync).forEach(([column, value]) => {
    if (!touched.has(column)) {
      sets.push(`${column} = ?`);
      params.push(value);
    }
  });

  if (sets.length === 0) {
    return getPublicById(id);
  }

  sets.push('updated_at = NOW()');
  params.push(id);

  try {
    await database.getPool().query(
      `UPDATE exams
       SET ${sets.join(', ')}
       WHERE id = ?`,
      params
    );
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict(
        'An exam of this type already exists for the selected course or section and period.',
        { code: 'DUPLICATE_EXAM' }
      );
    }

    throw error;
  }

  const updated = await getPublicById(id);

  await auditService.record({
    userId: actor.id,
    action: 'exam.update',
    entityType: 'exam',
    entityId: id,
    before: {
      title: before.title,
      examType: before.exam_type,
      status: before.status,
    },
    after: {
      title: updated.title,
      examType: updated.examType,
      status: updated.status,
    },
    ipAddress: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return updated;
}

/**
 * Count active schedule references for an exam.
 */
async function countScheduleReferences(examId) {
  const [rows] = await database.getPool().query(
    `SELECT COUNT(*) AS total
     FROM exam_schedule_details esd
     JOIN exam_schedules es
       ON es.id = esd.exam_schedule_id
     WHERE esd.exam_id = ?
       AND es.status <> 'cancelled'
       AND esd.status <> 'cancelled'`,
    [examId]
  );

  return Number(rows[0].total);
}

/**
 * Count published schedule references for an exam.
 */
async function countPublishedReferences(examId) {
  const [rows] = await database.getPool().query(
    `SELECT COUNT(*) AS total
     FROM exam_schedule_details esd
     JOIN exam_schedules es
       ON es.id = esd.exam_schedule_id
     WHERE esd.exam_id = ?
       AND es.status = 'published'
       AND esd.status <> 'cancelled'`,
    [examId]
  );

  return Number(rows[0].total);
}

/**
 * Change an exam's lifecycle status.
 */
async function setExamStatus(id, status, actor, meta) {
  const before = await requireExam(id);
  const course = await requireCourse(before.course_id);

  assertDepartmentScope(actor, course.department_id);

  if (status === 'cancelled') {
    const published = await countPublishedReferences(id);

    if (published > 0) {
      throw ApiError.conflict(
        'This exam is part of a published schedule. Cancel the schedule first.',
        {
          code: 'EXAM_IN_PUBLISHED_SCHEDULE',
          details: [
            {
              field: 'status',
              message: `${published} published schedule entry(ies) reference this exam.`,
            },
          ],
        }
      );
    }

    await database.getPool().query(
      `UPDATE exam_schedule_details
       SET status = 'cancelled', updated_at = NOW()
       WHERE exam_id = ?
         AND status <> 'cancelled'`,
      [id]
    );
  }

  await database.getPool().query(
    `UPDATE exams
     SET status = ?, updated_at = NOW()
     WHERE id = ?`,
    [status, id]
  );

  const updated = await getPublicById(id);

  await auditService.record({
    userId: actor.id,
    action: `exam.${status}`,
    entityType: 'exam',
    entityId: id,
    before: { status: before.status },
    after: { status: updated.status },
    ipAddress: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return updated;
}

/**
 * Delete an exam only when no active schedule entry references it.
 */
async function deleteExam(id, actor, meta) {
  const before = await requireExam(id);
  const course = await requireCourse(before.course_id);

  assertDepartmentScope(actor, course.department_id);

  const references = await countScheduleReferences(id);

  if (references > 0) {
    throw ApiError.conflict(
      'This exam cannot be deleted while it is referenced by a schedule. Remove it from the schedule or cancel it first.',
      {
        code: 'EXAM_IN_USE',
        details: [
          {
            field: 'id',
            message: `${references} schedule entry(ies) reference this exam.`,
          },
        ],
      }
    );
  }

  await database.getPool().query(
    'DELETE FROM exams WHERE id = ?',
    [id]
  );

  await auditService.record({
    userId: actor.id,
    action: 'exam.delete',
    entityType: 'exam',
    entityId: id,
    before: {
      title: before.title,
      examType: before.exam_type,
    },
    ipAddress: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return { id };
}

module.exports = {
  listExams,
  getPublicById,
  findById,
  requireExam,
  computeEnrollmentCount,
  createExam,
  updateExam,
  setExamStatus,
  deleteExam,
  countScheduleReferences,
};
