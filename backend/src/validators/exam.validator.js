
'use strict';

/**
 * Exam record validation.
 *
 * Section is optional at the API validation layer.
 * The database schema may still require a section.
 * Enrollment counts are calculated by the service.
 */

const {
  normalizeString,
  parsePagination,
  parseSearch,
  parseSort,
  parseOrder,
  parseActiveFilter,
  parseIdFilter,
  parseOptionalString,
} = require('./shared');

const SORT_FIELDS = [
  'created_at',
  'title',
  'exam_type',
  'status',
  'duration_minutes',
  'exam_date',
];

const EXAM_TYPE_VALUES = [
  'midterm',
  'final',
  'supplementary',
  'quiz',
  'practical',
  'other',
];

const STATUS_VALUES = [
  'draft',
  'scheduled',
  'published',
  'cancelled',
  'completed',
];

const ROOM_TYPE_VALUES = [
  'lecture',
  'lab',
  'hall',
  'seminar',
  'other',
];

const SCHEDULE_STATUS_VALUES = [
  'scheduled',
  'unscheduled',
  'all',
];

function parseEnum(
  value,
  values,
  field,
  errors,
  defaultValue,
  { optional = false } = {}
) {
  if (value === undefined || value === null || value === '') {
    return optional ? undefined : defaultValue;
  }

  const text = normalizeString(value).toLowerCase();

  if (!values.includes(text)) {
    errors.push({
      field,
      message: `${field} must be one of: ${values.join(', ')}.`,
    });

    return undefined;
  }

  return text;
}

function buildExamValue(payload, errors, partial) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  // Course is required when creating an exam.
  if (!partial || has('courseId')) {
    const courseId = Number(payload.courseId);

    if (!Number.isInteger(courseId) || courseId <= 0) {
      errors.push({
        field: 'courseId',
        message: 'A valid course is required.',
      });
    } else {
      value.courseId = courseId;
    }
  }

  // Section is optional in this validator.
  if (has('sectionId')) {
    if (payload.sectionId === null || payload.sectionId === '') {
      value.sectionId = null;
    } else {
      const sectionId = Number(payload.sectionId);

      if (!Number.isInteger(sectionId) || sectionId <= 0) {
        errors.push({
          field: 'sectionId',
          message: 'Section must be a positive integer when provided.',
        });
      } else {
        value.sectionId = sectionId;
      }
    }
  }

  const readId = (key) => {
    if (payload[key] === undefined) {
      return undefined;
    }

    if (payload[key] === null || payload[key] === '') {
      return null;
    }

    const parsed = Number(payload[key]);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      errors.push({
        field: key,
        message: `${key} must be a positive integer.`,
      });

      return undefined;
    }

    return parsed;
  };

  if (has('examPeriodId') || !partial) {
    value.examPeriodId = readId('examPeriodId');
  }

  if (has('academicYearId') || !partial) {
    value.academicYearId = readId('academicYearId');
  }

  if (has('semesterId') || !partial) {
    value.semesterId = readId('semesterId');
  }

  const examType = parseEnum(
    payload.examType,
    EXAM_TYPE_VALUES,
    'examType',
    errors,
    'final'
  );

  if (examType !== undefined) {
    value.examType = examType;
  }

  // Title is optional; the service can generate it from the course and type.
  if (has('title')) {
    const title = normalizeString(payload.title);

    if (title) {
      if (title.length > 200) {
        errors.push({
          field: 'title',
          message: 'Title must not exceed 200 characters.',
        });
      } else {
        value.title = title;
      }
    }
  }

  // Duration is required when creating an exam.
  if (!partial || has('durationMinutes')) {
    const raw = payload.durationMinutes;
    const duration = Number(raw);

    if (
      raw === undefined ||
      raw === null ||
      raw === '' ||
      !Number.isInteger(duration) ||
      duration <= 0 ||
      duration > 1440
    ) {
      errors.push({
        field: 'durationMinutes',
        message:
          'durationMinutes must be a whole number between 1 and 1440.',
      });
    } else {
      value.durationMinutes = duration;
    }
  }

  const roomType = parseEnum(
    payload.requiredRoomType,
    ROOM_TYPE_VALUES,
    'requiredRoomType',
    errors,
    undefined,
    { optional: true }
  );

  if (roomType !== undefined) {
    value.requiredRoomType = roomType;
  }

  if (has('requiredCapacity')) {
    if (
      payload.requiredCapacity === null ||
      payload.requiredCapacity === ''
    ) {
      value.requiredCapacity = null;
    } else {
      const capacity = Number(payload.requiredCapacity);

      if (
        !Number.isInteger(capacity) ||
        capacity <= 0 ||
        capacity > 100000
      ) {
        errors.push({
          field: 'requiredCapacity',
          message: 'requiredCapacity must be a positive whole number.',
        });
      } else {
        value.requiredCapacity = capacity;
      }
    }
  }

  if (has('status')) {
    const status = parseEnum(
      payload.status,
      STATUS_VALUES,
      'status',
      errors,
      undefined,
      { optional: true }
    );

    if (status !== undefined) {
      value.status = status;
    }
  }

  if (has('notes')) {
    value.notes = parseOptionalString(
      payload.notes,
      5000,
      'notes',
      errors
    );
  }

  return value;
}

function validateExamListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);

  const examType = parseEnum(
    input.examType,
    EXAM_TYPE_VALUES,
    'examType',
    errors,
    undefined,
    { optional: true }
  );

  const status = parseEnum(
    input.status,
    STATUS_VALUES,
    'status',
    errors,
    undefined,
    { optional: true }
  );

  const scheduleStatus = parseEnum(
    input.scheduleStatus,
    SCHEDULE_STATUS_VALUES,
    'scheduleStatus',
    errors,
    undefined,
    { optional: true }
  );

  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      sort: parseSort(input, errors, SORT_FIELDS, 'created_at'),
      order: parseOrder(input, errors, 'desc'),
      isActive: parseActiveFilter(input, errors),
      courseId: parseIdFilter(input, errors, 'courseId'),
      sectionId: parseIdFilter(input, errors, 'sectionId'),
      departmentId: parseIdFilter(input, errors, 'departmentId'),
      programId: parseIdFilter(input, errors, 'programId'),
      semesterId: parseIdFilter(input, errors, 'semesterId'),
      academicYearId: parseIdFilter(input, errors, 'academicYearId'),
      examPeriodId: parseIdFilter(input, errors, 'examPeriodId'),
      examType: examType || null,
      status: status || null,
      scheduleStatus: scheduleStatus || null,
    },
    errors,
  };
}

function validateCreateExam(payload = {}) {
  const errors = [];

  return {
    value: buildExamValue(payload, errors, false),
    errors,
  };
}

function validateUpdateExam(payload = {}) {
  const errors = [];
  const value = buildExamValue(payload, errors, true);

  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({
      field: 'body',
      message: 'No updatable fields were provided.',
    });
  }

  return { value, errors };
}

function validateExamStatus(payload = {}) {
  const errors = [];

  const raw =
    typeof payload.status === 'string'
      ? payload.status.trim().toLowerCase()
      : '';

  if (!STATUS_VALUES.includes(raw)) {
    errors.push({
      field: 'status',
      message: `status must be one of: ${STATUS_VALUES.join(', ')}.`,
    });
  }

  return {
    value: { status: raw },
    errors,
  };
}

module.exports = {
  SORT_FIELDS,
  EXAM_TYPE_VALUES,
  STATUS_VALUES,
  ROOM_TYPE_VALUES,
  SCHEDULE_STATUS_VALUES,
  validateExamListQuery,
  validateCreateExam,
  validateUpdateExam,
  validateExamStatus,
};
