'use strict';

/**
 * Building validation (Phase 4 — scheduling resources).
 *
 * Buildings own rooms, so a building code/name is unique and the physical
 * location is optional free text (`address`).
 */

const {
  normalizeString,
  toBoolean,
  parsePagination,
  parseSearch,
  parseSort,
  parseOrder,
  parseActiveFilter,
  parseOptionalString,
} = require('./shared');

const SORT_FIELDS = ['created_at', 'name', 'code', 'address', 'floors', 'is_active'];
const CODE_PATTERN = /^[A-Za-z0-9./_ -]{2,20}$/;

function buildBuildingValue(payload, errors, partial) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  if (!partial || has('code')) {
    const code = normalizeString(payload.code);
    if (!code) errors.push({ field: 'code', message: 'Building code is required.' });
    else if (!CODE_PATTERN.test(code)) {
      errors.push({ field: 'code', message: 'Code must be 2-20 characters (letters, numbers, dot, slash, space, _ or -).' });
    } else value.code = code.toUpperCase();
  }

  if (!partial || has('name')) {
    const name = normalizeString(payload.name);
    if (!name) errors.push({ field: 'name', message: 'Building name is required.' });
    else if (name.length < 2 || name.length > 150) errors.push({ field: 'name', message: 'Name must be 2-150 characters.' });
    else value.name = name;
  }

  if (has('address')) {
    value.address = parseOptionalString(payload.address, 255, 'address', errors);
  } else if (!partial) {
    value.address = null;
  }

  if (has('description')) {
    value.description = parseOptionalString(payload.description, 2000, 'description', errors);
  } else if (!partial) {
    value.description = null;
  }

  if (has('floors')) {
    const raw = payload.floors;
    if (raw === null || raw === '') {
      value.floors = partial ? null : 1;
    } else {
      const floors = Number(raw);
      if (!Number.isInteger(floors) || floors < 0 || floors > 100) {
        errors.push({ field: 'floors', message: 'floors must be a whole number between 0 and 100.' });
      } else value.floors = floors;
    }
  } else if (!partial) {
    value.floors = 1;
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

function validateBuildingListQuery(input = {}) {
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
    },
    errors,
  };
}

function validateCreateBuilding(payload = {}) {
  const errors = [];
  return { value: buildBuildingValue(payload, errors, false), errors };
}

function validateUpdateBuilding(payload = {}) {
  const errors = [];
  const value = buildBuildingValue(payload, errors, true);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

module.exports = {
  SORT_FIELDS,
  validateBuildingListQuery,
  validateCreateBuilding,
  validateUpdateBuilding,
};
