'use strict';

/**
 * Reports & analytics service (Phase 7).
 *
 * Every figure here is computed live from the real database with parameterized
 * SQL. Nothing is sampled, hard-coded or estimated. Optional filters
 * (`departmentId`, `examPeriodId`) are applied through `?` placeholders only.
 */

const database = require('../config/database');

function num(value) {
  return Number(value || 0);
}

/**
 * Build the department-scoped clause for queries that can be joined back to a
 * department through courses (or programs). Returns `{ clause, params }` where
 * `clause` is safe to append to a WHERE clause that already has conditions.
 */
function departmentClause(departmentId, column) {
  if (!departmentId) return { clause: '', params: [] };
  return { clause: `${column} = ?`, params: [departmentId] };
}

/** High-level totals for the report header cards. */
async function getOverview({ departmentId = null, examPeriodId = null } = {}) {
  const pool = database.getPool();
  const dept = departmentClause(departmentId, 'c.department_id');
  const deptWhere = dept.clause ? `WHERE ${dept.clause}` : '';

  const examConditions = [];
  const examParams = [];
  if (examPeriodId) {
    examConditions.push('e.exam_period_id = ?');
    examParams.push(examPeriodId);
  }
  if (departmentId) {
    examConditions.push('c.department_id = ?');
    examParams.push(departmentId);
  }
  const examWhere = examConditions.length ? `WHERE ${examConditions.join(' AND ')}` : '';

  const [
    [departmentRows],
    [programRows],
    [courseRows],
    [sectionRows],
    [studentRows],
    [instructorRows],
    [buildingRows],
    [roomRows],
    [examRows],
    [scheduleRows],
    [detailRows],
    [conflictRows],
    [invigilatorRows],
    [dutyRows],
  ] = await Promise.all([
    pool.query('SELECT COUNT(*) AS total FROM departments WHERE is_active = 1'),
    pool.query(
      `SELECT COUNT(*) AS total FROM programs p JOIN departments d ON d.id = p.department_id ${
        departmentId ? 'WHERE p.department_id = ?' : ''
      }`,
      departmentId ? [departmentId] : []
    ),
    pool.query(
      `SELECT COUNT(*) AS total FROM courses c ${departmentId ? 'WHERE c.department_id = ?' : ''}`,
      departmentId ? [departmentId] : []
    ),
    pool.query(
      `SELECT COUNT(*) AS total FROM sections s JOIN courses c ON c.id = s.course_id ${deptWhere}`,
      dept.params
    ),
    pool.query(
      `SELECT COUNT(*) AS total FROM students st JOIN programs p ON p.id = st.program_id WHERE st.status = 'active'${
        departmentId ? ' AND p.department_id = ?' : ''
      }`,
      departmentId ? [departmentId] : []
    ),
    pool.query(
      `SELECT COUNT(*) AS total FROM instructors i WHERE i.is_active = 1${
        departmentId ? ' AND i.department_id = ?' : ''
      }`,
      departmentId ? [departmentId] : []
    ),
    pool.query('SELECT COUNT(*) AS total FROM buildings'),
    pool.query('SELECT COUNT(*) AS total FROM rooms r WHERE r.is_active = 1'),
    pool.query(
      `SELECT COUNT(DISTINCT e.id) AS total FROM exams e JOIN courses c ON c.id = e.course_id ${examWhere}`,
      examParams
    ),
    pool.query(
      `SELECT COUNT(DISTINCT es.id) AS total FROM exam_schedules es WHERE 1 = 1${
        examPeriodId ? ' AND es.exam_period_id = ?' : ''
      }`,
      examPeriodId ? [examPeriodId] : []
    ),
    pool.query(
      `SELECT COUNT(*) AS total
       FROM exam_schedule_details esd
       JOIN exam_schedules es ON es.id = esd.exam_schedule_id
       JOIN sections s ON s.id = esd.section_id
       JOIN courses c ON c.id = s.course_id
       JOIN exams e ON e.id = esd.exam_id
       WHERE esd.status IN ('scheduled','confirmed','completed')
         AND es.status NOT IN ('cancelled','archived')
         ${examPeriodId ? 'AND e.exam_period_id = ?' : ''}
         ${departmentId ? 'AND c.department_id = ?' : ''}`,
      [...(examPeriodId ? [examPeriodId] : []), ...(departmentId ? [departmentId] : [])]
    ),
    pool.query(
      `SELECT COUNT(*) AS total FROM schedule_conflicts sc
       JOIN exam_schedules es ON es.id = sc.exam_schedule_id
       WHERE sc.status = 'open'${examPeriodId ? ' AND es.exam_period_id = ?' : ''}`,
      examPeriodId ? [examPeriodId] : []
    ),
    pool.query(
      `SELECT COUNT(*) AS total FROM invigilators i WHERE i.is_active = 1${
        departmentId ? ' AND i.department_id = ?' : ''
      }`,
      departmentId ? [departmentId] : []
    ),
    pool.query(
      `SELECT COUNT(*) AS total FROM invigilations iv WHERE iv.status NOT IN ('cancelled')`
    ),
  ]);

  return {
    departments: num(departmentRows[0].total),
    programs: num(programRows[0].total),
    courses: num(courseRows[0].total),
    sections: num(sectionRows[0].total),
    students: num(studentRows[0].total),
    instructors: num(instructorRows[0].total),
    buildings: num(buildingRows[0].total),
    rooms: num(roomRows[0].total),
    exams: num(examRows[0].total),
    schedules: num(scheduleRows[0].total),
    scheduledExams: num(detailRows[0].total),
    openConflicts: num(conflictRows[0].total),
    invigilators: num(invigilatorRows[0].total),
    duties: num(dutyRows[0].total),
  };
}

