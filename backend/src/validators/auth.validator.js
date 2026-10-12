'use strict';

/**
 * Authentication input validation.
 *
 * Dependency-free (no validator library) so it stays consistent with the rest
 * of the foundation. Each rule returns `{ value, errors }` where `value` is the
 * normalized payload and `errors` is an array of `{ field, message }`.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const MIN_IDENTIFIER_LENGTH = 3;
const MAX_IDENTIFIER_LENGTH = 100;

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validates and normalizes a login payload.
 *
 * Accepts `identifier`, `username` or `email` (the login form may send any of
 * them) plus `password`. Error messages are deliberately generic so they never
 * confirm whether a particular account exists.
 */
function validateLogin(payload = {}) {
  const errors = [];
  const identifier = normalizeString(payload.identifier ?? payload.username ?? payload.email);
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!identifier) {
    errors.push({ field: 'identifier', message: 'Username or email is required.' });
  } else if (identifier.length < MIN_IDENTIFIER_LENGTH) {
    errors.push({
      field: 'identifier',
      message: `Username or email must be at least ${MIN_IDENTIFIER_LENGTH} characters.`,
    });
  } else if (identifier.length > MAX_IDENTIFIER_LENGTH) {
    errors.push({
      field: 'identifier',
      message: `Username or email must be at most ${MAX_IDENTIFIER_LENGTH} characters.`,
    });
  }

  if (!password) {
    errors.push({ field: 'password', message: 'Password is required.' });
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`,
    });
  }

  return { value: { identifier, password }, errors };
}

module.exports = {
  validateLogin,
  EMAIL_PATTERN,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
};
