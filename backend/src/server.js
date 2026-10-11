'use strict';

/**
 * Server bootstrap.
 *
 * - Validates environment before anything else.
 * - Verifies database connectivity (warns instead of crashing so /health can
 *   report the problem).
 * - Starts listening.
 * - Handles SIGINT/SIGTERM, unhandledRejection, and uncaughtException.
 */

const config = require('./config/environment');

// Fail fast on invalid config, before requiring the rest of the app.
config.validateEnv();

const app = require('./app');
const logger = require('./config/logger');
const database = require('./config/database');

let server = null;
let shuttingDown = false;

async function start() {
  try {
    await database.testConnection();
    logger.info(`Connected to database "${config.db.database}" at ${config.db.host}:${config.db.port}`);
  } catch (error) {
    logger.error(`Cannot connect to database "${config.db.database}" at ${config.db.host}:${config.db.port}`);
    logger.error(`  ${error.code ? `${error.code}: ` : ''}${error.message}`);
    logger.warn('Starting API anyway. GET /api/v1/health will report the database as unavailable.');
    logger.warn('Run "npm run db:create" and "npm run db:migrate" (see backend/.env).');
  }

  server = app.listen(config.port, config.host, () => {
    logger.info(`${config.appName} v${config.version} [${config.env}]`);
    logger.info(`Listening on http://${config.host}:${config.port}${config.apiPrefix}`);
    logger.info(`Health check: http://localhost:${config.port}${config.apiPrefix}/health`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} is already in use. Stop the other process or change PORT in backend/.env.`);
    } else {
      logger.error('Server error:', error);
    }
    process.exit(1);
  });
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn(`Received ${signal}. Shutting down gracefully...`);

  const closeServer = () =>
    new Promise((resolve) => {
      if (!server) return resolve();
      server.close(() => resolve());
    });

  try {
    await closeServer();
    await database.closePool();
    logger.info('Shutdown complete.');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason instanceof Error ? reason.stack : reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error.stack || error.message);
  shutdown('uncaughtException');
});

start();
