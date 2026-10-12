'use strict';

/**
 * Section validation (Phase 3, module 4).
 *
 * A section is a delivery group of one course for a term. It reuses the
 * existing `sections` table (course_id, section, term, capacity, instructor_id)
 * and the additive links to the academic calendar (program_id, academic_year_id,
 * semester_id, section_name).
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

const SORT_FIELDS = ['created_at', 'section', 'capacity', 'term', 'is_active'];
const SECTION_CODE_PATTERN = /^[A-Za-z0-9._-]{1,10}$/;
const MAX_CAPACITY = 65535;

function validateSectionListQuery(input = {}) {
  const errors = [];
  const { page, limit } = parsePagination(input, errors);
  return {
    value: {
      page,
      limit,
      search: parseSearch(input, errors),
      sort: parseSort(input, errors, SORT_FIELDS, 'section'),
      order: parseOrder(input, errors, 'asc'),
      isActive: parseActiveFilter(input, errors),
      courseId: parseIdFilter(input, errors, 'courseId'),
      programId: parseIdFilter(input, errors, 'programId'),
      academicYearId: parseIdFilter(input, errors, 'academicYearId'),
      semesterId: parseIdFilter(input, errors, 'semesterId'),
      departmentId: parseIdFilter(input, errors, 'departmentId'),
      instructorId: parseIdFilter(input, errors, 'instructorId'),
    },
    errors,
  };
}

function readOptionalId(payload, key, errors) {
  if (payload[key] === undefined) return undefined;
  if (payload[key] === null || payload[key] === '') return null;
  const id = Number(payload[key]);
  if (!Number.isInteger(id) || id <= 0) {
    errors.push({ field: key, message: `${key} must be a positive integer or null.` });
    return undefined;
  }
  return id;
}

function buildSectionValue(payload, errors, partial) {
  const value = {};
  const has = (key) => payload[key] !== undefined;

  if (!partial || has('courseId')) {
    const raw = payload.courseId;
    if (raw === undefined || raw === null || raw === '') errors.push({ field: 'courseId', message: 'Course is required.' });
    else {
      const id = Number(raw);
      if (!Number.isInteger(id) || id <= 0) errors.push({ field: 'courseId', message: 'Course is invalid.' });
      else value.courseId = id;
    }
  }

  if (!partial || has('section')) {
    const code = normalizeString(payload.section).toUpperCase();
    if (!code) errors.push({ field: 'section', message: 'Section code is required.' });
    else if (!SECTION_CODE_PATTERN.test(code)) errors.push({ field: 'section', message: 'Section code must be 1-10 characters (letters, numbers, . _ -).' });
    else value.section = code;
  }

  if (has('sectionName')) value.sectionName = parseOptionalString(payload.sectionName, 100, 'sectionName', errors);
  else if (!partial) value.sectionName = null;

  if (has('term')) value.term = parseOptionalString(payload.term, 30, 'term', errors);
  else if (!partial) value.term = null;

  if (!partial || has('capacity')) {
    const raw = payload.capacity;
    if (raw === undefined || raw === null || raw === '') {
      if (!partial) errors.push({ field: 'capacity', message: 'Capacity is required.' });
    } else {
      const capacity = Number(raw);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CAPACITY) {
        errors.push({ field: 'capacity', message: `capacity must be a whole number between 1 and ${MAX_CAPACITY}.` });
      } else value.capacity = capacity;
    }
  }

  const programId = readOptionalId(payload, 'programId', errors);
  const academicYearId = readOptionalId(payload, 'academicYearId', errors);
  const semesterId = readOptionalId(payload, 'semesterId', errors);
  const instructorId = readOptionalId(payload, 'instructorId', errors);
  if (programId !== undefined) value.programId = programId;
  if (academicYearId !== undefined) value.academicYearId = academicYearId;
  if (semesterId !== undefined) value.semesterId = semesterId;
  if (instructorId !== undefined) value.instructorId = instructorId;
  if (!partial) {
    if (programId === undefined) value.programId = null;
    if (academicYearId === undefined) value.academicYearId = null;
    if (semesterId === undefined) value.semesterId = null;
    if (instructorId === undefined) value.instructorId = null;
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

function validateCreateSection(payload = {}) {
  const errors = [];
  const value = buildSectionValue(payload, errors, false);
  if (value.semesterId && !value.academicYearId) {
    errors.push({ field: 'academicYearId', message: 'Select an academic year when choosing a semester.' });
  }
  return { value, errors };
}

function validateUpdateSection(payload = {}) {
  const errors = [];
  const value = buildSectionValue(payload, errors, true);
  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }
  return { value, errors };
}

module.exports = {
  SORT_FIELDS,
  validateSectionListQuery,
  validateCreateSection,
  validateUpdateSection,
};
