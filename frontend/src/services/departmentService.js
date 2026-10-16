
import api from './api';

/**
 * Department API client.
 *
 * Endpoints:
 *   GET    /departments
 *   GET    /departments/options
 *   GET    /departments/:id
 *   GET    /departments/:id/dependencies
 *   POST   /departments
 *   PATCH  /departments/:id
 *   PATCH  /departments/:id/status
 */
const departmentService = {
  /**
   * Get the department catalogue.
   * Supports search, status, pagination, and sorting.
   */
  list: (params = {}) =>
    api.get('/departments', { params }),

  /**
   * Get departments for dropdowns.
   * The backend options endpoint should return all departments
   * that users are allowed to select.
   */
  options: () =>
    api.get('/departments/options'),

  /**
   * Get one department by ID.
   */
  get: (id) =>
    api.get(`/departments/${id}`),

  /**
   * Get dependency counts for a department.
   */
  dependencies: (id) =>
    api.get(`/departments/${id}/dependencies`),

  /**
   * Create a department.
   */
  create: (payload) =>
    api.post('/departments', payload),

  /**
   * Update a department.
   */
  update: (id, payload) =>
    api.patch(`/departments/${id}`, payload),

  /**
   * Activate or deactivate a department.
   */
  setStatus: (id, isActive) =>
    api.patch(`/departments/${id}/status`, { isActive }),

  /**
   * Delete a department (admin only; refused while dependents exist).
   */
  remove: (id) =>
    api.delete(`/departments/${id}`),
};

export default departmentService;
