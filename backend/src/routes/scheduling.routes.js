'use strict';

/**
 * Scheduling routes, mounted at /api/v1/scheduling.
 *
 * READ      : any authenticated user.
 * SCHEDULE  : admin + registrar + department_head (scoped to their department).
 * PUBLISH   : admin + registrar (university-level decision).
 */

const express = require('express');

const schedulingController = require('../controllers/scheduling.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  validateScheduleListQuery,
  validatePreview,
  validateSaveDraft,
  validateManualAssignment,
  validateReschedule,
} = require('../validators/scheduling.validator');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head', 'instructor', 'student'];
const CAN_SCHEDULE = ['admin', 'registrar', 'department_head'];
const CAN_PUBLISH = ['admin', 'registrar'];

router.post('/preview', authorize(CAN_SCHEDULE), validate(validatePreview), schedulingController.preview);

router.get('/schedules', authorize(CAN_READ), validate(validateScheduleListQuery, 'query'), schedulingController.listSchedules);
router.post('/schedules', authorize(CAN_SCHEDULE), validate(validateSaveDraft), schedulingController.saveDraft);
router.get('/schedules/:id', authorize(CAN_READ), schedulingController.getSchedule);
router.post('/schedules/:id/validate', authorize(CAN_SCHEDULE), schedulingController.validateScheduleById);
router.post('/schedules/:id/publish', authorize(CAN_PUBLISH), schedulingController.publish);
router.post('/schedules/:id/cancel', authorize(CAN_PUBLISH), schedulingController.cancel);

router.post('/schedules/:id/details', authorize(CAN_SCHEDULE), validate(validateManualAssignment), schedulingController.addDetail);
router.patch('/details/:detailId', authorize(CAN_SCHEDULE), validate(validateReschedule), schedulingController.reschedule);
router.delete('/details/:detailId', authorize(CAN_SCHEDULE), schedulingController.removeDetail);

module.exports = router;