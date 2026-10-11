'use strict';

/**
 * Seed runner.
 *
 * 1. Executes every ../database/seeds/*.sql file (idempotent reference data).
 * 2. Inserts application users with properly bcrypt-hashed passwords.
 *
 * Contains NO real personal information — all names/numbers are fictional.
 *
 * Usage: npm run db:seed
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const config = require('../config/environment');

const SEEDS_DIR = path.resolve(__dirname, '../../../database/seeds');
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Demo@12345';

async function runSqlFiles(connection) {
  if (!fs.existsSync(SEEDS_DIR)) {
    throw new Error(`Seeds directory not found: ${SEEDS_DIR}`);
  }
  const files = fs
    .readdirSync(SEEDS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');
    process.stdout.write(`  seed  ${file} ... `);
    await connection.query(sql);
    console.log('ok');
  }
}

async function upsertUser(connection, user, passwordHash) {
  await connection.query(
    `INSERT INTO users (username, email, password_hash, full_name, role, department_id, is_active, is_verified)
     VALUES (?, ?, ?, ?, ?, (SELECT id FROM departments WHERE code = ? LIMIT 1), 1, 1)
     ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        full_name = VALUES(full_name),
        role = VALUES(role),
        is_active = 1,
        is_verified = 1,
        deleted_at = NULL`,
    [user.username, user.email, passwordHash, user.fullName, user.role, user.departmentCode || null]
  );
}

async function seedUsers(connection) {
  const adminHash = await bcrypt.hash(config.seed.adminPassword, config.bcryptRounds);
  const demoHash = await bcrypt.hash(DEMO_PASSWORD, config.bcryptRounds);

  const users = [
    {
      username: config.seed.adminUsername,
      email: config.seed.adminEmail,
      fullName: 'System Administrator',
      role: 'admin',
      departmentCode: null,
      hash: adminHash,
    },
    {
      username: 'registrar',
      email: 'registrar@exam-scheduler.local',
      fullName: 'Registrar Office',
      role: 'registrar',
      departmentCode: null,
      hash: demoHash,
    },
    {
      username: 'head_cs',
      email: 'head.cs@exam-scheduler.local',
      fullName: 'Dr. Selam Bekele (Head, Computer Science)',
      role: 'department_head',
      departmentCode: 'CS',
      hash: demoHash,
    },
    {
      username: 'instructor1',
      email: 'instructor1@exam-scheduler.local',
      fullName: 'Dr. Abel Tesfaye',
      role: 'instructor',
      departmentCode: 'SE',
      hash: demoHash,
    },
    {
      username: 'instructor2',
      email: 'instructor2@exam-scheduler.local',
      fullName: 'Ms. Hana Girma',
      role: 'instructor',
      departmentCode: 'CS',
      hash: demoHash,
    },
    {
      username: 'student1',
      email: 'student1@exam-scheduler.local',
      fullName: 'Demo Student One',
      role: 'student',
      departmentCode: null,
      hash: demoHash,
    },
  ];

  for (const user of users) {
    const passwordHash = user.hash;
    await upsertUser(connection, user, passwordHash);
    console.log(`  user  ${user.username} (${user.role})`);
  }
}

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  try {
    await runSqlFiles(connection);
    await seedUsers(connection);
    console.log('\nSeed complete.');
    console.log(`  Admin login   : ${config.seed.adminUsername} / ${config.seed.adminPassword}`);
    console.log(`  Demo password : ${DEMO_PASSWORD} (registrar, head_cs, instructor1, instructor2, student1)`);
    console.log('  Change these credentials before any real deployment.');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('\nSeeding failed:', error.message);
  process.exit(1);
});
