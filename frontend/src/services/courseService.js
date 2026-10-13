import api from './api';

/**
 * Course API client.
 *
 * Endpoints:
 *   GET    /courses           list (search, departmentId, programId, status, pagination, sort)
 *   GET    /courses/options   dropdown options (can filter by departmentId, programId)
 *   GET    /courses/:id       details
 *   POST   /courses           create
 *   PATCH  /courses/:id       update
 *   PATCH  /courses/:id/status  activate/deactivate
 */
const courseService = {
  list: (params) => api.get('/courses', { params }),
  options: (params) => api.get('/courses/options', { params }),
  get: (id) => api.get(`/courses/${id}`),
  create: (payload) => api.post('/courses', payload),
  update: (id, payload) => api.patch(`/courses/${id}`, payload),
  setStatus: (id, isActive) => api.patch(`/courses/${id}/status`, { isActive }),
};

export default courseService;
