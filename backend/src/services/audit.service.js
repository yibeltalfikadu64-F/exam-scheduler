'use strict';

/**
 * Best-effort audit trail (writes to `audit_logs`).
 *
 * Never throws: an audit failure (e.g. table missing) must not break the
 * business operation. Callers pass safe snapshots only — never password hashes.
 */

const database = require('../config/database');
const logger = require('../config/logger');

function clip(value, max) {
  if (value === undefined || value === null) return null;
  return String(value).slice(0, max);
}

async function record({ userId = null, action, entityType = null, entityId = null, before = null, after = null, ipAddress = null, userAgent = null }) {
  try {
    await database.getPool().query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, before_data, after_data, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        action,
        entityType,
        entityId,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        clip(ipAddress, 45),
        clip(userAgent, 300),
      ]
    );
  } catch (error) {
    logger.warn(`Audit log write failed for action "${action}": ${error.message}`);
  }
}

module.exports = { record };
