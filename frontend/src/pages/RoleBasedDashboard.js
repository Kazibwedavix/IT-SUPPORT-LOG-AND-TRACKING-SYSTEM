import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleBasedDashboard = () => {
  const { user } = useAuth();
  
  // Map roles to their dashboard routes
  const roleRoutes = {
    'admin': '/admin',
    'technician': '/technician',
    'staff': '/staff',
    'student': '/student'
  };

  const redirectTo = roleRoutes[user?.role] || '/login';
  
  return <Navigate to={redirectTo} replace />;
};

export default RoleBasedDashboard;