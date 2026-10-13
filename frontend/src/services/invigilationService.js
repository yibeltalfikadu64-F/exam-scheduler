import api from './api';

const invigilationService = {
  settings: () => api.get('/invigilation/settings'),
  duties: (params = {}) => api.get('/invigilation/duties', { params }),
  duty: (id) => api.get(`/invigilation/duties/${id}`),
  roster: (params = {}) => api.get('/invigilation/roster', { params }),
  assign: (payload) => api.post('/invigilation/assign', payload),
  reassign: (id, payload) =>
    api.patch(`/invigilation/duties/${id}/reassign`, payload),
  cancel: (id) => api.post(`/invigilation/duties/${id}/cancel`),
  autoAssign: (payload) => api.post('/invigilation/auto-assign', payload),
  workload: (params = {}) =>
    api.get('/invigilation/workload', { params }),
  unfilled: (params = {}) =>
    api.get('/invigilation/unfilled', { params }),
  conflicts: (params = {}) =>
    api.get('/invigilation/conflicts', { params }),
  examDetails: (params = {}) =>
    api.get('/invigilation/details', { params }),
  eligibleInvigilators: (detailId) =>
    api.get(`/invigilation/details/${detailId}/eligible-invigilators`),
  publishRoster: (payload) =>
    api.post('/invigilation/roster/publish', payload),
  unpublishRoster: (payload) =>
    api.post('/invigilation/roster/unpublish', payload),
};

export default invigilationService;
