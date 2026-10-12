'use strict';

/**
 * Small, dependency-free helpers shared by the Phase 3 feature validators.
 *
 * Every validator returns `{ value, errors }` so the existing `validate()`
 * middleware can apply it (to bodies or query strings) unchanged.
 */

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return undefined;
}

/** page/limit with sane bounds. */
function parsePagination(input, errors, { defaultLimit = 10, maxLimit = 100 } = {}) {
  let page = Number(input.page);
  if (input.page === undefined || input.page === '') page = 1;
  if (!Number.isInteger(page) || page < 1) {
    errors.push({ field: 'page', message: 'page must be a positive integer.' });
    page = 1;
  }

  let limit = Number(input.limit);
  if (input.limit === undefined || input.limit === '') limit = defaultLimit;
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    errors.push({ field: 'limit', message: `limit must be an integer between 1 and ${maxLimit}.` });
    limit = defaultLimit;
  }

  return { page, limit };
}

function parseSearch(input, errors, max = 100) {
  const search = normalizeString(input.search);
  if (search.length > max) {
    errors.push({ field: 'search', message: `search must be at most ${max} characters.` });
  }
  return search;
}

function parseSort(input, errors, sortFields, defaultSort) {
  const sort = normalizeString(input.sort) || defaultSort;
  if (!sortFields.includes(sort)) {
    errors.push({ field: 'sort', message: `sort must be one of: ${sortFields.join(', ')}.` });
    return defaultSort;
  }
  return sort;
}

function parseOrder(input, errors, defaultOrder = 'desc') {
  const order = (normalizeString(input.order) || defaultOrder).toLowerCase();
  if (order !== 'asc' && order !== 'desc') {
    errors.push({ field: 'order', message: 'order must be either asc or desc.' });
    return defaultOrder;
  }
  return order;
}

/**
 * Accepts `status=all|active|inactive` (or `isActive=true|false`).
 * Returns a boolean filter, or null for "no filter".
 */
function parseActiveFilter(input, errors, field = 'status') {
  const raw = input.status !== undefined ? input.status : input.isActive;
  if (raw === undefined || raw === null || raw === '' || raw === 'all') return null;

  const bool = toBoolean(raw);
  if (bool !== undefined) return bool;

  const text = normalizeString(raw).toLowerCase();
  if (text === 'active') return true;
  if (text === 'inactive') return false;

  errors.push({ field, message: 'status must be one of: all, active, inactive.' });
  return null;
}

/** Positive-integer filter, or null when absent. */
function parseIdFilter(input, errors, field) {
  const raw = input[field];
  if (raw === undefined || raw === null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    errors.push({ field, message: `${field} must be a positive integer.` });
    return null;
  }
  return value;
}

/** Trimmed optional string (null when empty), with a max length. */
function parseOptionalString(value, max, field, errors) {
  if (value === undefined || value === null) return null;
  const text = normalizeString(value);
  if (!text) return null;
  if (text.length > max) {
    errors.push({ field, message: `${field} must be at most ${max} characters.` });
    return null;
  }
  return text;
}

/**
 * Validates a plain `YYYY-MM-DD` date string and returns it normalized, or
 * null when the value is absent/invalid. Calendar-agnostic: only the on-the-wire
 * format is enforced.
 */
function parseDateString(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== text) return null;
  return text;
}

/**
 * Validates a clock time and normalizes it to `HH:MM:SS`. Accepts `HH:MM` or
 * `HH:MM:SS`. Calendar-agnostic: only the on-the-wire format is enforced.
 * Returns null for empty/invalid input.
 */
function parseTimeString(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Converts a `HH:MM[:SS]` string (or `HH:MM:SS` from mysql2) to minutes past
 * midnight. Returns null for an empty value and NaN for an unparseable one.
 */
function timeToMinutes(value) {
  if (value === null || value === undefined || value === '') return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(value));
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]) + (match[3] ? Number(match[3]) : 0);
}

/**
 * Normalizes a DATE value (JS `Date` from mysql2, or a string) to a plain
 * `YYYY-MM-DD` string using local calendar components, so date-only values do
 * not shift across timezones. Returns null for empty/invalid input.
 */
function toDateString(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
}

/** Standard pagination envelope. */
function paginate({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}

/** Body validator for `PATCH .../status` → { isActive }. */
function validateStatusToggle(payload = {}) {
  const errors = [];
  const isActive = toBoolean(payload.isActive);
  if (isActive === undefined) {
    errors.push({ field: 'isActive', message: 'isActive must be a boolean (true or false).' });
  }
  return { value: { isActive }, errors };
}

module.exports = {
  normalizeString,
  toBoolean,
  parsePagination,
  parseSearch,
  parseSort,
  parseOrder,
  parseActiveFilter,
  parseIdFilter,
  parseOptionalString,
  parseDateString,
  parseTimeString,
  timeToMinutes,
  toDateString,
  paginate,
  validateStatusToggle,
};
