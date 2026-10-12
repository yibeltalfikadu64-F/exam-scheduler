'use strict';

/**
 * Invigilator-management controllers (Phase 6). Thin HTTP layer over
 * `invigilator.service`. Routes are authenticated; role checks live in
 * `invigilator.routes.js`.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const invigilatorService = require('../services/invigilator.service');

function parseId(raw, label = 'invigilator') {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest(`Invalid ${label} id.`, { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await invigilatorService.listInvigilators(req.validated.query, req.user), 'Invigilators retrieved successfully.')
);

const options = asyncHandler(async (req, res) => {
  const departmentId = req.user.role === 'department_head' ? req.user.departmentId : null;
  return ApiResponse.success(res, { invigilators: await invigilatorService.listOptions(departmentId) }, 'Invigilator options retrieved.');
});

const getOne = asyncHandler(async (req, res) => {
  const invigilator = await invigilatorService.getPublicById(parseId(req.params.id));
  if (!invigilator) throw ApiError.notFound('Invigilator not found.', { code: 'INVIGILATOR_NOT_FOUND' });
  return ApiResponse.success(res, { invigilator }, 'Invigilator retrieved successfully.');
});

const create = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { invigilator: await invigilatorService.createInvigilator(req.body, req.user, requestMeta(req)) }, 'Invigilator created successfully.', 201)
);

const update = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { invigilator: await invigilatorService.updateInvigilator(parseId(req.params.id), req.body, req.user, requestMeta(req)) }, 'Invigilator updated successfully.')
);

const setStatus = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { invigilator: await invigilatorService.setInvigilatorStatus(parseId(req.params.id), req.body.isActive, req.user, requestMeta(req)) },
    req.body.isActive ? 'Invigilator activated successfully.' : 'Invigilator deactivated successfully.'
  )
);

const remove = asyncHandler(async (req, res) => {
  const result = await invigilatorService.deleteInvigilator(parseId(req.params.id), req.user, requestMeta(req));
  return ApiResponse.success(res, result, 'Invigilator deleted successfully.');
});

const listAvailability = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { windows: await invigilatorService.listAvailability(parseId(req.params.id)) }, 'Availability retrieved successfully.')
);

const replaceAvailability = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { windows: await invigilatorService.replaceAvailability(parseId(req.params.id), req.body.windows, req.user, requestMeta(req)) },
    'Availability updated successfully.'
  )
);

module.exports = { list, options, getOne, create, update, setStatus, remove, listAvailability, replaceAvailability };
