'use strict';

/**
 * System operational data reset service.
 *
 * Only approved operational tables may be cleared.
 * Deletions run in a transaction and the audit entry is
 * written using the same transaction connection.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');

const APPROVED_TABLES = Object.freeze([
  'invigilations',
  'schedule_conflicts',
  'exam_schedule_details',
  'exam_schedules',
  'exams',
]);

const DELETE_ORDER = Object.freeze([
  'invigilations',
  'schedule_conflicts',
  'exam_schedule_details',
  'exam_schedules',
  'exams',
]);

/**
 * Count records in the approved operational tables.
 * This function performs SELECT queries only.
 */
async function countRows(connection = null) {
  const conn = connection || database.getPool();
  const counts = {};

  for (const table of APPROVED_TABLES) {
    const [rows] = await conn.query(
      `SELECT COUNT(*) AS count FROM \`${table}\``
    );

    counts[table] = Number(rows[0].count || 0);
  }

  return counts;
}

/**
 * Preview the operational data that would be affected.
 */
async function previewReset() {
  return {
    counts: await countRows(),
    scope: APPROVED_TABLES,
  };
}

/**
 * Execute the operational reset.
 *
 * WARNING: This function deletes data. Do not call it during
 * syntax checks or ordinary development troubleshooting.
 */
async function executeReset({ confirm, actor, meta }) {
  if (confirm !== 'RESET OPERATIONAL DATA') {
    throw ApiError.badRequest(
      'Confirmation must be exactly "RESET OPERATIONAL DATA".',
      { code: 'VALIDATION_ERROR' }
    );
  }

  const connection = await database.getPool().getConnection();

  try {
    await connection.beginTransaction();

    const beforeCounts = await countRows(connection);
    const deletedCounts = {};

    for (const table of DELETE_ORDER) {
      const [result] = await connection.query(
        `DELETE FROM \`${table}\``
      );

      deletedCounts[table] = result.affectedRows || 0;
    }

    await connection.query(
      `INSERT INTO audit_logs
        (user_id, action, entity_type, entity_id,
         before_data, after_data, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actor ? actor.id : null,
        'system.reset',
        'system',
        null,
        JSON.stringify({ counts: beforeCounts }),
        JSON.stringify({
          cleared: true,
          scope: APPROVED_TABLES,
          deletedCounts,
        }),
        meta && meta.ip ? String(meta.ip).slice(0, 45) : null,
        meta && meta.userAgent
          ? String(meta.userAgent).slice(0, 300)
          : null,
      ]
    );

    await connection.commit();

    return {
      success: true,
      scope: APPROVED_TABLES,
      deletedCounts,
      beforeCounts,
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Preserve the original error.
    }

    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  previewReset,
  executeReset,
};
