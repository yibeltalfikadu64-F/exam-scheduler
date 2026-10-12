'use strict';

/**
 * Invigilation validation (Phase 6): settings, requirement overrides, duty
 * listing/assignment, auto-assignment, roster publishing and reports.
 */

const { normalizeString, toBoolean, parsePagination, parseIdFilter, parseDateString, parseOptionalString } = require('./shared');

const EXAM_TYPES = ['midterm', 'final', 'supplementary', 'quiz', 'practical', 'other'];
const DUTY_ROLES = ['lead', 'invigilator'];
const DUTY_STATUSES = ['assigned', 'confirmed', 'declined', 'cancelled', 'completed'];
const PUBLISH_STATUSES = ['draft', 'published'];

function readPositiveInt(value, field, errors, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) errors.push({ field, message: `${field} is required.` });
    return undefined;
  }
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    errors.push({ field, message: `${field} must be a positive integer.` });
    return undefined;
  }
  return id;
}

function readOptionalInt(value, field, errors, { min, max }) {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    errors.push({ field, message: `${field} must be an integer between ${min} and ${max}.` });
    return undefined;
  }
  return num;
}

function readDate(value, field, errors) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = parseDateString(value);
  if (!parsed) errors.push({ field, message: `${field} must be a valid date (YYYY-MM-DD).` });
  return parsed || undefined;
}

function readEnum(value, field, errors, allowed, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) errors.push({ field, message: `${field} is required.` });
    return undefined;
  }
  const text = normalizeString(value);
  if (!allowed.includes(text)) {
    errors.push({ field, message: `${field} must be one of: ${allowed.join(', ')}.` });
    return undefined;
  }
  return text;
}

function readIdArray(value, field, errors, { max = 500 } = {}) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    errors.push({ field, message: `${field} must be an array of ids.` });
    return undefined;
  }
  if (value.length > max) {
    errors.push({ field, message: `${field} may not exceed ${max} ids.` });
    return undefined;
  }
  const ids = [];
  value.forEach((item, index) => {
    const id = Number(item);
    if (!Number.isInteger(id) || id <= 0) errors.push({ field: `${field}[${index}]`, message: 'Each id must be a positive integer.' });
    else ids.push(id);
  });
  return ids;
}

function validateSettings(payload = {}) {
  const errors = [];
  const value = {};
  if (payload.defaultRequiredInvigilators !== undefined) value.defaultRequiredInvigilators = readOptionalInt(payload.defaultRequiredInvigilators, 'defaultRequiredInvigilators', errors, { min: 1, max: 50 });
  if (payload.defaultMaxDutiesPerDay !== undefined) value.defaultMaxDutiesPerDay = readOptionalInt(payload.defaultMaxDutiesPerDay, 'defaultMaxDutiesPerDay', errors, { min: 0, max: 50 });
  if (payload.defaultMaxDutiesPerPeriod !== undefined) value.defaultMaxDutiesPerPeriod = readOptionalInt(payload.defaultMaxDutiesPerPeriod, 'defaultMaxDutiesPerPeriod', errors, { min: 0, max: 500 });
  if (payload.preparationMinutes !== undefined) value.preparationMinutes = readOptionalInt(payload.preparationMinutes, 'preparationMinutes', errors, { min: 0, max: 240 });
  if (payload.handoverMinutes !== undefined) value.handoverMinutes = readOptionalInt(payload.handoverMinutes, 'handoverMinutes', errors, { min: 0, max: 240 });
  if (payload.preventOwnCourse !== undefined) {
    const bool = toBoolean(payload.preventOwnCourse);
    if (bool === undefined) errors.push({ field: 'preventOwnCourse', message: 'preventOwnCourse must be a boolean.' });
    else value.preventOwnCourse = bool;
  }
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No settings fields were provided.' });
  }
  return { value, errors };
}

