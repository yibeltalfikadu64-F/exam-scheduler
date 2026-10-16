'use strict';

/**
 * Exam routes, mounted at /api/v1/exams.
 *
 * READ  : any authenticated user (department heads are scoped to their department).
 * WRITE : admin + registrar + department_head (scoped).
 * DELETE: admin only.
 */

const express = require('express');

const examController = require('../controllers/exam.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateExamListQuery, validateCreateExam, validateUpdateExam, validateExamStatus } = require('../validators/exam.validator');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head', 'instructor', 'student'];
const CAN_WRITE = ['admin'];

router.get('/options', authorize(CAN_READ), examController.options);
router.get('/', authorize(CAN_READ), validate(validateExamListQuery, 'query'), examController.list);
router.post('/', authorize(CAN_WRITE), validate(validateCreateExam), examController.create);
router.get('/:id', authorize(CAN_READ), examController.getOne);
router.patch('/:id', authorize(CAN_WRITE), validate(validateUpdateExam), examController.update);
router.patch('/:id/status', authorize(CAN_WRITE), validate(validateExamStatus), examController.setStatus);
router.delete('/:id', authorize('admin'), examController.remove);

module.exports = router;