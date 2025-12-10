import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import authService from '../services/authService';
import '../styles/Auth.css';

/**
 * Forgot Password Component
 *
 * Allows users to request a password reset email
 *
 * Features:
 * - Email validation
 * - Rate limiting awareness
 * - Success/error feedback
 * - Loading states
 * - Accessibility compliance
 * - Responsive design
 *
 * @version 1.0.0
 * @author Bugema University IT Support System
 */
const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const emailRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Get email from location state (from login page)
  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    }

    // Auto-focus email field
    if (emailRef.current) {
      emailRef.current.focus();
    }
  }, [location.state]);

  /**
   * Validates email format
   */
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  /**
   * Handles input changes
   */
  const handleChange = (e) => {
    const value = e.target.value;
    setEmail(value);

    // Clear messages when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };

 const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  setSuccess('');
  setLoading(true);

  // Validate email
  if (!email.trim()) {
    setError('Email address is required');
    setLoading(false);
    return;
  }

  if (!validateEmail(email)) {
    setError('Please enter a valid email address');
    setLoading(false);
    return;
  }

  try {
    const response = await authService.forgotPassword(email.trim());

    // Handle both success cases (real success and security success)
    if (response.success) {
      setSuccess(response.message);
      setIsSubmitted(true);
    } else {
      setError(response.message || 'Failed to send reset email');
    }

  } catch (error) {
    console.error('Forgot password error:', error);
    
    // Check if it's a security response (email not found but we return success)
    if (error.response?.status === 404) {
      // For security, show success message even if email not found
      setSuccess('If an account exists with this email, a password reset link has been sent');
      setIsSubmitted(true);
    } else {
      setError(error.message || 'Failed to send reset email. Please try again.');
    }
  } finally {
    setLoading(false);
  }
};

  /**
   * Handles back to login
   */
  const handleBackToLogin = () => {
    navigate('/login', { state: { email } });
  };

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
            <p className="auth-subtitle">Reset Your Password</p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="success-message" role="alert">
              <div className="success-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <div className="success-content">
                <p>{success}</p>
                <p className="success-note">
                  Please check your email (including spam/junk folder) and follow the instructions to reset your password.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
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

          {/* Form */}
          {!isSubmitted && (
            <form onSubmit={handleSubmit} className="login-form" noValidate>
              {/* Instructions */}
              <div className="form-instructions">
                <p>Enter your email address and we'll send you a link to reset your password.</p>
              </div>

              {/* Email Field */}
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email Address
                  <span className="required">*</span>
                </label>
                <div className="input-group">
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
                    value={email}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Enter your email address"
                    className="form-input"
                    aria-describedby={error ? "email-error" : undefined}
                    aria-required="true"
                  />
                </div>
                {error && (
                  <div id="email-error" className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {error}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="form-group">
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className={`auth-btn ${loading ? 'loading' : ''}`}
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Sending Reset Link...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </div>

              {/* Security Info */}
              <div className="security-info">
                <p className="security-text">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM12 11.99H15C15 13.1 14.1 14 13 14V16H11V14C9.9 14 9 13.1 9 12.01V11H12V8H9V6H12V3H14V6H17V8H14V11H17V12.01C17 14.23 15.21 16 13 16V18H11V16C8.79 16 7 14.21 7 12.01V9H9V12.01C9 12.56 9.45 13.01 10 13.01H12V11.99Z"/>
                  </svg>
                  For security reasons, reset links expire after 10 minutes.
                </p>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="auth-footer">
            <p className="auth-link">
              Remember your password?{' '}
              <button
                onClick={handleBackToLogin}
                className="link-button"
              >
                Back to Login
              </button>
            </p>
            <p className="auth-link">
              Don't have an account?{' '}
              <Link to="/register" className="link">
                Request access
              </Link>
            </p>
            <p className="auth-version">
              IT Support System v{process.env.REACT_APP_VERSION || '1.0.0'}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ForgotPassword;
