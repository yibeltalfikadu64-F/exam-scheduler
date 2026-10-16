import api from './api';

/**
 * Course API client.
 *
 * Endpoints:
 * GET    /courses
 * GET    /courses/options
 * GET    /courses/:id
 * POST   /courses
 * PATCH  /courses/:id
 * PATCH  /courses/:id/status
 */

const courseService = {
  /**
   * Get a list of courses.
   * Supports filters such as search, departmentId,
   * programId, status, page, and limit.
   */
  list: (params = {}) => api.get('/courses', { params }),

  /**
   * Get course options for dropdowns.
   */
  options: (params = {}) =>
    api.get('/courses/options', { params }),

  /**
   * Get a single course by ID.
   */
  get: (id) => api.get(`/courses/${id}`),

  /**
   * Create a new course.
   *
   * Example:
   * {
   *   code: 'SEng3341',
   *   name: 'Principles of Compiler Design'
   * }
   */
  create: (payload) => api.post('/courses', payload),

  /**
   * Update an existing course.
   */
  update: (id, payload) =>
    api.patch(`/courses/${id}`, payload),

  /**
   * Activate or deactivate a course.
   *
   * isActive: true  = active
   * isActive: false = inactive
   */
  setStatus: (id, isActive) =>
    api.patch(`/courses/${id}/status`, { isActive }),

  /**
   * Delete a course (admin only; refused while sections/exams/enrollments exist).
   */
  remove: (id) => api.delete(`/courses/${id}`),
};

export default courseService;
