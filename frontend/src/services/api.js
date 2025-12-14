// src/services/api.js
// Production-ready API service with comprehensive error handling

import axios from 'axios';

// Custom error classes
export class APIError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

export class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NetworkError';
    this.code = 'NETWORK_ERROR';
  }
}

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.status = 401;
  }
}

// Request queue for handling concurrent requests
const requestQueue = new Map();

// Main API Service class
class APIService {
  constructor() {
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';
    
    this.axios = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000, // 30 seconds
      timeoutErrorMessage: 'Request timeout. Please try again.',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      withCredentials: true, // Include cookies if needed
    });

    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      retryStatusCodes: [408, 429, 500, 502, 503, 504]
    };

    this.setupInterceptors();
    this.initializeAuth();
  }

  initializeAuth() {
    const token = this.getAuthToken();
    if (token) {
      this.setAuthToken(token);
    }
  }

  setupInterceptors() {
    // Request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        // Generate request ID for tracking
        const requestId = `${config.method}-${config.url}-${Date.now()}`;
        config.requestId = requestId;
        
        // Cancel duplicate pending requests
        if (requestQueue.has(requestId)) {
          requestQueue.get(requestId).cancel('Duplicate request cancelled');
        }
        
        // Create cancel token for this request
        const source = axios.CancelToken.source();
        config.cancelToken = source.token;
        requestQueue.set(requestId, source);

        // Add timestamp for performance monitoring
        config.metadata = { 
          startTime: Date.now(),
          requestId 
        };

        // Add auth token if available
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add cache-busting for GET requests in development
        if (process.env.NODE_ENV === 'development' && config.method === 'get') {
          config.params = {
            ...config.params,
            _t: Date.now()
          };
        }

        // Log request in development
        if (process.env.NODE_ENV === 'development') {
          console.groupCollapsed(`📤 API Request: ${config.method?.toUpperCase()} ${config.url}`);
          console.log('Headers:', config.headers);
          console.log('Data:', config.data || 'No data');
          console.log('Params:', config.params || 'No params');
          console.groupEnd();
        }

        return config;
      },
      (error) => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(new NetworkError('Request configuration failed'));
      }
    );

    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        const { config } = response;
        const { requestId, metadata } = config;
        
        // Clean up request queue
        if (requestId && requestQueue.has(requestId)) {
          requestQueue.delete(requestId);
        }

        // Calculate request duration
        const duration = metadata ? Date.now() - metadata.startTime : 0;

        // Log response in development
        if (process.env.NODE_ENV === 'development') {
          console.groupCollapsed(`📥 API Response: ${config.method?.toUpperCase()} ${config.url} - ${duration}ms`);
          console.log('Status:', response.status);
          console.log('Data:', response.data);
          console.log('Headers:', response.headers);
          console.groupEnd();
        }

        // Return standardized response format
        return {
          success: true,
          data: response.data,
          status: response.status,
          headers: response.headers,
          duration,
          requestId
        };
      },
      async (error) => {
        const { config } = error;
        
        // Clean up request queue
        if (config?.requestId && requestQueue.has(config.requestId)) {
          requestQueue.delete(config.requestId);
        }

        // Handle request cancellation
        if (axios.isCancel(error)) {
          console.log('⚠️ Request cancelled:', error.message);
          return Promise.reject(new NetworkError('Request was cancelled'));
        }

        // Calculate request duration
        const duration = config?.metadata ? Date.now() - config.metadata.startTime : 0;

        // Log error
        console.error('❌ API Error:', {
          url: config?.url,
          method: config?.method,
          status: error.response?.status,
          message: error.message,
          duration
        });

        // Handle network errors
        if (!error.response) {
          if (error.code === 'ECONNABORTED') {
            return Promise.reject(new NetworkError('Request timeout. Please check your connection and try again.'));
          }
          return Promise.reject(new NetworkError('Network error. Please check your internet connection.'));
        }

        const { status, data } = error.response;

        // Handle automatic retry for certain status codes
        const currentRetryCount = config?.retryCount || 0;
        if (this.retryConfig.retryStatusCodes.includes(status) && 
            currentRetryCount < this.retryConfig.maxRetries) {
          
          // Create new config with updated retry count
          const newConfig = {
            ...config,
            retryCount: currentRetryCount + 1
          };
          
          // Wait before retrying
          await new Promise(resolve => 
            setTimeout(resolve, this.retryConfig.retryDelay * newConfig.retryCount)
          );
          
          console.log(`🔄 Retrying request (${newConfig.retryCount}/${this.retryConfig.maxRetries}): ${config.url}`);
          return this.axios(newConfig);
        }

        // Standard error handling
        let errorMessage = 'An unexpected error occurred';
        let errorData = data;

        switch (status) {
          case 400:
            errorMessage = data?.message || 'Bad request';
            break;
            
          case 401:
            errorMessage = data?.message || 'Authentication required';
            this.handleUnauthorized();
            return Promise.reject(new AuthError(errorMessage));
            
          case 403:
            errorMessage = data?.message || 'Access forbidden';
            break;
            
          case 404:
            errorMessage = data?.message || 'Resource not found';
            break;
            
          case 409:
            errorMessage = data?.message || 'Conflict occurred';
            break;
            
          case 422:
            errorMessage = data?.message || 'Validation failed';
            // Format validation errors for easier consumption
            if (data?.errors) {
              errorData = {
                ...data,
                validationErrors: data.errors
              };
            }
            break;
            
          case 429:
            errorMessage = data?.message || 'Too many requests. Please try again later.';
            const retryAfter = error.response.headers['retry-after'];
            if (retryAfter) {
              errorData = { ...data, retryAfter: parseInt(retryAfter, 10) };
            }
            break;
            
          case 500:
            errorMessage = 'Internal server error. Please try again later.';
            break;
            
          case 502:
          case 503:
          case 504:
            errorMessage = 'Service temporarily unavailable. Please try again later.';
            break;
        }

        return Promise.reject(new APIError(errorMessage, status, errorData));
      }
    );
  }

  /**
   * Handle unauthorized access
   */
  handleUnauthorized() {
    // Clear all auth data
    this.clearAuthToken();
    
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    // Only redirect if not already on auth pages
    const currentPath = window.location.pathname;
    const authPages = ['/login', '/register', '/forgot-password', '/reset-password'];
    
    if (!authPages.some(page => currentPath.includes(page))) {
      // Store current location for redirect back after login
      sessionStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
      
      // Use setTimeout to avoid React state updates during render
      setTimeout(() => {
        window.location.href = `/login?session=expired&redirect=${encodeURIComponent(window.location.pathname)}`;
      }, 100);
    }
  }

  /**
   * Generic request method with retry logic
   */
  async request(config) {
    try {
      return await this.axios(config);
    } catch (error) {
      // Re-throw errors for upstream handling
      throw error;
    }
  }

  /**
   * GET request
   */
  async get(url, config = {}) {
    return this.request({
      method: 'get',
      url,
      ...config
    });
  }

  /**
   * POST request
   */
  async post(url, data = {}, config = {}) {
    return this.request({
      method: 'post',
      url,
      data,
      ...config
    });
  }

  /**
   * PUT request
   */
  async put(url, data = {}, config = {}) {
    return this.request({
      method: 'put',
      url,
      data,
      ...config
    });
  }

  /**
   * PATCH request
   */
  async patch(url, data = {}, config = {}) {
    return this.request({
      method: 'patch',
      url,
      data,
      ...config
    });
  }

  /**
   * DELETE request
   */
  async delete(url, config = {}) {
    return this.request({
      method: 'delete',
      url,
      ...config
    });
  }

  /**
   * Upload file with progress tracking
   */
  async upload(url, file, onProgress = null, config = {}) {
    const formData = new FormData();
    formData.append('file', file);

    return this.request({
      method: 'post',
      url,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onProgress,
      ...config
    });
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(message = 'All requests cancelled') {
    requestQueue.forEach((source, requestId) => {
      source.cancel(message);
      requestQueue.delete(requestId);
    });
    console.log(`🛑 Cancelled ${requestQueue.size} pending requests`);
  }

  /**
   * Cancel specific request by ID
   */
  cancelRequest(requestId, message = 'Request cancelled') {
    if (requestQueue.has(requestId)) {
      requestQueue.get(requestId).cancel(message);
      requestQueue.delete(requestId);
      console.log(`🛑 Cancelled request: ${requestId}`);
    }
  }

  /**
   * Set authentication token
   */
  setAuthToken(token) {
    if (token) {
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
      // Also store in session storage for redundancy
      sessionStorage.setItem('token', token);
    } else {
      this.clearAuthToken();
    }
  }

  /**
   * Clear authentication token
   */
  clearAuthToken() {
    delete this.axios.defaults.headers.common['Authorization'];
    localStorage.removeItem('token');
    localStorage.removeItem('session');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('session');
  }

  /**
   * Get authentication token
   */
  getAuthToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getAuthToken();
  }

  /**
   * Set base URL
   */
  setBaseURL(baseURL) {
    this.axios.defaults.baseURL = baseURL;
    console.log(`🌍 API base URL set to: ${baseURL}`);
  }

  /**
   * Get base URL
   */
  getBaseURL() {
    return this.axios.defaults.baseURL;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await this.get('/health', { timeout: 5000 });
      return {
        healthy: true,
        timestamp: new Date().toISOString(),
        response: response.data
      };
    } catch (error) {
      return {
        healthy: false,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      const startTime = Date.now();
      await this.get('/', { timeout: 10000 });
      const duration = Date.now() - startTime;
      
      return {
        connected: true,
        duration,
        baseURL: this.getBaseURL()
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        baseURL: this.getBaseURL()
      };
    }
  }
}

// Create singleton instance
const apiService = new APIService();

// Export for use in components - Remove duplicate exports
export { apiService };

// Default export
export default apiService;