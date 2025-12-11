import React, { useState, useEffect, useRef } from 'react'; // Added useRef
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
  const hasVerified = useRef(false); // Track if verification already attempted

  useEffect(() => {
    const verifyEmail = async () => {
      // Prevent duplicate verification attempts
      if (hasVerified.current) {
        console.log('Verification already attempted, skipping...');
        return;
      }

      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. No token provided.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        hasVerified.current = true; // Mark as attempted
        console.log('Starting email verification for token:', token);
        
        const response = await authService.verifyEmail(token);
        console.log('Verification response:', response);

        if (response.success) {
          setStatus('success');
          setMessage('Email verified successfully! You can now log in to your account.');
        } else {
          setStatus('error');
          setMessage(response.message || 'Email verification failed. The link may be invalid or expired.');
        }
      } catch (error) {
        console.error('Email verification error:', error);
        
        // Handle "already verified" case gracefully
        if (error.message?.includes('already verified') || 
            error.response?.data?.message?.includes('already verified')) {
          setStatus('success');
          setMessage('Your email has already been verified. You can log in to your account.');
        } else if (error.message?.includes('Invalid or expired')) {
          setStatus('error');
          setMessage('This verification link has expired or is invalid. Please request a new verification email.');
        } else {
          setStatus('error');
          setMessage(
            error.response?.data?.message ||
            'Email verification failed. Please try again or request a new verification email.'
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    verifyEmail();
    
    // Cleanup function (optional)
    return () => {
      console.log('EmailVerification component cleanup');
    };
  }, [token]);

  const handleResendVerification = async () => {
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