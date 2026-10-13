import api from './api';

const roomService = {
  list: (params = {}) => api.get('/rooms', { params }),
  options: (params = {}) => api.get('/rooms/options', { params }),
  get: (id) => api.get(`/rooms/${id}`),
  create: (payload) => api.post('/rooms', payload),
  update: (id, payload) => api.patch(`/rooms/${id}`, payload),
  setStatus: (id, isActive) =>
    api.patch(`/rooms/${id}/status`, { isActive }),
  remove: (id) => api.delete(`/rooms/${id}`),
  closures: (id) => api.get(`/rooms/${id}/closures`),
  createClosure: (id, payload) =>
    api.post(`/rooms/${id}/closures`, payload),
  updateClosure: (id, closureId, payload) =>
    api.patch(`/rooms/${id}/closures/${closureId}`, payload),
  removeClosure: (id, closureId) =>
    api.delete(`/rooms/${id}/closures/${closureId}`),
};

export default roomService;
