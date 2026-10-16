'use strict';

/**
 * Reports & analytics validation (Phase 7).
 *
 * Only whitelisted, parameterized filters are accepted so no unsafe SQL
 * fragment can ever reach the reports service.
 */

const { parseIdFilter } = require('./shared');

function validateReportQuery(input = {}) {
  const errors = [];
  const departmentId = parseIdFilter(input, errors, 'departmentId');
  const examPeriodId = parseIdFilter(input, errors, 'examPeriodId');
  return { value: { departmentId, examPeriodId }, errors };
}

module.exports = { validateReportQuery };
