import api from './api';

/**
 * Academic calendar API client (academic years + semesters).
 *
 *   GET /academic-years                 list
 *   GET /academic-years/options         dropdown options (active years)
 *   GET /academic-years/:id/semesters   semesters within a year
 */
const academicYearService = {
  list: (params = {}) => api.get('/academic-years', { params }),

  options: () => api.get('/academic-years/options'),

  semesters: (yearId, params = {}) =>
    api.get(`/academic-years/${yearId}/semesters`, { params }),
};

export default academicYearService;
