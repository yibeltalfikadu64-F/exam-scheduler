
'use strict';

/**
 * Instructor routes, mounted at /api/v1/instructors.
 * READ: admin, registrar, department_head.
 * CREATE/UPDATE/STATUS: admin only.
 * DELETE: admin only.
 */

const express = require('express');

const instructorController = require('../controllers/instructor.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');

const {
  validateInstructorListQuery,
  validateCreateInstructor,
  validateUpdateInstructor,
} = require('../validators/instructor.validator');

const { validateStatusToggle } = require('../validators/shared');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head'];
const CAN_MANAGE = ['admin', 'department_head'];

// Read instructor data
router.get(
  '/options',
  authorize(CAN_READ),
  instructorController.options
);

router.get(
  '/',
  authorize(CAN_READ),
  validate(validateInstructorListQuery, 'query'),
  instructorController.list
);

router.get(
  '/:id',
  authorize(CAN_READ),
  instructorController.getOne
);

// Admin-only instructor management
router.post(
  '/',
  authorize(CAN_MANAGE),
  validate(validateCreateInstructor),
  instructorController.create
);

router.patch(
  '/:id',
  authorize(CAN_MANAGE),
  validate(validateUpdateInstructor),
  instructorController.update
);

router.patch(
  '/:id/status',
  authorize(CAN_MANAGE),
  validate(validateStatusToggle),
  instructorController.setStatus
);

router.delete(
  '/:id',
  authorize('admin'),
  instructorController.remove
);

module.exports = router;
