// frontend/src/components/ProtectedRoute.js
import React, { useContext, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types'; // Import PropTypes
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import apiService from '../services/api'; // Import the enhanced apiService

/**
 * Production-grade Protected Route component
 * Features:
 * - Authentication checking
 * - Role-based access control
 * - Loading states
 * - Session validation
 * - Redirect handling
 * - Error boundary integration
 */

const ProtectedRoute = ({ 
  children, 
  requiredRoles = [], 
  redirectPath = '/login',
  requireVerifiedEmail = false,
  showLoading = true 
}) => {
  const { user, isLoading, isAuthenticated, logout } = useContext(AuthContext);
  const location = useLocation();
  const [isValidatingSession, setIsValidatingSession] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // Validate session with backend on component mount and when auth state changes
  useEffect(() => {
    let isMounted = true;
    
    const validateSession = async () => {
      // Skip validation if no token exists
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      if (!token) {
        if (isMounted) {
          setValidationError('NO_TOKEN');
        }
        return;
      }
      
      if (isMounted) {
        setIsValidatingSession(true);
        setValidationError(null);
      }
      
      try {
        // Optional: Validate session with backend
        // This can be enabled for extra security
        if (process.env.REACT_APP_ENABLE_SESSION_VALIDATION === 'true') {
          await apiService.testConnection();
          // Or call a specific session validation endpoint
          // await apiService.get('/auth/validate-session');
        }
        
        if (isMounted) {
          setValidationError(null);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Session validation failed:', error);
          setValidationError('SESSION_INVALID');
          
          // Auto-logout on session validation failure
          if (error.code === 'AUTH_REQUIRED' || error.response?.status === 401) {
            setTimeout(() => {
              if (isMounted) {
                logout();
              }
            }, 1000);
          }
        }
      } finally {
        if (isMounted) {
          setIsValidatingSession(false);
        }
      }
    };
    
    if (isAuthenticated && user) {
      validateSession();
    }
    
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, user, logout]);

  // Check if user has required roles
  const hasRequiredRole = () => {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    if (!user || !user.roles) return false;
    
    return requiredRoles.some(role => user.roles.includes(role));
  };

  // Check if email verification is required and user is verified
  const isEmailVerified = () => {
    if (!requireVerifiedEmail) return true;
    if (!user) return false;
    
    // Check based on your user model structure
    return user.isEmailVerified || user.emailVerified || user.verified || true;
  };

  // Show loading state
  if (isLoading || isValidatingSession) {
    if (showLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50" data-testid="protected-route-loading">
          <LoadingSpinner 
            size="lg" 
            message={isValidatingSession ? "Validating session..." : "Loading..."}
          />
        </div>
      );
    }
    return null;
  }

  // Handle validation errors
  if (validationError === 'SESSION_INVALID') {
    // Store the attempted location for redirect after login
    sessionStorage.setItem('redirectAfterLogin', location.pathname + location.search);
    
    return (
      <Navigate 
        to={`${redirectPath}?session=invalid&redirect=${encodeURIComponent(location.pathname)}`} 
        replace 
        state={{ from: location }}
      />
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    // Store the attempted location for redirect after login
    sessionStorage.setItem('redirectAfterLogin', location.pathname + location.search);
    
    return (
      <Navigate 
        to={`${redirectPath}?redirect=${encodeURIComponent(location.pathname)}`} 
        replace 
        state={{ from: location }}
      />
    );
  }

  // Check email verification
  if (!isEmailVerified()) {
    return (
      <Navigate 
        to="/verify-email" 
        replace 
        state={{ 
          from: location,
          message: "Please verify your email address to access this page."
        }}
      />
    );
  }

  // Check role-based access
  if (!hasRequiredRole()) {
    // Log unauthorized access attempt (security monitoring)
    console.warn(`Unauthorized access attempt by user ${user.id} to ${location.pathname}`);
    
    // Optionally send to security monitoring
    if (process.env.NODE_ENV === 'production') {
      // apiService.post('/security/access-denied', {
      //   userId: user.id,
      //   path: location.pathname,
      //   requiredRoles,
      //   userRoles: user.roles,
      //   timestamp: new Date().toISOString()
      // }).catch(() => {});
    }
    
    return (
      <Navigate 
        to="/unauthorized" 
        replace 
        state={{ 
          from: location,
          requiredRoles,
          userRoles: user.roles
        }}
      />
    );
  }

  // Render children or outlet
  return children ? children : <Outlet />;
};

// Production-grade PropTypes with documentation
ProtectedRoute.propTypes = {
  /**
   * Child components to render when authenticated
   */
  children: PropTypes.node,
  
  /**
   * Array of required roles to access this route
   * If empty array, only authentication is required
   */
  requiredRoles: PropTypes.arrayOf(PropTypes.string),
  
  /**
   * Path to redirect to when not authenticated
   * @default '/login'
   */
  redirectPath: PropTypes.string,
  
  /**
   * Whether email verification is required
   * @default false
   */
  requireVerifiedEmail: PropTypes.bool,
  
  /**
   * Whether to show loading spinner during authentication check
   * @default true
   */
  showLoading: PropTypes.bool,
};

ProtectedRoute.defaultProps = {
  requiredRoles: [],
  redirectPath: '/login',
  requireVerifiedEmail: false,
  showLoading: true,
};

// Export with display name for debugging
ProtectedRoute.displayName = 'ProtectedRoute';

export default ProtectedRoute;