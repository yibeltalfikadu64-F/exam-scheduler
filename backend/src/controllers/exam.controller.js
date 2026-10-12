'use strict';

/**
 * Exam controllers (Phase 5). Thin HTTP layer over exam.service.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const examService = require('../services/exam.service');
const { EXAM_TYPE_VALUES, STATUS_VALUES, ROOM_TYPE_VALUES } = require('../validators/exam.validator');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Invalid exam id.', { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await examService.listExams(req.validated.query, req.user), 'Exams retrieved successfully.')
);

const options = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { examTypes: EXAM_TYPE_VALUES, statuses: STATUS_VALUES, roomTypes: ROOM_TYPE_VALUES },
    'Exam options retrieved.'
  )
);

const getOne = asyncHandler(async (req, res) => {
  const exam = await examService.getPublicById(parseId(req.params.id));
  if (!exam) throw ApiError.notFound('Exam not found.', { code: 'EXAM_NOT_FOUND' });
  if (req.user.role === 'department_head' && exam.department && exam.department.id !== req.user.departmentId) {
    throw ApiError.forbidden('Department heads may only view exams in their own department.', { code: 'DEPARTMENT_SCOPE' });
  }
  return ApiResponse.success(res, { exam }, 'Exam retrieved successfully.');
});

const create = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { exam: await examService.createExam(req.body, req.user, requestMeta(req)) }, 'Exam created successfully.', 201)
);

const update = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { exam: await examService.updateExam(parseId(req.params.id), req.body, req.user, requestMeta(req)) },
    'Exam updated successfully.'
  )
);

const setStatus = asyncHandler(async (req, res) => {
  const exam = await examService.setExamStatus(parseId(req.params.id), req.body.status, req.user, requestMeta(req));
  return ApiResponse.success(res, { exam }, `Exam marked as ${exam.status}.`);
});

const remove = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await examService.deleteExam(parseId(req.params.id), req.user, requestMeta(req)), 'Exam deleted successfully.')
);

module.exports = { list, options, getOne, create, update, setStatus, remove };