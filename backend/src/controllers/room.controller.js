'use strict';

/**
 * Room + room-closure controllers (Phase 4). Thin HTTP layer over room.service.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const roomService = require('../services/room.service');

function parseId(raw, label = 'room') {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest(`Invalid ${label} id.`, { code: 'INVALID_ID' });
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await roomService.listRooms(req.validated.query), 'Rooms retrieved successfully.')
);

const options = asyncHandler(async (req, res) => {
  const query = req.query || {};
  const rooms = await roomService.listOptions({
    buildingId: query.buildingId ? Number(query.buildingId) : null,
    type: query.type || null,
    minCapacity: query.minCapacity ? Number(query.minCapacity) : null,
  });
  return ApiResponse.success(res, { rooms }, 'Room options retrieved.');
});

const getOne = asyncHandler(async (req, res) => {
  const room = await roomService.getPublicById(parseId(req.params.id));
  if (!room) throw ApiError.notFound('Room not found.', { code: 'ROOM_NOT_FOUND' });
  return ApiResponse.success(res, { room }, 'Room retrieved successfully.');
});

const create = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { room: await roomService.createRoom(req.body, req.user, requestMeta(req)) }, 'Room created successfully.', 201)
);

const update = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { room: await roomService.updateRoom(parseId(req.params.id), req.body, req.user, requestMeta(req)) },
    'Room updated successfully.'
  )
);

const setStatus = asyncHandler(async (req, res) => {
  const room = await roomService.setRoomStatus(parseId(req.params.id), req.body.isActive, req.user, requestMeta(req));
  return ApiResponse.success(res, { room }, req.body.isActive ? 'Room activated successfully.' : 'Room deactivated successfully.');
});

const remove = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await roomService.deleteRoom(parseId(req.params.id), req.user, requestMeta(req)), 'Room deleted successfully.')
);

// --- closures (nested) ---

const listClosures = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { closures: await roomService.listClosures(parseId(req.params.id)) }, 'Room closures retrieved.')
);

const createClosure = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    { closure: await roomService.createClosure(parseId(req.params.id), req.body, req.user, requestMeta(req)) },
    'Room closure created successfully.',
    201
  )
);

const updateClosure = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    {
      closure: await roomService.updateClosure(
        parseId(req.params.id),
        parseId(req.params.closureId, 'closure'),
        req.body,
        req.user,
        requestMeta(req)
      ),
    },
    'Room closure updated successfully.'
  )
);

const removeClosure = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await roomService.deleteClosure(parseId(req.params.id), parseId(req.params.closureId, 'closure'), req.user, requestMeta(req)),
    'Room closure deleted successfully.'
  )
);

module.exports = {
  list,
  options,
  getOne,
  create,
  update,
  setStatus,
  remove,
  listClosures,
  createClosure,
  updateClosure,
  removeClosure,
};
