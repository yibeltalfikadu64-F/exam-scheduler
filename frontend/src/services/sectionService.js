import api from './api';

/**
 * Section API client.
 *
 * Endpoints:
 *   GET    /sections            list (search, departmentId, courseId, programId,
 *                               academicYearId, semesterId, instructorId, status, page, limit)
 *   GET    /sections/:id        details
 *   POST   /sections            create (admin only)
 *   PATCH  /sections/:id        update (admin only)
 *   PATCH  /sections/:id/status activate/deactivate (admin only)
 */
const sectionService = {
  list: (params = {}) => api.get('/sections', { params }),

  get: (id) => api.get(`/sections/${id}`),

  create: (payload) => api.post('/sections', payload),

  update: (id, payload) => api.patch(`/sections/${id}`, payload),

  setStatus: (id, isActive) =>
    api.patch(`/sections/${id}/status`, { isActive }),
};

export default sectionService;
