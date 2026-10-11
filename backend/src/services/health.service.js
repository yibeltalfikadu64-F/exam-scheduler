'use strict';

const database = require('../config/database');

/**
 * Health domain logic. Kept out of the controller so it stays testable.
 */
async function getStatus() {
  const db = await database.healthCheck();
  return {
    healthy: db.connected,
    database: db,
  };
}

module.exports = { getStatus };
