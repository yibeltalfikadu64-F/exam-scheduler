import api from './api';

const studentService = {
    list: (params = {}) => api.get('/students', { params }),

    get: (id) => api.get(`/students/${id}`),

    create: (payload) => api.post('/students', payload),

    update: (id, payload) => api.patch(`/students/${id}`, payload),

    setStatus: (id, status) =>
        api.patch(`/students/${id}/status`, { status }),

    listEnrollments: (studentId) =>
        api.get(`/students/${studentId}/enrollments`),

    addEnrollment: (studentId, sectionId) =>
        api.post(`/students/${studentId}/enrollments`, { sectionId }),

    setEnrollmentStatus: (studentId, enrollmentId, status) =>
        api.patch(
            `/students/${studentId}/enrollments/${enrollmentId}`,
            { status }
        ),
};

export default studentService;