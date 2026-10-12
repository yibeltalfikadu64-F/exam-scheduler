import api from './api';

/**
 * Program API client.
 *
 * Endpoints:
 *   GET    /programs           list (search, departmentId, degreeType, status, pagination, sort)
 *   GET    /programs/options   dropdown options (can filter by departmentId)
 *   GET    /programs/:id      details
 *   POST   /programs           create
 *   PATCH  /programs/:id       update
 *   PATCH  /programs/:id/status  activate/deactivate
 */
const programService = {
  list: (params) => api.get('/programs', { params }),
  options: (departmentId) => {
    const params = departmentId ? { departmentId } : {};
    return api.get('/programs/options', { params });
  },
  get: (id) => api.get(`/programs/${id}`),
  create: (payload) => api.post('/programs', payload),
  update: (id, payload) => api.patch(`/programs/${id}`, payload),
  setStatus: (id, isActive) => api.patch(`/programs/${id}/status`, { isActive }),
};

export default programService;
