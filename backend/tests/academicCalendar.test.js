'use strict';

/*
 * Phase 3 — Academic calendar (years + semesters) and section tests.
 * Non-destructive: creates a throwaway department tree (cascades on delete) and
 * explicit academic years, then removes everything in `after()`.
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

let adminToken;
let studentToken;
let departmentId;
let programId;
let courseId;
let academicYearId;
let semesterOneId;
let semesterTwoId;
const createdSectionIds = [];

function authed(req, token = adminToken) {
  return req.set('Authorization', `Bearer ${token}`);
}

function rand() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function createSection(payload) {
  const res = await authed(request(app).post(`${BASE}/sections`)).send(payload);
  if (res.status === 201) createdSectionIds.push(res.body.data.section.id);
  return res;
}

describe('Phase 3 academic calendar + sections', () => {
  before(async () => {
    adminToken = (await request(app).post(`${BASE}/auth/login`).send(ADMIN)).body.data.token;
    studentToken = (await request(app).post(`${BASE}/auth/login`).send({ username: 'student1', password: DEMO_PASSWORD })).body.data.token;

    const suffix = rand();
    const dept = await authed(request(app).post(`${BASE}/departments`)).send({ code: `P3AYD_${suffix}`, name: `Phase3 Calendar Dept ${suffix}` });
    departmentId = dept.body.data.department.id;

    const program = await authed(request(app).post(`${BASE}/programs`)).send({
      departmentId,
      code: `P3AYP_${suffix}`,
      name: `Phase3 Calendar Program ${suffix}`,
    });
    programId = program.body.data.program.id;

    const course = await authed(request(app).post(`${BASE}/courses`)).send({
      departmentId,
      programId,
      code: `P3AYC_${suffix}`,
      title: `Phase3 Calendar Course ${suffix}`,
      credits: 3,
    });
    courseId = course.body.data.course.id;

    const year = await authed(request(app).post(`${BASE}/academic-years`)).send({
      code: `P3AY_${suffix}`,
      name: `Phase3 Academic Year ${suffix}`,
      startDate: '2025-09-01',
      endDate: '2026-06-30',
    });
    academicYearId = year.body.data.academicYear.id;

    const s1 = await authed(request(app).post(`${BASE}/academic-years/${academicYearId}/semesters`)).send({
      name: 'First Semester',
      sequence: 1,
      startDate: '2025-09-01',
      endDate: '2026-01-31',
    });
    semesterOneId = s1.body.data.semester.id;

    const s2 = await authed(request(app).post(`${BASE}/academic-years/${academicYearId}/semesters`)).send({
      name: 'Second Semester',
      sequence: 2,
      startDate: '2026-02-15',
      endDate: '2026-06-30',
    });
    semesterTwoId = s2.body.data.semester.id;
  });

  after(async () => {
    const pairs = [
      ['department', departmentId],
      ['program', programId],
      ['course', courseId],
      ['academic_year', academicYearId],
      ['semester', semesterOneId],
      ['semester', semesterTwoId],
    ];
    createdSectionIds.forEach((id) => pairs.push(['section', id]));

    const filtered = pairs.filter(([, id]) => id);
    if (filtered.length) {
      const sql = `DELETE FROM audit_logs WHERE ${filtered.map(() => '(entity_type = ? AND entity_id = ?)').join(' OR ')}`;
      await database.getPool().query(sql, filtered.flat());
    }

    await database.getPool().query('DELETE FROM academic_years WHERE id = ?', [academicYearId]);
    await database.getPool().query('DELETE FROM departments WHERE id = ?', [departmentId]);
    await database.closePool();
  });

  describe('academic years', () => {
    test('creates, lists and reads an academic year', async () => {
      const list = await authed(request(app).get(`${BASE}/academic-years?search=${encodeURIComponent('Phase3 Academic Year')}`));
      assert.equal(list.status, 200);
      assert.ok(list.body.data.items.some((y) => y.id === academicYearId));
      assert.equal(list.body.data.items.find((y) => y.id === academicYearId).semesterCount, 2);

      const one = await authed(request(app).get(`${BASE}/academic-years/${academicYearId}`));
      assert.equal(one.status, 200);
      assert.equal(one.body.data.academicYear.startDate, '2025-09-01');
    });

    test('rejects a duplicate code with 409', async () => {
      const year = await authed(request(app).get(`${BASE}/academic-years/${academicYearId}`));
      const res = await authed(request(app).post(`${BASE}/academic-years`)).send({
        code: year.body.data.academicYear.code,
        name: `Phase3 Duplicate ${rand()}`,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.code, 'DUPLICATE_ACADEMIC_YEAR');
    });

    test('rejects an invalid date with 400', async () => {
      const res = await authed(request(app).post(`${BASE}/academic-years`)).send({
        code: `P3AY_${rand()}`,
        name: `Phase3 Bad Date ${rand()}`,
        startDate: '01-09-2025',
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'startDate'));
    });

    test('rejects an inverted date range with 400', async () => {
      const res = await authed(request(app).post(`${BASE}/academic-years`)).send({
        code: `P3AY_${rand()}`,
        name: `Phase3 Inverted ${rand()}`,
        startDate: '2026-06-01',
        endDate: '2025-01-01',
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'endDate'));
    });

    test('updates and deactivates an academic year', async () => {
      const created = await authed(request(app).post(`${BASE}/academic-years`)).send({ code: `P3AYT_${rand()}`, name: `Phase3 Temp ${rand()}` });
      const id = created.body.data.academicYear.id;

      const updated = await authed(request(app).patch(`${BASE}/academic-years/${id}`)).send({ name: `Phase3 Temp Renamed ${rand()}` });
      assert.equal(updated.status, 200);

      const off = await authed(request(app).patch(`${BASE}/academic-years/${id}/status`)).send({ isActive: false });
      assert.equal(off.status, 200);
      assert.equal(off.body.data.academicYear.isActive, false);

      await database.getPool().query('DELETE FROM academic_years WHERE id = ?', [id]);
      await database.getPool().query("DELETE FROM audit_logs WHERE entity_type = 'academic_year' AND entity_id = ?", [id]);
    });

    test('forbids a student from creating an academic year (403)', async () => {
      const res = await authed(request(app).post(`${BASE}/academic-years`), studentToken).send({ code: `P3AY_${rand()}`, name: `Nope ${rand()}` });
      assert.equal(res.status, 403);
    });
  });

  describe('semesters', () => {
    test('lists semesters for the year in sequence order', async () => {
      const res = await authed(request(app).get(`${BASE}/academic-years/${academicYearId}/semesters`));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.items.length, 2);
      assert.deepEqual(
        res.body.data.items.map((s) => s.sequence),
        [1, 2]
      );
    });

    test('rejects a duplicate sequence with 409', async () => {
      const res = await authed(request(app).post(`${BASE}/academic-years/${academicYearId}/semesters`)).send({
        name: `Phase3 Third ${rand()}`,
        sequence: 1,
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.code, 'DUPLICATE_SEMESTER');
    });

    test('rejects a semester outside the academic year range with 400', async () => {
      const res = await authed(request(app).post(`${BASE}/academic-years/${academicYearId}/semesters`)).send({
        name: `Phase3 OutOfRange ${rand()}`,
        sequence: 3,
        startDate: '2024-01-01',
        endDate: '2024-06-01',
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'startDate'));
    });
  });

  describe('sections', () => {
    test('creates a section and derives the term from the calendar', async () => {
      const res = await createSection({
        courseId,
        programId,
        academicYearId,
        semesterId: semesterOneId,
        section: `A${rand().slice(0, 3)}`,
        capacity: 40,
      });
      assert.equal(res.status, 201);
      assert.match(res.body.data.section.term, /S1$/);
      assert.equal(res.body.data.section.academicYear.id, academicYearId);
      assert.equal(res.body.data.section.semester.id, semesterOneId);
    });

    test('requires a term when no academic year/semester is given', async () => {
      const res = await createSection({ courseId, section: `B${rand().slice(0, 3)}`, capacity: 30 });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'term'));
    });

    test('rejects a semester without an academic year with 400', async () => {
      const res = await createSection({ courseId, semesterId: semesterOneId, section: `C${rand().slice(0, 3)}`, capacity: 30 });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'academicYearId'));
    });

    test('rejects a semester that belongs to another year with 400', async () => {
      const otherYear = await authed(request(app).post(`${BASE}/academic-years`)).send({ code: `P3AYO_${rand()}`, name: `Phase3 Other ${rand()}` });
      const otherYearId = otherYear.body.data.academicYear.id;
      const res = await createSection({
        courseId,
        academicYearId: otherYearId,
        semesterId: semesterOneId,
        section: `D${rand().slice(0, 3)}`,
        capacity: 30,
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'semesterId'));
      await database.getPool().query('DELETE FROM academic_years WHERE id = ?', [otherYearId]);
      await database.getPool().query("DELETE FROM audit_logs WHERE entity_type = 'academic_year' AND entity_id = ?", [otherYearId]);
    });

    test('rejects a duplicate section code for the same course/term with 409', async () => {
      const code = `E${rand().slice(0, 3)}`;
      const first = await createSection({ courseId, academicYearId, semesterId: semesterOneId, section: code, capacity: 25 });
      assert.equal(first.status, 201);
      const dup = await createSection({ courseId, academicYearId, semesterId: semesterOneId, section: code, capacity: 25 });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, 'DUPLICATE_SECTION');
    });

    test('rejects an invalid capacity with 400', async () => {
      const res = await createSection({ courseId, term: 'P3TERM', section: `F${rand().slice(0, 3)}`, capacity: 0 });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'capacity'));
    });

    test('rejects a non-course with 400', async () => {
      const res = await createSection({ courseId: 999999, term: 'P3TERM', section: `G${rand().slice(0, 3)}`, capacity: 30 });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'courseId'));
    });

    test('filters sections by course and updates capacity', async () => {
      const created = await createSection({ courseId, academicYearId, semesterId: semesterTwoId, section: `H${rand().slice(0, 3)}`, capacity: 50 });
      const id = created.body.data.section.id;

      const list = await authed(request(app).get(`${BASE}/sections?courseId=${courseId}&limit=50`));
      assert.equal(list.status, 200);
      assert.ok(list.body.data.items.every((s) => s.course.id === courseId));

      const updated = await authed(request(app).patch(`${BASE}/sections/${id}`)).send({ capacity: 60 });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.data.section.capacity, 60);

      const off = await authed(request(app).patch(`${BASE}/sections/${id}/status`)).send({ isActive: false });
      assert.equal(off.status, 200);
      assert.equal(off.body.data.section.isActive, false);
    });

    test('forbids a student from creating a section (403)', async () => {
      const res = await authed(request(app).post(`${BASE}/sections`), studentToken).send({
        courseId,
        term: 'P3TERM',
        section: `Z${rand().slice(0, 3)}`,
        capacity: 10,
      });
      assert.equal(res.status, 403);
    });
  });
});
