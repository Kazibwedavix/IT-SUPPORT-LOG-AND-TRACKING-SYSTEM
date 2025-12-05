// frontend/src/services/api.js
import axios from 'axios';

// Create axios instance with production-grade configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5002/api',
  timeout: 30000, // 30 seconds timeout for production
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Version': process.env.REACT_APP_VERSION || '1.0.0',
  },
  withCredentials: true, // Enable cookies for CSRF protection if needed
});

// Request counter for tracking
let requestCounter = 0;

// Request interceptor with enhanced security features
api.interceptors.request.use(
  (config) => {
    const requestId = ++requestCounter;
    const traceId = generateTraceId();
    
    // Add auth token from multiple storage locations
    const token = localStorage.getItem('token') || 
                  sessionStorage.getItem('token') ||
                  getCookie('auth_token');
    
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add security headers
    config.headers['X-Request-ID'] = generateRequestId();
    config.headers['X-Trace-ID'] = traceId;
    config.headers['X-Client-Request-ID'] = `client_${requestId}_${Date.now()}`;
    
    // Add CSRF token if available
    const csrfToken = getCookie('csrf_token') || localStorage.getItem('csrf_token');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    
    // Log request for monitoring (only in development or with explicit debug flag)
    if (process.env.NODE_ENV === 'development' || localStorage.getItem('debug_requests')) {
      console.log(`[API Request ${requestId}]`, {
        method: config.method?.toUpperCase(),
        url: config.url,
        traceId,
        timestamp: new Date().toISOString(),
      });
    }
    
    return config;
  },
  (error) => {
    // Log request configuration errors
    console.error('[API Request Config Error]', error);
    return Promise.reject(createErrorObject(error, 'REQUEST_CONFIG_ERROR'));
  }
);


