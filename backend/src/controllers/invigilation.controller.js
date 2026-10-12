'use strict';

/**
 * Invigilation controllers (Phase 6): settings, requirements, duties, roster,
 * auto-assignment and reports. Thin HTTP layer over `invigilation.service`.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const invigilationService = require('../services/invigilation.service');

function parseId(raw, label = 'resource') {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest(`Invalid ${label} id.`, { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

// Settings -------------------------------------------------------------------

const getSettings = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { settings: await invigilationService.getSettings() }, 'Invigilation settings retrieved.')
);

const updateSettings = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { settings: await invigilationService.updateSettings(req.body, req.user, requestMeta(req)) }, 'Invigilation settings updated.')
);

// Requirements ----------------------------------------------------------------

const listRequirements = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { requirements: await invigilationService.listRequirements() }, 'Invigilation requirements retrieved.')
);

const createRequirement = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { requirement: await invigilationService.createRequirement(req.body, req.user, requestMeta(req)) }, 'Requirement created.', 201)
);

const updateRequirement = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { requirement: await invigilationService.updateRequirement(parseId(req.params.id, 'requirement'), req.body, req.user, requestMeta(req)) }, 'Requirement updated.')
);

const removeRequirement = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await invigilationService.deleteRequirement(parseId(req.params.id, 'requirement'), req.user, requestMeta(req)), 'Requirement removed.')
);

// Duties ----------------------------------------------------------------------

const listDuties = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await invigilationService.listDuties(req.validated.query, req.user), 'Duties retrieved successfully.')
);

const getDuty = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { duty: await invigilationService.getDuty(parseId(req.params.id, 'duty')) }, 'Duty retrieved successfully.')
);

const getRoster = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await invigilationService.getRoster(req.validated.query, req.user), 'Roster retrieved successfully.')
);

const assign = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { duty: await invigilationService.assignDuty(req.body, req.user, requestMeta(req)) }, 'Invigilator assigned successfully.', 201)
);

const reassign = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { duty: await invigilationService.reassignDuty(parseId(req.params.id, 'duty'), req.body, req.user, requestMeta(req)) }, 'Duty reassigned successfully.')
);

const cancel = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { duty: await invigilationService.cancelDuty(parseId(req.params.id, 'duty'), req.user, requestMeta(req)) }, 'Duty cancelled successfully.')
);

const autoAssign = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await invigilationService.autoAssign(req.body, req.user, requestMeta(req)), 'Auto-assignment completed.')
);

// Reports ---------------------------------------------------------------------

const workload = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await invigilationService.workloadSummary(req.validated.query, req.user), 'Workload summary retrieved.')
);

const unfilled = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await invigilationService.unfilledReport(req.validated.query, req.user), 'Unfilled report generated.')
);

const conflicts = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await invigilationService.conflictReport(req.validated.query, req.user), 'Conflict report generated.')
);

// Roster publish --------------------------------------------------------------

const publish = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await invigilationService.publishRoster(req.body, req.user, requestMeta(req)), 'Roster published.')
);

const unpublish = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await invigilationService.unpublishRoster(req.body, req.user, requestMeta(req)), 'Roster unpublished.')
);

// Form options ----------------------------------------------------------------

const detailOptions = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { details: await invigilationService.listDetailOptions(req.validated.query, req.user) }, 'Assignable exam options retrieved.')
);

const eligibleInvigilators = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { invigilators: await invigilationService.listEligibleInvigilators(parseId(req.params.detailId, 'detail'), req.user) }, 'Eligible invigilators retrieved.')
);

module.exports = {
  getSettings,
  updateSettings,
  listRequirements,
  createRequirement,
  updateRequirement,
  removeRequirement,
  listDuties,
  getDuty,
  getRoster,
  assign,
  reassign,
  cancel,
  autoAssign,
  workload,
  unfilled,
  conflicts,
  publish,
  unpublish,
  detailOptions,
  eligibleInvigilators,
};