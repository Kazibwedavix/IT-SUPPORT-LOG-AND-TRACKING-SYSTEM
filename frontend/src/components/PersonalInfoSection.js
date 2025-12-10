import React, { memo } from 'react';

const PersonalInfoSection = memo(({ 
  formData, 
  validationErrors, 
  isPersonalEmail, 
  isFormDisabled, 
  onFieldChange 
}) => (
  <div className="form-section">
    <h3 className="section-title">
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
      Personal Information
    </h3>
    
    {/* Username Field */}
    <div className="form-group">
      <label htmlFor="username" className="form-label">
        Username <span className="required">*</span>
      </label>
      <div className={`input-group ${validationErrors.username ? 'error' : ''}`}>
        <div className="input-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          value={formData.username}
          onChange={(e) => onFieldChange('username', e.target.value)}
          disabled={isFormDisabled}
          placeholder="Choose a username"
          className="form-input"
          aria-describedby={validationErrors.username ? "username-error" : undefined}
          aria-required="true"
          aria-invalid={!!validationErrors.username}
        />
      </div>
      {validationErrors.username && (
        <div id="username-error" className="error-text" role="alert">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {validationErrors.username}
        </div>
      )}
      <div className="info-note info">
        <p>3-30 characters. Use letters, numbers, underscores, and hyphens only.</p>
      </div>
    </div>
    
    {/* Email Field */}
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
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={(e) => onFieldChange('email', e.target.value)}
          disabled={isFormDisabled}
          placeholder="your.email@bugema.ac.ug"
          className="form-input"
          aria-describedby={validationErrors.email ? "email-error" : undefined}
          aria-required="true"
          aria-invalid={!!validationErrors.email}
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
      <div className={`info-note ${isPersonalEmail ? 'warning' : 'info'}`}>
        <div className="note-content">
          {isPersonalEmail ? (
            <p>
              <strong>Note:</strong> Using personal email. For official communication, 
              use your university email (<strong>@bugemauniv.ac.ug</strong>).
            </p>
          ) : (
            <p>✅ Verified Bugema University email address</p>
          )}
        </div>
      </div>
    </div>

    {/* First Name Field */}
    <div className="form-group">
      <label htmlFor="firstName" className="form-label">
        First Name <span className="required">*</span>
      </label>
      <div className={`input-group ${validationErrors.firstName ? 'error' : ''}`}>
        <div className="input-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
        <input
          id="firstName"
          name="firstName"
          type="text"
          autoComplete="given-name"
          value={formData.firstName}
          onChange={(e) => onFieldChange('firstName', e.target.value)}
          disabled={isFormDisabled}
          placeholder="Enter your first name"
          className="form-input"
          aria-describedby={validationErrors.firstName ? "firstName-error" : undefined}
          aria-required="true"
          aria-invalid={!!validationErrors.firstName}
        />
      </div>
      {validationErrors.firstName && (
        <div id="firstName-error" className="error-text" role="alert">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {validationErrors.firstName}
        </div>
      )}
    </div>

    {/* Last Name Field */}
    <div className="form-group">
      <label htmlFor="lastName" className="form-label">
        Last Name <span className="required">*</span>
      </label>
      <div className={`input-group ${validationErrors.lastName ? 'error' : ''}`}>
        <div className="input-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
        <input
          id="lastName"
          name="lastName"
          type="text"
          autoComplete="family-name"
          value={formData.lastName}
          onChange={(e) => onFieldChange('lastName', e.target.value)}
          disabled={isFormDisabled}
          placeholder="Enter your last name"
          className="form-input"
          aria-describedby={validationErrors.lastName ? "lastName-error" : undefined}
          aria-required="true"
          aria-invalid={!!validationErrors.lastName}
        />
      </div>
      {validationErrors.lastName && (
        <div id="lastName-error" className="error-text" role="alert">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {validationErrors.lastName}
        </div>
      )}
    </div>

    {/* Phone Field */}
    <div className="form-group">
      <label htmlFor="phone" className="form-label">
        Phone Number
      </label>
      <div className={`input-group ${validationErrors.phone ? 'error' : ''}`}>
        <div className="input-icon">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
          </svg>
        </div>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={formData.phone}
          onChange={(e) => onFieldChange('phone', e.target.value)}
          disabled={isFormDisabled}
          placeholder="+256 XXX XXX XXX"
          className="form-input"
          aria-describedby={validationErrors.phone ? "phone-error" : undefined}
          aria-invalid={!!validationErrors.phone}
        />
      </div>
      {validationErrors.phone && (
        <div id="phone-error" className="error-text" role="alert">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {validationErrors.phone}
        </div>
      )}
    </div>
  </div>
));

PersonalInfoSection.displayName = 'PersonalInfoSection';
export default PersonalInfoSection;