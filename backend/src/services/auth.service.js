'use strict';

/**
 * Authentication domain logic (login + current profile).
 *
 * - Passwords are verified with bcrypt against `users.password_hash`.
 * - Sessions are stateless JWTs signed with `JWT_SECRET`.
 * - Only safe, non-secret fields are ever returned to callers.
 * - All queries are parameterized.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const config = require('../config/environment');
const database = require('../config/database');
const ApiError = require('../utils/ApiError');

/**
 * A real bcrypt hash used to keep the response time of an unknown account
 * roughly equal to that of a wrong password (reduces timing-based user
 * enumeration). It corresponds to no real account.
 */
const DUMMY_PASSWORD_HASH = '$2b$10$TcHSXUX/9ddFn1RXULwgw.ShfXDLaRx3efpN643Qnik2ZNFO2t9ZC';

const GENERIC_LOGIN_MESSAGE = 'Invalid username or password.';

const USER_COLUMNS = [
  'id',
  'uuid',
  'username',
  'email',
  'password_hash',
  'full_name',
  'role',
  'department_id',
  'phone',
  'is_active',
  'is_verified',
  'last_login',
  'account_locked_until',
  'created_at',
].join(', ');

/** Map a database row to the safe user shape returned to clients. */
function toSafeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    departmentId: row.department_id,
    phone: row.phone,
    isActive: Boolean(row.is_active),
    isVerified: Boolean(row.is_verified),
    lastLogin: row.last_login,
    createdAt: row.created_at,
  };
}

async function findByIdentifier(identifier) {
  const [rows] = await database
    .getPool()
    .query(
      `SELECT ${USER_COLUMNS} FROM users WHERE (username = ? OR email = ?) AND deleted_at IS NULL LIMIT 1`,
      [identifier, identifier]
    );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await database
    .getPool()
    .query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`, [id]);
  return rows[0] || null;
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      departmentId: user.department_id || null,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn, algorithm: config.jwt.algorithm }
  );
}

/** Reject accounts that an administrator has deactivated or locked. */
function assertAccountUsable(user) {
  if (!user.is_active) {
    throw ApiError.forbidden('This account has been deactivated. Contact an administrator.', {
      code: 'ACCOUNT_INACTIVE',
    });
  }
  if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
    throw ApiError.forbidden('This account is temporarily locked. Try again later.', {
      code: 'ACCOUNT_LOCKED',
    });
  }
}

async function recordSuccessfulLogin(userId) {
  await database
    .getPool()
    .query('UPDATE users SET last_login = NOW(), failed_login_attempts = 0 WHERE id = ?', [userId]);
}

/** Best-effort bookkeeping; never allowed to break the auth flow. */
async function recordFailedLogin(userId) {
  try {
    await database
      .getPool()
      .query('UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?', [userId]);
  } catch (error) {
    // Intentionally ignored.
  }
}

/**
 * Authenticate a user and issue an access token.
 *
 * Unknown accounts and wrong passwords produce the exact same generic error,
 * so the response never reveals whether an account exists.
 */
async function login(identifier, password) {
  const user = await findByIdentifier(identifier);

  // Always run bcrypt (even for unknown accounts) to keep timing consistent.
  const hash = user ? user.password_hash : DUMMY_PASSWORD_HASH;
  const passwordMatches = await bcrypt.compare(password, hash).catch(() => false);

  if (!user || !passwordMatches) {
    if (user) await recordFailedLogin(user.id);
    throw ApiError.unauthorized(GENERIC_LOGIN_MESSAGE, { code: 'INVALID_CREDENTIALS' });
  }

  assertAccountUsable(user);

  const token = signAccessToken(user);
  await recordSuccessfulLogin(user.id);

  return {
    token,
    tokenType: 'Bearer',
    expiresIn: config.jwt.expiresIn,
    user: toSafeUser({ ...user, last_login: new Date() }),
  };
}

/**
 * Resolve the current user for a verified token subject.
 *
 * The database is re-checked so an account deleted or deactivated after the
 * token was issued immediately loses access.
 */
async function getProfile(userId) {
  const user = await findById(userId);
  if (!user) {
    throw ApiError.unauthorized('The account for this session no longer exists.', {
      code: 'ACCOUNT_NOT_FOUND',
    });
  }
  assertAccountUsable(user);
  return toSafeUser(user);
}

module.exports = {
  login,
  getProfile,
  toSafeUser,
  GENERIC_LOGIN_MESSAGE,
};
