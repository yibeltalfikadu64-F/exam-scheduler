
'use strict';

process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const database = require('../src/config/database');
const { executeReset } = require('../src/services/systemReset.service');

const CONFIRM = 'RESET OPERATIONAL DATA';

const EXPECTED_ORDER = [
  'invigilations',
  'schedule_conflicts',
  'exam_schedule_details',
  'exam_schedules',
  'exams',
];

function createFakeConnection(options = {}) {
  const calls = [];
  let transactionStarted = false;
  let committed = false;
  let rolledBack = false;
  let released = false;

  const connection = {
    async beginTransaction() {
      calls.push('BEGIN');
      transactionStarted = true;
    },

    async query(sql, params = []) {
      calls.push({ sql, params });

      if (sql.startsWith('SELECT COUNT(*)')) {
        return [[{ count: '3' }], []];
      }

      if (sql.startsWith('DELETE FROM')) {
        const table = sql.match(/DELETE FROM `([^`]+)`/)?.[1];

        if (options.failDeleteTable === table) {
          throw new Error('Simulated delete failure');
        }

        return [{ affectedRows: 3 }, []];
      }

      if (sql.includes('INSERT INTO audit_logs')) {
        if (options.failAuditInsert) {
          throw new Error('Simulated audit insert failure');
        }

        return [{ affectedRows: 1, insertId: 123 }, []];
      }

      throw new Error(`Unexpected SQL in mock: ${sql}`);
    },

    async commit() {
      calls.push('COMMIT');
      committed = true;
    },

    async rollback() {
      calls.push('ROLLBACK');
      rolledBack = true;
    },

    release() {
      calls.push('RELEASE');
      released = true;
    },
  };

  return {
    connection,
    calls,
    get state() {
      return {
        transactionStarted,
        committed,
        rolledBack,
        released,
      };
    },
  };
}

function mockPool(t, fake) {
  t.mock.method(database, 'getPool', () => ({
    getConnection: async () => fake.connection,
  }));
}

test('rejects incorrect confirmation without acquiring a connection', async (t) => {
  t.mock.method(database, 'getPool', () => {
    throw new Error('getPool must not be called');
  });

  await assert.rejects(
    executeReset({ confirm: 'wrong phrase', actor: { id: 1 }, meta: {} }),
    /Confirmation must be exactly/
  );
});

test('deletes only approved tables in order and audits before commit', async (t) => {
  const fake = createFakeConnection();
  mockPool(t, fake);

  const result = await executeReset({
    confirm: CONFIRM,
    actor: { id: 7 },
    meta: { ip: '127.0.0.1', userAgent: 'mock-test' },
  });

  const deleteTables = fake.calls
    .filter((call) => typeof call !== 'string' && call.sql.startsWith('DELETE FROM'))
    .map((call) => call.sql.match(/DELETE FROM `([^`]+)`/)?.[1]);

  assert.deepEqual(deleteTables, EXPECTED_ORDER);

  const auditIndex = fake.calls.findIndex(
    (call) => typeof call !== 'string' && call.sql.includes('INSERT INTO audit_logs')
  );
  const commitIndex = fake.calls.indexOf('COMMIT');

  assert.ok(auditIndex >= 0);
  assert.ok(commitIndex > auditIndex);

  const auditCall = fake.calls[auditIndex];
  assert.equal(auditCall.params[0], 7);
  assert.equal(auditCall.params[1], 'system.reset');

  const afterData = JSON.parse(auditCall.params[5]);
  assert.deepEqual(afterData.scope, EXPECTED_ORDER);

  assert.equal(result.success, true);
  assert.deepEqual(result.scope, EXPECTED_ORDER);
  assert.equal(fake.state.committed, true);
  assert.equal(fake.state.rolledBack, false);
  assert.equal(fake.state.released, true);
});

test('rolls back and releases the connection if a delete fails', async (t) => {
  const fake = createFakeConnection({
    failDeleteTable: 'exam_schedule_details',
  });
  mockPool(t, fake);

  await assert.rejects(
    executeReset({
      confirm: CONFIRM,
      actor: { id: 7 },
      meta: {},
    }),
    /Simulated delete failure/
  );

  assert.equal(fake.state.committed, false);
  assert.equal(fake.state.rolledBack, true);
  assert.equal(fake.state.released, true);
  assert.ok(fake.calls.includes('ROLLBACK'));
  assert.ok(!fake.calls.includes('COMMIT'));
});

test('rolls back and releases the connection if audit insertion fails', async (t) => {
  const fake = createFakeConnection({ failAuditInsert: true });
  mockPool(t, fake);

  await assert.rejects(
    executeReset({
      confirm: CONFIRM,
      actor: { id: 7 },
      meta: {},
    }),
    /Simulated audit insert failure/
  );

  assert.equal(fake.state.committed, false);
  assert.equal(fake.state.rolledBack, true);
  assert.equal(fake.state.released, true);
  assert.ok(fake.calls.includes('ROLLBACK'));
  assert.ok(!fake.calls.includes('COMMIT'));
});
