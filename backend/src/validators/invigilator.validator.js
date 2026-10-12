'use strict';

/**
 * Invigilator-management validation (Phase 6).
 *
 * Same `{ value, errors }` contract as the other feature validators so the
 * shared `validate()` middleware applies it to bodies and query strings.
 */

const { normalizeString, toBoolean, parsePagination, parseSearch, parseIdFilter, parseDateString, parseTimeString, parseOptionalString } = require('./shared');

const STAFF_ID_PATTERN = /^[A-Za-z0-9._/-]{2,40}$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;
const SORT_FIELDS = ['created_at', 'staff_identifier', 'full_name', 'is_active'];
const ORDER_VALUES = ['asc', 'desc'];

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
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    errors.push({ field, message: `${field} must be an integer between ${min} and ${max}.` });
    return null;
  }
  return num;
}

function validateStaffIdentifier(value, errors) {
  const staffIdentifier = normalizeString(value);
  if (!staffIdentifier) {
    errors.push({ field: 'staffIdentifier', message: 'staffIdentifier is required.' });
    return null;
  }
  if (!STAFF_ID_PATTERN.test(staffIdentifier)) {
    errors.push({ field: 'staffIdentifier', message: 'staffIdentifier must be 2-40 characters (letters, numbers, . _ / -).' });
    return null;
  }
  return staffIdentifier;
}

function validateListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);
  const sort = normalizeString(input.sort) || 'created_at';
  if (!SORT_FIELDS.includes(sort)) errors.push({ field: 'sort', message: `sort must be one of: ${SORT_FIELDS.join(', ')}.` });
  const order = (normalizeString(input.order) || 'desc').toLowerCase();
  if (!ORDER_VALUES.includes(order)) errors.push({ field: 'order', message: `order must be one of: ${ORDER_VALUES.join(', ')}.` });

  let isActive = null;
  if (input.status !== undefined || input.isActive !== undefined) {
    const raw = input.status !== undefined ? input.status : input.isActive;
    if (raw !== '' && raw !== 'all' && raw !== undefined) {
      const bool = toBoolean(raw);
      if (bool === undefined && raw !== 'active' && raw !== 'inactive') {
        errors.push({ field: 'status', message: 'status must be one of: all, active, inactive.' });
      } else {
        isActive = bool !== undefined ? bool : raw === 'active';
      }
    }
  }

  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      departmentId: parseIdFilter(input, errors, 'departmentId'),
      isActive,
      sort,
      order,
    },
    errors,
  };
}

function validateCreateInvigilator(payload = {}) {
  const errors = [];
  const value = {
    userId: readPositiveInt(payload.userId, 'userId', errors),
    staffIdentifier: validateStaffIdentifier(payload.staffIdentifier, errors),
    departmentId: readPositiveInt(payload.departmentId, 'departmentId', errors, { required: false }) || null,
    instructorId: readPositiveInt(payload.instructorId, 'instructorId', errors, { required: false }) || null,
    maxDutiesPerDay: readOptionalInt(payload.maxDutiesPerDay, 'maxDutiesPerDay', errors, { min: 0, max: 50 }),
    maxDutiesPerPeriod: readOptionalInt(payload.maxDutiesPerPeriod, 'maxDutiesPerPeriod', errors, { min: 0, max: 500 }),
  };

  const phone = normalizeString(payload.phone);
  if (phone && !PHONE_PATTERN.test(phone)) errors.push({ field: 'phone', message: 'Phone number is invalid.' });
  value.phone = phone || null;
  value.qualification = parseOptionalString(payload.qualification, 150, 'qualification', errors);
  value.notes = parseOptionalString(payload.notes, 2000, 'notes', errors);

  if (payload.isActive !== undefined) {
    const isActive = toBoolean(payload.isActive);
    if (isActive === undefined) errors.push({ field: 'isActive', message: 'isActive must be a boolean.' });
    else value.isActive = isActive;
  }

  return { value, errors };
}

