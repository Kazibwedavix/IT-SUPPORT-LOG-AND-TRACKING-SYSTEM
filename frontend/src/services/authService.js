// src/services/authService.js
// Production-ready authentication service - COMPLETE INTEGRATION

import { apiService } from './api';
import { APIError, AuthError, NetworkError } from './api';

class AuthService {
  constructor() {
    this.baseUrl = '/api/auth';
    this.tokenRefreshTimeout = null;
    this.initializeAuth();
  }

  /**
   * Initialize authentication state
   */
  initializeAuth() {
    const token = localStorage.getItem('token');
    const session = this.getCurrentSession();
    
    if (token && session) {
      // Set auth header
      apiService.setAuthToken(token);
      
      // Schedule token refresh
      if (session.expiresAt && !this.isTokenExpired()) {
        this._scheduleTokenRefresh(session.expiresAt);
      }
    }
  }

  /**
   * Login user with real API
   */
  async login(email, password, rememberMe = false) {
    try {
      console.log('🔐 [AuthService] Login attempt:', { email: email?.substring(0, 5) + '...' });
      
      const response = await apiService.post(`${this.baseUrl}/login`, {
        email: email.trim().toLowerCase(),
        password,
        rememberMe
      });

      const { success, data, message } = response.data;
      
      if (!success) {
        console.error('❌ [AuthService] Login failed:', message);
        throw new APIError(message || 'Login failed', 401);
      }

      // Store authentication data
      this._storeAuthData(data);
      
      // Schedule token refresh if expiresAt is provided
      if (data.expiresAt) {
        this._scheduleTokenRefresh(data.expiresAt);
      }

      console.log('✅ [AuthService] Login successful');
      return { success: true, data, message };
      
    } catch (error) {
      console.error('❌ [AuthService] Login error:', error);
      
      // Clear any existing auth data on login failure
      this._clearAuthData();
      
      if (error instanceof APIError || error instanceof AuthError) {
        throw error;
      }
      
      throw new APIError(error.message || 'Login failed', 500);
    }
  }

  /**
   * Register new user with real API
   */
  async register(userData) {
    try {
      console.log('📝 [AuthService] Registration attempt:', { 
        email: userData.email, 
        username: userData.username 
      });
      
      // Prepare registration data
      const registrationData = {
        username: userData.username.trim(),
        email: userData.email.trim().toLowerCase(),
        password: userData.password,
        firstName: userData.firstName?.trim() || userData.username,
        lastName: userData.lastName?.trim() || 'User',
        role: userData.role || 'student',
        department: userData.department || 'computer_science',
        phoneNumber: userData.phoneNumber?.trim(),
        studentId: userData.studentId?.trim(),
        staffId: userData.staffId?.trim()
      };

      const response = await apiService.post(`${this.baseUrl}/register`, registrationData);

      const { success, data, message, requiresVerification } = response.data;
      
      if (!success) {
        console.error('❌ [AuthService] Registration failed:', message);
        throw new APIError(message || 'Registration failed', 400);
      }

      // If registration includes auto-login, store auth data
      if (data.token && data.user) {
        this._storeAuthData(data);
        
        if (data.expiresAt) {
          this._scheduleTokenRefresh(data.expiresAt);
        }
      }

      console.log('✅ [AuthService] Registration successful');
      return { 
        success: true, 
        data, 
        message, 
        requiresVerification 
      };
      
    } catch (error) {
      console.error('❌ [AuthService] Registration error:', error);
      
      if (error instanceof APIError || error instanceof AuthError) {
        throw error;
      }
      
      throw new APIError(error.message || 'Registration failed', 500);
    }
  }

  /**
   * Logout user with real API
   */
  async logout() {
    try {
      console.log('🚪 [AuthService] Logout request');
      
      // Call logout API if authenticated
      if (apiService.isAuthenticated()) {
        await apiService.post(`${this.baseUrl}/logout`);
      }
      
    } catch (error) {
      console.warn('⚠️ [AuthService] Logout API error:', error);
      // Continue with local cleanup even if API fails
    } finally {
      // Always clear local storage
      this._clearAuthData();
      console.log('✅ [AuthService] Logout completed');
    }
  }

