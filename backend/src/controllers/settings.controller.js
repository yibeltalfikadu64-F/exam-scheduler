'use strict';

/**
 * System settings controllers (Phase 7).
 * Read: any authenticated user (public subset for branding/theme).
 * Write: administrators only.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const settingsService = require('../services/settings.service');

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}

const list = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await settingsService.listSettings(), 'Settings retrieved successfully.')
);

const publicSettings = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await settingsService.listPublicSettings(), 'Public settings retrieved successfully.')
);

const update = asyncHandler(async (req, res) =>
  ApiResponse.success(
    res,
    await settingsService.updateSettings(req.body.settings, req.user, requestMeta(req)),
    'Settings saved successfully.'
  )
);


const resetPreview = asyncHandler(async (req, res) => {
  const systemResetService = require('../services/systemReset.service');
  ApiResponse.success(res, await systemResetService.previewReset(), 'System reset preview retrieved successfully.');
});

const resetExecute = asyncHandler(async (req, res) => {
  const systemResetService = require('../services/systemReset.service');
  ApiResponse.success(
    res,
    await systemResetService.executeReset({
      confirm: req.body.confirm,
      actor: req.user,
      meta: requestMeta(req),
    }),
    'Operational data reset completed successfully.'
  );
});


module.exports = { list, publicSettings, update, resetPreview, resetExecute };

