'use strict';

/**
 * Reports & analytics routes, mounted at /api/v1/reports.
 *
 * Read-only. Available to the academic/administrative roles.
 */

const express = require('express');

const reportController = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateReportQuery } = require('../validators/report.validator');

const router = express.Router();

router.use(authenticate);
router.use(authorize(['admin', 'registrar', 'department_head', 'instructor']));

const withQuery = (handler) => [validate(validateReportQuery, 'query'), handler];

router.get('/overview', ...withQuery(reportController.overview));
router.get('/exam-load', ...withQuery(reportController.examLoad));
router.get('/room-utilization', ...withQuery(reportController.roomUtilization));
router.get('/conflicts', ...withQuery(reportController.conflicts));
router.get('/invigilation', ...withQuery(reportController.invigilation));
router.get('/summary', ...withQuery(reportController.summary));

module.exports = router;
