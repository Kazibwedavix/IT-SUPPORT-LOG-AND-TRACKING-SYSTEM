import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import userService from '../services/userService';
import ticketService from '../services/ticketService';

// Dashboard data
export const useDashboardData = () => {
  return useQuery({
    queryKey: ['adminDashboard'],
    queryFn: async () => {
      console.log('🔄 Fetching dashboard data...');
      try {
        const [userStats, systemStats, ticketsResponse] = await Promise.all([
          userService.getUserStats(),
          userService.getSystemStats(),
          ticketService.getTickets({ limit: 6, sortBy: 'updatedAt', sortOrder: 'desc' })
        ]);
        
        console.log('✅ Dashboard data fetched:', { userStats, systemStats, tickets: ticketsResponse.tickets?.length });
        
        return {
          userStats,
          systemStats,
          recentTickets: ticketsResponse.tickets || []
        };
      } catch (error) {
        console.error('❌ Dashboard data error:', error);
        throw error;
      }
    },
    refetchInterval: 30000,
  });
};

// Users management
export const useUsers = (filters = {}) => {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: async () => {
      console.log('🔄 Fetching users with filters:', filters);
      try {
        const data = await userService.getAllUsers(filters);
        console.log('✅ Users fetched:', data);
        return data;
      } catch (error) {
        console.error('❌ Users fetch error:', error);
        throw error;
      }
    },
    retry: 1,
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userData) => {
      console.log('🔄 Creating user:', userData);
      try {
        const result = await userService.createUser(userData);
        console.log('✅ User created:', result);
        return result;
      } catch (error) {
        console.error('❌ User creation error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminDashboard']);
      queryClient.invalidateQueries(['users']);
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id) => {
      console.log('🔄 Deleting user:', id);
      try {
        const result = await userService.deleteUser(id);
        console.log('✅ User deleted:', result);
        return result;
      } catch (error) {
        console.error('❌ User deletion error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminDashboard']);
      queryClient.invalidateQueries(['users']);
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, userData }) => userService.updateUser(id, userData),
    onSuccess: () => {
      queryClient.invalidateQueries(['adminDashboard']);
      queryClient.invalidateQueries(['users']);
    },
  });
};

// ==================== NEW DEACTIVATION HOOKS ====================

export const useDeactivateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId) => {
      console.log('🔄 Deactivating user:', userId);
      try {
        const result = await userService.deactivateUser(userId);
        console.log('✅ User deactivated:', result);
        return result;
      } catch (error) {
        console.error('❌ User deactivation error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminDashboard']);
      queryClient.invalidateQueries(['users']);
    },
  });
};

export const useReactivateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId) => {
      console.log('🔄 Reactivating user:', userId);
      try {
        const result = await userService.reactivateUser(userId);
        console.log('✅ User reactivated:', result);
        return result;
      } catch (error) {
        console.error('❌ User reactivation error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminDashboard']);
      queryClient.invalidateQueries(['users']);
    },
  });
};