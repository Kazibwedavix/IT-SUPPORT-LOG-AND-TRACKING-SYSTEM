import api from './api';

const adminService = {
  // User Management
  getUsers: (params = {}) => api.get('/users/admin/users', { params }),
  getUser: (id) => api.get(`/users/admin/users/${id}`),
  createUser: (userData) => api.post('/users/admin/users', userData),
  updateUser: (id, userData) => api.put(`/users/admin/users/${id}`, userData),
  deleteUser: (id) => api.delete(`/users/admin/users/${id}`),

  // Statistics
  getUserStats: () => api.get('/users/admin/stats'),
  getSystemStats: () => api.get('/users/admin/system-stats'),
  getDashboardStats: () => api.get('/users/dashboard/stats'),
  getDepartmentStats: () => api.get('/users/dashboard/department/stats'),
  
  // Technicians
  getTechnicians: () => api.get('/users/technicians')
};

export default adminService;