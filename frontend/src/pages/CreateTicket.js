// src/pages/CreateTicket.js
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api from '../services/api';
import '../styles/CreateTicket.css'; // Updated path to match your structure

const CreateTicket = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other',
    priority: 'medium',
    campus: user?.campus || 'BU',
    location: '',
    building: '',
    roomNumber: '',
    department: user?.department || 'computer_science'
  });
  
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [characterCount, setCharacterCount] = useState({ title: 0, description: 0 });

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Update character counts
  useEffect(() => {
    setCharacterCount({
      title: formData.title.length,
      description: formData.description.length
    });
  }, [formData.title, formData.description]);

  // Get user's full name
  const getUserName = () => {
    if (!user) return 'User';
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    if (user.firstName) return user.firstName;
    if (user.username) return user.username;
    return user.email?.split('@')[0] || 'User';
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.trim().length < 5) {
      errors.title = 'Title must be at least 5 characters';
    } else if (formData.title.trim().length > 200) {
      errors.title = 'Title cannot exceed 200 characters';
    }
    
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      errors.description = 'Description must be at least 10 characters';
    } else if (formData.description.trim().length > 5000) {
      errors.description = 'Description cannot exceed 5000 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFileUpload = (e) => {
    const uploadedFiles = Array.from(e.target.files);
    
    // Validate file sizes (max 10MB each)
    const validFiles = uploadedFiles.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds 10MB limit`);
        return false;
      }
      return true;
    });
    
    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validate form
    if (!validateForm()) {
      setError('Please fix the errors in the form');
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('📝 Creating ticket with data:', {
        ...formData,
        createdBy: user?._id
      });

      // Create ticket data without files for now
      const ticketData = {
        ...formData,
        createdBy: user?._id
      };

      const response = await api.post('/api/tickets', ticketData);

      console.log('✅ Ticket created successfully:', response);

      if (response.data.success) {
        setSuccess(true);
        
        // Clear form
        setFormData({
          title: '',
          description: '',
          category: 'other',
          priority: 'medium',
          campus: user?.campus || 'BU',
          location: '',
          building: '',
          roomNumber: '',
          department: user?.department || 'computer_science'
        });
        setFiles([]);

        // Auto-redirect after 5 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 5000);
      } else {
        setError(response.data.message || 'Failed to create ticket');
      }
    } catch (err) {
      console.error('❌ Create ticket error:', err);
      
      // Handle specific error types
      if (err.name === 'AuthError') {
        setError('Your session has expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      
      if (err.name === 'NetworkError') {
        setError('Network error. Please check your internet connection and try again.');
        return;
      }
      
      if (err.name === 'APIError') {
        // Handle validation errors from backend
        if (err.status === 422 && err.data?.errors) {
          const backendErrors = {};
          err.data.errors.forEach(error => {
            if (error.field) {
              backendErrors[error.field] = error.message;
            }
          });
          setFormErrors(backendErrors);
          setError('Please fix the validation errors');
        } else {
          setError(err.message || 'An error occurred. Please try again.');
        }
        return;
      }
      
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearError = () => {
    setError('');
  };

  if (!user) {
    return (
      <div className="loading-container">
        <div className="spinner-small"></div>
        <p>Redirecting to login...</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="create-ticket-page">
        <Navbar />
        <div className="success-container">
          <div className="success-icon">🎉</div>
          <h2>Ticket Created Successfully!</h2>
          <p>Your support ticket has been submitted successfully. Our IT team will review it and get back to you soon.</p>
          <p className="redirect-message">Redirecting to dashboard in 5 seconds...</p>
          <div style={{ marginTop: '2rem' }}>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary"
              style={{ marginRight: '1rem' }}
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => setSuccess(false)}
              className="btn-secondary"
            >
              Create Another Ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-ticket-page">
      <Navbar />
      
      <div className="create-ticket-header">
        <h1>Create New Ticket</h1>
        <p>Welcome, <strong>{getUserName()}</strong>. Fill out the form below to report an issue or request assistance.</p>
      </div>
      
      <div className="ticket-form">
        {error && (
          <div className="error-message">
            <span>{error}</span>
            <button onClick={clearError}>&times;</button>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          {/* Title Field */}
          <div className="form-group">
            <label htmlFor="title">
              Issue Title <span className="error-text">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Brief description of the issue"
              maxLength="200"
              disabled={isSubmitting}
            />
            <div className="character-count">
              {characterCount.title}/200 characters
            </div>
            {formErrors.title && (
              <div className="error-text">{formErrors.title}</div>
            )}
          </div>
          
          {/* Description Field */}
          <div className="form-group">
            <label htmlFor="description">
              Detailed Description <span className="error-text">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Please provide as much detail as possible:
- What is the issue?
- When did it start?
- What have you tried?
- Any error messages?"
              maxLength="5000"
              disabled={isSubmitting}
            />
            <div className="character-count">
              {characterCount.description}/5000 characters
            </div>
            {formErrors.description && (
              <div className="error-text">{formErrors.description}</div>
            )}
          </div>
          
          <div className="form-row">
            {/* Category Field */}
            <div className="form-group">
              <label htmlFor="category">
                Category <span className="error-text">*</span>
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="network">🌐 Network Issues</option>
                <option value="software">💻 Software Issues</option>
                <option value="hardware">🔧 Hardware Issues</option>
                <option value="account">👤 Account Issues</option>
                <option value="email">📧 Email Issues</option>
                <option value="website">🌍 Website Issues</option>
                <option value="other">❓ Other Issues</option>
              </select>
            </div>
            
            {/* Priority Field */}
            <div className="form-group">
              <label htmlFor="priority">
                Priority <span className="error-text">*</span>
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="low">🟢 Low (Response within 72 hours)</option>
                <option value="medium">🟡 Medium (Response within 24 hours)</option>
                <option value="high">🟠 High (Response within 8 hours)</option>
                <option value="critical">🔴 Critical (Response within 4 hours)</option>
              </select>
              <div className="urgency-help">
                Higher priority tickets get faster response times
              </div>
            </div>
          </div>
          
          {/* Campus Field */}
          <div className="form-group">
            <label htmlFor="campus">
              Campus Location <span className="error-text">*</span>
            </label>
            <select
              id="campus"
              name="campus"
              value={formData.campus}
              onChange={handleChange}
              disabled={isSubmitting}
            >
              <option value="BU">🏛️ Main Campus (BU) - Luweero</option>
              <option value="MA">🏢 Mabanga Campus (MA)</option>
              <option value="KA">🏙️ Kampala Campus (KA)</option>
              <option value="AR">🏘️ Arua Campus (AR)</option>
              <option value="MB">🏢 Mbarara Campus (MB)</option>
              <option value="OTHER">📍 Other Location</option>
            </select>
          </div>
          
          <div className="form-row">
            {/* Building Field */}
            <div className="form-group">
              <label htmlFor="building">Building (Optional)</label>
              <input
                type="text"
                id="building"
                name="building"
                value={formData.building}
                onChange={handleChange}
                placeholder="e.g., Library, Admin Block"
                disabled={isSubmitting}
              />
            </div>
            
            {/* Room Number Field */}
            <div className="form-group">
              <label htmlFor="roomNumber">Room Number (Optional)</label>
              <input
                type="text"
                id="roomNumber"
                name="roomNumber"
                value={formData.roomNumber}
                onChange={handleChange}
                placeholder="e.g., 101, Lab 3"
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          {/* Location Field */}
          <div className="form-group">
            <label htmlFor="location">Specific Location (Optional)</label>
            <input
              type="text"
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g., 2nd floor computer lab, front desk"
              disabled={isSubmitting}
            />
            <div className="urgency-help">
              Help our technicians find you quickly
            </div>
          </div>
          
          {/* File Upload */}
          <div className="form-group">
            <label>Attachments (Optional)</label>
            <div className="file-upload-area">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt"
                disabled={isSubmitting}
              />
              <div className="upload-prompt">
                <div className="upload-icon">📎</div>
                <p>Drag & drop files here or click to browse</p>
                <div className="upload-help">
                  Supports JPG, PNG, PDF, DOC, TXT (Max 10MB each)
                </div>
              </div>
            </div>
            
            {files.length > 0 && (
              <div className="file-list">
                <h4>Selected Files ({files.length})</h4>
                {files.map((file, index) => (
                  <div key={index} className="file-item">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      className="remove-file"
                      onClick={() => removeFile(index)}
                      disabled={isSubmitting}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Form Help Section */}
          <div className="form-help">
            <p>📋 Tips for a better ticket:</p>
            <ul>
              <li>Be specific and include all relevant details</li>
              <li>Include error messages or screenshots if available</li>
              <li>Specify when the issue started and how often it occurs</li>
              <li>Mention any troubleshooting steps you've already tried</li>
              <li>Provide your contact information if different from profile</li>
            </ul>
          </div>
          
          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/dashboard')}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-small"></span>
                  Creating Ticket...
                </>
              ) : (
                'Submit Ticket'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTicket;