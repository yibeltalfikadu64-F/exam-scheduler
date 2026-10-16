
'use strict';

/**
 * Student routes, mounted at /api/v1/students.
 *
 * READ:
 *   Admin, registrar, department head.
 *
 * WRITE:
 *   Admin only.
 *
 * Student PII is not exposed to instructors or students.
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

// Require authentication for every student endpoint.
router.use(authenticate);

// Roles allowed to view student records.
const CAN_READ = ['admin', 'registrar', 'department_head'];

// Only administrators can manage student records and enrollments.
const CAN_MANAGE = ['admin', 'department_head'];

// GET /api/v1/students
router.get(
  '/',
  authorize(CAN_READ),
  validate(validateStudentListQuery, 'query'),
  studentController.list
);

// POST /api/v1/students
// Create a student. Admin only.
router.post(
  '/',
  authorize(CAN_MANAGE),
  validate(validateCreateStudent),
  studentController.create
);

// GET /api/v1/students/:id/enrollments
router.get(
  '/:id/enrollments',
  authorize(CAN_READ),
  studentController.listEnrollments
);

// POST /api/v1/students/:id/enrollments
// Add an enrollment. Admin only.
router.post(
  '/:id/enrollments',
  authorize(CAN_MANAGE),
  validate(validateEnrollmentCreate),
  studentController.addEnrollment
);

// PATCH /api/v1/students/:id/enrollments/:enrollmentId
// Change enrollment status. Admin only.
router.patch(
  '/:id/enrollments/:enrollmentId',
  authorize(CAN_MANAGE),
  validate(validateEnrollmentStatus),
  studentController.setEnrollmentStatus
);

// GET /api/v1/students/:id
router.get(
  '/:id',
  authorize(CAN_READ),
  studentController.getOne
);

// PATCH /api/v1/students/:id
// Update a student. Admin only.
router.patch(
  '/:id',
  authorize(CAN_MANAGE),
  validate(validateUpdateStudent),
  studentController.update
);

// PATCH /api/v1/students/:id/status
// Activate or deactivate a student. Admin only.
router.patch(
  '/:id/status',
  authorize(CAN_MANAGE),
  validate(validateStudentStatus),
  studentController.setStatus
);

// DELETE /api/v1/students/:id
// Delete a student. Admin only.
router.delete(
  '/:id',
  authorize('admin'),
  studentController.remove
);

module.exports = router;