  /**
   * Get current authenticated user from API
   */
  async getCurrentUser() {
    try {
      const token = this.getToken();
      
      if (!token) {
        return { success: false, message: 'No authentication token found' };
      }

      // Verify token is still valid
      if (this.isTokenExpired()) {
        console.warn('⚠️ [AuthService] Token expired, attempting refresh...');
        const refreshed = await this.refreshAccessToken();
        
        if (!refreshed.success) {
          this._clearAuthData();
          return { success: false, message: 'Session expired. Please login again.' };
        }
      }

      // Get fresh user data from API
      const response = await apiService.get(`${this.baseUrl}/me`);
      
      return { 
        success: true, 
        data: response.data.data 
      };
      
    } catch (error) {
      console.error('❌ [AuthService] Get current user error:', error);
      
      // Check if error is due to authentication
      if (error instanceof AuthError) {
        this._clearAuthData();
        return { 
          success: false, 
          message: 'Session expired. Please login again.' 
        };
      }
      
      // Return error response
      return { 
        success: false, 
        message: error.message || 'Failed to fetch user data' 
      };
    }
  }

  /**
   * Get current session from storage
   */
  getCurrentSession() {
    try {
      const sessionStr = localStorage.getItem('session');
      if (!sessionStr) return null;

      const session = JSON.parse(sessionStr);
      
      // Check if session is still valid
      if (session.expiresAt && Date.now() > session.expiresAt) {
        console.warn('⚠️ [AuthService] Session expired');
        this._clearAuthData();
        return null;
      }

      return session;
      
    } catch (error) {
      console.error('❌ [AuthService] Get session error:', error);
      return null;
    }
  }

  /**
   * Check username availability via API
   */
  async checkUsername(username) {
    try {
      const response = await apiService.get(`${this.baseUrl}/check-username/${encodeURIComponent(username.trim())}`);
      return response.data;
      
    } catch (error) {
      console.error('❌ [AuthService] Check username error:', error);
      return {
        success: false,
        available: false,
        message: error.message || 'Failed to check username availability'
      };
    }
  }

