import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import '../styles/Auth.css';

// Security constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const PASSWORD_MIN_LENGTH = 8;

/**
 * Production-Grade Enterprise Login Component
 * 
 * Features:
 * - Enhanced security with rate limiting
 * - Input validation and sanitization
 * - Password visibility toggle
 * - Remember me functionality
 * - Session management
 * - Security event logging
 * - Error handling with user-friendly messages
 * - Accessibility compliance
 * - Responsive design
 * - Loading states with spinners
 * - Auto-focus management
 * - Form validation feedback
 * - Secure password requirements
 * 
 * @version 2.0.0
 * @author IT Support System
 */
const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailRef = useRef(null);
  const { login, logSecurityEvent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get redirect path or default to dashboard
  const from = location.state?.from?.pathname || '/dashboard';

  // Auto-focus email field on mount
  useEffect(() => {
    if (emailRef.current) {
      emailRef.current.focus();
    }

    // Check for locked out state
    const lockoutTime = localStorage.getItem('login_lockout_until');
    if (lockoutTime && Date.now() < parseInt(lockoutTime)) {
      setLockoutUntil(parseInt(lockoutTime));
    }

    // Check for saved email
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      setFormData(prev => ({
        ...prev,
        email: savedEmail,
        rememberMe: true
      }));
    }
  }, []);

  // Countdown for lockout
  useEffect(() => {
    if (!lockoutUntil) return;

    const interval = setInterval(() => {
      if (Date.now() >= lockoutUntil) {
        setLockoutUntil(null);
        localStorage.removeItem('login_lockout_until');
        localStorage.removeItem('login_attempts');
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutUntil]);

  /**
   * Validates email format
   */
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  /**
   * Validates password strength
   */
  const validatePassword = (password) => {
    if (password.length < PASSWORD_MIN_LENGTH) {
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    }
    
    // Additional password strength checks (optional)
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      return 'Password must include uppercase, lowercase, numbers, and special characters';
    }
    
    return null;
  };

  /**
   * Validates form inputs
   */
  const validateForm = () => {
    const errors = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else {
      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        errors.password = passwordError;
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handles input changes with sanitization
   */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Sanitize input
    let sanitizedValue = value;
    
    if (name === 'email') {
      sanitizedValue = value.trim().toLowerCase();
    } else if (name === 'password') {
      sanitizedValue = value;
      // Clear password error when user starts typing
      if (validationErrors.password) {
        setValidationErrors(prev => ({ ...prev, password: '' }));
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : sanitizedValue
    }));

    // Clear field-specific error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  /**
   * Handles password visibility toggle
   */
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  /**
   * Handles form submission with enhanced security
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});

    // Check if user is locked out
    if (lockoutUntil) {
      const remainingTime = Math.ceil((lockoutUntil - Date.now()) / 1000 / 60);
      setError(`Account locked. Try again in ${remainingTime} minutes.`);
      return;
    }

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setIsSubmitting(true);

    try {
      // Log login attempt
      logSecurityEvent('login_attempt', { email: formData.email });

      // Perform login
      const result = await login(formData.email, formData.password, formData.rememberMe);
      
      if (result.success) {
        // Save email if remember me is checked
        if (formData.rememberMe) {
          localStorage.setItem('remembered_email', formData.email);
        } else {
          localStorage.removeItem('remembered_email');
        }

        // Reset login attempts on successful login
        localStorage.removeItem('login_attempts');
        setLoginAttempts(0);

        // Navigate to intended destination
        navigate(from, { replace: true });
      } else {
        // Handle failed login
        const attempts = loginAttempts + 1;
        setLoginAttempts(attempts);
        localStorage.setItem('login_attempts', attempts.toString());

        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          const lockoutTime = Date.now() + LOCKOUT_DURATION;
          setLockoutUntil(lockoutTime);
          localStorage.setItem('login_lockout_until', lockoutTime.toString());
          
          setError(`Too many failed attempts. Account locked for 15 minutes.`);
          
          logSecurityEvent('account_locked', {
            email: formData.email,
            attempts,
            lockoutUntil: new Date(lockoutTime).toISOString()
          });
        } else {
          const remainingAttempts = MAX_LOGIN_ATTEMPTS - attempts;
          setError(`Invalid credentials. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`);
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      
      // Enhanced error handling
      let errorMessage = 'Login failed. Please try again.';
      
      if (err.response) {
        const { status, data } = err.response;
        
        switch (status) {
          case 401:
            errorMessage = data?.message || 'Invalid email or password';
            break;
          case 403:
            errorMessage = 'Account is disabled. Please contact support.';
            break;
          case 429:
            errorMessage = 'Too many requests. Please wait before trying again.';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later.';
            break;
          default:
            errorMessage = data?.message || errorMessage;
        }
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your connection.';
      } else if (err.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Check your internet connection.';
      }
      
      setError(errorMessage);
      
      // Log the error
      logSecurityEvent('login_error', {
        email: formData.email,
        error: err.message,
        status: err.response?.status
      });
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  /**
   * Handles forgot password
   */
  const handleForgotPassword = () => {
    if (!formData.email || !validateEmail(formData.email)) {
      setError('Please enter a valid email address to reset password');
      return;
    }
    
    navigate('/forgot-password', { state: { email: formData.email } });
  };

  /**
   * Calculates remaining lockout time
   */
  const getRemainingLockoutTime = () => {
    if (!lockoutUntil) return 0;
    return Math.ceil((lockoutUntil - Date.now()) / 1000);
  };

  // Format time for display
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Check if form is disabled
  const isFormDisabled = loading || lockoutUntil || isSubmitting;

  return (
    <>
      <Navbar />
      <div className="auth-container">
        <div className="auth-form">
          {/* Header */}
          <div className="auth-header">
            <div className="auth-logo">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 7V12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2>IT Support System</h2>
            </div>
            <p className="auth-subtitle">Enterprise IT Support Management Platform</p>
          </div>

          {/* Lockout Warning */}
          {lockoutUntil && (
            <div className="lockout-warning">
              <div className="lockout-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM12 7C13.1 7 14 7.9 14 9C14 10.1 13.1 11 12 11C10.9 11 10 10.1 10 9C10 7.9 10.9 7 12 7ZM18 15.59C18 16.85 17.64 18.05 17 19.07L12 16L7 19.07C6.36 18.05 6 16.85 6 15.59V12.2L12 9L18 12.2V15.59Z"/>
                </svg>
              </div>
              <div className="lockout-content">
                <h4>Account Temporarily Locked</h4>
                <p>Too many failed login attempts. Please wait:</p>
                <div className="lockout-timer">
                  <span className="timer">{formatTime(getRemainingLockoutTime())}</span>
                </div>
                <p className="lockout-help">
                  Contact your system administrator if you need immediate access.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !lockoutUntil && (
            <div className="error-message" role="alert">
              <div className="error-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
              </div>
              <div className="error-content">
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Success Message (if coming from registration) */}
          {location.state?.registrationSuccess && (
            <div className="success-message" role="alert">
              <div className="success-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div className="success-content">
                <p>Registration successful! Please login with your credentials.</p>
              </div>
            </div>
          )}

          {/* Login Form */}
          {!lockoutUntil && (
            <form onSubmit={handleSubmit} className="login-form" noValidate>
              {/* Email Field */}
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email Address
                  <span className="required">*</span>
                </label>
                <div className={`input-group ${validationErrors.email ? 'error' : ''}`}>
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                    </svg>
                  </div>
                  <input
                    ref={emailRef}
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    placeholder="Enter your email address"
                    className="form-input"
                    aria-describedby={validationErrors.email ? "email-error" : undefined}
                    aria-required="true"
                  />
                </div>
                {validationErrors.email && (
                  <div id="email-error" className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {validationErrors.email}
                  </div>
                )}
              </div>

              {/* Password Field */}
              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="password" className="form-label">
                    Password
                    <span className="required">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="forgot-password"
                    disabled={isFormDisabled}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className={`input-group ${validationErrors.password ? 'error' : ''}`}>
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    placeholder="Enter your password"
                    className="form-input"
                    aria-describedby={validationErrors.password ? "password-error" : undefined}
                    aria-required="true"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="password-toggle"
                    disabled={isFormDisabled}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                      </svg>
                    )}
                  </button>
                </div>
                {validationErrors.password && (
                  <div id="password-error" className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {validationErrors.password}
                  </div>
                )}
              </div>

              {/* Remember Me */}
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    className="checkbox-input"
                  />
                  <span className="checkbox-custom"></span>
                  <span className="checkbox-text">Remember me on this device</span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="form-group">
                <button
                  type="submit"
                  disabled={isFormDisabled}
                  className={`auth-btn ${loading ? 'loading' : ''}`}
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Authenticating...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </div>

              {/* Security Info */}
              <div className="security-info">
                <p className="security-text">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM12 11.99H15C15 13.1 14.1 14 13 14V16H11V14C9.9 14 9 13.1 9 12.01V11H12V8H9V6H12V3H14V6H17V8H14V11H17V12.01C17 14.23 15.21 16 13 16V18H11V16C8.79 16 7 14.21 7 12.01V9H9V12.01C9 12.56 9.45 13.01 10 13.01H12V11.99Z"/>
                  </svg>
                  This is a secure system. Your credentials are encrypted.
                </p>
              </div>
            </form>
          )}

          {/* Registration Link */}
          <div className="auth-footer">
            <p className="auth-link">
              Don't have an account?{' '}
              <Link 
                to="/register" 
                className="link"
                aria-disabled={isFormDisabled}
              >
                Request access
              </Link>
            </p>
            <p className="auth-version">
              IT Support System v{process.env.REACT_APP_VERSION || '1.0.0'}
            </p>
          </div>

          {/* Additional Security Info (only shown in production) */}
          {process.env.NODE_ENV === 'production' && (
            <div className="security-footer">
              <p className="security-notice">
                For security assistance, contact your IT administrator.
              </p>
              <p className="security-contact">
                Email: <a href="mailto:it-support@yourcompany.com">support@bugemauniv.ac.ug</a> | 
                Phone: <a href="tel:+1234567890">+256 784-845-785</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Login;