function validateUpdateInvigilator(payload = {}) {
  const errors = [];
  const value = {};
  if (payload.staffIdentifier !== undefined) value.staffIdentifier = validateStaffIdentifier(payload.staffIdentifier, errors);
  if (payload.departmentId !== undefined) value.departmentId = payload.departmentId === null || payload.departmentId === '' ? null : readPositiveInt(payload.departmentId, 'departmentId', errors);
  if (payload.instructorId !== undefined) value.instructorId = payload.instructorId === null || payload.instructorId === '' ? null : readPositiveInt(payload.instructorId, 'instructorId', errors);
  if (payload.maxDutiesPerDay !== undefined) value.maxDutiesPerDay = readOptionalInt(payload.maxDutiesPerDay, 'maxDutiesPerDay', errors, { min: 0, max: 50 });
  if (payload.maxDutiesPerPeriod !== undefined) value.maxDutiesPerPeriod = readOptionalInt(payload.maxDutiesPerPeriod, 'maxDutiesPerPeriod', errors, { min: 0, max: 500 });
  if (payload.phone !== undefined) {
    const phone = normalizeString(payload.phone);
    if (phone && !PHONE_PATTERN.test(phone)) errors.push({ field: 'phone', message: 'Phone number is invalid.' });
    value.phone = phone || null;
  }
  if (payload.qualification !== undefined) value.qualification = parseOptionalString(payload.qualification, 150, 'qualification', errors);
  if (payload.notes !== undefined) value.notes = payload.notes === null ? null : parseOptionalString(payload.notes, 2000, 'notes', errors);
  if (payload.isActive !== undefined) {
    const isActive = toBoolean(payload.isActive);
    if (isActive === undefined) errors.push({ field: 'isActive', message: 'isActive must be a boolean.' });
    else value.isActive = isActive;
  }

  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

function validateAvailability(payload = {}) {
  const errors = [];
  const value = { windows: [] };
  if (!Array.isArray(payload.windows)) {
    errors.push({ field: 'windows', message: 'windows must be an array.' });
    return { value, errors };
  }
  if (payload.windows.length > 100) {
    errors.push({ field: 'windows', message: 'windows may not exceed 100 entries.' });
    return { value, errors };
  }
  payload.windows.forEach((window, index) => {
    const entry = {};
    const day = Number(window.dayOfWeek);
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      errors.push({ field: `windows[${index}].dayOfWeek`, message: 'dayOfWeek must be between 1 (Monday) and 7 (Sunday).' });
    }
    entry.dayOfWeek = day;
    entry.startTime = parseTimeString(window.startTime);
    if (!entry.startTime) errors.push({ field: `windows[${index}].startTime`, message: 'startTime must be a valid time (HH:MM).' });
    entry.endTime = parseTimeString(window.endTime);
    if (!entry.endTime) errors.push({ field: `windows[${index}].endTime`, message: 'endTime must be a valid time (HH:MM).' });
    if (entry.startTime && entry.endTime && entry.startTime >= entry.endTime) {
      errors.push({ field: `windows[${index}].endTime`, message: 'endTime must be after startTime.' });
    }
    entry.isAvailable = window.isAvailable === undefined ? true : toBoolean(window.isAvailable);
    if (entry.isAvailable === undefined) errors.push({ field: `windows[${index}].isAvailable`, message: 'isAvailable must be a boolean.' });
    if (window.effectiveFrom !== undefined && window.effectiveFrom !== null && window.effectiveFrom !== '') {
      entry.effectiveFrom = parseDateString(window.effectiveFrom);
      if (!entry.effectiveFrom) errors.push({ field: `windows[${index}].effectiveFrom`, message: 'effectiveFrom must be a valid date (YYYY-MM-DD).' });
    } else entry.effectiveFrom = null;
    if (window.effectiveTo !== undefined && window.effectiveTo !== null && window.effectiveTo !== '') {
      entry.effectiveTo = parseDateString(window.effectiveTo);
      if (!entry.effectiveTo) errors.push({ field: `windows[${index}].effectiveTo`, message: 'effectiveTo must be a valid date (YYYY-MM-DD).' });
    } else entry.effectiveTo = null;
    entry.note = parseOptionalString(window.note, 200, `windows[${index}].note`, errors);
    value.windows.push(entry);
  });
  return { value, errors };
}

module.exports = {
  SORT_FIELDS,
  validateListQuery,
  validateCreateInvigilator,
  validateUpdateInvigilator,
  validateAvailability,
};
