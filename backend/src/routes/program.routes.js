
'use strict';

/**
 * Program routes, mounted at /api/v1/programs.
 *
 * READ:
 *   Admin, registrar, department head, instructor, student.
 *
 * WRITE:
 *   Admin only.
 */

const express = require('express');

const programController = require('../controllers/program.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');

const {
    validateProgramListQuery,
    validateCreateProgram,
    validateUpdateProgram,
} = require('../validators/program.validator');

const { validateStatusToggle } = require('../validators/shared');

const router = express.Router();

// Require authentication for every program endpoint.
router.use(authenticate);

// Roles allowed to view programs.
const CAN_READ = [
    'admin',
    'registrar',
    'department_head',
    'instructor',
    'student',
];

// Only administrators can manage programs.
const CAN_MANAGE = ['admin', 'department_head'];

// GET /api/v1/programs/options
router.get(
    '/options',
    authorize(CAN_READ),
    programController.options
);

// GET /api/v1/programs
router.get(
    '/',
    authorize(CAN_READ),
    validate(validateProgramListQuery, 'query'),
    programController.list
);

// POST /api/v1/programs
// Create a program. Admin only.
router.post(
    '/',
    authorize(CAN_MANAGE),
    validate(validateCreateProgram),
    programController.create
);

// GET /api/v1/programs/:id
router.get(
    '/:id',
    authorize(CAN_READ),
    programController.getOne
);

// PATCH /api/v1/programs/:id
// Update a program. Admin only.
router.patch(
    '/:id',
    authorize(CAN_MANAGE),
    validate(validateUpdateProgram),
    programController.update
);

// PATCH /api/v1/programs/:id/status
// Activate or deactivate a program. Admin only.
router.patch(
    '/:id/status',
    authorize(CAN_MANAGE),
    validate(validateStatusToggle),
    programController.setStatus
);

// DELETE /api/v1/programs/:id
// Delete a program. Admin only.
router.delete(
    '/:id',
    authorize('admin'),
    programController.remove
);

module.exports = router;
