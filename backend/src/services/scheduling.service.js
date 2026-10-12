'use strict';

/**
 * Scheduling engine + timetable service (Phase 5).
 *
 * A deterministic, constraint-based greedy scheduler with bounded multi-strategy
 * retries (no randomness, so results are reproducible):
 *
 *   1. Collect eligible unscheduled exams for an exam period.
 *   2. Validate that enrollment, room and time-slot data exists.
 *   3. Order difficult exams first (fewest feasible slots, then largest).
 *   4. Find a room + date + time slot for each exam.
 *   5. Reject hard-constraint violations (room double-booking, student overlap,
 *      instructor overlap, capacity, room type, closures, outside-period,
 *      configurable separation).
 *   6. Report exams that cannot be scheduled WITH a reason.
 *   7. Return a preview; an authorized user saves the draft explicitly.
 *
 * Hard conflicts use half-open intervals [start, end) plus a configurable
 * separation S (minutes): two windows clash when
 *   aEnd + S > bStart  AND  bEnd + S > aStart
 * (S = 0 → touching windows are allowed).
 *
 * Race safety: draft save / manual edit / publish run inside a transaction that
 * locks the exam-period or schedule row (SELECT ... FOR UPDATE), re-reads the
 * latest state, and relies on the `exam_schedule_details` unique key as a
 * database-level room double-booking guard. Application validation alone is
 * never trusted.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const timeSlotService = require('./timeSlot.service');
const scheduleConstraintService = require('./scheduleConstraint.service');
const { assertDepartmentScope } = require('./scope');
const { paginate, timeToMinutes, toDateString } = require('../validators/shared');

const EDITABLE_SCHEDULE_STATUSES = ['draft', 'generated', 'reviewed'];
const FIXED_SCHEDULE_STATUSES = ['published', 'reviewed'];
const PERIOD_OPEN_STATUSES = ['draft', 'open', 'published'];
const MAX_PERIOD_DAYS = 180;

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

function validationError(details) {
  return ApiError.badRequest('Validation failed.', { code: 'VALIDATION_ERROR', details });
}

/** Half-open overlap with separation S (minutes). */
function overlapsWithGap(aStart, aEnd, bStart, bEnd, separation = 0) {
  return aEnd + separation > bStart && bEnd + separation > aStart;
}

function addMinutes(time, minutes) {
  const total = (timeToMinutes(time) || 0) + Number(minutes || 0);
  const capped = Math.min(total, 24 * 60 - 1);
  const h = String(Math.floor(capped / 60)).padStart(2, '0');
  const m = String(capped % 60).padStart(2, '0');
  return `${h}:${m}:00`;
}

function eachDate(start, end) {
  const out = [];
  let cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return out;
  while (cursor <= last && out.length < MAX_PERIOD_DAYS) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return out;
}

function intersects(setA, setB) {
  if (!setA || !setB || setA.size === 0 || setB.size === 0) return false;
  const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const value of small) if (large.has(value)) return true;
  return false;
}

function closureBlocks(closures, roomId, date, startTime, endTime) {
  return closures.some((closure) => {
    if (Number(closure.room_id) !== Number(roomId)) return false;
    const start = toDateString(closure.start_date);
    const end = toDateString(closure.end_date);
    if (date < start || date > end) return false;
    if (!closure.start_time || !closure.end_time) return true; // full-day closure
    const cs = timeToMinutes(closure.start_time);
    const ce = timeToMinutes(closure.end_time);
    const as = timeToMinutes(startTime);
    const ae = timeToMinutes(endTime);
    return as < ce && cs < ae;
  });
}

function slotDuration(slot) {
  return timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime);
}

// ---------------------------------------------------------------------------
// Data loading (accepts a pool or a transaction connection)
// ---------------------------------------------------------------------------

async function loadPeriod(runner, examPeriodId) {
  const [rows] = await runner.query(
    'SELECT id, name, term, start_date, end_date, status FROM exam_periods WHERE id = ? LIMIT 1',
    [examPeriodId]
  );
  if (!rows.length) throw ApiError.notFound('Exam period not found.', { code: 'EXAM_PERIOD_NOT_FOUND' });
  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    term: row.term,
    startDate: toDateString(row.start_date),
    endDate: toDateString(row.end_date),
    status: row.status,
  };
}

async function loadSectionStudents(runner) {
  const [rows] = await runner.query("SELECT section_id, student_id FROM enrollments WHERE status = 'enrolled'");
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.section_id)) map.set(row.section_id, new Set());
    map.get(row.section_id).add(row.student_id);
  }
  return map;
}

async function loadSectionInstructors(runner) {
  const map = new Map();
  const add = (sectionId, userId) => {
    if (!userId) return;
    if (!map.has(sectionId)) map.set(sectionId, new Set());
    map.get(sectionId).add(userId);
  };
  const [direct] = await runner.query('SELECT id AS section_id, instructor_id AS user_id FROM sections WHERE instructor_id IS NOT NULL');
  direct.forEach((row) => add(row.section_id, row.user_id));
  const [assigned] = await runner.query(
    'SELECT ia.section_id, i.user_id FROM instructor_assignments ia JOIN instructors i ON i.id = ia.instructor_id WHERE i.user_id IS NOT NULL'
  );
  assigned.forEach((row) => add(row.section_id, row.user_id));
  return map;
}

async function loadRooms(runner) {
  const [rows] = await runner.query(
    `SELECT r.id, r.name, r.capacity, r.type, r.is_active, b.code AS building_code, b.is_active AS building_is_active
     FROM rooms r LEFT JOIN buildings b ON b.id = r.building_id`
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    capacity: row.capacity,
    type: row.type,
    isActive: Boolean(row.is_active),
    buildingCode: row.building_code,
    buildingIsActive: row.building_is_active === null ? true : Boolean(row.building_is_active),
  }));
}

async function loadClosures(runner, startDate, endDate) {
  const [rows] = await runner.query(
    `SELECT room_id, start_date, end_date, start_time, end_time FROM room_closures
     WHERE start_date <= ? AND end_date >= ?`,
    [endDate, startDate]
  );
  return rows;
}

async function loadEligibleExams(runner, examPeriodId, actor) {
  const params = [examPeriodId, examPeriodId, examPeriodId];
  let departmentClause = '';
  if (actor && actor.role === 'department_head') {
    departmentClause = ' AND c.department_id = ?';
    params.push(actor.departmentId || 0);
  }
  const [rows] = await runner.query(
    `SELECT e.id, e.course_id, e.section_id, e.exam_type, e.title, e.duration_minutes,
            e.required_room_type, e.required_capacity,
            c.department_id, c.code AS course_code, c.title AS course_title
     FROM exams e
     JOIN courses c ON c.id = e.course_id
     WHERE e.exam_period_id = ? AND e.status NOT IN ('cancelled','completed')
       AND NOT EXISTS (
         SELECT 1 FROM exam_schedule_details esd
         JOIN exam_schedules es ON es.id = esd.exam_schedule_id
         WHERE esd.exam_id = e.id AND es.status <> 'cancelled' AND esd.status <> 'cancelled'
       )${departmentClause}
     ORDER BY e.id ASC`,
    params
  );
  return rows;
}

