'use strict';

/**
 * System settings (Phase 7).
 *
 * A database-backed key/value catalogue stored in `system_settings`. Values are
 * coerced to and from their declared `value_type` so the API always returns
 * correctly typed values and only persists validated input.
 */

const database = require('../config/database');
const ApiError = require('../utils/ApiError');
const auditService = require('./audit.service');

/**
 * Coerce a raw stored string into its declared JavaScript type.
 * Missing/empty values are returned as null so callers can fall back.
 */
function deserialize(valueType, raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  switch (valueType) {
    case 'number': {
      const num = Number(raw);
      return Number.isFinite(num) ? num : null;
    }
    case 'boolean':
      return raw === true || raw === 'true' || raw === '1' || raw === 1;
    case 'json':
      try {
        return JSON.parse(raw);
      } catch (error) {
        return null;
      }
    case 'string':
    default:
      return String(raw);
  }
}

/** Serialize a validated JavaScript value into its stored text form. */
function serialize(valueType, value) {
  if (value === null || value === undefined) return null;
  if (valueType === 'json') return JSON.stringify(value);
  if (valueType === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function toPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.setting_key,
    category: row.category,
    label: row.label,
    description: row.description,
    valueType: row.value_type,
    value: deserialize(row.value_type, row.setting_value),
    isPublic: Boolean(row.is_public),
    updatedAt: row.updated_at,
  };
}

async function loadRows({ publicOnly = false } = {}) {
  const where = publicOnly ? 'WHERE is_public = 1' : '';
  const [rows] = await database
    .getPool()
    .query(`SELECT * FROM system_settings ${where} ORDER BY category ASC, setting_key ASC`);
  return rows;
}

/** All settings grouped by category, plus a flat key→value map. */
async function listSettings() {
  const rows = await loadRows();
  const settings = rows.map(toPublic);
  const categories = {};
  const values = {};
  for (const setting of settings) {
    if (!categories[setting.category]) categories[setting.category] = [];
    categories[setting.category].push(setting);
    values[setting.key] = setting.value;
  }
  return { settings, categories, values };
}

/** Values safe to expose to any authenticated user. */
async function listPublicSettings() {
  const rows = await loadRows({ publicOnly: true });
  const values = {};
  for (const row of rows) values[row.setting_key] = deserialize(row.value_type, row.setting_value);
  return { values };
}

/**
 * Validate an incoming value against the setting's declared type.
 * Returns the coerced value or throws a field-level validation error.
 */
function coerceInput(setting, rawValue) {
  switch (setting.value_type) {
    case 'boolean': {
      if (typeof rawValue === 'boolean') return rawValue;
      if (rawValue === 'true' || rawValue === '1' || rawValue === 1) return true;
      if (rawValue === 'false' || rawValue === '0' || rawValue === 0) return false;
      throw ApiError.badRequest('Validation failed.', {
        code: 'VALIDATION_ERROR',
        details: [{ field: setting.setting_key, message: 'Value must be a boolean.' }],
      });
    }
    case 'number': {
      if (rawValue === null || rawValue === '' || rawValue === undefined) return null;
      const num = Number(rawValue);
      if (!Number.isFinite(num)) {
        throw ApiError.badRequest('Validation failed.', {
          code: 'VALIDATION_ERROR',
          details: [{ field: setting.setting_key, message: 'Value must be a number.' }],
        });
      }
      return num;
    }
    case 'json': {
      if (rawValue === null || rawValue === '') return null;
      if (typeof rawValue === 'object') return rawValue;
      try {
        return JSON.parse(rawValue);
      } catch (error) {
        throw ApiError.badRequest('Validation failed.', {
          code: 'VALIDATION_ERROR',
          details: [{ field: setting.setting_key, message: 'Value must be valid JSON.' }],
        });
      }
    }
    case 'string':
    default: {
      if (rawValue === null || rawValue === undefined) return null;
      const text = String(rawValue).trim();
      if (text.length > 500) {
        throw ApiError.badRequest('Validation failed.', {
          code: 'VALIDATION_ERROR',
          details: [{ field: setting.setting_key, message: 'Value must be at most 500 characters.' }],
        });
      }
      return text;
    }
  }
}

/**
 * Persist a map of `{ setting_key: value }` in a single transaction.
 * Unknown keys and invalid values are rejected before anything is written.
 */
async function updateSettings(input, actor, meta) {
  const incoming = input && typeof input === 'object' ? input : {};
  const keys = Object.keys(incoming);
  if (keys.length === 0) {
    throw ApiError.badRequest('No settings were provided.', { code: 'VALIDATION_ERROR' });
  }

  const rows = await loadRows();
  const byKey = new Map(rows.map((row) => [row.setting_key, row]));

  const unknown = keys.filter((key) => !byKey.has(key));
  if (unknown.length) {
    throw ApiError.badRequest('Validation failed.', {
      code: 'VALIDATION_ERROR',
      details: unknown.map((key) => ({ field: key, message: 'Unknown setting key.' })),
    });
  }

  // Validate + serialize everything first so a bad value writes nothing.
  const updates = keys.map((key) => {
    const setting = byKey.get(key);
    const value = coerceInput(setting, incoming[key]);
    return { key, before: deserialize(setting.value_type, setting.setting_value), value, serialized: serialize(setting.value_type, value) };
  });

  const connection = await database.getPool().getConnection();
  try {
    await connection.beginTransaction();
    for (const update of updates) {
      // eslint-disable-next-line no-await-in-loop
      await connection.query(
        'UPDATE system_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
        [update.serialized, actor ? actor.id : null, update.key]
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await auditService.record({
    userId: actor ? actor.id : null,
    action: 'settings.update',
    entityType: 'system_settings',
    entityId: null,
    before: updates.reduce((acc, item) => ({ ...acc, [item.key]: item.before }), {}),
    after: updates.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {}),
    ipAddress: meta.ip,
    userAgent: meta.userAgent,
  });

  return listSettings();
}

/** Convenience accessor used by other services (returns coerced values). */
async function getValue(key, fallback = null) {
  const [rows] = await database
    .getPool()
    .query('SELECT value_type, setting_value FROM system_settings WHERE setting_key = ? LIMIT 1', [key]);
  if (!rows.length) return fallback;
  const value = deserialize(rows[0].value_type, rows[0].setting_value);
  return value === null ? fallback : value;
}

module.exports = {
  listSettings,
  listPublicSettings,
  updateSettings,
  getValue,
  _internals: { deserialize, serialize },
};
