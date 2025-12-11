import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import authService from '../services/authService';
import '../styles/Auth.css';

/**
 * Reset Password Component
 *
 * Allows users to reset their password using a token from email
 *
 * Features:
 * - Token validation
 * - Password strength indicators
 * - Password visibility toggle
 * - Confirmation matching
 * - Success/error feedback
 * - Loading states
 * - Accessibility compliance
 * - Responsive design
 *
 * @version 1.0.0
 * @author Bugema University IT Support System
 */
const ResetPassword = () => {
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    level: 0,
    label: '',
    color: ''
  });

  const passwordRef = useRef(null);
  const navigate = useNavigate();
  const { token } = useParams();
  const hasVerifiedToken = useRef(false); // Add this to prevent duplicate calls

  // Verify token on mount
  useEffect(() => {
    verifyResetToken();
  }, [token]);

  // Auto-focus password field when token is valid
  useEffect(() => {
    if (tokenValid && passwordRef.current) {
      passwordRef.current.focus();
    }
  }, [tokenValid]);

  /**
   * Verifies the reset token
   */
  const verifyResetToken = async () => {
    // Prevent duplicate calls in StrictMode
    if (hasVerifiedToken.current) return;
    hasVerifiedToken.current = true;

    try {
      // FIX: Use validateResetToken instead of verifyResetToken
      const response = await authService.validateResetToken(token);
      setTokenValid(response.valid);
      
      if (!response.valid) {
        setError('This password reset link is invalid or has expired. Please request a new one.');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      setTokenValid(false);
      setError('Failed to verify reset link. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  /**
   * Calculates password strength
   */
  const calculatePasswordStrength = (password) => {
    let strength = 0;
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    // Calculate strength
    if (checks.length) strength += 20;
    if (checks.uppercase) strength += 20;
    if (checks.lowercase) strength += 20;
    if (checks.numbers) strength += 20;
    if (checks.special) strength += 20;

    // Determine level and color
    let level = 0;
    let label = '';
    let color = '';

    if (strength === 0) {
      level = 0;
      label = '';
      color = '';
    } else if (strength <= 40) {
      level = 1;
      label = 'Weak';
      color = '#ef4444';
    } else if (strength <= 60) {
      level = 2;
      label = 'Fair';
      color = '#f59e0b';
    } else if (strength <= 80) {
      level = 3;
      label = 'Good';
      color = '#10b981';
    } else {
      level = 4;
      label = 'Strong';
      color = '#059669';
    }

    return { level, label, color, checks };
  };

  /**
   * Handles input changes
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Calculate password strength for password field
    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }

    // Clear messages when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };

  /**
   * Validates password requirements
   */
  const validatePassword = () => {
    const { password, confirmPassword } = formData;

    if (!password.trim()) {
      return 'Password is required';
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    if (!confirmPassword.trim()) {
      return 'Please confirm your password';
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }

    return null;
  };

  /**
   * Handles form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validate
    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      // FIX: Remove the object wrapper, just pass password
      const response = await authService.resetPassword(token, formData.password);
      
      setSuccess(response.message || 'Password reset successfully!');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            message: 'Password reset successful! Please login with your new password.' 
          }
        });
      }, 3000);

    } catch (error) {
      console.error('Reset password error:', error);
      setError(error.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Toggles password visibility
   */
  const togglePasswordVisibility = (field) => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else {
      setShowConfirmPassword(!showConfirmPassword);
    }
  };

  // Loading state while verifying token
  if (verifying) {
    return (
      <>
        <Navbar />
        <div className="auth-container">
          <div className="auth-form">
            <div className="loading-container">
              <div className="spinner large"></div>
              <p className="loading-text">Verifying reset link...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <>
        <Navbar />
        <div className="auth-container">
          <div className="auth-form">
            <div className="auth-header">
              <div className="error-icon large">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
              </div>
              <h2>Invalid Reset Link</h2>
              <p className="auth-subtitle">{error}</p>
            </div>
            <div className="form-group">
              <Link to="/forgot-password" className="auth-btn">
                Request New Reset Link
              </Link>
            </div>
            <div className="auth-footer">
              <p className="auth-link">
                <Link to="/login" className="link">
                  Back to Login
                </Link>
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Main reset password form
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
            <p className="auth-subtitle">Create New Password</p>
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
                  Redirecting you to login page...
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
          {!success && (
            <form onSubmit={handleSubmit} className="login-form" noValidate>
              {/* Instructions */}
              <div className="form-instructions">
                <p>Choose a strong password for your account.</p>
              </div>

              {/* New Password Field */}
              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  New Password
                  <span className="required">*</span>
                </label>
                <div className="input-group">
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                  </div>
                  <input
                    ref={passwordRef}
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Enter new password"
                    className="form-input"
                    aria-describedby="password-strength"
                    aria-required="true"
                  />
                  <button
                    type="button"
                    className="input-action"
                    onClick={() => togglePasswordVisibility('password')}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
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

                {/* Password Strength Indicator */}
                {formData.password && (
                  <div id="password-strength" className="password-strength">
                    <div className="strength-bars">
                      {[1, 2, 3, 4].map((bar) => (
                        <div
                          key={bar}
                          className={`strength-bar ${bar <= passwordStrength.level ? 'active' : ''}`}
                          style={{
                            backgroundColor: bar <= passwordStrength.level ? passwordStrength.color : '#e5e7eb'
                          }}
                        />
                      ))}
                    </div>
                    <span 
                      className="strength-label"
                      style={{ color: passwordStrength.color }}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                )}

                {/* Password Requirements */}
                <div className="password-requirements">
                  <p className="requirements-title">Password must contain:</p>
                  <ul className="requirements-list">
                    <li className={formData.password.length >= 8 ? 'valid' : ''}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                      At least 8 characters
                    </li>
                    <li className={/[A-Z]/.test(formData.password) ? 'valid' : ''}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                      One uppercase letter
                    </li>
                    <li className={/[a-z]/.test(formData.password) ? 'valid' : ''}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                      One lowercase letter
                    </li>
                    <li className={/\d/.test(formData.password) ? 'valid' : ''}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                      One number
                    </li>
                  </ul>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Confirm Password
                  <span className="required">*</span>
                </label>
                <div className="input-group">
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Confirm new password"
                    className="form-input"
                    aria-required="true"
                  />
                  <button
                    type="button"
                    className="input-action"
                    onClick={() => togglePasswordVisibility('confirmPassword')}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
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
              </div>

              {/* Submit Button */}
              <div className="form-group">
                <button
                  type="submit"
                  disabled={loading || !formData.password || !formData.confirmPassword}
                  className={`auth-btn ${loading ? 'loading' : ''}`}
                  aria-busy={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner"></span>
                      Resetting Password...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="auth-footer">
            <p className="auth-link">
              Remember your password?{' '}
              <Link to="/login" className="link">
                Back to Login
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

export default ResetPassword;