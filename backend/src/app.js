'use strict';

/**
 * Express application wiring.
 *
 * Middleware order matters:
 *   helmet -> cors -> compression -> body parsers -> logging -> rate limit
 *   -> routes -> 404 -> central error handler
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config/environment');
const logger = require('./config/logger');
const corsOptions = require('./config/cors');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security headers
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

// CORS (explicit allow-list from CORS_ORIGIN)
app.use(cors(corsOptions));

// Response compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging
if (config.logLevel !== 'silent' && config.logLevel !== 'error') {
  app.use(morgan(config.isProduction ? 'combined' : 'dev', { stream: logger.stream }));
}

// Rate limiting for the API surface
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again later.',
  },
});
app.use(config.apiPrefix, apiLimiter);

// Root convenience response
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: `${config.appName} is running.`,
    data: { health: `${config.apiPrefix}/health` },
  });
});

// API routes
app.use(config.apiPrefix, routes);

// 404 + centralized errors (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
