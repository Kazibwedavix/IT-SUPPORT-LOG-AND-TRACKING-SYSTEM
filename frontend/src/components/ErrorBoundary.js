import React from 'react';
import PropTypes from 'prop-types';
import '../styles/ErrorBoundary.css';

/**
 * ErrorBoundary Component
 * 
 * Catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 * 
 * @version 3.0.0
 * @author IT Support Team
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { 
      hasError: true, 
      error,
      errorId: `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    this.logErrorToService(error, errorInfo);
    
    // Update state with error info
    this.setState({ errorInfo });
    
    // Optionally, send error to analytics
    this.trackError(error);
  }

  /**
   * Logs errors to external monitoring service
   */
  logErrorToService = (error, errorInfo) => {
    const errorData = {
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      // Add user context if available
      userId: localStorage.getItem('userId'),
      userRole: localStorage.getItem('userRole')
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', errorData);
    }

    // Send to error tracking service (Sentry, LogRocket, etc.)
    this.sendToErrorService(errorData);
  };

  /**
   * Sends error data to external monitoring service
   */
  sendToErrorService = (errorData) => {
    // Implement your error reporting service integration here
    // Example: Sentry.captureException(error, { extra: errorData });
    
    // For now, we'll log to console and localStorage for debugging
    try {
      const existingErrors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      existingErrors.push({
        ...errorData,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 50 errors
      if (existingErrors.length > 50) {
        existingErrors.shift();
      }
      
      localStorage.setItem('app_errors', JSON.stringify(existingErrors));
    } catch (e) {
      // Silently fail if localStorage is not available
    }
  };

  /**
   * Tracks error for analytics
   */
  trackError = (error) => {
    // Implement your analytics tracking here
    // Example: Google Analytics, Mixpanel, etc.
  };

  /**
   * Handles retry action
   */
  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null 
    });
    
    // Optionally refresh the page
    // window.location.reload();
  };

  /**
   * Handles going back to home
   */
  handleGoHome = () => {
    window.location.href = '/';
  };

  /**
   * Handles copying error details for support
   */
  handleCopyErrorDetails = () => {
    const errorDetails = `
Error ID: ${this.state.errorId}
Time: ${new Date().toISOString()}
Message: ${this.state.error?.message}
URL: ${window.location.href}

Stack Trace:
${this.state.error?.stack}

Component Stack:
${this.state.errorInfo?.componentStack}
    `.trim();

    navigator.clipboard.writeText(errorDetails).then(() => {
      alert('Error details copied to clipboard. Please share this with support.');
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = errorDetails;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Error details copied to clipboard. Please share this with support.');
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <div className="error-container">
            <div className="error-icon" aria-hidden="true">
              ⚠️
            </div>
            
            <div className="error-content">
              <h1 className="error-title">Something went wrong</h1>
              
              <div className="error-message">
                <p>
                  The application encountered an unexpected error. Our team has been notified.
                </p>
                
                <div className="error-details">
                  <p className="error-id">
                    <strong>Error ID:</strong> {this.state.errorId}
                  </p>
                  
                  {process.env.NODE_ENV === 'development' && (
                    <details className="error-dev-details">
                      <summary>Technical Details (for development)</summary>
                      <pre className="error-stack">
                        {this.state.error?.toString()}
                        {this.state.errorInfo?.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
              
              <div className="error-actions">
                <button
                  onClick={this.handleRetry}
                  className="btn btn-primary"
                  aria-label="Retry loading the component"
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
                
                <button
                  onClick={this.handleCopyErrorDetails}
                  className="btn btn-text"
                  aria-label="Copy error details for support"
                >
                  Copy Error Details
                </button>
              </div>
              
              <div className="error-support">
                <p>
                  If the problem persists, please contact IT Support with the Error ID above.
                </p>
                <p className="support-contact">
                  📞 IT Help Desk: Ext. 1234 | 📧 support@bugemauniv.ac.ug
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired
};

export default ErrorBoundary;