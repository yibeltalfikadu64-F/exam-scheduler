'use strict';

/**
 * Credential-endpoint rate limiting.
 *
 * Kept stricter than the global API limiter so brute-force attempts against
 * /auth/login are throttled per client IP. Disabled under NODE_ENV=test so the
 * automated suite is never throttled.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config/environment');

const loginLimiter = rateLimit({
  windowMs: config.auth.loginWindowMs,
  limit: config.auth.loginMaxAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.env === 'test',
  message: {
    success: false,
    message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
  },
});

module.exports = { loginLimiter };
