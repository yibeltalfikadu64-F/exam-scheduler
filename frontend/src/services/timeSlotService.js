import api from './api';

const timeSlotService = {
  list: (params = {}) => api.get('/time-slots', { params }),
  options: () => api.get('/time-slots/options'),
  get: (id) => api.get(`/time-slots/${id}`),
  create: (payload) => api.post('/time-slots', payload),
  update: (id, payload) => api.patch(`/time-slots/${id}`, payload),
  setStatus: (id, isActive) =>
    api.patch(`/time-slots/${id}/status`, { isActive }),
  remove: (id) => api.delete(`/time-slots/${id}`),
};

export default timeSlotService;