  /**
   * Check email availability via API
   */
  async checkEmail(email) {
    try {
      const response = await apiService.get(`${this.baseUrl}/check-email/${encodeURIComponent(email.trim().toLowerCase())}`);
      return response.data;
      
    } catch (error) {
      console.error('❌ [AuthService] Check email error:', error);
      return {
        success: false,
        available: false,
        message: error.message || 'Failed to check email availability'
      };
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    try {
      const session = this.getCurrentSession();
      
      if (!session?.refreshToken) {
        throw new AuthError('No refresh token available');
      }

      console.log('🔄 [AuthService] Refreshing access token...');
      
      const response = await apiService.post(`${this.baseUrl}/refresh`, {
        refreshToken: session.refreshToken
      });

      const { success, data } = response.data;
      
      if (!success) {
        throw new AuthError('Token refresh failed');
      }

      // Update stored session
      this._storeAuthData(data);
      
      // Schedule next refresh
      if (data.expiresAt) {
        this._scheduleTokenRefresh(data.expiresAt);
      }

      console.log('✅ [AuthService] Token refreshed successfully');
      return { success: true, token: data.token };
      
    } catch (error) {
      console.error('❌ [AuthService] Token refresh error:', error);
      this._clearAuthData();
      return { 
        success: false, 
        message: 'Session expired. Please login again.' 
      };
    }
  }

  /**
   * Update user profile via API
   */
  async updateProfile(updates) {
    try {
      const response = await apiService.put('/api/users/profile', updates);
      return response.data;
      
    } catch (error) {
      console.error('❌ [AuthService] Update profile error:', error);
      
      if (error instanceof AuthError) {
        throw error;
      }
      
      throw new APIError(error.message || 'Failed to update profile', 400);
    }
  }

  /**
   * Change password via API
   */
  async changePassword(currentPassword, newPassword) {
    try {
      console.log('🔐 [AuthService] Change password request');
      
      const response = await apiService.post(`${this.baseUrl}/change-password`, {
        currentPassword,
        newPassword
      });

      const { success, message } = response.data;
      
      if (!success) {
        throw new APIError(message || 'Failed to change password', 400);
      }

      console.log('✅ [AuthService] Password changed successfully');
      return { 
        success: true, 
        message: message || 'Password changed successfully' 
      };
      
    } catch (error) {
      console.error('❌ [AuthService] Change password error:', error);
      
      if (error instanceof APIError || error instanceof AuthError) {
        throw error;
      }
      
      throw new APIError(error.message || 'Failed to change password', 400);
    }
  }

  /**
   * Forgot Password - Request password reset email
   */
  async forgotPassword(email) {
    try {
      console.log('🔑 [AuthService] Forgot password request:', { email: email?.substring(0, 5) + '...' });
      
      const response = await apiService.post(`${this.baseUrl}/forgot-password`, { 
        email: email.trim().toLowerCase() 
      });

      const { success, message, emailSent } = response.data;
      
      if (!success) {
        throw new APIError(message || 'Failed to send reset email', 400);
      }

      console.log('✅ [AuthService] Reset email sent');
      return { 
        success: true, 
        message: message || 'Password reset email sent successfully',
        emailSent: emailSent || false
      };
      
    } catch (error) {
      console.error('❌ [AuthService] Forgot password error:', error);
      
      // Special handling for 404 - email not found
      if (error.response?.status === 404) {
        // For security, return success even if email not found
        return {
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent',
          emailSent: false
        };
      }
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw new APIError(error.message || 'Failed to send reset email', 500);
    }
  }

  /**
   * Validate password reset token
   */
/**
 * Validate password reset token (primary method)
 */
async validateResetToken(token) {
  try {
    console.log('🔐 [AuthService] Validating reset token');
    
    const response = await apiService.get(`${this.baseUrl}/validate-reset-token/${token}`);
    
    const { success, valid, message, email } = response.data;
    
    return { 
      success: success || false, 
      valid: valid || false, 
      message, 
      email 
    };
    
  } catch (error) {
    console.error('❌ [AuthService] Validate reset token error:', error);
    
    // Return false for invalid tokens
    return {
      success: false,
      valid: false,
      message: error.message || 'Invalid or expired reset token',
      email: null
    };
  }
}

/**
 * Verify reset token (alias for backward compatibility)
 */
async verifyResetToken(token) {
  console.log('⚠️ [AuthService] verifyResetToken is deprecated, use validateResetToken instead');
  return this.validateResetToken(token);
}
  /**
   * Reset password with token
   */
  async resetPassword(token, password) {
    try {
      console.log('🔄 [AuthService] Reset password request');
      
      const response = await apiService.post(`${this.baseUrl}/reset-password/${token}`, { 
        password 
      });

      const { success, message } = response.data;
      
      if (!success) {
        throw new APIError(message || 'Failed to reset password', 400);
      }

      console.log('✅ [AuthService] Password reset successful');
      return { 
        success: true, 
        message: message || 'Password reset successfully' 
      };
      
    } catch (error) {
      console.error('❌ [AuthService] Reset password error:', error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw new APIError(error.message || 'Failed to reset password', 500);
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token) {
    try {
      console.log('📧 [AuthService] Verify email request');
      
      const response = await apiService.get(`${this.baseUrl}/verify-email/${token}`);
      
      console.log('📥 [AuthService] Verification API response:', response.data);

      const { success, data, message, redirectUrl } = response.data;
      
      if (!success) {
        // Throw error with proper message
        throw new APIError(message || 'Email verification failed', 400);
      }

      console.log('✅ [AuthService] Email verified successfully');
      return { 
        success: true, 
        data: data || {},
        message: message || 'Email verified successfully',
        redirectUrl: redirectUrl || null
      };
      
    } catch (error) {
      console.error('❌ [AuthService] Verify email error:', error);
      
      // Always throw - don't return { success: false }
      if (error instanceof APIError) {
        throw error;
      }
      
      throw new APIError(
        error.response?.data?.message || 
        error.message || 
        'Email verification failed', 
        error.response?.status || 500
      );
    }
  }

  /**
   * Resend verification email
   */
  async resendVerification(email) {
    try {
      console.log('📧 [AuthService] Resend verification request');
      
      const response = await apiService.post(`${this.baseUrl}/resend-verification`, { 
        email: email.trim().toLowerCase() 
      });

      const { success, message, emailSent } = response.data;
      
      if (!success) {
        throw new APIError(message || 'Failed to resend verification email', 400);
      }

      console.log('✅ [AuthService] Verification email resent');
      return { 
        success: true, 
        message: message || 'Verification email sent successfully',
        emailSent: emailSent || false
      };
      
    } catch (error) {
      console.error('❌ [AuthService] Resend verification error:', error);
      
      // Special handling for already verified emails
      if (error.response?.status === 400) {
        const errorMessage = error.response.data?.message || '';
        if (errorMessage.includes('already verified')) {
          return {
            success: false,
            message: 'Email is already verified',
            emailSent: false
          };
        }
      }
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw new APIError(error.message || 'Failed to resend verification email', 500);
    }
  }

  /**
   * Get authentication token
   */
  getToken() {
    return localStorage.getItem('token');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    const token = this.getToken();
    const user = localStorage.getItem('user');
    const session = this.getCurrentSession();
    
    return !!(token && user && session);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired() {
    const session = this.getCurrentSession();
    if (!session?.expiresAt) return true;
    
    // Consider token expired 5 minutes before actual expiry
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    return Date.now() > (session.expiresAt - bufferTime);
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Store authentication data
   */
  _storeAuthData(data) {
    if (data.token) {
      localStorage.setItem('token', data.token);
      apiService.setAuthToken(data.token);
    }
    
    if (data.user) {
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    if (data.expiresAt) {
      const session = {
        id: `session_${Date.now()}`,
        accessToken: data.token,
        refreshToken: data.refreshToken || `refresh_${Date.now()}`,
        expiresAt: data.expiresAt,
        createdAt: new Date().toISOString(),
        user: data.user
      };
      localStorage.setItem('session', JSON.stringify(session));
    }
  }

  /**
   * Clear authentication data
   */
  _clearAuthData() {
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('session');
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear API service auth
    apiService.clearAuthToken();
    
    // Clear any refresh timeout
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout);
      this.tokenRefreshTimeout = null;
    }
    
    console.log('🧹 [AuthService] Auth data cleared');
  }

  /**
   * Schedule token refresh
   */
  _scheduleTokenRefresh(expiresAt) {
    // Clear existing timeout
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout);
    }

    // Refresh 5 minutes before expiry
    const refreshTime = expiresAt - Date.now() - (5 * 60 * 1000);
    
    if (refreshTime > 0) {
      this.tokenRefreshTimeout = setTimeout(async () => {
        try {
          console.log('🔄 [AuthService] Auto-refreshing token...');
          await this.refreshAccessToken();
        } catch (error) {
          console.error('❌ [AuthService] Scheduled token refresh failed:', error);
          // Clear auth data on refresh failure
          this._clearAuthData();
          
          // Redirect to login if not already there
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login?session=expired';
          }
        }
      }, refreshTime);
      
      console.log(`⏰ [AuthService] Token refresh scheduled in ${Math.round(refreshTime / 1000 / 60)} minutes`);
    } else {
      console.warn('⚠️ [AuthService] Token already expired or expiring soon');
    }
  }
}

// Export singleton instance
const authService = new AuthService();
export { authService };
export default authService;