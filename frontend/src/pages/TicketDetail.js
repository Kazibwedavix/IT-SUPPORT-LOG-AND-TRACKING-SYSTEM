/**
 * TicketDetail Component - Production Ready
 * 
 * Comprehensive ticket detail view with real-time updates, comments,
 * activity tracking, and full CRUD operations.
 * 
 * Features:
 * - Real ticket data fetching from API
 * - Comments system with internal/external notes
 * - Ticket status management
 * - Role-based permissions
 * - Comprehensive error handling
 * - Activity timeline
 * - SLA tracking
 * - File attachment support
 * 
 * @version 4.0.0
 * @author Bugema University IT Support Team
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBoundary from '../components/ErrorBoundary';
import ticketService from '../services/ticketService';
import userService from '../services/userService';
import '../styles/TicketDetail.css';

const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  
  // State Management
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [assigningTicket, setAssigningTicket] = useState(false);
  const [availableTechnicians, setAvailableTechnicians] = useState([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Refs
  const fileInputRef = useRef(null);
  const refreshIntervalRef = useRef(null);
  const abortControllerRef = useRef(null);

  /**
   * Validates ticket ID format
   */
  const isValidTicketId = useCallback((ticketId) => {
    if (!ticketId || 
        ticketId === 'create' || 
        ticketId === 'undefined' || 
        ticketId === 'null' ||
        ticketId.length < 12) {
      return false;
    }
    
    // Check if it's a MongoDB ObjectId (24 hex chars) or ticketId format
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    const ticketIdPattern = /^TKT-\d{4}-\d{4}$/;
    
    return objectIdPattern.test(ticketId) || ticketIdPattern.test(ticketId);
  }, []);

  /**
   * Checks if user has permission to view/edit ticket
   */
  const hasPermission = useCallback(() => {
    if (!ticket || !user) return false;
    
    const isOwner = ticket.createdBy?._id === user._id || 
                    ticket.createdBy?._id === user.id;
    const isAssigned = ticket.assignedTo?._id === user._id || 
                       ticket.assignedTo?._id === user.id;
    const isAdminOrTech = ['admin', 'technician'].includes(user.role);
    
    return isOwner || isAssigned || isAdminOrTech;
  }, [ticket, user]);

  /**
   * Fetches ticket data with comprehensive error handling
   */
  const fetchTicketData = useCallback(async () => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);
      
      console.log(`🎫 [TICKET DETAIL] Fetching ticket: ${id}`);
      
      if (!isValidTicketId(id)) {
        throw new Error('INVALID_TICKET_ID', {
          cause: { ticketId: id }
        });
      }

      // Fetch ticket details
      const ticketResponse = await ticketService.getTicket(id);
      
      if (!ticketResponse || !ticketResponse.success) {
        throw new Error(ticketResponse?.message || 'TICKET_FETCH_FAILED');
      }

      const ticketData = ticketResponse.data;
      
      if (!ticketData || !ticketData._id) {
        throw new Error('INVALID_TICKET_DATA');
      }

      // Check permissions
      if (!hasPermission()) {
        throw new Error('PERMISSION_DENIED');
      }

      setTicket(ticketData);
      
      // Fetch comments if endpoint exists
      if (ticketService.getComments) {
        try {
          const commentsResponse = await ticketService.getComments(ticketData._id);
          if (commentsResponse?.success) {
            const commentData = commentsResponse.data?.comments || 
                               commentsResponse.comments || 
                               commentsResponse.data || 
                               [];
            setComments(Array.isArray(commentData) ? commentData : []);
          }
        } catch (commentError) {
          console.warn('Comments fetch failed:', commentError.message);
        }
      }

      // Fetch activities if endpoint exists
      if (ticketService.getActivities) {
        try {
          const activitiesResponse = await ticketService.getActivities(ticketData._id);
          if (activitiesResponse?.success) {
            const activityData = activitiesResponse.data?.activities || 
                                activitiesResponse.activities || 
                                activitiesResponse.data || 
                                [];
            setActivities(Array.isArray(activityData) ? activityData : []);
          }
        } catch (activityError) {
          console.warn('Activities fetch failed:', activityError.message);
        }
      }

      // Fetch available technicians for assignment
      if (['admin', 'technician'].includes(user?.role)) {
        try {
          const techResponse = await ticketService.getAvailableTechnicians();
          if (techResponse?.success) {
            setAvailableTechnicians(techResponse.data || []);
          }
        } catch (techError) {
          console.warn('Technicians fetch failed:', techError.message);
        }
      }

      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('❌ [TICKET DETAIL ERROR]:', error);
      
      // Handle specific error cases
      let errorMessage = 'Unable to load ticket details.';
      let errorType = 'fetch';
      let retryable = true;
      let action = null;

      if (error.name === 'AbortError') {
        return; // Request was cancelled, do nothing
      } else if (error.message === 'INVALID_TICKET_ID') {
        errorMessage = 'Invalid ticket ID format.';
        retryable = false;
        action = () => navigate('/tickets');
      } else if (error.message === 'PERMISSION_DENIED') {
        errorMessage = 'You do not have permission to view this ticket.';
        retryable = false;
        action = () => navigate('/tickets');
      } else if (error.response?.status === 401) {
        errorMessage = 'Session expired. Please log in again.';
        retryable = false;
        logout();
        action = () => navigate('/login');
      } else if (error.response?.status === 403) {
        errorMessage = 'Access forbidden. Insufficient permissions.';
        retryable = false;
        action = () => navigate('/tickets');
      } else if (error.response?.status === 404) {
        errorMessage = 'Ticket not found. It may have been deleted.';
        retryable = false;
        action = () => navigate('/tickets');
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMessage = 'Request timeout. Please check your connection.';
      } else if (!error.response) {
        errorMessage = 'Network error. Please check your internet connection.';
      }

      setError({
        message: errorMessage,
        type: errorType,
        retryable,
        action
      });
      
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [id, isValidTicketId, user?.role, navigate, logout]);

  /**
   * Handles adding a new comment
   */
  const handleAddComment = async () => {
    if (!newComment.trim() || !ticket) return;
    
    try {
      setSubmittingComment(true);
      
      const commentData = {
        message: newComment.trim(),
        isInternal: isInternalNote,
        attachments: []
      };

      const response = await ticketService.addComment(ticket._id, commentData);
      
      if (response?.success) {
        // Add new comment to list
        const newCommentData = {
          ...response.data?.comment || commentData,
          user: user,
          createdAt: new Date().toISOString()
        };
        
        setComments(prev => [newCommentData, ...prev]);
        setNewComment('');
        setIsInternalNote(false);
        
        // Update ticket's last updated timestamp
        setTicket(prev => ({
          ...prev,
          updatedAt: new Date().toISOString()
        }));
      }
      
    } catch (error) {
      console.error('❌ [ADD COMMENT ERROR]:', error);
      setError({
        message: 'Failed to add comment. Please try again.',
        type: 'comment',
        retryable: true
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  /**
   * Handles ticket status update
   */
  const handleStatusUpdate = async (newStatus) => {
    if (!ticket || updatingStatus) return;
    
    try {
      setUpdatingStatus(true);
      
      const updates = { 
        status: newStatus,
        changeReason: `Status changed to ${newStatus} by ${user?.name}`
      };
      
      // Set resolved/closed timestamps
      if (newStatus === 'resolved' && ticket.status !== 'resolved') {
        updates.resolvedAt = new Date().toISOString();
      } else if (newStatus === 'closed' && ticket.status !== 'closed') {
        updates.closedAt = new Date().toISOString();
      }
      
      const response = await ticketService.updateTicket(ticket._id, updates);
      
      if (response?.success) {
        // Update local state
        setTicket(prev => ({
          ...prev,
          status: newStatus,
          updatedAt: new Date().toISOString(),
          ...(updates.resolvedAt && { resolvedAt: updates.resolvedAt }),
          ...(updates.closedAt && { closedAt: updates.closedAt })
        }));
        
        // Add to activities
        const activity = {
          action: 'STATUS_UPDATE',
          description: `Status changed from ${ticket.status} to ${newStatus}`,
          user: user,
          timestamp: new Date().toISOString()
        };
        setActivities(prev => [activity, ...prev]);
      }
      
    } catch (error) {
      console.error('❌ [STATUS UPDATE ERROR]:', error);
      setError({
        message: 'Failed to update ticket status.',
        type: 'status',
        retryable: true
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  /**
   * Handles ticket assignment
   */
  const handleAssignTicket = async (technicianId) => {
    if (!ticket || assigningTicket) return;
    
    try {
      setAssigningTicket(true);
      
      const updates = {
        assignedTo: technicianId,
        status: 'in-progress',
        changeReason: `Ticket assigned to technician by ${user?.name}`
      };
      
      const response = await ticketService.updateTicket(ticket._id, updates);
      
      if (response?.success) {
        // Find technician details
        const technician = availableTechnicians.find(t => t._id === technicianId);
        
        // Update local state
        setTicket(prev => ({
          ...prev,
          assignedTo: technician,
          status: 'in-progress',
          updatedAt: new Date().toISOString()
        }));
        
        // Add to activities
        const activity = {
          action: 'ASSIGNED',
          description: `Ticket assigned to ${technician?.name || 'technician'}`,
          user: user,
          timestamp: new Date().toISOString()
        };
        setActivities(prev => [activity, ...prev]);
        
        setShowAssignDropdown(false);
      }
      
    } catch (error) {
      console.error('❌ [ASSIGNMENT ERROR]:', error);
      setError({
        message: 'Failed to assign ticket.',
        type: 'assignment',
        retryable: true
      });
    } finally {
      setAssigningTicket(false);
    }
  };

  /**
   * Handles file attachment upload
   */
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length || !ticket) return;
    
    try {
      setUploadingAttachment(true);
      
      for (const file of files) {
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File ${file.name} exceeds 10MB limit`);
        }
        
        // Validate file type
        const allowedTypes = [
          'image/jpeg', 'image/png', 'image/gif', 'application/pdf',
          'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`File type ${file.type} not allowed`);
        }
        
        if (ticketService.uploadAttachment) {
          const response = await ticketService.uploadAttachment(ticket._id, file);
          
          if (response?.success) {
            setAttachments(prev => [...prev, response.data?.attachment || {
              fileName: file.name,
              fileUrl: URL.createObjectURL(file),
              fileType: file.type,
              fileSize: file.size,
              uploadedAt: new Date().toISOString()
            }]);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ [FILE UPLOAD ERROR]:', error);
      setError({
        message: error.message || 'Failed to upload file.',
        type: 'upload',
        retryable: true
      });
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * Formats date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffHours < 1) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`;
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      return 'Invalid date';
    }
  };

  /**
   * Gets SLA status color
   */
  const getSLAStatus = (dueDate, status) => {
    if (['resolved', 'closed'].includes(status)) return 'completed';
    if (!dueDate) return 'no-sla';
    
    const now = new Date();
    const due = new Date(dueDate);
    const timeRemaining = due - now;
    
    if (timeRemaining < 0) return 'breached';
    if (timeRemaining < 60 * 60 * 1000) return 'critical'; // < 1 hour
    if (timeRemaining < 4 * 60 * 60 * 1000) return 'warning'; // < 4 hours
    return 'normal';
  };

  /**
   * Gets status display configuration
   */
  const getStatusConfig = (status) => {
    const config = {
      open: { label: 'Open', color: '#3b82f6', icon: '⭕' },
      'in-progress': { label: 'In Progress', color: '#f59e0b', icon: '🔄' },
      pending: { label: 'Pending', color: '#8b5cf6', icon: '⏸️' },
      resolved: { label: 'Resolved', color: '#10b981', icon: '✅' },
      closed: { label: 'Closed', color: '#6b7280', icon: '🔒' }
    };
    return config[status] || { label: status, color: '#6b7280', icon: '❓' };
  };

  /**
   * Gets priority display configuration
   */
  const getPriorityConfig = (priority) => {
    const config = {
      low: { label: 'Low', color: '#059669', icon: '🟢' },
      medium: { label: 'Medium', color: '#d97706', icon: '🟡' },
      high: { label: 'High', color: '#ea580c', icon: '🟠' },
      critical: { label: 'Critical', color: '#dc2626', icon: '🔴' }
    };
    return config[priority] || { label: priority, color: '#6b7280', icon: '❓' };
  };

  /**
   * Handles retry action
   */
  const handleRetry = () => {
    setError(null);
    fetchTicketData();
  };

  // Set up auto-refresh for ticket updates
  useEffect(() => {
    if (ticket && ['open', 'in-progress', 'pending'].includes(ticket.status)) {
      refreshIntervalRef.current = setInterval(() => {
        fetchTicketData();
      }, 30000); // Refresh every 30 seconds for active tickets
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [ticket, fetchTicketData]);

  // Initial data fetch
  useEffect(() => {
    // Check authentication
    if (!isAuthenticated) {
      navigate('/login', { 
        state: { from: `/tickets/${id}` },
        replace: true 
      });
      return;
    }

    // Validate ticket ID
    if (!isValidTicketId(id)) {
      console.error('Invalid ticket ID:', id);
      setError({
        message: 'Invalid ticket ID or ticket not found',
        type: 'validation',
        retryable: false,
        action: () => navigate('/tickets')
      });
      setLoading(false);
      return;
    }

    // Fetch data
    fetchTicketData();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [id, isAuthenticated, navigate, isValidTicketId, fetchTicketData]);

  // Loading state
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="loading-container">
          <LoadingSpinner 
            message="Loading ticket details..." 
            fullPage={true}
            progress={true}
          />
        </div>
      </>
    );
  }

    // Error state (no ticket)
  if (error && !ticket) {
    const isBackToTicketsAction = error.action && 
      error.action.toString().includes('navigate') && 
      error.action.toString().includes('/tickets');
    
    return (
      <>
        <Navbar />
        <div className="error-container">
          <div className="error-content">
            <div className="error-icon">❌</div>
            <h2>Unable to Load Ticket</h2>
            <p className="error-message">{error.message}</p>
            <div className="error-actions">
              {error.retryable && (
                <button 
                  onClick={handleRetry} 
                  className="btn btn-primary"
                  aria-label="Retry loading ticket"
                >
                  Try Again
                </button>
              )}
              {error.action ? (
                <button 
                  onClick={error.action} 
                  className="btn btn-secondary"
                  aria-label={isBackToTicketsAction ? 'Back to tickets' : 'Take action'}
                >
                  {isBackToTicketsAction ? 'Back to Tickets' : 'Take Action'}
                </button>
              ) : (
                <button 
                  onClick={() => navigate('/tickets')} 
                  className="btn btn-secondary"
                  aria-label="Back to tickets"
                >
                  Back to Tickets
                </button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // No ticket found
  if (!ticket) {
    return (
      <>
        <Navbar />
        <div className="not-found">
          <div className="not-found-content">
            <div className="not-found-icon">🔍</div>
            <h2>Ticket Not Found</h2>
            <p>The ticket you're looking for doesn't exist or has been deleted.</p>
            <button 
              onClick={() => navigate('/tickets')} 
              className="btn btn-primary"
              aria-label="View all tickets"
            >
              View All Tickets
            </button>
          </div>
        </div>
      </>
    );
  }

  // Check permissions
  if (!hasPermission()) {
    return (
      <>
        <Navbar />
        <div className="permission-denied">
          <div className="permission-content">
            <div className="permission-icon">🚫</div>
            <h2>Access Denied</h2>
            <p>You do not have permission to view this ticket.</p>
            <button 
              onClick={() => navigate('/tickets')} 
              className="btn btn-primary"
              aria-label="Back to tickets"
            >
              Back to Tickets
            </button>
          </div>
        </div>
      </>
    );
  }

  const statusConfig = getStatusConfig(ticket.status);
  const priorityConfig = getPriorityConfig(ticket.priority);
  const slaStatus = getSLAStatus(ticket.slaDueDate, ticket.status);

  return (
    <ErrorBoundary>
      <>
        <Navbar />
        <div className="ticket-detail-page">
          {/* Header Section */}
          <header className="ticket-header">
            <div className="header-main">
              <div className="ticket-meta">
                <h1 className="ticket-title">{ticket.title}</h1>
                <div className="meta-tags">
                  <span className="ticket-id">
                    <strong>ID:</strong> {ticket.ticketId || `TKT-${ticket._id?.substring(0, 8).toUpperCase()}`}
                  </span>
                  <span 
                    className="status-badge" 
                    style={{ backgroundColor: statusConfig.color }}
                    aria-label={`Status: ${statusConfig.label}`}
                  >
                    <span className="status-icon">{statusConfig.icon}</span>
                    {statusConfig.label}
                  </span>
                  <span 
                    className="priority-badge" 
                    style={{ backgroundColor: priorityConfig.color }}
                    aria-label={`Priority: ${priorityConfig.label}`}
                  >
                    <span className="priority-icon">{priorityConfig.icon}</span>
                    {priorityConfig.label}
                  </span>
                  {ticket.slaDueDate && (
                    <span className={`sla-badge sla-${slaStatus}`}>
                      <span className="sla-icon">
                        {slaStatus === 'breached' ? '⏰' : 
                         slaStatus === 'critical' ? '🚨' : 
                         slaStatus === 'warning' ? '⚠️' : '✅'}
                      </span>
                      SLA: {formatDate(ticket.slaDueDate)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="header-actions">
                {['admin', 'technician'].includes(user?.role) && (
                  <div className="action-group">
                    {/* Status Update */}
                    <select 
                      className="action-select status-select"
                      value={ticket.status}
                      onChange={(e) => handleStatusUpdate(e.target.value)}
                      disabled={updatingStatus}
                      aria-label="Update ticket status"
                    >
                      <option value="open">Open</option>
                      <option value="in-progress">In Progress</option>
                      <option value="pending">Pending</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    
                    {/* Assignment */}
                    <div className="assign-dropdown">
                      <button 
                        className="action-btn assign-btn"
                        onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                        disabled={assigningTicket}
                        aria-label="Assign ticket"
                      >
                        {assigningTicket ? 'Assigning...' : 
                         ticket.assignedTo ? 'Reassign' : 'Assign'}
                      </button>
                      
                      {showAssignDropdown && (
                        <div className="dropdown-menu">
                          <div className="dropdown-header">
                            <strong>Assign to:</strong>
                          </div>
                          {availableTechnicians.length > 0 ? (
                            availableTechnicians.map(tech => (
                              <button
                                key={tech._id}
                                className="dropdown-item"
                                onClick={() => handleAssignTicket(tech._id)}
                                aria-label={`Assign to ${tech.name}`}
                              >
                                <span className="tech-name">{tech.name}</span>
                                <span className="tech-role">{tech.role}</span>
                              </button>
                            ))
                          ) : (
                            <div className="dropdown-empty">
                              No technicians available
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="action-group">
                  <button 
                    onClick={() => navigate('/tickets')} 
                    className="btn btn-secondary"
                    aria-label="Back to tickets list"
                  >
                    ← Back to List
                  </button>
                  
                  {lastUpdated && (
                    <span className="last-updated">
                      Updated: {formatDate(lastUpdated)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Error Display */}
          {error && (
            <div className={`alert alert-${error.type}`}>
              <div className="alert-content">
                <strong>Error:</strong> {error.message}
              </div>
              <div className="alert-actions">
                {error.retryable && (
                  <button onClick={handleRetry} className="btn btn-sm">
                    Retry
                  </button>
                )}
                <button 
                  onClick={() => setError(null)} 
                  className="btn btn-sm btn-text"
                  aria-label="Dismiss error"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Main Content */}
          <main className="ticket-content">
            {/* Left Column: Ticket Details */}
            <div className="ticket-main">
              {/* Description */}
              <section className="ticket-description" aria-label="Ticket description">
                <h2 className="section-title">Description</h2>
                <div className="description-content">
                  {ticket.description || 'No description provided.'}
                </div>
              </section>

              {/* Ticket Information */}
              <section className="ticket-info" aria-label="Ticket information">
                <h2 className="section-title">Ticket Information</h2>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Created</span>
                    <span className="info-value">{formatDate(ticket.createdAt)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Last Updated</span>
                    <span className="info-value">{formatDate(ticket.updatedAt)}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Category</span>
                    <span className="info-value">{ticket.category || 'Not specified'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Sub Category</span>
                    <span className="info-value">{ticket.subCategory || 'Not specified'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Campus</span>
                    <span className="info-value">{ticket.campus || 'Not specified'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Location</span>
                    <span className="info-value">{ticket.location || 'Not specified'}</span>
                  </div>
                  {ticket.createdBy && (
                    <div className="info-item">
                      <span className="info-label">Created By</span>
                      <div className="user-info">
                        <span className="user-name">
                          {ticket.createdBy.name || 
                           `${ticket.createdBy.firstName} ${ticket.createdBy.lastName}`}
                        </span>
                        <span className="user-email">{ticket.createdBy.email}</span>
                        <span className="user-role">{ticket.createdBy.role}</span>
                      </div>
                    </div>
                  )}
                  {ticket.assignedTo && (
                    <div className="info-item">
                      <span className="info-label">Assigned To</span>
                      <div className="user-info">
                        <span className="user-name">
                          {ticket.assignedTo.name || 
                           `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`}
                        </span>
                        <span className="user-email">{ticket.assignedTo.email}</span>
                        <span className="user-role">{ticket.assignedTo.role}</span>
                      </div>
                    </div>
                  )}
                  {ticket.resolvedAt && (
                    <div className="info-item">
                      <span className="info-label">Resolved</span>
                      <span className="info-value">{formatDate(ticket.resolvedAt)}</span>
                    </div>
                  )}
                  {ticket.closedAt && (
                    <div className="info-item">
                      <span className="info-label">Closed</span>
                      <span className="info-value">{formatDate(ticket.closedAt)}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Attachments */}
              {(attachments.length > 0 || user?.role === 'technician' || user?.role === 'admin') && (
                <section className="ticket-attachments" aria-label="Ticket attachments">
                  <h2 className="section-title">
                    Attachments
                    {['technician', 'admin'].includes(user?.role) && (
                      <button 
                        className="btn-link"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAttachment}
                        aria-label="Add attachment"
                      >
                        + Add
                      </button>
                    )}
                  </h2>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                    style={{ display: 'none' }}
                    aria-label="Upload file"
                  />
                  
                  {uploadingAttachment && (
                    <div className="uploading">
                      <LoadingSpinner message="Uploading..." size="small" />
                    </div>
                  )}
                  
                  {attachments.length > 0 ? (
                    <div className="attachments-list">
                      {attachments.map((file, index) => (
                        <div key={index} className="attachment-item">
                          <div className="attachment-icon">
                            {file.fileType?.startsWith('image/') ? '🖼️' : 
                             file.fileType === 'application/pdf' ? '📄' : 
                             file.fileType?.includes('word') ? '📝' : 
                             file.fileType?.includes('excel') ? '📊' : '📎'}
                          </div>
                          <div className="attachment-info">
                            <a 
                              href={file.fileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="attachment-name"
                              aria-label={`Download ${file.fileName}`}
                            >
                              {file.fileName}
                            </a>
                            <span className="attachment-size">
                              {(file.fileSize / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-attachments">No attachments yet.</p>
                  )}
                </section>
              )}
            </div>

            {/* Right Column: Activity & Comments */}
            <div className="ticket-sidebar">
              {/* Comments Section */}
              <section className="comments-section" aria-label="Comments and activity">
                <h2 className="section-title">Activity & Comments</h2>
                
                {/* Activities Timeline */}
                {activities.length > 0 && (
                  <div className="activities-timeline">
                    {activities.slice(0, 5).map((activity, index) => (
                      <div key={index} className="activity-item">
                        <div className="activity-icon">
                          {activity.action === 'STATUS_UPDATE' ? '🔄' :
                           activity.action === 'ASSIGNED' ? '👤' :
                           activity.action === 'COMMENT_ADDED' ? '💬' : '📝'}
                        </div>
                        <div className="activity-content">
                          <p className="activity-description">{activity.description}</p>
                          <div className="activity-meta">
                            <span className="activity-user">{activity.user?.name}</span>
                            <span className="activity-time">{formatDate(activity.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Comments List */}
                <div className="comments-list">
                  {comments.length === 0 ? (
                    <div className="no-comments">
                      <p>No comments yet. Be the first to add one.</p>
                    </div>
                  ) : (
                    comments.slice(0, 10).map((comment, index) => (
                      <div 
                        key={comment._id || index} 
                        className={`comment-item ${comment.isInternal ? 'internal' : ''}`}
                      >
                        <div className="comment-header">
                          <div className="comment-author">
                            <span className="author-name">
                              {comment.user?.name || 
                               `${comment.user?.firstName} ${comment.user?.lastName}` ||
                               'Unknown User'}
                            </span>
                            <span className="author-role">{comment.user?.role}</span>
                          </div>
                          <div className="comment-meta">
                            <span className="comment-date">{formatDate(comment.createdAt)}</span>
                            {comment.isInternal && (
                              <span className="internal-badge" aria-label="Internal note">
                                Internal
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="comment-content">
                          {comment.message || comment.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {/* Add Comment Form */}
                <div className="add-comment">
                  <h3 className="form-title">Add Comment</h3>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Type your comment here..."
                    rows="4"
                    maxLength="2000"
                    aria-label="Comment text"
                    disabled={submittingComment}
                  />
                  
                  <div className="comment-actions">
                    {['technician', 'admin'].includes(user?.role) && (
                      <div className="internal-note-option">
                        <input
                          type="checkbox"
                          id="internal-note"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          aria-label="Mark as internal note"
                          disabled={submittingComment}
                        />
                        <label htmlFor="internal-note">
                          Internal note (staff only)
                        </label>
                      </div>
                    )}
                    
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || submittingComment}
                      className="btn btn-primary"
                      aria-label="Post comment"
                    >
                      {submittingComment ? (
                        <>
                          <LoadingSpinner size="small" />
                          Posting...
                        </>
                      ) : (
                        'Post Comment'
                      )}
                    </button>
                  </div>
                  
                  <div className="comment-help">
                    <small>Comments can be marked as internal for staff communication only.</small>
                  </div>
                </div>
              </section>
            </div>
          </main>

          {/* Footer */}
          <footer className="ticket-footer">
            <div className="footer-content">
              <div className="footer-info">
                <span className="ticket-age">
                  Ticket created {formatDate(ticket.createdAt)}
                </span>
                {ticket.slaDueDate && slaStatus !== 'completed' && (
                  <span className={`sla-status sla-${slaStatus}`}>
                    {slaStatus === 'breached' ? 'SLA Breached' :
                     slaStatus === 'critical' ? 'SLA Critical' :
                     slaStatus === 'warning' ? 'SLA Warning' : 'SLA On Track'}
                  </span>
                )}
              </div>
              
              <div className="footer-actions">
                <button 
                  onClick={fetchTicketData} 
                  className="btn btn-text"
                  aria-label="Refresh ticket data"
                >
                  ↻ Refresh
                </button>
              </div>
            </div>
          </footer>
        </div>
      </>
    </ErrorBoundary>
  );
};

export default TicketDetail;