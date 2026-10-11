'use strict';

/**
 * Creates the application database and a least-privilege application user.
 *
 * Connects with a PRIVILEGED account (DB_ADMIN_USER / DB_ADMIN_PASSWORD) and:
 *   1. CREATE DATABASE IF NOT EXISTS  (never drops an existing database)
 *   2. CREATE USER IF NOT EXISTS      (restricted to the app database)
 *   3. GRANT the minimum privileges the application needs
 *
 * Usage: npm run db:create
 */

const mysql = require('mysql2/promise');
const config = require('../config/environment');

// These values come from the trusted .env file (not user input). Identifiers
// cannot be passed as bound parameters in DDL, so we sanitize defensively.
function quoteIdent(value) {
  return `\`${String(value).replace(/`/g, '')}\``;
}

function quoteString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const { host, port, database, user, password } = config.db;
  const adminUser = config.dbAdmin.user;
  const adminPassword = config.dbAdmin.password;

  console.log(`Connecting as "${adminUser}" to ${host}:${port} ...`);

  let admin;
  try {
    admin = await mysql.createConnection({
      host,
      port,
      user: adminUser,
      password: adminPassword,
      multipleStatements: true,
    });
  } catch (error) {
    console.error('\nCould not connect with the privileged account.');
    console.error(`  ${error.code ? `${error.code}: ` : ''}${error.message}`);
    console.error('\nCheck DB_ADMIN_USER / DB_ADMIN_PASSWORD in backend/.env.');
    console.error('If your local MySQL has no root password, leave DB_ADMIN_PASSWORD empty.');
    process.exit(1);
  }

  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdent(database)}
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`Database ${quoteIdent(database)} is ready.`);

    // Create the app user for the common local hosts.
    const hosts = ['localhost', '127.0.0.1'];
    for (const h of hosts) {
      await admin.query(
        `CREATE USER IF NOT EXISTS ${quoteString(user)}@${quoteString(h)} IDENTIFIED BY ${quoteString(password)}`
      );
      await admin.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES
         ON ${quoteIdent(database)}.* TO ${quoteString(user)}@${quoteString(h)}`
      );
    }
    await admin.query('FLUSH PRIVILEGES');
    console.log(`Application user "${user}" now has least-privilege access to "${database}".`);
    console.log('\nNext: npm run db:migrate');
  } finally {
    await admin.end();
  }
}

main().catch((error) => {
  console.error('Failed to create database/user:', error.message);
  process.exit(1);
});
