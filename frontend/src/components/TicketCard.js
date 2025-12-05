import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/TicketCard.css';

const TicketCard = ({ ticket, selectable = false, selected = false, onSelect }) => {
  const [isHovered, setIsHovered] = useState(false);

  const getStatusClass = (status) => {
    const statusMap = {
      'new': 'status-new',
      'open': 'status-open',
      'in-progress': 'status-in-progress',
      'awaiting-user': 'status-awaiting-user',
      'resolved': 'status-resolved',
      'closed': 'status-closed'
    };
    return statusMap[status] || '';
  };

  const getUrgencyClass = (urgency) => {
    const urgencyMap = {
      'low': 'urgency-low',
      'medium': 'urgency-medium',
      'high': 'urgency-high',
      'critical': 'urgency-critical'
    };
    return urgencyMap[urgency] || '';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSLAStatus = (createdAt, urgency) => {
    const created = new Date(createdAt);
    const now = new Date();
    const hoursDiff = (now - created) / (1000 * 60 * 60);
    
    const SLATimes = {
      critical: 4,
      high: 8,
      medium: 24,
      low: 72
    };
    
    const targetTime = SLATimes[urgency] || 72;
    const percent = Math.min((hoursDiff / targetTime) * 100, 100);
    
    return {
      percent,
      overdue: hoursDiff > targetTime,
      hoursRemaining: Math.max(targetTime - hoursDiff, 0).toFixed(1)
    };
  };

  const slaStatus = getSLAStatus(ticket.createdAt, ticket.urgency);

  return (
    <div 
      className={`ticket-card ${selected ? 'selected' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Selection Checkbox */}
      {selectable && (
        <div className="ticket-selector">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(ticket._id)}
            className="ticket-checkbox"
          />
        </div>
      )}

      <div className="ticket-header">
        <div className="ticket-title-section">
          <h3 className="ticket-title">
            <Link to={`/tickets/${ticket._id}`} className="ticket-link">
              {ticket.title}
            </Link>
          </h3>
          <div className="ticket-id">#{ticket.ticketId}</div>
        </div>
        
        <div className="ticket-meta">
          <span className={`status-badge ${getStatusClass(ticket.status)}`}>
            {ticket.status.replace('-', ' ')}
          </span>
          <span className={`urgency-badge ${getUrgencyClass(ticket.urgency)}`}>
            {ticket.urgency}
          </span>
        </div>
      </div>
      
      <div className="ticket-body">
        <p className="ticket-description" title={ticket.description}>
          {ticket.description}
        </p>
        
        <div className="ticket-info-grid">
          <div className="info-item">
            <span className="info-label">Type:</span>
            <span className="info-value">{ticket.issueType}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Created:</span>
            <span className="info-value" title={formatDateTime(ticket.createdAt)}>
              {formatDate(ticket.createdAt)}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Updated:</span>
            <span className="info-value" title={formatDateTime(ticket.updatedAt)}>
              {formatDate(ticket.updatedAt)}
            </span>
          </div>
          {ticket.dueDate && (
            <div className="info-item">
              <span className="info-label">Due:</span>
              <span className="info-value">{formatDate(ticket.dueDate)}</span>
            </div>
          )}
        </div>

        {/* SLA Progress Bar */}
        <div className="sla-indicator">
          <div className="sla-label">
            <span>SLA: {slaStatus.overdue ? 'Overdue' : `${slaStatus.hoursRemaining}h left`}</span>
            <span>{Math.round(slaStatus.percent)}%</span>
          </div>
          <div className="sla-progress-bar">
            <div 
              className={`sla-progress ${slaStatus.overdue ? 'overdue' : ''}`}
              style={{ width: `${slaStatus.percent}%` }}
            ></div>
          </div>
        </div>
      </div>
      
      <div className="ticket-footer">
        <div className="ticket-assignment">
          {ticket.assignedTo ? (
            <div className="assigned-user">
              <div className="user-avatar">
                {ticket.assignedTo.username?.charAt(0).toUpperCase()}
              </div>
              <span>Assigned to {ticket.assignedTo.username}</span>
            </div>
          ) : (
            <span className="unassigned">Unassigned</span>
          )}
        </div>
        
        <div className="ticket-actions">
          {ticket.commentCount > 0 && (
            <span className="comment-count">
              💬 {ticket.commentCount}
            </span>
          )}
          {ticket.attachmentCount > 0 && (
            <span className="attachment-count">
              📎 {ticket.attachmentCount}
            </span>
          )}
          <Link to={`/tickets/${ticket._id}`} className="view-details-btn">
            {isHovered ? 'View Details →' : 'View'}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TicketCard;