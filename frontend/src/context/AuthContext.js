// frontend/src/context/AuthContext.js - PRODUCTION READY COMPLETE FIX
import React, { createContext, useState, useContext, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { authService } from '../services/authService';

/**
 * Enterprise Auth Context v5.3.0 - COMPLETE PRODUCTION FIX
 * Fixed: logSecurityEvent properly exported in context
 * Fixed: No infinite re-render loops
 */

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

class AuthErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Auth Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#fef2f2',
          borderRadius: '8px',
          margin: '20px'
        }}>
          <h3 style={{ color: '#dc2626', marginBottom: '16px' }}>Authentication Error</h3>
          <p style={{ color: '#4b5563', marginBottom: '24px' }}>
            Something went wrong with authentication. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const createPerformanceMonitor = () => {
  const metrics = {
    loginTime: null,
    refreshTime: null,
    sessionChecks: 0,
    errors: [],
    securityEvents: []
  };

  return {
    startMeasurement(operation) {
      const startTime = performance.now();
      return () => {
        const duration = performance.now() - startTime;
        metrics[operation] = duration;
        if (duration > 1000 && process.env.NODE_ENV === 'development') {
          console.warn(`Slow auth operation: ${operation} took ${duration.toFixed(2)}ms`);
        }
      };
    },

    logError(error, operation) {
      metrics.errors.push({ operation, error: error.message, timestamp: new Date().toISOString() });
    },

    logSecurityEvent(eventType, details) {
      const event = { eventType, details, timestamp: new Date().toISOString() };
      metrics.securityEvents.push(event);
      return event;
    },

    getMetrics() {
      return { ...metrics };
    }
  };
};

