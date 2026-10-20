import api from './api';

/**
 * System settings API client (Phase 7).
 *
 *   GET /settings          full catalogue (admin UI)
 *   GET /settings/public   branding/theme subset (any authenticated user)
 *   PUT /settings          save a map of { key: value } (admin only)
 */
const settingsService = {
  list: () => api.get('/settings'),
  public: () => api.get('/settings/public'),
  update: (settings) => api.put('/settings', { settings }),
};

export default settingsService;

export async function getResetPreview() {
  const response = await api.get('/settings/reset/preview');
  const payload = response?.data ?? response;
  return payload?.data ?? payload;
}

export async function executeSystemReset(confirm) {
  const response = await api.post('/settings/reset/execute', { confirm });
  const payload = response?.data ?? response;
  return payload?.data ?? payload;
}

