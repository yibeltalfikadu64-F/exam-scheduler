'use strict';

/**
 * Program routes, mounted at /api/v1/programs.
 *
 * READ: any authenticated user.
 * WRITE: admin + registrar + department_head (scoped to their own department).
 */

const express = require('express');

const programController = require('../controllers/program.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateProgramListQuery, validateCreateProgram, validateUpdateProgram } = require('../validators/program.validator');
const { validateStatusToggle } = require('../validators/shared');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head', 'instructor', 'student'];
const CAN_WRITE = ['admin', 'registrar', 'department_head'];

router.get('/options', authorize(CAN_READ), programController.options);
router.get('/', authorize(CAN_READ), validate(validateProgramListQuery, 'query'), programController.list);
router.post('/', authorize(CAN_WRITE), validate(validateCreateProgram), programController.create);
router.get('/:id', authorize(CAN_READ), programController.getOne);
router.patch('/:id', authorize(CAN_WRITE), validate(validateUpdateProgram), programController.update);
router.patch('/:id/status', authorize(CAN_WRITE), validate(validateStatusToggle), programController.setStatus);

module.exports = router;
