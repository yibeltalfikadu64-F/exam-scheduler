'use strict';

/**
 * Instructor routes, mounted at /api/v1/instructors.
 * READ/WRITE: admin + registrar + department_head (scoped to their department).
 */

const express = require('express');

const instructorController = require('../controllers/instructor.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateInstructorListQuery, validateCreateInstructor, validateUpdateInstructor } = require('../validators/instructor.validator');
const { validateStatusToggle } = require('../validators/shared');

const router = express.Router();

router.use(authenticate);

const CAN_ACCESS = ['admin', 'registrar', 'department_head'];

router.get('/options', authorize(CAN_ACCESS), instructorController.options);
router.get('/', authorize(CAN_ACCESS), validate(validateInstructorListQuery, 'query'), instructorController.list);
router.post('/', authorize(CAN_ACCESS), validate(validateCreateInstructor), instructorController.create);
router.get('/:id', authorize(CAN_ACCESS), instructorController.getOne);
router.patch('/:id', authorize(CAN_ACCESS), validate(validateUpdateInstructor), instructorController.update);
router.patch('/:id/status', authorize(CAN_ACCESS), validate(validateStatusToggle), instructorController.setStatus);

module.exports = router;
