'use strict';

/**
 * Notification controllers (Phase 6).
 *
 * Inbox endpoints are scoped to the authenticated user — a user can never see
 * or mark another user's notifications. The operational queue (delivery
 * metadata only, email addresses masked) is restricted to admins.
 */

const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const notificationService = require('../services/notification.service');
const ApiError = require('../utils/ApiError');

function parseId(raw, label = 'notification') {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw ApiError.badRequest(`Invalid ${label} id.`, { code: 'INVALID_ID' });
  return id;
}

const inbox = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await notificationService.listForUser(req.user.id, req.validated.query), 'Notifications retrieved.')
);

const unreadCount = asyncHandler(async (req, res) =>
  ApiResponse.success(res, { count: await notificationService.unreadCount(req.user.id) }, 'Unread notification count retrieved.')
);

const markRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markRead(req.user.id, parseId(req.params.id));
  return ApiResponse.success(res, result, 'Notification marked as read.');
});

const markAllRead = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await notificationService.markAllRead(req.user.id), 'All notifications marked as read.')
);

const queue = asyncHandler(async (req, res) =>
  ApiResponse.success(res, await notificationService.listQueue(req.validated.query), 'Notification queue retrieved.')
);

const dispatch = asyncHandler(async (req, res) => {
  const summary = await notificationService.dispatchPending({ ids: req.body.ids });
  return ApiResponse.success(res, summary, 'Notification dispatch run completed.');
});

module.exports = { inbox, unreadCount, markRead, markAllRead, queue, dispatch };