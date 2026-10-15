
'use strict';

/**
 * Centralized environment configuration.
 *
 * Loads backend/.env and validates required environment variables.
 */

const path = require('path');
const dotenv = require('dotenv');

// environment.js is located at backend/src/config/environment.js.
// ../../.env correctly resolves to backend/.env.
const envPath = path.resolve(__dirname, '../../.env');
const dotenvResult = dotenv.config({ path: envPath });

if (dotenvResult.error) {
  console.warn(`[env] Could not load environment file: ${envPath}`);
  console.warn(`[env] ${dotenvResult.error.message}`);
}

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

  // Privileged account used only by npm run db:create.
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
    origins: toList(
      process.env.CORS_ORIGIN,
      'http://localhost:5173'
    ),
    credentials: true,
  },

  rateLimit: {
    windowMs: toInt(
      process.env.RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000
    ),
    max: toInt(process.env.RATE_LIMIT_MAX_REQUESTS, 300),
  },

  // Stricter limits for login endpoints.
  auth: {
    loginWindowMs: toInt(
      process.env.AUTH_LOGIN_WINDOW_MS,
      15 * 60 * 1000
    ),
    loginMaxAttempts: toInt(
      process.env.AUTH_LOGIN_MAX_ATTEMPTS,
      10
    ),
  },

  logLevel:
    process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // Optional email configuration.
  mail: {
    enabled: process.env.MAIL_ENABLED === 'true',
    host: process.env.SMTP_HOST || '',
    port: toInt(process.env.SMTP_PORT, 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    fromName: process.env.MAIL_FROM_NAME || 'Exam Scheduler',
    fromAddress:
      process.env.MAIL_FROM_ADDRESS ||
      'no-reply@exam-scheduler.local',
  },

  // Notification queue configuration.
  notifications: {
    maxRetries: toInt(
      process.env.NOTIFICATION_MAX_RETRIES,
      3
    ),
    retryBackoffMinutes: toInt(
      process.env.NOTIFICATION_RETRY_BACKOFF_MINUTES,
      15
    ),
    dispatchBatchSize: toInt(
      process.env.NOTIFICATION_DISPATCH_BATCH_SIZE,
      50
    ),
  },

  seed: {
    adminEmail:
      process.env.SEED_ADMIN_EMAIL ||
      'admin@exam-scheduler.local',
    adminUsername: process.env.SEED_ADMIN_USERNAME || 'admin',
    adminPassword:
      process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
  },
};

const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-change-me';

/**
 * Validate required environment variables.
 */
function validateEnv() {
  const problems = [];

  const required = ['DB_NAME', 'DB_USER'];

  for (const key of required) {
    if (!process.env[key] || !process.env[key].trim()) {
      problems.push(
        `Missing required environment variable: ${key}`
      );
    }
  }

  if (!process.env.JWT_SECRET) {
    if (isProduction) {
      problems.push(
        'Missing required environment variable: JWT_SECRET'
      );
    } else {
      config.jwt.secret = DEV_FALLBACK_SECRET;

      console.warn(
        '[env] JWT_SECRET is not set. Using a development-only fallback. ' +
        'Set JWT_SECRET in backend/.env before deployment.'
      );
    }
  } else if (isProduction && config.jwt.secret.length < 32) {
    problems.push(
      'JWT_SECRET must be at least 32 characters in production.'
    );
  }

  if (!config.db.password) {
    console.warn(
      '[env] DB_PASSWORD is empty. This is acceptable only if ' +
      'your local MySQL account does not require a password.'
    );
  }

  if (problems.length > 0) {
    const message = [
      'Invalid environment configuration:',
      ...problems.map((problem) => `  - ${problem}`),
    ].join('\n');

    throw new Error(message);
  }

  return config;
}

module.exports = config;
module.exports.validateEnv = validateEnv;
