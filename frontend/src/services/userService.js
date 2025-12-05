import api from './api';

const userService = {
  
  getTechnicians: async () => {
    const response = await api.get('/users/technicians');
    return response.data;
  },

  getDashboardStats: async () => {
    const response = await api.get('/users/dashboard/stats');
    return response.data;
  },

  getDepartmentStats: async () => {
    const response = await api.get('/users/dashboard/department/stats');
    return response.data;
  },


  // Get all users with advanced filtering (admin only) 
  getAllUsers: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
        params.append(key, filters[key]);
      }
    });
    
    const response = await api.get(`/users/admin/users?${params}`);
    return response.data;
  },

  // Admin-only user creation
  createUser: async (userData) => {
    const response = await api.post('/users/admin/users', userData);
    return response.data;
  },

  // Admin-only user updates 
  updateUser: async (userId, updates) => {
    const response = await api.put(`/users/admin/users/${userId}`, updates);
    return response.data;
  },

  // Admin-only user deletion 
  deleteUser: async (userId) => {
    const response = await api.delete(`/users/admin/users/${userId}`);
    return response.data;
  },

  // Get user by ID (admin only) 
  getUserById: async (userId) => {
    const response = await api.get(`/users/admin/users/${userId}`);
    return response.data;
  },

  

  // Deactivate user (admin only) 
  deactivateUser: async (userId) => {
    console.log('🔄 userService: Deactivating user', userId);
    try {
      const response = await api.put(`/users/admin/users/${userId}/deactivate`);
      console.log('✅ userService: User deactivated successfully');
      return response.data;
    } catch (error) {
      console.error('❌ userService: Deactivation error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Reactivate user (admin only) 
  reactivateUser: async (userId) => {
    console.log('🔄 userService: Reactivating user', userId);
    try {
      const response = await api.put(`/users/admin/users/${userId}/reactivate`);
      console.log('✅ userService: User reactivated successfully');
      return response.data;
    } catch (error) {
      console.error('❌ userService: Reactivation error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ==================== STATISTICS 

  // User statistics for admin dashboard 
  getUserStats: async () => {
    const response = await api.get('/users/admin/stats');
    return response.data;
  },

  // Comprehensive system statistics (admin only) 
  getSystemStats: async () => {
    const response = await api.get('/users/admin/system-stats');
    return response.data;
  },

  // ==================== USER PROFILE MANAGEMENT 

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  updateProfile: async (updates) => {
    const response = await api.put('/users/profile', updates);
    return response.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/users/change-password', {
      currentPassword,
      newPassword
    });
    return response.data;
  },



  // Validate user data
  validateUserData: (userData) => {
    const errors = [];
    
    if (!userData.username || userData.username.trim().length < 3) {
      errors.push('Username must be at least 3 characters long');
    }
    
    if (!userData.email || !/\S+@\S+\.\S+/.test(userData.email)) {
      errors.push('Valid email address is required');
    }
    
    if (!userData.password || userData.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }
    
    if (!userData.role) {
      errors.push('User role is required');
    }
    
    return errors;
  },

  // Format user for display
  formatUser: (user) => {
    return {
      ...user,
      formattedCreatedAt: new Date(user.createdAt).toLocaleDateString(),
      formattedLastLogin: user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never',
      status: user.isActive ? (user.isVerified ? 'Active' : 'Pending Verification') : 'Inactive',
      roleDisplay: user.role?.charAt(0).toUpperCase() + user.role?.slice(1)
    };
  },

  // Check if user has admin privileges
  isAdmin: (user) => {
    return user?.role === 'admin';
  },

  // Check if user can manage other users
  canManageUsers: (user) => {
    return ['admin', 'technician'].includes(user?.role);
  }
};

export default userService;