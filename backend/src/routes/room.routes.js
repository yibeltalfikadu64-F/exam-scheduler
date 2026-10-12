'use strict';

/**
 * Room routes, mounted at /api/v1/rooms.
 *
 * READ  : any authenticated user.
 * WRITE : admin + registrar.
 * DELETE: admin only (refused while examination records reference the room).
 *
 * Nested closure routes let a room be blocked for maintenance/events; the
 * scheduling validator treats a closure as "room unavailable".
 */

const express = require('express');

const roomController = require('../controllers/room.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  validateRoomListQuery,
  validateCreateRoom,
  validateUpdateRoom,
  validateCreateClosure,
  validateUpdateClosure,
} = require('../validators/room.validator');
const { validateStatusToggle } = require('../validators/shared');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head', 'instructor', 'student'];
const CAN_WRITE = ['admin', 'registrar'];

router.get('/options', authorize(CAN_READ), roomController.options);
router.get('/', authorize(CAN_READ), validate(validateRoomListQuery, 'query'), roomController.list);
router.post('/', authorize(CAN_WRITE), validate(validateCreateRoom), roomController.create);

router.get('/:id/closures', authorize(CAN_READ), roomController.listClosures);
router.post('/:id/closures', authorize(CAN_WRITE), validate(validateCreateClosure), roomController.createClosure);
router.patch('/:id/closures/:closureId', authorize(CAN_WRITE), validate(validateUpdateClosure), roomController.updateClosure);
router.delete('/:id/closures/:closureId', authorize(CAN_WRITE), roomController.removeClosure);

router.get('/:id', authorize(CAN_READ), roomController.getOne);
router.patch('/:id', authorize(CAN_WRITE), validate(validateUpdateRoom), roomController.update);
router.patch('/:id/status', authorize(CAN_WRITE), validate(validateStatusToggle), roomController.setStatus);
router.delete('/:id', authorize('admin'), roomController.remove);

module.exports = router;
