
'use strict';

const express = require('express');

const examPeriodController = require('../controllers/examPeriod.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();

router.use(authenticate);

const CAN_READ = [
  'admin',
  'registrar',
  'department_head',
  'instructor',
  'student',
];

router.get('/', authorize(CAN_READ), examPeriodController.list);
router.get('/:id', authorize(CAN_READ), examPeriodController.getOne);

module.exports = router;
