'use strict';

/**
 * System settings routes, mounted at /api/v1/settings.
 *
 * Read: any authenticated user may read the full catalogue (the admin UI needs
 * it) plus the public subset. Write: administrators only, enforced server-side.
 */

const express = require('express');

const settingsController = require('../controllers/settings.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateUpdateSettings } = require('../validators/settings.validator');

const router = express.Router();

router.use(authenticate);

router.get('/public', settingsController.publicSettings);
router.get('/', settingsController.list);

router.put('/', authorize('admin'), validate(validateUpdateSettings), settingsController.update);

module.exports = router;
