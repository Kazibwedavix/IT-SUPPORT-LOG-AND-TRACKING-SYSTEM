import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import authService from '../services/authService';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/EmailVerification.css';

const EmailVerification = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. No token provided.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await authService.verifyEmail(token);

        if (response.success) {
          setStatus('success');
          setMessage('Email verified successfully! You can now log in to your account.');
        } else {
          setStatus('error');
          setMessage(response.message || 'Email verification failed. The link may be invalid or expired.');
        }
      } catch (error) {
        console.error('Email verification error:', error);
        setStatus('error');
        setMessage(
          error.response?.data?.message ||
          'Email verification failed. Please try again or request a new verification email.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    verifyEmail();
  }, [token]);

  const handleResendVerification = async () => {
    // This would require the user's email, so we'll redirect to login
    navigate('/login', {
      state: {
        message: 'Please log in to request a new verification email.',
        type: 'info'
      }
    });
  };

  if (isLoading) {
    return (
      <div className="email-verification-container">
        <div className="verification-card">
          <LoadingSpinner />
          <h2>Verifying Your Email</h2>
          <p>Please wait while we verify your email address...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="email-verification-container">
      <div className="verification-card">
        <div className={`verification-icon ${status}`}>
          {status === 'success' ? (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22,4 12,14.01 9,11.01"/>
            </svg>
          ) : (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          )}
        </div>

        <h2 className={`verification-title ${status}`}>
          {status === 'success' ? 'Email Verified!' : 'Verification Failed'}
        </h2>

        <p className="verification-message">{message}</p>

        <div className="verification-actions">
          {status === 'success' ? (
            <Link to="/login" className="btn btn-primary">
              Continue to Login
            </Link>
          ) : (
            <>
              <button
                onClick={handleResendVerification}
                className="btn btn-secondary"
              >
                Back to Login
              </button>
              <Link to="/register" className="btn btn-outline">
                Create New Account
              </Link>
            </>
          )}
        </div>

        <div className="verification-footer">
          <p>
            Need help? <Link to="/forgot-password">Contact Support</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
