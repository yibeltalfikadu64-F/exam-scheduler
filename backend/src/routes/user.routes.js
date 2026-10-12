'use strict';

/**
 * User-management routes, mounted at /api/v1/users by routes/index.js.
 *
 * Authentication and authorization are separate concerns:
 *   1. `authenticate` verifies the JWT and attaches req.user.
 *   2. `authorize('admin')` grants access only to administrators.
 *
 *   GET    /api/v1/users                    list (pagination/search/filters)
 *   GET    /api/v1/users/options            form options (roles, departments)
 *   GET    /api/v1/users/:id                details
 *   POST   /api/v1/users                    create
 *   PATCH  /api/v1/users/:id                update
 *   PATCH  /api/v1/users/:id/status         activate / deactivate
 *   POST   /api/v1/users/:id/reset-password reset a password
 */

const express = require('express');

const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  validateListQuery,
  validateCreateUser,
  validateUpdateUser,
  validateStatusChange,
  validateResetPassword,
} = require('../validators/user.validator');

const router = express.Router();

// Identity check first, then permission check. Applies to every route below.
router.use(authenticate);
router.use(authorize('admin'));

router.get('/options', userController.options);
router.get('/', validate(validateListQuery, 'query'), userController.list);
router.post('/', validate(validateCreateUser), userController.create);
router.get('/:id', userController.getOne);
router.patch('/:id', validate(validateUpdateUser), userController.update);
router.patch('/:id/status', validate(validateStatusChange), userController.setStatus);
router.post('/:id/reset-password', validate(validateResetPassword), userController.resetPassword);

module.exports = router;
