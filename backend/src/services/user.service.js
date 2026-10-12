'use strict';

/**
 * User-management domain logic.
 *
 * Responsibilities:
 * - List users with pagination, search, role and status filters.
 * - Read, create and update users (bcrypt-hashed passwords only).
 * - Activate / deactivate accounts and reset passwords securely.
 *
 * Security invariants enforced here (not just in the UI):
 * - Passwords are always bcrypt-hashed and never returned.
 * - Only whitelisted, parameterized columns are ever interpolated into SQL.
 * - An administrator can neither change their own role nor deactivate their
 *   own account, and the last active administrator cannot be removed.
 */

const bcrypt = require('bcryptjs');

const config = require('../config/environment');
const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');
const { ROLES } = require('../validators/user.validator');

const SORT_COLUMNS = {
  created_at: 'u.created_at',
  username: 'u.username',
  email: 'u.email',
  full_name: 'u.full_name',
  role: 'u.role',
  is_active: 'u.is_active',
  last_login: 'u.last_login',
};

const UPDATE_COLUMNS = {
  username: 'username',
  email: 'email',
  fullName: 'full_name',
  role: 'role',
  departmentId: 'department_id',
  phone: 'phone',
  isActive: 'is_active',
  isVerified: 'is_verified',
};

const SELECT_COLUMNS = [
  'u.id',
  'u.uuid',
  'u.username',
  'u.email',
  'u.full_name',
  'u.role',
  'u.department_id',
  'u.phone',
  'u.is_active',
  'u.is_verified',
  'u.last_login',
  'u.account_locked_until',
  'u.created_at',
  'u.updated_at',
  'd.name AS department_name',
  'd.code AS department_code',
].join(', ');

/** Map a (joined) row to the safe public shape. Never includes password_hash. */
function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    phone: row.phone,
    isActive: Boolean(row.is_active),
    isVerified: Boolean(row.is_verified),
    lastLogin: row.last_login,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    department:
      row.department_id && row.department_name
        ? { id: row.department_id, name: row.department_name, code: row.department_code }
        : null,
  };
}

function buildFilters({ search, role, status }) {
  const clauses = ['u.deleted_at IS NULL'];
  const params = [];

  if (search) {
    const like = `%${search}%`;
    clauses.push('(u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ? OR u.phone LIKE ?)');
    params.push(like, like, like, like);
  }
  if (role) {
    clauses.push('u.role = ?');
    params.push(role);
  }
  if (status === 'active') clauses.push('u.is_active = 1');
  if (status === 'inactive') clauses.push('u.is_active = 0');

  return { where: clauses.join(' AND '), params };
}

async function listUsers(query) {
  const { page, limit, search, role, status, sort, order } = query;
  const { where, params } = buildFilters({ search, role, status });
  const offset = (page - 1) * limit;
  const column = SORT_COLUMNS[sort] || SORT_COLUMNS.created_at;
  const direction = order === 'asc' ? 'ASC' : 'DESC';

  const [countRows] = await database
    .getPool()
    .query(`SELECT COUNT(*) AS total FROM users u WHERE ${where}`, params);
  const total = Number(countRows[0].total);

  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${SELECT_COLUMNS}
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE ${where}
       ORDER BY ${column} ${direction}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

  return {
    items: rows.map(toPublicUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: offset + rows.length < total,
      hasPrev: page > 1,
    },
  };
}

async function listOptions() {
  const [departments] = await database
    .getPool()
    .query('SELECT id, name, code FROM departments WHERE is_active = 1 ORDER BY name ASC');
  return { roles: ROLES, departments };
}

async function getPublicById(id) {
  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${SELECT_COLUMNS}
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = ? AND u.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );
  return rows[0] ? toPublicUser(rows[0]) : null;
}

/** Internal lookup used for guard checks (no join, no password hash). */
async function findGuardRow(id) {
  const [rows] = await database
    .getPool()
    .query(
      'SELECT id, username, email, full_name, role, department_id, phone, is_active, is_verified FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [id]
    );
  return rows[0] || null;
}

async function requireUser(id) {
  const user = await findGuardRow(id);
  if (!user) throw ApiError.notFound('User not found.', { code: 'USER_NOT_FOUND' });
  return user;
}

async function assertDepartmentExists(departmentId) {
  if (departmentId === null || departmentId === undefined) return;
  const [rows] = await database.getPool().query('SELECT id FROM departments WHERE id = ? LIMIT 1', [departmentId]);
  if (!rows.length) {
    throw ApiError.badRequest('Validation failed.', {
      code: 'VALIDATION_ERROR',
      details: [{ field: 'departmentId', message: 'The selected department does not exist.' }],
    });
  }
}

async function assertUsernameFree(username, excludeId = null) {
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM users WHERE username = ? AND (? IS NULL OR id <> ?) LIMIT 1', [username, excludeId, excludeId]);
  if (rows.length) {
    throw ApiError.conflict('A user with this username already exists.', {
      code: 'DUPLICATE_USERNAME',
      details: [{ field: 'username', message: 'This username is already taken.' }],
    });
  }
}

