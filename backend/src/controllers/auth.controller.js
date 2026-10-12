'use strict';

/**
 * Authentication controllers. Thin HTTP layer over `auth.service`.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const authService = require('../services/auth.service');

/**
 * POST /api/v1/auth/login
 * Body: { identifier | username | email, password }
 * Returns: { token, tokenType, expiresIn, user }
 */
const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  const result = await authService.login(identifier, password);
  return ApiResponse.success(res, result, 'Signed in successfully.');
});

/**
 * GET /api/v1/auth/me
 * Requires a valid Bearer token (enforced by `authenticate`).
 */
const me = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.id);
  return ApiResponse.success(res, { user }, 'Authenticated user profile retrieved.');
});

/**
 * POST /api/v1/auth/logout
 *
 * Sessions are stateless JWTs: the server keeps no session to destroy, so the
 * client simply discards the token. This endpoint exists as a single,
 * consistent place to end a session and to allow future token revocation.
 */
const logout = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, { loggedOut: true }, 'Signed out.');
});

module.exports = { login, me, logout };
