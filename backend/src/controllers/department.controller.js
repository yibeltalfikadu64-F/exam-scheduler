
'use strict';

/**
 * Department controllers.
 * Thin HTTP layer over department.service.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

const departmentService = require('../services/department.service');

/**
 * Validate and parse a department ID.
 */
function parseId(raw) {
  const id = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest(
      'Invalid department id.',
      { code: 'INVALID_ID' }
    );
  }

  return id;
}

/**
 * Request metadata for auditing.
 */
function requestMeta(req) {
  return {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };
}

/**
 * GET /api/v1/departments
 * List departments.
 */
const list = asyncHandler(async (req, res) => {
  const departments = await departmentService.listDepartments(
    req.validated.query
  );

  return ApiResponse.success(
    res,
    departments,
    'Departments retrieved successfully.'
  );
});

/**
 * GET /api/v1/departments/options
 * Return department options for dropdowns.
 */
const options = asyncHandler(async (req, res) => {
  const departments = await departmentService.listOptions();

  return ApiResponse.success(
    res,
    { departments },
    'Department options retrieved successfully.'
  );
});

/**
 * GET /api/v1/departments/:id
 * Retrieve one department.
 */
const getOne = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const department = await departmentService.getPublicById(id);

  if (!department) {
    throw ApiError.notFound(
      'Department not found.',
      { code: 'DEPARTMENT_NOT_FOUND' }
    );
  }

  return ApiResponse.success(
    res,
    { department },
    'Department retrieved successfully.'
  );
});

/**
 * GET /api/v1/departments/:id/dependencies
 * Retrieve related record counts.
 */
const dependencies = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const result = await departmentService.getDependencies(id);

  return ApiResponse.success(
    res,
    result,
    'Department dependencies retrieved successfully.'
  );
});

/**
 * GET /api/v1/departments/:id/stats
 * Department-scoped statistics for the department detail page.
 */
const stats = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const department = await departmentService.getPublicById(id);

  if (!department) {
    throw ApiError.notFound(
      'Department not found.',
      { code: 'DEPARTMENT_NOT_FOUND' }
    );
  }

  const statistics = await departmentService.getStats(id);

  return ApiResponse.success(
    res,
    { department, stats: statistics },
    'Department statistics retrieved successfully.'
  );
});

/**
 * POST /api/v1/departments
 * Create a department.
 */
const create = asyncHandler(async (req, res) => {
  const department = await departmentService.createDepartment(
    req.body,
    req.user,
    requestMeta(req)
  );

  return ApiResponse.success(
    res,
    { department },
    'Department created successfully.',
    201
  );
});

/**
 * PATCH /api/v1/departments/:id
 * Update a department.
 */
const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const department = await departmentService.updateDepartment(
    id,
    req.body,
    req.user,
    requestMeta(req)
  );

  return ApiResponse.success(
    res,
    { department },
    'Department updated successfully.'
  );
});

/**
 * PATCH /api/v1/departments/:id/status
 * Activate or deactivate a department.
 */
const setStatus = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const department = await departmentService.setDepartmentStatus(
    id,
    req.body.isActive,
    req.user,
    requestMeta(req)
  );

  const message = req.body.isActive
    ? 'Department activated successfully.'
    : 'Department deactivated successfully.';

  return ApiResponse.success(
    res,
    { department },
    message
  );
});

/**
 * DELETE /api/v1/departments/:id
 * Delete a department when nothing depends on it.
 */
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const result = await departmentService.deleteDepartment(
    id,
    req.user,
    requestMeta(req)
  );

  return ApiResponse.success(
    res,
    result,
    'Department deleted successfully.'
  );
});

module.exports = {
  list,
  options,
  getOne,
  dependencies,
  stats,
  create,
  update,
  setStatus,
  remove,
};
