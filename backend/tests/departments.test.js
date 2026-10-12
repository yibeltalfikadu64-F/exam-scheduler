'use strict';

/*
 * Phase 3 — Department management tests.
 *
 * Non-destructive: creates departments with the `P3D_` code prefix and removes
 * them (plus their audit rows) in `after()`.
 */

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');
const config = require('../src/config/environment');
const database = require('../src/config/database');

const BASE = config.apiPrefix;
const ADMIN = { username: config.seed.adminUsername, password: config.seed.adminPassword };
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Demo@12345';
const CODE_PREFIX = 'P3D_';

let adminToken;
let registrarToken;
let studentToken;

function login(credentials) {
  return request(app).post(`${BASE}/auth/login`).send(credentials);
}

function authed(req, token = adminToken) {
  return req.set('Authorization', `Bearer ${token}`);
}

function tempCode() {
  return `${CODE_PREFIX}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function tempName() {
  return `Phase3 Dept ${Math.random().toString(36).slice(2, 10)}`;
}

async function createDepartment(overrides = {}) {
  const payload = { code: tempCode(), name: tempName(), description: 'Phase 3 test department', ...overrides };
  const res = await authed(request(app).post(`${BASE}/departments`)).send(payload);
  return { res, payload };
}

describe('Phase 3 department management', () => {
  before(async () => {
    adminToken = (await login(ADMIN)).body.data.token;
    registrarToken = (await login({ username: 'registrar', password: DEMO_PASSWORD })).body.data.token;
    studentToken = (await login({ username: 'student1', password: DEMO_PASSWORD })).body.data.token;
  });

  after(async () => {
    await database
      .getPool()
      .query(
        "DELETE FROM audit_logs WHERE entity_type = 'department' AND entity_id IN (SELECT id FROM (SELECT id FROM departments WHERE code LIKE ?) x)",
        [`${CODE_PREFIX}%`]
      );
    await database.getPool().query('DELETE FROM departments WHERE code LIKE ?', [`${CODE_PREFIX}%`]);
    await database.closePool();
  });

  describe('authorization', () => {
    test('rejects an unauthenticated request with 401', async () => {
      const res = await request(app).get(`${BASE}/departments`);
      assert.equal(res.status, 401);
    });

    test('allows a student to read departments', async () => {
      const res = await authed(request(app).get(`${BASE}/departments`), studentToken);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data.items));
    });

    test('forbids a student from creating a department (403)', async () => {
      const res = await authed(request(app).post(`${BASE}/departments`), studentToken).send({
        code: tempCode(),
        name: tempName(),
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'INSUFFICIENT_ROLE');
    });
  });

  describe('read', () => {
    test('lists departments with a pagination envelope', async () => {
      const res = await authed(request(app).get(`${BASE}/departments?limit=5`));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length <= 5);
      assert.ok(res.body.data.pagination.total >= 8);
    });

    test('reports dependency counts (seeded CS has programs)', async () => {
      const res = await authed(request(app).get(`${BASE}/departments?search=Computer%20Science`));
      assert.equal(res.status, 200);
      const cs = res.body.data.items.find((d) => d.code === 'CS');
      assert.ok(cs, 'expected the seeded CS department');
      assert.ok(cs.programCount >= 1);
      assert.ok(typeof cs.courseCount === 'number');
    });

    test('returns 404 for an unknown department', async () => {
      const res = await authed(request(app).get(`${BASE}/departments/999999`));
      assert.equal(res.status, 404);
      assert.equal(res.body.code, 'DEPARTMENT_NOT_FOUND');
    });

    test('rejects an invalid list query with 400', async () => {
      const res = await authed(request(app).get(`${BASE}/departments?page=0`));
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });
  });

  describe('create', () => {
    test('creates a department as admin and uppercases the code', async () => {
      const { res, payload } = await createDepartment({ code: `${CODE_PREFIX}alpha`.toUpperCase() });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.department.code, payload.code);
      assert.equal(res.body.data.department.isActive, true);
    });

    test('allows a registrar to create a department', async () => {
      const res = await authed(request(app).post(`${BASE}/departments`), registrarToken).send({
        code: tempCode(),
        name: tempName(),
      });
      assert.equal(res.status, 201);
    });

    test('rejects a duplicate code with 409', async () => {
      const { payload } = await createDepartment();
      const dup = await authed(request(app).post(`${BASE}/departments`)).send({ code: payload.code, name: tempName() });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, 'DUPLICATE_DEPARTMENT_CODE');
    });

    test('rejects a duplicate name with 409', async () => {
      const { payload } = await createDepartment();
      const dup = await authed(request(app).post(`${BASE}/departments`)).send({ code: tempCode(), name: payload.name });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, 'DUPLICATE_DEPARTMENT_NAME');
    });

    test('rejects missing fields with 400 + per-field details', async () => {
      const res = await authed(request(app).post(`${BASE}/departments`)).send({});
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
      assert.ok(res.body.details.some((d) => d.field === 'code'));
      assert.ok(res.body.details.some((d) => d.field === 'name'));
    });

    test('rejects a non-existent head user with 400', async () => {
      const res = await authed(request(app).post(`${BASE}/departments`)).send({
        code: tempCode(),
        name: tempName(),
        headId: 999999,
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'headId'));
    });
  });

  describe('update + status', () => {
    test('updates name/description and reflects them', async () => {
      const { res: created } = await createDepartment();
      const id = created.body.data.department.id;

      const res = await authed(request(app).patch(`${BASE}/departments/${id}`)).send({
        name: `${tempName()} updated`,
        description: 'Updated description',
      });
      assert.equal(res.status, 200);
      assert.match(res.body.data.department.name, /updated$/);
      assert.equal(res.body.data.department.description, 'Updated description');
    });

    test('deactivates and reactivates a department', async () => {
      const { res: created } = await createDepartment();
      const id = created.body.data.department.id;

      const off = await authed(request(app).patch(`${BASE}/departments/${id}/status`)).send({ isActive: false });
      assert.equal(off.status, 200);
      assert.equal(off.body.data.department.isActive, false);

      const filtered = await authed(request(app).get(`${BASE}/departments?status=inactive&search=${encodeURIComponent(created.body.data.department.name)}`));
      assert.equal(filtered.status, 200);
      assert.ok(filtered.body.data.items.some((d) => d.id === id));

      const on = await authed(request(app).patch(`${BASE}/departments/${id}/status`)).send({ isActive: true });
      assert.equal(on.status, 200);
      assert.equal(on.body.data.department.isActive, true);
    });

    test('rejects a non-boolean status with 400', async () => {
      const { res: created } = await createDepartment();
      const res = await authed(request(app).patch(`${BASE}/departments/${created.body.data.department.id}/status`)).send({
        isActive: 'maybe',
      });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'VALIDATION_ERROR');
    });

    test('exposes dependency counts per department', async () => {
      const { res: created } = await createDepartment();
      const res = await authed(request(app).get(`${BASE}/departments/${created.body.data.department.id}/dependencies`));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.programs, 0);
      assert.equal(res.body.data.courses, 0);
    });
  });
});