// Main AuthProvider Component
export const AuthProvider = ({ children }) => {
  const [state, setState] = useState({
    user: null,
    session: null,
    loading: true,
    error: null,
    success: null,
    sessionExpiresAt: null,
    permissions: new Set()
  });

  const refreshTimerRef = useRef(null);
  const sessionCheckRef = useRef(null);
  const activityTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  const performanceMonitor = useMemo(() => createPerformanceMonitor(), []);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setAuthState = useCallback((updates) => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const clearTimers = useCallback(() => {
    [refreshTimerRef, sessionCheckRef, activityTimerRef].forEach(ref => {
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    });
  }, []);

  // CRITICAL: logSecurityEvent function - properly memoized and exported
  const logSecurityEvent = useCallback((eventType, details) => {
    const currentUser = stateRef.current.user;
    const currentSession = stateRef.current.session;
    
    // Log to performance monitor
    performanceMonitor.logSecurityEvent(eventType, details);
    
    // Prepare log data
    const logData = {
      eventType,
      details,
      timestamp: new Date().toISOString(),
      userId: currentUser?.id,
      userRole: currentUser?.role,
      sessionId: currentSession?.id,
      source: 'auth_context',
      userAgent: navigator.userAgent,
      url: window.location.href,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    
    // Development logging (optional)
    if (process.env.NODE_ENV === 'development') {
      const importantEvents = ['login_failed', 'registration_failed', 'security_violation'];
      if (importantEvents.includes(eventType)) {
        console.log(`[SECURITY] ${eventType}:`, details);
      }
    }
    
    // Production logging (non-blocking)
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => {
        try {
          fetch('/api/logs/security', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': currentSession?.accessToken ? `Bearer ${currentSession.accessToken}` : ''
            },
            body: JSON.stringify(logData)
          }).catch(() => {});
        } catch (error) {}
      }, 0);
    }
    
    return logData;
  }, [performanceMonitor]);

  const scheduleTokenRefresh = useCallback((expiresAt) => {
    clearTimers();
    if (!expiresAt) return;

    const refreshTime = expiresAt - (5 * 60 * 1000) - Date.now();
    if (refreshTime > 0) {
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const endMeasurement = performanceMonitor.startMeasurement('tokenRefresh');
          await authService.refreshAccessToken();
          endMeasurement();
          
          const session = authService.getCurrentSession();
          if (session) {
            setAuthState({ session, sessionExpiresAt: session.expiresAt });
            scheduleTokenRefresh(session.expiresAt);
          }
        } catch (error) {
          performanceMonitor.logError(error, 'tokenRefresh');
        }
      }, Math.max(refreshTime, 0));
    }
  }, [clearTimers, performanceMonitor, setAuthState]);

  const startSessionMonitoring = useCallback((expiresAt) => {
    clearTimers();
    
    sessionCheckRef.current = setInterval(() => {
      if (expiresAt && Date.now() > expiresAt) {
        logout('session_expired');
      }
    }, 60 * 1000);

    const trackActivity = () => {
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
      activityTimerRef.current = setTimeout(() => logout('inactivity'), 30 * 60 * 1000);
    };

    ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
      window.addEventListener(event, trackActivity, { passive: true });
    });

    trackActivity();
  }, [clearTimers]);

  const initializeAuth = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      setAuthState({ loading: true, error: null });
      const session = authService.getCurrentSession();
      
      if (!session) {
        setAuthState({ loading: false });
        return;
      }

      if (Date.now() > session.expiresAt) {
        await logout('session_expired');
        return;
      }

      const userResponse = await authService.getCurrentUser();
      if (!userResponse.success) throw new Error('Failed to get user data');

      const permissions = new Set(userResponse.data.permissions || []);
      setAuthState({
        user: userResponse.data,
        session,
        sessionExpiresAt: session.expiresAt,
        permissions,
        loading: false
      });

      logSecurityEvent('session_initialized', {
        userId: userResponse.data.id,
        role: userResponse.data.role,
        sessionId: session.id,
        sessionExpiresAt: new Date(session.expiresAt).toISOString()
      });

      scheduleTokenRefresh(session.expiresAt);
      startSessionMonitoring(session.expiresAt);

    } catch (error) {
      performanceMonitor.logError(error, 'initializeAuth');
      logSecurityEvent('initialization_failed', { error: error.message });
      setAuthState({ error: 'Failed to initialize authentication', loading: false });
    }
  }, [setAuthState, scheduleTokenRefresh, performanceMonitor, logSecurityEvent]);

  const login = useCallback(async (email, password, rememberMe = false) => {
    try {
      setAuthState({ loading: true, error: null, success: null });
      
      const endMeasurement = performanceMonitor.startMeasurement('login');
      const response = await authService.login(email, password, rememberMe);
      endMeasurement();

      if (!response.success) throw new Error(response.message || 'Login failed');

      const session = authService.getCurrentSession();
      const permissions = new Set(response.data.user.permissions || []);

      setAuthState({
        user: response.data.user,
        session,
        sessionExpiresAt: session.expiresAt,
        permissions,
        loading: false,
        success: 'Login successful'
      });

      logSecurityEvent('login_success', { email, rememberMe });
      scheduleTokenRefresh(session.expiresAt);
      startSessionMonitoring(session.expiresAt);

      return response;

    } catch (error) {
      performanceMonitor.logError(error, 'login');
      logSecurityEvent('login_failed', { email, error: error.message });
      setAuthState({ error: error.message || 'Login failed', loading: false });
      throw error;
    }
  }, [setAuthState, scheduleTokenRefresh, performanceMonitor, logSecurityEvent]);

  const register = useCallback(async (userData) => {
    try {
      setAuthState({ loading: true, error: null, success: null });
      
      const endMeasurement = performanceMonitor.startMeasurement('register');
      const response = await authService.register(userData);
      endMeasurement();

      if (!response.success) throw new Error(response.message || 'Registration failed');

      logSecurityEvent('registration_attempt', { email: userData.email, role: userData.role });

      if (response.requiresVerification) {
        setAuthState({ loading: false, success: response.message });
        logSecurityEvent('registration_pending_verification', { email: userData.email });
        return response;
      }

      const session = authService.getCurrentSession();
      const permissions = new Set(response.data.user.permissions || []);

      setAuthState({
        user: response.data.user,
        session,
        sessionExpiresAt: session.expiresAt,
        permissions,
        loading: false,
        success: response.message
      });

      logSecurityEvent('registration_success', { email: userData.email, role: userData.role });
      scheduleTokenRefresh(session.expiresAt);
      startSessionMonitoring(session.expiresAt);

      return response;

    } catch (error) {
      performanceMonitor.logError(error, 'register');
      logSecurityEvent('registration_failed', { email: userData.email, error: error.message });
      setAuthState({ error: error.message || 'Registration failed', loading: false });
      throw error;
    }
  }, [setAuthState, scheduleTokenRefresh, performanceMonitor, logSecurityEvent]);

  const logout = useCallback(async (reason = 'user_action') => {
    const currentUser = stateRef.current.user;
    const currentSession = stateRef.current.session;
    
    try {
      logSecurityEvent('logout', { reason, userId: currentUser?.id });
      await authService.logout();
    } catch (error) {
      logSecurityEvent('logout_error', { error: error.message, reason });
    } finally {
      clearTimers();
      setAuthState({
        user: null,
        session: null,
        sessionExpiresAt: null,
        permissions: new Set(),
        error: null,
        success: null,
        loading: false
      });
    }
  }, [clearTimers, setAuthState, logSecurityEvent]);

  const checkUsername = useCallback(async (username) => {
    try {
      const response = await authService.checkUsername(username);
      logSecurityEvent('username_check', { username, available: response.available });
      return response;
    } catch (error) {
      logSecurityEvent('username_check_error', { username, error: error.message });
      return { success: false, available: false, error: error.message };
    }
  }, [logSecurityEvent]);

  const checkEmail = useCallback(async (email) => {
    try {
      const response = await authService.checkEmail(email);
      logSecurityEvent('email_check', { email, available: response.available });
      return response;
    } catch (error) {
      logSecurityEvent('email_check_error', { email, error: error.message });
      return { success: false, available: false, error: error.message };
    }
  }, [logSecurityEvent]);

  const hasPermission = useCallback((permission) => {
    return state.permissions.has(permission) || state.user?.role === 'admin';
  }, [state.permissions, state.user]);

  const hasRole = useCallback((role) => state.user?.role === role, [state.user]);
  const hasAnyRole = useCallback((roles) => roles.includes(state.user?.role), [state.user]);
  const clearError = useCallback(() => setAuthState({ error: null }), [setAuthState]);
  const clearSuccess = useCallback(() => setAuthState({ success: null }), [setAuthState]);

  useEffect(() => {
    isMountedRef.current = true;
    initializeAuth();

    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
  }, [initializeAuth, clearTimers]);

  // CRITICAL: Include logSecurityEvent in context value
  const contextValue = useMemo(() => ({
    // State
    user: state.user,
    session: state.session,
    loading: state.loading,
    error: state.error,
    success: state.success,
    sessionExpiresAt: state.sessionExpiresAt,
    
    // Auth methods
    login,
    register,
    logout,
    
    // Validation
    checkUsername,
    checkEmail,
    
    // Permissions
    hasPermission,
    hasRole,
    hasAnyRole,
    isAuthenticated: !!state.user && !!state.session,
    
    // SECURITY: This must be included
    logSecurityEvent,
    
    // Utilities
    clearError,
    clearSuccess
  }), [
    state,
    login,
    register,
    logout,
    checkUsername,
    checkEmail,
    hasPermission,
    hasRole,
    hasAnyRole,
    logSecurityEvent, // INCLUDED in dependencies
    clearError,
    clearSuccess
  ]);

  return (
    <AuthErrorBoundary>
      <AuthContext.Provider value={contextValue}>
        {children}
      </AuthContext.Provider>
    </AuthErrorBoundary>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export default AuthContext;