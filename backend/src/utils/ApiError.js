'use strict';

/**
 * Operational error with an HTTP status code and optional machine-readable code.
 * Throw these from anywhere; the central error handler turns them into JSON.
 */
class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code || null;
    this.details = options.details || null;
    this.isOperational = options.isOperational !== undefined ? options.isOperational : true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', options) {
    return new ApiError(400, message, options);
  }

  static unauthorized(message = 'Unauthorized', options) {
    return new ApiError(401, message, options);
  }

  static forbidden(message = 'Forbidden', options) {
    return new ApiError(403, message, options);
  }

  static notFound(message = 'Resource not found', options) {
    return new ApiError(404, message, options);
  }

  static conflict(message = 'Conflict', options) {
    return new ApiError(409, message, options);
  }

  static unprocessable(message = 'Unprocessable entity', options) {
    return new ApiError(422, message, options);
  }

  static internal(message = 'Internal server error', options) {
    return new ApiError(500, message, options);
  }

  static serviceUnavailable(message = 'Service unavailable', options) {
    return new ApiError(503, message, options);
  }
}

module.exports = ApiError;
