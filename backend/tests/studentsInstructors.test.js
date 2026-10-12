'use strict';

/*
 * Phase 3 — Student + instructor management tests (CRUD, scoping, enrollments).
 * Non-destructive: creates `p3test_` users, `P3S_` students, `P3I_` instructors,
 * `P3SI_` courses and `P3SIP_` programs, and removes everything in `after()`.
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

const STUDENT_PREFIX = 'P3S_';
const STAFF_PREFIX = 'P3I_';
const COURSE_PREFIX = 'P3SI_';
const PROGRAM_PREFIX = 'P3SIP_';
const USER_PREFIX = 'p3test_';

let adminToken;
let headToken;
let studentToken;
let csDepartmentId;
let seDepartmentId;
let csProgramId;
let seProgramId;
let courseId;
let openSectionId;
let tinySectionId;

let instructorUserA;
let instructorUserB;
let instructorUserC;
let instructorUserD;
let studentUserA;

const studentIds = [];
const instructorIds = [];
const enrollmentIds = [];
const courseIds = [];
const sectionIds = [];
const programIds = [];
const userIds = [];

function authed(req, token = adminToken) {
  return req.set('Authorization', `Bearer ${token}`);
}

function rand() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function insertUser(role, suffix) {
  const username = `${USER_PREFIX}${role}_${suffix}`;
  const [result] = await database
    .getPool()
    .query(
      "INSERT INTO users (username, email, password_hash, full_name, role, is_active, is_verified) VALUES (?, ?, 'x', ?, ?, 1, 1)",
      [username, `${username}@example.test`, `Phase3 Test ${role} ${suffix}`, role]
    );
  userIds.push(result.insertId);
  return result.insertId;
}

async function createProgram(departmentId, code) {
  const res = await authed(request(app).post(`${BASE}/programs`)).send({
    departmentId,
    code,
    name: `Phase3 S&I Program ${code}`,
  });
  if (res.status === 201) programIds.push(res.body.data.program.id);
  return res;
}

async function createCourse(code) {
  const res = await authed(request(app).post(`${BASE}/courses`)).send({
    departmentId: csDepartmentId,
    programId: csProgramId,
    code,
    title: `Phase3 S&I Course ${code}`,
    credits: 3,
  });
  if (res.status === 201) courseIds.push(res.body.data.course.id);
  return res;
}

async function createSection(payload, token = adminToken) {
  const res = await authed(request(app).post(`${BASE}/sections`), token).send(payload);
  if (res.status === 201) sectionIds.push(res.body.data.section.id);
  return res;
}

async function createStudent(overrides = {}, token = adminToken) {
  const payload = {
    studentNumber: `${STUDENT_PREFIX}${rand()}`,
    fullName: `Phase3 Student ${rand()}`,
    programId: csProgramId,
    year: 1,
    ...overrides,
  };
  const res = await authed(request(app).post(`${BASE}/students`), token).send(payload);
  if (res.status === 201) studentIds.push(res.body.data.student.id);
  return { res, payload };
}

async function createInstructor(payload, token = adminToken) {
  const res = await authed(request(app).post(`${BASE}/instructors`), token).send(payload);
  if (res.status === 201) instructorIds.push(res.body.data.instructor.id);
  return res;
}

async function enroll(studentId, sectionId) {
  const res = await authed(request(app).post(`${BASE}/students/${studentId}/enrollments`)).send({ sectionId });
  if (res.status === 201) enrollmentIds.push(res.body.data.enrollment.id);
  return res;
}

async function deleteByIds(table, ids) {
  const filtered = ids.filter((id) => id);
  if (!filtered.length) return;
  await database
    .getPool()
    .query(`DELETE FROM ${table} WHERE id IN (${filtered.map(() => '?').join(', ')})`, filtered);
}

describe('Phase 3 student + instructor management', () => {
  before(async () => {
    adminToken = (await request(app).post(`${BASE}/auth/login`).send(ADMIN)).body.data.token;
    headToken = (await request(app).post(`${BASE}/auth/login`).send({ username: 'head_cs', password: DEMO_PASSWORD })).body.data.token;
    studentToken = (await request(app).post(`${BASE}/auth/login`).send({ username: 'student1', password: DEMO_PASSWORD })).body.data.token;

    const [departments] = await database.getPool().query("SELECT id, code FROM departments WHERE code IN ('CS','SE')");
    csDepartmentId = departments.find((row) => row.code === 'CS').id;
    seDepartmentId = departments.find((row) => row.code === 'SE').id;

    csProgramId = (await createProgram(csDepartmentId, `${PROGRAM_PREFIX}CS_${rand()}`)).body.data.program.id;
    seProgramId = (await createProgram(seDepartmentId, `${PROGRAM_PREFIX}SE_${rand()}`)).body.data.program.id;

    const suffix = rand();
    instructorUserA = await insertUser('instructor', `A_${suffix}`);
    instructorUserB = await insertUser('instructor', `B_${suffix}`);
    instructorUserC = await insertUser('instructor', `C_${suffix}`);
    instructorUserD = await insertUser('instructor', `D_${suffix}`);
    studentUserA = await insertUser('student', `A_${suffix}`);

    courseId = (await createCourse(`${COURSE_PREFIX}${rand()}`)).body.data.course.id;
    openSectionId = (await createSection({ courseId, term: 'P3SITERM', section: 'OPEN', capacity: 50 })).body.data.section.id;
    tinySectionId = (await createSection({ courseId, term: 'P3SITERM', section: 'TINY', capacity: 1 })).body.data.section.id;
  });

  after(async () => {
    const pairs = [
      ...studentIds.map((id) => ['student', id]),
      ...instructorIds.map((id) => ['instructor', id]),
      ...enrollmentIds.map((id) => ['enrollment', id]),
      ...courseIds.map((id) => ['course', id]),
      ...sectionIds.map((id) => ['section', id]),
      ...programIds.map((id) => ['program', id]),
    ];
    if (pairs.length) {
      const sql = `DELETE FROM audit_logs WHERE ${pairs.map(() => '(entity_type = ? AND entity_id = ?)').join(' OR ')}`;
      await database.getPool().query(sql, pairs.flat());
    }

    await deleteByIds('students', studentIds);
    await deleteByIds('instructors', instructorIds);
    await deleteByIds('courses', courseIds);
    await deleteByIds('programs', programIds);
    await deleteByIds('users', userIds);
    await database.closePool();
  });

  describe('authorization', () => {
    test('forbids a student from listing students (403)', async () => {
      const res = await authed(request(app).get(`${BASE}/students`), studentToken);
      assert.equal(res.status, 403);
    });

    test('forbids a student from listing instructors (403)', async () => {
      const res = await authed(request(app).get(`${BASE}/instructors`), studentToken);
      assert.equal(res.status, 403);
    });
  });

  describe('students', () => {
    test('creates and reads a student', async () => {
      const { res, payload } = await createStudent();
      assert.equal(res.status, 201);
      assert.equal(res.body.data.student.studentNumber, payload.studentNumber);
      assert.equal(res.body.data.student.program.id, csProgramId);
      assert.equal(res.body.data.student.department.id, csDepartmentId);
      assert.equal(res.body.data.student.hasAccount, false);
    });

    test('links an existing student account and rejects re-use', async () => {
      const first = await createStudent({ userId: studentUserA });
      assert.equal(first.res.status, 201);
      assert.equal(first.res.body.data.student.hasAccount, true);

      const second = await createStudent({ userId: studentUserA });
      assert.equal(second.res.status, 409);
      assert.equal(second.res.body.code, 'DUPLICATE_STUDENT_ACCOUNT');
    });

    test('rejects a duplicate student number with 409', async () => {
      const { payload } = await createStudent();
      const dup = await authed(request(app).post(`${BASE}/students`)).send({
        studentNumber: payload.studentNumber,
        fullName: 'Phase3 Duplicate',
      });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, 'DUPLICATE_STUDENT_NUMBER');
    });

    test('rejects a non-student account link with 400', async () => {
      const res = await authed(request(app).post(`${BASE}/students`)).send({
        studentNumber: `${STUDENT_PREFIX}${rand()}`,
        fullName: 'Phase3 Bad Link',
        userId: instructorUserA,
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'userId'));
    });

    test('rejects an unknown program with 400', async () => {
      const res = await authed(request(app).post(`${BASE}/students`)).send({
        studentNumber: `${STUDENT_PREFIX}${rand()}`,
        fullName: 'Phase3 Bad Program',
        programId: 999999,
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'programId'));
    });

    test('filters students by program and status', async () => {
      const { payload } = await createStudent();
      const res = await authed(request(app).get(`${BASE}/students?programId=${csProgramId}&status=active&search=${encodeURIComponent(payload.studentNumber)}`));
      assert.equal(res.status, 200);
      assert.ok(res.body.data.items.some((s) => s.studentNumber === payload.studentNumber));
      assert.ok(res.body.data.items.every((s) => s.status === 'active'));
    });

    test('updates a student and changes status', async () => {
      const { res: created } = await createStudent();
      const id = created.body.data.student.id;

      const updated = await authed(request(app).patch(`${BASE}/students/${id}`)).send({ year: 2, fullName: `Phase3 Renamed ${rand()}` });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.data.student.year, 2);

      const status = await authed(request(app).patch(`${BASE}/students/${id}/status`)).send({ status: 'graduated' });
      assert.equal(status.status, 200);
      assert.equal(status.body.data.student.status, 'graduated');
    });

    test('restricts a department head to their own department', async () => {
      const own = await createStudent({}, headToken);
      assert.equal(own.res.status, 201);

      const foreign = await createStudent({ programId: seProgramId }, headToken);
      assert.equal(foreign.res.status, 403);
      assert.equal(foreign.res.body.code, 'DEPARTMENT_SCOPE');
    });
  });

  describe('enrollments', () => {
    test('enrolls a student, blocks duplicates and lists enrollments', async () => {
      const { res: created } = await createStudent();
      const studentId = created.body.data.student.id;

      const first = await enroll(studentId, openSectionId);
      assert.equal(first.status, 201);
      assert.equal(first.body.data.enrollment.status, 'enrolled');

      const dup = await enroll(studentId, openSectionId);
      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, 'ALREADY_ENROLLED');

      const list = await authed(request(app).get(`${BASE}/students/${studentId}/enrollments`));
      assert.equal(list.body.data.enrollments.length, 1);
    });

    test('drops an enrollment and reactivates it', async () => {
      const { res: created } = await createStudent();
      const studentId = created.body.data.student.id;
      const enrollment = await enroll(studentId, openSectionId);
      const enrollmentId = enrollment.body.data.enrollment.id;

      const dropped = await authed(request(app).patch(`${BASE}/students/${studentId}/enrollments/${enrollmentId}`)).send({ status: 'dropped' });
      assert.equal(dropped.status, 200);
      assert.equal(dropped.body.data.enrollment.status, 'dropped');

      const reactivated = await enroll(studentId, openSectionId);
      assert.equal(reactivated.status, 201);
      assert.equal(reactivated.body.data.enrollment.status, 'enrolled');
    });

    test('enforces section capacity', async () => {
      const first = await createStudent();
      const second = await createStudent();

      const ok = await enroll(first.res.body.data.student.id, tinySectionId);
      assert.equal(ok.status, 201);

      const full = await enroll(second.res.body.data.student.id, tinySectionId);
      assert.equal(full.status, 409);
      assert.equal(full.body.code, 'CAPACITY_EXCEEDED');
    });

    test('rejects enrolling in an unknown section with 400', async () => {
      const { res: created } = await createStudent();
      const bad = await enroll(created.body.data.student.id, 999999);
      assert.equal(bad.status, 400);
      assert.ok(bad.body.details.some((d) => d.field === 'sectionId'));
    });
  });

  describe('instructors', () => {
    test('creates an instructor profile', async () => {
      const res = await createInstructor({
        userId: instructorUserA,
        staffNumber: `${STAFF_PREFIX}${rand()}`,
        departmentId: csDepartmentId,
        title: 'Lecturer',
        expertise: 'Databases',
        maxLoadHours: 14,
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.instructor.user.id, instructorUserA);
      assert.equal(res.body.data.instructor.department.id, csDepartmentId);
    });

    test('rejects a duplicate staff number with 409', async () => {
      const created = await createInstructor({ userId: instructorUserB, staffNumber: `${STAFF_PREFIX}${rand()}` });
      const dup = await createInstructor({ userId: instructorUserC, staffNumber: created.body.data.instructor.staffNumber });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, 'DUPLICATE_STAFF_NUMBER');
    });

    test('rejects a second profile for the same user with 409', async () => {
      const { body } = await authed(request(app).get(`${BASE}/instructors?search=${STAFF_PREFIX}&limit=1`));
      const existingUserId = body.data.items[0].user.id;
      const dup = await createInstructor({ userId: existingUserId, staffNumber: `${STAFF_PREFIX}${rand()}` });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.code, 'DUPLICATE_INSTRUCTOR_USER');
    });

    test('rejects a non-instructor account with 400', async () => {
      const res = await createInstructor({ userId: studentUserA, staffNumber: `${STAFF_PREFIX}${rand()}` });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.some((d) => d.field === 'userId'));
    });

    test('filters, updates, deactivates and lists options', async () => {
      const created = await createInstructor({ userId: instructorUserC, staffNumber: `${STAFF_PREFIX}${rand()}`, departmentId: csDepartmentId });
      assert.equal(created.status, 201);

      const list = await authed(request(app).get(`${BASE}/instructors?departmentId=${csDepartmentId}&limit=100`));
      assert.equal(list.status, 200);
      assert.ok(list.body.data.items.every((i) => i.department.id === csDepartmentId));

      const target = list.body.data.items.find((i) => i.user.id === instructorUserC);
      assert.ok(target, 'expected the created instructor in the filtered list');

      const updated = await authed(request(app).patch(`${BASE}/instructors/${target.id}`)).send({ maxLoadHours: 20 });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.data.instructor.maxLoadHours, 20);

      const off = await authed(request(app).patch(`${BASE}/instructors/${target.id}/status`)).send({ isActive: false });
      assert.equal(off.status, 200);
      assert.equal(off.body.data.instructor.isActive, false);

      const options = await authed(request(app).get(`${BASE}/instructors/options?departmentId=${csDepartmentId}`));
      assert.equal(options.status, 200);
      assert.ok(Array.isArray(options.body.data.instructors));
    });

    test('restricts a department head to their own department', async () => {
      const own = await createInstructor({ userId: instructorUserD, staffNumber: `${STAFF_PREFIX}${rand()}`, departmentId: csDepartmentId }, headToken);
      assert.equal(own.status, 201);

      const foreign = await createInstructor({ userId: instructorUserB, staffNumber: `${STAFF_PREFIX}${rand()}`, departmentId: seDepartmentId }, headToken);
      assert.equal(foreign.status, 403);
      assert.equal(foreign.body.code, 'DEPARTMENT_SCOPE');
    });
  });
});
