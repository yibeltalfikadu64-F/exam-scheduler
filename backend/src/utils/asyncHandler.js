'use strict';

/**
 * Wraps an async route handler so rejected promises reach Express'
 * error middleware instead of becoming unhandled rejections.
 *
 *   router.get('/', asyncHandler(async (req, res) => { ... }))
 */
module.exports = function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    return Promise.resolve(handler(req, res, next)).catch(next);
  };
};
