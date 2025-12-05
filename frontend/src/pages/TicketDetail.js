import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBoundary from '../components/ErrorBoundary';
import ticketService from '../services/ticketService';
import '../styles/TicketDetail.css';

/**
 * TicketDetail Component
 * 
 * Displays detailed information about a specific ticket including
 * comments, activities, and status updates.
 * 
 * @version 3.0.0
 * @author IT Support Team
 */
const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Validate ticket ID before fetching
  const isValidTicketId = (ticketId) => {
    if (!ticketId || 
        ticketId === 'create' || 
        ticketId === 'undefined' || 
        ticketId === 'null' ||
        ticketId.length < 10) {
      return false;
    }
    
    // Check if it looks like a valid MongoDB ObjectId or UUID
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    return objectIdPattern.test(ticketId) || uuidPattern.test(ticketId);
  };

  useEffect(() => {
    // Check authentication first
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Validate ticket ID
    if (!isValidTicketId(id)) {
      console.error('Invalid ticket ID:', id);
      setError('Invalid ticket ID or ticket not found');
      setLoading(false);
      navigate('/tickets');
      return;
    }

    // Fetch ticket data
    fetchTicketData();
  }, [id, isAuthenticated, navigate]);

  /**
   * Fetches ticket data with error handling
   */
  const fetchTicketData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch ticket details
      const response = await ticketService.getTicket(id);
      
      if (response && response.success) {
        // Extract ticket from response
        const ticketData = response.data?.ticket || response.data || response.ticket || response;
        
        if (ticketData && (ticketData._id || ticketData.id)) {
          setTicket(ticketData);
          
          // Only fetch comments if the endpoint exists
          if (ticketService.getComments && typeof ticketService.getComments === 'function') {
            try {
              const commentsResponse = await ticketService.getComments(id);
              if (commentsResponse && commentsResponse.success) {
                setComments(commentsResponse.data?.comments || 
                           commentsResponse.comments || 
                           commentsResponse.data || 
                           []);
              }
            } catch (commentsError) {
              console.warn('Comments endpoint not available:', commentsError.message);
              // This is not critical, so we don't set an error
            }
          }
        } else {
          throw new Error('Invalid ticket data structure received');
        }
      } else {
        throw new Error(response?.message || 'Failed to load ticket details');
      }
    } catch (error) {
      console.error('Error fetching ticket data:', error);
      
      // Handle specific error cases
      let errorMessage = 'Unable to load ticket. Please try again.';
      
      if (error.response) {
        switch (error.response.status) {
          case 404:
            errorMessage = 'Ticket not found. It may have been deleted.';
            break;
          case 401:
            errorMessage = 'Session expired. Please log in again.';
            navigate('/login');
            break;
          case 403:
            errorMessage = 'You do not have permission to view this ticket.';
            break;
        }
      } else if (error.request) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      }
      
      setError({
        message: errorMessage,
        type: 'fetch',
        retryable: true
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles adding a new comment
   */
  const handleAddComment = async () => {
    if (!newComment.trim() || !ticket) return;
    
    try {
      setSubmittingComment(true);
      
      const commentData = {
        content: newComment.trim(),
        author: user?.id || user?._id,
        isInternal: user?.role === 'technician' || user?.role === 'admin',
        createdAt: new Date().toISOString()
      };
      
      // Check if addComment method exists
      if (ticketService.addComment && typeof ticketService.addComment === 'function') {
        await ticketService.addComment(ticket._id, commentData);
        
        // Refresh comments
        if (ticketService.getComments) {
          try {
            const commentsResponse = await ticketService.getComments(ticket._id);
            if (commentsResponse && commentsResponse.success) {
              setComments(commentsResponse.data?.comments || 
                         commentsResponse.comments || 
                         commentsResponse.data || 
                         []);
            }
          } catch (refreshError) {
            console.warn('Could not refresh comments:', refreshError);
          }
        }
        
        // Add comment locally if refresh fails
        setComments(prev => [commentData, ...prev]);
        setNewComment('');
      } else {
        // Fallback: add comment locally
        setComments(prev => [commentData, ...prev]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      setError({
        message: 'Failed to add comment. Please try again.',
        type: 'comment',
        retryable: false
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  /**
   * Handles status update
   */
  const handleStatusUpdate = async (newStatus) => {
    if (!ticket || updatingStatus) return;
    
    try {
      setUpdatingStatus(true);
      
      if (ticketService.updateTicket && typeof ticketService.updateTicket === 'function') {
        await ticketService.updateTicket(ticket._id, { status: newStatus });
        
        // Update local state
        setTicket(prev => ({
          ...prev,
          status: newStatus,
          updatedAt: new Date().toISOString()
        }));
      } else {
        // Fallback: update local state only
        setTicket(prev => ({
          ...prev,
          status: newStatus,
          updatedAt: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('Error updating ticket status:', error);
      setError({
        message: 'Failed to update ticket status.',
        type: 'status',
        retryable: false
      });
    } finally {
      setUpdatingStatus(false);
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
      const diffHours = diffMs / (1000 * 60 * 60);
      
      if (diffHours < 1) {
        return 'Just now';
      } else if (diffHours < 24) {
        return `${Math.floor(diffHours)}h ago`;
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
   * Gets status display text
   */
  const getStatusText = (status) => {
    const statusMap = {
      'open': 'Open',
      'in-progress': 'In Progress',
      'awaiting-user': 'Awaiting User',
      'resolved': 'Resolved',
      'closed': 'Closed'
    };
    return statusMap[status] || status;
  };

  /**
   * Gets urgency display text
   */
  const getUrgencyText = (urgency) => {
    const urgencyMap = {
      'low': 'Low',
      'medium': 'Medium',
      'high': 'High',
      'critical': 'Critical'
    };
    return urgencyMap[urgency] || urgency;
  };

  /**
   * Handles retry action
   */
  const handleRetry = () => {
    setError(null);
    fetchTicketData();
  };

  // Loading state
  if (loading) {
    return (
      <>
        <Navbar />
        <div className="loading-container">
          <LoadingSpinner 
            message="Loading ticket details..." 
            fullPage={true}
          />
        </div>
      </>
    );
  }

  // Error state
  if (error && !ticket) {
    return (
      <>
        <Navbar />
        <div className="error-container">
          <div className="error-content">
            <h2>Unable to Load Ticket</h2>
            <p className="error-message">{error.message}</p>
            <div className="error-actions">
              {error.retryable && (
                <button onClick={handleRetry} className="btn btn-primary">
                  Try Again
                </button>
              )}
              <button onClick={() => navigate('/tickets')} className="btn btn-secondary">
                Back to Tickets
              </button>
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
            <h2>Ticket Not Found</h2>
            <p>The ticket you're looking for doesn't exist or has been deleted.</p>
            <button onClick={() => navigate('/tickets')} className="btn btn-primary">
              View All Tickets
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <ErrorBoundary>
      <>
        <Navbar />
        <div className="ticket-detail-page">
          {/* Header with ticket info */}
          <div className="ticket-header">
            <div className="ticket-meta">
              <span className="ticket-id">
                Ticket #{ticket.ticketNumber || ticket._id?.substring(0, 8).toUpperCase()}
              </span>
              <span className={`status-badge status-${ticket.status}`}>
                {getStatusText(ticket.status)}
              </span>
              <span className={`urgency-badge urgency-${ticket.urgency}`}>
                {getUrgencyText(ticket.urgency)}
              </span>
            </div>
            
            <div className="ticket-actions">
              {(user?.role === 'technician' || user?.role === 'admin') && (
                <select 
                  className="status-select"
                  value={ticket.status}
                  onChange={(e) => handleStatusUpdate(e.target.value)}
                  disabled={updatingStatus}
                  aria-label="Update ticket status"
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="awaiting-user">Awaiting User</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              )}
              
              <button onClick={() => navigate('/tickets')} className="btn btn-secondary">
                Back to List
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className={`alert alert-${error.type}`}>
              <div className="alert-content">
                <strong>Error:</strong> {error.message}
              </div>
              <div className="alert-actions">
                <button onClick={() => setError(null)} className="btn btn-sm btn-text">
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="ticket-content">
            <div className="ticket-main">
              <h1 className="ticket-title">{ticket.title}</h1>
              
              <div className="ticket-description">
                <h3>Description</h3>
                <div className="description-content">
                  {ticket.description}
                </div>
              </div>
              
              <div className="ticket-info-grid">
                <div className="info-item">
                  <span className="info-label">Issue Type:</span>
                  <span className="info-value">
                    {ticket.issueType?.charAt(0).toUpperCase() + ticket.issueType?.slice(1) || 'Not specified'}
                  </span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">Created:</span>
                  <span className="info-value">{formatDate(ticket.createdAt)}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">Last Updated:</span>
                  <span className="info-value">{formatDate(ticket.updatedAt)}</span>
                </div>
                
                <div className="info-item">
                  <span className="info-label">Created By:</span>
                  <span className="info-value">
                    {ticket.createdBy?.name || ticket.createdBy?.email || 'Unknown'}
                  </span>
                </div>
                
                {ticket.assignedTo && (
                  <div className="info-item">
                    <span className="info-label">Assigned To:</span>
                    <span className="info-value">
                      {ticket.assignedTo?.name || ticket.assignedTo?.email || 'Unassigned'}
                    </span>
                  </div>
                )}
                
                {ticket.category && (
                  <div className="info-item">
                    <span className="info-label">Category:</span>
                    <span className="info-value">{ticket.category}</span>
                  </div>
                )}
                
                {ticket.department && (
                  <div className="info-item">
                    <span className="info-label">Department:</span>
                    <span className="info-value">{ticket.department}</span>
                  </div>
                )}
                
                {ticket.location && (
                  <div className="info-item">
                    <span className="info-label">Location:</span>
                    <span className="info-value">{ticket.location}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Comments section */}
            <div className="comments-section">
              <h3>Activity & Comments</h3>
              
              <div className="comments-list">
                {comments.length === 0 ? (
                  <div className="no-comments">
                    <p>No comments yet. Be the first to add one.</p>
                  </div>
                ) : (
                  comments.map((comment, index) => (
                    <div key={comment._id || index} className="comment-item">
                      <div className="comment-header">
                        <span className="comment-author">
                          {comment.author?.name || comment.author?.email || 'Unknown'}
                        </span>
                        <span className="comment-date">
                          {formatDate(comment.createdAt)}
                        </span>
                        {comment.isInternal && (
                          <span className="internal-badge">Internal Note</span>
                        )}
                      </div>
                      <div className="comment-content">
                        {comment.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Add comment form */}
              <div className="add-comment">
                <h4>Add Comment</h4>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type your comment here..."
                  rows="4"
                  maxLength="2000"
                  aria-label="Add comment"
                />
                <div className="comment-actions">
                  {user?.role === 'technician' || user?.role === 'admin' ? (
                    <div className="internal-note-option">
                      <input 
                        type="checkbox" 
                        id="internal-note"
                        aria-label="Mark as internal note"
                      />
                      <label htmlFor="internal-note">Internal note (visible to staff only)</label>
                    </div>
                  ) : null}
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || submittingComment}
                    className="btn btn-primary"
                  >
                    {submittingComment ? (
                      <>
                        <span className="comment-spinner"></span>
                        Posting...
                      </>
                    ) : (
                      'Post Comment'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    </ErrorBoundary>
  );
};

export default TicketDetail;