/** Exam / course / section / student load per department. */
async function getExamLoad({ departmentId = null, examPeriodId = null } = {}) {
  const pool = database.getPool();
  const deptParam = departmentId ? [departmentId] : [];
  const periodParam = examPeriodId ? [examPeriodId] : [];

  const [departments] = await pool.query(
    `SELECT id, code, name FROM departments ${departmentId ? 'WHERE id = ?' : ''} ORDER BY name ASC`,
    deptParam
  );

  const [courseRows] = await pool.query(
    `SELECT c.department_id AS departmentId, COUNT(*) AS total FROM courses c ${
      departmentId ? 'WHERE c.department_id = ?' : ''
    } GROUP BY c.department_id`,
    deptParam
  );
  const [sectionRows] = await pool.query(
    `SELECT c.department_id AS departmentId, COUNT(*) AS total
     FROM sections s JOIN courses c ON c.id = s.course_id
     ${departmentId ? 'WHERE c.department_id = ?' : ''}
     GROUP BY c.department_id`,
    deptParam
  );
  const [examRows] = await pool.query(
    `SELECT c.department_id AS departmentId, COUNT(DISTINCT e.id) AS total
     FROM exams e JOIN courses c ON c.id = e.course_id
     ${examPeriodId ? 'WHERE e.exam_period_id = ?' : ''}
     GROUP BY c.department_id`,
    periodParam
  );
  const [studentRows] = await pool.query(
    `SELECT p.department_id AS departmentId, COUNT(*) AS total
     FROM students st JOIN programs p ON p.id = st.program_id
     WHERE st.status = 'active'
     GROUP BY p.department_id`
  );

  const toMap = (rows, key) => new Map(rows.map((row) => [Number(row.departmentId), num(row[key])]));
  const courseMap = toMap(courseRows, 'total');
  const sectionMap = toMap(sectionRows, 'total');
  const examMap = toMap(examRows, 'total');
  const studentMap = toMap(studentRows, 'total');

  return departments.map((dept) => ({
    departmentId: dept.id,
    code: dept.code,
    department: dept.name,
    courses: courseMap.get(Number(dept.id)) || 0,
    sections: sectionMap.get(Number(dept.id)) || 0,
    exams: examMap.get(Number(dept.id)) || 0,
    students: studentMap.get(Number(dept.id)) || 0,
  }));
}

/** Room capacity vs the largest single exam seated in the room. */
async function getRoomUtilization() {
  const [rows] = await database.getPool().query(
    `SELECT
        r.id AS roomId,
        r.name AS room,
        b.name AS building,
        r.type,
        r.capacity,
        r.is_active,
        COUNT(esd.id) AS assignments,
        COALESCE(MAX(esd.total_students), 0) AS peakStudents,
        COALESCE(SUM(esd.total_students), 0) AS totalSeats
     FROM rooms r
     LEFT JOIN buildings b ON b.id = r.building_id
     LEFT JOIN exam_schedule_details esd
       ON esd.room_id = r.id AND esd.status IN ('scheduled','confirmed','completed')
     GROUP BY r.id, r.name, b.name, r.type, r.capacity, r.is_active
     ORDER BY r.name ASC`
  );

  return rows.map((row) => {
    const capacity = num(row.capacity);
    const peak = num(row.peakStudents);
    return {
      roomId: row.roomId,
      room: row.room,
      building: row.building || '',
      type: row.type,
      capacity,
      assignments: num(row.assignments),
      peakStudents: peak,
      totalSeats: num(row.totalSeats),
      isActive: Boolean(row.is_active),
      utilizationPercent: capacity > 0 ? Math.min(100, Math.round((peak / capacity) * 100)) : 0,
    };
  });
}

