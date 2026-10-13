
'use strict';

/**
 * Course input validation.
 *
 * Uses the existing courses table:
 * department_id, program_id, code, title, description,
 * credits, is_active.
 *
 * Prerequisites are stored in course_prerequisites.
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
} = require('./shared');

const SORT_FIELDS = [
  'created_at',
  'title',
  'code',
  'credits',
  'is_active',
];

const MIN_CODE_LENGTH = 1;
const MAX_CODE_LENGTH = 100;

const MIN_CREDITS = 1;
const MAX_CREDITS = 30;

/**
 * GET /courses query validation.
 */
function validateCourseListQuery(input = {}) {
  const errors = [];

  const { page, limit } = parsePagination(input, errors);

  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      sort: parseSort(input, errors, SORT_FIELDS, 'code'),
      order: parseOrder(input, errors, 'asc'),
      isActive: parseActiveFilter(input, errors),
      departmentId: parseIdFilter(input, errors, 'departmentId'),
      programId: parseIdFilter(input, errors, 'programId'),
    },
    errors,
  };
}

/**
 * Build a normalized course payload.
 *
 * partial = false: create validation
 * partial = true: update validation
 */
function buildCourseValue(payload = {}, errors = [], partial = false) {
  const value = {};

  const has = (key) =>
    Object.prototype.hasOwnProperty.call(payload, key);

  // Department ID
  if (!partial || has('departmentId')) {
    const raw = payload.departmentId;

    if (raw === undefined || raw === null || raw === '') {
      errors.push({
        field: 'departmentId',
        message: 'Department is required.',
      });
    } else {
      const id = Number(raw);

      if (!Number.isInteger(id) || id <= 0) {
        errors.push({
          field: 'departmentId',
          message: 'Department must be a valid positive integer.',
        });
      } else {
        value.departmentId = id;
      }
    }
  }

  // Program ID: optional, but must be valid when supplied.
  if (has('programId')) {
    const raw = payload.programId;

    if (raw === undefined || raw === null || raw === '') {
      value.programId = null;
    } else {
      const id = Number(raw);

      if (!Number.isInteger(id) || id <= 0) {
        errors.push({
          field: 'programId',
          message: 'Program must be a valid positive integer.',
        });
      } else {
        value.programId = id;
      }
    }
  } else if (!partial) {
    value.programId = null;
  }

  // Course code: any characters are allowed.
  if (!partial || has('code')) {
    const code = normalizeString(payload.code);

    if (!code) {
      errors.push({
        field: 'code',
        message: 'Course code is required.',
      });
    } else if (code.length < MIN_CODE_LENGTH || code.length > MAX_CODE_LENGTH) {
      errors.push({
        field: 'code',
        message: `Course code must be between ${MIN_CODE_LENGTH} and ${MAX_CODE_LENGTH} characters.`,
      });
    } else {
      // Preserve the user's capitalization and special characters.
      value.code = code;
    }
  }

  // Course title / name.
  if (!partial || has('title')) {
    const title = normalizeString(payload.title);

    if (!title) {
      errors.push({
        field: 'title',
        message: 'Course name is required.',
      });
    } else if (title.length < 2 || title.length > 200) {
      errors.push({
        field: 'title',
        message: 'Course name must be between 2 and 200 characters.',
      });
    } else {
      value.title = title;
    }
  }

  // Credits.
  if (!partial || has('credits')) {
    const raw = payload.credits;

    if (raw === undefined || raw === null || raw === '') {
      if (!partial) {
        value.credits = 3;
      }
    } else {
      const credits = Number(raw);

      if (
        !Number.isInteger(credits) ||
        credits < MIN_CREDITS ||
        credits > MAX_CREDITS
      ) {
        errors.push({
          field: 'credits',
          message: `Credits must be a whole number between ${MIN_CREDITS} and ${MAX_CREDITS}.`,
        });
      } else {
        value.credits = credits;
      }
    }
  }

  // Description.
  if (has('description')) {
    value.description = parseOptionalString(
      payload.description,
      2000,
      'description',
      errors
    );
  } else if (!partial) {
    value.description = null;
  }

  // Active status.
  if (has('isActive')) {
    const isActive = toBoolean(payload.isActive);

    if (isActive === undefined) {
      errors.push({
        field: 'isActive',
        message: 'isActive must be a valid boolean.',
      });
    } else {
      value.isActive = isActive;
    }
  } else if (!partial) {
    value.isActive = true;
  }

  return value;
}

/**
 * POST /courses
 */
function validateCreateCourse(payload = {}) {
  const errors = [];

  const value = buildCourseValue(payload, errors, false);

  return {
    value,
    errors,
  };
}

/**
 * PUT /courses/:id
 */
function validateUpdateCourse(payload = {}) {
  const errors = [];

  const value = buildCourseValue(payload, errors, true);

  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({
      field: 'body',
      message: 'No updatable fields were provided.',
    });
  }

  return {
    value,
    errors,
  };
}

/**
 * PUT /courses/:id/prerequisites
 *
 * Expected payload:
 * {
 *   "prerequisiteIds": [1, 2, 3]
 * }
 */
function validatePrerequisiteSet(payload = {}) {
  const errors = [];
  const ids = [];
  const raw = payload.prerequisiteIds;

  if (raw !== undefined) {
    if (!Array.isArray(raw)) {
      errors.push({
        field: 'prerequisiteIds',
        message: 'Prerequisite IDs must be an array of course IDs.',
      });
    } else {
      const seen = new Set();

      raw.forEach((entry, index) => {
        const id = Number(entry);

        if (!Number.isInteger(id) || id <= 0) {
          errors.push({
            field: `prerequisiteIds[${index}]`,
            message: 'Each prerequisite ID must be a positive integer.',
          });
          return;
        }

        if (seen.has(id)) {
          errors.push({
            field: 'prerequisiteIds',
            message: 'Duplicate prerequisite IDs are not allowed.',
          });
          return;
        }

        seen.add(id);
        ids.push(id);
      });
    }
  }

  return {
    value: {
      prerequisiteIds: ids,
    },
    errors,
  };
}

module.exports = {
  SORT_FIELDS,
  MIN_CREDITS,
  MAX_CREDITS,
  validateCourseListQuery,
  validateCreateCourse,
  validateUpdateCourse,
  validatePrerequisiteSet,
};
