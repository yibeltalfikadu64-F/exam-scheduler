'use strict';

/**
 * Instructor controllers (Phase 3, module 5).
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const instructorService = require('../services/instructor.service');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Invalid instructor id.', { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await instructorService.listInstructors(req.validated.query), 'Instructors retrieved successfully.')
);

const options = asyncHandler(async (req, res) => {
  const departmentId = Number(req.query.departmentId);
  const instructors = await instructorService.listOptions(Number.isInteger(departmentId) && departmentId > 0 ? departmentId : null);
  return ApiResponse.success(res, { instructors }, 'Instructor options retrieved.');
});

const getOne = asyncHandler(async (req, res) => {
  const instructor = await instructorService.getInstructorById(parseId(req.params.id));
  if (!instructor) throw ApiError.notFound('Instructor not found.', { code: 'INSTRUCTOR_NOT_FOUND' });
  return ApiResponse.success(res, { instructor }, 'Instructor retrieved successfully.');
});

const create = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { instructor: await instructorService.createInstructor(req.body, req.user, requestMeta(req)) },
    'Instructor created successfully.',
    201
  )
);

const update = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { instructor: await instructorService.updateInstructor(parseId(req.params.id), req.body, req.user, requestMeta(req)) },
    'Instructor updated successfully.'
  )
);

const setStatus = asyncHandler(async (req, res) => {
  const instructor = await instructorService.setInstructorStatus(parseId(req.params.id), req.body.isActive, req.user, requestMeta(req));
  return ApiResponse.success(
    res,
    { instructor },
    req.body.isActive ? 'Instructor activated successfully.' : 'Instructor deactivated successfully.'
  );
});

module.exports = { list, options, getOne, create, update, setStatus };
