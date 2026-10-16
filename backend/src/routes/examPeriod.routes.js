
'use strict';

/**
 * Exam period routes, mounted at /api/v1/exam-periods.
 *
 * READ : every authenticated role.
 * WRITE: admin / registrar.
 */

const express = require('express');

const examPeriodController = require('../controllers/examPeriod.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  validateCreateExamPeriod,
  validateUpdateExamPeriod,
  validateExamPeriodStatus,
  validateExamPeriodListQuery,
} = require('../validators/examPeriod.validator');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head', 'instructor', 'student'];
const CAN_WRITE = ['admin', 'registrar'];

router.get('/options', authorize(CAN_READ), examPeriodController.options);

router.get(
  '/',
  authorize(CAN_READ),
  validate(validateExamPeriodListQuery, 'query'),
  examPeriodController.list
);

router.post(
  '/',
  authorize('admin'),
  validate(validateCreateExamPeriod),
  examPeriodController.create
);

router.patch(
  '/:id',
  authorize('admin'),
  validate(validateUpdateExamPeriod),
  examPeriodController.update
);

router.patch(
  '/:id/status',
  authorize('admin'),
  validate(validateExamPeriodStatus),
  examPeriodController.setStatus
);
router.get('/:id/dependencies', authorize(CAN_READ), examPeriodController.dependencies);
router.get('/:id', authorize(CAN_READ), examPeriodController.getOne);

router.delete('/:id', authorize('admin'), examPeriodController.remove);

module.exports = router;
