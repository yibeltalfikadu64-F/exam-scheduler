'use strict';

/*
 * Phase 3 — Program management tests (including department-head scoping).
 * Non-destructive: uses the `P3P_` code prefix and cleans up in `after()`.
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
const CODE_PREFIX = 'P3P_';

let adminToken;
let headToken;
let studentToken;
let csDepartmentId;
let seDepartmentId;

function authed(req, token = adminToken) {
  return req.set('Authorization', `Bearer ${token}`);
}

function tempCode() {
  return `${CODE_PREFIX}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function tempName() {
  return `Phase3 Program ${Math.random().toString(36).slice(2, 10)}`;
}

async function createProgram(overrides = {}) {
  const payload = {
    departmentId: csDepartmentId,
    code: tempCode(),
    name: tempName(),
    degreeType: 'bachelor',
    durationYears: 4,
    ...overrides,
  };
  const res = await authed(request(app).post(`${BASE}/programs`)).send(payload);
  return { res, payload };
}

describe('Phase 3 program management', () => {
  before(async () => {
    adminToken = (await request(app).post(`${BASE}/auth/login`).send(ADMIN)).body.data.token;
    headToken = (await request(app).post(`${BASE}/auth/login`).send({ username: 'head_cs', password: DEMO_PASSWORD })).body.data.token;
    studentToken = (await request(app).post(`${BASE}/auth/login`).send({ username: 'student1', password: DEMO_PASSWORD })).body.data.token;

    const [rows] = await database.getPool().query("SELECT id, code FROM departments WHERE code IN ('CS','SE')");
    csDepartmentId = rows.find((row) => row.code === 'CS').id;
    seDepartmentId = rows.find((row) => row.code === 'SE').id;
  });

  after(async () => {
    await database
      .getPool()
      .query(
        "DELETE FROM audit_logs WHERE entity_type = 'program' AND entity_id IN (SELECT id FROM (SELECT id FROM programs WHERE code LIKE ?) x)",
        [`${CODE_PREFIX}%`]
      );
    await database.getPool().query('DELETE FROM programs WHERE code LIKE ?', [`${CODE_PREFIX}%`]);
    await database.closePool();
  });

  describe('authorization + department scope', () => {
    test('forbids a student from creating a program (403)', async () => {
      const res = await authed(request(app).post(`${BASE}/programs`), studentToken).send({
        departmentId: csDepartmentId,
        code: tempCode(),
        name: tempName(),
      });
      assert.equal(res.status, 403);
    });

    test('lets a department head create a program in their own department', async () => {
      const res = await authed(request(app).post(`${BASE}/programs`), headToken).send({
        departmentId: csDepartmentId,
        code: tempCode(),
        name: tempName(),
      });
      assert.equal(res.status, 201);
    });

    test('blocks a department head from another department (403 DEPARTMENT_SCOPE)', async () => {
      const res = await authed(request(app).post(`${BASE}/programs`), headToken).send({
        departmentId: seDepartmentId,
        code: tempCode(),
        name: tempName(),
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'DEPARTMENT_SCOPE');
    });
  });

  describe('create + validation', () => {
    test('creates a program as admin', async () => {
      const { res, payload } = await createProgram();
      assert.equal(res.status, 201);
      assert.equal(res.body.data.program.code, payload.code);
      assert.equal(res.body.data.program.degreeType, 'bachelor');
      assert.equal(res.body.data.program.department.id, csDepartmentId);
    });

    test('rejects a duplicate code with 409', async () => {
      const { payload } = await createProgram();
      const dup = await authed(request(app).post(`${BASE}/programs`)).send({
        departmentId: csDepartmentId,
        code: payload.code,
        name: tempName(),
      });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, 'DUPLICATE_PROGRAM_CODE');
    });

    test('rejects an invalid department with 400', async () => {
      const res = await authed(request(app).post(`${BASE}/programs`)).send({
        departmentId: 999999,
        code: tempCode(),
        name: tempName(),
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'departmentId'));
    });

    test('rejects an invalid degreeType with 400', async () => {
      const res = await authed(request(app).post(`${BASE}/programs`)).send({
        departmentId: csDepartmentId,
        code: tempCode(),
        name: tempName(),
        degreeType: 'associate',
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'degreeType'));
    });

    test('rejects an out-of-range durationYears with 400', async () => {
      const res = await authed(request(app).post(`${BASE}/programs`)).send({
        departmentId: csDepartmentId,
        code: tempCode(),
        name: tempName(),
        durationYears: 99,
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'durationYears'));
    });
  });

  describe('read + filter + update', () => {
    test('filters programs by department', async () => {
      const res = await authed(request(app).get(`${BASE}/programs?departmentId=${csDepartmentId}&limit=50`));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.length >= 1);
      assert.ok(res.body.data.items.every((p) => p.department && p.department.id === csDepartmentId));
    });

    test('returns 404 for an unknown program', async () => {
      const res = await authed(request(app).get(`${BASE}/programs/999999`));
      assert.equal(res.status, 404);
      assert.equal(res.body.code, 'PROGRAM_NOT_FOUND');
    });

    test('updates a program', async () => {
      const { res: created } = await createProgram();
      const id = created.body.data.program.id;
      const res = await authed(request(app).patch(`${BASE}/programs/${id}`)).send({
        name: `${tempName()} Updated`,
        degreeType: 'master',
        durationYears: 2,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.program.degreeType, 'master');
      assert.equal(res.body.data.program.durationYears, 2);
    });

    test('deactivates a program', async () => {
      const { res: created } = await createProgram();
      const res = await authed(request(app).patch(`${BASE}/programs/${created.body.data.program.id}/status`)).send({
        isActive: false,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.program.isActive, false);
    });

    test('lists program options', async () => {
      const res = await authed(request(app).get(`${BASE}/programs/options?departmentId=${csDepartmentId}`));
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data.programs));
    });
  });
});
