import api from './api';

/**
 * Authentication endpoints (Phase 5).
 *
 * login() accepts { username | email, password } and resolves to the standard
 * response envelope { success, message, data: { token, user, ... } }.
 */
const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export default authService;
