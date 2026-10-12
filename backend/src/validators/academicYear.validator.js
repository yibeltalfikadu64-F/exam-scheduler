'use strict';

/**
 * Academic calendar validation (Phase 3, module 4):
 * academic years and their semesters.
 */

const {
  normalizeString,
  toBoolean,
  parsePagination,
  parseSearch,
  parseSort,
  parseOrder,
  parseActiveFilter,
  parseDateString,
} = require('./shared');

const YEAR_SORT_FIELDS = ['created_at', 'code', 'name', 'start_date', 'is_active'];
const SEMESTER_SORT_FIELDS = ['sequence', 'name', 'start_date', 'is_active'];
const YEAR_CODE_PATTERN = /^[A-Za-z0-9./_ -]{2,30}$/;

function readDate(payload, key, errors) {
  if (payload[key] === undefined) return undefined;
  if (payload[key] === null || payload[key] === '') return null;
  const parsed = parseDateString(payload[key]);
  if (!parsed) {
    errors.push({ field: key, message: `${key} must be a valid date in YYYY-MM-DD format.` });
    return undefined;
  }
  return parsed;
}

function validateAcademicYearListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);
  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      sort: parseSort(input, errors, YEAR_SORT_FIELDS, 'code'),
      order: parseOrder(input, errors, 'desc'),
      isActive: parseActiveFilter(input, errors),
    },
    errors,
  };
}

function buildYearValue(payload, errors, partial) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  if (!partial || has('code')) {
    const code = normalizeString(payload.code);
    if (!code) errors.push({ field: 'code', message: 'Academic year code is required.' });
    else if (!YEAR_CODE_PATTERN.test(code)) {
      errors.push({ field: 'code', message: 'Code must be 2-30 characters (letters, numbers, dot, slash, space, _ or -).' });
    } else value.code = code;
  }

  if (!partial || has('name')) {
    const name = normalizeString(payload.name);
    if (!name) errors.push({ field: 'name', message: 'Academic year name is required.' });
    else if (name.length < 2 || name.length > 100) errors.push({ field: 'name', message: 'Name must be 2-100 characters.' });
    else value.name = name;
  }

  const startDate = readDate(payload, 'startDate', errors);
  const endDate = readDate(payload, 'endDate', errors);
  if (startDate !== undefined) value.startDate = startDate;
  if (endDate !== undefined) value.endDate = endDate;
  if (!partial) {
    if (startDate === undefined) value.startDate = null;
    if (endDate === undefined) value.endDate = null;
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

function validateCreateAcademicYear(payload = {}) {
  const errors = [];
  return { value: buildYearValue(payload, errors, false), errors };
}

function validateUpdateAcademicYear(payload = {}) {
  const errors = [];
  const value = buildYearValue(payload, errors, true);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

function validateSemesterListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);
  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      sort: parseSort(input, errors, SEMESTER_SORT_FIELDS, 'sequence'),
      order: parseOrder(input, errors, 'asc'),
      isActive: parseActiveFilter(input, errors),
    },
    errors,
  };
}

function buildSemesterValue(payload, errors, partial) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  if (!partial || has('name')) {
    const name = normalizeString(payload.name);
    if (!name) errors.push({ field: 'name', message: 'Semester name is required.' });
    else if (name.length < 2 || name.length > 100) errors.push({ field: 'name', message: 'Name must be 2-100 characters.' });
    else value.name = name;
  }

  if (!partial || has('sequence')) {
    const raw = payload.sequence;
    if (raw === undefined || raw === null || raw === '') {
      if (!partial) value.sequence = 1;
    } else {
      const sequence = Number(raw);
      if (!Number.isInteger(sequence) || sequence < 1 || sequence > 10) {
        errors.push({ field: 'sequence', message: 'sequence must be a whole number between 1 and 10.' });
      } else value.sequence = sequence;
    }
  }

  const startDate = readDate(payload, 'startDate', errors);
  const endDate = readDate(payload, 'endDate', errors);
  if (startDate !== undefined) value.startDate = startDate;
  if (endDate !== undefined) value.endDate = endDate;
  if (!partial) {
    if (startDate === undefined) value.startDate = null;
    if (endDate === undefined) value.endDate = null;
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

function validateCreateSemester(payload = {}) {
  const errors = [];
  return { value: buildSemesterValue(payload, errors, false), errors };
}

function validateUpdateSemester(payload = {}) {
  const errors = [];
  const value = buildSemesterValue(payload, errors, true);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

module.exports = {
  YEAR_SORT_FIELDS,
  SEMESTER_SORT_FIELDS,
  validateAcademicYearListQuery,
  validateCreateAcademicYear,
  validateUpdateAcademicYear,
  validateSemesterListQuery,
  validateCreateSemester,
  validateUpdateSemester,
};
