
'use strict';

/**
 * Course controllers (Phase 3, module 3).
 *
 * Handles HTTP requests for:
 * - Listing courses
 * - Retrieving course options
 * - Retrieving a single course
 * - Creating and updating courses
 * - Activating and deactivating courses
 * - Managing course prerequisites
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const courseService = require('../services/course.service');

/**
 * Validate a route parameter containing a course ID.
 */
function parseId(raw) {
  const id = Number(raw);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest('Invalid course ID.', {
      code: 'INVALID_ID',
    });
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
 * Convert an optional query parameter to a valid positive ID.
 */
function optionalId(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const id = Number(value);

  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * GET /courses
 * Retrieve a paginated course list.
 */
const list = asyncHandler(async (req, res) => {
  const result = await courseService.listCourses(
    req.validated.query
  );

  return ApiResponse.success(
    res,
    result,
    'Courses retrieved successfully.'
  );
});

/**
 * GET /courses/options
 * Retrieve course options for dropdowns.
 */
const options = asyncHandler(async (req, res) => {
  const courses = await courseService.listOptions({
    departmentId: optionalId(req.query.departmentId),
    programId: optionalId(req.query.programId),
  });

  return ApiResponse.success(
    res,
    { courses },
    'Course options retrieved successfully.'
  );
});

/**
 * GET /courses/:id
 * Retrieve one course.
 */
const getOne = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const course = await courseService.getPublicById(id);

  if (!course) {
    throw ApiError.notFound('Course not found.', {
      code: 'COURSE_NOT_FOUND',
    });
  }

  return ApiResponse.success(
    res,
    { course },
    'Course retrieved successfully.'
  );
});

/**
 * POST /courses
 * Create a course.
 */
const create = asyncHandler(async (req, res) => {
  const course = await courseService.createCourse(
    req.body,
    req.user,
    requestMeta(req)
  );

  return ApiResponse.success(
    res,
    { course },
    'Course created successfully.',
    201
  );
});

/**
 * PUT /courses/:id
 * Update a course.
 */
const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const course = await courseService.updateCourse(
    id,
    req.body,
    req.user,
    requestMeta(req)
  );

  return ApiResponse.success(
    res,
    { course },
    'Course updated successfully.'
  );
});

/**
 * PATCH /courses/:id/status
 * Activate or deactivate a course.
 */
const setStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  if (typeof isActive !== 'boolean') {
    throw ApiError.badRequest(
      'isActive must be true or false.',
      { code: 'INVALID_COURSE_STATUS' }
    );
  }

  const id = parseId(req.params.id);

  const course = await courseService.setCourseStatus(
    id,
    isActive,
    req.user,
    requestMeta(req)
  );

  return ApiResponse.success(
    res,
    { course },
    isActive
      ? 'Course activated successfully.'
      : 'Course deactivated successfully.'
  );
});

/**
 * GET /courses/:id/prerequisites
 * Retrieve a course and its prerequisites.
 */
const getPrerequisites = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const course = await courseService.getPublicById(id);

  if (!course) {
    throw ApiError.notFound('Course not found.', {
      code: 'COURSE_NOT_FOUND',
    });
  }

  return ApiResponse.success(
    res,
    {
      courseId: id,
      prerequisites: course.prerequisites || [],
    },
    'Course prerequisites retrieved successfully.'
  );
});

/**
 * PUT /courses/:id/prerequisites
 * Replace the prerequisites for a course.
 */
const replacePrerequisites = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);

  const course = await courseService.replacePrerequisites(
    id,
    req.body.prerequisiteIds,
    req.user,
    requestMeta(req)
  );

  return ApiResponse.success(
    res,
    { course },
    'Course prerequisites updated successfully.'
  );
});

const remove = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await courseService.deleteCourse(parseId(req.params.id), req.user, requestMeta(req)),
    'Course deleted successfully.'
  )
);

module.exports = {
  list,
  options,
  getOne,
  create,
  update,
  setStatus,
  getPrerequisites,
  replacePrerequisites,
  remove,
};
