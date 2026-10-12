'use strict';

/**
 * Room (and room-closure) validation (Phase 4 — scheduling resources).
 *
 * A room belongs to a building and its number/name is unique within that
 * building. Capacity is a strictly positive integer; the type is one of the
 * values supported by the `rooms.type` enum.
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
  parseDateString,
  parseTimeString,
} = require('./shared');

const SORT_FIELDS = ['created_at', 'name', 'capacity', 'floor', 'type', 'is_active'];
const TYPE_VALUES = ['lecture', 'lab', 'hall', 'seminar', 'other'];
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9./_ -]{0,49}$/;

/** Returns the normalized type, `undefined` when absent/empty, or `null` when invalid. */
function parseType(value, errors) {
  if (value === undefined || value === null || value === '') return undefined;
  const type = normalizeString(value).toLowerCase();
  if (!TYPE_VALUES.includes(type)) {
    errors.push({ field: 'type', message: `type must be one of: ${TYPE_VALUES.join(', ')}.` });
    return null;
  }
  return type;
}

function validateRoomListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);

  const minCapacity = parseIdFilter(input, errors, 'minCapacity');
  const maxCapacity = parseIdFilter(input, errors, 'maxCapacity');
  if (minCapacity !== null && maxCapacity !== null && minCapacity > maxCapacity) {
    errors.push({ field: 'minCapacity', message: 'minCapacity cannot be greater than maxCapacity.' });
  }

  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      sort: parseSort(input, errors, SORT_FIELDS, 'name'),
      order: parseOrder(input, errors, 'asc'),
      isActive: parseActiveFilter(input, errors),
      buildingId: parseIdFilter(input, errors, 'buildingId'),
      type: parseType(input.type, errors) || null,
      minCapacity,
      maxCapacity,
    },
    errors,
  };
}

function buildRoomValue(payload, errors, partial) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  if (!partial || has('buildingId')) {
    const buildingId = Number(payload.buildingId);
    if (!Number.isInteger(buildingId) || buildingId <= 0) {
      errors.push({ field: 'buildingId', message: 'A valid building is required.' });
    } else value.buildingId = buildingId;
  }

  if (!partial || has('name')) {
    const name = normalizeString(payload.name);
    if (!name) errors.push({ field: 'name', message: 'Room number/name is required.' });
    else if (!NAME_PATTERN.test(name)) {
      errors.push({ field: 'name', message: 'Room number must be 1-50 characters (letters, numbers, dot, slash, space, _ or -).' });
    } else value.name = name;
  }

  if (has('floor')) {
    const raw = payload.floor;
    if (raw === null || raw === '') value.floor = 0;
    else {
      const floor = Number(raw);
      if (!Number.isInteger(floor) || floor < -10 || floor > 100) {
        errors.push({ field: 'floor', message: 'floor must be a whole number between -10 and 100.' });
      } else value.floor = floor;
    }
  } else if (!partial) {
    value.floor = 0;
  }

  if (!partial || has('capacity')) {
    const raw = payload.capacity;
    const capacity = Number(raw);
    if (raw === undefined || raw === null || raw === '' || !Number.isInteger(capacity) || capacity <= 0 || capacity > 65535) {
      errors.push({ field: 'capacity', message: 'Capacity must be a positive whole number.' });
    } else value.capacity = capacity;
  }

  if (!partial || has('type')) {
    const type = parseType(payload.type, errors);
    if (type !== undefined && type !== null) value.type = type;
    else if (type === undefined && !partial) value.type = 'lecture';
  }

  if (has('equipment')) {
    value.equipment = parseOptionalString(payload.equipment, 255, 'equipment', errors);
  } else if (!partial) {
    value.equipment = null;
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

function validateCreateRoom(payload = {}) {
  const errors = [];
  return { value: buildRoomValue(payload, errors, false), errors };
}

function validateUpdateRoom(payload = {}) {
  const errors = [];
  const value = buildRoomValue(payload, errors, true);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

function readClosureTime(payload, key, errors) {
  if (payload[key] === undefined) return undefined;
  if (payload[key] === null || payload[key] === '') return null;
  const parsed = parseTimeString(payload[key]);
  if (!parsed) {
    errors.push({ field: key, message: `${key} must be a valid time (HH:MM or HH:MM:SS).` });
    return undefined;
  }
  return parsed;
}

function buildClosureValue(payload, errors, partial) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  const readDate = (key) => {
    if (payload[key] === undefined) return undefined;
    if (payload[key] === null || payload[key] === '') return null;
    const parsed = parseDateString(payload[key]);
    if (!parsed) errors.push({ field: key, message: `${key} must be a valid date (YYYY-MM-DD).` });
    return parsed;
  };

  const startDate = readDate('startDate');
  const endDate = readDate('endDate');
  if (!partial || has('startDate')) {
    if (!startDate) errors.push({ field: 'startDate', message: 'A closure start date is required.' });
    else value.startDate = startDate;
  }
  if (has('endDate')) {
    if (!endDate) errors.push({ field: 'endDate', message: 'A closure end date is required.' });
    else value.endDate = endDate;
  } else if (!partial) {
    value.endDate = startDate;
  }
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    errors.push({ field: 'endDate', message: 'The end date cannot be earlier than the start date.' });
  }

  const startTime = readClosureTime(payload, 'startTime', errors);
  const endTime = readClosureTime(payload, 'endTime', errors);
  if (startTime !== undefined) value.startTime = startTime;
  if (endTime !== undefined) value.endTime = endTime;
  if (!partial) {
    if (startTime === undefined) value.startTime = null;
    if (endTime === undefined) value.endTime = null;
  }

  const effectiveStart = startTime !== undefined ? startTime : value.startTime;
  const effectiveEnd = endTime !== undefined ? endTime : value.endTime;
  const bothPresent = effectiveStart && effectiveEnd;
  const onePresent = (effectiveStart && !effectiveEnd) || (!effectiveStart && effectiveEnd);
  if (!partial && onePresent) {
    errors.push({ field: 'endTime', message: 'Provide both a start and end time, or leave both empty for a full-day closure.' });
  }
  if (bothPresent && effectiveEnd <= effectiveStart) {
    errors.push({ field: 'endTime', message: 'The end time must be after the start time.' });
  }

  if (has('reason')) value.reason = parseOptionalString(payload.reason, 255, 'reason', errors);
  else if (!partial) value.reason = null;

  return value;
}

function validateCreateClosure(payload = {}) {
  const errors = [];
  return { value: buildClosureValue(payload, errors, false), errors };
}

function validateUpdateClosure(payload = {}) {
  const errors = [];
  const value = buildClosureValue(payload, errors, true);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

module.exports = {
  TYPE_VALUES,
  SORT_FIELDS,
  validateRoomListQuery,
  validateCreateRoom,
  validateUpdateRoom,
  validateCreateClosure,
  validateUpdateClosure,
};
