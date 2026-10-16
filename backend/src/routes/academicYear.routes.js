'use strict';

/**
 * Academic calendar routes, mounted at /api/v1/academic-years.
 *
 * READ: any authenticated user (the calendar is catalogue data).
 * WRITE: admin + registrar (institution-wide configuration).
 */

const express = require('express');

const academicYearController = require('../controllers/academicYear.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  validateAcademicYearListQuery,
  validateCreateAcademicYear,
  validateUpdateAcademicYear,
  validateSemesterListQuery,
  validateCreateSemester,
  validateUpdateSemester,
} = require('../validators/academicYear.validator');
const { validateStatusToggle } = require('../validators/shared');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head', 'instructor', 'student'];
const CAN_WRITE = ['admin'];

router.get('/options', authorize(CAN_READ), academicYearController.options);
router.get('/', authorize(CAN_READ), validate(validateAcademicYearListQuery, 'query'), academicYearController.list);
router.post('/', authorize(CAN_WRITE), validate(validateCreateAcademicYear), academicYearController.create);

router.get('/:id/semesters', authorize(CAN_READ), validate(validateSemesterListQuery, 'query'), academicYearController.listSemesters);
router.post('/:id/semesters', authorize(CAN_WRITE), validate(validateCreateSemester), academicYearController.createSemester);
router.patch('/:id/semesters/:semesterId', authorize(CAN_WRITE), validate(validateUpdateSemester), academicYearController.updateSemester);
router.patch('/:id/semesters/:semesterId/status', authorize(CAN_WRITE), validate(validateStatusToggle), academicYearController.setSemesterStatus);

router.get('/:id', authorize(CAN_READ), academicYearController.getOne);
router.patch('/:id', authorize(CAN_WRITE), validate(validateUpdateAcademicYear), academicYearController.update);
router.patch('/:id/status', authorize(CAN_WRITE), validate(validateStatusToggle), academicYearController.setStatus);

module.exports = router;
