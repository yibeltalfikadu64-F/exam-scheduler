'use strict';

/**
 * Program input validation (Phase 3, module 2).
 * Reuses the existing `programs` table: department_id, code, name, degree_type,
 * duration_years, description, is_active.
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

const DEGREE_TYPES = ['bachelor', 'master', 'phd', 'diploma', 'certificate'];
const SORT_FIELDS = ['created_at', 'name', 'code', 'degree_type', 'duration_years', 'is_active'];
const CODE_PATTERN = /^[A-Za-z0-9._-]{2,20}$/;

/** GET /programs query string. */
function validateProgramListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);

  let degreeType = normalizeString(input.degreeType) || null;
  if (degreeType && !DEGREE_TYPES.includes(degreeType)) {
    errors.push({ field: 'degreeType', message: `degreeType must be one of: ${DEGREE_TYPES.join(', ')}.` });
    degreeType = null;
  }

  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      sort: parseSort(input, errors, SORT_FIELDS, 'name'),
      order: parseOrder(input, errors, 'asc'),
      isActive: parseActiveFilter(input, errors),
      departmentId: parseIdFilter(input, errors, 'departmentId'),
      degreeType,
    },
    errors,
  };
}

function buildProgramValue(payload, errors, partial) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  if (!partial || has('departmentId')) {
    const raw = payload.departmentId;
    if (raw === undefined || raw === null || raw === '') {
      errors.push({ field: 'departmentId', message: 'Department is required.' });
    } else {
      const id = Number(raw);
      if (!Number.isInteger(id) || id <= 0) errors.push({ field: 'departmentId', message: 'Department is invalid.' });
      else value.departmentId = id;
    }
  }

  if (!partial || has('code')) {
    const code = normalizeString(payload.code).toUpperCase();
    if (!code) errors.push({ field: 'code', message: 'Program code is required.' });
    else if (!CODE_PATTERN.test(code)) errors.push({ field: 'code', message: 'Code must be 2-20 characters (letters, numbers, . _ -).' });
    else value.code = code;
  }

  if (!partial || has('name')) {
    const name = normalizeString(payload.name);
    if (!name) errors.push({ field: 'name', message: 'Program name is required.' });
    else if (name.length < 2 || name.length > 150) errors.push({ field: 'name', message: 'Name must be 2-150 characters.' });
    else value.name = name;
  }

  if (!partial || has('degreeType')) {
    const degreeType = normalizeString(payload.degreeType);
    if (!degreeType) {
      if (!partial) value.degreeType = 'bachelor';
      else errors.push({ field: 'degreeType', message: 'degreeType cannot be empty.' });
    } else if (!DEGREE_TYPES.includes(degreeType)) {
      errors.push({ field: 'degreeType', message: `degreeType must be one of: ${DEGREE_TYPES.join(', ')}.` });
    } else {
      value.degreeType = degreeType;
    }
  }

  if (!partial || has('durationYears')) {
    const raw = payload.durationYears;
    if (raw === undefined || raw === null || raw === '') {
      if (!partial) value.durationYears = 4;
    } else {
      const years = Number(raw);
      if (!Number.isInteger(years) || years < 1 || years > 10) {
        errors.push({ field: 'durationYears', message: 'durationYears must be a whole number between 1 and 10.' });
      } else {
        value.durationYears = years;
      }
    }
  }

  if (has('description')) value.description = parseOptionalString(payload.description, 2000, 'description', errors);
  else if (!partial) value.description = null;

  if (has('isActive')) {
    const isActive = toBoolean(payload.isActive);
    if (isActive === undefined) errors.push({ field: 'isActive', message: 'isActive must be a boolean.' });
    else value.isActive = isActive;
  } else if (!partial) {
    value.isActive = true;
  }

  return value;
}

function validateCreateProgram(payload = {}) {
  const errors = [];
  return { value: buildProgramValue(payload, errors, false), errors };
}

function validateUpdateProgram(payload = {}) {
  const errors = [];
  const value = buildProgramValue(payload, errors, true);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

module.exports = {
  DEGREE_TYPES,
  SORT_FIELDS,
  validateProgramListQuery,
  validateCreateProgram,
  validateUpdateProgram,
};
