// frontend/src/services/authService.js
/**
 * Enterprise Authentication Service
 * 
 * Production-grade authentication service with comprehensive
 * security features, monitoring, and enterprise patterns.
 * 
 * Features:
 * - JWT token management with refresh tokens
 * - Secure HTTP-only cookie handling
 * - Comprehensive error handling
 * - Security event tracking
 * - Rate limiting awareness
 * - Audit logging
 * - Session management
 * - Token refresh automation
 * - Offline detection
 * - Network retry logic
 * - Cache management
 * - Password reset functionality
 * - Email verification
 * 
 * @version 5.0.0
 * @author Bugema University IT Support System
 */

import api from './api';

// Constants
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second
const OFFLINE_CHECK_INTERVAL = 30000; // 30 seconds

// Security event tracking
class SecurityMonitor {
  constructor() {
    this.events = [];
    this.maxEvents = 100;
  }

  log(eventType, data = {}) {
    const event = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: eventType,
      ...data,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Development logging
    if (process.env.NODE_ENV === 'development') {
      console.group('🔐 Security Event');
      console.log('Type:', eventType);
      console.log('Data:', data);
      console.log('Timestamp:', event.timestamp);
      console.groupEnd();
    }

    // Store event
    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    // Persist to localStorage for debugging
    this.persistEvents();

    // Send to security monitoring in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(event);
    }
  }

  persistEvents() {
    try {
      localStorage.setItem('auth_security_events', JSON.stringify(this.events));
    } catch (e) {
      // Silently fail if localStorage is not available
    }
  }

  sendToMonitoring(event) {
    // Implement with your security monitoring service
    // Example: Sentry, LogRocket, custom API
    console.log('[Security Monitor]', event);
  }

  getEvents(limit = 50) {
    return this.events.slice(0, limit);
  }

  clearEvents() {
    this.events = [];
    localStorage.removeItem('auth_security_events');
  }
}

// Initialize security monitor
const securityMonitor = new SecurityMonitor();

// Token management
class TokenManager {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    this.isRefreshing = false;
    this.refreshQueue = [];
  }

  async getAccessToken() {
    // Check if token is expired or about to expire
    if (this.accessToken && this.tokenExpiry) {
      const timeToExpiry = this.tokenExpiry - Date.now();
      
      if (timeToExpiry < TOKEN_REFRESH_THRESHOLD) {
        await this.refreshAccessToken();
      }
    }
    
    return this.accessToken;
  }

  async refreshAccessToken() {
    if (this.isRefreshing) {
      // Wait for the ongoing refresh to complete
      return new Promise((resolve, reject) => {
        this.refreshQueue.push({ resolve, reject });
      });
    }

    this.isRefreshing = true;

    try {
      const response = await api.post('/auth/refresh', {}, {
        withCredentials: true // Important for HTTP-only cookies
      });

      const { accessToken } = response.data;
      
      if (accessToken) {
        this.setTokens(accessToken, this.refreshToken);
        
        // Resolve all queued requests
        this.refreshQueue.forEach(({ resolve }) => resolve(accessToken));
      }
      
      return accessToken;
    } catch (error) {
      // Reject all queued requests
      this.refreshQueue.forEach(({ reject }) => reject(error));
      throw error;
    } finally {
      this.isRefreshing = false;
      this.refreshQueue = [];
    }
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    
    // Calculate token expiry (assuming 15 minutes from now)
    this.tokenExpiry = Date.now() + 15 * 60 * 1000;
    
    // Store in memory only (cookies are HTTP-only)
    sessionStorage.setItem('token_refresh_time', Date.now().toString());
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    sessionStorage.removeItem('token_refresh_time');
  }
}

