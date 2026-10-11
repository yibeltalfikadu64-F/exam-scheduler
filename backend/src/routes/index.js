'use strict';

/**
 * API v1 router. Feature routers are mounted here as phases are completed.
 */

const express = require('express');
const config = require('../config/environment');
const healthRoutes = require('./health.routes');

const router = express.Router();

// GET /api/v1
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: `${config.appName} v${config.version}`,
    data: {
      version: 'v1',
      endpoints: {
        health: `${config.apiPrefix}/health`,
      },
    },
    meta: { timestamp: new Date().toISOString() },
  });
});

router.use('/health', healthRoutes);

module.exports = router;
