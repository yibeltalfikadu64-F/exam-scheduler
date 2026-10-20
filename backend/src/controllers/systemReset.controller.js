'use strict';

/**
 * System reset controllers (admin only).
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const systemResetService = require('../services/systemReset.service');

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const preview = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await systemResetService.previewReset(),
    'System reset preview retrieved successfully.'
  )
);

const execute = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await systemResetService.executeReset({
      confirm: req.body.confirm,
      actor: req.user,
      meta: requestMeta(req),
    }),
    'Operational data reset completed successfully.'
  )
);

module.exports = { preview, execute };
