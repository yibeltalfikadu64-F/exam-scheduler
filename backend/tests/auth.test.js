'use strict';

/*
 * Phase 5 — authentication & authorization tests.
 *
 * These run against the REAL Express app and the REAL MySQL database using the
 * seeded accounts. The suite is non-destructive: it creates exactly one
 * temporary inactive user and removes it afterwards. It never resets, drops, or
 * truncates anything.
 *
 * Run with:  npm test   (from backend/)
 */

// Must be set BEFORE the app/config are required: dotenv does not override
// values already present in process.env, so NODE_ENV stays "test" (which skips
// the login rate limiter) and logging is silenced.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = require('../src/app');
const config = require('../src/config/environment');
const database = require('../src/config/database');
const { authenticate } = require('../src/middleware/auth.middleware');
const { authorize } = require('../src/middleware/role.middleware');
const { notFoundHandler, errorHandler } = require('../src/middleware/error.middleware');

const BASE = config.apiPrefix;
const ADMIN = { username: config.seed.adminUsername, password: config.seed.adminPassword };
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Demo@12345';

const INACTIVE_USERNAME = 'phase5_inactive_test_user';
const INACTIVE_PASSWORD = 'Inactive@12345';

function loginRequest(credentials) {
  return request(app).post(`${BASE}/auth/login`).send(credentials);
}

async function tokenFor(username, password) {
  const res = await loginRequest({ username, password });
  assert.equal(res.status, 200, `expected login for "${username}" to succeed`);
  return res.body.data.token;
}

