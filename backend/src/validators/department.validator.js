'use strict';

/**
 * Department input validation (Phase 3).
 *
 * Field names follow the existing `departments` table:
 *   code, name, description, head_id (users.id), is_active
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

const SORT_FIELDS = ['created_at', 'name', 'code', 'is_active'];
const CODE_PATTERN = /^[A-Za-z0-9._-]{2,20}$/;

function validateCode(raw, errors) {
  const code = normalizeString(raw).toUpperCase();
  if (!code) {
    errors.push({ field: 'code', message: 'Department code is required.' });
    return null;
  }
  if (!CODE_PATTERN.test(code)) {
    errors.push({ field: 'code', message: 'Code must be 2-20 characters using letters, numbers, dot, underscore or hyphen.' });
    return null;
  }
  return code;
}

function validateName(raw, errors) {
  const name = normalizeString(raw);
  if (!name) {
    errors.push({ field: 'name', message: 'Department name is required.' });
    return null;
  }
  if (name.length < 2 || name.length > 150) {
    errors.push({ field: 'name', message: 'Name must be 2-150 characters.' });
    return null;
  }
  return name;
}

function validateHeadId(raw, errors) {
  if (raw === undefined || raw === null || raw === '') return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    errors.push({ field: 'headId', message: 'headId must be a positive integer or null.' });
    return null;
  }
  return id;
}

/** GET /departments query string. */
function validateDepartmentListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);
  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      sort: parseSort(input, errors, SORT_FIELDS, 'name'),
      order: parseOrder(input, errors, 'asc'),
      isActive: parseActiveFilter(input, errors),
      headId: parseIdFilter(input, errors, 'headId'),
    },
    errors,
  };
}

function buildDepartmentValue(payload, errors, partial) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  if (!partial || has('code')) value.code = validateCode(payload.code, errors);
  if (!partial || has('name')) value.name = validateName(payload.name, errors);

  if (has('description')) value.description = parseOptionalString(payload.description, 2000, 'description', errors);
  else if (!partial) value.description = null;

  if (has('headId')) value.headId = validateHeadId(payload.headId, errors);
  else if (!partial) value.headId = null;

  if (has('isActive')) {
    const isActive = toBoolean(payload.isActive);
    if (isActive === undefined) errors.push({ field: 'isActive', message: 'isActive must be a boolean.' });
    else value.isActive = isActive;
  } else if (!partial) {
    value.isActive = true;
  }

  return value;
}

/** POST /departments */
function validateCreateDepartment(payload = {}) {
  const errors = [];
  const value = buildDepartmentValue(payload, errors, false);
  return { value, errors };
}

/** PATCH /departments/:id — only provided fields are updated. */
function validateUpdateDepartment(payload = {}) {
  const errors = [];
  const value = buildDepartmentValue(payload, errors, true);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

module.exports = {
  SORT_FIELDS,
  validateDepartmentListQuery,
  validateCreateDepartment,
  validateUpdateDepartment,
};
