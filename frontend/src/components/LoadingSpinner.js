import React from 'react';
import PropTypes from 'prop-types';
import '../styles/LoadingSpinner.css';

/**
 * LoadingSpinner Component
 * 
 * A reusable, accessible loading spinner with multiple size options
 * and customizable messages. Supports full-page and inline modes.
 * 
 * @param {Object} props - Component properties
 * @param {string} props.message - Loading message to display
 * @param {boolean} props.fullPage - Whether to display as full-page overlay
 * @param {string} props.size - Size variant: 'small', 'medium', 'large'
 * @param {string} props.color - Spinner color (CSS color value)
 * @param {string} props.className - Additional CSS classes
 * 
 * @version 2.0.0
 * @author IT Support Team
 */
const LoadingSpinner = ({ 
  message = 'Loading...', 
  fullPage = false, 
  size = 'medium',
  color = '#007bff',
  className = ''
}) => {
  // Determine spinner size based on variant
  const getSpinnerSize = () => {
    const sizes = {
      small: { width: '24px', height: '24px', borderWidth: '2px' },
      medium: { width: '40px', height: '40px', borderWidth: '3px' },
      large: { width: '60px', height: '60px', borderWidth: '4px' }
    };
    return sizes[size] || sizes.medium;
  };

  const spinnerSize = getSpinnerSize();

  return (
    <div 
      className={`loading-spinner ${fullPage ? 'full-page' : ''} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="spinner-container">
        <div 
          className="spinner"
          style={{
            width: spinnerSize.width,
            height: spinnerSize.height,
            borderWidth: spinnerSize.borderWidth,
            borderColor: `${color} transparent transparent transparent`
          }}
          aria-hidden="true"
        />
        {message && (
          <p className="spinner-message" aria-hidden="true">
            {message}
          </p>
        )}
      </div>
      {/* Screen reader only text for accessibility */}
      <span className="sr-only">{message}</span>
    </div>
  );
};

LoadingSpinner.propTypes = {
  message: PropTypes.string,
  fullPage: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  color: PropTypes.string,
  className: PropTypes.string
};

export default LoadingSpinner;