// Response interceptor with comprehensive error handling
api.interceptors.response.use(
  (response) => {
    // Log successful responses in debug mode
    if (process.env.NODE_ENV === 'development' || localStorage.getItem('debug_responses')) {
      console.log(`[API Response ${response.config.headers['X-Client-Request-ID']}]`, {
        status: response.status,
        url: response.config.url,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Extract and store new tokens if present in response
    if (response.headers['x-new-token']) {
      const newToken = response.headers['x-new-token'];
      localStorage.setItem('token', newToken);
    }
    
    return response;
  },
  (error) => {
    const requestId = error.config?.headers?.['X-Client-Request-ID'] || 'unknown';
    const traceId = error.config?.headers?.['X-Trace-ID'] || 'unknown';
    
    // Enhanced error logging
    logError(error, requestId, traceId);
    
    // Handle network errors
    if (!error.response) {
      const networkError = createErrorObject(
        error,
        'NETWORK_ERROR',
        'Unable to connect to server. Please check your internet connection.'
      );
      return Promise.reject(networkError);
    }
    
    const { status, data, headers } = error.response;
    
    // Handle specific HTTP status codes
    switch (status) {
      case 400:
        return Promise.reject(handleBadRequestError(error, data));
      
      case 401:
        return handleUnauthorizedError(error);
      
      case 403:
        return Promise.reject(createErrorObject(
          error,
          'FORBIDDEN',
          'You do not have permission to access this resource.'
        ));
      
      case 404:
        return Promise.reject(createErrorObject(
          error,
          'NOT_FOUND',
          'The requested resource was not found.'
        ));
      
      case 408:
        return Promise.reject(createErrorObject(
          error,
          'TIMEOUT_ERROR',
          'Request timeout. Please try again.'
        ));
      
      case 429:
        return handleRateLimitError(error, headers);
      
      case 500:
      case 502:
      case 503:
      case 504:
        return Promise.reject(handleServerError(error, status));
      
      default:
        return Promise.reject(createErrorObject(
          error,
          'UNKNOWN_ERROR',
          'An unexpected error occurred. Please try again later.'
        ));
    }
  }
);

// Helper functions for enhanced error handling

const generateRequestId = () => {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

const generateTraceId = () => {
  return 'trace_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

const getCookie = (name) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

const createErrorObject = (originalError, code, userMessage = null) => {
  return {
    code,
    message: userMessage || originalError.message,
    originalError,
    timestamp: new Date().toISOString(),
    userFriendly: !!userMessage,
  };
};

const logError = (error, requestId, traceId) => {
  const errorLog = {
    requestId,
    traceId,
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
    },
  };
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[API Error]', errorLog);
  }
  
  // Send to error tracking service in production
  if (process.env.NODE_ENV === 'production') {
    // Integration with error monitoring services (Sentry, LogRocket, etc.)
    // window.Sentry?.captureException(error);
    // window.LogRocket?.captureException(error);
    
    // Optionally send to your backend for centralized logging
    // if (!error.config?.url?.includes('/error-log')) {
    //   api.post('/error-log', errorLog).catch(() => {});
    // }
  }
};

const handleBadRequestError = (error, data) => {
  // Extract validation errors from server response
  const validationErrors = data?.errors || data?.validation || {};
  const errorMessage = data?.message || 'Invalid request data';
  
  return {
    ...createErrorObject(error, 'VALIDATION_ERROR', errorMessage),
    validationErrors,
    fieldErrors: data?.fieldErrors || {},
  };
};

const handleUnauthorizedError = async (error) => {
  const originalRequest = error.config;
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  
  // Check if this is already a retry attempt
  if (originalRequest._retry || !token) {
    // Clear auth data and redirect
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Only redirect if not already on login page
    if (!window.location.pathname.includes('/login')) {
      // Store the attempted URL for post-login redirect
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
      window.location.href = '/login?session=expired';
    }
    
    return Promise.reject(createErrorObject(
      error,
      'AUTH_REQUIRED',
      'Your session has expired. Please log in again.'
    ));
  }
  
  // Try to refresh the token
  try {
    originalRequest._retry = true;
    
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await api.post('/auth/refresh', { refreshToken });
    const { token: newToken, refreshToken: newRefreshToken } = response.data;
    
    // Store new tokens
    localStorage.setItem('token', newToken);
    localStorage.setItem('refreshToken', newRefreshToken);
    
    // Update the original request with new token
    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    
    // Retry the original request
    return api(originalRequest);
  } catch (refreshError) {
    // Refresh failed, logout user
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login?session=invalid';
    }
    
    return Promise.reject(createErrorObject(
      refreshError,
      'REFRESH_FAILED',
      'Unable to refresh session. Please log in again.'
    ));
  }
};

const handleRateLimitError = (error, headers) => {
  const retryAfter = headers['retry-after'] || headers['x-ratelimit-reset'];
  const remaining = headers['x-ratelimit-remaining'];
  const limit = headers['x-ratelimit-limit'];
  
  const rateLimitInfo = {
    retryAfter: retryAfter ? parseInt(retryAfter) : null,
    remaining: remaining ? parseInt(remaining) : null,
    limit: limit ? parseInt(limit) : null,
    resetTime: retryAfter ? new Date(Date.now() + retryAfter * 1000) : null,
  };
  
  return Promise.reject({
    ...createErrorObject(
      error,
      'RATE_LIMITED',
      'Too many requests. Please slow down.'
    ),
    rateLimitInfo,
  });
};

const handleServerError = (error, status) => {
  const statusMessages = {
    500: 'Internal server error. Our team has been notified.',
    502: 'Bad gateway. Please try again in a few moments.',
    503: 'Service temporarily unavailable. We are performing maintenance.',
    504: 'Gateway timeout. The server is taking too long to respond.',
  };
  
  return createErrorObject(
    error,
    `SERVER_ERROR_${status}`,
    statusMessages[status] || 'Server error. Please try again later.'
  );
};

// Utility methods for API service
export const apiService = {
  // Health check
  async healthCheck() {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      throw createErrorObject(error, 'HEALTH_CHECK_FAILED', 'Service health check failed');
    }
  },
  
  // Get API status
  async getStatus() {
    try {
      const response = await api.get('/status');
      return response.data;
    } catch (error) {
      throw createErrorObject(error, 'STATUS_CHECK_FAILED', 'Unable to get service status');
    }
  },
  
  // Clear all authentication data
  clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    
    // Clear auth header for future requests
    delete api.defaults.headers.common.Authorization;
  },
  
  // Set auth token manually
  setAuthToken(token) {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }
  },
  
  // Test API connection
  async testConnection() {
    try {
      const startTime = Date.now();
      const response = await api.get('/health', { timeout: 10000 });
      const latency = Date.now() - startTime;
      
      return {
        connected: true,
        latency,
        status: response.status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        connected: false,
        error: error.code || 'CONNECTION_FAILED',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  },
};

// Add global error handler for unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.isAxiosError) {
      console.error('[Unhandled API Error]', event.reason);
      // Optionally send to error tracking service
    }
  });
}

export default api;