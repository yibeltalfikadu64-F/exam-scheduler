import axios from 'axios';

/**
 * Single Axios instance for the whole app.
 *
 * - Base URL and timeout come from environment variables.
 * - Attaches the JWT access token (once authentication exists).
 * - Unwraps the response body and normalizes errors to
 *   { message, status, code, details } so callers never deal with Axios shapes.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('es_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const payload = error.response ? error.response.data : null;
    return Promise.reject({
      message: (payload && payload.message) || error.message || 'Network error',
      status: error.response ? error.response.status : 0,
      code: payload ? payload.code : undefined,
      details: payload ? payload.details : undefined,
    });
  }
);

export default api;
