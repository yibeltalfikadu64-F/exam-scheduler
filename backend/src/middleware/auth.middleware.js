'use strict';

/**
 * JWT authentication middleware.
 *
 * Verifies the Bearer access token, then re-loads the account from the database
 * so that deactivated, deleted, or role-changed users lose access immediately
 * (enforcing account status during authenticated requests).
 */

const jwt = require('jsonwebtoken');
const config = require('../config/environment');
const database = require('../config/database');
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

async function loadCurrentUser(userId) {
  const [rows] = await database
    .getPool()
    .query('SELECT id, username, role, department_id, is_active FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1', [
      userId,
    ]);
  return rows[0] || null;
}

async function authenticate(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return next(ApiError.unauthorized('Authentication token is required.', { code: 'TOKEN_MISSING' }));
  }

  let payload;
  try {
    payload = verify(token);
  } catch (error) {
    const message =
      error.name === 'TokenExpiredError' ? 'Authentication token has expired.' : 'Invalid authentication token.';
    return next(ApiError.unauthorized(message, { code: 'TOKEN_INVALID' }));
  }

  try {
    const user = await loadCurrentUser(payload.sub);
    if (!user) {
      return next(ApiError.unauthorized('The account for this session no longer exists.', { code: 'ACCOUNT_NOT_FOUND' }));
    }
    if (!user.is_active) {
      return next(ApiError.forbidden('This account has been deactivated. Contact an administrator.', { code: 'ACCOUNT_INACTIVE' }));
    }
    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      departmentId: user.department_id || null,
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Same as authenticate but never fails — decodes the token only (no database
 * round-trip) for optional personalisation on public routes.
 */
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
