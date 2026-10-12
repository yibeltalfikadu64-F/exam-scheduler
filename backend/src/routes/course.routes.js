'use strict';

/**
 * Course routes, mounted at /api/v1/courses.
 *
 * READ: any authenticated user.
 * WRITE: admin + registrar + department_head (scoped to their own department).
 */

const express = require('express');

const courseController = require('../controllers/course.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateCourseListQuery, validateCreateCourse, validateUpdateCourse, validatePrerequisiteSet } = require('../validators/course.validator');
const { validateStatusToggle } = require('../validators/shared');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head', 'instructor', 'student'];
const CAN_WRITE = ['admin', 'registrar', 'department_head'];

router.get('/options', authorize(CAN_READ), courseController.options);
router.get('/', authorize(CAN_READ), validate(validateCourseListQuery, 'query'), courseController.list);
router.post('/', authorize(CAN_WRITE), validate(validateCreateCourse), courseController.create);
router.get('/:id/prerequisites', authorize(CAN_READ), courseController.getPrerequisites);
router.put('/:id/prerequisites', authorize(CAN_WRITE), validate(validatePrerequisiteSet), courseController.replacePrerequisites);
router.get('/:id', authorize(CAN_READ), courseController.getOne);
router.patch('/:id', authorize(CAN_WRITE), validate(validateUpdateCourse), courseController.update);
router.patch('/:id/status', authorize(CAN_WRITE), validate(validateStatusToggle), courseController.setStatus);

module.exports = router;
