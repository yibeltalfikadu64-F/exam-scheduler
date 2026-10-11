import api from './api';

/**
 * Health / status endpoints.
 * GET /api/v1/health -> { success, message, data: { status, application, database, timestamp } }
 */
const healthService = {
  getHealth: () => api.get('/health'),
};

export default healthService;