async function assertEmailFree(email, excludeId = null) {
  const [rows] = await database
    .getPool()
    .query('SELECT id FROM users WHERE email = ? AND (? IS NULL OR id <> ?) LIMIT 1', [email, excludeId, excludeId]);
  if (rows.length) {
    throw ApiError.conflict('A user with this email already exists.', {
      code: 'DUPLICATE_EMAIL',
      details: [{ field: 'email', message: 'This email address is already registered.' }],
    });
  }
}

async function countOtherActiveAdmins(excludeId) {
  const [rows] = await database
    .getPool()
    .query(
      "SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = 1 AND deleted_at IS NULL AND id <> ?",
      [excludeId]
    );
  return Number(rows[0].total);
}

async function createUser(input, actor, meta) {
  await assertUsernameFree(input.username);
  await assertEmailFree(input.email);
  await assertDepartmentExists(input.departmentId);

  const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);

  let insertId;
  try {
    const [result] = await database.getPool().query(
      `INSERT INTO users
         (username, email, password_hash, full_name, role, department_id, phone, is_active, is_verified, last_password_change)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        input.username,
        input.email,
        passwordHash,
        input.fullName,
        input.role,
        input.departmentId,
        input.phone,
        input.isActive === undefined ? 1 : Number(input.isActive),
        input.isVerified === undefined ? 1 : Number(input.isVerified),
      ]
    );
    insertId = result.insertId;
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A user with these unique details already exists.', { code: 'DUPLICATE_ENTRY' });
    }
    throw error;
  }

  const created = await getPublicById(insertId);
  await auditService.record({
    userId: actor.id,
    action: 'user.create',
    entityType: 'user',
    entityId: insertId,
    after: { username: created.username, email: created.email, role: created.role, isActive: created.isActive },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return created;
}

async function updateUser(id, input, actor, meta) {
  const target = await requireUser(id);
  const before = { ...target };

  if (input.username !== undefined) await assertUsernameFree(input.username, id);
  if (input.email !== undefined) await assertEmailFree(input.email, id);
  if (input.departmentId !== undefined) await assertDepartmentExists(input.departmentId);

  if (input.role !== undefined && input.role !== target.role) {
    if (id === actor.id) {
      throw ApiError.forbidden('You cannot change your own role. Ask another administrator.', {
        code: 'SELF_ROLE_CHANGE',
      });
    }
    if (target.role === 'admin' && (await countOtherActiveAdmins(id)) === 0) {
      throw ApiError.conflict('This is the last active administrator and cannot be demoted.', {
        code: 'LAST_ADMIN',
      });
    }
  }

  const sets = [];
  const params = [];
  Object.entries(UPDATE_COLUMNS).forEach(([key, column]) => {
    if (input[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(typeof input[key] === 'boolean' ? Number(input[key]) : input[key]);
    }
  });

  if (sets.length === 0) return getPublicById(id);

  sets.push('updated_at = NOW()');
  params.push(id);

  try {
    await database.getPool().query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      throw ApiError.conflict('A user with these unique details already exists.', { code: 'DUPLICATE_ENTRY' });
    }
    throw error;
  }

  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: 'user.update',
    entityType: 'user',
    entityId: id,
    before: { username: before.username, email: before.email, role: before.role, isActive: Boolean(before.is_active) },
    after: { username: updated.username, email: updated.email, role: updated.role, isActive: updated.isActive },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function setUserStatus(id, isActive, actor, meta) {
  const target = await requireUser(id);

  if (!isActive) {
    if (id === actor.id) {
      throw ApiError.forbidden('You cannot deactivate your own account.', { code: 'SELF_DEACTIVATE' });
    }
    if (target.role === 'admin' && target.is_active && (await countOtherActiveAdmins(id)) === 0) {
      throw ApiError.conflict('The last active administrator cannot be deactivated.', { code: 'LAST_ADMIN' });
    }
  }

  await database.getPool().query('UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?', [
    Number(isActive),
    id,
  ]);

  const updated = await getPublicById(id);
  await auditService.record({
    userId: actor.id,
    action: isActive ? 'user.activate' : 'user.deactivate',
    entityType: 'user',
    entityId: id,
    before: { isActive: Boolean(target.is_active) },
    after: { isActive: updated.isActive },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });
  return updated;
}

async function resetPassword(id, newPassword, actor, meta) {
  await requireUser(id);

  const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  await database
    .getPool()
    .query(
      `UPDATE users
       SET password_hash = ?, last_password_change = NOW(), failed_login_attempts = 0, account_locked_until = NULL, updated_at = NOW()
       WHERE id = ?`,
      [passwordHash, id]
    );

  await auditService.record({
    userId: actor.id,
    action: 'user.password_reset',
    entityType: 'user',
    entityId: id,
    after: { passwordReset: true },
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return getPublicById(id);
}

module.exports = {
  listUsers,
  listOptions,
  getPublicById,
  createUser,
  updateUser,
  setUserStatus,
  resetPassword,
};
