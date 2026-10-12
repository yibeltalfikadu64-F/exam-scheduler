'use strict';

/**
 * Building controllers (Phase 4). Thin HTTP layer over building.service.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const buildingService = require('../services/building.service');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest('Invalid building id.', { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await buildingService.listBuildings(req.validated.query), 'Buildings retrieved successfully.')
);

const options = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { buildings: await buildingService.listOptions() }, 'Building options retrieved.')
);

const getOne = asyncHandler(async (req, res) => {
  const building = await buildingService.getPublicById(parseId(req.params.id));
  if (!building) throw ApiError.notFound('Building not found.', { code: 'BUILDING_NOT_FOUND' });
  return ApiResponse.success(res, { building }, 'Building retrieved successfully.');
});

const create = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { building: await buildingService.createBuilding(req.body, req.user, requestMeta(req)) },
    'Building created successfully.',
    201
  )
);

const update = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { building: await buildingService.updateBuilding(parseId(req.params.id), req.body, req.user, requestMeta(req)) },
    'Building updated successfully.'
  )
);

const setStatus = asyncHandler(async (req, res) => {
  const building = await buildingService.setBuildingStatus(parseId(req.params.id), req.body.isActive, req.user, requestMeta(req));
  return ApiResponse.success(
    res,
    { building },
    req.body.isActive ? 'Building activated successfully.' : 'Building deactivated successfully.'
  );
});

const remove = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await buildingService.deleteBuilding(parseId(req.params.id), req.user, requestMeta(req)), 'Building deleted successfully.')
);

module.exports = { list, options, getOne, create, update, setStatus, remove };
