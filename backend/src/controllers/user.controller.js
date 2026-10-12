'use strict';

/**
 * User-management controllers. Thin HTTP layer over `user.service`.
 * Every route is authenticated + admin-only (see routes/user.routes.js).
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const userService = require('../services/user.service');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw ApiError.badRequest('Invalid user id.', { code: 'INVALID_ID' });
  }
  return id;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

/** GET /api/v1/users */
const list = asyncHandler(async (req, res) => {
  const result = await userService.listUsers(req.validated.query);
  return ApiResponse.success(res, result, 'Users retrieved successfully.');
});

/** GET /api/v1/users/options */
const options = asyncHandler(async (req, res) => {
  const data = await userService.listOptions();
  return ApiResponse.success(res, data, 'User form options retrieved.');
});

/** GET /api/v1/users/:id */
const getOne = asyncHandler(async (req, res) => {
  const user = await userService.getPublicById(parseId(req.params.id));
  if (!user) throw ApiError.notFound('User not found.', { code: 'USER_NOT_FOUND' });
  return ApiResponse.success(res, { user }, 'User retrieved successfully.');
});

/** POST /api/v1/users */
const create = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body, req.user, requestMeta(req));
  return ApiResponse.success(res, { user }, 'User created successfully.', 201);
});

/** PATCH /api/v1/users/:id */
const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(parseId(req.params.id), req.body, req.user, requestMeta(req));
  return ApiResponse.success(res, { user }, 'User updated successfully.');
});

/** PATCH /api/v1/users/:id/status */
const setStatus = asyncHandler(async (req, res) => {
  const user = await userService.setUserStatus(parseId(req.params.id), req.body.isActive, req.user, requestMeta(req));
  return ApiResponse.success(
    res,
    { user },
    req.body.isActive ? 'User activated successfully.' : 'User deactivated successfully.'
  );
});

/** POST /api/v1/users/:id/reset-password */
const resetPassword = asyncHandler(async (req, res) => {
  const user = await userService.resetPassword(parseId(req.params.id), req.body.newPassword, req.user, requestMeta(req));
  return ApiResponse.success(res, { user }, 'Password reset successfully.');
});

module.exports = { list, options, getOne, create, update, setStatus, resetPassword };
