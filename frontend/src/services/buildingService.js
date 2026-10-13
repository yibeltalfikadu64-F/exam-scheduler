import api from './api';

const buildingService = {
  list: (params = {}) => api.get('/buildings', { params }),
  options: () => api.get('/buildings/options'),
  get: (id) => api.get(`/buildings/${id}`),
  create: (payload) => api.post('/buildings', payload),
  update: (id, payload) => api.patch(`/buildings/${id}`, payload),
  setStatus: (id, isActive) =>
    api.patch(`/buildings/${id}/status`, { isActive }),
  remove: (id) => api.delete(`/buildings/${id}`),
};

export default buildingService;
