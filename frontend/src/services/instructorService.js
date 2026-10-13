import api from './api';

const instructorService = {
  list: (params = {}) => api.get('/instructors', { params }),
  options: (departmentId) =>
    api.get('/instructors/options', {
      params: departmentId ? { departmentId } : {},
    }),
  get: (id) => api.get(`/instructors/${id}`),
  create: (payload) => api.post('/instructors', payload),
  update: (id, payload) => api.patch(`/instructors/${id}`, payload),
  setStatus: (id, isActive) =>
    api.patch(`/instructors/${id}/status`, { isActive }),
};

export default instructorService;
