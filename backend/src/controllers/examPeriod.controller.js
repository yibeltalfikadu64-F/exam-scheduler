
'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const examPeriodService = require('../services/examPeriod.service');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest('Invalid exam period id.', { code: 'INVALID_ID' });
  }
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const list = asyncHandler(async (req, res) => {
  const result = await examPeriodService.listExamPeriods(
    req.validated?.query || req.query
  );

  return ApiResponse.success(
    res,
    {
      examPeriods: result.items,
      items: result.items,
      pagination: result.pagination,
    },
    'Exam periods retrieved successfully.'
  );
});

const options = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { examPeriods: await examPeriodService.listOptions() }, 'Exam period options retrieved successfully.')
);

const getOne = asyncHandler(async (req, res) => {
  const examPeriod = await examPeriodService.getExamPeriodById(parseId(req.params.id));
  return ApiResponse.success(res, { examPeriod }, 'Exam period retrieved successfully.');
});

const dependencies = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await examPeriodService.getDependencies(parseId(req.params.id)), 'Exam period dependencies retrieved successfully.')
);

const create = asyncHandler(async (req, res) => {
  const examPeriod = await examPeriodService.createExamPeriod(req.body, req.user, requestMeta(req));
  return ApiResponse.success(res, { examPeriod }, 'Exam period created successfully.', 201);
});

const update = asyncHandler(async (req, res) => {
  const examPeriod = await examPeriodService.updateExamPeriod(parseId(req.params.id), req.body, req.user, requestMeta(req));
  return ApiResponse.success(res, { examPeriod }, 'Exam period updated successfully.');
});

const setStatus = asyncHandler(async (req, res) => {
  const examPeriod = await examPeriodService.setExamPeriodStatus(parseId(req.params.id), req.body.status, req.user, requestMeta(req));
  return ApiResponse.success(res, { examPeriod }, 'Exam period status updated successfully.');
});

const remove = asyncHandler(async (req, res) => {
  const result = await examPeriodService.deleteExamPeriod(parseId(req.params.id), req.user, requestMeta(req));
  return ApiResponse.success(res, result, 'Exam period deleted successfully.');
});

module.exports = {
  list,
  options,
  getOne,
  dependencies,
  create,
  update,
  setStatus,
  remove,
};
