'use strict';

/**
 * Building routes, mounted at /api/v1/buildings.
 *
 * READ  : any authenticated user.
 * WRITE : admin + registrar (physical resource configuration).
 * DELETE: admin only, and refused while rooms depend on the building.
 */

const express = require('express');

const buildingController = require('../controllers/building.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateBuildingListQuery, validateCreateBuilding, validateUpdateBuilding } = require('../validators/building.validator');
const { validateStatusToggle } = require('../validators/shared');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head', 'instructor', 'student'];
const CAN_WRITE = ['admin'];

router.get('/options', authorize(CAN_READ), buildingController.options);
router.get('/', authorize(CAN_READ), validate(validateBuildingListQuery, 'query'), buildingController.list);
router.post('/', authorize(CAN_WRITE), validate(validateCreateBuilding), buildingController.create);
router.get('/:id', authorize(CAN_READ), buildingController.getOne);
router.patch('/:id', authorize(CAN_WRITE), validate(validateUpdateBuilding), buildingController.update);
router.patch('/:id/status', authorize(CAN_WRITE), validate(validateStatusToggle), buildingController.setStatus);
router.delete('/:id', authorize('admin'), buildingController.remove);

module.exports = router;
