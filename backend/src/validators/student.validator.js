
'use strict';

/**
 * Student + enrollment validation (Phase 3, module 5).
 *
 * Reuses the existing students table and enrollments table.
 * Student numbers accept arbitrary characters, up to 100 characters.
 */

const {
  normalizeString,
  parsePagination,
  parseSearch,
  parseSort,
  parseOrder,
  parseIdFilter,
  parseOptionalString,
} = require('./shared');

const STATUSES = ['active', 'inactive', 'graduated', 'suspended'];
const ENROLLMENT_STATUSES = ['enrolled', 'dropped', 'completed'];
const SORT_FIELDS = [
  'created_at',
  'student_number',
  'full_name',
  'year',
  'status',
];
const MIN_STUDENT_NUMBER_LENGTH = 1;
const MAX_STUDENT_NUMBER_LENGTH = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateStudentListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);

  let status = normalizeString(input.status).toLowerCase() || null;

  if (status === 'all') status = null;

  if (status && !STATUSES.includes(status)) {
    errors.push({
      field: 'status',
      message: `status must be one of: ${STATUSES.join(', ')}.`,
    });
    status = null;
  }

  let year = null;

  if (input.year !== undefined && input.year !== '') {
    const parsed = Number(input.year);

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8) {
      errors.push({
        field: 'year',
        message: 'year must be a whole number between 1 and 8.',
      });
    } else {
      year = parsed;
    }
  }

  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      sort: parseSort(input, errors, SORT_FIELDS, 'student_number'),
      order: parseOrder(input, errors, 'asc'),
      programId: parseIdFilter(input, errors, 'programId'),
      departmentId: parseIdFilter(input, errors, 'departmentId'),
      year,
      status,
    },
    errors,
  };
}

function buildStudentValue(payload = {}, errors = [], partial = false) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  // Student number: any characters, 1-100 characters.
  if (!partial || has('studentNumber')) {
    const number = normalizeString(payload.studentNumber);

    if (!number) {
      errors.push({
        field: 'studentNumber',
        message: 'Student number is required.',
      });
    } else if (
      number.length < MIN_STUDENT_NUMBER_LENGTH ||
      number.length > MAX_STUDENT_NUMBER_LENGTH
    ) {
      errors.push({
        field: 'studentNumber',
        message: 'Student number must be 1-100 characters.',
      });
    } else {
      // Preserve the original capitalization and special characters.
      value.studentNumber = number;
    }
  }

  if (!partial || has('fullName')) {
    const fullName = normalizeString(payload.fullName);

    if (!fullName) {
      errors.push({
        field: 'fullName',
        message: 'Full name is required.',
      });
    } else if (fullName.length < 2 || fullName.length > 150) {
      errors.push({
        field: 'fullName',
        message: 'Full name must be 2-150 characters.',
      });
    } else {
      value.fullName = fullName;
    }
  }

  if (has('email')) {
    const email = normalizeString(payload.email);

    if (!email) {
      value.email = null;
    } else if (email.length > 150) {
      errors.push({
        field: 'email',
        message: 'Email must be at most 150 characters.',
      });
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.push({
        field: 'email',
        message: 'Enter a valid email address.',
      });
    } else {
      value.email = email.toLowerCase();
    }
  } else if (!partial) {
    value.email = null;
  }

  if (has('phone')) {
    value.phone = parseOptionalString(payload.phone, 20, 'phone', errors);
  } else if (!partial) {
    value.phone = null;
  }

  if (has('programId')) {
    if (payload.programId === null || payload.programId === '') {
      value.programId = null;
    } else {
      const id = Number(payload.programId);

      if (!Number.isInteger(id) || id <= 0) {
        errors.push({
          field: 'programId',
          message: 'programId must be a positive integer or null.',
        });
      } else {
        value.programId = id;
      }
    }
  } else if (!partial) {
    value.programId = null;
  }

  if (has('userId')) {
    if (payload.userId === null || payload.userId === '') {
      value.userId = null;
    } else {
      const id = Number(payload.userId);

      if (!Number.isInteger(id) || id <= 0) {
        errors.push({
          field: 'userId',
          message: 'userId must be a positive integer or null.',
        });
      } else {
        value.userId = id;
      }
    }
  } else if (!partial) {
    value.userId = null;
  }

  if (!partial || has('year')) {
    const raw = payload.year;

    if (raw === undefined || raw === null || raw === '') {
      if (!partial) value.year = 1;
    } else {
      const year = Number(raw);

      if (!Number.isInteger(year) || year < 1 || year > 8) {
        errors.push({
          field: 'year',
          message: 'year must be a whole number between 1 and 8.',
        });
      } else {
        value.year = year;
      }
    }
  }

  if (has('status')) {
    const status = normalizeString(payload.status).toLowerCase();

    if (!status || !STATUSES.includes(status)) {
      errors.push({
        field: 'status',
        message: `status must be one of: ${STATUSES.join(', ')}.`,
      });
    } else {
      value.status = status;
    }
  } else if (!partial) {
    value.status = 'active';
  }

  return value;
}

function validateCreateStudent(payload = {}) {
  const errors = [];

  return {
    value: buildStudentValue(payload, errors, false),
    errors,
  };
}

function validateUpdateStudent(payload = {}) {
  const errors = [];
  const value = buildStudentValue(payload, errors, true);

  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({
      field: 'body',
      message: 'No updatable fields were provided.',
    });
  }

  return { value, errors };
}

function validateStudentStatus(payload = {}) {
  const errors = [];
  const status = normalizeString(payload.status).toLowerCase();

  if (!status || !STATUSES.includes(status)) {
    errors.push({
      field: 'status',
      message: `status must be one of: ${STATUSES.join(', ')}.`,
    });
  }

  return { value: { status }, errors };
}

function validateEnrollmentCreate(payload = {}) {
  const errors = [];
  const sectionId = Number(payload.sectionId);

  if (!Number.isInteger(sectionId) || sectionId <= 0) {
    errors.push({
      field: 'sectionId',
      message: 'sectionId must be a positive integer.',
    });
  }

  return { value: { sectionId }, errors };
}

function validateEnrollmentStatus(payload = {}) {
  const errors = [];
  const status = normalizeString(payload.status).toLowerCase();

  if (!ENROLLMENT_STATUSES.includes(status)) {
    errors.push({
      field: 'status',
      message: `status must be one of: ${ENROLLMENT_STATUSES.join(', ')}.`,
    });
  }

  return { value: { status }, errors };
}

module.exports = {
  STATUSES,
  ENROLLMENT_STATUSES,
  SORT_FIELDS,
  validateStudentListQuery,
  validateCreateStudent,
  validateUpdateStudent,
  validateStudentStatus,
  validateEnrollmentCreate,
  validateEnrollmentStatus,
};
