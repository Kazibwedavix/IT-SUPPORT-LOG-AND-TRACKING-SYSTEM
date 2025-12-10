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

// Main API Service class
class APIService {
  constructor() {
    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';
    
    this.axios = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
    this.initializeAuth();
  }

  initializeAuth() {
    const token = localStorage.getItem('token');
    if (token) {
      this.setAuthToken(token);
    }
  }

  setupInterceptors() {
    // Request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        config.metadata = { startTime: Date.now() };

        if (process.env.NODE_ENV === 'development') {
          console.log(`📤 API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data || '');
        }

        return config;
      },
      (error) => {
        console.error('❌ Request error:', error);
        return Promise.reject(new NetworkError('Request failed'));
      }
    );

    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        if (process.env.NODE_ENV === 'development' && response.config.metadata) {
          const duration = Date.now() - response.config.metadata.startTime;
          console.log(`📥 API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${duration}ms`);
        }

        return {
          success: true,
          data: response.data,
          status: response.status,
          headers: response.headers,
        };
      },
      (error) => {
        console.error('❌ API Error:', error);

        if (!error.response) {
          return Promise.reject(new NetworkError('Network connection failed. Please check your internet connection.'));
        }

        const { status, data } = error.response;

        switch (status) {
          case 401:
            localStorage.removeItem('token');
            localStorage.removeItem('session');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('session');
            
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login?session=expired';
            }
            
            return Promise.reject(new AuthError(data?.message || 'Session expired. Please login again.'));

          case 403:
            return Promise.reject(new APIError(data?.message || 'Access forbidden', status, data));

          case 404:
            return Promise.reject(new APIError(data?.message || 'Resource not found', status, data));

          case 422:
            return Promise.reject(new APIError(data?.message || 'Validation failed', status, data));

          case 429:
            return Promise.reject(new APIError(data?.message || 'Too many requests. Please try again later.', status, data));

          case 500:
            return Promise.reject(new APIError('Server error. Please try again later.', status, data));

          default:
            return Promise.reject(new APIError(data?.message || 'An unexpected error occurred', status, data));
        }
      }
    );
  }

  // Generic request methods
  async get(url, config = {}) {
    return this.axios.get(url, config);
  }

  async post(url, data = {}, config = {}) {
    return this.axios.post(url, data, config);
  }

  async put(url, data = {}, config = {}) {
    return this.axios.put(url, data, config);
  }

  async patch(url, data = {}, config = {}) {
    return this.axios.patch(url, data, config);
  }

  async delete(url, config = {}) {
    return this.axios.delete(url, config);
  }

  // Utility methods
  setAuthToken(token) {
    if (token) {
      this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
    } else {
      delete this.axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
  }

  clearAuthToken() {
    delete this.axios.defaults.headers.common['Authorization'];
    localStorage.removeItem('token');
    localStorage.removeItem('session');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('session');
  }

  getAuthToken() {
    return localStorage.getItem('token');
  }

  isAuthenticated() {
    return !!this.getAuthToken();
  }

  setBaseURL(baseURL) {
    this.axios.defaults.baseURL = baseURL;
  }
}

// Create singleton instance
const apiService = new APIService();

export { apiService };
export default apiService;