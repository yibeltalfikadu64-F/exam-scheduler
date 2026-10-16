'use strict';

/**
 * Program controllers (Phase 3, module 2).
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const programService = require('../services/program.service');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Invalid program id.', { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await programService.listPrograms(req.validated.query), 'Programs retrieved successfully.')
);

const options = asyncHandler(async (req, res) => {
  const departmentId = Number(req.query.departmentId);
  const data = await programService.listOptions(Number.isInteger(departmentId) && departmentId > 0 ? departmentId : null);
  return ApiResponse.success(res, { programs: data }, 'Program options retrieved.');
});

const getOne = asyncHandler(async (req, res) => {
  const program = await programService.getPublicById(parseId(req.params.id));
  if (!program) throw ApiError.notFound('Program not found.', { code: 'PROGRAM_NOT_FOUND' });
  return ApiResponse.success(res, { program }, 'Program retrieved successfully.');
});

const create = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { program: await programService.createProgram(req.body, req.user, requestMeta(req)) },
    'Program created successfully.',
    201
  )
);

const update = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { program: await programService.updateProgram(parseId(req.params.id), req.body, req.user, requestMeta(req)) },
    'Program updated successfully.'
  )
);

const setStatus = asyncHandler(async (req, res) => {
  const program = await programService.setProgramStatus(parseId(req.params.id), req.body.isActive, req.user, requestMeta(req));
  return ApiResponse.success(
    res,
    { program },
    req.body.isActive ? 'Program activated successfully.' : 'Program deactivated successfully.'
  );
});

const remove = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await programService.deleteProgram(parseId(req.params.id), req.user, requestMeta(req)),
    'Program deleted successfully.'
  )
);

module.exports = { list, options, getOne, create, update, setStatus, remove };
