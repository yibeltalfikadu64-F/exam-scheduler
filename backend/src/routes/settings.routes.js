'use strict';

/**
 * System settings routes, mounted at /api/v1/settings.
 * Read: any authenticated user. Write/admin actions: administrators only.
 */

const express = require('express');

const settingsController = require('../controllers/settings.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateUpdateSettings } = require('../validators/settings.validator');
const { validateResetExecution } = require('../validators/reset.validator');

const router = express.Router();

router.use(authenticate);

router.get('/public', settingsController.publicSettings);
router.get('/', settingsController.list);

router.put('/', authorize('admin'), validate(validateUpdateSettings), settingsController.update);
router.get('/reset/preview', authorize('admin'), settingsController.resetPreview);
router.post('/reset/execute', authorize('admin'), validate(validateResetExecution), settingsController.resetExecute);

module.exports = router;
