'use strict';

/**
 * System reset routes, mounted at /api/v1/system/reset (or can also mount under settings).
 * Admin only for both preview and execution.
 */

const express = require('express');

const systemResetController = require('../controllers/systemReset.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateResetExecution } = require('../validators/reset.validator');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/preview', systemResetController.preview);
router.post('/execute', validate(validateResetExecution), systemResetController.execute);

module.exports = router;
