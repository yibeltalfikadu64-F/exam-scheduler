'use strict';

/**
 * Notification validation (Phase 6): the per-user inbox and the admin queue.
 */

const { normalizeString, toBoolean, parsePagination, parseIdFilter } = require('./shared');

const CHANNELS = ['in_app', 'email', 'sms', 'all'];
const STATUSES = ['pending', 'sent', 'failed', 'scheduled'];

function readEnum(value, field, errors, allowed) {
  if (value === undefined || value === null || value === '') return null;
  const text = normalizeString(value);
  if (!allowed.includes(text)) {
    errors.push({ field, message: `${field} must be one of: ${allowed.join(', ')}.` });
    return null;
  }
  return text;
}

/** GET /notifications — the authenticated user's own inbox. */
function validateInboxQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);
  let unread = false;
  if (input.unread !== undefined) {
    const bool = toBoolean(input.unread);
    if (bool === undefined) errors.push({ field: 'unread', message: 'unread must be a boolean.' });
    else unread = bool;
  }
  return {
    value: {
      page,
      limit,
      unread,
      channel: readEnum(input.channel, 'channel', errors, CHANNELS) || 'in_app',
      eventType: normalizeString(input.eventType) || null,
    },
    errors,
  };
}

/** GET /notifications/queue — the operational delivery queue (admin). */
function validateQueueQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);
  return {
    value: {
      page,
      limit,
      status: readEnum(input.status, 'status', errors, STATUSES),
      channel: readEnum(input.channel, 'channel', errors, ['in_app', 'email', 'sms']),
    },
    errors,
  };
}

/** POST /notifications/dispatch — optionally limited to specific ids. */
function validateDispatch(payload = {}) {
  const errors = [];
  const value = { ids: undefined };
  if (payload.ids !== undefined) {
    if (!Array.isArray(payload.ids)) {
      errors.push({ field: 'ids', message: 'ids must be an array of positive integers.' });
    } else if (payload.ids.length > 500) {
      errors.push({ field: 'ids', message: 'ids may not exceed 500 entries.' });
    } else {
      value.ids = [];
      payload.ids.forEach((item, index) => {
        const id = Number(item);
        if (!Number.isInteger(id) || id <= 0) errors.push({ field: `ids[${index}]`, message: 'Each id must be a positive integer.' });
        else value.ids.push(id);
      });
    }
  }
  return { value, errors };
}

module.exports = { CHANNELS, STATUSES, validateInboxQuery, validateQueueQuery, validateDispatch };
