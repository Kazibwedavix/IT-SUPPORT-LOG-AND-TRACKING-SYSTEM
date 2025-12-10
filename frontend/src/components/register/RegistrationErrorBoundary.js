// frontend/src/components/register/RegistrationErrorBoundary.jsx
import React from 'react';
import PropTypes from 'prop-types';
import ErrorBoundary from '../ErrorBoundary';
import '../styles/ErrorBoundary.css';

/**
 * RegistrationErrorBoundary Component
 * 
 * Specialized error boundary for registration flow with:
 * - Form data recovery
 * - Registration-specific error handling
 * - Progress preservation
 * - User-friendly registration errors
 * 
 * @version 2.0.0
 * @author IT Support Team
 */
class RegistrationErrorBoundary extends ErrorBoundary {
  constructor(props) {
    super(props);
    this.state = {
      ...this.state,
      formData: null,
      registrationStep: null,
      canRecover: false
    };
  }

  static getDerivedStateFromError(error) {
    // Get parent state
    const parentState = super.getDerivedStateFromError?.(error) || { hasError: true, error };
    
    // Try to recover form data
    let formData = null;
    let registrationStep = null;
    let canRecover = false;
    
    try {
      const savedData = localStorage.getItem('registration_form_data');
      if (savedData) {
        formData = JSON.parse(savedData);
        canRecover = true;
        
        // Determine registration step based on form data
        if (formData.email && formData.password) {
          registrationStep = 'security';
        } else if (formData.firstName && formData.lastName) {
          registrationStep = 'personal_info';
        } else if (formData.role) {
          registrationStep = 'role_selection';
        }
      }
    } catch (e) {
      console.warn('Failed to recover form data:', e);
    }
    
    return {
      ...parentState,
      formData,
      registrationStep,
      canRecover,
      errorId: `REG_ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error, errorInfo) {
    // Call parent's error handling
    super.componentDidCatch?.(error, errorInfo);
    
    // Additional registration-specific logging
    this.logRegistrationError(error, errorInfo);
  }

  /**
   * Logs registration-specific errors
   */
  logRegistrationError = (error, errorInfo) => {
    const registrationErrorData = {
      ...this.getBaseErrorData(error, errorInfo),
      formFields: this.state.formData ? Object.keys(this.state.formData) : [],
      registrationStep: this.state.registrationStep,
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timestamp: new Date().toISOString(),
      errorType: 'registration_error'
    };

    console.error('[Registration Error]', registrationErrorData);
    
    // Send to registration-specific monitoring
    this.sendToRegistrationMonitoring(registrationErrorData);
  };

  /**
   * Sends error to registration monitoring service
   */
  sendToRegistrationMonitoring = (errorData) => {
    try {
      // Store in localStorage for debugging
      const existingRegistrationErrors = JSON.parse(localStorage.getItem('registration_errors') || '[]');
      existingRegistrationErrors.unshift({
        ...errorData,
        id: this.state.errorId
      });
      
      // Keep only last 20 registration errors
      if (existingRegistrationErrors.length > 20) {
        existingRegistrationErrors.pop();
      }
      
      localStorage.setItem('registration_errors', JSON.stringify(existingRegistrationErrors));
      
      // Send to your backend for monitoring
      this.sendToBackendMonitoring(errorData);
      
    } catch (e) {
      console.warn('Failed to save registration error:', e);
    }
  };

  /**
   * Sends error to backend monitoring service
   */
  sendToBackendMonitoring = async (errorData) => {
    try {
      // Only send in production
      if (process.env.NODE_ENV === 'production') {
        // Use fetch instead of axios to avoid circular dependencies
        await fetch('/api/monitoring/errors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'registration_error',
            data: errorData,
            timestamp: new Date().toISOString()
          })
        });
      }
    } catch (error) {
      console.warn('Failed to send error to backend:', error);
    }
  };

  /**
   * Gets base error data for logging
   */
  getBaseErrorData = (error, errorInfo) => {
    return {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      name: error.name,
      url: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      previousUrl: document.referrer
    };
  };

  /**
   * Handles recovery with saved form data
   */
  handleRecoverForm = () => {
    if (this.state.canRecover && this.state.formData) {
      // Dispatch custom event to notify parent component
      const recoveryEvent = new CustomEvent('registrationRecovery', {
        detail: {
          formData: this.state.formData,
          errorId: this.state.errorId,
          timestamp: new Date().toISOString()
        }
      });
      window.dispatchEvent(recoveryEvent);
      
      // Clear error state
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        formData: null,
        registrationStep: null,
        canRecover: false
      });
    }
  };

  /**
   * Handles starting over (clear all form data)
   */
  handleStartOver = () => {
    // Clear saved form data
    localStorage.removeItem('registration_form_data');
    localStorage.removeItem('registration_progress');
    
    // Reset state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      formData: null,
      registrationStep: null,
      canRecover: false
    });
    
    // Refresh the page to start fresh
    window.location.reload();
  };

  /**
   * Renders registration-specific error UI
   */
  renderRegistrationErrorUI = () => {
    const { errorId, canRecover, registrationStep, formData } = this.state;
    const isDevelopment = process.env.NODE_ENV === 'development';

    return (
      <div className="error-boundary registration-error-boundary" role="alert">
        <div className="error-container registration-error-container">
          <div className="error-icon registration-error-icon" aria-hidden="true">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" 
                    fill="#ef4444"/>
            </svg>
          </div>
          
          <div className="error-content registration-error-content">
            <h1 className="error-title registration-error-title">
              Registration Error
            </h1>
            
            <div className="error-message registration-error-message">
              <p>
                We encountered an error during the registration process. 
                Your form data has been saved and you can recover it below.
              </p>
              
              <div className="registration-error-details">
                <div className="error-info-card">
                  <div className="error-info-row">
                    <span className="error-info-label">Error ID:</span>
                    <span className="error-info-value">{errorId}</span>
                  </div>
                  
                  {registrationStep && (
                    <div className="error-info-row">
                      <span className="error-info-label">Progress:</span>
                      <span className="error-info-value">
                        {registrationStep.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                  )}
                  
                  {formData?.email && (
                    <div className="error-info-row">
                      <span className="error-info-label">Email:</span>
                      <span className="error-info-value">{formData.email}</span>
                    </div>
                  )}
                  
                  {canRecover && (
                    <div className="error-info-row recovery-info">
                      <span className="error-info-label">Recovery:</span>
                      <span className="error-info-value success">
                        ✓ Form data can be recovered
                      </span>
                    </div>
                  )}
                </div>
                
                {isDevelopment && this.state.error && (
                  <details className="error-dev-details registration-dev-details">
                    <summary>Technical Details</summary>
                    <div className="error-stack-container">
                      <pre className="error-stack">
                        {this.state.error.toString()}
                        {this.state.errorInfo?.componentStack}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            </div>
            
            <div className="error-actions registration-error-actions">
              {canRecover ? (
                <>
                  <button
                    onClick={this.handleRecoverForm}
                    className="btn btn-primary recovery-btn"
                    aria-label="Recover form data and continue registration"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    Recover & Continue
                  </button>
                  
                  <button
                    onClick={this.handleStartOver}
                    className="btn btn-secondary"
                    aria-label="Start registration over from beginning"
                  >
                    Start Over
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={this.handleRetry}
                    className="btn btn-primary"
                    aria-label="Retry registration"
                  >
                    Try Again
                  </button>
                  
                  <button
                    onClick={this.handleGoHome}
                    className="btn btn-secondary"
                    aria-label="Go to home page"
                  >
                    Go to Home
                  </button>
                </>
              )}
              
              <button
                onClick={this.handleCopyErrorDetails}
                className="btn btn-text copy-error-btn"
                aria-label="Copy error details for support"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
                Copy Error Details
              </button>
            </div>
            
            <div className="error-support registration-error-support">
              <div className="support-card">
                <h3 className="support-title">Need Help?</h3>
                <p className="support-text">
                  If you continue to experience issues, please contact our IT Support team 
                  with the Error ID above for assistance.
                </p>
                <div className="support-contact-details">
                  <div className="support-contact-item">
                    <span className="contact-icon">📧</span>
                    <a href="mailto:support@bugemauniv.ac.ug" className="contact-link">
                      support@bugemauniv.ac.ug
                    </a>
                  </div>
                  <div className="support-contact-item">
                    <span className="contact-icon">📞</span>
                    <a href="tel:+256784845785" className="contact-link">
                      +256 784-845-785
                    </a>
                  </div>
                  <div className="support-contact-item">
                    <span className="contact-icon">🕒</span>
                    <span className="contact-text">
                      Support Hours: Mon-Fri 8:00 AM - 5:00 PM
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="prevention-tips">
                <h4 className="tips-title">Prevention Tips:</h4>
                <ul className="tips-list">
                  <li>Ensure you have a stable internet connection</li>
                  <li>Disable browser extensions that might interfere</li>
                  <li>Use the latest version of your browser</li>
                  <li>Clear browser cache if problems persist</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  render() {
    if (this.state.hasError) {
      return this.renderRegistrationErrorUI();
    }

    return this.props.children;
  }
}

RegistrationErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired
};

export default RegistrationErrorBoundary;