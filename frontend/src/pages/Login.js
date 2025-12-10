// frontend/src/pages/Login.js - PRODUCTION READY COMPLETE
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import '../styles/Auth.css';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 8;

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
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const emailRef = useRef(null);
  const { login, logSecurityEvent } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (emailRef.current) emailRef.current.focus();

    const lockoutTime = localStorage.getItem('login_lockout_until');
    if (lockoutTime && Date.now() < parseInt(lockoutTime)) {
      setLockoutUntil(parseInt(lockoutTime));
    }

    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      setFormData(prev => ({ ...prev, email: savedEmail, rememberMe: true }));
    }
  }, []);

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

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const validatePassword = (password) => {
    if (password.length < PASSWORD_MIN_LENGTH) {
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    }
    return null;
  };

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
      if (passwordError) errors.password = passwordError;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    let sanitizedValue = value;
    if (name === 'email') sanitizedValue = value.trim().toLowerCase();
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : sanitizedValue
    }));

    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Clear verification resend option if email changes
    if (name === 'email' && showResendVerification) {
      setShowResendVerification(false);
      setUnverifiedEmail('');
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const handleResendVerification = () => {
    navigate('/resend-verification', { 
      state: { email: unverifiedEmail || formData.email } 
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});
    setShowResendVerification(false);
    setUnverifiedEmail('');

    if (lockoutUntil) {
      const remainingTime = Math.ceil((lockoutUntil - Date.now()) / 1000 / 60);
      setError(`Account locked. Try again in ${remainingTime} minutes.`);
      return;
    }

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Security logging
      logSecurityEvent('login_attempt', { email: formData.email });

      const result = await login(formData.email, formData.password, formData.rememberMe);
      
      if (result.success) {
        if (formData.rememberMe) {
          localStorage.setItem('remembered_email', formData.email);
        } else {
          localStorage.removeItem('remembered_email');
        }

        localStorage.removeItem('login_attempts');
        setLoginAttempts(0);
        navigate(from, { replace: true });
      } else {
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
      
      let errorMessage = 'Login failed. Please try again.';
      
      // Check if error is due to unverified email
      if (err.response?.status === 403 && err.response?.data?.requiresVerification) {
        errorMessage = 'Please verify your email before logging in. Check your email for verification link.';
        setShowResendVerification(true);
        setUnverifiedEmail(formData.email);
        
        logSecurityEvent('unverified_email_attempt', {
          email: formData.email,
          requiresVerification: true
        });
      } else if (err.response) {
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
      
      logSecurityEvent('login_error', {
        email: formData.email,
        error: err.message,
        status: err.response?.status,
        requiresVerification: err.response?.data?.requiresVerification || false
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!formData.email || !validateEmail(formData.email)) {
      setError('Please enter a valid email address to reset password');
      return;
    }
    
    navigate('/forgot-password', { state: { email: formData.email } });
  };

  const getRemainingLockoutTime = () => {
    if (!lockoutUntil) return 0;
    return Math.ceil((lockoutUntil - Date.now()) / 1000);
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const isFormDisabled = loading || lockoutUntil;

  return (
    <>
      <Navbar />
      <div className="auth-container">
        <div className="auth-form">
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

          {error && !lockoutUntil && (
            <div className="error-message" role="alert">
              <div className="error-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
              </div>
              <div className="error-content">
                <p>{error}</p>
                {showResendVerification && (
                  <div className="verification-actions">
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      className="resend-verification-btn"
                    >
                      Resend Verification Email
                    </button>
                    <p className="verification-help">
                      Didn't receive the email? Check your spam folder or request a new verification link.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!lockoutUntil && (
            <form onSubmit={handleSubmit} className="login-form" noValidate>
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email Address <span className="required">*</span>
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
                  />
                </div>
                {validationErrors.email && (
                  <div className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {validationErrors.email}
                  </div>
                )}
              </div>

              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="password" className="form-label">
                    Password <span className="required">*</span>
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
                  <div className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {validationErrors.password}
                  </div>
                )}
              </div>

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

              <div className="form-group">
                <button
                  type="submit"
                  disabled={isFormDisabled}
                  className={`auth-btn ${loading ? 'loading' : ''}`}
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

          <div className="auth-footer">
            <p className="auth-link">
              Don't have an account?{' '}
              <Link to="/register" className="link">Request access</Link>
            </p>
            <p className="auth-version">
              IT Support System v{process.env.REACT_APP_VERSION || '1.0.0'}
            </p>
          </div>

          {process.env.NODE_ENV === 'production' && (
            <div className="security-footer">
              <p className="security-notice">For security assistance, contact your IT administrator.</p>
              <p className="security-contact">
                Email: <a href="mailto:support@bugemauniv.ac.ug">support@bugemauniv.ac.ug</a> | 
                Phone: <a href="tel:+256784845785">+256 784-845-785</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Login;