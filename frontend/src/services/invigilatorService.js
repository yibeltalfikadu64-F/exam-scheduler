import api from './api';

const invigilatorService = {
  list: (params = {}) => api.get('/invigilators', { params }),
  options: () => api.get('/invigilators/options'),
  get: (id) => api.get(`/invigilators/${id}`),
  create: (payload) => api.post('/invigilators', payload),
  update: (id, payload) => api.patch(`/invigilators/${id}`, payload),
  setStatus: (id, isActive) =>
    api.patch(`/invigilators/${id}/status`, { isActive }),
  remove: (id) => api.delete(`/invigilators/${id}`),
  getAvailability: (id) => api.get(`/invigilators/${id}/availability`),
  saveAvailability: (id, windows) =>
    api.put(`/invigilators/${id}/availability`, { windows }),
};

export default invigilatorService;
