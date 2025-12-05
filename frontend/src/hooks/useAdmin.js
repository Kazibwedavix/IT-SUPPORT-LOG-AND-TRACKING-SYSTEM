import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import adminService from '../services/adminService';

// Users
export const useUsers = (filters = {}) => {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: () => adminService.getUsers(filters),
    select: (response) => response.data,
  });
};

export const useUser = (id) => {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => adminService.getUser(id),
    enabled: !!id,
    select: (response) => response.data,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userData) => adminService.createUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, userData }) => adminService.updateUser(id, userData),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id) => adminService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
    },
  });
};

// Statistics
export const useUserStats = () => {
  return useQuery({
    queryKey: ['userStats'],
    queryFn: () => adminService.getUserStats(),
    select: (response) => response.data,
  });
};

export const useSystemStats = () => {
  return useQuery({
    queryKey: ['systemStats'],
    queryFn: () => adminService.getSystemStats(),
    select: (response) => response.data,
  });
};

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => adminService.getDashboardStats(),
    select: (response) => response.data,
  });
};