function validateCreateRequirement(payload = {}) {
  const errors = [];
  const scope = readEnum(payload.scope, 'scope', errors, ['room', 'exam_type'], { required: true });
  const value = {
    scope,
    requiredCount: readOptionalInt(payload.requiredCount, 'requiredCount', errors, { min: 1, max: 50 }),
    note: parseOptionalString(payload.note, 200, 'note', errors),
  };
  if (value.requiredCount === undefined) errors.push({ field: 'requiredCount', message: 'requiredCount is required.' });
  if (scope === 'room') {
    value.roomId = readPositiveInt(payload.roomId, 'roomId', errors);
  } else if (scope === 'exam_type') {
    value.examType = readEnum(payload.examType, 'examType', errors, EXAM_TYPES, { required: true });
  } else {
    if (payload.roomId !== undefined) value.roomId = readPositiveInt(payload.roomId, 'roomId', errors, { required: false });
    if (payload.examType !== undefined) value.examType = readEnum(payload.examType, 'examType', errors, EXAM_TYPES);
  }
  if (payload.isActive !== undefined) {
    const bool = toBoolean(payload.isActive);
    if (bool === undefined) errors.push({ field: 'isActive', message: 'isActive must be a boolean.' });
    else value.isActive = bool;
  }
  return { value, errors };
}

function validateUpdateRequirement(payload = {}) {
  const errors = [];
  const value = {};
  if (payload.requiredCount !== undefined) value.requiredCount = readOptionalInt(payload.requiredCount, 'requiredCount', errors, { min: 1, max: 50 });
  if (payload.isActive !== undefined) {
    const bool = toBoolean(payload.isActive);
    if (bool === undefined) errors.push({ field: 'isActive', message: 'isActive must be a boolean.' });
    else value.isActive = bool;
  }
  if (payload.note !== undefined) value.note = payload.note === null ? null : parseOptionalString(payload.note, 200, 'note', errors);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

function validateDutyListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);
  return {
    value: {
      page,
      limit,
      examPeriodId: parseIdFilter(input, errors, 'examPeriodId'),
      scheduleId: parseIdFilter(input, errors, 'scheduleId'),
      detailId: parseIdFilter(input, errors, 'detailId'),
      invigilatorId: parseIdFilter(input, errors, 'invigilatorId'),
      userId: parseIdFilter(input, errors, 'userId'),
      date: readDate(input.date, 'date', errors) || null,
      dateFrom: readDate(input.dateFrom, 'dateFrom', errors) || null,
      dateTo: readDate(input.dateTo, 'dateTo', errors) || null,
      status: readEnum(input.status, 'status', errors, DUTY_STATUSES) || null,
      publishStatus: readEnum(input.publishStatus, 'publishStatus', errors, PUBLISH_STATUSES) || null,
      role: readEnum(input.role, 'role', errors, DUTY_ROLES) || null,
    },
    errors,
  };
}

function validateAssignDuty(payload = {}) {
  const errors = [];
  const value = {
    examScheduleDetailId: readPositiveInt(payload.examScheduleDetailId, 'examScheduleDetailId', errors),
    invigilatorId: readPositiveInt(payload.invigilatorId, 'invigilatorId', errors),
    role: readEnum(payload.role, 'role', errors, DUTY_ROLES) || 'invigilator',
    notes: parseOptionalString(payload.notes, 500, 'notes', errors),
  };
  if (payload.publish !== undefined) {
    const bool = toBoolean(payload.publish);
    if (bool === undefined) errors.push({ field: 'publish', message: 'publish must be a boolean.' });
    else value.publish = bool;
  }
  return { value, errors };
}

function validateReassignDuty(payload = {}) {
  const errors = [];
  const value = {
    invigilatorId: readPositiveInt(payload.invigilatorId, 'invigilatorId', errors),
    role: readEnum(payload.role, 'role', errors, DUTY_ROLES),
    notes: parseOptionalString(payload.notes, 500, 'notes', errors),
  };
  return { value, errors };
}

