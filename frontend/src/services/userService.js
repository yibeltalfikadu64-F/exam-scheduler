import api from './api';

/**
 * User-management API client (Phase 2 / RBAC).
 *
 * Endpoints (all admin-only on the server):
 *   GET    /users                    list (pagination, search, role/status filters)
 *   GET    /users/options            form options (roles, departments)
 *   GET    /users/:id                single user
 *   POST   /users                    create
 *   PATCH  /users/:id                update
 *   PATCH  /users/:id/status         activate / deactivate
 *   POST   /users/:id/reset-password reset a password
 *
 * The shared Axios instance (services/api.js) attaches the JWT and unwraps the
 * response envelope, so every call resolves to { success, message, data, meta }.
 */
const userService = {
  list: (params) => api.get('/users', { params }),
  options: () => api.get('/users/options'),
  get: (id) => api.get(`/users/${id}`),
  create: (payload) => api.post('/users', payload),
  update: (id, payload) => api.patch(`/users/${id}`, payload),
  setStatus: (id, isActive) => api.patch(`/users/${id}/status`, { isActive }),
  resetPassword: (id, newPassword) => api.post(`/users/${id}/reset-password`, { newPassword }),
};

export default userService;
