'use strict';

/**
 * MySQL / MariaDB connection pool built on mysql2/promise.
 *
 * - One shared pool for the whole process.
 * - `testConnection()` for startup checks.
 * - `healthCheck()` returns a safe, secret-free status object for /health.
 * - `closePool()` for graceful shutdown.
 */

const mysql = require('mysql2/promise');
const config = require('./environment');
const logger = require('./logger');

let pool = null;

function createPool() {
  logger.debug(`Creating MySQL pool for ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`);
  pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: config.db.connectionLimit,
    queueLimit: config.db.queueLimit,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    // DATE has no time component; return it as 'YYYY-MM-DD' instead of a Date
    // (which would be shifted by the timezone). DATETIME/TIMESTAMP stay as Date.
    dateStrings: ['DATE'],
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    decimalNumbers: true,
  });
  return pool;
}

function getPool() {
  if (!pool) createPool();
  return pool;
}

/** Throws if the database cannot be reached. */
async function testConnection() {
  const connection = await getPool().getConnection();
  try {
    await connection.query('SELECT 1');
    return true;
  } finally {
    connection.release();
  }
}

/** Never throws. Returns { connected, ... } for the health endpoint. */
async function healthCheck() {
  const startedAt = Date.now();
  try {
    const connection = await getPool().getConnection();
    try {
      const [rows] = await connection.query('SELECT DATABASE() AS db, VERSION() AS version');
      return {
        connected: true,
        database: rows[0].db,
        version: rows[0].version,
        latencyMs: Date.now() - startedAt,
      };
    } finally {
      connection.release();
    }
  } catch (error) {
    return {
      connected: false,
      database: config.db.database,
      version: null,
      latencyMs: Date.now() - startedAt,
      error: error.code || error.message,
    };
  }
}

async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
  logger.debug('MySQL pool closed.');
}

/**
 * Run `handler(connection)` inside a database transaction.
 * Commits on success, rolls back on any thrown error, always releases the
 * connection. Use for multi-statement writes that must stay consistent.
 */
async function withTransaction(handler) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      logger.warn(`Transaction rollback failed: ${rollbackError.message}`);
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createPool,
  getPool,
  testConnection,
  healthCheck,
  closePool,
  withTransaction,
};
