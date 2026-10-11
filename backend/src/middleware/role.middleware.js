'use strict';

/**
 * Role-based authorization. Must run AFTER `authenticate`.
 *
 *   router.post('/', authenticate, authorize('admin', 'registrar'), handler)
 *
 * Roles: admin | registrar | department_head | instructor | student
 * Frontend route guards are a convenience only — this is the real check.
 */

const ApiError = require('../utils/ApiError');

const ROLES = ['admin', 'registrar', 'department_head', 'instructor', 'student'];

function authorize(...allowed) {
  const roles = allowed.flat().filter(Boolean);
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication is required.'));
    }
    if (roles.length === 0 || roles.includes(req.user.role)) {
      return next();
    }
    return next(
      ApiError.forbidden(`Role "${req.user.role}" is not permitted to perform this action.`, {
        code: 'INSUFFICIENT_ROLE',
      })
    );
  };
}

module.exports = { authorize, ROLES };
