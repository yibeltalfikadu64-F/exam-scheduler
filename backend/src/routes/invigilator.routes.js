'use strict';

/**
 * Invigilator-management routes, mounted at /api/v1/invigilators.
 *
 * Authentication and authorization:
 *   - every route requires a valid JWT;
 *   - management (create/update/status/delete) is limited to admin, registrar
 *     and department heads (department heads are scoped to their department);
 *   - an instructor may read and update their OWN availability record.
 */

const express = require('express');
const database = require('../config/database');

const invigilatorController = require('../controllers/invigilator.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const { validateStatusToggle } = require('../validators/shared');
const { validateListQuery, validateCreateInvigilator, validateUpdateInvigilator, validateAvailability } = require('../validators/invigilator.validator');

const router = express.Router();

router.use(authenticate);

const CAN_READ = ['admin', 'registrar', 'department_head'];
const CAN_MANAGE = ['admin', 'registrar', 'department_head'];

/** Permit an instructor to manage their own availability (and nothing else). */
function allowOwnAvailability(req, res, next) {
  if (req.user.role !== 'instructor') return next();
  const id = Number(req.params.id);
  database
    .getPool()
    .query('SELECT user_id FROM invigilators WHERE id = ? LIMIT 1', [id])
    .then(([rows]) => {
      if (!rows.length || Number(rows[0].user_id) !== Number(req.user.id)) {
        const ApiError = require('../utils/ApiError');
        return next(ApiError.forbidden('You may only manage your own availability.', { code: 'NOT_OWN_AVAILABILITY' }));
      }
      return next();
    })
    .catch((error) => next(error));
}

router.get('/options', authorize(CAN_READ), invigilatorController.options);
router.get('/', authorize(CAN_READ), validate(validateListQuery, 'query'), invigilatorController.list);
router.get('/:id', authorize(CAN_READ), invigilatorController.getOne);
router.post('/', authorize(CAN_MANAGE), validate(validateCreateInvigilator), invigilatorController.create);
router.patch('/:id', authorize(CAN_MANAGE), validate(validateUpdateInvigilator), invigilatorController.update);
router.patch('/:id/status', authorize(CAN_MANAGE), validate(validateStatusToggle), invigilatorController.setStatus);
router.get('/:id/availability', authorize(CAN_READ), allowOwnAvailability, invigilatorController.listAvailability);
router.put('/:id/availability', authorize(CAN_MANAGE), allowOwnAvailability, validate(validateAvailability), invigilatorController.replaceAvailability);
router.delete('/:id', authorize(CAN_MANAGE), invigilatorController.remove);

module.exports = router;