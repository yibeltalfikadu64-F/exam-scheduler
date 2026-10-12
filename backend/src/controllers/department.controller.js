'use strict';

/**
 * Department controllers (Phase 3). Thin HTTP layer over department.service.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const departmentService = require('../services/department.service');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest('Invalid department id.', { code: 'INVALID_ID' });
  }
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

/** GET /api/v1/departments */
const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await departmentService.listDepartments(req.validated.query), 'Departments retrieved successfully.')
);

/** GET /api/v1/departments/options */
const options = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { departments: await departmentService.listOptions() }, 'Department options retrieved.')
);

/** GET /api/v1/departments/:id */
const getOne = asyncHandler(async (req, res) => {
  const department = await departmentService.getPublicById(parseId(req.params.id));
  if (!department) throw ApiError.notFound('Department not found.', { code: 'DEPARTMENT_NOT_FOUND' });
  return ApiResponse.success(res, { department }, 'Department retrieved successfully.');
});

/** GET /api/v1/departments/:id/dependencies */
const dependencies = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await departmentService.getDependencies(parseId(req.params.id)),
    'Department dependencies retrieved.'
  )
);

/** POST /api/v1/departments */
const create = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { department: await departmentService.createDepartment(req.body, req.user, requestMeta(req)) },
    'Department created successfully.',
    201
  )
);

/** PATCH /api/v1/departments/:id */
const update = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { department: await departmentService.updateDepartment(parseId(req.params.id), req.body, req.user, requestMeta(req)) },
    'Department updated successfully.'
  )
);

/** PATCH /api/v1/departments/:id/status */
const setStatus = asyncHandler(async (req, res) => {
  const department = await departmentService.setDepartmentStatus(
    parseId(req.params.id),
    req.body.isActive,
    req.user,
    requestMeta(req)
  );
  return ApiResponse.success(
    res,
    { department },
    req.body.isActive ? 'Department activated successfully.' : 'Department deactivated successfully.'
  );
});

module.exports = { list, options, getOne, dependencies, create, update, setStatus };