function validateAutoAssign(payload = {}) {
  const errors = [];
  const value = {
    examPeriodId: parseIdFilter(payload, errors, 'examPeriodId'),
    scheduleId: parseIdFilter(payload, errors, 'scheduleId'),
    detailId: parseIdFilter(payload, errors, 'detailId'),
    dateFrom: readDate(payload.dateFrom, 'dateFrom', errors) || null,
    dateTo: readDate(payload.dateTo, 'dateTo', errors) || null,
    invigilatorIds: readIdArray(payload.invigilatorIds, 'invigilatorIds', errors),
  };
  if (payload.dryRun !== undefined) {
    const bool = toBoolean(payload.dryRun);
    if (bool === undefined) errors.push({ field: 'dryRun', message: 'dryRun must be a boolean.' });
    else value.dryRun = bool;
  } else {
    value.dryRun = true;
  }
  const hasScope = value.examPeriodId || value.scheduleId || value.detailId || value.dateFrom || value.dateTo;
  if (!hasScope && errors.length === 0) {
    errors.push({ field: 'scope', message: 'Provide an examPeriodId, scheduleId, detailId or date range.' });
  }
  return { value, errors };
}

function validateRosterQuery(input = {}) {
  const errors = [];
  const value = validateDutyListQuery(input).value;
  if (!value.date && !value.dateFrom && !value.dateTo && !value.examPeriodId && !value.scheduleId) {
    // Rosters default to a single day when nothing else is provided; the service
    // simply returns every matching duty, which is acceptable.
    value.date = null;
  }
  return { value, errors };
}

function validateWorkloadQuery(input = {}) {
  const errors = [];
  return {
    value: {
      examPeriodId: parseIdFilter(input, errors, 'examPeriodId'),
      departmentId: parseIdFilter(input, errors, 'departmentId'),
      dateFrom: readDate(input.dateFrom, 'dateFrom', errors) || null,
      dateTo: readDate(input.dateTo, 'dateTo', errors) || null,
    },
    errors,
  };
}

function validateReportQuery(input = {}) {
  const errors = [];
  return {
    value: {
      examPeriodId: parseIdFilter(input, errors, 'examPeriodId'),
      scheduleId: parseIdFilter(input, errors, 'scheduleId'),
      dateFrom: readDate(input.dateFrom, 'dateFrom', errors) || null,
      dateTo: readDate(input.dateTo, 'dateTo', errors) || null,
    },
    errors,
  };
}

function validatePublishRoster(payload = {}) {
  const errors = [];
  const value = {
    dutyIds: readIdArray(payload.dutyIds, 'dutyIds', errors),
    examPeriodId: parseIdFilter(payload, errors, 'examPeriodId'),
    scheduleId: parseIdFilter(payload, errors, 'scheduleId'),
    date: readDate(payload.date, 'date', errors) || null,
    dateFrom: readDate(payload.dateFrom, 'dateFrom', errors) || null,
    dateTo: readDate(payload.dateTo, 'dateTo', errors) || null,
  };
  const hasScope = (value.dutyIds && value.dutyIds.length) || value.examPeriodId || value.scheduleId || value.date || value.dateFrom || value.dateTo;
  if (!hasScope && errors.length === 0) {
    errors.push({ field: 'scope', message: 'Provide dutyIds, an examPeriodId, a scheduleId or a date range to publish.' });
  }
  return { value, errors };
}

function validateUnpublishRoster(payload = {}) {
  const errors = [];
  const value = {
    dutyIds: readIdArray(payload.dutyIds, 'dutyIds', errors),
    examPeriodId: parseIdFilter(payload, errors, 'examPeriodId'),
    scheduleId: parseIdFilter(payload, errors, 'scheduleId'),
  };
  const hasScope = (value.dutyIds && value.dutyIds.length) || value.examPeriodId || value.scheduleId;
  if (!hasScope && errors.length === 0) {
    errors.push({ field: 'scope', message: 'Provide dutyIds, an examPeriodId or a scheduleId to unpublish.' });
  }
  return { value, errors };
}

module.exports = {
  EXAM_TYPES,
  DUTY_ROLES,
  DUTY_STATUSES,
  PUBLISH_STATUSES,
  validateSettings,
  validateCreateRequirement,
  validateUpdateRequirement,
  validateDutyListQuery,
  validateAssignDuty,
  validateReassignDuty,
  validateAutoAssign,
  validateRosterQuery,
  validateWorkloadQuery,
  validateReportQuery,
  validatePublishRoster,
  validateUnpublishRoster,
};