/** Conflicts grouped by type + severity, with status totals. */
async function getConflicts({ examPeriodId = null } = {}) {
  const params = examPeriodId ? [examPeriodId] : [];
  const periodJoin = examPeriodId ? 'AND es.exam_period_id = ?' : '';

  const [typeRows] = await database.getPool().query(
    `SELECT sc.type, COUNT(*) AS count
     FROM schedule_conflicts sc
     JOIN exam_schedules es ON es.id = sc.exam_schedule_id
     WHERE 1 = 1 ${periodJoin}
     GROUP BY sc.type ORDER BY count DESC`,
    params
  );

  const [severityRows] = await database.getPool().query(
    `SELECT sc.severity, COUNT(*) AS count
     FROM schedule_conflicts sc
     JOIN exam_schedules es ON es.id = sc.exam_schedule_id
     WHERE 1 = 1 ${periodJoin}
     GROUP BY sc.severity`,
    params
  );

  const [statusRows] = await database.getPool().query(
    `SELECT sc.status, COUNT(*) AS count
     FROM schedule_conflicts sc
     JOIN exam_schedules es ON es.id = sc.exam_schedule_id
     WHERE 1 = 1 ${periodJoin}
     GROUP BY sc.status`,
    params
  );

  return {
    byType: typeRows.map((row) => ({ type: String(row.type).replace(/_/g, ' '), count: num(row.count) })),
    bySeverity: severityRows.map((row) => ({ severity: row.severity, count: num(row.count) })),
    byStatus: statusRows.map((row) => ({ status: row.status, count: num(row.count) })),
  };
}

/** Invigilator duty distribution + the busiest invigilators. */
async function getInvigilationWorkload({ departmentId = null } = {}) {
  const params = departmentId ? [departmentId] : [];
  const [rows] = await database.getPool().query(
    `SELECT i.id AS invigilatorId, u.full_name AS name, d.code AS department,
            COUNT(iv.id) AS duties
     FROM invigilators i
     JOIN users u ON u.id = i.user_id
     LEFT JOIN departments d ON d.id = i.department_id
     LEFT JOIN invigilations iv ON iv.invigilator_id = i.id AND iv.status <> 'cancelled'
     ${departmentId ? 'WHERE i.department_id = ?' : ''}
     GROUP BY i.id, u.full_name, d.code
     ORDER BY duties DESC, u.full_name ASC`,
    params
  );

  const list = rows.map((row) => ({
    invigilatorId: row.invigilatorId,
    name: row.name,
    department: row.department || 'Unassigned',
    duties: num(row.duties),
  }));

  const buckets = { '0 duties': 0, '1–2 duties': 0, '3–4 duties': 0, '5+ duties': 0 };
  for (const item of list) {
    if (item.duties === 0) buckets['0 duties'] += 1;
    else if (item.duties <= 2) buckets['1–2 duties'] += 1;
    else if (item.duties <= 4) buckets['3–4 duties'] += 1;
    else buckets['5+ duties'] += 1;
  }

  return {
    distribution: Object.entries(buckets).map(([name, value]) => ({ name, value })),
    top: list.slice(0, 10),
    totalInvigilators: list.length,
  };
}

/** Everything the reports page needs in one round-trip. */
async function getSummary(filters = {}) {
  const [overview, examLoad, roomUtilization, conflicts, invigilation] = await Promise.all([
    getOverview(filters),
    getExamLoad(filters),
    getRoomUtilization(),
    getConflicts(filters),
    getInvigilationWorkload(filters),
  ]);
  return { overview, examLoad, roomUtilization, conflicts, invigilation };
}

module.exports = {
  getOverview,
  getExamLoad,
  getRoomUtilization,
  getConflicts,
  getInvigilationWorkload,
  getSummary,
};
