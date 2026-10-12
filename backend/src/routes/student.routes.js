'use strict';

/**
 * Student routes, mounted at /api/v1/students.
 *
 * READ/WRITE: admin + registrar + department_head (scoped to the student's
 * department). Student PII is not exposed to instructors/students.
 */

const express = require('express');

const studentController = require('../controllers/student.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  validateStudentListQuery,
  validateCreateStudent,
  validateUpdateStudent,
  validateStudentStatus,
  validateEnrollmentCreate,
  validateEnrollmentStatus,
} = require('../validators/student.validator');

const router = express.Router();

router.use(authenticate);

const CAN_ACCESS = ['admin', 'registrar', 'department_head'];

router.get('/', authorize(CAN_ACCESS), validate(validateStudentListQuery, 'query'), studentController.list);
router.post('/', authorize(CAN_ACCESS), validate(validateCreateStudent), studentController.create);

router.get('/:id/enrollments', authorize(CAN_ACCESS), studentController.listEnrollments);
router.post('/:id/enrollments', authorize(CAN_ACCESS), validate(validateEnrollmentCreate), studentController.addEnrollment);
router.patch('/:id/enrollments/:enrollmentId', authorize(CAN_ACCESS), validate(validateEnrollmentStatus), studentController.setEnrollmentStatus);

router.get('/:id', authorize(CAN_ACCESS), studentController.getOne);
router.patch('/:id', authorize(CAN_ACCESS), validate(validateUpdateStudent), studentController.update);
router.patch('/:id/status', authorize(CAN_ACCESS), validate(validateStudentStatus), studentController.setStatus);

module.exports = router;
