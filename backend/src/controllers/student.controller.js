'use strict';

/**
 * Student + enrollment controllers (Phase 3, module 5).
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const studentService = require('../services/student.service');

function parseId(raw, label = 'student') {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest(`Invalid ${label} id.`, { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await studentService.listStudents(req.validated.query), 'Students retrieved successfully.')
);

const getOne = asyncHandler(async (req, res) => {
  const student = await studentService.getStudentById(parseId(req.params.id));
  if (!student) throw ApiError.notFound('Student not found.', { code: 'STUDENT_NOT_FOUND' });
  return ApiResponse.success(res, { student }, 'Student retrieved successfully.');
});

const create = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { student: await studentService.createStudent(req.body, req.user, requestMeta(req)) }, 'Student created successfully.', 201)
);

const update = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { student: await studentService.updateStudent(parseId(req.params.id), req.body, req.user, requestMeta(req)) },
    'Student updated successfully.'
  )
);

const setStatus = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { student: await studentService.setStudentStatus(parseId(req.params.id), req.body.status, req.user, requestMeta(req)) },
    'Student status updated successfully.'
  )
);

const listEnrollments = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { enrollments: await studentService.listEnrollments(parseId(req.params.id)) }, 'Enrollments retrieved successfully.')
);

const addEnrollment = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { enrollment: await studentService.addEnrollment(parseId(req.params.id), req.body.sectionId, req.user, requestMeta(req)) },
    'Student enrolled successfully.',
    201
  )
);

const setEnrollmentStatus = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    {
      enrollment: await studentService.setEnrollmentStatus(
        parseId(req.params.id),
        parseId(req.params.enrollmentId, 'enrollment'),
        req.body.status,
        req.user,
        requestMeta(req)
      ),
    },
    'Enrollment updated successfully.'
  )
);

module.exports = { list, getOne, create, update, setStatus, listEnrollments, addEnrollment, setEnrollmentStatus };
