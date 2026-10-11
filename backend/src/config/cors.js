'use strict';

/**
 * CORS configuration. Origins come from CORS_ORIGIN (comma-separated).
 * Requests with no Origin header (curl, Postman, server-to-server) are allowed.
 */

const config = require('./environment');
const ApiError = require('../utils/ApiError');

const corsOptions = {
  origin(origin, callback) {
    if (!origin || config.cors.origins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new ApiError(403, `Origin "${origin}" is not allowed by CORS`, { code: 'CORS_BLOCKED' }));
  },
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400,
};

module.exports = corsOptions;
