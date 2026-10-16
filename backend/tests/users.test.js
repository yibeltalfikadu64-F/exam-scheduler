
'use strict';

/*
 * Phase 2 — user management & RBAC tests.
 *
 * Runs against the REAL Express app and REAL MySQL database. Non-destructive:
 * every record this suite creates uses the `p2test_` username prefix and is
 * removed in `after()`. Nothing is reset, dropped, or truncated.
 *
 * Run with: npm test (from backend/)
 */

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const config = require('../src/config/environment');
const database = require('../src/config/database');
const userService = require('../src/services/user.service');

const BASE = config.apiPrefix;
const ADMIN = {
  username: config.seed.adminUsername,
  password: config.seed.adminPassword,
};
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Demo@12345';
const PREFIX = 'p2test_';
const EMAIL_DOMAIN = 'exam-scheduler.local';

let adminToken;
let adminId;
let seq = 0;

function login(credentials) {
  return request(app).post(`${BASE}/auth/login`).send(credentials);
}

function asAdmin(req) {
  return req.set('Authorization', `Bearer ${adminToken}`);
}

function unique(label) {
  seq += 1;
  return `${PREFIX}${label}_${Date.now()}_${seq}`;
}

/**
 * Create a test user using a real department ID from the database.
 * Individual tests can override the defaults.
 */
async function createUserViaApi(overrides = {}) {
  const username = overrides.username || unique('user');

  const [departments] = await database
    .getPool()
    .query("SELECT id FROM departments WHERE code = 'SE' LIMIT 1");

  if (departments.length === 0) {
    throw new Error(
      'The SE department must exist before user tests run.'
    );
  }

  const payload = {
    username,
    email: `${username}@${EMAIL_DOMAIN}`,
    fullName: 'Phase Two Test User',
    role: 'instructor',
    password: 'TestPass123',
    departmentId: departments[0].id,
    ...overrides,
  };

  const res = await asAdmin(
    request(app).post(`${BASE}/users`)
  ).send(payload);

  return {
    res,
    payload,
    username,
    email: payload.email,
  };
}

