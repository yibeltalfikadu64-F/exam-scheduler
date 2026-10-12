'use strict';

/**
 * Course input validation (Phase 3, module 3).
 * Reuses the existing `courses` table: department_id, program_id, code, title,
 * description, credits, is_active. Prerequisites live in `course_prerequisites`.
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

const SORT_FIELDS = ['created_at', 'title', 'code', 'credits', 'is_active'];
const CODE_PATTERN = /^[A-Za-z0-9._-]{2,20}$/;
const MIN_CREDITS = 1;
const MAX_CREDITS = 30;

/** GET /courses query string. */
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

function buildCourseValue(payload, errors, partial) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  if (!partial || has('departmentId')) {
    const raw = payload.departmentId;
    if (raw === undefined || raw === null || raw === '') {
      errors.push({ field: 'departmentId', message: 'Department is required.' });
    } else {
      const id = Number(raw);
      if (!Number.isInteger(id) || id <= 0) errors.push({ field: 'departmentId', message: 'Department is invalid.' });
      else value.departmentId = id;
    }
  }

  if (has('programId')) {
    const raw = payload.programId;
    if (raw === undefined || raw === null || raw === '') value.programId = null;
    else {
      const id = Number(raw);
      if (!Number.isInteger(id) || id <= 0) errors.push({ field: 'programId', message: 'Program is invalid.' });
      else value.programId = id;
    }
  } else if (!partial) {
    value.programId = null;
  }

  if (!partial || has('code')) {
    const code = normalizeString(payload.code).toUpperCase();
    if (!code) errors.push({ field: 'code', message: 'Course code is required.' });
    else if (!CODE_PATTERN.test(code)) errors.push({ field: 'code', message: 'Code must be 2-20 characters (letters, numbers, . _ -).' });
    else value.code = code;
  }

  if (!partial || has('title')) {
    const title = normalizeString(payload.title);
    if (!title) errors.push({ field: 'title', message: 'Course title is required.' });
    else if (title.length < 2 || title.length > 200) errors.push({ field: 'title', message: 'Title must be 2-200 characters.' });
    else value.title = title;
  }

  if (!partial || has('credits')) {
    const raw = payload.credits;
    if (raw === undefined || raw === null || raw === '') {
      if (!partial) value.credits = 3;
    } else {
      const credits = Number(raw);
      if (!Number.isInteger(credits) || credits < MIN_CREDITS || credits > MAX_CREDITS) {
        errors.push({ field: 'credits', message: `credits must be a whole number between ${MIN_CREDITS} and ${MAX_CREDITS}.` });
      } else {
        value.credits = credits;
      }
    }
  }

  if (has('description')) value.description = parseOptionalString(payload.description, 2000, 'description', errors);
  else if (!partial) value.description = null;

  if (has('isActive')) {
    const isActive = toBoolean(payload.isActive);
    if (isActive === undefined) errors.push({ field: 'isActive', message: 'isActive must be a boolean.' });
    else value.isActive = isActive;
  } else if (!partial) {
    value.isActive = true;
  }

  return value;
}

function validateCreateCourse(payload = {}) {
  const errors = [];
  return { value: buildCourseValue(payload, errors, false), errors };
}

function validateUpdateCourse(payload = {}) {
  const errors = [];
  const value = buildCourseValue(payload, errors, true);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

/** PUT /courses/:id/prerequisites → { prerequisiteIds: number[] } */
function validatePrerequisiteSet(payload = {}) {
  const errors = [];
  const ids = [];
  const raw = payload.prerequisiteIds;

  if (raw !== undefined) {
    if (!Array.isArray(raw)) {
      errors.push({ field: 'prerequisiteIds', message: 'prerequisiteIds must be an array of course ids.' });
    } else {
      const seen = new Set();
      raw.forEach((entry, index) => {
        const id = Number(entry);
        if (!Number.isInteger(id) || id <= 0) {
          errors.push({ field: `prerequisiteIds[${index}]`, message: 'Each prerequisite must be a positive course id.' });
          return;
        }
        if (seen.has(id)) {
          errors.push({ field: 'prerequisiteIds', message: 'Duplicate prerequisite ids are not allowed.' });
          return;
        }
        seen.add(id);
        ids.push(id);
      });
    }
  }

  return { value: { prerequisiteIds: ids }, errors };
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
