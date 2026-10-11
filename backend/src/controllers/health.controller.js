'use strict';

const config = require('../config/environment');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const healthService = require('../services/health.service');

/**
 * GET /api/v1/health
 * Reports application status and database connectivity.
 * Never exposes secrets (no credentials, hosts, or connection strings).
 */
const getHealth = asyncHandler(async (req, res) => {
  const { healthy, database } = await healthService.getStatus();

  const payload = {
    status: healthy ? 'ok' : 'degraded',
    application: {
      name: config.appName,
      version: config.version,
      environment: config.env,
      uptimeSeconds: Math.round(process.uptime()),
    },
    database: {
      connected: database.connected,
      name: database.database || null,
      version: database.version || null,
      latencyMs: database.latencyMs,
      error: database.error || null,
    },
    timestamp: new Date().toISOString(),
  };

  return ApiResponse.success(
    res,
    payload,
    healthy ? 'Service is healthy.' : 'Service is running but the database is unavailable.',
    healthy ? 200 : 503
  );
});

module.exports = { getHealth };
