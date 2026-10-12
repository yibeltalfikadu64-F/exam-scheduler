'use strict';

/**
 * Section routes, mounted at /api/v1/sections.
 *
 * READ: any authenticated user.
 * WRITE: admin + registrar + department_head (scoped to the course's department).
 */

const express = require('express');

const sectionController = require('../controllers/section.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateSectionListQuery, validateCreateSection, validateUpdateSection } = require('../validators/section.validator');
const { validateStatusToggle } = require('../validators/shared');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head', 'instructor', 'student'];
const CAN_WRITE = ['admin', 'registrar', 'department_head'];

router.get('/', authorize(CAN_READ), validate(validateSectionListQuery, 'query'), sectionController.list);
router.post('/', authorize(CAN_WRITE), validate(validateCreateSection), sectionController.create);
router.get('/:id', authorize(CAN_READ), sectionController.getOne);
router.patch('/:id', authorize(CAN_WRITE), validate(validateUpdateSection), sectionController.update);
router.patch('/:id/status', authorize(CAN_WRITE), validate(validateStatusToggle), sectionController.setStatus);

module.exports = router;
