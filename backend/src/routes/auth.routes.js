'use strict';

/**
 * Authentication routes, mounted at /api/v1/auth by routes/index.js.
 *
 *   POST /api/v1/auth/login    public  (rate limited + validated)
 *   GET  /api/v1/auth/me       authenticated
 *   POST /api/v1/auth/logout   authenticated
 */

const express = require('express');

const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateLogin } = require('../validators/auth.validator');
const { loginLimiter } = require('../middleware/rateLimit.middleware');

const router = express.Router();

router.post('/login', loginLimiter, validate(validateLogin), authController.login);
router.get('/me', authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);

module.exports = router;
