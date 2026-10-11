import api from './api';

/**
 * Authentication endpoints.
 *
 * NOTE: the backend login endpoint is implemented in Phase 5. Until then the
 * call returns a 404 which the login page surfaces honestly.
 */
const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export default authService;
