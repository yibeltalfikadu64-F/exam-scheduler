'use strict';

/**
 * Time slot controllers (Phase 4/5). Thin HTTP layer over timeSlot.service.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const timeSlotService = require('../services/timeSlot.service');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Invalid time slot id.', { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await timeSlotService.listTimeSlots(req.validated.query), 'Time slots retrieved successfully.')
);

const options = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { timeSlots: await timeSlotService.listActive() }, 'Time slot options retrieved.')
);

const getOne = asyncHandler(async (req, res) => {
  const slot = await timeSlotService.getPublicById(parseId(req.params.id));
  if (!slot) throw ApiError.notFound('Time slot not found.', { code: 'TIME_SLOT_NOT_FOUND' });
  return ApiResponse.success(res, { timeSlot: slot }, 'Time slot retrieved successfully.');
});

const create = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { timeSlot: await timeSlotService.createTimeSlot(req.body, req.user, requestMeta(req)) },
    'Time slot created successfully.',
    201
  )
);

const update = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { timeSlot: await timeSlotService.updateTimeSlot(parseId(req.params.id), req.body, req.user, requestMeta(req)) },
    'Time slot updated successfully.'
  )
);

const setStatus = asyncHandler(async (req, res) => {
  const slot = await timeSlotService.setTimeSlotStatus(parseId(req.params.id), req.body.isActive, req.user, requestMeta(req));
  return ApiResponse.success(
    res,
    { timeSlot: slot },
    req.body.isActive ? 'Time slot activated successfully.' : 'Time slot deactivated successfully.'
  );
});

const remove = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await timeSlotService.deleteTimeSlot(parseId(req.params.id), req.user, requestMeta(req)),
    'Time slot deleted successfully.'
  )
);

module.exports = { list, options, getOne, create, update, setStatus, remove };