// Initialize token manager
const tokenManager = new TokenManager();

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    // Skip token for auth endpoints except logout
    if (config.url.includes('/auth/') && !config.url.includes('/auth/logout')) {
      return config;
    }

    // Add access token if available
    const accessToken = await tokenManager.getAccessToken();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Add request ID for tracking
    config.headers['X-Request-ID'] = crypto.randomUUID();
    
    // Add timestamp for monitoring
    config.metadata = { 
      startTime: Date.now(),
      url: config.url,
      method: config.method 
    };

    return config;
  },
  (error) => {
    securityMonitor.log('request_interceptor_error', {
      error: error.message,
      url: error.config?.url
    });
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    const { config, data } = response;
    const duration = Date.now() - (config.metadata?.startTime || Date.now());

    // Log successful requests
    if (config.url.includes('/auth/')) {
      securityMonitor.log('auth_request_success', {
        endpoint: config.url,
        method: config.method,
        duration: `${duration}ms`,
        status: response.status
      });
    }

    // Handle token in response for login/register
    if (config.url.includes('/auth/login') || config.url.includes('/auth/register')) {
      if (data.data?.accessToken) {
        tokenManager.setTokens(data.data.accessToken, data.data.refreshToken);
      }
    }

    return response;
  },
  async (error) => {
    const { config, response } = error;
    const originalRequest = config;

    // Log failed requests
    if (config?.url?.includes('/auth/')) {
      securityMonitor.log('auth_request_failed', {
        endpoint: config.url,
        method: config.method,
        status: response?.status,
        error: error.message,
        retryCount: originalRequest._retryCount || 0
      });
    }

    // Handle 401 - Unauthorized (token expired)
    if (response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Attempt to refresh token
        await tokenManager.refreshAccessToken();
        
        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        tokenManager.clearTokens();
        window.location.href = '/login?session=expired';
        return Promise.reject(refreshError);
      }
    }

    // Handle 429 - Rate limited
    if (response?.status === 429) {
      const retryAfter = response.headers['retry-after'] || 60;
      securityMonitor.log('rate_limited', {
        endpoint: config.url,
        retryAfter,
        timestamp: new Date().toISOString()
      });

      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(api(originalRequest));
        }, retryAfter * 1000);
      });
    }

    // Handle network errors with retry logic
    if (!response && originalRequest._retryCount < MAX_RETRY_ATTEMPTS) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(api(originalRequest));
        }, RETRY_DELAY * Math.pow(2, originalRequest._retryCount - 1));
      });
    }

    return Promise.reject(error);
  }
);

// Offline detection
class NetworkMonitor {
  constructor() {
    this.isOnline = navigator.onLine;
    this.listeners = [];
    
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Periodic connectivity check
    setInterval(() => this.checkConnectivity(), OFFLINE_CHECK_INTERVAL);
  }

  handleOnline() {
    this.isOnline = true;
    securityMonitor.log('network_online');
    this.notifyListeners(true);
  }

  handleOffline() {
    this.isOnline = false;
    securityMonitor.log('network_offline');
    this.notifyListeners(false);
  }

  checkConnectivity() {
    // Implement custom connectivity check if needed
    const wasOnline = this.isOnline;
    this.isOnline = navigator.onLine;
    
    if (wasOnline !== this.isOnline) {
      securityMonitor.log(this.isOnline ? 'network_restored' : 'network_lost');
      this.notifyListeners(this.isOnline);
    }
  }

  addListener(listener) {
    this.listeners.push(listener);
  }

  notifyListeners(isOnline) {
    this.listeners.forEach(listener => listener(isOnline));
  }

  isConnected() {
    return this.isOnline;
  }
}

// Initialize network monitor
const networkMonitor = new NetworkMonitor();

