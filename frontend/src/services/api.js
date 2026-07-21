import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.origin}/api`;

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            // Redirect to login if not already there
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// API Service functions
export const authService = {
    login: (credentials) => api.post('/auth/login', credentials),
    register: (userData) => api.post('/auth/register', userData),
    getMe: () => api.get('/auth/me'),
    updateProfile: (data) => api.put('/auth/profile', data),
    changePassword: (data) => api.put('/auth/password', data),
};

export const studentService = {
    getAll: (params) => api.get('/students', { params }),
    getById: (id) => api.get(`/students/${id}`),
    create: (data) => api.post('/students', data),
    update: (id, data) => api.put(`/students/${id}`, data),
    delete: (id) => api.delete(`/students/${id}`),
    getByClass: (department, semester, section) =>
        api.get(`/students/class/${department}/${semester}/${section}`),
};

export const teacherService = {
    getAll: (params) => api.get('/teachers', { params }),
    getById: (id) => api.get(`/teachers/${id}`),
    create: (data) => api.post('/teachers', data),
    update: (id, data) => api.put(`/teachers/${id}`, data),
    delete: (id) => api.delete(`/teachers/${id}`),
};

export const classService = {
    getAll: (params) => api.get('/classes', { params }),
    getById: (id) => api.get(`/classes/${id}`),
    create: (data) => api.post('/classes', data),
    update: (id, data) => api.put(`/classes/${id}`, data),
    delete: (id) => api.delete(`/classes/${id}`),
    getStudents: (id) => api.get(`/classes/${id}/students`),
};

export const attendanceService = {
    mark: (data) => api.post('/attendance/mark', data),
    getClass: (params) => api.get('/attendance/class', { params }),
    getStudent: (studentId, params) => api.get(`/attendance/student/${studentId}`, { params }),
    getSummary: (studentId, params) => api.get(`/attendance/summary/${studentId}`, { params }),
    getAnalytics: (params) => api.get('/attendance/analytics', { params }),
    markSelf: () => api.post('/attendance/self-mark'),
    markSelfFace: (data) => api.post('/attendance/self-mark-face', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    getSensorStatus: () => api.get('/attendance/sensor-status'),
};

export const feeService = {
    getStructures: (params) => api.get('/fees/structures', { params }),
    createStructure: (data) => api.post('/fees/structure', data),
    getStudentFees: (studentId, params) => api.get(`/fees/student/${studentId}`, { params }),
    getMyFees: (params) => api.get('/fees/my-fees', { params }),
    makePayment: (data) => api.post('/fees/payment', data),
    getPayments: (studentId) => api.get(`/fees/payments/${studentId}`),
    getAnalytics: (params) => api.get('/fees/analytics', { params }),
    getOverdue: () => api.get('/fees/overdue'),
};

export const scholarshipService = {
    getAll: (params) => api.get('/scholarships', { params }),
    getById: (id) => api.get(`/scholarships/${id}`),
    create: (data) => api.post('/scholarships', data),
    apply: (id, data) => api.post(`/scholarships/${id}/apply`, data),
    getMyApplications: () => api.get('/scholarships/student/my-applications'),
    getAllApplications: (params) => api.get('/scholarships/admin/applications', { params }),
    reviewApplication: (id, data) => api.put(`/scholarships/applications/${id}/review`, data),
};

export const marksService = {
    enter: (data) => api.post('/marks', data),
    getStudentMarks: (studentId, params) => api.get(`/marks/student/${studentId}`, { params }),
    getClassMarks: (params) => api.get('/marks/class', { params }),
    getBacklogs: (studentId, params) => api.get(`/marks/backlogs/${studentId}`, { params }),
    getAnalytics: (params) => api.get('/marks/analytics', { params }),
};

export const noteService = {
    getAll: (params) => api.get('/notes', { params }),
    upload: (data) => api.post('/notes', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    getById: (id) => api.get(`/notes/${id}`),
    download: (id) => api.get(`/notes/${id}/download`),
    getMyNotes: () => api.get('/notes/my-notes'),
    getBySubject: (subjectId) => api.get(`/notes/subject/${subjectId}`),
};

export const leaveService = {
    apply: (data) => api.post('/leave', data),
    getMyLeaves: (params) => api.get('/leave/my-leaves', { params }),
    getAll: (params) => api.get('/leave', { params }),
    getPending: () => api.get('/leave/pending'),
    review: (id, data) => api.put(`/leave/${id}/review`, data),
    cancel: (id) => api.put(`/leave/${id}/cancel`),
};

export const galleryService = {
    getAll: (params) => api.get('/gallery', { params }),
    getCarousel: () => api.get('/gallery/carousel'),
    upload: (data) => api.post('/gallery', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
    }),
    update: (id, data) => api.put(`/gallery/${id}`, data),
    delete: (id) => api.delete(`/gallery/${id}`),
};

export const chatbotService = {
    sendMessage: (message) => api.post('/chatbot/chat', { message }),
};

export const parentService = {
    getWardDashboard: () => api.get('/parents/ward-dashboard'),
    getWardAttendance: (studentId, params) => api.get(`/parents/ward/${studentId}/attendance`, { params }),
    getWardFees: (studentId) => api.get(`/parents/ward/${studentId}/fees`),
    getWardMarks: (studentId) => api.get(`/parents/ward/${studentId}/marks`),
    getWardLeaves: (studentId) => api.get(`/parents/ward/${studentId}/leaves`),
};

export const noticeService = {
    // For all users - personal notice access
    getMyNotices: (params) => api.get('/notices/my-notices', { params }),
    getById: (id) => api.get(`/notices/${id}`),
    markAsRead: (id, data) => api.put(`/notices/${id}/read`, data),
    getUnreadCount: () => api.get('/notices/unread-count'),

    // For authorized users - notice management
    create: (data) => api.post('/notices', data),
    getAll: (params) => api.get('/notices', { params }),
    update: (id, data) => api.put(`/notices/${id}`, data),
    delete: (id) => api.delete(`/notices/${id}`),
    getAnalytics: (id) => api.get(`/notices/${id}/analytics`),

    // File upload for attachments
    uploadAttachment: (data) => api.post('/notices/attachments', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
};

export const adminService = {
    getDashboard: () => api.get('/admin/dashboard'),
    getUsers: (params) => api.get('/admin/users', { params }),
    updateUserStatus: (id, data) => api.put(`/admin/users/${id}/status`, data),
    getSubjects: (params) => api.get('/admin/subjects', { params }),
    createSubject: (data) => api.post('/admin/subjects', data),
    updateSubject: (id, data) => api.put(`/admin/subjects/${id}`, data),
    deleteSubject: (id) => api.delete(`/admin/subjects/${id}`),
    sendNotification: (data) => api.post('/admin/notifications', data),
    getReports: (params) => api.get('/admin/reports', { params }),
    bulkAssignFees: (data) => api.post('/admin/fees/bulk-assign', data),
};

export const superAdminService = {
    getDashboard: () => api.get('/super-admin/dashboard'),
    getUsers: (params) => api.get('/super-admin/users', { params }),
    createUser: (data) => api.post('/super-admin/users', data),
    updateUserRole: (id, data) => api.put(`/super-admin/users/${id}/role`, data),
    toggleUserStatus: (id) => api.put(`/super-admin/users/${id}/status`),
    deleteUser: (id) => api.delete(`/super-admin/users/${id}`),
    getRoles: () => api.get('/super-admin/roles'),
};

export const libraryService = {
    getDashboard: () => api.get('/library/dashboard'),
    getBooks: (params) => api.get('/library/books', { params }),
    addBook: (data) => api.post('/library/books', data),
    updateBook: (id, data) => api.put(`/library/books/${id}`, data),
    deleteBook: (id) => api.delete(`/library/books/${id}`),
    getEligibleUsers: (params) => api.get('/library/eligible-users', { params }),
    getIssues: (params) => api.get('/library/issues', { params }),
    issueBook: (data) => api.post('/library/issue', data),
    returnBook: (issueId) => api.put(`/library/return/${issueId}`),
    deleteIssue: (id) => api.delete(`/library/issue/${id}`),
};

export const frontOfficeService = {
    getDashboard: () => api.get('/front-office/dashboard'),
    getEntries: (params) => api.get('/front-office', { params }),
    createEntry: (data) => api.post('/front-office', data),
    updateEntry: (id, data) => api.put(`/front-office/${id}`, data),
    deleteEntry: (id) => api.delete(`/front-office/${id}`),
    checkoutVisitor: (id) => api.put(`/front-office/${id}/checkout`),
};

export const accountantService = {
    getDashboard: () => api.get('/accountant/dashboard'),
    getIncome: (params) => api.get('/accountant/income', { params }),
    addIncome: (data) => api.post('/accountant/income', data),
    deleteIncome: (id) => api.delete(`/accountant/income/${id}`),
    getExpenses: (params) => api.get('/accountant/expenses', { params }),
    addExpense: (data) => api.post('/accountant/expenses', data),
    deleteExpense: (id) => api.delete(`/accountant/expenses/${id}`),
};

export const collegeService = {
    getInfo: () => api.get('/college-info'),
};

export const meetingService = {
    getAll: (params) => api.get('/meetings', { params }),
    getById: (id) => api.get(`/meetings/${id}`),
    create: (data) => api.post('/meetings', data),
    update: (id, data) => api.put(`/meetings/${id}`, data),
    delete: (id) => api.delete(`/meetings/${id}`),
    getMyMeetings: () => api.get('/meetings/my-meetings'),
    getUpcoming: () => api.get('/meetings/upcoming'),
    join: (id) => api.post(`/meetings/${id}/join`),
    getAnalytics: (params) => api.get('/meetings/analytics', { params }),
};

export default api;
