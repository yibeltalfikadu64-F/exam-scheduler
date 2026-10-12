'use strict';

/**
 * Time slot validation (Phase 4 — scheduling resources, completed for Phase 5).
 *
 * A time slot is a reusable time window (no fixed date) with a start < end.
 * Slots are calendar-agnostic: only the HH:MM(:SS) wire format is enforced.
 */

const {
  normalizeString,
  toBoolean,
  parsePagination,
  parseSearch,
  parseSort,
  parseOrder,
  parseActiveFilter,
  parseTimeString,
} = require('./shared');

const SORT_FIELDS = ['created_at', 'label', 'start_time', 'end_time', 'order_index', 'is_active'];

function buildTimeSlotValue(payload, errors, partial) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  if (!partial || has('label')) {
    const label = normalizeString(payload.label);
    if (!label) errors.push({ field: 'label', message: 'Label is required.' });
    else if (label.length > 50) errors.push({ field: 'label', message: 'Label must be at most 50 characters.' });
    else value.label = label;
  }

  if (!partial || has('startTime')) {
    const start = parseTimeString(payload.startTime);
    if (!start) errors.push({ field: 'startTime', message: 'A valid start time (HH:MM or HH:MM:SS) is required.' });
    else value.startTime = start;
  }

  if (!partial || has('endTime')) {
    const end = parseTimeString(payload.endTime);
    if (!end) errors.push({ field: 'endTime', message: 'A valid end time (HH:MM or HH:MM:SS) is required.' });
    else value.endTime = end;
  }

  const effectiveStart = value.startTime !== undefined ? value.startTime : payload.startTime;
  const effectiveEnd = value.endTime !== undefined ? value.endTime : payload.endTime;
  if (effectiveStart && effectiveEnd && effectiveEnd <= effectiveStart) {
    errors.push({ field: 'endTime', message: 'The end time must be after the start time.' });
  }

  if (has('orderIndex')) {
    const raw = payload.orderIndex;
    if (raw === null || raw === '') value.orderIndex = 0;
    else {
      const order = Number(raw);
      if (!Number.isInteger(order) || order < 0 || order > 60000) {
        errors.push({ field: 'orderIndex', message: 'orderIndex must be a whole number between 0 and 60000.' });
      } else value.orderIndex = order;
    }
  } else if (!partial) {
    value.orderIndex = 0;
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

function validateTimeSlotListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);
  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      sort: parseSort(input, errors, SORT_FIELDS, 'order_index'),
      order: parseOrder(input, errors, 'asc'),
      isActive: parseActiveFilter(input, errors),
    },
    errors,
  };
}

function validateCreateTimeSlot(payload = {}) {
  const errors = [];
  return { value: buildTimeSlotValue(payload, errors, false), errors };
}

function validateUpdateTimeSlot(payload = {}) {
  const errors = [];
  const value = buildTimeSlotValue(payload, errors, true);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

module.exports = {
  SORT_FIELDS,
  validateTimeSlotListQuery,
  validateCreateTimeSlot,
  validateUpdateTimeSlot,
};