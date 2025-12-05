import { useState } from 'react';
import api from '../services/api';

const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUsers = async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams(filters);
      const response = await api.get(`/users?${params.toString()}`);
      if (response.data.success) {
        setUsers(response.data.data.users);
        return response.data.data;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch users';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (userData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/register', userData);
      if (response.data.success) {
        setUsers(prev => [...prev, response.data.data.user]);
        return response.data.data;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to create user';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userId, updateData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.put(`/users/${userId}`, updateData);
      if (response.data.success) {
        setUsers(prev => prev.map(user => 
          user._id === userId ? response.data.data.user : user
        ));
        return response.data.data;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to update user';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const activateUser = async (userId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/users/${userId}/activate`);
      if (response.data.success) {
        setUsers(prev => prev.map(user => 
          user._id === userId ? { ...user, isActive: true } : user
        ));
        return response.data;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to activate user';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deactivateUser = async (userId) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/users/${userId}/deactivate`);
      if (response.data.success) {
        setUsers(prev => prev.map(user => 
          user._id === userId ? { ...user, isActive: false } : user
        ));
        return response.data;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to deactivate user';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createTechnician = async (technicianData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/users/technicians', technicianData);
      if (response.data.success) {
        setUsers(prev => [...prev, response.data.data.technician]);
        return response.data.data;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to create technician';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getAvailableTechnicians = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/users/technicians/available');
      if (response.data.success) {
        return response.data.data.technicians;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch technicians';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getUserStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/users/stats');
      if (response.data.success) {
        return response.data.data;
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to fetch user statistics';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  return {
    users,
    loading,
    error,
    fetchUsers,
    createUser,
    createTechnician,
    updateUser,
    activateUser,
    deactivateUser,
    getAvailableTechnicians,
    getUserStats,
    clearError
  };
};

export default useUsers;