'use strict';

/**
 * Scheduling controllers (Phase 5). Thin HTTP layer over scheduling.service.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const schedulingService = require('../services/scheduling.service');

function parseId(raw, label = 'schedule') {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest(`Invalid ${label} id.`, { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const preview = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await schedulingService.generatePreview({
      examPeriodId: req.validated.body.examPeriodId,
      expectedCandidates: req.validated.body.expectedCandidates,
      actor: req.user,
    }),
    'Timetable preview generated.'
  )
);

const listSchedules = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await schedulingService.listSchedules(req.validated.query), 'Schedules retrieved successfully.')
);

const getSchedule = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await schedulingService.getSchedule(parseId(req.params.id), req.user), 'Schedule retrieved successfully.')
);

const validateScheduleById = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await schedulingService.validateSchedule(parseId(req.params.id), req.user), 'Schedule validated.')
);

const saveDraft = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await schedulingService.saveDraft(req.body, req.user, requestMeta(req)), 'Draft timetable saved.', 201)
);

const publish = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await schedulingService.publishSchedule(parseId(req.params.id), req.user, requestMeta(req)), 'Schedule published.')
);

const cancel = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await schedulingService.cancelSchedule(parseId(req.params.id), req.user, requestMeta(req)), 'Schedule cancelled.')
);

const addDetail = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await schedulingService.addScheduleDetail(parseId(req.params.id, 'schedule'), req.body, req.user, requestMeta(req)),
    'Exam assigned successfully.',
    201
  )
);

const reschedule = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await schedulingService.updateScheduleDetail(parseId(req.params.detailId, 'detail'), req.body, req.user, requestMeta(req)),
    'Schedule entry updated successfully.'
  )
);

const removeDetail = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await schedulingService.deleteScheduleDetail(parseId(req.params.detailId, 'detail'), req.user, requestMeta(req)),
    'Schedule entry removed successfully.'
  )
);

module.exports = { preview, listSchedules, getSchedule, validateScheduleById, saveDraft, publish, cancel, addDetail, reschedule, removeDetail };