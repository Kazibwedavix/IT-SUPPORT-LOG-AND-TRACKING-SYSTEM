import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import authService from '../services/authService';
import '../styles/Auth.css';

/**
 * Email Verification Component
 *
 * Verifies user's email address using token from URL
 *
 * Features:
 * - Token validation
 * - Auto-redirect on success
 * - Error handling
 * - User feedback
 *
 * @version 1.0.0
 */
const VerifyEmail = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [errorDetails, setErrorDetails] = useState('');

  useEffect(() => {
    const verifyEmailToken = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link');
        return;
      }

      try {
        const response = await authService.verifyEmail(token);
        
        if (response.success) {
          setStatus('success');
          setMessage('Email verified successfully!');
          setEmail(response.data?.email || '');
          
          // Auto-redirect to login after 3 seconds
          setTimeout(() => {
            navigate('/login', {
              state: {
                verified: true,
                email: response.data?.email,
                message: 'Email verified successfully! You can now login.'
              }
            });
          }, 3000);
        }
      } catch (error) {
        console.error('Email verification error:', error);
        setStatus('error');
        setMessage(error.message || 'Email verification failed');
        setErrorDetails(error.response?.data?.message || '');
      }
    };

    verifyEmailToken();
  }, [token, navigate]);

  const handleResendVerification = async () => {
    if (!email) {
      setErrorDetails('Email address is required');
      return;
    }

    try {
      setStatus('verifying');
      setMessage('');
      setErrorDetails('');
      
      const response = await authService.resendVerification(email);
      
      if (response.success) {
        setStatus('info');
        setMessage('A new verification email has been sent to your inbox.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Failed to resend verification email');
      setErrorDetails(error.message);
    }
  };

  return (
    <>
      <Navbar />
      <div className="auth-container">
        <div className="auth-form verify-email">
          {/* Header */}
          <div className="auth-header">
            <div className="auth-logo">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 7V12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2>Email Verification</h2>
            </div>
            <p className="auth-subtitle">Bugema University IT Support System</p>
          </div>

          {/* Status Messages */}
          <div className="verification-status">
            {status === 'verifying' && (
              <div className="verifying">
                <div className="spinner-large"></div>
                <h3>Verifying Your Email</h3>
                <p>Please wait while we verify your email address...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="success">
                <div className="success-icon-large">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
                <h3>Email Verified Successfully!</h3>
                <p>Your email has been verified and your account is now active.</p>
                {email && (
                  <p className="verified-email">
                    Verified email: <strong>{email}</strong>
                  </p>
                )}
                <p className="redirect-notice">
                  Redirecting to login page in 3 seconds...
                </p>
                <div className="verification-actions">
                  <Link to="/login" className="auth-btn">
                    Login Now
                  </Link>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="error">
                <div className="error-icon-large">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                </div>
                <h3>Verification Failed</h3>
                <p>{message}</p>
                {errorDetails && (
                  <p className="error-details">{errorDetails}</p>
                )}
                <div className="verification-actions">
                  <Link to="/login" className="auth-btn secondary">
                    Back to Login
                  </Link>
                  {email && (
                    <button 
                      onClick={handleResendVerification}
                      className="auth-btn"
                    >
                      Resend Verification
                    </button>
                  )}
                </div>
              </div>
            )}

            {status === 'info' && (
              <div className="info">
                <div className="info-icon-large">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                </div>
                <h3>Verification Email Sent</h3>
                <p>{message}</p>
                {email && (
                  <p className="info-email">
                    Sent to: <strong>{email}</strong>
                  </p>
                )}
                <div className="verification-actions">
                  <Link to="/login" className="auth-btn">
                    Back to Login
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Help Section */}
          <div className="verification-help">
            <h4>Need Help?</h4>
            <ul>
              <li>Check your spam or junk folder</li>
              <li>Verification links expire after 24 hours</li>
              <li>Ensure you're using the correct email address</li>
              <li>Contact support if you continue to experience issues</li>
            </ul>
            <div className="support-contact">
              <p>
                📧 <a href="mailto:support@bugemauniv.ac.ug">support@bugemauniv.ac.ug</a> | 
                📞 <a href="tel:+256784845785">+256 784-845-785</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default VerifyEmail;