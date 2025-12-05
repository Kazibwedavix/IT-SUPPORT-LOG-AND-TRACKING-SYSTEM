import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import authService from '../services/authService';
import api from '../services/api';

/**
 * AuthContext - Optimized to avoid repeated /auth/me calls
 */

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/* -------------------------
  Helpers: Validation + Sanitization
   (unchanged from your original)
   ------------------------- */

const validateUserData = (userData) => {
  if (!userData || typeof userData !== 'object') {
    return false;
  }
  const requiredFields = ['_id', 'email', 'role'];
  for (const field of requiredFields) {
    if (!userData[field]) {
      console.warn(`Invalid user data: Missing ${field}`);
      return false;
    }
  }
  const validRoles = ['admin', 'technician', 'staff', 'student'];
  if (!validRoles.includes(userData.role)) {
    console.warn(`Invalid user data: Invalid role "${userData.role}"`);
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(userData.email)) {
    console.warn(`Invalid user data: Invalid email "${userData.email}"`);
    return false;
  }
  return true;
};

const sanitizeUserData = (userData) => {
  if (!userData) return null;
  const sanitized = { ...userData };
  delete sanitized.password;
  delete sanitized.tempPassword;
  delete sanitized.resetToken;
  delete sanitized.verificationToken;
  delete sanitized.__v;
  if (sanitized.role) sanitized.role = sanitized.role.toLowerCase();
  return sanitized;
};

const sendToSecurityLog = (eventData) => {
  try {
    const existingEvents = JSON.parse(localStorage.getItem('security_events') || '[]');
    existingEvents.push(eventData);
    if (existingEvents.length > 50) existingEvents.shift();
    localStorage.setItem('security_events', JSON.stringify(existingEvents));
  } catch (e) {
    // ignore
  }
};

/* -------------------------
  Caching / Deduplication Globals
  - Keeps things at module scope so multiple mounts share cache
  ------------------------- */

let authCheckPromise = null;      // in-flight GET /auth/me promise
let lastAuthCheck = null;         // { data, timestamp }
const AUTH_CACHE_TIME = 5000;     // 5 seconds cache

let authInitPromise = null;       // protects initializeAuth from running multiple times

/* Cached GET current user:
   - returns cached data if recent
   - dedupes in-flight requests
   - console.trace() on new network calls to help debugging
*/
const getCurrentUserCached = async () => {
  const now = Date.now();

  // Return cached result if still fresh
  if (lastAuthCheck && (now - lastAuthCheck.timestamp) < AUTH_CACHE_TIME) {
    return lastAuthCheck.data;
  }

  // If an in-flight promise exists, reuse it
  if (authCheckPromise) {
    return authCheckPromise;
  }

  // Make new request and store the promise
  authCheckPromise = (async () => {
    // Helpful trace to find callers (only when we truly call the network)
    try {
      console.trace('🔍 getCurrentUserCached network call stack:');
    } catch (e) {}

    try {
      const response = await authService.getCurrentUser();
      // Normalize expected shape: your authService likely returns { success: true, data: user }
      const user = response?.data ?? response;
      lastAuthCheck = { data: user, timestamp: Date.now() };
      return user;
    } finally {
      // Clear in-flight promise after resolution (success or failure)
      authCheckPromise = null;
    }
  })();

  return authCheckPromise;
};

