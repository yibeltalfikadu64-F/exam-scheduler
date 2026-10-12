'use strict';

/**
 * Schedule constraint controllers (Phase 5). Thin HTTP layer over
 * scheduleConstraint.service.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const scheduleConstraintService = require('../services/scheduleConstraint.service');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Invalid constraint id.', { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await scheduleConstraintService.listConstraints(req.validated.query), 'Schedule constraints retrieved successfully.')
);

const getOne = asyncHandler(async (req, res) => {
  const constraint = await scheduleConstraintService.getPublicById(parseId(req.params.id));
  if (!constraint) throw ApiError.notFound('Schedule constraint not found.', { code: 'CONSTRAINT_NOT_FOUND' });
  return ApiResponse.success(res, { constraint }, 'Schedule constraint retrieved successfully.');
});

const update = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    {
      constraint: await scheduleConstraintService.updateConstraint(
        parseId(req.params.id),
        req.body,
        req.user,
        requestMeta(req)
      ),
    },
    'Schedule constraint updated successfully.'
  )
);

module.exports = { list, getOne, update };