describe('Phase 5 authentication', () => {
  before(async () => {
    const hash = await bcrypt.hash(INACTIVE_PASSWORD, config.bcryptRounds);
    await database.getPool().query(
      `INSERT INTO users (username, email, password_hash, full_name, role, is_active, is_verified)
       VALUES (?, ?, ?, ?, 'instructor', 0, 1)
       ON DUPLICATE KEY UPDATE
         password_hash = VALUES(password_hash),
         full_name = VALUES(full_name),
         role = 'instructor',
         is_active = 0,
         is_verified = 1,
         deleted_at = NULL`,
      [INACTIVE_USERNAME, `${INACTIVE_USERNAME}@exam-scheduler.local`, hash, 'Phase 5 Inactive Test User']
    );
  });

  after(async () => {
    await database.getPool().query('DELETE FROM users WHERE username = ?', [INACTIVE_USERNAME]);
    await database.closePool();
  });

  describe('POST /auth/login', () => {
    test('succeeds with valid credentials and returns a token + safe user', async () => {
      const res = await loginRequest(ADMIN);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(typeof res.body.data.token === 'string' && res.body.data.token.length > 20);
      assert.equal(res.body.data.tokenType, 'Bearer');
      assert.equal(res.body.data.user.username, ADMIN.username);
      assert.equal(res.body.data.user.role, 'admin');
      assert.ok(!('password_hash' in res.body.data.user));
      assert.ok(!('passwordHash' in res.body.data.user));
      assert.ok(!JSON.stringify(res.body).includes('password_hash'), 'response must not leak password_hash');
      assert.ok(!JSON.stringify(res.body).includes('$2a$'), 'response must not leak bcrypt hashes');
      assert.ok(!JSON.stringify(res.body).includes('$2b$'), 'response must not leak bcrypt hashes');
    });

    test('accepts an email address as the identifier', async () => {
      const res = await loginRequest({ email: config.seed.adminEmail, password: config.seed.adminPassword });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.user.username, ADMIN.username);
    });

    test('rejects an incorrect password with a generic 401', async () => {
      const res = await loginRequest({ username: ADMIN.username, password: 'DefinitelyWrong123' });

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.code, 'INVALID_CREDENTIALS');
      assert.match(res.body.message, /invalid username or password/i);
    });

    test('rejects a nonexistent user with the SAME generic message (no enumeration)', async () => {
      const wrongPassword = await loginRequest({ username: ADMIN.username, password: 'DefinitelyWrong123' });
      const noSuchUser = await loginRequest({ username: 'ghost_user_does_not_exist', password: 'Whatever123' });

      assert.equal(noSuchUser.status, 401);
      assert.equal(noSuchUser.body.code, 'INVALID_CREDENTIALS');
      assert.equal(noSuchUser.body.message, wrongPassword.body.message);
    });

    test('rejects missing fields with 400 VALIDATION_ERROR + per-field details', async () => {
      const res = await loginRequest({});

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(res.body.details));
      const fields = res.body.details.map((item) => item.field);
      assert.ok(fields.includes('identifier'));
      assert.ok(fields.includes('password'));
    });

    test('rejects a request missing only the password', async () => {
      const res = await loginRequest({ username: ADMIN.username });

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
      assert.ok(res.body.details.some((item) => item.field === 'password'));
    });

    test('rejects an inactive account with 403 ACCOUNT_INACTIVE', async () => {
      const res = await loginRequest({ username: INACTIVE_USERNAME, password: INACTIVE_PASSWORD });

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'ACCOUNT_INACTIVE');
    });
  });

  describe('GET /auth/me', () => {
    test('returns the current profile for a valid token', async () => {
      const token = await tokenFor(ADMIN.username, ADMIN.password);
      const res = await request(app).get(`${BASE}/auth/me`).set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.user.username, ADMIN.username);
      assert.equal(res.body.data.user.role, 'admin');
      assert.ok(!JSON.stringify(res.body).includes('password_hash'));
    });

    test('rejects a missing token with 401 TOKEN_MISSING', async () => {
      const res = await request(app).get(`${BASE}/auth/me`);

      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'TOKEN_MISSING');
    });

    test('rejects an invalid token with 401 TOKEN_INVALID', async () => {
      const res = await request(app).get(`${BASE}/auth/me`).set('Authorization', 'Bearer not.a.real.token');

      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'TOKEN_INVALID');
    });

    test('rejects an expired token with 401 TOKEN_INVALID', async () => {
      const expired = jwt.sign(
        { sub: 1, username: ADMIN.username, role: 'admin' },
        config.jwt.secret,
        { expiresIn: '-10s', algorithm: config.jwt.algorithm }
      );
      const res = await request(app).get(`${BASE}/auth/me`).set('Authorization', `Bearer ${expired}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'TOKEN_INVALID');
      assert.match(res.body.message, /expired/i);
    });

    test('rejects a token signed with the wrong secret', async () => {
      const forged = jwt.sign({ sub: 1, username: ADMIN.username, role: 'admin' }, 'wrong-secret', {
        algorithm: config.jwt.algorithm,
      });
      const res = await request(app).get(`${BASE}/auth/me`).set('Authorization', `Bearer ${forged}`);

      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'TOKEN_INVALID');
    });
  });

  describe('POST /auth/logout', () => {
    test('requires authentication', async () => {
      const res = await request(app).post(`${BASE}/auth/logout`);
      assert.equal(res.status, 401);
    });

    test('succeeds for an authenticated caller', async () => {
      const token = await tokenFor(ADMIN.username, ADMIN.password);
      const res = await request(app).post(`${BASE}/auth/logout`).set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.loggedOut, true);
    });
  });

  describe('role-based authorization', () => {
    // A dedicated mini-app proves the real middleware enforces roles without
    // depending on any feature module from a later phase.
    const guarded = express();
    guarded.use(express.json());
    guarded.get('/admin-only', authenticate, authorize('admin'), (req, res) => {
      res.json({ success: true, data: { role: req.user.role } });
    });
    guarded.use(notFoundHandler);
    guarded.use(errorHandler);

    test('allows an admin token', async () => {
      const token = await tokenFor(ADMIN.username, ADMIN.password);
      const res = await request(guarded).get('/admin-only').set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.data.role, 'admin');
    });

    test('forbids a non-admin token with 403 INSUFFICIENT_ROLE', async () => {
      const token = await tokenFor('student1', DEMO_PASSWORD);
      const res = await request(guarded).get('/admin-only').set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'INSUFFICIENT_ROLE');
    });

    test('forbids an unauthenticated request with 401', async () => {
      const res = await request(guarded).get('/admin-only');
      assert.equal(res.status, 401);
    });
  });
});
