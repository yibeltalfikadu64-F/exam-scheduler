
'use strict';

/**
 * Department routes, mounted at /api/v1/departments.
 *
 * READ:
 *   Admin, registrar, department head, instructor, student.
 *
 * WRITE:
 *   Admin only.
 *
 * Departments are deactivated rather than deleted to prevent
 * programs and courses from becoming orphaned.
 */

const express = require('express');

const departmentController = require('../controllers/department.controller');

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
    validateDepartmentListQuery,
    validateCreateDepartment,
    validateUpdateDepartment,
} = require('../validators/department.validator');

const {
    validateStatusToggle,
} = require('../validators/shared');

const router = express.Router();

// Require authentication for every department endpoint.
router.use(authenticate);

// Roles allowed to view departments.
const CAN_READ = [
    'admin',
    'registrar',
    'department_head',
    'instructor',
    'student',
];

// Only administrators can manage departments.
const CAN_MANAGE = ['admin', 'registrar'];

/**
 * GET /api/v1/departments/options
 * Return departments for dropdowns.
 *
 * Keep this route before /:id so "options" is not treated as an ID.
 */
router.get(
    '/options',
    authorize(CAN_READ),
    departmentController.options
);

/**
 * GET /api/v1/departments
 * List departments with filtering and pagination.
 */
router.get(
    '/',
    authorize(CAN_READ),
    validate(validateDepartmentListQuery, 'query'),
    departmentController.list
);

/**
 * POST /api/v1/departments
 * Create a department. Admin only.
 */
router.post(
    '/',
    authorize(CAN_MANAGE),
    validate(validateCreateDepartment),
    departmentController.create
);

/**
 * GET /api/v1/departments/:id/dependencies
 * Retrieve related record counts.
 */
router.get(
    '/:id/dependencies',
    authorize(CAN_READ),
    departmentController.dependencies
);

/**
 * GET /api/v1/departments/:id
 * Retrieve a department by ID.
 */
router.get(
    '/:id',
    authorize(CAN_READ),
    departmentController.getOne
);

/**
 * PATCH /api/v1/departments/:id
 * Update a department. Admin only.
 */
router.patch(
    '/:id',
    authorize(CAN_MANAGE),
    validate(validateUpdateDepartment),
    departmentController.update
);

/**
 * PATCH /api/v1/departments/:id/status
 * Activate or deactivate a department. Admin only.
 */
router.patch(
    '/:id/status',
    authorize(CAN_MANAGE),
    validate(validateStatusToggle),
    departmentController.setStatus
);

/**
 * DELETE /api/v1/departments/:id
 * Delete a department. Admin only; refused while dependents exist.
 */
router.delete(
    '/:id',
    authorize('admin'),
    departmentController.remove
);

module.exports = router;
