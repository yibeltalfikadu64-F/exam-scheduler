'use strict';

/*
 * Phase 3 — Course management tests (CRUD, filters, prerequisites, scoping).
 * Non-destructive: uses the `P3C_` (courses) / `P3CPRG_` (programs) prefixes and
 * removes everything in `after()`.
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
const COURSE_PREFIX = 'P3C_';
const PROGRAM_PREFIX = 'P3CPRG_';

let adminToken;
let headToken;
let studentToken;
let csDepartmentId;
let seDepartmentId;
let csProgramId;
let seProgramId;

function authed(req, token = adminToken) {
  return req.set('Authorization', `Bearer ${token}`);
}

function rand() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function tempCode() {
  return `${COURSE_PREFIX}${rand()}`;
}

function tempTitle() {
  return `Phase3 Course ${rand()}`;
}

async function createCourse(overrides = {}) {
  const payload = {
    departmentId: csDepartmentId,
    programId: csProgramId,
    code: tempCode(),
    title: tempTitle(),
    credits: 3,
    ...overrides,
  };
  const res = await authed(request(app).post(`${BASE}/courses`)).send(payload);
  return { res, payload };
}

async function insertProgram(departmentId, code) {
  const [result] = await database
    .getPool()
    .query(
      "INSERT INTO programs (department_id, code, name, degree_type, duration_years) VALUES (?, ?, ?, 'bachelor', 4)",
      [departmentId, code, `Phase3 Course Program ${code}`]
    );
  return result.insertId;
}

describe('Phase 3 course management', () => {
  before(async () => {
    adminToken = (await request(app).post(`${BASE}/auth/login`).send(ADMIN)).body.data.token;
    headToken = (await request(app).post(`${BASE}/auth/login`).send({ username: 'head_cs', password: DEMO_PASSWORD })).body.data.token;
    studentToken = (await request(app).post(`${BASE}/auth/login`).send({ username: 'student1', password: DEMO_PASSWORD })).body.data.token;

    const [rows] = await database.getPool().query("SELECT id, code FROM departments WHERE code IN ('CS','SE')");
    csDepartmentId = rows.find((row) => row.code === 'CS').id;
    seDepartmentId = rows.find((row) => row.code === 'SE').id;

    csProgramId = await insertProgram(csDepartmentId, `${PROGRAM_PREFIX}${rand()}`);
    seProgramId = await insertProgram(seDepartmentId, `${PROGRAM_PREFIX}${rand()}`);
  });

  after(async () => {
    await database.getPool().query('DELETE FROM courses WHERE code LIKE ?', [`${COURSE_PREFIX}%`]);
    await database.getPool().query('DELETE FROM programs WHERE code LIKE ?', [`${PROGRAM_PREFIX}%`]);
    await database
      .getPool()
      .query(
        "DELETE FROM audit_logs WHERE entity_type = 'course' AND entity_id IN (SELECT id FROM (SELECT id FROM courses WHERE code LIKE ?) x)",
        [`${COURSE_PREFIX}%`]
      );
    await database.closePool();
  });

  describe('authorization + department scope', () => {
    test('forbids a student from creating a course (403)', async () => {
      const res = await authed(request(app).post(`${BASE}/courses`), studentToken).send({
        departmentId: csDepartmentId,
        code: tempCode(),
        title: tempTitle(),
      });
      assert.equal(res.status, 403);
    });

    test('lets a department head create a course in their department', async () => {
      const res = await authed(request(app).post(`${BASE}/courses`), headToken).send({
        departmentId: csDepartmentId,
        code: tempCode(),
        title: tempTitle(),
      });
      assert.equal(res.status, 201);
    });

    test('blocks a department head from another department (403 DEPARTMENT_SCOPE)', async () => {
      const res = await authed(request(app).post(`${BASE}/courses`), headToken).send({
        departmentId: seDepartmentId,
        code: tempCode(),
        title: tempTitle(),
      });
      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'DEPARTMENT_SCOPE');
    });
  });

  describe('create + validation', () => {
    test('creates a course as admin with a program', async () => {
      const { res, payload } = await createCourse();
      assert.equal(res.status, 201);
      assert.equal(res.body.data.course.code, payload.code);
      assert.equal(res.body.data.course.credits, 3);
      assert.equal(res.body.data.course.program.id, csProgramId);
    });

    test('rejects a duplicate code with 409', async () => {
      const { payload } = await createCourse();
      const dup = await authed(request(app).post(`${BASE}/courses`)).send({
        departmentId: csDepartmentId,
        code: payload.code,
        title: tempTitle(),
      });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, 'DUPLICATE_COURSE_CODE');
    });

    test('rejects out-of-range credits with 400', async () => {
      const res = await authed(request(app).post(`${BASE}/courses`)).send({
        departmentId: csDepartmentId,
        code: tempCode(),
        title: tempTitle(),
        credits: 999,
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'credits'));
    });

    test('rejects a program from a different department with 400', async () => {
      const res = await authed(request(app).post(`${BASE}/courses`)).send({
        departmentId: csDepartmentId,
        programId: seProgramId,
        code: tempCode(),
        title: tempTitle(),
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'programId'));
    });

    test('rejects a non-existent department with 400', async () => {
      const res = await authed(request(app).post(`${BASE}/courses`)).send({
        departmentId: 999999,
        code: tempCode(),
        title: tempTitle(),
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'departmentId'));
    });
  });

  describe('read + filter + update', () => {
    test('filters courses by department and search', async () => {
      const { payload } = await createCourse();
      const res = await authed(
        request(app).get(`${BASE}/courses?departmentId=${csDepartmentId}&search=${encodeURIComponent(payload.code)}`)
      );
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.some((c) => c.code === payload.code));
      assert.ok(res.body.data.items.every((c) => c.department.id === csDepartmentId));
    });

    test('returns 404 for an unknown course', async () => {
      const res = await authed(request(app).get(`${BASE}/courses/999999`));
      assert.equal(res.status, 404);
      assert.equal(res.body.code, 'COURSE_NOT_FOUND');
    });

    test('updates a course', async () => {
      const { res: created } = await createCourse();
      const id = created.body.data.course.id;
      const res = await authed(request(app).patch(`${BASE}/courses/${id}`)).send({
        title: `${tempTitle()} Updated`,
        credits: 5,
      });
      assert.equal(res.status, 200);
      assert.match(res.body.data.course.title, /Updated$/);
      assert.equal(res.body.data.course.credits, 5);
    });

    test('deactivates a course', async () => {
      const { res: created } = await createCourse();
      const res = await authed(request(app).patch(`${BASE}/courses/${created.body.data.course.id}/status`)).send({
        isActive: false,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.course.isActive, false);
    });

    test('lists course options filtered by department', async () => {
      const res = await authed(request(app).get(`${BASE}/courses/options?departmentId=${csDepartmentId}`));
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data.courses));
      assert.ok(res.body.data.courses.every((c) => c.department_id === csDepartmentId));
    });
  });

  describe('prerequisites', () => {
    test('sets and reads prerequisites', async () => {
      const { res: base } = await createCourse();
      const { res: prereq } = await createCourse();
      const baseId = base.body.data.course.id;
      const prereqId = prereq.body.data.course.id;

      const put = await authed(request(app).put(`${BASE}/courses/${baseId}/prerequisites`)).send({
        prerequisiteIds: [prereqId],
      });
      assert.equal(put.status, 200);
      assert.equal(put.body.data.course.prerequisiteCount, 1);
      assert.equal(put.body.data.course.prerequisites[0].id, prereqId);

      const get = await authed(request(app).get(`${BASE}/courses/${baseId}/prerequisites`));
      assert.equal(get.status, 200);
      assert.equal(get.body.data.prerequisites.length, 1);
    });

    test('rejects a self-prerequisite with 400', async () => {
      const { res: created } = await createCourse();
      const id = created.body.data.course.id;
      const res = await authed(request(app).put(`${BASE}/courses/${id}/prerequisites`)).send({ prerequisiteIds: [id] });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'prerequisiteIds'));
    });

    test('rejects duplicate prerequisite ids with 400', async () => {
      const { res: created } = await createCourse();
      const { res: other } = await createCourse();
      const id = created.body.data.course.id;
      const otherId = other.body.data.course.id;
      const res = await authed(request(app).put(`${BASE}/courses/${id}/prerequisites`)).send({
        prerequisiteIds: [otherId, otherId],
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'prerequisiteIds'));
    });

    test('rejects a non-existent prerequisite with 400', async () => {
      const { res: created } = await createCourse();
      const id = created.body.data.course.id;
      const res = await authed(request(app).put(`${BASE}/courses/${id}/prerequisites`)).send({ prerequisiteIds: [999999] });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'prerequisiteIds'));
    });

    test('clears prerequisites when given an empty list', async () => {
      const { res: base } = await createCourse();
      const { res: prereq } = await createCourse();
      const baseId = base.body.data.course.id;
      const prereqId = prereq.body.data.course.id;

      await authed(request(app).put(`${BASE}/courses/${baseId}/prerequisites`)).send({ prerequisiteIds: [prereqId] });
      const cleared = await authed(request(app).put(`${BASE}/courses/${baseId}/prerequisites`)).send({ prerequisiteIds: [] });
      assert.equal(cleared.status, 200);
      assert.equal(cleared.body.data.course.prerequisites.length, 0);
    });
  });
});
