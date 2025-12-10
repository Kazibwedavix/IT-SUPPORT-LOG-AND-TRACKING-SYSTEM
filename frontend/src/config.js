// src/config.js
/**
 * Application Configuration
 * Centralized configuration for all API endpoints and settings
 */

// Get environment variables from .env file
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'ws://localhost:5002';

const config = {
  // Base URLs
  apiUrl: API_BASE_URL,
  apiBaseUrl: `${API_BASE_URL}/api`,
  socketUrl: SOCKET_URL,
  
  // API Endpoints
  endpoints: {
    // Auth
    auth: {
      login: `${API_BASE_URL}/api/auth/login`,
      register: `${API_BASE_URL}/api/auth/register`,
      logout: `${API_BASE_URL}/api/auth/logout`,
      refresh: `${API_BASE_URL}/api/auth/refresh`,
      me: `${API_BASE_URL}/api/auth/me`,
      forgotPassword: `${API_BASE_URL}/api/auth/forgot-password`,
      resetPassword: `${API_BASE_URL}/api/auth/reset-password`,
      verifyEmail: `${API_BASE_URL}/api/auth/verify-email`,
      checkUsername: `${API_BASE_URL}/api/auth/check-username`,
      checkEmail: `${API_BASE_URL}/api/auth/check-email`,
      resendVerification: `${API_BASE_URL}/api/auth/resend-verification`,
      changePassword: `${API_BASE_URL}/api/auth/change-password`,
    },
    
    // Health
    health: `${API_BASE_URL}/api/health`,
    
    // Tickets
    tickets: {
      base: `${API_BASE_URL}/api/tickets`,
      create: `${API_BASE_URL}/api/tickets`,
      list: `${API_BASE_URL}/api/tickets`,
      detail: (id) => `${API_BASE_URL}/api/tickets/${id}`,
      assign: (id) => `${API_BASE_URL}/api/tickets/${id}/assign`,
      close: (id) => `${API_BASE_URL}/api/tickets/${id}/close`,
      addComment: (id) => `${API_BASE_URL}/api/tickets/${id}/comments`,
      attachments: (id) => `${API_BASE_URL}/api/tickets/${id}/attachments`,
    },
    
    // Users
    users: {
      profile: `${API_BASE_URL}/api/users/profile`,
      updateProfile: `${API_BASE_URL}/api/users/profile`,
      list: `${API_BASE_URL}/api/users`,
    },
    
    // Dashboard
    dashboard: {
      stats: `${API_BASE_URL}/api/dashboard/stats`,
      activity: `${API_BASE_URL}/api/dashboard/activity`,
      metrics: `${API_BASE_URL}/api/dashboard/metrics`,
    },
    
    // Admin
    admin: {
      users: `${API_BASE_URL}/api/admin/users`,
      settings: `${API_BASE_URL}/api/admin/settings`,
      auditLogs: `${API_BASE_URL}/api/admin/audit-logs`,
      systemLogs: `${API_BASE_URL}/api/admin/system-logs`,
    },
    
    // Notifications
    notifications: {
      list: `${API_BASE_URL}/api/notifications`,
      markRead: (id) => `${API_BASE_URL}/api/notifications/${id}/read`,
      delete: (id) => `${API_BASE_URL}/api/notifications/${id}`,
      unreadCount: `${API_BASE_URL}/api/notifications/unread`,
      markAllRead: `${API_BASE_URL}/api/notifications/read-all`,
    },
    
    // Analytics
    analytics: {
      tickets: `${API_BASE_URL}/api/analytics/tickets`,
      sla: `${API_BASE_URL}/api/analytics/sla`,
      technicians: `${API_BASE_URL}/api/analytics/technicians`,
      departments: `${API_BASE_URL}/api/analytics/departments`,
    },
    
    // System
    system: {
      status: `${API_BASE_URL}/api/system/status`,
    },
  },
  
  // App Settings
  app: {
    name: 'Bugema University IT Support System',
    version: '1.0.0',
    supportEmail: 'itsupport@bugemauniv.ac.ug',
    supportPhone: '0784845785',
    university: 'Bugema University',
  },
  
  // Security
  security: {
    tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    inactivityTimeout: 30 * 60 * 1000, // 30 minutes
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
  },
  
  // UI Settings
  ui: {
    defaultPageSize: 20,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
  },
  
  // Environment
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Feature Flags
  features: {
    enableRegistration: true,
    enableEmailVerification: true,
    enablePasswordReset: true,
    enableTicketAttachments: true,
    enableNotifications: true,
    enableWebSocket: true,
    enableDashboard: true,
    enableReports: true,
  },
  
  // Ticket Settings
  ticket: {
    priorities: ['Low', 'Medium', 'High', 'Critical'],
    categories: ['Hardware', 'Software', 'Network', 'Email', 'Access', 'Other'],
    statuses: ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'],
  },
};

// Helper function to get full URL
config.getUrl = (endpoint) => {
  if (typeof endpoint === 'function') {
    return endpoint;
  }
  return endpoint;
};

// Helper function to check if endpoint exists
config.hasEndpoint = (path) => {
  const parts = path.split('.');
  let current = config.endpoints;
  
  for (const part of parts) {
    if (current[part] === undefined) {
      return false;
    }
    current = current[part];
  }
  return true;
};

// Export configuration
export default config;