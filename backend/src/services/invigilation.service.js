'use strict';

/**
 * Invigilation management (Phase 6).
 *
 * Duties reuse the existing `invigilations` table (FK to
 * `exam_schedule_details`). This service owns:
 *
 *   - policy settings (required counts, workload caps, prep/handover buffers,
 *     own-course prevention) and per-room / per-exam-type requirement overrides;
 *   - manual assignment, reassignment and cancellation of duties;
 *   - a deterministic greedy auto-assignment algorithm (preview + persist);
 *   - workload, unfilled and conflict reporting;
 *   - draft vs published rosters (notifications are only produced for changes
 *     that affect an approved/published roster).
 *
 * Hard rules (always re-validated against the latest state inside the write
 * transaction, with row locks):
 *   - the exam must exist and its schedule must not be cancelled/archived;
 *   - the invigilator and their user account must be active;
 *   - no duplicate duty for the same invigilator + exam;
 *   - half-open overlap [start - prep, end + handover) against the invigilator's
 *     other duties;
 *   - the (buffered) duty window must fit the invigilator's declared availability
 *     and avoid blackout windows, when any availability has been declared;
 *   - workload caps per day and per exam period (0 = unlimited);
 *   - optionally, an invigilator may not invigilate a section they teach.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const notificationService = require('./notification.service');
const { assertDepartmentScope } = require('./scope');
const { paginate, timeToMinutes, toDateString } = require('../validators/shared');

const EXAM_TYPES = ['midterm', 'final', 'supplementary', 'quiz', 'practical', 'other'];
const DUTY_ROLES = ['lead', 'invigilator'];
const PUBLISH_STATUSES = ['draft', 'published'];
const MAX_DAY_MINUTES = 24 * 60;

// Machine-readable blocker reasons, shared by validation, auto-assign and the
// unfilled report so a reason is never silently dropped.
const REASONS = {
  INVIGILATOR_NOT_FOUND: 'The selected invigilator does not exist.',
  INVIGILATOR_INACTIVE: 'The invigilator or their user account is inactive.',
  DUPLICATE_DUTY: 'This invigilator is already assigned to this exam.',
  OWN_COURSE: 'The invigilator teaches this course section and may not invigilate it.',
  OVERLAP: 'The invigilator already has a duty that overlaps this one (including preparation/handover buffers).',
  OUTSIDE_AVAILABILITY: "The duty falls outside the invigilator's declared availability.",
  BLACKOUT: "The duty falls inside a blackout window declared by the invigilator.",
  MAX_DUTIES_PER_DAY: 'The invigilator has reached the maximum number of duties per day.',
  MAX_DUTIES_PER_PERIOD: 'The invigilator has reached the maximum number of duties for the exam period.',
  DETAIL_NOT_FOUND: 'The exam schedule entry does not exist.',
  DETAIL_UNAVAILABLE: 'The exam schedule entry is cancelled or belongs to a cancelled/archived schedule.',
  NO_ACTIVE_INVIGILATORS: 'There are no active invigilators available to assign.',
};

function validationError(details) {
  return ApiError.badRequest('Validation failed.', { code: 'VALIDATION_ERROR', details });
}

function reason(code) {
  return { code, message: REASONS[code] || code };
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function dayOfWeek(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const dow = date.getUTCDay();
  return dow === 0 ? 7 : dow; // ISO: Monday=1 .. Sunday=7
}

/** Buffered duty window in minutes past midnight: [start - prep, end + handover). */
function dutyWindow(startTime, endTime, settings) {
  const start = Math.max(0, (timeToMinutes(startTime) || 0) - settings.preparationMinutes);
  const end = Math.min(MAX_DAY_MINUTES, (timeToMinutes(endTime) || 0) + settings.handoverMinutes);
  return { start, end };
}

function windowsOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

function dateInRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

