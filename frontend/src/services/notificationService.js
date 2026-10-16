import api from './api';

/**
 * Notification API client (Phase 6/7).
 *
 *   GET  /notifications                 the caller's own inbox
 *   GET  /notifications/unread-count
 *   POST /notifications/:id/read
 *   POST /notifications/read-all
 *   GET  /notifications/queue           delivery queue (admin/registrar)
 *   POST /notifications/dispatch        pump pending email (admin)
 */
const notificationService = {
  inbox: (params) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  queue: (params) => api.get('/notifications/queue', { params }),
  dispatch: (ids) => api.post('/notifications/dispatch', ids ? { ids } : {}),
};

export default notificationService;
