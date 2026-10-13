
'use strict';

/**
 * Course routes, mounted at /api/v1/courses.
 *
 * READ:
 *   Any authenticated user with an allowed role.
 *
 * WRITE:
 *   Admin, registrar, and department head.
 *   Department heads should be restricted to their own department
 *   in the controller/service layer.
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

router.use(authenticate);

const CAN_READ = [
    'admin',
    'registrar',
    'department_head',
    'instructor',
    'student',
];

const CAN_WRITE = [
    'admin',
    'registrar',
    'department_head',
];

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
 * Create a course.
 */
router.post(
    '/',
    authorize(CAN_WRITE),
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
 * Replace course prerequisites.
 */
router.put(
    '/:id/prerequisites',
    authorize(CAN_WRITE),
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
 * Update a course.
 */
router.patch(
    '/:id',
    authorize(CAN_WRITE),
    validate(validateUpdateCourse),
    courseController.update
);

/**
 * PATCH /api/v1/courses/:id/status
 * Activate or deactivate a course.
 */
router.patch(
    '/:id/status',
    authorize(CAN_WRITE),
    validate(validateStatusToggle),
    courseController.setStatus
);

module.exports = router;
