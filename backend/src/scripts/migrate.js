'use strict';

/**
 * Migration runner.
 *
 * - Reads ../database/migrations/*.sql in filename order.
 * - Tracks applied files in the `schema_migrations` table.
 * - Applies only files that have not been applied yet.
 *
 * NOTE: MySQL/MariaDB implicitly commit DDL, so a migration is not wrapped in a
 * transaction. Migrations are written to be additive and idempotent instead.
 *
 * Usage: npm run db:migrate
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config/environment');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../database/migrations');

async function ensureMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      filename VARCHAR(255) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_schema_migrations_filename (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function main() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  try {
    await ensureMigrationsTable(connection);

    const [appliedRows] = await connection.query('SELECT filename FROM schema_migrations');
    const applied = new Set(appliedRows.map((row) => row.filename));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip  ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      process.stdout.write(`  apply ${file} ... `);
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
      appliedCount += 1;
      console.log('ok');
    }

    console.log(`\nMigrations complete: ${appliedCount} applied, ${files.length - appliedCount} already up to date.`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('\nMigration failed:', error.message);
  console.error('Ensure the database exists and the credentials in backend/.env are correct (npm run db:create).');
  process.exit(1);
});
