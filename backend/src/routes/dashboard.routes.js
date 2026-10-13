
'use strict';

const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();

router.use(authenticate);

router.get(
    '/',
    authorize(['admin', 'registrar', 'department_head', 'instructor', 'student']),
    dashboardController.getDashboard
);

module.exports = router;