function toPublicSettings(row) {
  return {
    defaultRequiredInvigilators: Number(row.default_required_invigilators),
    defaultMaxDutiesPerDay: Number(row.default_max_duties_per_day),
    defaultMaxDutiesPerPeriod: Number(row.default_max_duties_per_period),
    preparationMinutes: Number(row.preparation_minutes),
    handoverMinutes: Number(row.handover_minutes),
    preventOwnCourse: Boolean(row.prevent_own_course),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

function toPublicRequirement(row) {
  return {
    id: row.id,
    uuid: row.uuid,
    scope: row.scope,
    roomId: row.room_id,
    examType: row.exam_type,
    requiredCount: Number(row.required_count),
    isActive: Boolean(row.is_active),
    note: row.note,
    room: row.room_id ? { id: row.room_id, name: row.room_name, buildingCode: row.building_code } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const DUTY_SELECT = `
  iv.id, iv.uuid, iv.exam_schedule_detail_id AS detail_id, iv.role, iv.status, iv.publish_status,
  iv.published_at, iv.published_by, iv.assigned_by, iv.assigned_at, iv.notes, iv.created_at, iv.updated_at,
  iv.user_id, iv.invigilator_id,
  esd.exam_schedule_id, esd.exam_id, esd.section_id, esd.room_id, esd.exam_date, esd.start_time, esd.end_time,
  esd.duration_minutes, esd.status AS detail_status, esd.invigilator_count,
  es.exam_period_id, es.status AS schedule_status,
  ex.title AS exam_title, ex.exam_type,
  c.code AS course_code, c.title AS course_title, c.department_id AS course_department_id,
  sec.section, sec.section_name,
  r.name AS room_name, b.code AS building_code,
  inv.staff_identifier, u.full_name AS invigilator_name, u.email AS invigilator_email, u.is_active AS invigilator_user_active
`;

const DUTY_JOINS = `
  FROM invigilations iv
  JOIN exam_schedule_details esd ON esd.id = iv.exam_schedule_detail_id
  JOIN exam_schedules es ON es.id = esd.exam_schedule_id
  LEFT JOIN exams ex ON ex.id = esd.exam_id
  LEFT JOIN courses c ON c.id = ex.course_id
  LEFT JOIN sections sec ON sec.id = esd.section_id
  LEFT JOIN rooms r ON r.id = esd.room_id
  LEFT JOIN buildings b ON b.id = r.building_id
  LEFT JOIN invigilators inv ON inv.id = iv.invigilator_id
  LEFT JOIN users u ON u.id = iv.user_id
`;

function toPublicDuty(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    detailId: row.detail_id,
    examScheduleId: row.exam_schedule_id,
    examPeriodId: row.exam_period_id,
    exam: row.exam_id
      ? {
          id: row.exam_id,
          title: row.exam_title,
          examType: row.exam_type,
          courseCode: row.course_code,
          courseTitle: row.course_title,
          departmentId: row.course_department_id,
        }
      : null,
    section: row.section_id ? { id: row.section_id, section: row.section, sectionName: row.section_name } : null,
    room: row.room_id ? { id: row.room_id, name: row.room_name, buildingCode: row.building_code } : null,
    examDate: toDateString(row.exam_date),
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    role: row.role,
    status: row.status,
    publishStatus: row.publish_status,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at,
    notes: row.notes,
    invigilator: row.invigilator_id || row.user_id
      ? {
          id: row.invigilator_id,
          userId: row.user_id,
          staffIdentifier: row.staff_identifier || null,
          fullName: row.invigilator_name || null,
          email: row.invigilator_email || null,
          isActive: row.invigilator_user_active === null || row.invigilator_user_active === undefined ? null : Boolean(row.invigilator_user_active),
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function readSettingsRow(runner) {
  const [rows] = await runner.query('SELECT * FROM invigilation_settings WHERE id = 1 LIMIT 1');
  if (rows.length) return rows[0];
  await runner.query('INSERT IGNORE INTO invigilation_settings (id) VALUES (1)');
  const [again] = await runner.query('SELECT * FROM invigilation_settings WHERE id = 1 LIMIT 1');
  return again[0];
}

async function loadSettings(runner) {
  const row = await readSettingsRow(runner);
  return {
    defaultRequiredInvigilators: Number(row.default_required_invigilators),
    defaultMaxDutiesPerDay: Number(row.default_max_duties_per_day),
    defaultMaxDutiesPerPeriod: Number(row.default_max_duties_per_period),
    preparationMinutes: Number(row.preparation_minutes),
    handoverMinutes: Number(row.handover_minutes),
    preventOwnCourse: Boolean(row.prevent_own_course),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

async function getSettings() {
  return loadSettings(database.getPool());
}

async function updateSettings(input, actor, meta) {
  const before = await getSettings();
  const sets = [];
  const params = [];
  const map = {
    defaultRequiredInvigilators: 'default_required_invigilators',
    defaultMaxDutiesPerDay: 'default_max_duties_per_day',
    defaultMaxDutiesPerPeriod: 'default_max_duties_per_period',
    preparationMinutes: 'preparation_minutes',
    handoverMinutes: 'handover_minutes',
  };
  Object.entries(map).forEach(([key, column]) => {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(input[key]);
    }
  });
  if (input.preventOwnCourse !== undefined) {
    sets.push('prevent_own_course = ?');
    params.push(input.preventOwnCourse ? 1 : 0);
  }
  if (sets.length) {
    sets.push('updated_by = ?', 'updated_at = NOW()');
    params.push(actor.id);
    await database.getPool().query(`UPDATE invigilation_settings SET ${sets.join(', ')} WHERE id = 1`, params);
  }
  const after = await getSettings();
  await auditService.record({
    userId: actor.id,
    action: 'invigilation.settings.update',
    entityType: 'invigilation_settings',
    entityId: 1,
    before,
    after,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return after;
}

// ---------------------------------------------------------------------------
// Requirements (per-room / per-exam-type overrides)
// ---------------------------------------------------------------------------

async function listRequirements({ includeInactive = false } = {}) {
  const where = includeInactive ? '' : "WHERE ir.is_active = 1";
  const [rows] = await database
    .getPool()
    .query(
      `SELECT ir.*, r.name AS room_name, b.code AS building_code
       FROM invigilation_requirements ir
       LEFT JOIN rooms r ON r.id = ir.room_id
       LEFT JOIN buildings b ON b.id = r.building_id
       ${where}
       ORDER BY ir.scope ASC, ir.room_id ASC, ir.exam_type ASC, ir.id ASC`
    );
  return rows.map(toPublicRequirement);
}

async function assertRequirementTargets(input, scope) {
  if (scope === 'room') {
    const [rows] = await database.getPool().query('SELECT id FROM rooms WHERE id = ? LIMIT 1', [input.roomId]);
    if (!rows.length) throw validationError([{ field: 'roomId', message: 'The selected room does not exist.' }]);
  } else {
    if (!EXAM_TYPES.includes(input.examType)) {
      throw validationError([{ field: 'examType', message: `examType must be one of: ${EXAM_TYPES.join(', ')}.` }]);
    }
  }
}

async function assertRequirementUnique(input, excludeId = null) {
  const clauses = ['scope = ?'];
  const params = [input.scope];
  if (input.scope === 'room') {
    clauses.push('room_id = ?');
    params.push(input.roomId);
  } else {
    clauses.push('exam_type = ?');
    params.push(input.examType);
  }
  clauses.push('(? IS NULL OR id <> ?)');
  params.push(excludeId, excludeId);
  const [rows] = await database.getPool().query(`SELECT id FROM invigilation_requirements WHERE ${clauses.join(' AND ')} LIMIT 1`, params);
  if (rows.length) {
    throw ApiError.conflict('A requirement already exists for this scope and target.', { code: 'DUPLICATE_REQUIREMENT' });
  }
}

async function createRequirement(input, actor, meta) {
  await assertRequirementTargets(input, input.scope);
  await assertRequirementUnique(input);
  const [result] = await database.getPool().query(
    `INSERT INTO invigilation_requirements (scope, room_id, exam_type, required_count, is_active, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.scope,
      input.scope === 'room' ? input.roomId : null,
      input.scope === 'exam_type' ? input.examType : null,
      input.requiredCount,
      input.isActive === undefined ? 1 : Number(input.isActive),
      input.note !== undefined ? input.note : null,
      actor.id,
    ]
  );
  await auditService.record({
    userId: actor.id,
    action: 'invigilation.requirement.create',
    entityType: 'invigilation_requirement',
    entityId: result.insertId,
    after: input,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  const list = await listRequirements({ includeInactive: true });
  return list.find((item) => item.id === result.insertId) || null;
}

async function updateRequirement(id, input, actor, meta) {
  const [rows] = await database.getPool().query('SELECT * FROM invigilation_requirements WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) throw ApiError.notFound('Requirement not found.', { code: 'REQUIREMENT_NOT_FOUND' });
  const before = rows[0];
  const merged = {
    scope: before.scope,
    roomId: input.roomId !== undefined ? input.roomId : before.room_id,
    examType: input.examType !== undefined ? input.examType : before.exam_type,
  };
  await assertRequirementUnique(merged, id);

  const sets = [];
  const params = [];
  if (input.requiredCount !== undefined) {
    sets.push('required_count = ?');
    params.push(input.requiredCount);
  }
  if (input.isActive !== undefined) {
    sets.push('is_active = ?');
    params.push(input.isActive ? 1 : 0);
  }
  if (input.note !== undefined) {
    sets.push('note = ?');
    params.push(input.note);
  }
  if (sets.length) {
    sets.push('updated_at = NOW()');
    params.push(id);
    await database.getPool().query(`UPDATE invigilation_requirements SET ${sets.join(', ')} WHERE id = ?`, params);
  }
  await auditService.record({
    userId: actor.id,
    action: 'invigilation.requirement.update',
    entityType: 'invigilation_requirement',
    entityId: id,
    before: { requiredCount: Number(before.required_count), isActive: Boolean(before.is_active) },
    after: input,
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  const list = await listRequirements({ includeInactive: true });
  return list.find((item) => item.id === id) || null;
}

async function deleteRequirement(id, actor, meta) {
  const [rows] = await database.getPool().query('SELECT * FROM invigilation_requirements WHERE id = ? LIMIT 1', [id]);
  if (!rows.length) throw ApiError.notFound('Requirement not found.', { code: 'REQUIREMENT_NOT_FOUND' });
  await database.getPool().query('DELETE FROM invigilation_requirements WHERE id = ?', [id]);
  await auditService.record({
    userId: actor.id,
    action: 'invigilation.requirement.delete',
    entityType: 'invigilation_requirement',
    entityId: id,
    before: { scope: rows[0].scope, roomId: rows[0].room_id, examType: rows[0].exam_type },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return { id };
}

async function loadActiveRequirements(runner) {
  const [rows] = await runner.query('SELECT scope, room_id, exam_type, required_count FROM invigilation_requirements WHERE is_active = 1');
  return rows.map((row) => ({ scope: row.scope, roomId: row.room_id, examType: row.exam_type, requiredCount: Number(row.required_count) }));
}

/** Precedence: room override > exam-type override > detail count > global default. */
function resolveRequiredCount(detail, settings, requirements) {
  const roomReq = requirements.find((r) => r.scope === 'room' && Number(r.roomId) === Number(detail.roomId));
  if (roomReq) return roomReq.requiredCount;
  const typeReq = requirements.find((r) => r.scope === 'exam_type' && r.examType === detail.examType);
  if (typeReq) return typeReq.requiredCount;
  if (detail.invigilatorCount && Number(detail.invigilatorCount) > 0) return Number(detail.invigilatorCount);
  return settings.defaultRequiredInvigilators;
}

// ---------------------------------------------------------------------------
// Loading helpers (accept a pool or a transaction connection)
// ---------------------------------------------------------------------------

async function loadAvailabilityMap(runner, invigilatorIds) {
  const map = new Map();
  if (!invigilatorIds.length) return map;
  const [rows] = await runner.query(
    `SELECT invigilator_id, day_of_week, start_time, end_time, is_available, effective_from, effective_to
     FROM invigilator_availability WHERE invigilator_id IN (${invigilatorIds.map(() => '?').join(', ')})`,
    invigilatorIds
  );
  for (const row of rows) {
    if (!map.has(row.invigilator_id)) map.set(row.invigilator_id, []);
    map.get(row.invigilator_id).push({
      dayOfWeek: Number(row.day_of_week),
      start: timeToMinutes(row.start_time),
      end: timeToMinutes(row.end_time),
      isAvailable: Boolean(row.is_available),
      effectiveFrom: row.effective_from ? toDateString(row.effective_from) : null,
      effectiveTo: row.effective_to ? toDateString(row.effective_to) : null,
    });
  }
  return map;
}

async function loadActiveInvigilators(runner, departmentId = null) {
  const clauses = ['i.is_active = 1', 'u.is_active = 1', 'u.deleted_at IS NULL'];
  const params = [];
  if (departmentId) {
    clauses.push('i.department_id = ?');
    params.push(departmentId);
  }
  const [rows] = await runner.query(
    `SELECT i.id, i.user_id, i.instructor_id, i.staff_identifier, i.department_id,
            i.max_duties_per_day, i.max_duties_per_period, i.is_active, u.is_active AS user_active
     FROM invigilators i JOIN users u ON u.id = i.user_id
     WHERE ${clauses.join(' AND ')} ORDER BY i.id ASC`,
    params
  );
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    instructorId: row.instructor_id,
    staffIdentifier: row.staff_identifier,
    departmentId: row.department_id,
    maxDutiesPerDay: row.max_duties_per_day === null ? null : Number(row.max_duties_per_day),
    maxDutiesPerPeriod: row.max_duties_per_period === null ? null : Number(row.max_duties_per_period),
    isActive: Boolean(row.is_active) && Boolean(row.user_active),
  }));
}

/**
 * Every non-cancelled duty (optionally restricted). Includes the buffered
 * window inputs so overlap/availability can be re-evaluated in memory.
 */
async function loadActiveDuties(runner, { invigilatorIds = null, detailIds = null, examPeriodId = null } = {}) {
  const clauses = ["iv.status <> 'cancelled'"];
  const params = [];
  if (invigilatorIds && invigilatorIds.length) {
    clauses.push(`iv.invigilator_id IN (${invigilatorIds.map(() => '?').join(', ')})`);
    params.push(...invigilatorIds);
  }
  if (detailIds && detailIds.length) {
    clauses.push(`iv.exam_schedule_detail_id IN (${detailIds.map(() => '?').join(', ')})`);
    params.push(...detailIds);
  }
  if (examPeriodId) {
    clauses.push('es.exam_period_id = ?');
    params.push(examPeriodId);
  }
  const [rows] = await runner.query(
    `SELECT iv.id, iv.exam_schedule_detail_id AS detail_id, iv.invigilator_id, iv.user_id,
            esd.exam_date, esd.start_time, esd.end_time, es.exam_period_id
     FROM invigilations iv
     JOIN exam_schedule_details esd ON esd.id = iv.exam_schedule_detail_id
     JOIN exam_schedules es ON es.id = esd.exam_schedule_id
     WHERE ${clauses.join(' AND ')}`,
    params
  );
  return rows.map((row) => ({
    id: row.id,
    detailId: row.detail_id,
    invigilatorId: row.invigilator_id,
    userId: row.user_id,
    examDate: toDateString(row.exam_date),
    startTime: row.start_time,
    endTime: row.end_time,
    examPeriodId: row.exam_period_id,
  }));
}

async function loadSectionInstructorMap(runner, sectionIds) {
  const map = new Map();
  if (!sectionIds.length) return map;
  const placeholders = sectionIds.map(() => '?').join(', ');
  const [rows] = await runner.query(
    `SELECT section_id, uid FROM (
        SELECT id AS section_id, instructor_id AS uid FROM sections
        WHERE id IN (${placeholders}) AND instructor_id IS NOT NULL
        UNION
        SELECT ia.section_id AS section_id, i.user_id AS uid
        FROM instructor_assignments ia JOIN instructors i ON i.id = ia.instructor_id
        WHERE ia.section_id IN (${placeholders}) AND i.user_id IS NOT NULL
     ) t`,
    [...sectionIds, ...sectionIds]
  );
  for (const row of rows) {
    if (!map.has(row.section_id)) map.set(row.section_id, new Set());
    map.get(row.section_id).add(Number(row.uid));
  }
  return map;
}

const DETAIL_SELECT = `
  esd.id, esd.exam_schedule_id, esd.exam_id, esd.section_id, esd.room_id, esd.exam_date, esd.start_time,
  esd.end_time, esd.invigilator_count, esd.status AS detail_status,
  es.status AS schedule_status, es.exam_period_id,
  ex.exam_type, ex.title AS exam_title, c.department_id AS course_department_id
`;

async function loadDetail(runner, detailId, { forUpdate = false } = {}) {
  const [rows] = await runner.query(
    `SELECT ${DETAIL_SELECT}
     FROM exam_schedule_details esd
     JOIN exam_schedules es ON es.id = esd.exam_schedule_id
     LEFT JOIN exams ex ON ex.id = esd.exam_id
     LEFT JOIN courses c ON c.id = ex.course_id
     WHERE esd.id = ? LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [detailId]
  );
  if (!rows.length) return null;
  const row = rows[0];
  const instructorMap = await loadSectionInstructorMap(runner, [row.section_id]);
  return {
    id: row.id,
    examScheduleId: row.exam_schedule_id,
    examId: row.exam_id,
    sectionId: row.section_id,
    roomId: row.room_id,
    examDate: toDateString(row.exam_date),
    startTime: row.start_time,
    endTime: row.end_time,
    invigilatorCount: Number(row.invigilator_count || 0),
    detailStatus: row.detail_status,
    scheduleStatus: row.schedule_status,
    examPeriodId: row.exam_period_id,
    examType: row.exam_type,
    examTitle: row.exam_title,
    departmentId: row.course_department_id,
    sectionInstructorUserIds: instructorMap.get(row.section_id) || new Set(),
  };
}

async function loadScopedDetails(runner, { examPeriodId = null, scheduleId = null, detailId = null, dateFrom = null, dateTo = null, actor = null } = {}) {
  const clauses = ["esd.status <> 'cancelled'", "es.status NOT IN ('cancelled','archived')"];
  const params = [];
  if (detailId) {
    clauses.push('esd.id = ?');
    params.push(detailId);
  }
  if (scheduleId) {
    clauses.push('esd.exam_schedule_id = ?');
    params.push(scheduleId);
  }
  if (examPeriodId) {
    clauses.push('es.exam_period_id = ?');
    params.push(examPeriodId);
  }
  if (dateFrom) {
    clauses.push('esd.exam_date >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    clauses.push('esd.exam_date <= ?');
    params.push(dateTo);
  }
  if (actor && actor.role === 'department_head') {
    clauses.push('c.department_id = ?');
    params.push(actor.departmentId || 0);
  }
  const [rows] = await runner.query(
    `SELECT ${DETAIL_SELECT}
     FROM exam_schedule_details esd
     JOIN exam_schedules es ON es.id = esd.exam_schedule_id
     LEFT JOIN exams ex ON ex.id = esd.exam_id
     LEFT JOIN courses c ON c.id = ex.course_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY esd.exam_date ASC, esd.start_time ASC, esd.id ASC`,
    params
  );
  const sectionIds = [...new Set(rows.map((row) => row.section_id))];
  const instructorMap = await loadSectionInstructorMap(runner, sectionIds);
  return rows.map((row) => ({
    id: row.id,
    examScheduleId: row.exam_schedule_id,
    examId: row.exam_id,
    sectionId: row.section_id,
    roomId: row.room_id,
    examDate: toDateString(row.exam_date),
    startTime: row.start_time,
    endTime: row.end_time,
    invigilatorCount: Number(row.invigilator_count || 0),
    detailStatus: row.detail_status,
    scheduleStatus: row.schedule_status,
    examPeriodId: row.exam_period_id,
    examType: row.exam_type,
    examTitle: row.exam_title,
    departmentId: row.course_department_id,
    sectionInstructorUserIds: instructorMap.get(row.section_id) || new Set(),
  }));
}

function assertDetailAssignable(detail) {
  if (!detail) throw ApiError.notFound(REASONS.DETAIL_NOT_FOUND, { code: 'DETAIL_NOT_FOUND' });
  if (detail.detailStatus === 'cancelled' || detail.scheduleStatus === 'cancelled' || detail.scheduleStatus === 'archived') {
    throw ApiError.conflict(REASONS.DETAIL_UNAVAILABLE, { code: 'DETAIL_UNAVAILABLE' });
  }
}

/** Department heads may only assign invigilators that belong to their department. */
function assertInvigilatorScope(actor, departmentId) {
  if (actor && actor.role === 'department_head' && departmentId && Number(departmentId) !== Number(actor.departmentId)) {
    throw ApiError.forbidden('Department heads may only assign invigilators from their own department.', { code: 'DEPARTMENT_SCOPE' });
  }
}

// ---------------------------------------------------------------------------
// Eligibility evaluation
// ---------------------------------------------------------------------------

function countForInvigilator(duties, invigilatorId, predicate) {
  let total = 0;
  for (const duty of duties) {
    if (Number(duty.invigilatorId) !== Number(invigilatorId)) continue;
    if (predicate && !predicate(duty)) continue;
    total += 1;
  }
  return total;
}

/**
 * Evaluate one (detail, invigilator) pair against the loaded context.
 * Returns { ok, reasons: [{code, message}] }.
 */
function evaluateAssignment(detail, invigilator, ctx, options = {}) {
  const reasons = [];
  const { ignoreDutyId = null } = options;
  const settings = ctx.settings;

  if (!invigilator) return { ok: false, reasons: [reason('INVIGILATOR_NOT_FOUND')] };
  if (!invigilator.isActive) reasons.push(reason('INVIGILATOR_INACTIVE'));

  // Duplicate duty on the same detail.
  if (ctx.duties.some((duty) => Number(duty.invigilatorId) === Number(invigilator.id) && Number(duty.detailId) === Number(detail.id) && Number(duty.id) !== Number(ignoreDutyId))) {
    reasons.push(reason('DUPLICATE_DUTY'));
  }

  // Own-course prevention.
  if (settings.preventOwnCourse && detail.sectionInstructorUserIds && detail.sectionInstructorUserIds.has(Number(invigilator.userId))) {
    reasons.push(reason('OWN_COURSE'));
  }

  const window = dutyWindow(detail.startTime, detail.endTime, settings);
  const dow = dayOfWeek(detail.examDate);

  // Availability.
  const windows = ctx.availabilityByInv.get(invigilator.id) || [];
  if (windows.length) {
    const applicable = windows.filter(
      (w) => (!w.effectiveFrom || w.effectiveFrom <= detail.examDate) && (!w.effectiveTo || w.effectiveTo >= detail.examDate)
    );
    const availableWindows = applicable.filter((w) => w.isAvailable && w.dayOfWeek === dow);
    const blackouts = applicable.filter((w) => !w.isAvailable && w.dayOfWeek === dow);
    const fits = availableWindows.some((w) => window.start >= w.start && window.end <= w.end);
    if (!fits) reasons.push(reason('OUTSIDE_AVAILABILITY'));
    if (blackouts.some((w) => windowsOverlap(window, w))) reasons.push(reason('BLACKOUT'));
  }

  // Overlap against the invigilator's other duties.
  for (const duty of ctx.duties) {
    if (Number(duty.invigilatorId) !== Number(invigilator.id)) continue;
    if (ignoreDutyId !== null && Number(duty.id) === Number(ignoreDutyId)) continue;
    const other = dutyWindow(duty.startTime, duty.endTime, settings);
    if (windowsOverlap(window, other)) {
      reasons.push(reason('OVERLAP'));
      break;
    }
  }

  // Workload caps.
  const capDay = invigilator.maxDutiesPerDay === null || invigilator.maxDutiesPerDay === undefined ? settings.defaultMaxDutiesPerDay : invigilator.maxDutiesPerDay;
  if (capDay && capDay > 0) {
    const sameDay = countForInvigilator(ctx.duties, invigilator.id, (d) => d.examDate === detail.examDate && Number(d.id) !== Number(ignoreDutyId));
    if (sameDay + 1 > capDay) reasons.push(reason('MAX_DUTIES_PER_DAY'));
  }
  const capPeriod = invigilator.maxDutiesPerPeriod === null || invigilator.maxDutiesPerPeriod === undefined ? settings.defaultMaxDutiesPerPeriod : invigilator.maxDutiesPerPeriod;
  if (capPeriod && capPeriod > 0 && detail.examPeriodId) {
    const inPeriod = countForInvigilator(
      ctx.duties,
      invigilator.id,
      (d) => Number(d.examPeriodId) === Number(detail.examPeriodId) && Number(d.id) !== Number(ignoreDutyId)
    );
    if (inPeriod + 1 > capPeriod) reasons.push(reason('MAX_DUTIES_PER_PERIOD'));
  }

  return { ok: reasons.length === 0, reasons };
}

/** Build an evaluation context on a runner (pool or transaction connection). */
async function buildContext(runner, { examPeriodId = null, invigilatorIds = null, detailIds = null } = {}) {
  const settings = await loadSettings(runner);
  const [requirements, invigilators] = await Promise.all([loadActiveRequirements(runner), loadActiveInvigilators(runner)]);
  const ids = invigilatorIds && invigilatorIds.length ? invigilatorIds : invigilators.map((i) => i.id);
  const [availabilityByInv, duties] = await Promise.all([
    loadAvailabilityMap(runner, ids),
    loadActiveDuties(runner, { examPeriodId, invigilatorIds: idSet(ids), detailIds }),
  ]);
  const invigilatorById = new Map(invigilators.map((i) => [Number(i.id), i]));
  return { settings, requirements, invigilators, invigilatorById, availabilityByInv, duties };
}

function idSet(ids) {
  return ids && ids.length ? ids : null;
}

// ---------------------------------------------------------------------------
// Duty read APIs
// ---------------------------------------------------------------------------

function buildDutyFilters(query, actor) {
  const clauses = [];
  const params = [];
  if (query.examPeriodId) {
    clauses.push('es.exam_period_id = ?');
    params.push(query.examPeriodId);
  }
  if (query.scheduleId) {
    clauses.push('esd.exam_schedule_id = ?');
    params.push(query.scheduleId);
  }
  if (query.detailId) {
    clauses.push('iv.exam_schedule_detail_id = ?');
    params.push(query.detailId);
  }
  if (query.invigilatorId) {
    clauses.push('iv.invigilator_id = ?');
    params.push(query.invigilatorId);
  }
  if (query.userId) {
    clauses.push('iv.user_id = ?');
    params.push(query.userId);
  }
  if (query.date) {
    clauses.push('esd.exam_date = ?');
    params.push(query.date);
  }
  if (query.dateFrom) {
    clauses.push('esd.exam_date >= ?');
    params.push(query.dateFrom);
  }
  if (query.dateTo) {
    clauses.push('esd.exam_date <= ?');
    params.push(query.dateTo);
  }
  if (query.status) {
    clauses.push('iv.status = ?');
    params.push(query.status);
  }
  if (query.publishStatus) {
    clauses.push('iv.publish_status = ?');
    params.push(query.publishStatus);
  }
  if (query.role) {
    clauses.push('iv.role = ?');
    params.push(query.role);
  }
  if (actor && actor.role === 'department_head') {
    clauses.push('c.department_id = ?');
    params.push(actor.departmentId || 0);
  }
  // Instructors/students may only see their own duties.
  if (actor && (actor.role === 'instructor' || actor.role === 'student')) {
    clauses.push('iv.user_id = ?');
    params.push(actor.id);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

async function listDuties(query, actor) {
  const { where, params } = buildDutyFilters(query, actor);
  const offset = (query.page - 1) * query.limit;
  const [countRows] = await database
    .getPool()
    .query(`SELECT COUNT(*) AS total ${DUTY_JOINS} ${where}`, params);
  const total = Number(countRows[0].total);
  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${DUTY_SELECT} ${DUTY_JOINS} ${where} ORDER BY esd.exam_date ASC, esd.start_time ASC, iv.id ASC LIMIT ? OFFSET ?`,
      [...params, query.limit, offset]
    );
  return { items: rows.map(toPublicDuty), pagination: paginate({ page: query.page, limit: query.limit, total }) };
}

async function getDuty(id) {
  const [rows] = await database.getPool().query(`SELECT ${DUTY_SELECT} ${DUTY_JOINS} WHERE iv.id = ? LIMIT 1`, [id]);
  if (!rows.length) throw ApiError.notFound('Duty not found.', { code: 'DUTY_NOT_FOUND' });
  return toPublicDuty(rows[0]);
}

async function getRoster(query, actor) {
  const { where, params } = buildDutyFilters(query, actor);
  const [rows] = await database
    .getPool()
    .query(`SELECT ${DUTY_SELECT} ${DUTY_JOINS} ${where} ORDER BY esd.exam_date ASC, esd.start_time ASC, iv.id ASC`, params);
  const days = new Map();
  for (const duty of rows.map(toPublicDuty)) {
    if (!days.has(duty.examDate)) days.set(duty.examDate, []);
    days.get(duty.examDate).push(duty);
  }
  return {
    grouping: query.date ? 'day' : 'range',
    from: query.date || query.dateFrom || null,
    to: query.date || query.dateTo || null,
    dayCount: days.size,
    dutyCount: rows.length,
    days: [...days.entries()].map(([date, duties]) => ({ date, duties })),
  };
}

// ---------------------------------------------------------------------------
// Assignment / reassignment / cancellation
// ---------------------------------------------------------------------------

function notificationFor(detail) {
  const examTitle = detail.examTitle || `exam #${detail.examId || detail.id}`;
  const when = `${detail.examDate} ${String(detail.startTime).slice(0, 5)}-${String(detail.endTime).slice(0, 5)}`;
  return { examTitle, when, line: `"${examTitle}" on ${when}` };
}

function toDutyForInsert(invigilator, detail) {
  return {
    invigilatorId: invigilator.id,
    userId: invigilator.userId,
    instructorId: invigilator.instructorId || null,
    detailId: detail.id,
  };
}

async function insertDuty(conn, input, detail, invigilator, actor) {
  try {
    const [result] = await conn.query(
      `INSERT INTO invigilations
         (exam_schedule_detail_id, invigilator_id, user_id, instructor_id, role, status, publish_status, notes, assigned_by, assigned_at)
       VALUES (?, ?, ?, ?, ?, 'assigned', 'draft', ?, ?, NOW())`,
      [detail.id, invigilator.id, invigilator.userId, invigilator.instructorId || null, input.role || 'invigilator', input.notes || null, actor.id]
    );
    return result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict(REASONS.DUPLICATE_DUTY, {
        code: 'DUPLICATE_DUTY',
        details: [{ field: 'invigilatorId', message: REASONS.DUPLICATE_DUTY }],
      });
    }
    throw error;
  }
}

async function dispatchEmails(ids) {
  if (!ids || !ids.length) return null;
  try {
    return await notificationService.dispatchPending({ ids });
  } catch (error) {
    return null;
  }
}

/** The email-channel row ids created by a createForEvent result. */
function emailIdsFrom(result) {
  if (!result || !result.created) return [];
  return result.created.filter((item) => item.channel === 'email').map((item) => item.id);
}

async function assignDuty(input, actor, meta) {
  const outcome = await database.withTransaction(async (conn) => {
    const detail = await loadDetail(conn, input.examScheduleDetailId, { forUpdate: true });
    assertDetailAssignable(detail);
    assertDepartmentScope(actor, detail.departmentId);

    const [invRows] = await conn.query(
      `SELECT i.id, i.user_id, i.instructor_id, i.department_id, i.max_duties_per_day, i.max_duties_per_period, i.is_active,
              u.is_active AS user_active
       FROM invigilators i JOIN users u ON u.id = i.user_id WHERE i.id = ? LIMIT 1 FOR UPDATE`,
      [input.invigilatorId]
    );
    if (!invRows.length) {
      throw validationError([{ field: 'invigilatorId', message: REASONS.INVIGILATOR_NOT_FOUND }]);
    }
    const invRow = invRows[0];
    assertInvigilatorScope(actor, invRow.department_id);
    const invigilator = {
      id: invRow.id,
      userId: invRow.user_id,
      instructorId: invRow.instructor_id,
      maxDutiesPerDay: invRow.max_duties_per_day === null ? null : Number(invRow.max_duties_per_day),
      maxDutiesPerPeriod: invRow.max_duties_per_period === null ? null : Number(invRow.max_duties_per_period),
      isActive: Boolean(invRow.is_active) && Boolean(invRow.user_active),
    };

    const ctx = await buildContext(conn, { examPeriodId: detail.examPeriodId, detailIds: [detail.id] });
    const evaluation = evaluateAssignment(detail, invigilator, ctx, {});
    if (!evaluation.ok) {
      throw ApiError.unprocessable('The invigilator cannot be assigned to this exam.', {
        code: 'DUTY_NOT_ALLOWED',
        details: evaluation.reasons.map((r) => ({ field: 'invigilatorId', message: r.message, reason: r.code })),
      });
    }

    const dutyId = await insertDuty(conn, input, detail, invigilator, actor);
    const emailIds = [];
    if (input.publish) {
      await conn.query("UPDATE invigilations SET publish_status = 'published', published_at = NOW(), published_by = ? WHERE id = ?", [actor.id, dutyId]);
      const note = notificationFor(detail);
      const result = await notificationService.createForEvent(conn, {
        eventType: 'duty.assigned',
        entityType: 'invigilation',
        entityId: dutyId,
        recipients: [{ id: invigilator.userId }],
        title: `Invigilation duty: ${note.examTitle}`,
        message: `You have been assigned to invigilate ${note.line}.`,
        type: 'info',
        priority: 'normal',
        link: `/invigilation?duty=${dutyId}`,
        meta: { dutyId, detailId: detail.id, examDate: detail.examDate, startTime: detail.startTime, endTime: detail.endTime },
        dedupeKey: `duty.assigned:${dutyId}:${detail.id}`,
      });
      emailIds.push(...emailIdsFrom(result));
    }

    await auditService.record({
      userId: actor.id,
      action: 'invigilation.duty.assign',
      entityType: 'invigilation',
      entityId: dutyId,
      after: { detailId: detail.id, invigilatorId: invigilator.id, role: input.role || 'invigilator' },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { dutyId, emailIds };
  });

  await dispatchEmails(outcome.emailIds);
  return getDuty(outcome.dutyId);
}

async function reassignDuty(id, input, actor, meta) {
  const outcome = await database.withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM invigilations WHERE id = ? LIMIT 1 FOR UPDATE', [id]);
    if (!rows.length) throw ApiError.notFound('Duty not found.', { code: 'DUTY_NOT_FOUND' });
    const duty = rows[0];
    if (duty.status === 'cancelled') throw ApiError.conflict('A cancelled duty cannot be reassigned.', { code: 'DUTY_CANCELLED' });

    const detail = await loadDetail(conn, duty.exam_schedule_detail_id, { forUpdate: true });
    assertDetailAssignable(detail);
    assertDepartmentScope(actor, detail.departmentId);

    const [invRows] = await conn.query(
      `SELECT i.id, i.user_id, i.instructor_id, i.department_id, i.max_duties_per_day, i.max_duties_per_period, i.is_active,
              u.is_active AS user_active
       FROM invigilators i JOIN users u ON u.id = i.user_id WHERE i.id = ? LIMIT 1 FOR UPDATE`,
      [input.invigilatorId]
    );
    if (!invRows.length) throw validationError([{ field: 'invigilatorId', message: REASONS.INVIGILATOR_NOT_FOUND }]);
    const invRow = invRows[0];
    assertInvigilatorScope(actor, invRow.department_id);
    const invigilator = {
      id: invRow.id,
      userId: invRow.user_id,
      instructorId: invRow.instructor_id,
      maxDutiesPerDay: invRow.max_duties_per_day === null ? null : Number(invRow.max_duties_per_day),
      maxDutiesPerPeriod: invRow.max_duties_per_period === null ? null : Number(invRow.max_duties_per_period),
      isActive: Boolean(invRow.is_active) && Boolean(invRow.user_active),
    };

    const ctx = await buildContext(conn, { examPeriodId: detail.examPeriodId, detailIds: [detail.id] });
    const evaluation = evaluateAssignment(detail, invigilator, ctx, { ignoreDutyId: id });
    if (!evaluation.ok) {
      throw ApiError.unprocessable('The invigilator cannot be assigned to this exam.', {
        code: 'DUTY_NOT_ALLOWED',
        details: evaluation.reasons.map((r) => ({ field: 'invigilatorId', message: r.message, reason: r.code })),
      });
    }

    const role = input.role || duty.role;
    try {
      await conn.query(
        `UPDATE invigilations SET invigilator_id = ?, user_id = ?, instructor_id = ?, role = ?, status = 'assigned',
            notes = COALESCE(?, notes), updated_at = NOW()
         WHERE id = ?`,
        [invigilator.id, invigilator.userId, invigilator.instructorId || null, role, input.notes !== undefined ? input.notes : null, id]
      );
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        throw ApiError.conflict(REASONS.DUPLICATE_DUTY, { code: 'DUPLICATE_DUTY' });
      }
      throw error;
    }

    const wasPublished = duty.publish_status === 'published';
    const emailIds = [];
    if (wasPublished) {
      const note = notificationFor(detail);
      const previousUserId = duty.user_id;
      if (previousUserId && Number(previousUserId) !== Number(invigilator.userId)) {
        const removed = await notificationService.createForEvent(conn, {
          eventType: 'duty.changed',
          entityType: 'invigilation',
          entityId: id,
          recipients: [{ id: previousUserId }],
          title: `Invigilation duty updated: ${note.examTitle}`,
          message: `You are no longer assigned to invigilate ${note.line}.`,
          type: 'warning',
          priority: 'normal',
          link: `/invigilation?duty=${id}`,
          meta: { dutyId: id, detailId: detail.id, action: 'removed' },
          dedupeKey: `duty.changed:${id}:${detail.id}:removed`,
        });
        emailIds.push(...emailIdsFrom(removed));
      }
      const assigned = await notificationService.createForEvent(conn, {
        eventType: 'duty.changed',
        entityType: 'invigilation',
        entityId: id,
        recipients: [{ id: invigilator.userId }],
        title: `Invigilation duty updated: ${note.examTitle}`,
        message: `You are now assigned to invigilate ${note.line}.`,
        type: 'info',
        priority: 'normal',
        link: `/invigilation?duty=${id}`,
        meta: { dutyId: id, detailId: detail.id, action: 'assigned' },
        dedupeKey: `duty.changed:${id}:${detail.id}:assigned`,
      });
      emailIds.push(...emailIdsFrom(assigned));
    }

    await auditService.record({
      userId: actor.id,
      action: 'invigilation.duty.reassign',
      entityType: 'invigilation',
      entityId: id,
      before: { invigilatorId: duty.invigilator_id, userId: duty.user_id },
      after: { invigilatorId: invigilator.id, userId: invigilator.userId },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { emailIds };
  });

  await dispatchEmails(outcome.emailIds);
  return getDuty(id);
}

async function cancelDuty(id, actor, meta) {
  const outcome = await database.withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM invigilations WHERE id = ? LIMIT 1 FOR UPDATE', [id]);
    if (!rows.length) throw ApiError.notFound('Duty not found.', { code: 'DUTY_NOT_FOUND' });
    const duty = rows[0];
    if (duty.status === 'cancelled') return { emailIds: [], already: true };

    const detail = await loadDetail(conn, duty.exam_schedule_detail_id);
    if (detail) assertDepartmentScope(actor, detail.departmentId);

    await conn.query("UPDATE invigilations SET status = 'cancelled', updated_at = NOW() WHERE id = ?", [id]);

    const emailIds = [];
    if (duty.publish_status === 'published' && detail) {
      const note = notificationFor(detail);
      const result = await notificationService.createForEvent(conn, {
        eventType: 'duty.cancelled',
        entityType: 'invigilation',
        entityId: id,
        recipients: [{ id: duty.user_id }],
        title: `Invigilation duty cancelled: ${note.examTitle}`,
        message: `Your invigilation duty for ${note.line} has been cancelled.`,
        type: 'warning',
        priority: 'high',
        link: `/invigilation?duty=${id}`,
        meta: { dutyId: id, detailId: detail.id },
        dedupeKey: `duty.cancelled:${id}:${detail.id}`,
      });
      emailIds.push(...emailIdsFrom(result));
    }

    await auditService.record({
      userId: actor.id,
      action: 'invigilation.duty.cancel',
      entityType: 'invigilation',
      entityId: id,
      before: { status: duty.status, publishStatus: duty.publish_status },
      after: { status: 'cancelled' },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { emailIds, already: false };
  });

  await dispatchEmails(outcome.emailIds);
  return getDuty(id);
}

// ---------------------------------------------------------------------------
// Auto-assignment
// ---------------------------------------------------------------------------

function groupDutiesByDetail(duties) {
  const map = new Map();
  for (const duty of duties) {
    if (!map.has(duty.detailId)) map.set(duty.detailId, []);
    map.get(duty.detailId).push(duty);
  }
  return map;
}

/**
 * Deterministic greedy planner.
 *
 * For each exam (ordered by date, then start time, then id) it fills the gap
 * between the required and currently assigned invigilator counts, always picking
 * the eligible invigilator with:
 *   1. the fewest duties in the exam period (balance period load);
 *   2. then the fewest duties on that date (balance daily load);
 *   3. then the lowest invigilator id (stable, reproducible).
 */
function planAssignments(details, ctx) {
  const assigned = [];
  const unfilled = [];
  const duties = ctx.duties.map((duty) => ({ ...duty }));
  const byDetail = groupDutiesByDetail(duties);

  for (const detail of details) {
    const required = resolveRequiredCount(detail, ctx.settings, ctx.requirements);
    let current = (byDetail.get(detail.id) || []).length;
    const missing = Math.max(0, required - current);
    if (missing === 0) continue;

    const blockers = new Map();
    let filled = 0;
    for (let slot = 0; slot < missing; slot += 1) {
      const candidates = [];
      for (const invigilator of ctx.invigilators) {
        const evaluation = evaluateAssignment(detail, invigilator, ctx, {});
        if (evaluation.ok) {
          candidates.push(invigilator);
        } else {
          for (const r of evaluation.reasons) blockers.set(r.code, (blockers.get(r.code) || 0) + 1);
        }
      }
      if (!candidates.length) break;

      candidates.sort((a, b) => {
        const aPeriod = countForInvigilator(ctx.duties, a.id, (d) => Number(d.examPeriodId) === Number(detail.examPeriodId));
        const bPeriod = countForInvigilator(ctx.duties, b.id, (d) => Number(d.examPeriodId) === Number(detail.examPeriodId));
        if (aPeriod !== bPeriod) return aPeriod - bPeriod;
        const aDay = countForInvigilator(ctx.duties, a.id, (d) => d.examDate === detail.examDate);
        const bDay = countForInvigilator(ctx.duties, b.id, (d) => d.examDate === detail.examDate);
        if (aDay !== bDay) return aDay - bDay;
        return a.id - b.id;
      });

      const chosen = candidates[0];
      const planned = {
        id: null,
        detailId: detail.id,
        invigilatorId: chosen.id,
        userId: chosen.userId,
        examDate: detail.examDate,
        startTime: detail.startTime,
        endTime: detail.endTime,
        examPeriodId: detail.examPeriodId,
      };
      duties.push(planned);
      ctx.duties.push(planned);
      if (!byDetail.has(detail.id)) byDetail.set(detail.id, []);
      byDetail.get(detail.id).push(planned);
      assigned.push({ detail, invigilator: chosen });
      current += 1;
      filled += 1;
    }

    if (filled < missing) {
      const reasons = [...blockers.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([code, count]) => ({ ...reason(code), count }));
      if (!ctx.invigilators.length) reasons.unshift({ ...reason('NO_ACTIVE_INVIGILATORS'), count: 0 });
      unfilled.push({
        detailId: detail.id,
        examTitle: detail.examTitle,
        examDate: detail.examDate,
        startTime: detail.startTime,
        endTime: detail.endTime,
        required,
        assignedCount: current,
        missing: missing - filled,
        reasons: reasons.length ? reasons : [reason('NO_ACTIVE_INVIGILATORS')],
      });
    }
  }

  return { assigned, unfilled };
}

function publicPlan(details, ctx, planned) {
  return {
    assigned: planned.assigned.map((item) => ({
      detailId: item.detail.id,
      examTitle: item.detail.examTitle,
      examDate: item.detail.examDate,
      startTime: item.detail.startTime,
      endTime: item.detail.endTime,
      invigilatorId: item.invigilator.id,
      userId: item.invigilator.userId,
      staffIdentifier: item.invigilator.staffIdentifier,
    })),
    unfilled: planned.unfilled.map((item) => ({
      ...item,
      reason: item.reasons[0] ? item.reasons[0].code : 'NO_ELIGIBLE_INVIGILATOR',
      reasonMessage: item.reasons[0] ? item.reasons[0].message : 'No eligible invigilator was found.',
    })),
  };
}

async function autoAssign(input, actor, meta) {
  const runner = database.getPool();
  const details = await loadScopedDetails(runner, {
    examPeriodId: input.examPeriodId,
    scheduleId: input.scheduleId,
    detailId: input.detailId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    actor,
  });
  const ctx = await buildContext(runner, { examPeriodId: input.examPeriodId });
  if (input.invigilatorIds && input.invigilatorIds.length) {
    const allowed = new Set(input.invigilatorIds.map(Number));
    ctx.invigilators = ctx.invigilators.filter((i) => allowed.has(Number(i.id)));
  }

  const planned = planAssignments(details, ctx);
  const preview = { dryRun: input.dryRun !== false, ...publicPlan(details, ctx, planned) };

  if (input.dryRun !== false || !planned.assigned.length) {
    return preview;
  }

  // Persist: re-validate every chosen assignment against the latest state inside
  // a transaction, locking each detail row as it is filled.
  const persisted = await database.withTransaction(async (conn) => {
    const created = [];
    const skipped = [...planned.unfilled];
    const emailIds = [];
    for (const item of planned.assigned) {
      // eslint-disable-next-line no-await-in-loop
      const detail = await loadDetail(conn, item.detail.id, { forUpdate: true });
      if (!detail || detail.detailStatus === 'cancelled' || detail.scheduleStatus === 'cancelled' || detail.scheduleStatus === 'archived') {
        skipped.push({ detailId: item.detail.id, examTitle: item.detail.examTitle, missing: 1, reasons: [reason('DETAIL_UNAVAILABLE')] });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const liveCtx = await buildContext(conn, { examPeriodId: detail.examPeriodId, detailIds: [detail.id] });
      const invigilator = liveCtx.invigilatorById.get(Number(item.invigilator.id));
      const evaluation = evaluateAssignment(detail, invigilator, liveCtx, {});
      if (!evaluation.ok) {
        skipped.push({
          detailId: detail.id,
          examTitle: detail.examTitle,
          examDate: detail.examDate,
          startTime: detail.startTime,
          endTime: detail.endTime,
          required: resolveRequiredCount(detail, liveCtx.settings, liveCtx.requirements),
          assignedCount: (liveCtx.duties.filter((d) => Number(d.detailId) === Number(detail.id)) || []).length,
          missing: 1,
          reasons: evaluation.reasons,
        });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const dutyId = await insertDuty(conn, { role: 'invigilator' }, detail, invigilator, actor);
      created.push({ dutyId, detailId: detail.id, invigilatorId: invigilator.id, userId: invigilator.userId });
      void emailIds;
    }
    await auditService.record({
      userId: actor.id,
      action: 'invigilation.auto_assign',
      entityType: 'invigilation',
      entityId: null,
      after: { created: created.length, skipped: skipped.length },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { created, skipped };
  });

  return {
    dryRun: false,
    assigned: persisted.created.map((c) => ({ dutyId: c.dutyId, detailId: c.detailId, invigilatorId: c.invigilatorId, userId: c.userId })),
    assignedCount: persisted.created.length,
    unfilled: persisted.skipped.map((item) => ({ ...item, reason: item.reasons[0] ? item.reasons[0].code : 'NO_ELIGIBLE_INVIGILATOR' })),
    unfilledCount: persisted.skipped.length,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

async function workloadSummary(query, actor) {
  const runner = database.getPool();
  const settings = await loadSettings(runner);
  const clauses = ['i.is_active = 1', 'u.is_active = 1', 'u.deleted_at IS NULL'];
  const params = [];
  if (query.departmentId) {
    clauses.push('i.department_id = ?');
    params.push(query.departmentId);
  }
  if (actor && actor.role === 'department_head') {
    clauses.push('i.department_id = ?');
    params.push(actor.departmentId || 0);
  }
  const [invigilators] = await runner.query(
    `SELECT i.id, i.user_id, i.staff_identifier, i.max_duties_per_day, i.max_duties_per_period,
            u.full_name, d.code AS department_code
     FROM invigilators i JOIN users u ON u.id = i.user_id LEFT JOIN departments d ON d.id = i.department_id
     WHERE ${clauses.join(' AND ')} ORDER BY u.full_name ASC, i.id ASC`,
    params
  );

  const dutyClauses = ["iv.status <> 'cancelled'"];
  const dutyParams = [];
  if (query.examPeriodId) {
    dutyClauses.push('es.exam_period_id = ?');
    dutyParams.push(query.examPeriodId);
  }
  if (query.dateFrom) {
    dutyClauses.push('esd.exam_date >= ?');
    dutyParams.push(query.dateFrom);
  }
  if (query.dateTo) {
    dutyClauses.push('esd.exam_date <= ?');
    dutyParams.push(query.dateTo);
  }
  const [duties] = await runner.query(
    `SELECT iv.invigilator_id, esd.exam_date, es.exam_period_id
     FROM invigilations iv
     JOIN exam_schedule_details esd ON esd.id = iv.exam_schedule_detail_id
     JOIN exam_schedules es ON es.id = esd.exam_schedule_id
     WHERE ${dutyClauses.join(' AND ')}`,
    dutyParams
  );

  const perInv = new Map();
  for (const duty of duties) {
    if (!perInv.has(duty.invigilator_id)) perInv.set(duty.invigilator_id, { total: 0, byDate: new Map(), byPeriod: new Map() });
    const entry = perInv.get(duty.invigilator_id);
    entry.total += 1;
    const date = toDateString(duty.exam_date);
    entry.byDate.set(date, (entry.byDate.get(date) || 0) + 1);
    if (duty.exam_period_id) entry.byPeriod.set(duty.exam_period_id, (entry.byPeriod.get(duty.exam_period_id) || 0) + 1);
  }

  const items = invigilators.map((inv) => {
    const entry = perInv.get(inv.id) || { total: 0, byDate: new Map(), byPeriod: new Map() };
    const capDay = inv.max_duties_per_day === null ? settings.defaultMaxDutiesPerDay : Number(inv.max_duties_per_day);
    const capPeriod = inv.max_duties_per_period === null ? settings.defaultMaxDutiesPerPeriod : Number(inv.max_duties_per_period);
    const periodLoad = query.examPeriodId ? entry.byPeriod.get(Number(query.examPeriodId)) || 0 : entry.total;
    return {
      invigilatorId: inv.id,
      userId: inv.user_id,
      staffIdentifier: inv.staff_identifier,
      fullName: inv.full_name,
      departmentCode: inv.department_code,
      totalDuties: entry.total,
      maxDutiesPerDay: capDay,
      maxDutiesPerPeriod: capPeriod,
      periodDuties: periodLoad,
      remainingPerPeriod: capPeriod > 0 ? Math.max(0, capPeriod - periodLoad) : null,
      byDate: [...entry.byDate.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => (a.date < b.date ? -1 : 1)),
    };
  });

  return {
    policy: {
      defaultMaxDutiesPerDay: settings.defaultMaxDutiesPerDay,
      defaultMaxDutiesPerPeriod: settings.defaultMaxDutiesPerPeriod,
      preparationMinutes: settings.preparationMinutes,
      handoverMinutes: settings.handoverMinutes,
    },
    items,
  };
}

async function unfilledReport(query, actor) {
  const runner = database.getPool();
  const details = await loadScopedDetails(runner, {
    examPeriodId: query.examPeriodId,
    scheduleId: query.scheduleId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    actor,
  });
  const ctx = await buildContext(runner, { examPeriodId: query.examPeriodId });
  const byDetail = groupDutiesByDetail(ctx.duties);

  const items = [];
  for (const detail of details) {
    const required = resolveRequiredCount(detail, ctx.settings, ctx.requirements);
    const assignedCount = (byDetail.get(detail.id) || []).length;
    if (assignedCount >= required) continue;

    const blockers = new Map();
    let eligible = 0;
    for (const invigilator of ctx.invigilators) {
      const evaluation = evaluateAssignment(detail, invigilator, ctx, {});
      if (evaluation.ok) eligible += 1;
      else for (const r of evaluation.reasons) blockers.set(r.code, (blockers.get(r.code) || 0) + 1);
    }
    const reasons = [...blockers.entries()].sort((a, b) => b[1] - a[1]).map(([code, count]) => ({ ...reason(code), count }));
    if (!ctx.invigilators.length) reasons.unshift({ ...reason('NO_ACTIVE_INVIGILATORS'), count: 0 });

    items.push({
      detailId: detail.id,
      examScheduleId: detail.examScheduleId,
      examPeriodId: detail.examPeriodId,
      examTitle: detail.examTitle,
      examDate: detail.examDate,
      startTime: detail.startTime,
      endTime: detail.endTime,
      roomId: detail.roomId,
      requiredCount: required,
      assignedCount,
      missing: required - assignedCount,
      eligibleInvigilators: eligible,
      reasons: reasons.length ? reasons : [reason('NO_ACTIVE_INVIGILATORS')],
      reason: reasons[0] ? reasons[0].code : 'NO_ELIGIBLE_INVIGILATOR',
      reasonMessage: reasons[0] ? reasons[0].message : 'No eligible invigilator is available.',
    });
  }

  items.sort((a, b) => (a.examDate < b.examDate ? -1 : a.examDate > b.examDate ? 1 : a.startTime < b.startTime ? -1 : 1));
  return { totalUnfilledExams: items.length, totalMissingDuties: items.reduce((sum, item) => sum + item.missing, 0), items };
}

async function conflictReport(query, actor) {
  const runner = database.getPool();
  const { where, params } = buildDutyFilters(query, actor);
  const [rows] = await runner.query(`SELECT ${DUTY_SELECT} ${DUTY_JOINS} ${where} ORDER BY esd.exam_date ASC, esd.start_time ASC, iv.id ASC`, params);
  const duties = rows.map(toPublicDuty);
  const settings = await loadSettings(runner);
  const invigilatorIds = [...new Set(duties.map((d) => Number(d.invigilator.id)).filter(Boolean))];
  const [invigilators, availabilityByInv, sectionIds] = await Promise.all([
    loadActiveInvigilators(runner),
    loadAvailabilityMap(runner, invigilatorIds),
    Promise.resolve([...new Set(duties.map((d) => d.section && d.section.id).filter(Boolean))]),
  ]);
  const instructorMap = await loadSectionInstructorMap(runner, sectionIds);
  const invById = new Map(invigilators.map((i) => [Number(i.id), i]));

  const conflicts = [];
  const push = (type, severity, dutyA, dutyB, description) => {
    conflicts.push({ type, severity, description, dutyIds: [dutyA.id, dutyB && dutyB.id].filter(Boolean) });
  };

  for (let i = 0; i < duties.length; i += 1) {
    const duty = duties[i];
    const inv = duty.invigilator && duty.invigilator.id ? invById.get(Number(duty.invigilator.id)) : null;
    const detail = {
      id: duty.detailId,
      roomId: duty.room.id,
      examDate: duty.examDate,
      startTime: duty.startTime,
      endTime: duty.endTime,
      examPeriodId: duty.examPeriodId,
      sectionInstructorUserIds: instructorMap.get(duty.section && duty.section.id) || new Set(),
    };
    if (!duty.invigilator || !duty.invigilator.isActive) {
      push('inactive_invigilator', 'high', duty, null, `Duty #${duty.id} is assigned to an inactive or missing invigilator.`);
    }
    if (settings.preventOwnCourse && detail.sectionInstructorUserIds.has(Number(duty.invigilator.userId))) {
      push('own_course', 'high', duty, null, `Duty #${duty.id}: the invigilator teaches this section.`);
    }
    if (inv) {
      const windows = availabilityByInv.get(inv.id) || [];
      if (windows.length) {
        const dow = dayOfWeek(detail.examDate);
        const win = dutyWindow(detail.startTime, detail.endTime, settings);
        const applicable = windows.filter((w) => (!w.effectiveFrom || w.effectiveFrom <= detail.examDate) && (!w.effectiveTo || w.effectiveTo >= detail.examDate));
        const fits = applicable.filter((w) => w.isAvailable && w.dayOfWeek === dow).some((w) => win.start >= w.start && win.end <= w.end);
        if (!fits) push('availability', 'medium', duty, null, `Duty #${duty.id} falls outside the invigilator's availability.`);
        if (applicable.filter((w) => !w.isAvailable && w.dayOfWeek === dow).some((w) => windowsOverlap(win, w))) {
          push('blackout', 'high', duty, null, `Duty #${duty.id} falls inside a blackout window.`);
        }
      }
      const capDay = inv.maxDutiesPerDay === null ? settings.defaultMaxDutiesPerDay : inv.maxDutiesPerDay;
      if (capDay > 0) {
        const sameDay = duties.filter((d) => Number(d.invigilator.id) === inv.id && d.examDate === duty.examDate).length;
        if (sameDay > capDay && duties.find((d) => Number(d.invigilator.id) === inv.id && d.examDate === duty.examDate).id === duty.id) {
          push('workload_day', 'medium', duty, null, `The invigilator has ${sameDay} duties on ${duty.examDate}, above the cap of ${capDay}.`);
        }
      }
      const capPeriod = inv.maxDutiesPerPeriod === null ? settings.defaultMaxDutiesPerPeriod : inv.maxDutiesPerPeriod;
      if (capPeriod > 0 && duty.examPeriodId) {
        const inPeriod = duties.filter((d) => Number(d.invigilator.id) === inv.id && Number(d.examPeriodId) === Number(duty.examPeriodId)).length;
        if (inPeriod > capPeriod && duties.find((d) => Number(d.invigilator.id) === inv.id && Number(d.examPeriodId) === Number(duty.examPeriodId)).id === duty.id) {
          push('workload_period', 'medium', duty, null, `The invigilator has ${inPeriod} duties in this period, above the cap of ${capPeriod}.`);
        }
      }
    }
    for (let j = i + 1; j < duties.length; j += 1) {
      const other = duties[j];
      if (!duty.invigilator || !other.invigilator) continue;
      if (Number(duty.invigilator.id) !== Number(other.invigilator.id)) continue;
      const a = dutyWindow(duty.startTime, duty.endTime, settings);
      const b = dutyWindow(other.startTime, other.endTime, settings);
      if (windowsOverlap(a, b)) {
        push('overlap', 'critical', duty, other, `Duties #${duty.id} and #${other.id} overlap for the same invigilator (including buffers).`);
      }
    }
  }

  return { totalConflicts: conflicts.length, conflicts };
}

// ---------------------------------------------------------------------------
// Roster publish / unpublish
// ---------------------------------------------------------------------------

async function loadDutiesForPublish(runner, input, actor) {
  const clauses = ["iv.publish_status = 'draft'", "iv.status <> 'cancelled'", "esd.status <> 'cancelled'", "es.status NOT IN ('cancelled','archived')"];
  const params = [];
  if (input.dutyIds && input.dutyIds.length) {
    clauses.push(`iv.id IN (${input.dutyIds.map(() => '?').join(', ')})`);
    params.push(...input.dutyIds);
  }
  if (input.examPeriodId) {
    clauses.push('es.exam_period_id = ?');
    params.push(input.examPeriodId);
  }
  if (input.scheduleId) {
    clauses.push('esd.exam_schedule_id = ?');
    params.push(input.scheduleId);
  }
  if (input.date) {
    clauses.push('esd.exam_date = ?');
    params.push(input.date);
  }
  if (input.dateFrom) {
    clauses.push('esd.exam_date >= ?');
    params.push(input.dateFrom);
  }
  if (input.dateTo) {
    clauses.push('esd.exam_date <= ?');
    params.push(input.dateTo);
  }
  if (actor && actor.role === 'department_head') {
    clauses.push('c.department_id = ?');
    params.push(actor.departmentId || 0);
  }
  const [rows] = await runner.query(`SELECT ${DUTY_SELECT} ${DUTY_JOINS} WHERE ${clauses.join(' AND ')} ORDER BY esd.exam_date ASC, esd.start_time ASC, iv.id ASC FOR UPDATE`, params);
  return rows;
}

async function publishRoster(input, actor, meta) {
  const outcome = await database.withTransaction(async (conn) => {
    const duties = await loadDutiesForPublish(conn, input, actor);
    if (!duties.length) {
      return { publishedCount: 0, notificationCount: 0, emailIds: [] };
    }
    const ids = duties.map((row) => row.id);
    await conn.query(
      `UPDATE invigilations SET publish_status = 'published', published_at = NOW(), published_by = ?, updated_at = NOW()
       WHERE id IN (${ids.map(() => '?').join(', ')})`,
      [actor.id, ...ids]
    );

    const emailIds = [];
    let notificationCount = 0;
    for (const row of duties) {
      if (!row.user_id) continue;
      const pub = toPublicDuty(row);
      // eslint-disable-next-line no-await-in-loop
      const result = await notificationService.createForEvent(conn, {
        eventType: 'duty.published',
        entityType: 'invigilation',
        entityId: row.id,
        recipients: [{ id: row.user_id }],
        title: `Invigilation roster published: ${pub.exam ? pub.exam.title : 'exam'}`,
        message: `You have been confirmed to invigilate "${pub.exam ? pub.exam.title : 'an exam'}" on ${pub.examDate} ${String(pub.startTime).slice(0, 5)}-${String(pub.endTime).slice(0, 5)}${pub.room ? ` in room ${pub.room.name}` : ''}.`,
        type: 'success',
        priority: 'normal',
        link: `/invigilation?duty=${row.id}`,
        meta: { dutyId: row.id, detailId: row.detail_id, examDate: pub.examDate },
        dedupeKey: `duty.published:${row.id}:${row.detail_id}`,
      });
      notificationCount += result.created.length;
      emailIds.push(...emailIdsFrom(result));
    }

    await auditService.record({
      userId: actor.id,
      action: 'invigilation.roster.publish',
      entityType: 'invigilation',
      entityId: null,
      after: { publishedCount: ids.length },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { publishedCount: ids.length, notificationCount, emailIds };
  });

  await dispatchEmails(outcome.emailIds);
  return { publishedCount: outcome.publishedCount, notificationCount: outcome.notificationCount };
}

async function unpublishRoster(input, actor, meta) {
  return database.withTransaction(async (conn) => {
    const clauses = ["iv.publish_status = 'published'", "iv.status <> 'cancelled'", "es.status NOT IN ('cancelled','archived')"];
    const params = [];
    if (input.dutyIds && input.dutyIds.length) {
      clauses.push(`iv.id IN (${input.dutyIds.map(() => '?').join(', ')})`);
      params.push(...input.dutyIds);
    }
    if (input.examPeriodId) {
      clauses.push('es.exam_period_id = ?');
      params.push(input.examPeriodId);
    }
    if (input.scheduleId) {
      clauses.push('esd.exam_schedule_id = ?');
      params.push(input.scheduleId);
    }
    if (actor && actor.role === 'department_head') {
      clauses.push('c.department_id = ?');
      params.push(actor.departmentId || 0);
    }
    const [rows] = await conn.query(
      `SELECT iv.id ${DUTY_JOINS} WHERE ${clauses.join(' AND ')} FOR UPDATE`,
      params
    );
    if (!rows.length) return { unpublishedCount: 0 };
    const ids = rows.map((row) => row.id);
    await conn.query(
      `UPDATE invigilations SET publish_status = 'draft', published_at = NULL, published_by = NULL, updated_at = NOW()
       WHERE id IN (${ids.map(() => '?').join(', ')})`,
      ids
    );
    await auditService.record({
      userId: actor.id,
      action: 'invigilation.roster.unpublish',
      entityType: 'invigilation',
      entityId: null,
      after: { unpublishedCount: ids.length },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return { unpublishedCount: ids.length };
  });
}

// ---------------------------------------------------------------------------
// Options for the assignment form
// ---------------------------------------------------------------------------

async function listDetailOptions(query, actor) {
  const details = await loadScopedDetails(database.getPool(), {
    examPeriodId: query.examPeriodId,
    scheduleId: query.scheduleId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    actor,
  });
  const ctx = await buildContext(database.getPool(), { examPeriodId: query.examPeriodId });
  const byDetail = groupDutiesByDetail(ctx.duties);
  return details.map((detail) => {
    const required = resolveRequiredCount(detail, ctx.settings, ctx.requirements);
    const assignedCount = (byDetail.get(detail.id) || []).length;
    return {
      detailId: detail.id,
      examScheduleId: detail.examScheduleId,
      examPeriodId: detail.examPeriodId,
      examTitle: detail.examTitle,
      examType: detail.examType,
      examDate: detail.examDate,
      startTime: detail.startTime,
      endTime: detail.endTime,
      roomId: detail.roomId,
      requiredCount: required,
      assignedCount,
      missing: Math.max(0, required - assignedCount),
    };
  });
}

async function listEligibleInvigilators(detailId, actor) {
  const runner = database.getPool();
  const detail = await loadDetail(runner, detailId);
  assertDetailAssignable(detail);
  assertDepartmentScope(actor, detail.departmentId);
  const ctx = await buildContext(runner, { examPeriodId: detail.examPeriodId, detailIds: [detail.id] });
  return ctx.invigilators
    .map((invigilator) => {
      const evaluation = evaluateAssignment(detail, invigilator, ctx, {});
      return {
        invigilatorId: invigilator.id,
        userId: invigilator.userId,
        staffIdentifier: invigilator.staffIdentifier,
        eligible: evaluation.ok,
        reasons: evaluation.reasons,
      };
    })
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.invigilatorId - b.invigilatorId);
}

module.exports = {
  EXAM_TYPES,
  DUTY_ROLES,
  PUBLISH_STATUSES,
  REASONS,
  getSettings,
  updateSettings,
  listRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  listDuties,
  getDuty,
  getRoster,
  assignDuty,
  reassignDuty,
  cancelDuty,
  autoAssign,
  workloadSummary,
  unfilledReport,
  conflictReport,
  publishRoster,
  unpublishRoster,
  listDetailOptions,
  listEligibleInvigilators,
  // exported for tests / reuse
  _internals: { dutyWindow, windowsOverlap, dayOfWeek, evaluateAssignment, resolveRequiredCount, planAssignments, REASONS },
};
