import api from './api';

const ticketService = {
  // Basic Ticket Operations
  createTicket: async (ticketData) => {
    const response = await api.post('/tickets', ticketData);
    return response.data;
  },

  getTickets: async (filters = {}) => {
    const params = new URLSearchParams();
    
    // Enhanced filtering with support for all filter types
    Object.keys(filters).forEach(key => {
      if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
        if (Array.isArray(filters[key])) {
          filters[key].forEach(value => params.append(key, value));
        } else {
          params.append(key, filters[key]);
        }
      }
    });
    
    const response = await api.get(`/tickets?${params}`);
    return response.data;
  },

  getTicket: async (id) => {
    const response = await api.get(`/tickets/${id}`);
    return response.data;
  },

  updateTicket: async (id, updates) => {
    const response = await api.put(`/tickets/${id}`, updates);
    return response.data;
  },

  // ==================== ADMIN-ONLY OPERATIONS ====================

  // Get ALL tickets (admin only - bypasses role-based filtering)
  getAllTickets: async (filters = {}) => {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
        params.append(key, filters[key]);
      }
    });
    
    const response = await api.get(`/tickets/admin/all?${params}`);
    return response.data;
  },

  // Delete ticket (admin only)
  deleteTicket: async (id) => {
    const response = await api.delete(`/tickets/admin/${id}`);
    return response.data;
  },

  // Bulk delete tickets (admin only)
  bulkDeleteTickets: async (ticketIds) => {
    const response = await api.post('/tickets/admin/bulk-delete', { ticketIds });
    return response.data;
  },

  // Force assign ticket (admin override)
  forceAssignTicket: async (ticketId, technicianId, reason = '') => {
    const response = await api.put(`/tickets/admin/${ticketId}/assign`, {
      technicianId,
      reason,
      forced: true
    });
    return response.data;
  },

  // Escalate ticket (admin only)
  escalateTicket: async (ticketId, priority, reason = '') => {
    const response = await api.put(`/tickets/admin/${ticketId}/escalate`, {
      priority,
      reason
    });
    return response.data;
  },

  // ==================== BULK OPERATIONS ====================

  bulkUpdateStatus: async (ticketIds, status, notes = '') => {
    const response = await api.patch('/tickets/bulk/status', {
      ticketIds,
      status,
      notes
    });
    return response.data;
  },

  bulkAssignTickets: async (ticketIds, assigneeId, notes = '') => {
    const response = await api.patch('/tickets/bulk/assign', {
      ticketIds,
      assigneeId,
      notes
    });
    return response.data;
  },

  bulkUpdatePriority: async (ticketIds, priority, notes = '') => {
    const response = await api.patch('/tickets/bulk/priority', {
      ticketIds,
      priority,
      notes
    });
    return response.data;
  },

  // ==================== ANALYTICS & REPORTING ====================

  getTicketStats: async (timeRange = '30d') => {
    const response = await api.get(`/tickets/stats?range=${timeRange}`);
    return response.data;
  },

  // Admin analytics - comprehensive system-wide stats
  getSystemAnalytics: async (period = 'month', department = 'all') => {
    const response = await api.get(`/tickets/admin/analytics?period=${period}&department=${department}`);
    return response.data;
  },

  getDepartmentStats: async () => {
    const response = await api.get('/tickets/analytics/departments');
    return response.data;
  },

  getTechnicianPerformance: async (period = 'month') => {
    const response = await api.get(`/tickets/analytics/technicians?period=${period}`);
    return response.data;
  },

  getSLACompliance: async (period = 'month') => {
    const response = await api.get(`/tickets/analytics/sla?period=${period}`);
    return response.data;
  },

  // ==================== EXPORT FUNCTIONALITY ====================

  exportTickets: async (filters = {}, format = 'csv') => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) params.append(key, filters[key]);
    });
    params.append('format', format);
    
    const response = await api.get(`/tickets/export?${params}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Admin export with all data
  exportAllTickets: async (filters = {}, format = 'csv') => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) params.append(key, filters[key]);
    });
    params.append('format', format);
    
    const response = await api.get(`/tickets/admin/export?${params}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // ==================== COMMENT SYSTEM ====================

  addComment: async (ticketId, commentData) => {
    const response = await api.post(`/tickets/${ticketId}/comments`, commentData);
    return response.data;
  },

  updateComment: async (ticketId, commentId, updates) => {
    const response = await api.put(`/tickets/${ticketId}/comments/${commentId}`, updates);
    return response.data;
  },

  deleteComment: async (ticketId, commentId) => {
    const response = await api.delete(`/tickets/${ticketId}/comments/${commentId}`);
    return response.data;
  },

  // Admin comment operations
  addInternalNote: async (ticketId, content) => {
    const response = await api.post(`/tickets/admin/${ticketId}/internal-notes`, {
      content,
      isInternal: true
    });
    return response.data;
  },

  // ==================== ACTIVITY & AUDIT LOG ====================

  getActivities: async (ticketId) => {
    const response = await api.get(`/tickets/${ticketId}/activities`);
    return response.data;
  },

  getComments: async (ticketId) => {
    const response = await api.get(`/tickets/${ticketId}/comments`);
    return response.data;
  },

  // System-wide activity logs (admin only)
  getSystemActivityLogs: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) params.append(key, filters[key]);
    });
    
    const response = await api.get(`/tickets/admin/activity-logs?${params}`);
    return response.data;
  },

  // ==================== FILE ATTACHMENTS ====================

  uploadAttachment: async (ticketId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post(`/tickets/${ticketId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteAttachment: async (ticketId, fileId) => {
    const response = await api.delete(`/tickets/${ticketId}/attachments/${fileId}`);
    return response.data;
  },

  // ==================== SLA MANAGEMENT ====================

  getSLAStatus: async (ticketId) => {
    const response = await api.get(`/tickets/${ticketId}/sla`);
    return response.data;
  },

  updateSLAPolicy: async (policyData) => {
    const response = await api.put('/tickets/admin/sla-policy', policyData);
    return response.data;
  },

  // ==================== TECHNICIAN MANAGEMENT ====================

  getAvailableTechnicians: async (department = '') => {
    const params = department ? `?department=${department}` : '';
    const response = await api.get(`/tickets/technicians/available${params}`);
    return response.data;
  },

  getTechnicianWorkload: async () => {
    const response = await api.get('/tickets/admin/technician-workload');
    return response.data;
  },

  // ==================== NOTIFICATION MANAGEMENT ====================

  updateNotificationPreferences: async (preferences) => {
    const response = await api.put('/users/notifications/preferences', preferences);
    return response.data;
  },

  // Admin notification controls
  sendSystemNotification: async (notificationData) => {
    const response = await api.post('/tickets/admin/system-notification', notificationData);
    return response.data;
  },

  // ==================== DEBUG & MAINTENANCE ====================

  // Debug endpoints for development
  debugGetAllTickets: async () => {
    const response = await api.get('/tickets/debug/all-tickets');
    return response.data;
  },

  debugTestCreate: async () => {
    const response = await api.post('/tickets/debug/test-create');
    return response.data;
  },

  debugGetSystemStatus: async () => {
    const response = await api.get('/tickets/debug/status');
    return response.data;
  },

  // System maintenance (admin only)
  runSystemCleanup: async () => {
    const response = await api.post('/tickets/admin/system-cleanup');
    return response.data;
  },

  // ==================== UTILITY METHODS ====================

  // Generate ticket report URL
  generateReportUrl: (filters = {}) => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) params.append(key, filters[key]);
    });
    return `/api/tickets/export?${params}`;
  },

  // Validate ticket data before submission
  validateTicketData: (ticketData) => {
    const errors = [];
    
    if (!ticketData.title || ticketData.title.trim().length < 5) {
      errors.push('Title must be at least 5 characters long');
    }
    
    if (!ticketData.description || ticketData.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters long');
    }
    
    if (!ticketData.issueType) {
      errors.push('Issue type is required');
    }
    
    return errors;
  },

  // Format ticket for display
  formatTicket: (ticket) => {
    return {
      ...ticket,
      formattedCreatedAt: new Date(ticket.createdAt).toLocaleDateString(),
      formattedUrgency: ticket.urgency?.charAt(0).toUpperCase() + ticket.urgency?.slice(1),
      isOverdue: ticket.dueDate ? new Date(ticket.dueDate) < new Date() : false
    };
  }
};

export default ticketService;