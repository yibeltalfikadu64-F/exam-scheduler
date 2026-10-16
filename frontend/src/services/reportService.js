import api from './api';

/**
 * Reports & analytics API client (Phase 7). Read-only.
 *
 *   GET /reports/overview
 *   GET /reports/exam-load
 *   GET /reports/room-utilization
 *   GET /reports/conflicts
 *   GET /reports/invigilation
 *   GET /reports/summary          all sections in one call
 *
 * Optional params: { departmentId, examPeriodId }.
 */
const reportService = {
  overview: (params) => api.get('/reports/overview', { params }),
  examLoad: (params) => api.get('/reports/exam-load', { params }),
  roomUtilization: (params) => api.get('/reports/room-utilization', { params }),
  conflicts: (params) => api.get('/reports/conflicts', { params }),
  invigilation: (params) => api.get('/reports/invigilation', { params }),
  summary: (params) => api.get('/reports/summary', { params }),
};

export default reportService;
