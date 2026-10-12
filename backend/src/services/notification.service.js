'use strict';

/**
 * Notification service (Phase 6).
 *
 * A database-backed notification queue built on the existing `notifications`
 * table. Guarantees:
 *
 *   - Transactions: notifications for a change are INSERTed on the SAME
 *     connection/transaction as the change itself, so a rolled-back change never
 *     produces a notification.
 *   - Deduplication: every notification carries a `dedupe_key` (unique) so a
 *     retried request never inserts a duplicate.
 *   - In-app delivery is immediate (the row *is* the delivery).
 *   - Email is queued (`status='pending'`) inside the transaction and dispatched
 *     only AFTER the transaction commits, with safe retries and honest status.
 */

const database = require('../config/database');
const config = require('../config/environment');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const mailer = require('./mailer');
const { paginate } = require('../validators/shared');

const USER_CHANNEL = 'in_app';

function parseMeta(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function toPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    eventType: row.event_type || null,
    entityType: row.entity_type || null,
    entityId: row.entity_id || null,
    title: row.title,
    message: row.message,
    type: row.type,
    priority: row.priority,
    channel: row.channel,
    status: row.status,
    link: row.link || null,
    meta: parseMeta(row.meta),
    isRead: Boolean(row.read_at),
    readAt: row.read_at,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at,
    retryCount: row.retry_count || 0,
    lastError: row.last_error || null,
    createdAt: row.created_at,
  };
}

function buildDedupeKey({ eventType, entityType, entityId, userId, channel, dedupeKey, scope }) {
  if (dedupeKey) return String(dedupeKey).slice(0, 190);
  if (!eventType || entityId === null || entityId === undefined) return null;
  const parts = [eventType, entityType || 'none', entityId, userId, channel];
  if (scope) parts.push(scope);
  return parts.join(':').slice(0, 190);
}