describe('Phase 2 user management', () => {
  before(async () => {
    const res = await login(ADMIN);

    assert.equal(
      res.status,
      200,
      'admin login must work before user-management tests run'
    );

    adminToken = res.body.data.token;
    adminId = res.body.data.user.id;
  });

  after(async () => {
    await database
      .getPool()
      .query(
        `DELETE FROM audit_logs
         WHERE entity_type = 'user'
         AND entity_id IN (
           SELECT id FROM users WHERE username LIKE ?
         )`,
        [`${PREFIX}%`]
      );

    await database
      .getPool()
      .query(
        'DELETE FROM users WHERE username LIKE ?',
        [`${PREFIX}%`]
      );

    await database.closePool();
  });

  describe('authorization (server-side, not just UI)', () => {
    test('rejects a request without a token (401)', async () => {
      const res = await request(app).get(`${BASE}/users`);

      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'TOKEN_MISSING');
    });

    test('rejects a non-admin role with 403 INSUFFICIENT_ROLE', async () => {
      const studentLogin = await login({
        username: 'student1',
        password: DEMO_PASSWORD,
      });

      assert.equal(studentLogin.status, 200);

      const res = await request(app)
        .get(`${BASE}/users`)
        .set(
          'Authorization',
          `Bearer ${studentLogin.body.data.token}`
        );

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'INSUFFICIENT_ROLE');
    });

    test('allows an admin to list users', async () => {
      const res = await asAdmin(
        request(app).get(`${BASE}/users`)
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));
      assert.ok(res.body.data.pagination);
    });
  });

  describe('GET /users list, search, filters, pagination', () => {
    before(async () => {
      await createUserViaApi({
        username: unique('list'),
        fullName: 'Zebra Listsearch Person',
        role: 'registrar',
      });
    });

    test('supports pagination with a stable shape', async () => {
      const res = await asAdmin(
        request(app).get(`${BASE}/users?page=1&limit=2`)
      );

      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length <= 2);
      assert.equal(res.body.data.pagination.page, 1);
      assert.equal(res.body.data.pagination.limit, 2);
      assert.ok(typeof res.body.data.pagination.total === 'number');
      assert.ok(
        typeof res.body.data.pagination.totalPages === 'number'
      );
    });

    test('searches across name/username/email', async () => {
      const res = await asAdmin(
        request(app).get(
          `${BASE}/users?search=Zebra%20Listsearch`
        )
      );

      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length >= 1);
      assert.ok(
        res.body.data.items.every(
          (user) =>
            user.fullName.includes('Zebra') ||
            user.username.includes('Zebra')
        )
      );
    });

    test('filters by role', async () => {
      const res = await asAdmin(
        request(app).get(`${BASE}/users?role=admin`)
      );

      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length >= 1);
      assert.ok(
        res.body.data.items.every((user) => user.role === 'admin')
      );
    });

    test('filters by status', async () => {
      const res = await asAdmin(
        request(app).get(`${BASE}/users?status=inactive`)
      );

      assert.equal(res.status, 200);
      assert.ok(
        res.body.data.items.every((user) => user.isActive === false)
      );
    });

    test('rejects an invalid page with 400 VALIDATION_ERROR', async () => {
      const res = await asAdmin(
        request(app).get(`${BASE}/users?page=0`)
      );

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });

    test('rejects an invalid sort column with 400', async () => {
      const res = await asAdmin(
        request(app).get(`${BASE}/users?sort=password_hash`)
      );

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });

    test('returns roles + departments for form options', async () => {
      const res = await asAdmin(
        request(app).get(`${BASE}/users/options`)
      );

      assert.equal(res.status, 200);
      assert.deepEqual(
        res.body.data.roles.sort(),
        [
          'admin',
          'department_head',
          'instructor',
          'registrar',
          'student',
        ].sort()
      );
      assert.ok(Array.isArray(res.body.data.departments));
      assert.ok(res.body.data.departments.length >= 1);
    });
  });

  describe('POST /users create', () => {
    test('creates a user, hashes the password, and never returns it', async () => {
      // Do not hardcode departmentId: 2; use the valid SE ID from the helper.
      const { res, payload } = await createUserViaApi({
        role: 'department_head',
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.user.username, payload.username);
      assert.equal(res.body.data.user.role, 'department_head');
      assert.equal(res.body.data.user.isActive, true);
      assert.ok(
        !JSON.stringify(res.body).includes('password'),
        'response must not leak passwords'
      );
      assert.ok(!JSON.stringify(res.body).includes('$2a$'));
      assert.ok(!JSON.stringify(res.body).includes('$2b$'));

      // Verify the new account can authenticate.
      const newLogin = await login({
        username: payload.username,
        password: payload.password,
      });

      assert.equal(newLogin.status, 200);
    });

    test('rejects a duplicate username with 409 DUPLICATE_USERNAME', async () => {
      const { payload } = await createUserViaApi();

      const dup = await asAdmin(
        request(app).post(`${BASE}/users`)
      ).send({
        username: payload.username,
        email: `other_${payload.username}@${EMAIL_DOMAIN}`,
        fullName: 'Duplicate Username',
        role: 'student',
        password: 'TestPass123',
      });

      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, 'DUPLICATE_USERNAME');
    });

    test('rejects a duplicate email with 409 DUPLICATE_EMAIL', async () => {
      const { payload } = await createUserViaApi();

      const dup = await asAdmin(
        request(app).post(`${BASE}/users`)
      ).send({
        username: unique('other'),
        email: payload.email,
        fullName: 'Duplicate Email',
        role: 'student',
        password: 'TestPass123',
      });

      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, 'DUPLICATE_EMAIL');
    });

    test('rejects a weak password with 400 VALIDATION_ERROR', async () => {
      const res = await asAdmin(
        request(app).post(`${BASE}/users`)
      ).send({
        username: unique('weak'),
        email: `weak_${seq}@${EMAIL_DOMAIN}`,
        fullName: 'Weak Password',
        role: 'student',
        password: 'short',
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
      assert.ok(
        res.body.details.some((detail) => detail.field === 'password')
      );
    });

    test('rejects an invalid role with 400', async () => {
      const res = await asAdmin(
        request(app).post(`${BASE}/users`)
      ).send({
        username: unique('badrole'),
        email: `badrole_${seq}@${EMAIL_DOMAIN}`,
        fullName: 'Bad Role',
        role: 'superuser',
        password: 'TestPass123',
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });

    test('rejects a non-existent department with 400 + field detail', async () => {
      const res = await asAdmin(
        request(app).post(`${BASE}/users`)
      ).send({
        username: unique('baddep'),
        email: `baddep_${seq}@${EMAIL_DOMAIN}`,
        fullName: 'Bad Department',
        role: 'instructor',
        password: 'TestPass123',
        departmentId: 999999,
      });

      assert.equal(res.status, 400);
      assert.ok(
        res.body.details.some(
          (detail) => detail.field === 'departmentId'
        )
      );
    });
  });

  describe('read / update / status', () => {
    test('returns a single user and 404s for unknown ids', async () => {
      const { res: created } = await createUserViaApi();
      const id = created.body.data.user.id;

      const ok = await asAdmin(
        request(app).get(`${BASE}/users/${id}`)
      );

      assert.equal(ok.status, 200);
      assert.equal(ok.body.data.user.id, id);

      const missing = await asAdmin(
        request(app).get(`${BASE}/users/999999`)
      );

      assert.equal(missing.status, 404);
    });

    test('updates details and reflects them', async () => {
      const { res: created } = await createUserViaApi();
      const id = created.body.data.user.id;

      const res = await asAdmin(
        request(app).patch(`${BASE}/users/${id}`)
      ).send({
        fullName: 'Updated Name',
        role: 'registrar',
        departmentId: null,
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.user.fullName, 'Updated Name');
      assert.equal(res.body.data.user.role, 'registrar');
      assert.equal(res.body.data.user.department, null);
    });

    test('prevents an admin from changing their own role (403 SELF_ROLE_CHANGE)', async () => {
      const res = await asAdmin(
        request(app).patch(`${BASE}/users/${adminId}`)
      ).send({ role: 'student' });

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'SELF_ROLE_CHANGE');
    });

    test('prevents an admin from deactivating their own account (403 SELF_DEACTIVATE)', async () => {
      const res = await asAdmin(
        request(app).patch(`${BASE}/users/${adminId}/status`)
      ).send({ isActive: false });

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'SELF_DEACTIVATE');
    });

    test('deactivation takes effect immediately for existing tokens', async () => {
      const { res: created, payload } = await createUserViaApi();
      const id = created.body.data.user.id;

      const userLogin = await login({
        username: payload.username,
        password: payload.password,
      });

      assert.equal(userLogin.status, 200);
      const userToken = userLogin.body.data.token;

      const deactivate = await asAdmin(
        request(app).patch(`${BASE}/users/${id}/status`)
      ).send({ isActive: false });

      assert.equal(deactivate.status, 200);
      assert.equal(deactivate.body.data.user.isActive, false);

      // Existing token is rejected because account status is re-checked.
      const withStaleToken = await request(app)
        .get(`${BASE}/auth/me`)
        .set('Authorization', `Bearer ${userToken}`);

      assert.equal(withStaleToken.status, 403);
      assert.equal(withStaleToken.body.code, 'ACCOUNT_INACTIVE');

      // Fresh login is refused too.
      const blocked = await login({
        username: payload.username,
        password: payload.password,
      });

      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.code, 'ACCOUNT_INACTIVE');

      // Re-activation restores access.
      const activate = await asAdmin(
        request(app).patch(`${BASE}/users/${id}/status`)
      ).send({ isActive: true });

      assert.equal(activate.status, 200);
      assert.equal(activate.body.data.user.isActive, true);
    });

    test('rejects a non-boolean status with 400', async () => {
      const { res: created } = await createUserViaApi();
      const id = created.body.data.user.id;

      const res = await asAdmin(
        request(app).patch(`${BASE}/users/${id}/status`)
      ).send({ isActive: 'maybe' });

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });
  });

  describe('password reset', () => {
    test('resets a password; old fails, new works', async () => {
      const { res: created, payload } = await createUserViaApi();
      const id = created.body.data.user.id;

      const reset = await asAdmin(
        request(app).post(`${BASE}/users/${id}/reset-password`)
      ).send({
        newPassword: 'BrandNewPass456',
      });

      assert.equal(reset.status, 200);
      assert.ok(!JSON.stringify(reset.body).includes('$2a$'));

      const oldLogin = await login({
        username: payload.username,
        password: payload.password,
      });

      assert.equal(oldLogin.status, 401);

      const newLogin = await login({
        username: payload.username,
        password: 'BrandNewPass456',
      });

      assert.equal(newLogin.status, 200);
    });

    test('rejects a weak new password with 400', async () => {
      const { res: created } = await createUserViaApi();
      const id = created.body.data.user.id;

      const res = await asAdmin(
        request(app).post(`${BASE}/users/${id}/reset-password`)
      ).send({
        newPassword: 'abc',
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });
  });

  describe('last-administrator safety net (service level)', () => {
    test('refuses to demote the only active administrator', async () => {
      await assert.rejects(
        () =>
          userService.updateUser(
            adminId,
            { role: 'student' },
            { id: 999999 },
            { ip: null, userAgent: null }
          ),
        (error) => {
          assert.equal(error.code, 'LAST_ADMIN');
          return true;
        }
      );
    });

    test('refuses to deactivate the only active administrator', async () => {
      await assert.rejects(
        () =>
          userService.setUserStatus(
            adminId,
            false,
            { id: 999999 },
            { ip: null, userAgent: null }
          ),
        (error) => {
          assert.equal(error.code, 'LAST_ADMIN');
          return true;
        }
      );
    });
  });
});
