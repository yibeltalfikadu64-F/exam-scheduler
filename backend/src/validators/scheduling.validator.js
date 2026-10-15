'use strict';

/**
 * Scheduling validation (Phase 5).
 *
 * Covers the generation preview, draft saving, manual assignment/reschedule and
 * schedule listing. Dates are `YYYY-MM-DD`; ids are positive integers.
 */

const {
  normalizeString,
  parsePagination,
  parseSearch,
  parseIdFilter,
  parseDateString,
  parseOptionalString,
} = require('./shared');

const SCHEDULE_STATUSES = ['draft', 'generated', 'reviewed', 'published', 'cancelled', 'archived'];

function readPositiveInt(value, field, errors, { required = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) errors.push({ field, message: `${field} is required.` });
    return undefined;
  }
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    errors.push({ field, message: `${field} must be a positive integer.` });
    return undefined;
  }
  return id;
}

function readDate(value, field, errors) {
  const parsed = parseDateString(value);
  if (!parsed) errors.push({ field, message: `${field} must be a valid date (YYYY-MM-DD).` });
  return parsed;
}

function validateScheduleListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);
  let status = null;
  if (input.status !== undefined && input.status !== '' && input.status !== 'all') {
    const text = normalizeString(input.status).toLowerCase();
    if (!SCHEDULE_STATUSES.includes(text)) {
      errors.push({ field: 'status', message: `status must be one of: ${SCHEDULE_STATUSES.join(', ')}.` });
    } else status = text;
  }
  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      examPeriodId: parseIdFilter(input, errors, 'examPeriodId'),
      status,
    },
    errors,
  };
}

function validatePreview(payload = {}) {
  const errors = [];

  const examPeriodId = readPositiveInt(
    payload.examPeriodId,
    'examPeriodId',
    errors
  );

  const expectedCandidates = {};
  const supplied = payload.expectedCandidates;

  if (supplied !== undefined && supplied !== null) {
    if (
      typeof supplied !== 'object' ||
      Array.isArray(supplied)
    ) {
      errors.push({
        field: 'expectedCandidates',
        message: 'expectedCandidates must be an object.',
      });
    } else {
      for (const [rawExamId, rawCount] of Object.entries(supplied)) {
        const examId = Number(rawExamId);
        const count = Number(rawCount);

        if (
          !/^[1-9]\d*$/.test(rawExamId) ||
          !Number.isSafeInteger(examId)
        ) {
          errors.push({
            field: `expectedCandidates.${rawExamId}`,
            message: 'Exam ID must be a positive integer.',
          });
          continue;
        }

        if (
          rawCount === '' ||
          rawCount === null ||
          rawCount === undefined ||
          !Number.isSafeInteger(count) ||
          count <= 0 ||
          count > 100000
        ) {
          errors.push({
            field: `expectedCandidates.${rawExamId}`,
            message: 'Candidate count must be a whole number from 1 to 100000.',
          });
          continue;
        }

        expectedCandidates[String(examId)] = count;
      }
    }
  }

  return {
    value: { examPeriodId, expectedCandidates },
    errors,
  };
}

function validateSaveDraft(payload = {}) {
  const errors = [];
  const value = {
    examPeriodId: readPositiveInt(payload.examPeriodId, 'examPeriodId', errors),
    scheduleId: readPositiveInt(payload.scheduleId, 'scheduleId', errors, { required: false }),
    name: parseOptionalString(payload.name, 150, 'name', errors),
    notes: parseOptionalString(payload.notes, 2000, 'notes', errors),
    allocations: [],
  };

  if (!Array.isArray(payload.allocations)) {
    errors.push({ field: 'allocations', message: 'allocations must be an array.' });
    return { value, errors };
  }
  if (payload.allocations.length > 2000) {
    errors.push({ field: 'allocations', message: 'allocations may not exceed 2000 entries.' });
    return { value, errors };
  }

  payload.allocations.forEach((allocation, index) => {
    const entry = {};
    entry.examId = readPositiveInt(allocation.examId, `allocations[${index}].examId`, errors);
    entry.roomId = readPositiveInt(allocation.roomId, `allocations[${index}].roomId`, errors);
    entry.timeSlotId = readPositiveInt(allocation.timeSlotId, `allocations[${index}].timeSlotId`, errors);
    entry.examDate = readDate(allocation.examDate, `allocations[${index}].examDate`, errors);
    entry.notes = parseOptionalString(allocation.notes, 500, `allocations[${index}].notes`, errors);
    value.allocations.push(entry);
  });

  return { value, errors };
}

function validateManualAssignment(payload = {}) {
  const errors = [];
  const value = {
    examId: readPositiveInt(payload.examId, 'examId', errors),
    roomId: readPositiveInt(payload.roomId, 'roomId', errors),
    timeSlotId: readPositiveInt(payload.timeSlotId, 'timeSlotId', errors),
    examDate: readDate(payload.examDate, 'examDate', errors),
    notes: parseOptionalString(payload.notes, 500, 'notes', errors),
  };
  return { value, errors };
}

function validateReschedule(payload = {}) {
  const errors = [];
  const value = {};
  let hasChange = false;
  if (payload.roomId !== undefined) {
    value.roomId = readPositiveInt(payload.roomId, 'roomId', errors);
    hasChange = true;
  }
  if (payload.timeSlotId !== undefined) {
    value.timeSlotId = readPositiveInt(payload.timeSlotId, 'timeSlotId', errors);
    hasChange = true;
  }
  if (payload.examDate !== undefined) {
    value.examDate = readDate(payload.examDate, 'examDate', errors);
    hasChange = true;
  }
  value.notes = parseOptionalString(payload.notes, 500, 'notes', errors);

  if (!hasChange && errors.length === 0) {
    errors.push({ field: 'body', message: 'Provide a roomId, timeSlotId or examDate to reschedule.' });
  }
  return { value, errors };
}

module.exports = {
  SCHEDULE_STATUSES,
  validateScheduleListQuery,
  validatePreview,
  validateSaveDraft,
  validateManualAssignment,
  validateReschedule,
};