
'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const examPeriodService = require('../services/examPeriod.service');

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

const getOne = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest('Invalid exam period id.', {
      code: 'INVALID_ID',
    });
  }

  const examPeriod = await examPeriodService.getExamPeriodById(id);

  return ApiResponse.success(
    res,
    { examPeriod },
    'Exam period retrieved successfully.'
  );
});

module.exports = {
  list,
  getOne,
};
