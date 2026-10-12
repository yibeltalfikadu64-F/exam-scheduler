'use strict';

/**
 * Shared authorization scoping helpers for academic-structure services.
 */

const ApiError = require('../utils/ApiError');

/**
 * A department head may only manage records that belong to their own
 * department. The department id is compared against the one loaded onto the
 * authenticated user (never trusted from the request body).
 */
function assertDepartmentScope(actor, departmentId) {
  if (actor && actor.role === 'department_head' && Number(departmentId) !== Number(actor.departmentId)) {
    throw ApiError.forbidden('Department heads may only manage records in their own department.', {
      code: 'DEPARTMENT_SCOPE',
    });
  }
}

module.exports = { assertDepartmentScope };
