'use strict';

/**
 * Instructor validation (Phase 3, module 5).
 * Profile extension of `users` (user_id, department_id, title, expertise,
 * max_load_hours, is_active) plus the additive `staff_number`.
 */

const {
  normalizeString,
  toBoolean,
  parsePagination,
  parseSearch,
  parseSort,
  parseOrder,
  parseActiveFilter,
  parseIdFilter,
  parseOptionalString,
} = require('./shared');

const SORT_FIELDS = ['created_at', 'staff_number', 'max_load_hours', 'is_active'];
const STAFF_NUMBER_PATTERN = /^[A-Za-z0-9._/-]{2,30}$/;

function validateInstructorListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);
  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      sort: parseSort(input, errors, SORT_FIELDS, 'staff_number'),
      order: parseOrder(input, errors, 'asc'),
      isActive: parseActiveFilter(input, errors),
      departmentId: parseIdFilter(input, errors, 'departmentId'),
    },
    errors,
  };
}

function buildInstructorValue(payload, errors, partial) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  if (!partial || has('userId')) {
    const raw = payload.userId;
    if (raw === undefined || raw === null || raw === '') {
      errors.push({ field: 'userId', message: 'User account is required.' });
    } else {
      const id = Number(raw);
      if (!Number.isInteger(id) || id <= 0) errors.push({ field: 'userId', message: 'User account is invalid.' });
      else value.userId = id;
    }
  }

  if (has('staffNumber')) {
    const staffNumber = normalizeString(payload.staffNumber).toUpperCase();
    if (!staffNumber) value.staffNumber = null;
    else if (!STAFF_NUMBER_PATTERN.test(staffNumber)) errors.push({ field: 'staffNumber', message: 'Staff number must be 2-30 characters (letters, numbers, . / _ -).' });
    else value.staffNumber = staffNumber;
  } else if (!partial) {
    value.staffNumber = null;
  }

  if (has('departmentId')) {
    if (payload.departmentId === null || payload.departmentId === '') value.departmentId = null;
    else {
      const id = Number(payload.departmentId);
      if (!Number.isInteger(id) || id <= 0) errors.push({ field: 'departmentId', message: 'departmentId must be a positive integer or null.' });
      else value.departmentId = id;
    }
  } else if (!partial) {
    value.departmentId = null;
  }

  if (has('title')) value.title = parseOptionalString(payload.title, 120, 'title', errors);
  else if (!partial) value.title = null;

  if (has('expertise')) value.expertise = parseOptionalString(payload.expertise, 255, 'expertise', errors);
  else if (!partial) value.expertise = null;

  if (!partial || has('maxLoadHours')) {
    const raw = payload.maxLoadHours;
    if (raw === undefined || raw === null || raw === '') {
      if (!partial) value.maxLoadHours = 12;
    } else {
      const hours = Number(raw);
      if (!Number.isInteger(hours) || hours < 0 || hours > 40) errors.push({ field: 'maxLoadHours', message: 'maxLoadHours must be a whole number between 0 and 40.' });
      else value.maxLoadHours = hours;
    }
  }

  if (has('isActive')) {
    const isActive = toBoolean(payload.isActive);
    if (isActive === undefined) errors.push({ field: 'isActive', message: 'isActive must be a boolean.' });
    else value.isActive = isActive;
  } else if (!partial) {
    value.isActive = true;
  }

  return value;
}

function validateCreateInstructor(payload = {}) {
  const errors = [];
  return { value: buildInstructorValue(payload, errors, false), errors };
}

function validateUpdateInstructor(payload = {}) {
  const errors = [];
  const value = buildInstructorValue(payload, errors, true);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

module.exports = {
  SORT_FIELDS,
  validateInstructorListQuery,
  validateCreateInstructor,
  validateUpdateInstructor,
};
