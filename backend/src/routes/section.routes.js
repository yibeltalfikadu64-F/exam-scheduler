
'use strict';

/**
 * Section routes, mounted at /api/v1/sections.
 *
 * READ:
 *   Admin, registrar, department head, instructor, student.
 *
 * WRITE:
 *   Admin only.
 */

const express = require('express');

const sectionController = require('../controllers/section.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');

const {
    validateSectionListQuery,
    validateCreateSection,
    validateUpdateSection,
} = require('../validators/section.validator');

const { validateStatusToggle } = require('../validators/shared');

const router = express.Router();

// Require authentication for every section endpoint.
router.use(authenticate);

// Roles allowed to view sections.
const CAN_READ = [
    'admin',
    'registrar',
    'department_head',
    'instructor',
    'student',
];

// Only administrators can manage sections.
const CAN_MANAGE = ['admin'];

/**
 * GET /api/v1/sections
 * List sections.
 */
router.get(
    '/',
    authorize(CAN_READ),
    validate(validateSectionListQuery, 'query'),
    sectionController.list
);

/**
 * POST /api/v1/sections
 * Create a section. Admin only.
 */
router.post(
    '/',
    authorize(CAN_MANAGE),
    validate(validateCreateSection),
    sectionController.create
);

/**
 * GET /api/v1/sections/:id
 * Retrieve a section.
 */
router.get(
    '/:id',
    authorize(CAN_READ),
    sectionController.getOne
);

/**
 * PATCH /api/v1/sections/:id
 * Update a section. Admin only.
 */
router.patch(
    '/:id',
    authorize(CAN_MANAGE),
    validate(validateUpdateSection),
    sectionController.update
);

/**
 * PATCH /api/v1/sections/:id/status
 * Activate or deactivate a section. Admin only.
 */
router.patch(
    '/:id/status',
    authorize(CAN_MANAGE),
    validate(validateStatusToggle),
    sectionController.setStatus
);

module.exports = router;
