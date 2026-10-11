'use strict';

/**
 * Centralized environment configuration.
 *
 * Loads `.env` and validates the variables the application cannot start
 * without. Kept dependency-free (except dotenv) so it can be required by
 * every other module without circular imports.
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toList(value, fallback) {
  const source = value && value.trim() ? value : fallback;
  return source
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const config = {
  env: nodeEnv,
  isProduction,
  port: toInt(process.env.PORT, 5000),
  host: process.env.HOST || '0.0.0.0',
  appName: process.env.APP_NAME || 'Exam Scheduler API',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  version: require('../../package.json').version,

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'exam_app',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'exam_scheduler_db',
    connectionLimit: toInt(process.env.DB_POOL_SIZE, 10),
    queueLimit: 0,
  },

  // Privileged account, used ONLY by `npm run db:create`.
  dbAdmin: {
    user: process.env.DB_ADMIN_USER || 'root',
    password: process.env.DB_ADMIN_PASSWORD || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
  },

  bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 10),

  cors: {
    origins: toList(process.env.CORS_ORIGIN, 'http://localhost:5173'),
    credentials: true,
  },

  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: toInt(process.env.RATE_LIMIT_MAX_REQUESTS, 300),
  },

  logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@exam-scheduler.local',
    adminUsername: process.env.SEED_ADMIN_USERNAME || 'admin',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
  },
};

const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-change-me';

/**
 * Validate required variables and fail fast with a clear, actionable message.
 * In non-production a missing JWT secret falls back to a development-only value
 * so the app can boot, but a loud warning is printed.
 */
function validateEnv() {
  const problems = [];

  const required = ['DB_NAME', 'DB_USER'];
  required.forEach((key) => {
    if (!process.env[key]) problems.push(`Missing required environment variable: ${key}`);
  });

  if (!process.env.JWT_SECRET) {
    if (isProduction) {
      problems.push('Missing required environment variable: JWT_SECRET');
    } else {
      config.jwt.secret = DEV_FALLBACK_SECRET;
      // eslint-disable-next-line no-console
      console.warn(
        '[env] JWT_SECRET is not set. Using an insecure development-only fallback. ' +
          'Set JWT_SECRET in backend/.env before deploying.'
      );
    }
  } else if (isProduction && config.jwt.secret.length < 32) {
    problems.push('JWT_SECRET must be at least 32 characters in production.');
  }

  if (!config.db.password) {
    // eslint-disable-next-line no-console
    console.warn('[env] DB_PASSWORD is empty. This is only acceptable for a local server with no password.');
  }

  if (problems.length > 0) {
    const message = ['Invalid environment configuration:', ...problems.map((p) => `  - ${p}`)].join('\n');
    throw new Error(message);
  }

  return config;
}

module.exports = config;
module.exports.validateEnv = validateEnv;