/* -------------------------
  AuthProvider (component)
  ------------------------- */

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authSuccess, setAuthSuccess] = useState(null);

  const refreshTimeoutRef = useRef(null);
  const sessionCheckIntervalRef = useRef(null);
  const isRefreshingRef = useRef(false);
  const refreshQueueRef = useRef([]);

  /* Security logger */
  const logSecurityEvent = useCallback((eventType, data = {}) => {
    const securityEvent = {
      timestamp: new Date().toISOString(),
      event: eventType,
      userId: user?._id,
      userRole: user?.role,
      ...data,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      ip: 'client-ip'
    };
    if (process.env.NODE_ENV === 'development') {
      console.log('🔒 Security Event:', securityEvent);
    }
    sendToSecurityLog(securityEvent);
  }, [user]);

  const clearError = useCallback(() => setAuthError(null), []);
  const clearSuccess = useCallback(() => setAuthSuccess(null), []);
  const setError = useCallback((message) => {
    setAuthError(message);
    setTimeout(() => setAuthError(null), 10000);
  }, []);
  const setSuccess = useCallback((message) => {
    setAuthSuccess(message);
    setTimeout(() => setAuthSuccess(null), 5000);
  }, []);

  /* Refresh token queueing (unchanged logic, but retained) */
  const refreshToken = useCallback(async () => {
    if (isRefreshingRef.current) {
      return new Promise((resolve, reject) => {
        refreshQueueRef.current.push({ resolve, reject });
      });
    }

    try {
      isRefreshingRef.current = true;
      const response = await authService.refreshToken();
      if (!response.success || !response.data?.accessToken || !response.data?.user) {
        throw new Error('Invalid refresh response');
      }

      if (!validateUserData(response.data.user)) {
        throw new Error('Invalid user data in refresh response');
      }

      const sanitizedUser = sanitizeUserData(response.data.user);
      const accessToken = response.data.accessToken;

      setUser(sanitizedUser);
      setSessionValid(true);

      const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
      storage.setItem('token', accessToken);
      storage.setItem('user', JSON.stringify(sanitizedUser));

      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
      setSessionExpiresAt(expiryTime);
      localStorage.setItem('sessionExpiry', expiryTime.toString());

      // scheduleTokenRefresh will be called below after expiry set / or can be invoked here
      scheduleTokenRefresh();

      while (refreshQueueRef.current.length > 0) {
        const queued = refreshQueueRef.current.shift();
        queued.resolve();
      }

      return response;
    } catch (error) {
      console.error('Token refresh failed:', error);
      while (refreshQueueRef.current.length > 0) {
        const queued = refreshQueueRef.current.shift();
        queued.reject(error);
      }
      throw error;
    } finally {
      isRefreshingRef.current = false;
    }
  }, []); // no deps

  const scheduleTokenRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    const refreshTime = sessionExpiresAt
      ? sessionExpiresAt - (5 * 60 * 1000) - Date.now()
      : 55 * 60 * 1000; // default 55 minutes
    if (refreshTime > 0) {
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          await refreshToken();
        } catch (err) {
          console.error('Scheduled token refresh failed:', err);
        }
      }, refreshTime);
    }
  }, [sessionExpiresAt, refreshToken]);

  const startSessionMonitoring = useCallback(() => {
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
    }
    sessionCheckIntervalRef.current = setInterval(() => {
      if (sessionExpiresAt && Date.now() > sessionExpiresAt) {
        console.warn('Session expired during monitoring');
        logout('Session expired');
      }
    }, 60 * 1000);
  }, [sessionExpiresAt]);

  const logout = useCallback((reason = 'user_initiated') => {
    setUser(null);
    setSessionValid(false);
    setSessionExpiresAt(null);
    setAuthError(null);
    setAuthSuccess(null);

    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
      sessionCheckIntervalRef.current = null;
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sessionExpiry');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');

    delete api.defaults.headers.common['Authorization'];

    authService.logout().catch(err => console.error('Backend logout failed:', err));
    logSecurityEvent('logout', { reason });

    refreshQueueRef.current = [];
    console.log('👋 User logged out:', reason);
  }, [logSecurityEvent]);

  /* -------------------------
     Login / Register logic (mostly same)
     ------------------------- */

  const login = useCallback(async (email, password, rememberMe = false) => {
    try {
      setAuthError(null);
      setAuthSuccess(null);
      setLoading(true);

      const response = await authService.login(email, password, rememberMe);
      if (!response.success) throw new Error(response.message || 'Login failed');
      if (!response.data?.user || !response.data?.accessToken) throw new Error('Invalid login response format');
      if (!validateUserData(response.data.user)) throw new Error('Invalid user data received from server');

      const sanitizedUser = sanitizeUserData(response.data.user);
      const accessToken = response.data.accessToken;

      setUser(sanitizedUser);
      setSessionValid(true);

      const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
      setSessionExpiresAt(expiryTime);

      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('token', accessToken);
      storage.setItem('user', JSON.stringify(sanitizedUser));
      if (rememberMe) {
        localStorage.setItem('sessionExpiry', expiryTime.toString());
        localStorage.setItem('rememberMe', 'true');
      }

      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      scheduleTokenRefresh();
      startSessionMonitoring();
      logSecurityEvent('login_success', { email, role: sanitizedUser.role });

      return response;
    } catch (error) {
      console.error('❌ Login error:', error);
      logSecurityEvent('login_failed', { email, error: error.message });
      const errorMessage = error.response?.data?.message || error.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [scheduleTokenRefresh, startSessionMonitoring, setError, logSecurityEvent]);

  const register = useCallback(async (userData) => {
    try {
      setAuthError(null);
      setAuthSuccess(null);
      setLoading(true);

      const response = await authService.register(userData);
      if (!response.success) throw new Error(response.message || 'Registration failed');

      const requiresVerification = response.data?.requiresEmailVerification || false;
      if (requiresVerification) {
        setSuccess('Registration successful! Please check your email to verify your account.');
        logSecurityEvent('registration_pending_verification', { email: userData.email, role: userData.role });
        return { ...response, requiresVerification: true, message: 'Registration successful! Please check your email to verify your account.' };
      }

      if (!response.data?.user || !response.data?.accessToken) throw new Error('Invalid registration response format');
      if (!validateUserData(response.data.user)) throw new Error('Invalid user data received from server');

      const sanitizedUser = sanitizeUserData(response.data.user);
      const accessToken = response.data.accessToken;

      setUser(sanitizedUser);
      setSessionValid(true);
      const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
      setSessionExpiresAt(expiryTime);

      localStorage.setItem('token', accessToken);
      localStorage.setItem('user', JSON.stringify(sanitizedUser));
      localStorage.setItem('sessionExpiry', expiryTime.toString());

      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      scheduleTokenRefresh();
      startSessionMonitoring();
      logSecurityEvent('registration_success', { email: sanitizedUser.email, role: sanitizedUser.role });

      return { ...response, requiresVerification: false, message: 'Registration successful! You are now logged in.' };
    } catch (error) {
      console.error('❌ Registration error:', error);
      logSecurityEvent('registration_failed', { email: userData.email, error: error.message, role: userData.role });
      let errorMessage = 'Registration failed. Please try again.';
      if (error.message && error.message !== errorMessage) errorMessage = error.message;
      else if (error.response?.data?.message) errorMessage = error.response.data.message;
      else if (error.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        if (Array.isArray(validationErrors)) errorMessage = validationErrors.map(err => err.message || err.msg).join('. ');
        else if (typeof validationErrors === 'object') errorMessage = Object.values(validationErrors).join('. ');
      }
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [scheduleTokenRefresh, startSessionMonitoring, setError, setSuccess, logSecurityEvent]);

  /* -------------------------
     initializeAuth - guarded with authInitPromise so we don't run it multiple times
     ------------------------- */

  const initializeAuth = useCallback(async () => {
    // If an initialization is already running or done, return that promise
    if (authInitPromise) return authInitPromise;

    authInitPromise = (async () => {
      try {
        setLoading(true);
        setAuthError(null);
        setAuthSuccess(null);

        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
        const sessionExpiry = localStorage.getItem('sessionExpiry');

        if (!token || !savedUser) {
          setLoading(false);
          return;
        }

        let parsedUser;
        try {
          parsedUser = JSON.parse(savedUser);
        } catch (err) {
          console.error('Error parsing saved user:', err);
          logout('Invalid session data');
          return;
        }

        if (!validateUserData(parsedUser)) {
          console.warn('Invalid user data in storage, logging out');
          logout('Invalid user data');
          return;
        }

        if (sessionExpiry) {
          const expiryTime = parseInt(sessionExpiry, 10);
          if (Date.now() > expiryTime) {
            console.warn('Session expired, logging out');
            logout('Session expired');
            return;
          }
          setSessionExpiresAt(expiryTime);
        }

        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // Use cached/deduped current user call
        try {
          const userData = await getCurrentUserCached();
          if (!validateUserData(userData)) throw new Error('Invalid user data received from server');

          const sanitizedUser = sanitizeUserData(userData);
          setUser(sanitizedUser);
          setSessionValid(true);

          const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
          storage.setItem('user', JSON.stringify(sanitizedUser));

          scheduleTokenRefresh();
          startSessionMonitoring();

          console.log('✅ Auth initialized successfully:', sanitizedUser.email);
        } catch (error) {
          console.error('Token verification failed:', error);
          try {
            await refreshToken();
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            logout('Session verification failed');
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setError('Authentication initialization failed');
      } finally {
        setLoading(false);
      }
    })();

    return authInitPromise;
  }, [logout, refreshToken, scheduleTokenRefresh, startSessionMonitoring, setError]);

  /* -------------------------
     Other helpers using getCurrentUserCached where appropriate
     ------------------------- */

  const hasRole = useCallback((roles) => {
    if (!user || !user.role) return false;
    const rolesToCheck = Array.isArray(roles) ? roles : [roles];
    return rolesToCheck.includes(user.role);
  }, [user]);

  const hasPermission = useCallback((permissions) => {
    if (!user || !user.permissions) return false;
    const permissionsToCheck = Array.isArray(permissions) ? permissions : [permissions];
    return permissionsToCheck.every(permission => user.permissions?.includes(permission));
  }, [user]);

  const checkSession = useCallback(async () => {
    // Use cached call so quick repeated checks don't hit server
    try {
      const userData = await getCurrentUserCached();
      return !!userData;
    } catch (err) {
      return false;
    }
  }, []);

  const updateProfile = useCallback(async (updates) => {
    try {
      const response = await authService.updateProfile(updates);
      if (response.success && response.data?.user) {
        const sanitizedUser = sanitizeUserData(response.data.user);
        setUser(sanitizedUser);
        const storage = localStorage.getItem('token') ? localStorage : sessionStorage;
        storage.setItem('user', JSON.stringify(sanitizedUser));
      }
      return response;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      const response = await authService.changePassword(currentPassword, newPassword);
      if (response.success) logSecurityEvent('password_changed');
      return response;
    } catch (error) {
      console.error('Password change error:', error);
      throw error;
    }
  }, [logSecurityEvent]);

  const forgotPassword = useCallback(async (email) => {
    try {
      return await authService.forgotPassword(email);
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }, []);

  const resetPassword = useCallback(async (token, userId, newPassword) => {
    try {
      return await authService.resetPassword(token, userId, newPassword);
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  }, []);

  const verifyEmail = useCallback(async (token, userId) => {
    try {
      return await authService.verifyEmail(token, userId);
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }, []);

  const checkEmail = useCallback(async (email) => {
    try {
      return await authService.checkEmail(email);
    } catch (error) {
      console.error('Check email error:', error);
      throw error;
    }
  }, []);

  const checkUsername = useCallback(async (username) => {
    try {
      return await authService.checkUsername(username);
    } catch (error) {
      console.error('Check username error:', error);
      throw error;
    }
  }, []);

  /* -------------------------
     Effects
     - initialization (runs once per app start due to authInitPromise)
     - axios interceptor for refresh (unchanged)
     ------------------------- */

  useEffect(() => {
    initializeAuth();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
    };
  }, [initializeAuth]);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            await refreshToken();
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            if (token) originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          } catch (refreshError) {
            logout('token_refresh_failed');
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(interceptor);
  }, [refreshToken, logout]);

  /* -------------------------
     Context value & render
     ------------------------- */

  const value = {
    user,
    loading,
    sessionValid,
    sessionExpiresAt,
    authError,
    authSuccess,
    login,
    register,
    logout,
    refreshToken,
    checkSession,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    checkEmail,
    checkUsername,
    hasRole,
    hasPermission,
    logSecurityEvent,
    isAuthenticated: !!user && sessionValid,
    clearError,
    clearSuccess,
    setError,
    setSuccess
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export default AuthContext;
