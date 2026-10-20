'use strict';

/**
 * System reset validation.
 * Requires exact confirmation phrase.
 */

function validateResetExecution(payload = {}) {
  const errors = [];
  let value = {};

  const source = payload && typeof payload === 'object' ? payload : {};

  if (typeof source.confirm !== 'string' || source.confirm !== 'RESET OPERATIONAL DATA') {
    errors.push({
      field: 'confirm',
      message: 'Confirmation must be exactly "RESET OPERATIONAL DATA".',
    });
  }

  value = { confirm: source.confirm };
  return { value, errors };
}

module.exports = { validateResetExecution };
