'use strict';

/**
 * JWT authentication middleware.
 *
 * Verifies the Bearer access token and attaches a minimal `req.user` object.
 * The login endpoint that issues these tokens arrives in Phase 5; the
 * middleware is complete and ready to protect routes.
 */

const jwt = require('jsonwebtoken');
const config = require('../config/environment');
const ApiError = require('../utils/ApiError');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

function verify(token) {
  return jwt.verify(token, config.jwt.secret, { algorithms: [config.jwt.algorithm] });
}

function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return next(ApiError.unauthorized('Authentication token is required.', { code: 'TOKEN_MISSING' }));
  }
  try {
    const payload = verify(token);
    req.user = {
      id: payload.sub,
      username: payload.username || null,
      role: payload.role || 'student',
      departmentId: payload.departmentId || null,
    };
    return next();
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError' ? 'Authentication token has expired.' : 'Invalid authentication token.';
    return next(ApiError.unauthorized(message, { code: 'TOKEN_INVALID' }));
  }
}

/** Same as authenticate but never fails; useful for optional personalization. */
function optionalAuthenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verify(token);
    req.user = {
      id: payload.sub,
      username: payload.username || null,
      role: payload.role || 'student',
      departmentId: payload.departmentId || null,
    };
  } catch (error) {
    // ignore invalid token on optional routes
  }
  return next();
}

module.exports = { authenticate, optionalAuthenticate, extractToken };
