'use strict';

/**
 * Course controllers (Phase 3, module 3).
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const courseService = require('../services/course.service');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Invalid course id.', { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

function optionalId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await courseService.listCourses(req.validated.query), 'Courses retrieved successfully.')
);

const options = asyncHandler(async (req, res) => {
  const courses = await courseService.listOptions({
    departmentId: optionalId(req.query.departmentId),
    programId: optionalId(req.query.programId),
  });
  return ApiResponse.success(res, { courses }, 'Course options retrieved.');
});

const getOne = asyncHandler(async (req, res) => {
  const course = await courseService.getPublicById(parseId(req.params.id));
  if (!course) throw ApiError.notFound('Course not found.', { code: 'COURSE_NOT_FOUND' });
  return ApiResponse.success(res, { course }, 'Course retrieved successfully.');
});

const create = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { course: await courseService.createCourse(req.body, req.user, requestMeta(req)) },
    'Course created successfully.',
    201
  )
);

const update = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { course: await courseService.updateCourse(parseId(req.params.id), req.body, req.user, requestMeta(req)) },
    'Course updated successfully.'
  )
);

const setStatus = asyncHandler(async (req, res) => {
  const course = await courseService.setCourseStatus(parseId(req.params.id), req.body.isActive, req.user, requestMeta(req));
  return ApiResponse.success(
    res,
    { course },
    req.body.isActive ? 'Course activated successfully.' : 'Course deactivated successfully.'
  );
});

const getPrerequisites = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const course = await courseService.getPublicById(id);
  if (!course) throw ApiError.notFound('Course not found.', { code: 'COURSE_NOT_FOUND' });
  return ApiResponse.success(res, { courseId: id, prerequisites: course.prerequisites }, 'Course prerequisites retrieved.');
});

const replacePrerequisites = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { course: await courseService.replacePrerequisites(parseId(req.params.id), req.body.prerequisiteIds, req.user, requestMeta(req)) },
    'Course prerequisites updated successfully.'
  )
);

module.exports = { list, options, getOne, create, update, setStatus, getPrerequisites, replacePrerequisites };
