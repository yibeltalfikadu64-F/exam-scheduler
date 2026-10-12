'use strict';

/**
 * Schedule constraint validation (Phase 5).
 *
 * `parameters` is a free-form JSON object (e.g. { "minutes": 30 });
 * `weight` goes from 0.00 to 100.00 and `type` is hard|soft.
 */

const {
  normalizeString,
  toBoolean,
  parsePagination,
  parseSearch,
  parseSort,
  parseOrder,
  parseOptionalString,
} = require('./shared');

const SORT_FIELDS = ['created_at', 'constraint_key', 'name', 'type', 'scope', 'weight', 'is_enabled'];
const TYPE_VALUES = ['hard', 'soft'];
const SCOPE_VALUES = ['global', 'department', 'program'];
const KEY_PATTERN = /^[a-z0-9_]{2,60}$/;

function validateConstraintListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);

  const type = normalizeString(input.type).toLowerCase();
  if (type && !TYPE_VALUES.includes(type)) {
    errors.push({ field: 'type', message: `type must be one of: ${TYPE_VALUES.join(', ')}.` });
  }

  const scope = normalizeString(input.scope).toLowerCase();
  if (scope && !SCOPE_VALUES.includes(scope)) {
    errors.push({ field: 'scope', message: `scope must be one of: ${SCOPE_VALUES.join(', ')}.` });
  }

  let isEnabled = null;
  if (input.isEnabled !== undefined && input.isEnabled !== '' && input.isEnabled !== 'all') {
    const bool = toBoolean(input.isEnabled);
    if (bool === undefined) errors.push({ field: 'isEnabled', message: 'isEnabled must be a boolean.' });
    else isEnabled = bool;
  }

  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      sort: parseSort(input, errors, SORT_FIELDS, 'constraint_key'),
      order: parseOrder(input, errors, 'asc'),
      type: type || null,
      scope: scope || null,
      isEnabled,
    },
    errors,
  };
}

function buildConstraintValue(payload, errors, partial) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  if (has('constraintKey')) {
    const key = normalizeString(payload.constraintKey);
    if (!KEY_PATTERN.test(key)) {
      errors.push({ field: 'constraintKey', message: 'constraintKey must be 2-60 lowercase letters, digits or underscores.' });
    } else value.constraintKey = key;
  }

  if (has('name')) {
    const name = normalizeString(payload.name);
    if (!name) errors.push({ field: 'name', message: 'Name is required.' });
    else if (name.length > 150) errors.push({ field: 'name', message: 'Name must be at most 150 characters.' });
    else value.name = name;
  }

  if (has('type')) {
    const type = normalizeString(payload.type).toLowerCase();
    if (!TYPE_VALUES.includes(type)) errors.push({ field: 'type', message: `type must be one of: ${TYPE_VALUES.join(', ')}.` });
    else value.type = type;
  }

  if (has('scope')) {
    const scope = normalizeString(payload.scope).toLowerCase();
    if (!SCOPE_VALUES.includes(scope)) errors.push({ field: 'scope', message: `scope must be one of: ${SCOPE_VALUES.join(', ')}.` });
    else value.scope = scope;
  }

  if (has('departmentId')) {
    if (payload.departmentId === null || payload.departmentId === '') value.departmentId = null;
    else {
      const id = Number(payload.departmentId);
      if (!Number.isInteger(id) || id <= 0) errors.push({ field: 'departmentId', message: 'departmentId must be a positive integer.' });
      else value.departmentId = id;
    }
  }

  if (has('description')) {
    value.description = parseOptionalString(payload.description, 2000, 'description', errors);
  }

  if (has('parameters')) {
    if (payload.parameters === null || payload.parameters === '') value.parameters = null;
    else if (typeof payload.parameters !== 'object' || Array.isArray(payload.parameters)) {
      errors.push({ field: 'parameters', message: 'parameters must be a JSON object.' });
    } else value.parameters = payload.parameters;
  }

  if (has('weight')) {
    const weight = Number(payload.weight);
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
      errors.push({ field: 'weight', message: 'weight must be a number between 0 and 100.' });
    } else value.weight = weight;
  }

  if (has('isEnabled')) {
    const isEnabled = toBoolean(payload.isEnabled);
    if (isEnabled === undefined) errors.push({ field: 'isEnabled', message: 'isEnabled must be a boolean.' });
    else value.isEnabled = isEnabled;
  }

  return value;
}

function validateUpdateConstraint(payload = {}) {
  const errors = [];
  const value = buildConstraintValue(payload, errors, true);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

module.exports = {
  SORT_FIELDS,
  validateConstraintListQuery,
  validateUpdateConstraint,
};