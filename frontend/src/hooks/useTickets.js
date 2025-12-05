// frontend/src/hooks/useTickets.js
import { useState } from 'react';
import api from '../services/api';

const useTickets = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTickets = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(filters);
      const response = await api.get(`/tickets?${params.toString()}`);
      if (response.data.success) {
        setTickets(response.data.data.tickets);
        return response.data.data;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch tickets';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (ticketData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/tickets', ticketData);
      if (response.data.success) {
        setTickets(prev => [...prev, response.data.data.ticket]);
        return response.data.data;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to create ticket';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateTicket = async (ticketId, updateData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.put(`/tickets/${ticketId}`, updateData);
      if (response.data.success) {
        setTickets(prev => prev.map(ticket => 
          ticket._id === ticketId ? response.data.data.ticket : ticket
        ));
        return response.data.data;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to update ticket';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const addTicketNote = async (ticketId, note) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/tickets/${ticketId}/notes`, { note });
      if (response.data.success) {
        return response.data.data;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to add note';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (ticketId, feedback) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/tickets/${ticketId}/feedback`, feedback);
      if (response.data.success) {
        return response.data;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to submit feedback';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  return {
    tickets,
    loading,
    error,
    fetchTickets,
    createTicket,
    updateTicket,
    addTicketNote,
    submitFeedback,
    clearError
  };
};

export default useTickets;