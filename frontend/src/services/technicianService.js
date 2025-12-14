import api from './api';

const technicianService = {
  getTechnicianStats: async (userId) => {
    const response = await api.get(`/technicians/${userId}/stats`);
    return response.data;
  },
  
  getAssignedTickets: async (userId, filters = {}) => {
    const params = new URLSearchParams(filters);
    const response = await api.get(`/technicians/${userId}/tickets?${params}`);
    return response.data;
  },
  
  getPerformanceMetrics: async (userId, timeframe = 'month') => {
    const response = await api.get(`/technicians/${userId}/metrics?timeframe=${timeframe}`);
    return response.data;
  },
  
  updateTicketStatus: async (ticketId, status, notes = '') => {
    const response = await api.put(`/technicians/tickets/${ticketId}/status`, {
      status,
      notes
    });
    return response.data;
  }
};

export default technicianService;