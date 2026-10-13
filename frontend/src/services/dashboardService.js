
import api from './api';

const dashboardService = {
    getDashboard: () => api.get('/dashboard'),
};

export default dashboardService;
