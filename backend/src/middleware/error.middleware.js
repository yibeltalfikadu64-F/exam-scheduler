'use strict';

/**
 * Centralized error handling. Every unexpected error passes through here and
 * becomes a consistent JSON response. Known MySQL error codes are mapped to
 * sensible HTTP statuses; 5xx detail is hidden in production.
 */

const ApiError = require('../utils/ApiError');
const config = require('../config/environment');
const logger = require('../config/logger');

function mapKnownError(error) {
  if (error instanceof ApiError) return error;

  switch (error && error.code) {
    case 'ER_DUP_ENTRY':
      return new ApiError(409, 'A record with these unique values already exists.', {
        code: 'DUPLICATE_ENTRY',
      });
    case 'ER_NO_REFERENCED_ROW_2':
    case 'ER_ROW_IS_REFERENCED_2':
      return new ApiError(409, 'The operation violates a database relationship constraint.', {
        code: 'RELATIONSHIP_CONSTRAINT',
      });
    case 'ECONNREFUSED':
    case 'PROTOCOL_CONNECTION_LOST':
    case 'ER_ACCESS_DENIED_ERROR':
      return new ApiError(503, 'The database is currently unavailable.', {
        code: 'DATABASE_UNAVAILABLE',
        isOperational: true,
      });
    case 'ER_BAD_DB_ERROR':
      return new ApiError(503, `Database "${config.db.database}" does not exist. Run "npm run db:create" and "npm run db:migrate".`, {
        code: 'DATABASE_NOT_INITIALIZED',
      });
    default:
      break;
  }

  // SyntaxError from express.json() on malformed bodies
  if (error && error.type === 'entity.parse.failed') {
    return new ApiError(400, 'Request body contains invalid JSON.', { code: 'INVALID_JSON' });
  }

  return new ApiError(error.statusCode || error.status || 500, error.message || 'Internal server error', {
    code: error.code || null,
    isOperational: false,
  });
}

function notFoundHandler(req, res, next) {
  next(
    new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, {
      code: 'ROUTE_NOT_FOUND',
    })
  );
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const error = mapKnownError(err);

  if (error.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${error.statusCode} ${error.message}`);
    if (!config.isProduction && err && err.stack) logger.debug(err.stack);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${error.statusCode} ${error.message}`);
  }

  const body = {
    success: false,
    message: error.statusCode >= 500 && config.isProduction ? 'Internal server error' : error.message,
    meta: { timestamp: new Date().toISOString(), path: req.originalUrl },
  };
  if (error.code) body.code = error.code;
  if (error.details) body.details = error.details;

  if (res.headersSent) return next(error);
  return res.status(error.statusCode).json(body);
}

module.exports = { notFoundHandler, errorHandler, mapKnownError };
