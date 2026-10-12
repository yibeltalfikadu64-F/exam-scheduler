'use strict';

/**
 * Request validation middleware.
 *
 * Usage:  router.post('/login', validate(validateLogin), controller)
 *
 * `rule(data)` returns `{ value, errors }`. On failure the request is rejected
 * with a 400 `VALIDATION_ERROR` carrying a per-field `details` array; on success
 * the normalized value replaces `req[source]`.
 */

const ApiError = require('../utils/ApiError');

function validate(rule, source = 'body') {
  return function validationMiddleware(req, res, next) {
    let result;
    try {
      result = rule(req[source] || {});
    } catch (error) {
      return next(ApiError.badRequest('Invalid request payload.', { code: 'VALIDATION_ERROR' }));
    }

    const { value, errors } = result || {};
    if (errors && errors.length > 0) {
      return next(
        ApiError.badRequest('Validation failed.', {
          code: 'VALIDATION_ERROR',
          details: errors,
        })
      );
    }

    // Body keeps its familiar `req.body` shape; other sources (query/params) are
    // exposed via `req.validated[source]` because req.query is a getter.
    req.validated = req.validated || {};
    req.validated[source] = value;
    if (source === 'body') req.body = value;
    return next();
  };
}

module.exports = { validate };
