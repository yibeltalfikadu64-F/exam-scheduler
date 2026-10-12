'use strict';

/**
 * Schedule constraint routes, mounted at /api/v1/schedule-constraints.
 *
 * READ  : any authenticated user.
 * WRITE : admin + registrar.
 */

const express = require('express');

const scheduleConstraintController = require('../controllers/scheduleConstraint.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  validateConstraintListQuery,
  validateUpdateConstraint,
} = require('../validators/scheduleConstraint.validator');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head', 'instructor', 'student'];
const CAN_WRITE = ['admin', 'registrar'];

router.get('/', authorize(CAN_READ), validate(validateConstraintListQuery, 'query'), scheduleConstraintController.list);
router.get('/:id', authorize(CAN_READ), scheduleConstraintController.getOne);
router.patch('/:id', authorize(CAN_WRITE), validate(validateUpdateConstraint), scheduleConstraintController.update);

module.exports = router;