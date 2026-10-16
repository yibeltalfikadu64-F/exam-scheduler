import api from './api';

/**
 * Exam period API client (Phase 7).
 *
 *   GET    /exam-periods               list (pagination, search, status)
 *   GET    /exam-periods/options       dropdown options
 *   GET    /exam-periods/:id
 *   GET    /exam-periods/:id/dependencies
 *   POST   /exam-periods
 *   PATCH  /exam-periods/:id
 *   PATCH  /exam-periods/:id/status    lifecycle status
 *   DELETE /exam-periods/:id           admin only; refused when in use
 */
const examPeriodService = {
  list: (params = {}) => api.get('/exam-periods', { params }),
  options: () => api.get('/exam-periods/options'),
  get: (id) => api.get(`/exam-periods/${id}`),
  dependencies: (id) => api.get(`/exam-periods/${id}/dependencies`),
  create: (payload) => api.post('/exam-periods', payload),
  update: (id, payload) => api.patch(`/exam-periods/${id}`, payload),
  setStatus: (id, status) => api.patch(`/exam-periods/${id}/status`, { status }),
  remove: (id) => api.delete(`/exam-periods/${id}`),
};

export default examPeriodService;
