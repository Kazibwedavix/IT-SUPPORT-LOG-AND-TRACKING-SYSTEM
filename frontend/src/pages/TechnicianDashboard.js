import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import TicketCard from '../components/TicketCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorBoundary from '../components/ErrorBoundary';
import ticketService from '../services/ticketService';
import userService from '../services/userService';
import '../styles/Dashboard.css';

/**
 * TechnicianDashboard Component
 * 
 * Enterprise-grade dashboard for IT technicians with real-time updates,
 * performance tracking, and ticket management capabilities.
 * 
 * Features:
 * - Real-time dashboard updates
 * - Performance analytics
 * - Ticket assignment management
 * - SLA compliance tracking
 * - Responsive design
 * - Error boundary protection
 * 
 * @version 3.0.0
 * @author Bugema IT Support Team
 */
const TechnicianDashboard = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const refreshIntervalRef = useRef(null);
  
  // State management
  const [dashboardData, setDashboardData] = useState({
    assignedTickets: 0,
    unassignedTickets: 0,
    todayResolved: 0,
    avgResolutionTime: 0,
    slaMet: 0,
    satisfactionRate: 0,
    urgentCount: 0,
    overdueCount: 0
  });
  
  const [assignedTickets, setAssignedTickets] = useState([]);
  const [unassignedTickets, setUnassignedTickets] = useState([]);
  const [recentlyResolved, setRecentlyResolved] = useState([]);
  const [urgentTickets, setUrgentTickets] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('assigned');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Authentication check
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (user?.role !== 'technician' && user?.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
  }, [isAuthenticated, user, navigate]);

  // Data fetching with cleanup
  useEffect(() => {
    if (isAuthenticated && user?.role === 'technician') {
      fetchDashboardData();
      
      // Set up refresh interval (5 minutes for production)
      refreshIntervalRef.current = setInterval(fetchDashboardData, 300000);
      
      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [isAuthenticated, user]);

  /**
   * Fetches all dashboard data with error handling and performance tracking
   */
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const startTime = performance.now();
      
      // Fetch all data in parallel for performance
      const [
        statsResponse,
        assignedResponse,
        unassignedResponse,
        resolvedResponse
      ] = await Promise.all([
        userService.getTechnicianStats().catch(() => ({})),
        fetchTicketsWithFallback({ 
          assignedTo: user?._id || user?.id,
          status: ['open', 'in-progress'],
          limit: 8,
          sortBy: 'urgency',
          sortOrder: 'desc'
        }),
        fetchTicketsWithFallback({ 
          assignedTo: null, 
          status: 'open',
          limit: 6,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        }),
        fetchTicketsWithFallback({ 
          status: ['resolved', 'closed'],
          limit: 4,
          sortBy: 'updatedAt',
          sortOrder: 'desc',
          assignedTo: user?._id || user?.id
        })
      ]);

      // Process and validate responses
      processDashboardData(
        statsResponse,
        assignedResponse,
        unassignedResponse,
        resolvedResponse
      );
      
      const endTime = performance.now();
      console.log(`Dashboard data loaded in ${(endTime - startTime).toFixed(2)}ms`);
      
      setLastUpdated(new Date());
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      handleDashboardError(error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Safe ticket fetching with fallback handling
   */
  const fetchTicketsWithFallback = async (filters) => {
    try {
      const response = await ticketService.getTickets(filters);
      
      if (response && response.success) {
        const tickets = response.data?.tickets || 
                       response.tickets || 
                       response.data?.data?.tickets || 
                       response.data || 
                       [];
        
        return Array.isArray(tickets) ? tickets : [];
      }
      
      return [];
    } catch (error) {
      console.warn('Ticket fetch failed, using fallback:', error);
      return [];
    }
  };

  /**
   * Processes and validates dashboard data
   */
  const processDashboardData = (stats, assigned, unassigned, resolved) => {
    // Validate and sanitize ticket data
    const sanitizedAssigned = sanitizeTicketArray(assigned);
    const sanitizedUnassigned = sanitizeTicketArray(unassigned);
    const sanitizedResolved = sanitizeTicketArray(resolved);
    
    // Extract urgent tickets
    const urgent = [
      ...sanitizedAssigned.filter(t => t.urgency === 'critical' || t.urgency === 'high'),
      ...sanitizedUnassigned.filter(t => t.urgency === 'critical' || t.urgency === 'high')
    ];

    // Update state
    setAssignedTickets(sanitizedAssigned);
    setUnassignedTickets(sanitizedUnassigned);
    setRecentlyResolved(sanitizedResolved);
    setUrgentTickets(urgent);
    
    // Update dashboard statistics
    setDashboardData(prev => ({
      ...prev,
      assignedTickets: sanitizedAssigned.length,
      unassignedTickets: sanitizedUnassigned.length,
      todayResolved: calculateTodayResolved(sanitizedResolved),
      avgResolutionTime: stats.avgResolutionTime || 0,
      slaMet: stats.slaMet || 0,
      satisfactionRate: stats.satisfactionRate || 0,
      urgentCount: urgent.length,
      overdueCount: calculateOverdueTickets(sanitizedAssigned)
    }));
  };

  /**
   * Sanitizes and validates ticket array
   */
  const sanitizeTicketArray = (tickets) => {
    if (!Array.isArray(tickets)) return [];
    
    return tickets
      .filter(ticket => ticket && (ticket._id || ticket.id))
      .map(ticket => ({
        ...ticket,
        // Ensure required fields exist
        _id: ticket._id || ticket.id,
        title: ticket.title || 'Untitled Ticket',
        status: ticket.status || 'open',
        urgency: ticket.urgency || 'medium',
        issueType: ticket.issueType || 'other',
        // Format dates for display
        formattedCreatedAt: formatDateForDisplay(ticket.createdAt),
        formattedUpdatedAt: formatDateForDisplay(ticket.updatedAt)
      }));
  };

  /**
   * Calculates tickets resolved today
   */
  const calculateTodayResolved = (resolvedTickets) => {
    const today = new Date().toDateString();
    return resolvedTickets.filter(ticket => {
      const resolvedDate = new Date(ticket.updatedAt || ticket.createdAt);
      return resolvedDate.toDateString() === today;
    }).length;
  };

  /**
   * Calculates overdue tickets
   */
  const calculateOverdueTickets = (tickets) => {
    const now = new Date();
    return tickets.filter(ticket => {
      if (!ticket.createdAt) return false;
      
      const createdDate = new Date(ticket.createdAt);
      const hoursSinceCreation = (now - createdDate) / (1000 * 60 * 60);
      
      // SLA thresholds based on urgency
      const slaHours = {
        critical: 4,
        high: 24,
        medium: 48,
        low: 72
      };
      
      const threshold = slaHours[ticket.urgency] || 48;
      return hoursSinceCreation > threshold && ticket.status !== 'resolved';
    }).length;
  };

  /**
   * Handles dashboard errors with user-friendly messages
   */
  const handleDashboardError = (error) => {
    const errorMap = {
      'Network Error': 'Unable to connect to server. Please check your internet connection.',
      'Request failed with status code 401': 'Session expired. Please log in again.',
      'Request failed with status code 403': 'You do not have permission to view this dashboard.',
      'Request failed with status code 500': 'Server error. Please try again later.'
    };
    
    const errorMessage = errorMap[error.message] || 
                        'Unable to load dashboard data. Please try again.';
    
    setError({
      message: errorMessage,
      type: 'dashboard',
      retryable: true
    });
  };

  /**
   * Handles manual refresh
   */
  const handleManualRefresh = () => {
    setError(null);
    fetchDashboardData();
  };

  /**
   * Handles ticket assignment
   */
  const handleAssignTicket = async (ticketId) => {
    try {
      await ticketService.updateTicket(ticketId, {
        assignedTo: user?._id || user?.id,
        status: 'in-progress',
        assignedAt: new Date().toISOString()
      });
      
      await fetchDashboardData();
    } catch (error) {
      console.error('Error assigning ticket:', error);
      setError({
        message: 'Failed to assign ticket. Please try again.',
        type: 'assignment',
        retryable: true
      });
    }
  };

  /**
   * Formats date for display
   */
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)} hours ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  /**
   * Quick actions configuration
   */
  const quickActions = [
    {
      id: 'view-queue',
      label: 'View Queue',
      description: 'See all unassigned tickets',
      icon: '📋',
      action: () => setActiveSection('unassigned'),
      color: 'primary'
    },
    {
      id: 'my-tickets',
      label: 'My Tickets',
      description: 'View assigned to me',
      icon: '👤', 
      action: () => setActiveSection('assigned'),
      color: 'secondary'
    },
    {
      id: 'knowledge-base',
      label: 'Knowledge Base',
      description: 'Common solutions & guides',
      icon: '📚',
      path: '/knowledge-base',
      color: 'info'
    },
    {
      id: 'performance',
      label: 'Performance',
      description: 'View detailed analytics',
      icon: '📊',
      path: '/technician/analytics',
      color: 'success'
    }
  ];

  /**
   * Performance metrics configuration
   */
  const performanceMetrics = [
    { 
      id: 'assigned', 
      label: 'Assigned', 
      value: dashboardData.assignedTickets,
      description: 'Tickets assigned to you'
    },
    { 
      id: 'resolved-today', 
      label: 'Resolved Today', 
      value: dashboardData.todayResolved,
      description: 'Tickets resolved today'
    },
    { 
      id: 'sla-met', 
      label: 'SLA Met', 
      value: `${dashboardData.slaMet}%`,
      description: 'Service level agreement compliance'
    },
    { 
      id: 'avg-time', 
      label: 'Avg. Time', 
      value: `${dashboardData.avgResolutionTime}m`,
      description: 'Average resolution time'
    },
    { 
      id: 'satisfaction', 
      label: 'Satisfaction', 
      value: `${dashboardData.satisfactionRate}%`,
      description: 'User satisfaction rate'
    },
    { 
      id: 'urgent', 
      label: 'Urgent', 
      value: dashboardData.urgentCount,
      description: 'High/Critical priority tickets'
    }
  ];

  // Loading state
  if (loading && assignedTickets.length === 0) {
    return (
      <>
        <Navbar />
        <div className="loading-container">
          <LoadingSpinner 
            message="Loading technician dashboard..." 
            fullPage={true}
          />
        </div>
      </>
    );
  }

  return (
    <ErrorBoundary>
      <>
        <Navbar />
        <div className="technician-dashboard">
          {/* Dashboard Header */}
          <header className="dashboard-header">
            <div className="header-content">
              <div>
                <h1 className="page-title">Technician Dashboard</h1>
                <p className="page-subtitle">
                  Welcome back, <strong>{user?.name || user?.email}</strong>
                  {user?.department && ` • ${user.department}`}
                </p>
              </div>
              
              {lastUpdated && (
                <div className="last-updated">
                  <span className="update-icon">🔄</span>
                  Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
            
            <div className="header-actions">
              <button
                onClick={handleManualRefresh}
                className="btn btn-secondary btn-icon"
                disabled={loading}
                aria-label="Refresh dashboard"
              >
                <span className="icon">🔄</span>
                Refresh
              </button>
              
              <Link to="/tickets" className="btn btn-primary">
                View All Tickets
              </Link>
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
                  <button onClick={handleManualRefresh} className="btn btn-sm">
                    Retry
                  </button>
                )}
                <button onClick={() => setError(null)} className="btn btn-sm btn-text">
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Critical Alert Banner */}
          {urgentTickets.length > 0 && (
            <div className="critical-alert" role="alert">
              <div className="alert-content">
                <span className="alert-icon">🚨</span>
                <div className="alert-text">
                  <strong>Urgent Attention Required</strong>
                  <span>{urgentTickets.length} high-priority tickets need immediate action</span>
                </div>
              </div>
              <button 
                onClick={() => setActiveSection('assigned')}
                className="btn btn-danger"
              >
                View Urgent Tickets
              </button>
            </div>
          )}

          {/* Performance Stats */}
          <section className="performance-stats" aria-label="Performance statistics">
            <div className="stats-grid">
              {performanceMetrics.map(metric => (
                <div key={metric.id} className={`stat-card stat-${metric.id}`}>
                  <div className="stat-content">
                    <div className="stat-value" aria-label={metric.label}>
                      {metric.value}
                    </div>
                    <div className="stat-label">{metric.label}</div>
                    <div className="stat-description">{metric.description}</div>
                  </div>
                  <div className="stat-trend">
                    {/* Trend indicator could be added here */}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="quick-actions-section" aria-label="Quick actions">
            <h2 className="section-title">Quick Actions</h2>
            <div className="actions-grid">
              {quickActions.map(action => (
                action.path ? (
                  <Link
                    key={action.id}
                    to={action.path}
                    className={`action-card action-${action.color}`}
                    aria-label={action.label}
                  >
                    <div className="action-icon">{action.icon}</div>
                    <div className="action-content">
                      <span className="action-label">{action.label}</span>
                      <span className="action-description">{action.description}</span>
                    </div>
                    <div className="action-arrow">→</div>
                  </Link>
                ) : (
                  <button
                    key={action.id}
                    onClick={action.action}
                    className={`action-card action-${action.color}`}
                    aria-label={action.label}
                  >
                    <div className="action-icon">{action.icon}</div>
                    <div className="action-content">
                      <span className="action-label">{action.label}</span>
                      <span className="action-description">{action.description}</span>
                    </div>
                    <div className="action-arrow">→</div>
                  </button>
                )
              ))}
            </div>
          </section>

          {/* Main Ticket Management */}
          <main className="ticket-management" aria-label="Ticket management">
            <div className="management-header">
              <h2 className="section-title">Ticket Management</h2>
              
              <nav className="management-tabs" aria-label="Ticket categories">
                <button
                  className={`tab-button ${activeSection === 'assigned' ? 'active' : ''}`}
                  onClick={() => setActiveSection('assigned')}
                  aria-label="View assigned tickets"
                  aria-selected={activeSection === 'assigned'}
                >
                  My Tickets
                  <span className="tab-count">{assignedTickets.length}</span>
                </button>
                <button
                  className={`tab-button ${activeSection === 'unassigned' ? 'active' : ''}`}
                  onClick={() => setActiveSection('unassigned')}
                  aria-label="View unassigned tickets"
                  aria-selected={activeSection === 'unassigned'}
                >
                  Unassigned
                  <span className="tab-count">{unassignedTickets.length}</span>
                </button>
                <button
                  className={`tab-button ${activeSection === 'resolved' ? 'active' : ''}`}
                  onClick={() => setActiveSection('resolved')}
                  aria-label="View recently resolved tickets"
                  aria-selected={activeSection === 'resolved'}
                >
                  Recently Resolved
                  <span className="tab-count">{recentlyResolved.length}</span>
                </button>
              </nav>
            </div>

            <div className="tab-content">
              {/* Assigned Tickets */}
              {activeSection === 'assigned' && (
                <div className="tab-pane" aria-label="Assigned tickets">
                  <div className="pane-header">
                    <h3>Tickets Assigned to You</h3>
                    <p className="pane-subtitle">
                      {assignedTickets.length} tickets requiring your attention
                      {dashboardData.overdueCount > 0 && (
                        <span className="overdue-badge">
                          {dashboardData.overdueCount} overdue
                        </span>
                      )}
                    </p>
                  </div>
                  
                  {assignedTickets.length === 0 ? (
                    <div className="empty-state" aria-label="No assigned tickets">
                      <div className="empty-icon">✅</div>
                      <h4>No Assigned Tickets</h4>
                      <p>All clear! Check unassigned tickets to help colleagues.</p>
                      <button 
                        onClick={() => setActiveSection('unassigned')}
                        className="btn btn-primary"
                      >
                        View Unassigned Tickets
                      </button>
                    </div>
                  ) : (
                    <div className="tickets-grid" role="list" aria-label="Assigned tickets list">
                      {assignedTickets.map(ticket => (
                        <div key={ticket._id} className="ticket-card-wrapper" role="listitem">
                          <TicketCard 
                            ticket={ticket} 
                            onStatusUpdate={fetchDashboardData}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Unassigned Tickets */}
              {activeSection === 'unassigned' && (
                <div className="tab-pane" aria-label="Unassigned tickets">
                  <div className="pane-header">
                    <h3>Unassigned Tickets</h3>
                    <p className="pane-subtitle">
                      {unassignedTickets.length} tickets waiting for assignment
                    </p>
                  </div>
                  
                  {unassignedTickets.length === 0 ? (
                    <div className="empty-state" aria-label="No unassigned tickets">
                      <div className="empty-icon">🎉</div>
                      <h4>No Unassigned Tickets</h4>
                      <p>Great job team! All tickets are currently assigned.</p>
                    </div>
                  ) : (
                    <div className="tickets-grid" role="list" aria-label="Unassigned tickets list">
                      {unassignedTickets.map(ticket => (
                        <div key={ticket._id} className="ticket-card-wrapper" role="listitem">
                          <TicketCard 
                            ticket={ticket}
                            showAssignButton={true}
                            onAssign={handleAssignTicket}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recently Resolved */}
              {activeSection === 'resolved' && (
                <div className="tab-pane" aria-label="Recently resolved tickets">
                  <div className="pane-header">
                    <h3>Recently Resolved</h3>
                    <p className="pane-subtitle">
                      Your recently completed tickets
                    </p>
                  </div>
                  
                  {recentlyResolved.length === 0 ? (
                    <div className="empty-state" aria-label="No recently resolved tickets">
                      <div className="empty-icon">📊</div>
                      <h4>No Recent Resolutions</h4>
                      <p>Completed tickets will appear here.</p>
                    </div>
                  ) : (
                    <div className="tickets-grid" role="list" aria-label="Recently resolved tickets list">
                      {recentlyResolved.map(ticket => (
                        <div key={ticket._id} className="ticket-card-wrapper" role="listitem">
                          <TicketCard ticket={ticket} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>

          {/* Overlay Loading */}
          {loading && assignedTickets.length > 0 && (
            <div className="loading-overlay">
              <LoadingSpinner message="Updating dashboard..." />
            </div>
          )}
        </div>
      </>
    </ErrorBoundary>
  );
};

export default TechnicianDashboard;