/** Insert one notification idempotently. Returns { created, notification }. */
async function insertNotification(runner, input) {
  const dedupeKey = buildDedupeKey(input);
  const status = input.status || (input.channel === USER_CHANNEL ? 'sent' : 'pending');
  const [result] = await runner.query(
    `INSERT IGNORE INTO notifications
       (event_type, entity_type, entity_id, user_id, title, message, type, priority, channel, status, link, meta, dedupe_key, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.eventType || null,
      input.entityType || null,
      input.entityId !== undefined ? input.entityId : null,
      input.userId,
      input.title,
      input.message,
      input.type || 'info',
      input.priority || 'normal',
      input.channel,
      status,
      input.link || null,
      input.meta ? JSON.stringify(input.meta) : null,
      dedupeKey,
      status === 'sent' ? new Date() : null,
    ]
  );

  if (result.affectedRows > 0) {
    const [rows] = await runner.query('SELECT * FROM notifications WHERE id = ? LIMIT 1', [result.insertId]);
    return { created: true, notification: toPublic(rows[0]) };
  }

  if (dedupeKey) {
    const [rows] = await runner.query('SELECT * FROM notifications WHERE dedupe_key = ? LIMIT 1', [dedupeKey]);
    return { created: false, notification: rows[0] ? toPublic(rows[0]) : null };
  }
  return { created: false, notification: null };
}

/**
 * Create notifications for a set of recipients. Must be called with the
 * transaction connection of the change it announces.
 *
 * @returns {Promise<{created: Array, ids: Array<number>, emailQueued: number}>}
 */
async function createForEvent(runner, input) {
  const recipients = Array.isArray(input.recipients) ? input.recipients : [];
  const channels = [USER_CHANNEL];
  if (input.email !== false && mailer.isConfigured()) channels.push('email');

  const created = [];
  const ids = [];
  let emailQueued = 0;
  for (const recipient of recipients) {
    const userId = typeof recipient === 'object' && recipient !== null ? recipient.id : recipient;
    if (!userId) continue;
    for (const channel of channels) {
      // A caller-supplied dedupe key is scoped per recipient + channel so one
      // logical event never produces duplicates, while different recipients
      // still each get their own row.
      const dedupeKey = input.dedupeKey ? `${input.dedupeKey}:${userId}:${channel}`.slice(0, 190) : null;
      // eslint-disable-next-line no-await-in-loop
      const result = await insertNotification(runner, { ...input, userId, channel, dedupeKey });
      if (result.created && result.notification) {
        created.push(result.notification);
        ids.push(result.notification.id);
        if (channel === 'email') emailQueued += 1;
      }
    }
  }
  return { created, ids, emailQueued };
}

// ---------------------------------------------------------------------------
// User inbox (authorized: a user only ever sees their own rows)
// ---------------------------------------------------------------------------

async function listForUser(userId, query) {
  const clauses = ['n.user_id = ?'];
  const params = [userId];
  const channel = query.channel || USER_CHANNEL;
  if (channel !== 'all') {
    clauses.push('n.channel = ?');
    params.push(channel);
  }
  if (query.unread) clauses.push('n.read_at IS NULL');
  if (query.eventType) {
    clauses.push('n.event_type = ?');
    params.push(query.eventType);
  }
  const where = `WHERE ${clauses.join(' AND ')}`;
  const offset = (query.page - 1) * query.limit;

  const [countRows] = await database.getPool().query(`SELECT COUNT(*) AS total FROM notifications n ${where}`, params);
  const total = Number(countRows[0].total);
  const [rows] = await database
    .getPool()
    .query(`SELECT n.* FROM notifications n ${where} ORDER BY n.created_at DESC, n.id DESC LIMIT ? OFFSET ?`, [
      ...params,
      query.limit,
      offset,
    ]);

  return { items: rows.map(toPublic), pagination: paginate({ page: query.page, limit: query.limit, total }) };
}

async function unreadCount(userId) {
  const [rows] = await database
    .getPool()
    .query(`SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND channel = ? AND read_at IS NULL`, [userId, USER_CHANNEL]);
  return Number(rows[0].total);
}

async function markRead(userId, id) {
  const [result] = await database
    .getPool()
    .query('UPDATE notifications SET read_at = NOW(), updated_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL', [id, userId]);
  const [rows] = await database.getPool().query('SELECT * FROM notifications WHERE id = ? AND user_id = ? LIMIT 1', [id, userId]);
  if (!rows.length) throw ApiError.notFound('Notification not found.', { code: 'NOTIFICATION_NOT_FOUND' });
  return { changed: result.affectedRows > 0, notification: toPublic(rows[0]) };
}

async function markAllRead(userId) {
  const [result] = await database
    .getPool()
    .query(`UPDATE notifications SET read_at = NOW(), updated_at = NOW() WHERE user_id = ? AND channel = ? AND read_at IS NULL`, [
      userId,
      USER_CHANNEL,
    ]);
  return { updated: result.affectedRows };
}

// ---------------------------------------------------------------------------
// Email delivery + retries
// ---------------------------------------------------------------------------

function backoffDate(attempt) {
  const minutes = config.notifications.retryBackoffMinutes * Math.max(1, attempt);
  return new Date(Date.now() + minutes * 60000);
}

async function deliverEmailRow(row) {
  const runner = database.getPool();
  const [users] = await runner.query('SELECT email, is_active, deleted_at FROM users WHERE id = ? LIMIT 1', [row.user_id]);
  const user = users[0];

  let outcome;
  if (!user || user.deleted_at) {
    outcome = { delivered: false, permanent: true, error: 'The recipient account no longer exists.' };
  } else if (!user.email) {
    outcome = { delivered: false, permanent: true, error: 'The recipient has no email address on file.' };
  } else if (!user.is_active) {
    outcome = { delivered: false, permanent: true, error: 'The recipient account is inactive.' };
  } else {
    // eslint-disable-next-line no-await-in-loop
    outcome = await mailer.sendMail({ to: user.email, subject: row.title, text: row.message });
  }

  if (outcome.delivered) {
    await runner.query("UPDATE notifications SET status = 'sent', sent_at = NOW(), last_error = NULL, next_attempt_at = NULL, updated_at = NOW() WHERE id = ?", [row.id]);
    return { id: row.id, delivered: true };
  }

  const attempt = Number(row.retry_count || 0) + 1;
  const max = config.notifications.maxRetries;
  const permanent = outcome.permanent || outcome.skipped;
  const exhausted = permanent || attempt >= max;
  const safeError = (outcome.error || 'Email delivery failed.').slice(0, 480);

  if (exhausted) {
    await runner.query("UPDATE notifications SET status = 'failed', retry_count = ?, last_error = ?, next_attempt_at = NULL, updated_at = NOW() WHERE id = ?", [
      attempt,
      safeError,
      row.id,
    ]);
    return { id: row.id, delivered: false, failed: true, error: safeError };
  }

  await runner.query("UPDATE notifications SET status = 'pending', retry_count = ?, last_error = ?, next_attempt_at = ?, updated_at = NOW() WHERE id = ?", [
    attempt,
    safeError,
    backoffDate(attempt),
    row.id,
  ]);
  return { id: row.id, delivered: false, retry: true, error: safeError };
}

/**
 * Attempt delivery for pending/failed email rows whose retry window is due.
 * Never throws; intended to run after a transaction commits or from a worker.
 */
async function dispatchPending({ ids = null, limit = config.notifications.dispatchBatchSize } = {}) {
  const runner = database.getPool();
  const clauses = ["channel = 'email'", "status IN ('pending','failed')", 'retry_count < ?', '(next_attempt_at IS NULL OR next_attempt_at <= NOW())'];
  const params = [config.notifications.maxRetries];
  if (Array.isArray(ids) && ids.length) {
    clauses.push(`id IN (${ids.map(() => '?').join(', ')})`);
    params.push(...ids);
  }

  let rows = [];
  try {
    const [result] = await runner.query(
      `SELECT id, user_id, title, message, retry_count FROM notifications WHERE ${clauses.join(' AND ')} ORDER BY id ASC LIMIT ?`,
      [...params, limit]
    );
    rows = result;
  } catch (error) {
    logger.warn(`[notifications] Could not load the email queue: ${error.message}`);
    return { attempted: 0, delivered: 0, retried: 0, failed: 0 };
  }

  const summary = { attempted: rows.length, delivered: 0, retried: 0, failed: 0 };
  for (const row of rows) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const outcome = await deliverEmailRow(row);
      if (outcome.delivered) summary.delivered += 1;
      else if (outcome.retry) summary.retried += 1;
      else summary.failed += 1;
    } catch (error) {
      logger.warn(`[notifications] Delivery error for #${row.id}: ${error.message}`);
      summary.failed += 1;
    }
  }
  return summary;
}