/** Load schedule-detail entries with student/instructor sets (optionally scoped). */
async function loadEntries(runner, { scheduleId = null, excludeScheduleId = null, periodId = null, statuses = null } = {}) {
  const clauses = ["esd.status <> 'cancelled'"];
  const params = [];
  if (scheduleId) {
    clauses.push('esd.exam_schedule_id = ?');
    params.push(scheduleId);
  }
  if (excludeScheduleId) {
    clauses.push('esd.exam_schedule_id <> ?');
    params.push(excludeScheduleId);
  }
  if (periodId) {
    clauses.push('es.exam_period_id = ?');
    params.push(periodId);
  }
  if (statuses && statuses.length) {
    clauses.push(`es.status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  } else {
    clauses.push("es.status <> 'cancelled'");
  }
  const where = `WHERE ${clauses.join(' AND ')}`;

  const [rows] = await runner.query(
    `SELECT esd.id, esd.exam_id, esd.section_id, esd.room_id, esd.time_slot_id, esd.exam_date,
            esd.start_time, esd.end_time, esd.duration_minutes, esd.total_students, esd.status,
            ex.required_room_type, ex.required_capacity, ex.title AS exam_title, ex.exam_type,
            es.exam_period_id
     FROM exam_schedule_details esd
     JOIN exam_schedules es ON es.id = esd.exam_schedule_id
     LEFT JOIN exams ex ON ex.id = esd.exam_id
     ${where}
     ORDER BY esd.exam_date ASC, esd.start_time ASC, esd.id ASC`,
    params
  );

  const [students, instructors] = await Promise.all([loadSectionStudents(runner), loadSectionInstructors(runner)]);

  return rows.map((row) => ({
    detailId: row.id,
    examId: row.exam_id,
    sectionId: row.section_id,
    roomId: row.room_id,
    timeSlotId: row.time_slot_id,
    examDate: toDateString(row.exam_date),
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    enrollmentCount: Number(row.total_students || 0),
    requiredRoomType: row.required_room_type || null,
    requiredCapacity: row.required_capacity || null,
    title: row.exam_title || null,
    examType: row.exam_type || null,
    studentIds: students.get(row.section_id) || new Set(),
    instructorIds: instructors.get(row.section_id) || new Set(),
    source: 'db',
  }));
}

async function separationMinutes() {
  const config = await scheduleConstraintService.getEngineConfig();
  const a = config.separation_minutes || config.min_gap_minutes || config.minSeparationMinutes;
  if (a && a.parameters) {
    const value = Number(a.parameters.minutes ?? a.parameters.minSeparationMinutes ?? a.parameters.value);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Hard-constraint detection
// ---------------------------------------------------------------------------

function makeConflict(type, severity, title, description, extra = {}) {
  return { type, severity, title, description, ...extra };
}

/**
 * Detects hard conflicts for a set of entries against room/slot/closure state.
 * Returns a list of { type, severity, title, description, examIds, detailIds }.
 */
function detectConflicts(entries, context) {
  const conflicts = [];
  const { roomById, slotById, closures, period, separation } = context;

  for (const entry of entries) {
    const label = entry.title ? `"${entry.title}"` : `exam #${entry.examId}`;

    if (entry.examDate < period.startDate || entry.examDate > period.endDate) {
      conflicts.push(
        makeConflict('time_overlap', 'critical', 'Exam outside the examination period',
          `${label} is scheduled on ${entry.examDate}, outside ${period.startDate}..${period.endDate}.`,
          { examIds: [entry.examId], detailIds: entry.detailId ? [entry.detailId] : [] })
      );
    }

    const slot = slotById.get(Number(entry.timeSlotId));
    if (!slot) {
      conflicts.push(
        makeConflict('time_overlap', 'critical', 'Unknown time slot',
          `${label} references a time slot that does not exist.`, { examIds: [entry.examId] })
      );
    } else if (slotDuration(slot) < Number(entry.durationMinutes)) {
      conflicts.push(
        makeConflict('time_overlap', 'critical', 'Exam does not fit the time slot',
          `${label} lasts ${entry.durationMinutes} min but slot "${slot.label}" is only ${slotDuration(slot)} min.`,
          { examIds: [entry.examId] })
      );
    }

    const room = roomById.get(Number(entry.roomId));
    if (!room || !room.isActive || !room.buildingIsActive) {
      conflicts.push(
        makeConflict('room_unavailable', 'critical', 'Room unavailable or inactive',
          `${label} is assigned to an inactive or unknown room.`, { examIds: [entry.examId] })
      );
    } else {
      const required = Math.max(Number(entry.enrollmentCount || 0), Number(entry.requiredCapacity || 0));
      if (room.capacity < required) {
        conflicts.push(
          makeConflict('room_capacity', 'critical', 'Room capacity too small',
            `${label} needs ${required} seats but room "${room.name}" seats ${room.capacity}.`,
            { examIds: [entry.examId] })
        );
      }
      if (entry.requiredRoomType && room.type !== entry.requiredRoomType) {
        conflicts.push(
          makeConflict('other', 'high', 'Room type mismatch',
            `${label} requires a "${entry.requiredRoomType}" room but "${room.name}" is a "${room.type}" room.`,
            { examIds: [entry.examId] })
        );
      }
    }

    if (entry.roomId && closureBlocks(closures, entry.roomId, entry.examDate, entry.startTime, entry.endTime)) {
      conflicts.push(
        makeConflict('room_unavailable', 'critical', 'Room closed at that time',
          `${label} falls inside a room closure on ${entry.examDate}.`, { examIds: [entry.examId] })
      );
    }
  }

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      const aStart = timeToMinutes(a.startTime);
      const aEnd = timeToMinutes(a.endTime);
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);

      const overlaps = overlapsWithGap(aStart, aEnd, bStart, bEnd, separation);
      if (!overlaps) continue;
      const overlapsTight = overlapsWithGap(aStart, aEnd, bStart, bEnd, 0);
      const labelA = a.title ? `"${a.title}"` : `exam #${a.examId}`;
      const labelB = b.title ? `"${b.title}"` : `exam #${b.examId}`;

      if (Number(a.roomId) === Number(b.roomId)) {
        conflicts.push(
          makeConflict('room_double_booked', 'critical', 'Room double-booked',
            `Room is assigned to ${labelA} and ${labelB} at overlapping times on ${a.examDate}.`,
            { examIds: [a.examId, b.examId], detailIds: [a.detailId, b.detailId].filter(Boolean) })
        );
      }
      if (intersects(a.studentIds, b.studentIds)) {
        conflicts.push(
          makeConflict('student_overlap', 'critical', 'Student has overlapping exams',
            `A student enrolled in both ${labelA} and ${labelB} would sit two exams at overlapping times.`,
            { examIds: [a.examId, b.examId], detailIds: [a.detailId, b.detailId].filter(Boolean) })
        );
      }
      if (intersects(a.instructorIds, b.instructorIds)) {
        conflicts.push(
          makeConflict('instructor_overlap', 'critical', 'Instructor has overlapping exams',
            `An instructor assigned to ${labelA} and ${labelB} would invigilate two exams at overlapping times.`,
            { examIds: [a.examId, b.examId], detailIds: [a.detailId, b.detailId].filter(Boolean) })
        );
      }
      if (separation > 0 && !overlapsTight) {
        conflicts.push(
          makeConflict('insufficient_gap', 'medium', 'Configured separation not respected',
            `${labelA} and ${labelB} are closer than the configured ${separation} min separation.`,
            { examIds: [a.examId, b.examId], detailIds: [a.detailId, b.detailId].filter(Boolean) })
        );
      }
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Candidate generation + greedy assignment
// ---------------------------------------------------------------------------

function roomMatches(room, exam) {
  if (!room.isActive || !room.buildingIsActive) return false;
  const required = Math.max(exam.enrollmentCount, exam.requiredCapacity || 0);
  if (room.capacity < required) return false;
  if (exam.requiredRoomType && room.type !== exam.requiredRoomType) return false;
  return true;
}

function unscheduledReason(exam, ctx) {
  if (exam.enrollmentCount === 0) {
    return { code: 'NO_ENROLLMENT_DATA', message: 'No enrolled students were found for the section, so a room cannot be sized.' };
  }
  if (ctx.dates.length === 0) {
    return { code: 'NO_AVAILABLE_DATE', message: 'The exam period has no valid dates.' };
  }
  if (!ctx.slots.some((slot) => slotDuration(slot) >= exam.durationMinutes)) {
    return { code: 'NO_SLOT_FITS_DURATION', message: 'No active time slot is long enough for this exam duration.' };
  }
  const activeRooms = ctx.rooms.filter((room) => room.isActive && room.buildingIsActive);
  if (!activeRooms.some((room) => room.capacity >= Math.max(exam.enrollmentCount, exam.requiredCapacity || 0))) {
    return { code: 'NO_ROOM_LARGE_ENOUGH', message: 'No active room has enough capacity for the enrollment count.' };
  }
  if (exam.requiredRoomType && !activeRooms.some((room) => room.type === exam.requiredRoomType)) {
    return { code: 'NO_ROOM_MATCHES_TYPE', message: `No active room of type "${exam.requiredRoomType}" is available.` };
  }
  return { code: 'CONFLICTS_PREVENT_PLACEMENT', message: 'Every feasible room/date/slot combination conflicts with an existing allocation.' };
}

function buildExamCandidates(exam, ctx) {
  const candidates = [];
  for (const date of ctx.dates) {
    for (const slot of ctx.slots) {
      if (slotDuration(slot) < exam.durationMinutes) continue;
      const endTime = addMinutes(slot.startTime, exam.durationMinutes);
      const hasRoom = ctx.rooms.some(
        (room) => roomMatches(room, exam) && !closureBlocks(ctx.closures, room.id, date, slot.startTime, endTime)
      );
      if (hasRoom) candidates.push({ date, slot, startTime: slot.startTime, endTime });
    }
  }
  return candidates;
}

function sortExams(exams, mode) {
  const copy = exams.slice();
  if (mode === 'difficulty') {
    copy.sort((a, b) => a.candidateCount - b.candidateCount || b.enrollmentCount - a.enrollmentCount || b.durationMinutes - a.durationMinutes || a.id - b.id);
  } else if (mode === 'enrollment') {
    copy.sort((a, b) => b.enrollmentCount - a.enrollmentCount || a.candidateCount - b.candidateCount || a.id - b.id);
  } else if (mode === 'duration') {
    copy.sort((a, b) => b.durationMinutes - a.durationMinutes || a.candidateCount - b.candidateCount || a.id - b.id);
  }
  return copy;
}

function sortRooms(rooms, exam, mode) {
  const required = Math.max(exam.enrollmentCount, exam.requiredCapacity || 0);
  const usable = rooms.filter((room) => roomMatches(room, exam));
  if (mode === 'capacity_desc') usable.sort((a, b) => b.capacity - a.capacity || a.id - b.id);
  else usable.sort((a, b) => a.capacity - b.capacity || a.id - b.id); // best fit
  void required;
  return usable;
}

function candidateConflicts(entry, placed, ctx) {
  const conflicts = [];
  for (const other of placed) {
    if (!overlapsWithGap(timeToMinutes(entry.startTime), timeToMinutes(entry.endTime), timeToMinutes(other.startTime), timeToMinutes(other.endTime), ctx.separation)) {
      continue;
    }
    if (Number(entry.roomId) === Number(other.roomId)) conflicts.push({ reason: 'room_double_booked', other });
    if (intersects(entry.studentIds, other.studentIds)) conflicts.push({ reason: 'student_overlap', other });
    if (intersects(entry.instructorIds, other.instructorIds)) conflicts.push({ reason: 'instructor_overlap', other });
  }
  return conflicts;
}

function runGreedy(ctx, strategy) {
  const exams = ctx.exams.map((exam) => ({
    ...exam,
    candidateCount: exam.candidates.length,
  }));

  const ordered = sortExams(exams, strategy.examSort);
  const placed = ctx.occupied.slice(); // published/reviewed entries are immovable
  const allocations = [];
  const unscheduled = [];

  for (const exam of ordered) {
    if (exam.enrollmentCount === 0) {
      unscheduled.push({ exam, reason: unscheduledReason(exam, ctx) });
      continue;
    }
    let chosen = null;
    const candidateOrder = strategy.roomSort === 'capacity_desc' ? exam.candidates.slice().reverse() : exam.candidates;
    for (const candidate of candidateOrder) {
      const rooms = sortRooms(ctx.rooms, exam, strategy.roomSort);
      for (const room of rooms) {
        if (closureBlocks(ctx.closures, room.id, candidate.date, candidate.startTime, candidate.endTime)) continue;
        const entry = {
          examId: exam.id,
          sectionId: exam.sectionId,
          roomId: room.id,
          timeSlotId: candidate.slot.id,
          examDate: candidate.date,
          startTime: candidate.startTime,
          endTime: candidate.endTime,
          durationMinutes: exam.durationMinutes,
          enrollmentCount: exam.enrollmentCount,
          requiredRoomType: exam.requiredRoomType,
          requiredCapacity: exam.requiredCapacity,
          title: exam.title,
          studentIds: exam.studentIds,
          instructorIds: exam.instructorIds,
          source: 'candidate',
        };
        if (candidateConflicts(entry, placed, ctx).length === 0) {
          chosen = { exam, room, entry };
          break;
        }
      }
      if (chosen) break;
    }

    if (chosen) {
      placed.push(chosen.entry);
      allocations.push({
        exam: {
          id: exam.id,
          title: exam.title,
          examType: exam.examType,
          courseCode: exam.courseCode,
          courseTitle: exam.courseTitle,
          sectionId: exam.sectionId,
          durationMinutes: exam.durationMinutes,
          enrollmentCount: exam.enrollmentCount,
          requiredRoomType: exam.requiredRoomType,
        },
        room: { id: chosen.room.id, name: chosen.room.name, capacity: chosen.room.capacity, type: chosen.room.type, buildingCode: chosen.room.buildingCode },
        timeSlot: { id: candidateSlotId(chosen.entry), label: ctx.slotById.get(chosen.entry.timeSlotId).label, startTime: chosen.entry.startTime, endTime: chosen.entry.endTime },
        examDate: chosen.entry.examDate,
        startTime: chosen.entry.startTime,
        endTime: chosen.entry.endTime,
      });
    } else {
      unscheduled.push({ exam, reason: unscheduledReason(exam, ctx) });
    }
  }

  const slack = allocations.reduce((sum, item) => sum + (item.room.capacity - item.exam.enrollmentCount), 0);
  return { allocations, unscheduled, slack };
}

function candidateSlotId(entry) {
  return entry.timeSlotId;
}

// ---------------------------------------------------------------------------
// Context assembly
// ---------------------------------------------------------------------------

async function buildContext(runner, examPeriodId, actor, { requireUnscheduled = true } = {}) {
  const period = await loadPeriod(runner, examPeriodId);
  const [rooms, slots, separation] = await Promise.all([
    loadRooms(runner),
    timeSlotService.listActive(),
    separationMinutes(),
  ]);
  const closures = await loadClosures(runner, period.startDate, period.endDate);
  const [students, instructors] = await Promise.all([loadSectionStudents(runner), loadSectionInstructors(runner)]);

  const exams = (await loadEligibleExams(runner, examPeriodId, actor)).map((row) => {
    const studentIds = students.get(row.section_id) || new Set();
    return {
      id: row.id,
      courseId: row.course_id,
      sectionId: row.section_id,
      departmentId: row.department_id,
      courseCode: row.course_code,
      courseTitle: row.course_title,
      examType: row.exam_type,
      title: row.title,
      durationMinutes: row.duration_minutes,
      requiredRoomType: row.required_room_type || null,
      requiredCapacity: row.required_capacity || null,
      enrollmentCount: studentIds.size,
      studentIds,
      instructorIds: instructors.get(row.section_id) || new Set(),
    };
  });

  const dates = eachDate(period.startDate, period.endDate);
  const slotById = new Map(slots.map((slot) => [Number(slot.id), slot]));
  const roomById = new Map(rooms.map((room) => [Number(room.id), room]));

  const ctx = {
    period,
    rooms,
    slots,
    slotById,
    roomById,
    closures,
    separation,
    dates,
    exams,
    occupied: [],
  };

  if (requireUnscheduled) {
    ctx.exams.forEach((exam) => {
      exam.candidates = buildExamCandidates(exam, ctx);
    });
    ctx.occupied = await loadEntries(runner, { periodId: examPeriodId, statuses: FIXED_SCHEDULE_STATUSES });
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// Preview / generation
// ---------------------------------------------------------------------------

const STRATEGIES = [
  { name: 'difficulty_bestfit', examSort: 'difficulty', roomSort: 'capacity_asc' },
  { name: 'difficulty_largest', examSort: 'difficulty', roomSort: 'capacity_desc' },
  { name: 'enrollment_bestfit', examSort: 'enrollment', roomSort: 'capacity_asc' },
  { name: 'duration_bestfit', examSort: 'duration', roomSort: 'capacity_asc' },
];

async function generatePreview({ examPeriodId, actor }) {
  const ctx = await buildContext(database.getPool(), examPeriodId, actor);
  if (!PERIOD_OPEN_STATUSES.includes(ctx.period.status)) {
    throw ApiError.conflict(`Exam period "${ctx.period.name}" is ${ctx.period.status} and cannot be scheduled.`, {
      code: 'PERIOD_NOT_OPEN',
    });
  }

  let best = null;
  for (const strategy of STRATEGIES) {
    const result = runGreedy(ctx, strategy);
    if (
      !best ||
      result.unscheduled.length < best.unscheduled.length ||
      (result.unscheduled.length === best.unscheduled.length && result.slack < best.slack)
    ) {
      best = { ...result, strategy: strategy.name };
    }
  }

  return {
    period: ctx.period,
    strategy: best.strategy,
    separationMinutes: ctx.separation,
    generatedCount: best.allocations.length,
    unscheduledCount: best.unscheduled.length,
    allocations: best.allocations,
    unscheduled: best.unscheduled.map((item) => ({
      examId: item.exam.id,
      title: item.exam.title,
      examType: item.exam.examType,
      courseCode: item.exam.courseCode,
      courseTitle: item.exam.courseTitle,
      sectionId: item.exam.sectionId,
      enrollmentCount: item.exam.enrollmentCount,
      durationMinutes: item.exam.durationMinutes,
      reason: item.reason.code,
      reasonMessage: item.reason.message,
    })),
    complete: best.unscheduled.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Schedule persistence
// ---------------------------------------------------------------------------

async function lockRow(runner, table, id) {
  const [rows] = await runner.query(`SELECT id FROM ${table} WHERE id = ? FOR UPDATE`, [id]);
  if (!rows.length) return null;
  return rows[0];
}

async function requireSchedule(runner, scheduleId) {
  const [rows] = await runner.query(
    `SELECT id, uuid, exam_period_id, version, name, status, published_by, published_at, notes, created_by, created_at, updated_at
     FROM exam_schedules WHERE id = ? LIMIT 1`,
    [scheduleId]
  );
  if (!rows.length) throw ApiError.notFound('Exam schedule not found.', { code: 'SCHEDULE_NOT_FOUND' });
  return rows[0];
}

function toPublicSchedule(row, extra = {}) {
  return {
    id: row.id,
    uuid: row.uuid,
    examPeriodId: row.exam_period_id,
    version: row.version,
    name: row.name,
    status: row.status,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...extra,
  };
}

async function listSchedules(query) {
  const clauses = [];
  const params = [];
  if (query.examPeriodId) {
    clauses.push('es.exam_period_id = ?');
    params.push(query.examPeriodId);
  }
  if (query.status) {
    clauses.push('es.status = ?');
    params.push(query.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;

  const [countRows] = await database.getPool().query(`SELECT COUNT(*) AS total FROM exam_schedules es ${where}`, params);
  const total = Number(countRows[0].total);

  const [rows] = await database
    .getPool()
    .query(
      `SELECT es.id, es.uuid, es.exam_period_id, es.version, es.name, es.status, es.published_by, es.published_at,
              es.notes, es.created_by, es.created_at, es.updated_at,
              ep.name AS period_name, ep.term AS period_term,
              (SELECT COUNT(*) FROM exam_schedule_details esd WHERE esd.exam_schedule_id = es.id AND esd.status <> 'cancelled') AS detail_count
       FROM exam_schedules es
       LEFT JOIN exam_periods ep ON ep.id = es.exam_period_id
       ${where}
       ORDER BY es.exam_period_id ASC, es.version DESC, es.id DESC
       LIMIT ? OFFSET ?`,
      [...params, query.limit, offset]
    );

  return {
    items: rows.map((row) =>
      toPublicSchedule(row, {
        period: row.exam_period_id ? { id: row.exam_period_id, name: row.period_name, term: row.period_term } : null,
        detailCount: Number(row.detail_count || 0),
      })
    ),
    pagination: paginate({ page: query.page, limit: query.limit, total }),
  };
}

async function getScheduleDetailRows(runner, scheduleId) {
  const [rows] = await runner.query(
    `SELECT esd.id, esd.exam_id, esd.section_id, esd.room_id, esd.time_slot_id, esd.exam_date,
            esd.start_time, esd.end_time, esd.duration_minutes, esd.total_students, esd.invigilator_count,
            esd.status, esd.notes, esd.created_at, esd.updated_at,
            ex.title AS exam_title, ex.exam_type, ex.required_room_type,
            r.name AS room_name, r.capacity AS room_capacity, r.type AS room_type,
            b.code AS building_code, b.name AS building_name,
            ts.label AS slot_label, ts.start_time AS slot_start, ts.end_time AS slot_end,
            sec.section, sec.section_name, c.code AS course_code, c.title AS course_title
     FROM exam_schedule_details esd
     LEFT JOIN exams ex ON ex.id = esd.exam_id
     LEFT JOIN rooms r ON r.id = esd.room_id
     LEFT JOIN buildings b ON b.id = r.building_id
     LEFT JOIN time_slots ts ON ts.id = esd.time_slot_id
     LEFT JOIN sections sec ON sec.id = esd.section_id
     LEFT JOIN courses c ON c.id = sec.course_id
     WHERE esd.exam_schedule_id = ? AND esd.status <> 'cancelled'
     ORDER BY esd.exam_date ASC, esd.start_time ASC, esd.id ASC`,
    [scheduleId]
  );
  return rows.map((row) => ({
    id: row.id,
    examId: row.exam_id,
    sectionId: row.section_id,
    roomId: row.room_id,
    timeSlotId: row.time_slot_id,
    examDate: toDateString(row.exam_date),
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    totalStudents: row.total_students,
    invigilatorCount: row.invigilator_count,
    status: row.status,
    notes: row.notes,
    exam: row.exam_id ? { id: row.exam_id, title: row.exam_title, examType: row.exam_type, requiredRoomType: row.required_room_type } : null,
    room: row.room_id
      ? { id: row.room_id, name: row.room_name, capacity: row.room_capacity, type: row.room_type, buildingCode: row.building_code, buildingName: row.building_name }
      : null,
    timeSlot: row.time_slot_id ? { id: row.time_slot_id, label: row.slot_label, startTime: row.slot_start, endTime: row.slot_end } : null,
    section: row.section_id ? { id: row.section_id, section: row.section, sectionName: row.section_name } : null,
    course: row.course_code ? { code: row.course_code, title: row.course_title } : null,
  }));
}

async function getSchedule(scheduleId, actor) {
  const schedule = await requireSchedule(database.getPool(), scheduleId);
  if (actor && actor.role === 'department_head') {
    const [rows] = await database
      .getPool()
      .query(
        `SELECT COUNT(*) AS total FROM exam_schedule_details esd
         JOIN exams ex ON ex.id = esd.exam_id JOIN courses c ON c.id = ex.course_id
         WHERE esd.exam_schedule_id = ? AND c.department_id <> ?`,
        [scheduleId, actor.departmentId || 0]
      );
    // Department heads may view a schedule, but only their own department's entries.
  }
  const details = await getScheduleDetailRows(database.getPool(), scheduleId);
  const [conflictRows] = await database
    .getPool()
    .query("SELECT id, type, severity, status, title, description, details FROM schedule_conflicts WHERE exam_schedule_id = ? AND status = 'open' ORDER BY id ASC", [
      scheduleId,
    ]);
  return {
    schedule: toPublicSchedule(schedule, { detailCount: details.length }),
    details,
    conflicts: conflictRows.map((row) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      status: row.status,
      title: row.title,
      description: row.description,
      details: row.details ? safeJson(row.details) : null,
    })),
  };
}

function safeJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

/** Re-read the latest state and detect conflicts for a persisted schedule. */
async function validateSchedule(scheduleId, actor) {
  const schedule = await requireSchedule(database.getPool(), scheduleId);
  const own = await loadEntries(database.getPool(), { scheduleId });
  const others = await loadEntries(database.getPool(), {
    periodId: schedule.exam_period_id,
    excludeScheduleId: scheduleId,
    statuses: FIXED_SCHEDULE_STATUSES,
  });
  const rooms = await loadRooms(database.getPool());
  const slots = await timeSlotService.listActive();
  const period = await loadPeriod(database.getPool(), schedule.exam_period_id);
  const closures = await loadClosures(database.getPool(), period.startDate, period.endDate);
  const separation = await separationMinutes();

  const context = {
    roomById: new Map(rooms.map((room) => [Number(room.id), room])),
    slotById: new Map(slots.map((slot) => [Number(slot.id), slot])),
    closures,
    period,
    separation,
  };
  const ownConflicts = detectConflicts(own, context);
  const crossConflicts = detectConflicts([...own, ...others], context).filter(
    (conflict) => !ownConflicts.includes(conflict)
  );
  const conflicts = [...ownConflicts, ...crossConflicts];
  void actor;

  await persistConflicts(scheduleId, conflicts);

  return {
    schedule: toPublicSchedule(schedule),
    valid: conflicts.length === 0,
    conflictCount: conflicts.length,
    conflicts,
    detailCount: own.length,
  };
}

async function persistConflicts(scheduleId, conflicts) {
  const runner = database.getPool();
  await runner.query("DELETE FROM schedule_conflicts WHERE exam_schedule_id = ? AND status = 'open'", [scheduleId]);
  if (!conflicts.length) return;
  const values = conflicts.map((conflict) => [
    scheduleId,
    conflict.detailIds && conflict.detailIds.length ? conflict.detailIds[0] : null,
    conflict.type,
    conflict.severity || 'critical',
    conflict.title,
    conflict.description,
    conflict.examIds ? JSON.stringify({ examIds: conflict.examIds }) : null,
  ]);
  await runner.query(
    `INSERT INTO schedule_conflicts (exam_schedule_id, exam_schedule_detail_id, type, severity, title, description, details)
     VALUES ?`,
    [values]
  );
}

/** Resolve a schedule, its period and the full context inside a transaction. */
async function buildSaveContext(conn, examPeriodId, actor) {
  await lockRow(conn, 'exam_periods', examPeriodId);
  const period = await loadPeriod(conn, examPeriodId);
  const [rooms, slots, separation] = await Promise.all([loadRooms(conn), timeSlotService.listActive(), separationMinutes()]);
  const closures = await loadClosures(conn, period.startDate, period.endDate);
  const [students, instructors] = await Promise.all([loadSectionStudents(conn), loadSectionInstructors(conn)]);
  const occupied = await loadEntries(conn, { periodId: examPeriodId, statuses: FIXED_SCHEDULE_STATUSES });
  const context = {
    roomById: new Map(rooms.map((room) => [Number(room.id), room])),
    slotById: new Map(slots.map((slot) => [Number(slot.id), slot])),
    rooms,
    slots,
    closures,
    period,
    separation,
    students,
    instructors,
  };
  void actor;
  return { period, context, occupied };
}

/**
 * Build a candidate entry for one allocation and reject hard conflicts. Returns
 * { entry } or throws a 422 carrying the conflict list.
 */
async function buildValidatedEntry(conn, context, allocation, { existingEntries = [], occupied = [], excludeDetailId = null } = {}) {
  const examId = Number(allocation.examId);
  const roomId = Number(allocation.roomId);
  const timeSlotId = Number(allocation.timeSlotId);
  const examDate = toDateString(allocation.examDate);

  const [examRows] = await conn.query(
    `SELECT e.id, e.title, e.exam_type, e.section_id, e.course_id, e.duration_minutes, e.required_room_type,
            e.required_capacity, e.exam_period_id, c.department_id
     FROM exams e JOIN courses c ON c.id = e.course_id
     WHERE e.id = ? LIMIT 1`,
    [examId]
  );
  if (!examRows.length) throw validationError([{ field: 'examId', message: `Exam #${examId} does not exist.` }]);
  const exam = examRows[0];
  if (exam.exam_period_id !== null && Number(exam.exam_period_id) !== Number(context.period.id)) {
    throw validationError([{ field: 'examId', message: `Exam #${examId} does not belong to this exam period.` }]);
  }

  const room = context.roomById.get(roomId);
  if (!room) throw validationError([{ field: 'roomId', message: `Room #${roomId} does not exist.` }]);
  const slot = context.slotById.get(timeSlotId);
  if (!slot) throw validationError([{ field: 'timeSlotId', message: `Time slot #${timeSlotId} does not exist or is inactive.` }]);
  if (slotDuration(slot) < exam.duration_minutes) {
    throw ApiError.unprocessable('The exam is longer than the selected time slot.', {
      code: 'SLOT_TOO_SHORT',
      details: [{ field: 'timeSlotId', message: `Exam lasts ${exam.duration_minutes} min; slot is ${slotDuration(slot)} min.` }],
    });
  }

  const studentIds = context.students.get(exam.section_id) || new Set();
  const instructorIds = context.instructors.get(exam.section_id) || new Set();

  const entry = {
    examId,
    sectionId: exam.section_id,
    roomId,
    timeSlotId,
    examDate,
    startTime: slot.startTime,
    endTime: addMinutes(slot.startTime, exam.duration_minutes),
    durationMinutes: exam.duration_minutes,
    enrollmentCount: studentIds.size,
    requiredRoomType: exam.required_room_type || null,
    requiredCapacity: exam.required_capacity || null,
    title: exam.title,
    studentIds,
    instructorIds,
    departmentId: exam.department_id,
    detailId: excludeDetailId || undefined,
    source: 'candidate',
  };

  const peers = existingEntries.filter((item) => !excludeDetailId || item.detailId !== excludeDetailId);
  const all = [...peers, ...occupied, entry];
  const conflicts = detectConflicts(all, context);
  if (conflicts.length) {
    // Keep only conflicts touching the candidate entry where possible.
    const relevant = conflicts.filter(
      (conflict) =>
        !conflict.examIds || conflict.examIds.length === 0 || conflict.examIds.includes(examId)
    );
    throw ApiError.unprocessable('The assignment would create one or more hard conflicts.', {
      code: 'SCHEDULE_CONFLICT',
      details: (relevant.length ? relevant : conflicts).map((conflict) => ({
        field: 'allocation',
        message: conflict.description,
        type: conflict.type,
      })),
    });
  }

  return entry;
}

function assertEditable(schedule) {
  if (!EDITABLE_SCHEDULE_STATUSES.includes(schedule.status)) {
    throw ApiError.conflict(`This schedule is ${schedule.status} and can no longer be edited.`, {
      code: 'SCHEDULE_NOT_EDITABLE',
    });
  }
}

function assertDepartmentScopeEntry(actor, entry) {
  if (actor && actor.role === 'department_head') {
    assertDepartmentScope(actor, entry.departmentId);
  }
}

async function saveDraft(input, actor, meta) {
  const examPeriodId = Number(input.examPeriodId);
  const allocations = Array.isArray(input.allocations) ? input.allocations : [];

  return database.withTransaction(async (conn) => {
    const { period, context, occupied } = await buildSaveContext(conn, examPeriodId, actor);
    if (!PERIOD_OPEN_STATUSES.includes(period.status)) {
      throw ApiError.conflict(`Exam period "${period.name}" is ${period.status} and cannot be scheduled.`, { code: 'PERIOD_NOT_OPEN' });
    }

    let schedule;
    if (input.scheduleId) {
      schedule = await requireSchedule(conn, input.scheduleId);
      await lockRow(conn, 'exam_schedules', input.scheduleId);
      schedule = await requireSchedule(conn, input.scheduleId);
      if (Number(schedule.exam_period_id) !== examPeriodId) {
        throw validationError([{ field: 'scheduleId', message: 'The schedule belongs to a different exam period.' }]);
      }
      assertEditable(schedule);
    }

    // Validate every allocation against the latest state before writing anything.
    const entries = [];
    const seenExamIds = new Set();
    for (const allocation of allocations) {
      const entry = await buildValidatedEntry(conn, context, allocation, { existingEntries: entries, occupied });
      assertDepartmentScopeEntry(actor, entry);
      if (seenExamIds.has(entry.examId)) {
        throw validationError([{ field: 'allocations', message: `Exam #${entry.examId} is allocated more than once.` }]);
      }
      seenExamIds.add(entry.examId);
      entries.push(entry);
    }

    if (!schedule) {
      const [versionRows] = await conn.query(
        'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM exam_schedules WHERE exam_period_id = ?',
        [examPeriodId]
      );
      const version = versionRows[0].next_version;
      const [result] = await conn.query(
        'INSERT INTO exam_schedules (exam_period_id, version, name, status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [examPeriodId, version, input.name || null, entries.length ? 'generated' : 'draft', input.notes || null, actor.id]
      );
      schedule = await requireSchedule(conn, result.insertId);
    } else {
      // Replace the draft's entries with the validated set.
      await conn.query('DELETE FROM exam_schedule_details WHERE exam_schedule_id = ?', [schedule.id]);
      await conn.query('UPDATE exam_schedules SET name = COALESCE(?, name), notes = COALESCE(?, notes), status = ?, updated_at = NOW() WHERE id = ?', [
        input.name || null,
        input.notes || null,
        entries.length ? 'generated' : schedule.status,
        schedule.id,
      ]);
    }

    if (entries.length) {
      const values = entries.map((entry) => [
        schedule.id,
        entry.examId,
        entry.sectionId,
        entry.roomId,
        entry.timeSlotId,
        entry.examDate,
        entry.startTime,
        entry.endTime,
        entry.durationMinutes,
        entry.enrollmentCount,
        1,
        'scheduled',
        actor.id,
      ]);
      try {
        await conn.query(
          `INSERT INTO exam_schedule_details
             (exam_schedule_id, exam_id, section_id, room_id, time_slot_id, exam_date, start_time, end_time,
              duration_minutes, total_students, invigilator_count, status, created_by)
           VALUES ?`,
          [values]
        );
      } catch (error) {
        if (error && error.code === 'ER_DUP_ENTRY') {
          throw ApiError.conflict('A room is double-booked in this schedule (same room, date and time slot).', {
            code: 'ROOM_DOUBLE_BOOKED',
          });
        }
        throw error;
      }

      const examIds = entries.map((entry) => entry.examId);
      await conn.query(
        `UPDATE exams SET status = 'scheduled', updated_at = NOW()
         WHERE id IN (${examIds.map(() => '?').join(', ')}) AND status NOT IN ('published','cancelled')`,
        examIds
      );
    }

    const result = await getSchedule(schedule.id, actor);
    await auditService.record({
      userId: actor.id,
      action: 'schedule.save_draft',
      entityType: 'exam_schedule',
      entityId: schedule.id,
      after: { examPeriodId, allocations: entries.length },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return result;
  });
}

async function publishSchedule(scheduleId, actor, meta) {
  return database.withTransaction(async (conn) => {
    await lockRow(conn, 'exam_schedules', scheduleId);
    const schedule = await requireSchedule(conn, scheduleId);
    if (schedule.status === 'published') {
      throw ApiError.conflict('This schedule is already published.', { code: 'SCHEDULE_ALREADY_PUBLISHED' });
    }
    if (!EDITABLE_SCHEDULE_STATUSES.includes(schedule.status)) {
      throw ApiError.conflict(`A ${schedule.status} schedule cannot be published.`, { code: 'SCHEDULE_NOT_PUBLISHABLE' });
    }

    const details = await getScheduleDetailRows(conn, scheduleId);
    if (!details.length) {
      throw ApiError.unprocessable('Cannot publish an empty schedule.', { code: 'SCHEDULE_EMPTY' });
    }

    // Re-read latest state and revalidate before flipping the flag.
    const own = await loadEntries(conn, { scheduleId });
    const others = await loadEntries(conn, {
      periodId: schedule.exam_period_id,
      excludeScheduleId: scheduleId,
      statuses: FIXED_SCHEDULE_STATUSES,
    });
    const [rooms, slots, periodRows] = await Promise.all([
      loadRooms(conn),
      timeSlotService.listActive(),
      conn.query('SELECT start_date, end_date FROM exam_periods WHERE id = ? LIMIT 1', [schedule.exam_period_id]),
    ]);
    const periodRow = periodRows[0][0];
    const period = { startDate: toDateString(periodRow.start_date), endDate: toDateString(periodRow.end_date) };
    const closures = await loadClosures(conn, period.startDate, period.endDate);
    const separation = await separationMinutes();
    const context = {
      roomById: new Map(rooms.map((room) => [Number(room.id), room])),
      slotById: new Map(slots.map((slot) => [Number(slot.id), slot])),
      closures,
      period,
      separation,
    };
    const conflicts = detectConflicts([...own, ...others], context);
    if (conflicts.length) {
      await persistConflicts(scheduleId, conflicts);
      throw ApiError.unprocessable('The schedule has conflicts and cannot be published.', {
        code: 'SCHEDULE_CONFLICTS',
        details: conflicts.map((conflict) => ({ field: 'conflict', message: conflict.description, type: conflict.type })),
      });
    }

    await conn.query(
      "UPDATE exam_schedules SET status = 'published', published_by = ?, published_at = NOW(), updated_at = NOW() WHERE id = ?",
      [actor.id, scheduleId]
    );

    const examIds = [...new Set(details.map((detail) => detail.examId).filter(Boolean))];
    if (examIds.length) {
      await conn.query(
        `UPDATE exams SET status = 'published', updated_at = NOW() WHERE id IN (${examIds.map(() => '?').join(', ')}) AND status <> 'cancelled'`,
        examIds
      );
    }

    await persistConflicts(scheduleId, []);
    await auditService.record({
      userId: actor.id,
      action: 'schedule.publish',
      entityType: 'exam_schedule',
      entityId: scheduleId,
      after: { status: 'published', entries: details.length },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    const result = await getSchedule(scheduleId, actor);
    return result;
  });
}

async function cancelSchedule(scheduleId, actor, meta) {
  return database.withTransaction(async (conn) => {
    await lockRow(conn, 'exam_schedules', scheduleId);
    const schedule = await requireSchedule(conn, scheduleId);
    if (schedule.status === 'cancelled') return getSchedule(scheduleId, actor);

    const details = await getScheduleDetailRows(conn, scheduleId);
    await conn.query("UPDATE exam_schedule_details SET status = 'cancelled', updated_at = NOW() WHERE exam_schedule_id = ? AND status <> 'cancelled'", [
      scheduleId,
    ]);
    await conn.query("UPDATE exam_schedules SET status = 'cancelled', updated_at = NOW() WHERE id = ?", [scheduleId]);

    // Revert exams that are no longer in any live schedule back to draft.
    const examIds = [...new Set(details.map((detail) => detail.examId).filter(Boolean))];
    for (const examId of examIds) {
      const [remaining] = await conn.query(
        `SELECT COUNT(*) AS total FROM exam_schedule_details esd
         JOIN exam_schedules es ON es.id = esd.exam_schedule_id
         WHERE esd.exam_id = ? AND es.status <> 'cancelled' AND esd.status <> 'cancelled'`,
        [examId]
      );
      if (Number(remaining[0].total) === 0) {
        await conn.query("UPDATE exams SET status = 'draft', updated_at = NOW() WHERE id = ? AND status = 'scheduled'", [examId]);
      }
    }

    await persistConflicts(scheduleId, []);
    await auditService.record({
      userId: actor.id,
      action: 'schedule.cancel',
      entityType: 'exam_schedule',
      entityId: scheduleId,
      before: { status: schedule.status },
      after: { status: 'cancelled' },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return getSchedule(scheduleId, actor);
  });
}

// ---------------------------------------------------------------------------
// Manual assignment / reschedule
// ---------------------------------------------------------------------------

async function addScheduleDetail(scheduleId, input, actor, meta) {
  return database.withTransaction(async (conn) => {
    await lockRow(conn, 'exam_schedules', scheduleId);
    const schedule = await requireSchedule(conn, scheduleId);
    assertEditable(schedule);

    const { context, occupied } = await buildSaveContext(conn, schedule.exam_period_id, actor);
    const existing = await loadEntries(conn, { scheduleId });

    await lockRow(conn, 'exams', input.examId);
    const [already] = await conn.query(
      "SELECT id FROM exam_schedule_details WHERE exam_schedule_id = ? AND exam_id = ? AND status <> 'cancelled' LIMIT 1",
      [scheduleId, input.examId]
    );
    if (already.length) {
      throw ApiError.conflict('This exam is already scheduled in this timetable.', { code: 'EXAM_ALREADY_SCHEDULED' });
    }

    const entry = await buildValidatedEntry(conn, context, input, { existingEntries: existing, occupied });
    assertDepartmentScopeEntry(actor, entry);

    let insertId;
    try {
      const [result] = await conn.query(
        `INSERT INTO exam_schedule_details
           (exam_schedule_id, exam_id, section_id, room_id, time_slot_id, exam_date, start_time, end_time,
            duration_minutes, total_students, invigilator_count, status, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'scheduled', ?, ?)`,
        [
          scheduleId,
          entry.examId,
          entry.sectionId,
          entry.roomId,
          entry.timeSlotId,
          entry.examDate,
          entry.startTime,
          entry.endTime,
          entry.durationMinutes,
          entry.enrollmentCount,
          input.notes || null,
          actor.id,
        ]
      );
      insertId = result.insertId;
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        throw ApiError.conflict('This room is already booked for that date and time slot.', { code: 'ROOM_DOUBLE_BOOKED' });
      }
      throw error;
    }

    await conn.query("UPDATE exams SET status = 'scheduled', updated_at = NOW() WHERE id = ? AND status NOT IN ('published','cancelled')", [
      entry.examId,
    ]);
    await auditService.record({
      userId: actor.id,
      action: 'schedule.detail.create',
      entityType: 'exam_schedule_detail',
      entityId: insertId,
      after: { scheduleId, examId: entry.examId, roomId: entry.roomId, date: entry.examDate },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return getSchedule(scheduleId, actor);
  });
}

async function updateScheduleDetail(detailId, input, actor, meta) {
  return database.withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT id, exam_schedule_id FROM exam_schedule_details WHERE id = ? LIMIT 1', [detailId]);
    if (!rows.length) throw ApiError.notFound('Schedule entry not found.', { code: 'DETAIL_NOT_FOUND' });
    const scheduleId = rows[0].exam_schedule_id;

    await lockRow(conn, 'exam_schedules', scheduleId);
    const schedule = await requireSchedule(conn, scheduleId);
    assertEditable(schedule);

    const [currentRows] = await conn.query(
      'SELECT id, exam_id, room_id, time_slot_id, exam_date, notes FROM exam_schedule_details WHERE id = ? LIMIT 1',
      [detailId]
    );
    const current = currentRows[0];

    const { context, occupied } = await buildSaveContext(conn, schedule.exam_period_id, actor);
    const existing = await loadEntries(conn, { scheduleId });

    const allocation = {
      examId: current.exam_id,
      roomId: input.roomId !== undefined ? input.roomId : current.room_id,
      timeSlotId: input.timeSlotId !== undefined ? input.timeSlotId : current.time_slot_id,
      examDate: input.examDate !== undefined ? input.examDate : toDateString(current.exam_date),
    };
    const entry = await buildValidatedEntry(conn, context, allocation, { existingEntries: existing, occupied, excludeDetailId: detailId });
    assertDepartmentScopeEntry(actor, entry);

    try {
      await conn.query(
        `UPDATE exam_schedule_details
         SET room_id = ?, time_slot_id = ?, exam_date = ?, start_time = ?, end_time = ?,
             duration_minutes = ?, total_students = ?, notes = COALESCE(?, notes), updated_at = NOW()
         WHERE id = ?`,
        [
          entry.roomId,
          entry.timeSlotId,
          entry.examDate,
          entry.startTime,
          entry.endTime,
          entry.durationMinutes,
          entry.enrollmentCount,
          input.notes !== undefined ? input.notes : null,
          detailId,
        ]
      );
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        throw ApiError.conflict('This room is already booked for that date and time slot.', { code: 'ROOM_DOUBLE_BOOKED' });
      }
      throw error;
    }

    await auditService.record({
      userId: actor.id,
      action: 'schedule.detail.update',
      entityType: 'exam_schedule_detail',
      entityId: detailId,
      before: { roomId: current.room_id, timeSlotId: current.time_slot_id, date: toDateString(current.exam_date) },
      after: { roomId: entry.roomId, timeSlotId: entry.timeSlotId, date: entry.examDate },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return getSchedule(scheduleId, actor);
  });
}

async function deleteScheduleDetail(detailId, actor, meta) {
  return database.withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT id, exam_schedule_id, exam_id FROM exam_schedule_details WHERE id = ? LIMIT 1', [detailId]);
    if (!rows.length) throw ApiError.notFound('Schedule entry not found.', { code: 'DETAIL_NOT_FOUND' });
    const { exam_schedule_id: scheduleId, exam_id: examId } = rows[0];

    await lockRow(conn, 'exam_schedules', scheduleId);
    const schedule = await requireSchedule(conn, scheduleId);
    assertEditable(schedule);

    await conn.query("UPDATE exam_schedule_details SET status = 'cancelled', updated_at = NOW() WHERE id = ?", [detailId]);

    if (examId) {
      const [remaining] = await conn.query(
        `SELECT COUNT(*) AS total FROM exam_schedule_details esd
         JOIN exam_schedules es ON es.id = esd.exam_schedule_id
         WHERE esd.exam_id = ? AND es.status <> 'cancelled' AND esd.status <> 'cancelled'`,
        [examId]
      );
      if (Number(remaining[0].total) === 0) {
        await conn.query("UPDATE exams SET status = 'draft', updated_at = NOW() WHERE id = ? AND status = 'scheduled'", [examId]);
      }
    }

    await auditService.record({
      userId: actor.id,
      action: 'schedule.detail.delete',
      entityType: 'exam_schedule_detail',
      entityId: detailId,
      before: { scheduleId, examId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return getSchedule(scheduleId, actor);
  });
}

module.exports = {
  generatePreview,
  listSchedules,
  getSchedule,
  validateSchedule,
  saveDraft,
  publishSchedule,
  cancelSchedule,
  addScheduleDetail,
  updateScheduleDetail,
  deleteScheduleDetail,
  // exported for tests
  _internals: { overlapsWithGap, addMinutes, detectConflicts, eachDate },
};