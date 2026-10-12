import api from './api';

/**
 * Department API client.
 *
 * Endpoints:
 *   GET    /departments           list (search, status, pagination, sort)
 *   GET    /departments/options   dropdown options
 *   GET    /departments/:id      details
 *   GET    /departments/:id/dependencies  dependency counts
 *   POST   /departments           create
 *   PATCH  /departments/:id       update
 *   PATCH  /departments/:id/status  activate/deactivate
 */
const departmentService = {
  list: (params) => api.get('/departments', { params }),
  options: () => api.get('/departments/options'),
  get: (id) => api.get(`/departments/${id}`),
  dependencies: (id) => api.get(`/departments/${id}/dependencies`),
  create: (payload) => api.post('/departments', payload),
  update: (id, payload) => api.patch(`/departments/${id}`, payload),
  setStatus: (id, isActive) => api.patch(`/departments/${id}/status`, { isActive }),
};

export default departmentService;
