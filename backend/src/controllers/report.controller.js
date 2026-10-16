'use strict';

/**
 * Reports & analytics controllers (Phase 7).
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const reportService = require('../services/report.service');

const overview = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await reportService.getOverview(req.validated.query), 'Report overview retrieved.')
);

const examLoad = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { items: await reportService.getExamLoad(req.validated.query) }, 'Exam load retrieved.')
);

const roomUtilization = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { items: await reportService.getRoomUtilization() }, 'Room utilization retrieved.')
);

const conflicts = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await reportService.getConflicts(req.validated.query), 'Conflict report retrieved.')
);

const invigilation = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await reportService.getInvigilationWorkload(req.validated.query), 'Invigilation report retrieved.')
);

const summary = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await reportService.getSummary(req.validated.query), 'Report summary retrieved.')
);

module.exports = { overview, examLoad, roomUtilization, conflicts, invigilation, summary };
