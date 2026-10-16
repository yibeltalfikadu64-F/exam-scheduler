'use strict';

/**
 * Exam period validation (Phase 7).
 *
 * The `exam_periods` table stores DATE values (start_date/end_date) plus a
 * lifecycle `status` enum. Dates are calendar-agnostic plain `YYYY-MM-DD`.
 */

const {
  normalizeString,
  parsePagination,
  parseSearch,
  parseDateString,
} = require('./shared');

const STATUSES = ['draft', 'open', 'published', 'closed', 'archived'];

function parseStatus(value, errors, field = 'status') {
  const text = normalizeString(value);
  if (!text) return null;
  if (!STATUSES.includes(text)) {
    errors.push({ field, message: `status must be one of: ${STATUSES.join(', ')}.` });
    return null;
  }
  return text;
}

function buildValue(payload, errors, partial) {
  const value = {};

  if (!partial || payload.name !== undefined) {
    const name = normalizeString(payload.name);
    if (!name) errors.push({ field: 'name', message: 'name is required.' });
    else if (name.length > 150) errors.push({ field: 'name', message: 'name must be at most 150 characters.' });
    else value.name = name;
  }

  if (!partial || payload.term !== undefined) {
    const term = normalizeString(payload.term);
    if (!term) errors.push({ field: 'term', message: 'term is required.' });
    else if (term.length > 30) errors.push({ field: 'term', message: 'term must be at most 30 characters.' });
    else value.term = term;
  }

  let startDate = null;
  let endDate = null;

  if (!partial || payload.startDate !== undefined) {
    startDate = parseDateString(payload.startDate);
    if (!startDate) errors.push({ field: 'startDate', message: 'startDate must be a valid date (YYYY-MM-DD).' });
    else value.startDate = startDate;
  }

  if (!partial || payload.endDate !== undefined) {
    endDate = parseDateString(payload.endDate);
    if (!endDate) errors.push({ field: 'endDate', message: 'endDate must be a valid date (YYYY-MM-DD).' });
    else value.endDate = endDate;
  }

  if (startDate && endDate && endDate < startDate) {
    errors.push({ field: 'endDate', message: 'endDate must be on or after startDate.' });
  }

  if (!partial || payload.status !== undefined) {
    const status = parseStatus(payload.status, errors);
    if (status) value.status = status;
  }

  if (payload.description !== undefined) {
    const description = normalizeString(payload.description);
    if (description.length > 2000) errors.push({ field: 'description', message: 'description must be at most 2000 characters.' });
    else value.description = description || null;
  }

  return value;
}

function validateCreateExamPeriod(payload = {}) {
  const errors = [];
  return { value: buildValue(payload, errors, false), errors };
}

function validateUpdateExamPeriod(payload = {}) {
  const errors = [];
  const value = buildValue(payload, errors, true);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'Provide at least one field to update.' });
  }
  return { value, errors };
}

function validateExamPeriodStatus(payload = {}) {
  const errors = [];
  const status = parseStatus(payload.status, errors);
  if (!status) errors.push({ field: 'status', message: 'status is required.' });
  return { value: { status }, errors };
}

function validateExamPeriodListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);
  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      status: parseStatus(input.status, errors),
    },
    errors,
  };
}

module.exports = {
  STATUSES,
  validateCreateExamPeriod,
  validateUpdateExamPeriod,
  validateExamPeriodStatus,
  validateExamPeriodListQuery,
};
