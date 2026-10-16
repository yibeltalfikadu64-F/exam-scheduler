'use strict';

/**
 * System settings validation (Phase 7).
 *
 * The catalogue and per-key type validation live in settings.service (they need
 * the database); this validator only enforces the request *shape* so the
 * middleware can reject malformed bodies early.
 */

function validateUpdateSettings(payload = {}) {
  const errors = [];
  let value = {};

  const source = payload && typeof payload === 'object' ? payload : {};

  // Accept either { settings: {...} } or a flat { key: value } object.
  const target = source.settings !== undefined ? source.settings : source;

  if (target === null || typeof target !== 'object' || Array.isArray(target)) {
    errors.push({ field: 'settings', message: 'settings must be an object of key/value pairs.' });
  } else {
    const keys = Object.keys(target);
    if (keys.length === 0) {
      errors.push({ field: 'settings', message: 'At least one setting must be provided.' });
    }
    value = { settings: target };
  }

  return { value, errors };
}

module.exports = { validateUpdateSettings };
