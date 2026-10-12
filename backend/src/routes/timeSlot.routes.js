'use strict';

/**
 * Time slot routes, mounted at /api/v1/time-slots.
 *
 * READ  : any authenticated user.
 * WRITE : admin + registrar.
 * DELETE: admin only, refused while examination records reference the slot.
 */

const express = require('express');

const timeSlotController = require('../controllers/timeSlot.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  validateTimeSlotListQuery,
  validateCreateTimeSlot,
  validateUpdateTimeSlot,
} = require('../validators/timeSlot.validator');
const { validateStatusToggle } = require('../validators/shared');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head', 'instructor', 'student'];
const CAN_WRITE = ['admin', 'registrar'];

router.get('/options', authorize(CAN_READ), timeSlotController.options);
router.get('/', authorize(CAN_READ), validate(validateTimeSlotListQuery, 'query'), timeSlotController.list);
router.post('/', authorize(CAN_WRITE), validate(validateCreateTimeSlot), timeSlotController.create);
router.get('/:id', authorize(CAN_READ), timeSlotController.getOne);
router.patch('/:id', authorize(CAN_WRITE), validate(validateUpdateTimeSlot), timeSlotController.update);
router.patch('/:id/status', authorize(CAN_WRITE), validate(validateStatusToggle), timeSlotController.setStatus);
router.delete('/:id', authorize('admin'), timeSlotController.remove);

module.exports = router;