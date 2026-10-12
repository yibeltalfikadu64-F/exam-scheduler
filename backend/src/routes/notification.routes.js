'use strict';

/**
 * Notification routes, mounted at /api/v1/notifications.
 *
 * Inbox  : any authenticated user, always scoped to their own rows.
 * Queue  : operational delivery metadata — admin / registrar only.
 * Dispatch: manual queue pump — admin only.
 */

const express = require('express');

const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateInboxQuery, validateQueueQuery, validateDispatch } = require('../validators/notification.validator');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(validateInboxQuery, 'query'), notificationController.inbox);
router.get('/unread-count', notificationController.unreadCount);
router.post('/:id/read', notificationController.markRead);
router.post('/read-all', notificationController.markAllRead);

router.get('/queue', authorize('admin', 'registrar'), validate(validateQueueQuery, 'query'), notificationController.queue);
router.post('/dispatch', authorize('admin'), validate(validateDispatch), notificationController.dispatch);

module.exports = router;