// Main auth service
const authService = {
  /**
   * Register new user with comprehensive validation
   * 
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Registration response
   */
  register: async (userData) => {
    try {
      securityMonitor.log('registration_attempt', {
        email: userData.email,
        role: userData.role,
        hasStudentId: !!userData.studentId
      });

      console.log('🔍 Received registration data:', userData);

      // Validate required fields
      const requiredFields = ['username', 'email', 'password', 'role'];
      const missingFields = requiredFields.filter(field => !userData[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Prepare registration data
      const registrationData = {
        username: userData.username.trim(),
        email: userData.email.toLowerCase().trim(),
        password: userData.password,
        role: userData.role,
        firstName: userData.firstName?.trim(),
        lastName: userData.lastName?.trim(),
        phone: userData.phone,
        metadata: {
          registrationSource: 'web',
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          isPersonalEmail: userData.isPersonalEmail || false
        }
      };

      // Add role-specific fields with proper department mapping
      if (userData.role === 'student') {
        // For students - use academicInfo with lowercase department
        if (userData.department) {
          registrationData.academicInfo = {
            studentId: userData.studentId?.trim().toUpperCase(),
            department: userData.department.trim(), // lowercase for academicInfo.department
            campus: userData.campus || 'BU',
            yearOfEntry: userData.yearOfEntry || new Date().getFullYear(),
            semester: userData.semester || 1,
            academicStatus: 'active'
          };
        } else {
          throw new Error('Department is required for student accounts');
        }
      } else {
        // For staff, technician, admin - use professionalInfo with UPPERCASE department
        if (userData.department) {
          // Convert department to UPPERCASE for professional roles
          const professionalDepartment = userData.department.toUpperCase();
          
          registrationData.professionalInfo = {
            department: professionalDepartment, // UPPERCASE for professionalInfo.department
            employmentType: 'FULL_TIME'
          };

          // Add employee ID if provided
          if (userData.employeeId) {
            registrationData.professionalInfo.employeeId = userData.employeeId.trim().toUpperCase();
          }
        } else {
          throw new Error('Department is required for staff/technician/admin accounts');
        }
      }

      // Add student-specific fields at root level if they exist
      if (userData.studentId && userData.role === 'student') {
        registrationData.studentId = userData.studentId.trim().toUpperCase();
      }

      console.log('🔍 Final registration payload:', JSON.stringify(registrationData, null, 2));

      const response = await api.post('/auth/register', registrationData);
      
      console.log('🔍 Registration response:', response.data);
      
      if (!response.data.success) {
        console.error('❌ Backend returned success: false', response.data);
        throw new Error(response.data.message || 'Registration failed');
      }

      const { data } = response.data;

      securityMonitor.log('registration_success', {
        userId: data.user?.id,
        email: data.user?.email,
        role: data.user?.role,
        requiresEmailVerification: data.requiresEmailVerification
      });

      return {
        success: true,
        message: response.data.message,
        data: {
          user: data.user,
          accessToken: data.accessToken,
          requiresEmailVerification: data.requiresEmailVerification
        }
      };

    } catch (error) {
      console.error('🔥 REGISTRATION API ERROR DETAILS:');
      console.error('🔥 Error:', error.message);
      console.error('🔥 Error response:', error.response?.data);
      console.error('🔥 Error status:', error.response?.status);
      
      securityMonitor.log('registration_failed', {
        email: userData?.email,
        role: userData?.role,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      let errorMessage = 'Registration failed. Please try again.';
      
      if (error.response?.data) {
        const { message, code, errors } = error.response.data;
        console.error('🔥 Backend error details:', { message, code, errors });
        
        if (code === 'EMAIL_EXISTS') {
          errorMessage = 'An account with this email already exists.';
        } else if (code === 'USERNAME_EXISTS') {
          errorMessage = 'This username is already taken.';
        } else if (code === 'STUDENT_ID_EXISTS') {
          errorMessage = 'This student ID is already registered.';
        } else if (code === 'EMPLOYEE_ID_EXISTS') {
          errorMessage = 'This employee ID is already registered.';
        } else if (code === 'VALIDATION_ERROR') {
          // Handle Mongoose validation errors
          if (errors?.length) {
            errorMessage = errors.map(e => e.message || e.msg).join('. ');
          } else if (message) {
            errorMessage = message;
          }
        } else if (message) {
          errorMessage = message;
        }
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      } else if (error.request) {
        console.error('🔥 No response received:', error.request);
        errorMessage = 'No response from server. Please try again.';
      }

      throw new Error(errorMessage);
    }
  },

  /**
   * User login with credentials
   * 
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {boolean} rememberMe - Remember login
   * @returns {Promise<Object>} Authentication response
   */
  login: async (email, password, rememberMe = false) => {
    try {
      securityMonitor.log('login_attempt', { email, rememberMe });

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const response = await api.post('/auth/login', {
        email: email.toLowerCase().trim(),
        password: password.trim(),
        rememberMe
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Login failed');
      }

      const { data } = response.data;

      securityMonitor.log('login_success', {
        userId: data.user?.id,
        email: data.user?.email,
        role: data.user?.role,
        requiresEmailVerification: data.requiresEmailVerification
      });

      return {
        success: true,
        message: response.data.message,
        data: {
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          requiresEmailVerification: data.requiresEmailVerification
        }
      };

    } catch (error) {
      securityMonitor.log('login_failed', {
        email,
        error: error.message,
        status: error.response?.status,
        code: error.response?.data?.code
      });

      let errorMessage = 'Login failed. Please check your credentials.';
      
      if (error.response?.data) {
        const { message, code, attemptsLeft, locked } = error.response.data;
        
        if (code === 'ACCOUNT_LOCKED') {
          errorMessage = `Account is locked. Try again in ${error.response.data.lockDuration} minutes.`;
        } else if (code === 'ACCOUNT_INACTIVE') {
          errorMessage = 'Account is deactivated. Please contact support.';
        } else if (code === 'INVALID_CREDENTIALS') {
          if (attemptsLeft > 0) {
            errorMessage = `Invalid credentials. ${attemptsLeft} attempts remaining.`;
          } else if (locked) {
            errorMessage = 'Account locked due to too many failed attempts.';
          }
        } else if (message) {
          errorMessage = message;
        }
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      }

      throw new Error(errorMessage);
    }
  },

  /**
   * Logout user and clear tokens
   * 
   * @returns {Promise<Object>} Logout response
   */
  logout: async () => {
    try {
      securityMonitor.log('logout_attempt');

      await api.post('/auth/logout', {}, { withCredentials: true });

      // Clear local tokens
      tokenManager.clearTokens();
      
      // Clear any stored user data
      sessionStorage.clear();
      localStorage.removeItem('user_data');

      securityMonitor.log('logout_success');

      return {
        success: true,
        message: 'Logged out successfully'
      };

    } catch (error) {
      securityMonitor.log('logout_failed', { error: error.message });
      
      // Still clear tokens even if API call fails
      tokenManager.clearTokens();
      sessionStorage.clear();
      localStorage.removeItem('user_data');

      return {
        success: true,
        message: 'Logged out locally'
      };
    }
  },

  /**
   * Get current authenticated user
   * 
   * @returns {Promise<Object>} Current user data
   */
  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me', { withCredentials: true });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to get user data');
      }

      return {
        success: true,
        data: response.data.data.user
      };

    } catch (error) {
      securityMonitor.log('get_current_user_failed', { error: error.message });

      if (error.response?.status === 401) {
        tokenManager.clearTokens();
        throw new Error('Session expired. Please login again.');
      }

      throw new Error('Failed to get user data');
    }
  },

  /**
   * Update user profile
   * 
   * @param {Object} updates - Profile updates
   * @returns {Promise<Object>} Updated user data
   */
  updateProfile: async (updates) => {
    try {
      securityMonitor.log('profile_update_attempt', { 
        fields: Object.keys(updates) 
      });

      const response = await api.put('/auth/me', updates, { 
        withCredentials: true 
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Update failed');
      }

      securityMonitor.log('profile_update_success', { 
        fields: Object.keys(updates) 
      });

      return {
        success: true,
        message: response.data.message,
        data: response.data.data.user
      };

    } catch (error) {
      securityMonitor.log('profile_update_failed', { 
        error: error.message,
        fields: Object.keys(updates)
      });

      let errorMessage = 'Failed to update profile.';
      
      if (error.response?.data?.errors?.length) {
        errorMessage = error.response.data.errors.map(e => e.message).join('. ');
      }

      throw new Error(errorMessage);
    }
  },

  /**
   * Change password for authenticated user
   * 
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Success response
   */
  changePassword: async (currentPassword, newPassword) => {
    try {
      securityMonitor.log('password_change_attempt');

      // Validate password strength
      if (newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      const response = await api.post('/auth/change-password', {
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim()
      }, { withCredentials: true });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Password change failed');
      }

      securityMonitor.log('password_change_success');

      return {
        success: true,
        message: response.data.message
      };

    } catch (error) {
      securityMonitor.log('password_change_failed', { error: error.message });
      throw new Error(error.response?.data?.message || 'Failed to change password');
    }
  },

  /**
   * Request password reset email
   * 
   * @param {string} email - User email
   * @returns {Promise<Object>} Success response
   */
  forgotPassword: async (email) => {
    try {
      securityMonitor.log('password_reset_request', { email });

      if (!email || !email.trim()) {
        throw new Error('Email address is required');
      }

      const response = await api.post('/auth/forgot-password', {
        email: email.toLowerCase().trim()
      });

      securityMonitor.log('password_reset_request_sent', { email });

      // Always return success message for security (don't reveal if email exists)
      return {
        success: true,
        message: response.data?.message || 'If an account exists with this email, you will receive reset instructions.'
      };

    } catch (error) {
      securityMonitor.log('password_reset_request_failed', { 
        email,
        error: error.message,
        status: error.response?.status
      });

      // Always return success for security (don't reveal if email exists)
      return {
        success: true,
        message: 'If an account exists with this email, you will receive reset instructions.'
      };
    }
  },

  /**
   * Verify reset password token
   * 
   * @param {string} token - Reset token from email
   * @returns {Promise<Object>} Validation result
   */
  verifyResetToken: async (token) => {
    try {
      securityMonitor.log('reset_token_verification_attempt', {
        token: token.substring(0, 10) + '...'
      });

      if (!token || !token.trim()) {
        throw new Error('Reset token is required');
      }

      const response = await api.get(`/auth/verify-reset-token/${token.trim()}`);

      securityMonitor.log('reset_token_verification_success');

      return {
        valid: true,
        success: response.data?.success || true,
        message: response.data?.message || 'Token is valid'
      };

    } catch (error) {
      securityMonitor.log('reset_token_verification_failed', {
        error: error.message,
        status: error.response?.status
      });

      return {
        valid: false,
        success: false,
        message: error.response?.data?.message || 'Invalid or expired reset token'
      };
    }
  },

  /**
   * Reset password with token
   * 
   * @param {string} token - Reset token from email
   * @param {Object} passwordData - Password data {password, confirmPassword}
   * @returns {Promise<Object>} Success response
   */
  resetPassword: async (token, passwordData) => {
    try {
      securityMonitor.log('password_reset_attempt', { 
        token: token.substring(0, 10) + '...'
      });

      if (!token || !token.trim()) {
        throw new Error('Reset token is required');
      }

      if (!passwordData.password || !passwordData.confirmPassword) {
        throw new Error('Password and confirmation are required');
      }

      if (passwordData.password !== passwordData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (passwordData.password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      const response = await api.post(`/auth/reset-password/${token.trim()}`, {
        password: passwordData.password.trim(),
        confirmPassword: passwordData.confirmPassword.trim()
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Password reset failed');
      }

      securityMonitor.log('password_reset_success');

      return {
        success: true,
        message: response.data.message || 'Password reset successful'
      };

    } catch (error) {
      securityMonitor.log('password_reset_failed', { 
        error: error.message,
        status: error.response?.status
      });

      let errorMessage = 'Failed to reset password. Please try again.';

      if (error.response?.data) {
        const { message, code } = error.response.data;
        
        if (code === 'TOKEN_EXPIRED') {
          errorMessage = 'Reset link has expired. Please request a new one.';
        } else if (code === 'TOKEN_INVALID') {
          errorMessage = 'Invalid reset link. Please request a new one.';
        } else if (code === 'TOKEN_USED') {
          errorMessage = 'Reset link has already been used. Please request a new one.';
        } else if (message) {
          errorMessage = message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
  },

  /**
   * Verify email with token
   *
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Success response
   */
  verifyEmail: async (token) => {
    try {
      securityMonitor.log('email_verification_attempt', {
        token: token.substring(0, 10) + '...'
      });

      if (!token || !token.trim()) {
        throw new Error('Verification token is required');
      }

      const response = await api.get(`/auth/verify-email/${token.trim()}`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Verification failed');
      }

      securityMonitor.log('email_verification_success');

      return {
        success: true,
        message: response.data.message || 'Email verified successfully'
      };

    } catch (error) {
      securityMonitor.log('email_verification_failed', {
        error: error.message,
        status: error.response?.status
      });

      let errorMessage = 'Failed to verify email. Please try again.';

      if (error.response?.data) {
        const { message, code } = error.response.data;
        
        if (code === 'TOKEN_EXPIRED') {
          errorMessage = 'Verification link has expired. Please request a new one.';
        } else if (code === 'TOKEN_INVALID') {
          errorMessage = 'Invalid verification link.';
        } else if (code === 'ALREADY_VERIFIED') {
          errorMessage = 'Email is already verified.';
        } else if (message) {
          errorMessage = message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
  },

  /**
   * Resend verification email
   * 
   * @param {string} email - User email (optional if authenticated)
   * @returns {Promise<Object>} Success response
   */
  resendVerification: async (email = null) => {
    try {
      securityMonitor.log('verification_resend_attempt', { email });

      const requestData = email ? { email: email.toLowerCase().trim() } : {};

      const response = await api.post('/auth/resend-verification', requestData, { 
        withCredentials: true 
      });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to resend verification');
      }

      securityMonitor.log('verification_resend_success', { email });

      return {
        success: true,
        message: response.data.message || 'Verification email sent successfully'
      };

    } catch (error) {
      securityMonitor.log('verification_resend_failed', { 
        email,
        error: error.message 
      });

      let errorMessage = 'Failed to resend verification email.';

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    }
  },

  /**
   * Check if email is available
   * 
   * @param {string} email - Email to check
   * @returns {Promise<Object>} Availability result
   */
  checkEmail: async (email) => {
    try {
      const response = await api.post('/auth/check-email', {
        email: email.toLowerCase().trim()
      });

      return {
        success: true,
        data: response.data.data
      };

    } catch (error) {
      securityMonitor.log('check_email_failed', { email, error: error.message });
      throw new Error('Failed to check email availability');
    }
  },

  /**
   * Check if username is available
   * 
   * @param {string} username - Username to check
   * @returns {Promise<Object>} Availability result
   */
  checkUsername: async (username) => {
    try {
      const response = await api.post('/auth/check-username', {
        username: username.trim()
      });

      return {
        success: true,
        data: response.data.data
      };

    } catch (error) {
      securityMonitor.log('check_username_failed', { username, error: error.message });
      throw new Error('Failed to check username availability');
    }
  },

  /**
   * Get authentication statistics (admin only)
   * 
   * @returns {Promise<Object>} Authentication statistics
   */
  getAuthStats: async () => {
    try {
      const response = await api.get('/auth/stats', { withCredentials: true });

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to get stats');
      }

      return {
        success: true,
        data: response.data.data
      };

    } catch (error) {
      securityMonitor.log('get_auth_stats_failed', { error: error.message });
      throw new Error('Failed to get authentication statistics');
    }
  },

  /**
   * Get security events (for debugging/admin)
   * 
   * @param {number} limit - Maximum number of events
   * @returns {Array} Security events
   */
  getSecurityEvents: (limit = 50) => {
    return securityMonitor.getEvents(limit);
  },

  /**
   * Clear security events
   */
  clearSecurityEvents: () => {
    securityMonitor.clearEvents();
  },

  /**
   * Check if user is authenticated
   * 
   * @returns {Promise<boolean>} Authentication status
   */
  isAuthenticated: async () => {
    try {
      await authService.getCurrentUser();
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Check network connectivity
   * 
   * @returns {boolean} Network status
   */
  isOnline: () => {
    return networkMonitor.isConnected();
  },

  /**
   * Add network status listener
   * 
   * @param {Function} listener - Listener function
   */
  onNetworkChange: (listener) => {
    networkMonitor.addListener(listener);
  },

  /**
   * Validate password strength
   * 
   * @param {string} password - Password to validate
   * @returns {Object} Validation result with strength score
   */
  validatePasswordStrength: (password) => {
    const result = {
      isValid: false,
      score: 0,
      level: 'weak',
      feedback: [],
      requirements: {
        minLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecial: false
      }
    };

    if (!password) {
      result.feedback.push('Password is required');
      return result;
    }

    // Check requirements
    result.requirements.minLength = password.length >= 8;
    result.requirements.hasUppercase = /[A-Z]/.test(password);
    result.requirements.hasLowercase = /[a-z]/.test(password);
    result.requirements.hasNumber = /\d/.test(password);
    result.requirements.hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    // Calculate score
    if (result.requirements.minLength) result.score += 20;
    if (result.requirements.hasUppercase) result.score += 20;
    if (result.requirements.hasLowercase) result.score += 20;
    if (result.requirements.hasNumber) result.score += 20;
    if (result.requirements.hasSpecial) result.score += 20;

    // Determine level
    if (result.score <= 40) {
      result.level = 'weak';
      result.feedback.push('Password is too weak');
    } else if (result.score <= 60) {
      result.level = 'fair';
      result.feedback.push('Password could be stronger');
    } else if (result.score <= 80) {
      result.level = 'good';
    } else {
      result.level = 'strong';
    }

    // Add specific feedback
    if (!result.requirements.minLength) {
      result.feedback.push('Must be at least 8 characters');
    }
    if (!result.requirements.hasUppercase) {
      result.feedback.push('Add an uppercase letter');
    }
    if (!result.requirements.hasLowercase) {
      result.feedback.push('Add a lowercase letter');
    }
    if (!result.requirements.hasNumber) {
      result.feedback.push('Add a number');
    }
    if (!result.requirements.hasSpecial) {
      result.feedback.push('Add a special character');
    }

    result.isValid = result.score >= 60; // Require at least "good" password

    return result;
  },

  /**
   * Validate email format
   * 
   * @param {string} email - Email to validate
   * @returns {Object} Validation result
   */
  validateEmail: (email) => {
    const result = {
      isValid: false,
      feedback: []
    };

    if (!email || !email.trim()) {
      result.feedback.push('Email is required');
      return result;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidFormat = emailRegex.test(email.trim());

    if (!isValidFormat) {
      result.feedback.push('Invalid email format');
      return result;
    }

    // Check for common typos
    const commonDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    
    if (domain && !commonDomains.includes(domain) && domain.includes('gmai')) {
      result.feedback.push('Did you mean gmail.com?');
    }

    result.isValid = isValidFormat;
    return result;
  },

  /**
   * Get token manager (for debugging)
   * 
   * @returns {TokenManager} Token manager instance
   */
  getTokenManager: () => {
    return tokenManager;
  }
};

export default authService;