async function listQueue(query) {
  const clauses = [];
  const params = [];
  if (query.status) {
    clauses.push('n.status = ?');
    params.push(query.status);
  }
  if (query.channel) {
    clauses.push('n.channel = ?');
    params.push(query.channel);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (query.page - 1) * query.limit;

  const [countRows] = await database.getPool().query(`SELECT COUNT(*) AS total FROM notifications n ${where}`, params);
  const total = Number(countRows[0].total);
  const [rows] = await database
    .getPool()
    .query(
      `SELECT n.id, n.uuid, n.event_type, n.channel, n.status, n.retry_count, n.last_error, n.next_attempt_at,
              n.sent_at, n.created_at, u.full_name AS recipient_name, u.email AS recipient_email
       FROM notifications n LEFT JOIN users u ON u.id = n.user_id
       ${where} ORDER BY n.id DESC LIMIT ? OFFSET ?`,
      [...params, query.limit, offset]
    );

  return {
    items: rows.map((row) => ({
      id: row.id,
      uuid: row.uuid,
      eventType: row.event_type,
      channel: row.channel,
      status: row.status,
      retryCount: row.retry_count,
      lastError: row.last_error,
      nextAttemptAt: row.next_attempt_at,
      sentAt: row.sent_at,
      createdAt: row.created_at,
      recipient: row.recipient_name || null,
      recipientEmail: row.recipient_email ? maskEmail(row.recipient_email) : null,
    })),
    pagination: paginate({ page: query.page, limit: query.limit, total }),
  };
}

function maskEmail(email) {
  const [name, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${name.slice(0, 2)}***@${domain}`;
}

// ---------------------------------------------------------------------------
// Domain recipients
// ---------------------------------------------------------------------------

/** Active user ids for the students enrolled in a section. */
async function recipientsForSection(runner, sectionId) {
  const [rows] = await runner.query(
    `SELECT DISTINCT u.id
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u ON u.id = s.user_id
     WHERE e.section_id = ? AND e.status = 'enrolled' AND u.is_active = 1 AND u.deleted_at IS NULL`,
    [sectionId]
  );
  return rows.map((row) => row.id);
}

/** Active user ids for the instructors teaching a section. */
async function instructorsForSection(runner, sectionId) {
  const [rows] = await runner.query(
    `SELECT DISTINCT u.id FROM (
        SELECT instructor_id AS uid FROM sections WHERE id = ?
        UNION
        SELECT i.user_id AS uid FROM instructor_assignments ia JOIN instructors i ON i.id = ia.instructor_id WHERE ia.section_id = ?
     ) t JOIN users u ON u.id = t.uid WHERE u.is_active = 1 AND u.deleted_at IS NULL`,
    [sectionId, sectionId]
  );
  return rows.map((row) => row.id);
}

/** Every active student + instructor account for a set of section ids. */
async function recipientsForSections(runner, sectionIds) {
  const unique = new Set();
  for (const sectionId of sectionIds) {
    const ids = await recipientsForSection(runner, sectionId);
    const teachers = await instructorsForSection(runner, sectionId);
    for (const id of [...ids, ...teachers]) unique.add(Number(id));
  }
  return [...unique];
}

/**
 * Schedule-level domain event (timetable published/cancelled, exam
 * rescheduled/removed) announced to the students and instructors of the
 * affected sections. Must run inside the change's transaction.
 */
async function createScheduleEvent(runner, input) {
  const sectionIds = Array.isArray(input.sectionIds) ? input.sectionIds.filter(Boolean) : [];
  if (!sectionIds.length) return { created: [], ids: [], emailQueued: 0 };
  const recipients = await recipientsForSections(runner, sectionIds);
  if (!recipients.length) return { created: [], ids: [], emailQueued: 0 };
  return createForEvent(runner, {
    eventType: input.eventType,
    entityType: 'exam_schedule',
    entityId: input.scheduleId,
    recipients,
    title: input.title,
    message: input.message,
    type: input.type || 'info',
    priority: input.priority || 'normal',
    link: input.link || null,
    meta: input.meta || null,
    dedupeKey: input.dedupeKey || null,
  });
}

module.exports = {
  createForEvent,
  insertNotification,
  listForUser,
  unreadCount,
  markRead,
  markAllRead,
  dispatchPending,
  listQueue,
  recipientsForSection,
  instructorsForSection,
  toPublic,
  _internals: { buildDedupeKey, maskEmail, backoffDate },
};
