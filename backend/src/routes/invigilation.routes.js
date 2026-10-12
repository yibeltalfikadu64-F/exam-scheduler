'use strict';

/**
 * Invigilation routes, mounted at /api/v1/invigilation.
 *
 * READ     : admin, registrar, department_head (instructors see only their own
 *            duties via ?userId=).
 * MANAGE   : admin, registrar, department_head (assign/reassign/cancel/
 *            auto-assign). Department heads are scoped to their department.
 * POLICY   : settings + requirement overrides — admin, registrar.
 * PUBLISH  : roster publish/unpublish — admin, registrar.
 */

const express = require('express');

const invigilationController = require('../controllers/invigilation.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  validateSettings,
  validateCreateRequirement,
  validateUpdateRequirement,
  validateDutyListQuery,
  validateAssignDuty,
  validateReassignDuty,
  validateAutoAssign,
  validateRosterQuery,
  validateWorkloadQuery,
  validateReportQuery,
  validatePublishRoster,
  validateUnpublishRoster,
} = require('../validators/invigilation.validator');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head', 'instructor'];
const CAN_MANAGE = ['admin', 'registrar', 'department_head'];
const CAN_POLICY = ['admin', 'registrar'];
const CAN_PUBLISH = ['admin', 'registrar'];

// Settings & requirements (policy)
router.get('/settings', authorize(CAN_READ), invigilationController.getSettings);
router.put('/settings', authorize(CAN_POLICY), validate(validateSettings), invigilationController.updateSettings);
router.get('/requirements', authorize(CAN_POLICY), invigilationController.listRequirements);
router.post('/requirements', authorize(CAN_POLICY), validate(validateCreateRequirement), invigilationController.createRequirement);
router.patch('/requirements/:id', authorize(CAN_POLICY), validate(validateUpdateRequirement), invigilationController.updateRequirement);
router.delete('/requirements/:id', authorize(CAN_POLICY), invigilationController.removeRequirement);

// Duties
router.get('/duties', authorize(CAN_READ), validate(validateDutyListQuery, 'query'), invigilationController.listDuties);
router.get('/duties/:id', authorize(CAN_READ), invigilationController.getDuty);
router.post('/assign', authorize(CAN_MANAGE), validate(validateAssignDuty), invigilationController.assign);
router.patch('/duties/:id/reassign', authorize(CAN_MANAGE), validate(validateReassignDuty), invigilationController.reassign);
router.post('/duties/:id/cancel', authorize(CAN_MANAGE), invigilationController.cancel);

// Roster
router.get('/roster', authorize(['admin', 'registrar', 'department_head']), validate(validateRosterQuery, 'query'), invigilationController.getRoster);
router.post('/roster/publish', authorize(CAN_PUBLISH), validate(validatePublishRoster), invigilationController.publish);
router.post('/roster/unpublish', authorize(CAN_PUBLISH), validate(validateUnpublishRoster), invigilationController.unpublish);

// Auto-assign + reports
router.post('/auto-assign', authorize(CAN_MANAGE), validate(validateAutoAssign), invigilationController.autoAssign);
router.get('/workload', authorize(CAN_READ), validate(validateWorkloadQuery, 'query'), invigilationController.workload);
router.get('/unfilled', authorize(CAN_READ), validate(validateReportQuery, 'query'), invigilationController.unfilled);
router.get('/conflicts', authorize(CAN_READ), validate(validateReportQuery, 'query'), invigilationController.conflicts);

// Assignment-form options
router.get('/details', authorize(['admin', 'registrar', 'department_head']), validate(validateReportQuery, 'query'), invigilationController.detailOptions);
router.get('/details/:detailId/eligible-invigilators', authorize(['admin', 'registrar', 'department_head']), invigilationController.eligibleInvigilators);

module.exports = router;