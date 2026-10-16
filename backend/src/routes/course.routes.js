
'use strict';

/**
 * Course routes, mounted at /api/v1/courses.
 *
 * READ:
 *   Admin, registrar, department head, instructor, student.
 *
 * WRITE:
 *   Admin only.
 */

const express = require('express');

const courseController = require('../controllers/course.controller');

const {
    authenticate,
} = require('../middleware/auth.middleware');

const {
    authorize,
} = require('../middleware/role.middleware');

const {
    validate,
} = require('../middleware/validate.middleware');

const {
    validateCourseListQuery,
    validateCreateCourse,
    validateUpdateCourse,
    validatePrerequisiteSet,
} = require('../validators/course.validator');

const {
    validateStatusToggle,
} = require('../validators/shared');

const router = express.Router();

// Require authentication for every course endpoint.
router.use(authenticate);

// Roles allowed to view courses.
const CAN_READ = [
    'admin',
    'registrar',
    'department_head',
    'instructor',
    'student',
];

// Only administrators can manage courses and prerequisites.
const CAN_MANAGE = ['admin', 'department_head'];

/**
 * GET /api/v1/courses/options
 * Get courses for dropdowns.
 */
router.get(
    '/options',
    authorize(CAN_READ),
    courseController.options
);

/**
 * GET /api/v1/courses
 * List courses with filtering and pagination.
 */
router.get(
    '/',
    authorize(CAN_READ),
    validate(validateCourseListQuery, 'query'),
    courseController.list
);

/**
 * POST /api/v1/courses
 * Create a course. Admin only.
 */
router.post(
    '/',
    authorize(CAN_MANAGE),
    validate(validateCreateCourse),
    courseController.create
);

/**
 * GET /api/v1/courses/:id/prerequisites
 * Get course prerequisites.
 */
router.get(
    '/:id/prerequisites',
    authorize(CAN_READ),
    courseController.getPrerequisites
);

/**
 * PUT /api/v1/courses/:id/prerequisites
 * Replace course prerequisites. Admin only.
 */
router.put(
    '/:id/prerequisites',
    authorize(CAN_MANAGE),
    validate(validatePrerequisiteSet),
    courseController.replacePrerequisites
);

/**
 * GET /api/v1/courses/:id
 * Get one course.
 */
router.get(
    '/:id',
    authorize(CAN_READ),
    courseController.getOne
);

/**
 * PATCH /api/v1/courses/:id
 * Update a course. Admin only.
 */
router.patch(
    '/:id',
    authorize(CAN_MANAGE),
    validate(validateUpdateCourse),
    courseController.update
);

/**
 * PATCH /api/v1/courses/:id/status
 * Activate or deactivate a course. Admin only.
 */
router.patch(
    '/:id/status',
    authorize(CAN_MANAGE),
    validate(validateStatusToggle),
    courseController.setStatus
);

/**
 * DELETE /api/v1/courses/:id
 * Delete a course. Admin only; refused while sections,
 * exams, or enrollments exist.
 */
router.delete(
    '/:id',
    authorize('admin'),
    courseController.remove
);

module.exports = router;
