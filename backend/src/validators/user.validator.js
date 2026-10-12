'use strict';

/**
 * User-management input validation.
 *
 * Same dependency-free `{ value, errors }` contract as the auth validator, so
 * the shared `validate()` middleware can apply it to bodies and query strings.
 */

const ROLES = ['admin', 'registrar', 'department_head', 'instructor', 'student'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,50}$/;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;

const SORT_FIELDS = ['created_at', 'username', 'email', 'full_name', 'role', 'is_active', 'last_login'];
const STATUS_FILTERS = ['all', 'active', 'inactive'];
const ORDER_VALUES = ['asc', 'desc'];

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_SEARCH_LENGTH = 100;

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return undefined;
}

function passwordErrors(password, field = 'password') {
  const errors = [];
  if (!password) {
    errors.push({ field, message: 'Password is required.' });
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push({ field, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push({ field, message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.` });
  } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.push({ field, message: 'Password must contain at least one letter and one number.' });
  }
  return errors;
}

function validateUsername(value, errors) {
  if (!value) {
    errors.push({ field: 'username', message: 'Username is required.' });
    return null;
  }
  if (!USERNAME_PATTERN.test(value)) {
    errors.push({
      field: 'username',
      message: 'Username must be 3-50 characters using letters, numbers, dot, underscore or hyphen.',
    });
    return null;
  }
  return value;
}

function validateEmail(value, errors) {
  if (!value) {
    errors.push({ field: 'email', message: 'Email is required.' });
    return null;
  }
  if (value.length > 100 || !EMAIL_PATTERN.test(value)) {
    errors.push({ field: 'email', message: 'A valid email address is required.' });
    return null;
  }
  return value.toLowerCase();
}

function validateFullName(value, errors) {
  if (!value) {
    errors.push({ field: 'fullName', message: 'Full name is required.' });
    return null;
  }
  if (value.length < 2 || value.length > 100) {
    errors.push({ field: 'fullName', message: 'Full name must be 2-100 characters.' });
    return null;
  }
  return value;
}

function validateRole(value, errors) {
  if (!value) {
    errors.push({ field: 'role', message: 'Role is required.' });
    return null;
  }
  if (!ROLES.includes(value)) {
    errors.push({ field: 'role', message: `Role must be one of: ${ROLES.join(', ')}.` });
    return null;
  }
  return value;
}

function validatePhone(value, errors) {
  if (!value) return null;
  if (!PHONE_PATTERN.test(value)) {
    errors.push({ field: 'phone', message: 'Phone number is invalid.' });
    return null;
  }
  return value;
}

function validateDepartmentId(value, errors) {
  if (value === undefined || value === null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    errors.push({ field: 'departmentId', message: 'Department is invalid.' });
    return null;
  }
  return id;
}

/** GET /users query string. */
function validateListQuery(input = {}) {
  const errors = [];

  let page = Number(input.page);
  if (input.page === undefined || input.page === '') page = 1;
  if (!Number.isInteger(page) || page < 1) {
    errors.push({ field: 'page', message: 'page must be a positive integer.' });
    page = 1;
  }

  let limit = Number(input.limit);
  if (input.limit === undefined || input.limit === '') limit = 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    errors.push({ field: 'limit', message: 'limit must be an integer between 1 and 100.' });
    limit = 10;
  }

  const search = normalizeString(input.search);
  if (search.length > MAX_SEARCH_LENGTH) {
    errors.push({ field: 'search', message: `search must be at most ${MAX_SEARCH_LENGTH} characters.` });
  }

  const role = normalizeString(input.role);
  if (role && !ROLES.includes(role)) {
    errors.push({ field: 'role', message: `role must be one of: ${ROLES.join(', ')}.` });
  }

  const status = normalizeString(input.status) || 'all';
  if (!STATUS_FILTERS.includes(status)) {
    errors.push({ field: 'status', message: `status must be one of: ${STATUS_FILTERS.join(', ')}.` });
  }

  const sort = normalizeString(input.sort) || 'created_at';
  if (!SORT_FIELDS.includes(sort)) {
    errors.push({ field: 'sort', message: `sort must be one of: ${SORT_FIELDS.join(', ')}.` });
  }

  const order = (normalizeString(input.order) || 'desc').toLowerCase();
  if (!ORDER_VALUES.includes(order)) {
    errors.push({ field: 'order', message: `order must be one of: ${ORDER_VALUES.join(', ')}.` });
  }

  return {
    value: { page, limit, search, role: role || null, status, sort, order },
    errors,
  };
}

/** POST /users */
function validateCreateUser(payload = {}) {
  const errors = [];
  const username = validateUsername(normalizeString(payload.username), errors);
  const email = validateEmail(normalizeString(payload.email), errors);
  const fullName = validateFullName(normalizeString(payload.fullName), errors);
  const role = validateRole(normalizeString(payload.role), errors);
  const phone = validatePhone(normalizeString(payload.phone), errors);
  const departmentId = validateDepartmentId(payload.departmentId, errors);
  const password = typeof payload.password === 'string' ? payload.password : '';
  errors.push(...passwordErrors(password));

  return {
    value: {
      username,
      email,
      fullName,
      role,
      password,
      phone,
      departmentId,
      isActive: toBoolean(payload.isActive),
      isVerified: toBoolean(payload.isVerified),
    },
    errors,
  };
}

/** PATCH /users/:id — only provided fields are updated. */
function validateUpdateUser(payload = {}) {
  const errors = [];
  const value = {};

  if (payload.username !== undefined) value.username = validateUsername(normalizeString(payload.username), errors);
  if (payload.email !== undefined) value.email = validateEmail(normalizeString(payload.email), errors);
  if (payload.fullName !== undefined) value.fullName = validateFullName(normalizeString(payload.fullName), errors);
  if (payload.role !== undefined) value.role = validateRole(normalizeString(payload.role), errors);
  if (payload.phone !== undefined) value.phone = validatePhone(normalizeString(payload.phone), errors);
  if (payload.departmentId !== undefined) value.departmentId = validateDepartmentId(payload.departmentId, errors);
  if (payload.isActive !== undefined) {
    const isActive = toBoolean(payload.isActive);
    if (isActive === undefined) errors.push({ field: 'isActive', message: 'isActive must be a boolean.' });
    else value.isActive = isActive;
  }
  if (payload.isVerified !== undefined) {
    const isVerified = toBoolean(payload.isVerified);
    if (isVerified === undefined) errors.push({ field: 'isVerified', message: 'isVerified must be a boolean.' });
    else value.isVerified = isVerified;
  }

  if (Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: 'body', message: 'No updatable fields were provided.' });
  }

  return { value, errors };
}

/** PATCH /users/:id/status */
function validateStatusChange(payload = {}) {
  const errors = [];
  const isActive = toBoolean(payload.isActive);
  if (isActive === undefined) {
    errors.push({ field: 'isActive', message: 'isActive must be a boolean (true or false).' });
  }
  return { value: { isActive }, errors };
}

/** POST /users/:id/reset-password */
function validateResetPassword(payload = {}) {
  const errors = [];
  const newPassword = typeof payload.newPassword === 'string' ? payload.newPassword : '';
  errors.push(...passwordErrors(newPassword, 'newPassword'));
  return { value: { newPassword }, errors };
}

module.exports = {
  ROLES,
  SORT_FIELDS,
  validateListQuery,
  validateCreateUser,
  validateUpdateUser,
  validateStatusChange,
  validateResetPassword,
};
