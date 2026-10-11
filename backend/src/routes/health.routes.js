'use strict';

const express = require('express');
const healthController = require('../controllers/health.controller');

const router = express.Router();

// GET /api/v1/health
router.get('/', healthController.getHealth);

module.exports = router;
