
'use strict';

const database = require('../config/database');

async function getDashboard() {
  const pool = database.getPool();

  const [
    [studentRows],
    [courseRows],
    [roomRows],
    [examRows],
    [upcomingExams],
    [conflicts],
    [conflictCountRows],
  ] = await Promise.all([
    // 1. Count active students
    pool.query(
      "SELECT COUNT(*) AS total FROM students WHERE status = 'active'"
    ),

    // 2. Count active courses
    pool.query(
      'SELECT COUNT(*) AS total FROM courses WHERE is_active = 1'
    ),

    // 3. Count active rooms
    pool.query(
      'SELECT COUNT(*) AS total FROM rooms WHERE is_active = 1'
    ),

    // 4. Count exams and scheduled exam details
    pool.query(`
            SELECT
                COUNT(DISTINCT e.id) AS total,
                COUNT(
                    DISTINCT CASE
                        WHEN esd.id IS NOT NULL
                         AND es.id IS NOT NULL
                        THEN esd.id
                    END
                ) AS scheduled
            FROM exams e
            LEFT JOIN exam_schedule_details esd
                ON esd.exam_id = e.id
                AND esd.status IN (
                    'scheduled',
                    'confirmed',
                    'completed'
                )
            LEFT JOIN exam_schedules es
                ON es.id = esd.exam_schedule_id
                AND es.status NOT IN ('cancelled', 'archived')
            WHERE e.status <> 'cancelled'
        `),

    // 5. Get the next eight upcoming exams
    pool.query(`
            SELECT
                esd.id,
                esd.exam_date AS date,
                esd.start_time AS startTime,
                esd.end_time AS endTime,
                esd.status,
                esd.total_students AS students,
                COALESCE(c.code, '') AS courseCode,
                COALESCE(c.title, e.title, 'Examination') AS courseTitle,
                COALESCE(r.name, 'Unassigned room') AS room,
                COALESCE(b.name, 'Unassigned building') AS building
            FROM exam_schedule_details esd
            JOIN exam_schedules es
                ON es.id = esd.exam_schedule_id
            LEFT JOIN exams e
                ON e.id = esd.exam_id
            LEFT JOIN sections sec
                ON sec.id = esd.section_id
            LEFT JOIN courses c
                ON c.id = COALESCE(e.course_id, sec.course_id)
            LEFT JOIN rooms r
                ON r.id = esd.room_id
            LEFT JOIN buildings b
                ON b.id = r.building_id
            WHERE esd.status IN ('scheduled', 'confirmed')
                AND es.status IN ('generated', 'reviewed', 'published')
                AND esd.exam_date >= CURRENT_DATE()
            ORDER BY
                esd.exam_date ASC,
                esd.start_time ASC
            LIMIT 8
        `),

    // 6. Get the six most important open conflicts
    pool.query(`
            SELECT
                sc.id,
                sc.type,
                sc.severity,
                sc.status,
                sc.title,
                COALESCE(sc.description, '') AS description,
                COALESCE(r.name, '') AS room,
                COALESCE(b.name, '') AS building
            FROM schedule_conflicts sc
            LEFT JOIN exam_schedule_details esd
                ON esd.id = sc.exam_schedule_detail_id
            LEFT JOIN rooms r
                ON r.id = esd.room_id
            LEFT JOIN buildings b
                ON b.id = r.building_id
            WHERE sc.status = 'open'
            ORDER BY
                CASE sc.severity
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    ELSE 4
                END,
                sc.created_at DESC
            LIMIT 6
        `),

    // 7. Count ALL open conflicts, not only the six displayed
    pool.query(`
            SELECT COUNT(*) AS total
            FROM schedule_conflicts
            WHERE status = 'open'
        `),
  ]);

  // Calculate dashboard statistics
  const totalExams = Number(examRows[0].total || 0);
  const scheduledExams = Number(examRows[0].scheduled || 0);
  const openConflicts = Number(conflictCountRows[0].total || 0);

  return {
    stats: [
      {
        id: 'exams',
        label: 'Scheduled Exams',
        value: scheduledExams,
        delta: `${totalExams} total exams`,
        trend: 'flat',
        icon: 'calendar',
        tone: 'primary',
      },
      {
        id: 'rooms',
        label: 'Active Rooms',
        value: Number(roomRows[0].total || 0),
        delta: 'Currently active',
        trend: 'flat',
        icon: 'door',
        tone: 'info',
      },
      {
        id: 'conflicts',
        label: 'Open Conflicts',
        value: openConflicts,
        delta: 'Unresolved records shown',
        trend: openConflicts > 0 ? 'down' : 'flat',
        icon: 'alert',
        tone: openConflicts > 0 ? 'danger' : 'success',
      },
      {
        id: 'students',
        label: 'Active Students',
        value: Number(studentRows[0].total || 0),
        delta: 'Active student records',
        trend: 'flat',
        icon: 'check',
        tone: 'success',
      },
    ],

    upcomingExams: upcomingExams.map((exam) => ({
      ...exam,
      date:
        exam.date instanceof Date
          ? exam.date.toISOString().slice(0, 10)
          : String(exam.date).slice(0, 10),
      students: Number(exam.students || 0),
      status: exam.status,
    })),

    conflicts: conflicts.map((conflict) => ({
      ...conflict,
      type: String(conflict.type || '').replace(/_/g, ' '),
      place: [conflict.building, conflict.room]
        .filter(Boolean)
        .join(' · '),
    })),
  };
}

module.exports = { getDashboard };
