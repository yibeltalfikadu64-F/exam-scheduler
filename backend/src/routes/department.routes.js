'use strict';

/**
 * Department routes, mounted at /api/v1/departments.
 *
 * Authorization:
 *   READ  (list, detail, options): any authenticated user.
 *   WRITE (create, update, activate/deactivate): admin + registrar.
 *   NOTE: no DELETE route — deactivation is the lifecycle mechanism, which keeps
 *   programs/courses from being orphaned.
 */

const express = require('express');

const departmentController = require('../controllers/department.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateDepartmentListQuery, validateCreateDepartment, validateUpdateDepartment } = require('../validators/department.validator');
const { validateStatusToggle } = require('../validators/shared');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head', 'instructor', 'student'];
const CAN_WRITE = ['admin', 'registrar'];

router.get('/options', authorize(CAN_READ), departmentController.options);
router.get('/', authorize(CAN_READ), validate(validateDepartmentListQuery, 'query'), departmentController.list);
router.post('/', authorize(CAN_WRITE), validate(validateCreateDepartment), departmentController.create);
router.get('/:id/dependencies', authorize(CAN_READ), departmentController.dependencies);
router.get('/:id', authorize(CAN_READ), departmentController.getOne);
router.patch('/:id', authorize(CAN_WRITE), validate(validateUpdateDepartment), departmentController.update);
router.patch('/:id/status', authorize(CAN_WRITE), validate(validateStatusToggle), departmentController.setStatus);

module.exports = router;
