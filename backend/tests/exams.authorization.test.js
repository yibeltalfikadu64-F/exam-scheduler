'use strict';

/*
 * Exam module — authorization regression tests (Step 1).
 *
 * Confirmed policy:
 *   - Exam WRITES (create / update / status / delete) are ADMIN ONLY.
 *     (exam.routes.js: CAN_WRITE = ['admin'], DELETE = admin.)
 *   - Exam READS are allowed for every authenticated role, with department-head
 *     scoping applied in the service layer.
 *
 * Non-destructive by design:
 *   - No row is ever inserted, updated, or deleted.
 *   - Tokens are signed directly with the app secret, so there is no login and
 *     therefore no `users.last_login` update or login audit write.
 *   - Every write request asserted here is rejected by `authorize` (403) or
 *     `validate` (400) BEFORE any controller or database write is reached.
 *   - `authenticate` only performs a read (SELECT) of the acting user.
 *
 * Run with:  npm test   (from backend/)
 */

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const config = require('../src/config/environment');
const database = require('../src/config/database');
const { assertDepartmentScope } = require('../src/services/scope');
const { authorize } = require('../src/middleware/role.middleware');

const BASE = config.apiPrefix;

function signFor(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    config.jwt.secret,
    { expiresIn: '10m', algorithm: config.jwt.algorithm }
  );
}

function authed(builder, token) {
  return builder.set('Authorization', `Bearer ${token}`);
}

const tokens = {};

describe('Exam module authorization (admin-only writes)', () => {
  before(async () => {
    const [rows] = await database
      .getPool()
      .query(
        "SELECT id, username, role FROM users WHERE deleted_at IS NULL AND username IN ('admin','registrar','head_cs','instructor1','student1')"
      );

    const byName = Object.fromEntries(rows.map((row) => [row.username, row]));

    assert.ok(byName.admin, 'seed user "admin" must exist');
    assert.ok(byName.registrar, 'seed user "registrar" must exist');
    assert.ok(byName.head_cs, 'seed user "head_cs" must exist');
    assert.ok(byName.instructor1, 'seed user "instructor1" must exist');
    assert.ok(byName.student1, 'seed user "student1" must exist');

    tokens.admin = signFor(byName.admin);
    tokens.registrar = signFor(byName.registrar);
    tokens.head = signFor(byName.head_cs);
    tokens.instructor = signFor(byName.instructor1);
    tokens.student = signFor(byName.student1);
  });

  after(async () => {
    await database.closePool();
  });

  describe('non-admin roles are forbidden from every write', () => {
    for (const [label, key] of [
      ['registrar', 'registrar'],
      ['department_head', 'head'],
      ['instructor', 'instructor'],
      ['student', 'student'],
    ]) {
      test(`${label} gets 403 INSUFFICIENT_ROLE on create/update/status/delete`, async () => {
        const token = tokens[key];

        const create = await authed(request(app).post(`${BASE}/exams`), token).send({});
        assert.equal(create.status, 403);
        assert.equal(create.body.code, 'INSUFFICIENT_ROLE');

        const update = await authed(request(app).patch(`${BASE}/exams/1`), token).send({ notes: 'x' });
        assert.equal(update.status, 403);
        assert.equal(update.body.code, 'INSUFFICIENT_ROLE');

        const status = await authed(request(app).patch(`${BASE}/exams/1/status`), token).send({ status: 'draft' });
        assert.equal(status.status, 403);
        assert.equal(status.body.code, 'INSUFFICIENT_ROLE');

        const del = await authed(request(app).delete(`${BASE}/exams/1`), token);
        assert.equal(del.status, 403);
        assert.equal(del.body.code, 'INSUFFICIENT_ROLE');
      });
    }
  });

  describe('admin is authorized (rejected by validation, never 403)', () => {
    test('admin passes create authorization and hits validation', async () => {
      const res = await authed(request(app).post(`${BASE}/exams`), tokens.admin).send({});
      assert.notEqual(res.status, 403);
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });

    test('admin passes update authorization and hits validation', async () => {
      const res = await authed(request(app).patch(`${BASE}/exams/1`), tokens.admin).send({});
      assert.notEqual(res.status, 403);
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });

    test('admin passes status authorization and hits validation', async () => {
      const res = await authed(request(app).patch(`${BASE}/exams/1/status`), tokens.admin).send({ status: 'not-a-status' });
      assert.notEqual(res.status, 403);
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });
  });

  describe('reads', () => {
    test('requires authentication (401 without a token)', async () => {
      const res = await request(app).get(`${BASE}/exams`);
      assert.equal(res.status, 401);
    });

    test('allows a student to read the exam list', async () => {
      const res = await authed(request(app).get(`${BASE}/exams?limit=1`), tokens.student);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });

    test('reports 404 (not 403) when an admin deletes an unknown exam', async () => {
      const res = await authed(request(app).delete(`${BASE}/exams/999999`), tokens.admin);
      assert.equal(res.status, 404);
      assert.equal(res.body.code, 'EXAM_NOT_FOUND');
    });
  });
});

describe('Authorization helpers (unit)', () => {
  test('authorize() allows only the listed roles', () => {
    const guard = authorize('admin');

    let allowed = false;
    guard({ user: { role: 'admin' } }, {}, () => {
      allowed = true;
    });
    assert.equal(allowed, true);

    let blocked;
    guard({ user: { role: 'registrar' } }, {}, (error) => {
      blocked = error;
    });
    assert.ok(blocked, 'registrar must be blocked');
    assert.equal(blocked.statusCode, 403);
    assert.equal(blocked.code, 'INSUFFICIENT_ROLE');
  });

  test('assertDepartmentScope() preserves department-head scoping', () => {
    // Non-heads are unaffected regardless of department.
    assert.doesNotThrow(() => assertDepartmentScope({ role: 'admin' }, 999));
    assert.doesNotThrow(() => assertDepartmentScope({ role: 'registrar' }, 999));

    // A head may act on their own department...
    assert.doesNotThrow(() => assertDepartmentScope({ role: 'department_head', departmentId: 42 }, 42));

    // ...but not another department (403 DEPARTMENT_SCOPE).
    assert.throws(
      () => assertDepartmentScope({ role: 'department_head', departmentId: 42 }, 43),
      (error) => error.statusCode === 403 && error.code === 'DEPARTMENT_SCOPE'
    );
  });
});
