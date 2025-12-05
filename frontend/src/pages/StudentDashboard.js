import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TicketCard from '../components/TicketCard';
import ticketService from '../services/ticketService';
import api from '../services/api'; // Import your api service directly
import '../styles/Dashboard.css';

const StudentDashboard = () => {
  const [myTickets, setMyTickets] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyTickets();
  }, []);

  const fetchMyTickets = async () => {
    try {
      setLoading(true);
      setError('');
      
      // OPTION 1: Use api directly (if ticketService is broken)
      const response = await api.get('/api/tickets');
      
      // SAFE: Check response structure
      if (response.data && response.data.success) {
        // Tickets might be in response.data.data.tickets or response.data.tickets
        const ticketsData = response.data.data?.tickets || response.data.tickets || [];
        setMyTickets(ticketsData);
        
        // Calculate stats safely
        const total = ticketsData.length || 0;
        const open = ticketsData.filter(t => t && t.status === 'open').length;
        const inProgress = ticketsData.filter(t => t && t.status === 'in-progress').length;
        const resolved = ticketsData.filter(t => t && (t.status === 'resolved' || t.status === 'closed')).length;
        
        setStats({ total, open, inProgress, resolved });
      } else {
        // Handle unexpected response format
        console.error('Unexpected response format:', response.data);
        setError('Could not load tickets. Please try again.');
        setMyTickets([]);
      }
      
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setError('Failed to load tickets. Please check your connection.');
      setMyTickets([]);
    } finally {
      setLoading(false);
    }
  };

  // ALTERNATIVE: Direct API call without ticketService
  const fetchTicketsDirectly = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/tickets', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        const tickets = data.data?.tickets || data.tickets || [];
        setMyTickets(tickets);
        
        // Calculate stats
        const total = tickets.length;
        const open = tickets.filter(t => t.status === 'open').length;
        const inProgress = tickets.filter(t => t.status === 'in-progress').length;
        const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
        
        setStats({ total, open, inProgress, resolved });
      }
    } catch (error) {
      console.error('Direct fetch error:', error);
    }
  };

  const quickHelpItems = [
    {
      title: 'WiFi Connection',
      description: 'Troubleshoot internet issues',
      icon: '📶',
      path: '/knowledge-base/wifi'
    },
    {
      title: 'Password Reset',
      description: 'Reset your campus password',
      icon: '🔑',
      path: '/knowledge-base/password'
    },
    {
      title: 'Email Setup',
      description: 'Configure student email',
      icon: '📧',
      path: '/knowledge-base/email'
    },
    {
      title: 'Software Help',
      description: 'Install and use campus software',
      icon: '💻',
      path: '/knowledge-base/software'
    }
  ];

  // SAFE: Always use default empty array before filtering
  const filteredTickets = (myTickets || []).filter(ticket => {
    if (!ticket) return false;
    if (activeTab === 'all') return true;
    return ticket.status === activeTab;
  });

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="dashboard student-dashboard">
        
        {/* Error Display */}
        {error && (
          <div className="alert alert-error">
            {error}
            <button onClick={fetchMyTickets} className="retry-btn">
              Retry
            </button>
          </div>
        )}

        {/* Welcome Header */}
        <div className="dashboard-header">
          <div className="welcome-section">
            <h1>Bugema University IT Support</h1>
            <p className="welcome-message">
              Welcome to your IT support dashboard
            </p>
          </div>
          <div className="header-actions">
            <Link to="/tickets/create" className="btn-primary">
              Create New Ticket
            </Link>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="quick-stats">
          <div className="stat-cards">
            <div className="stat-card">
              <div className="stat-number">{stats.open || 0}</div>
              <div className="stat-label">Open Tickets</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.inProgress || 0}</div>
              <div className="stat-label">In Progress</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.resolved || 0}</div>
              <div className="stat-label">Resolved</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.total || 0}</div>
              <div className="stat-label">Total Tickets</div>
            </div>
          </div>
        </div>

        {/* Quick Help Section */}
        <div className="quick-help-section">
          <h2>Quick Help & Resources</h2>
          <div className="quick-help-grid">
            {quickHelpItems.map((item, index) => (
              <Link key={index} to={item.path} className="help-card">
                <div className="help-icon">{item.icon}</div>
                <div className="help-content">
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                </div>
                <div className="help-arrow">→</div>
              </Link>
            ))}
          </div>
        </div>

        {/* My Tickets Overview */}
        <div className="my-tickets-section">
          <div className="section-header">
            <h2>My Support Requests</h2>
            <div className="ticket-tabs">
              <button 
                className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All ({stats.total || 0})
              </button>
              <button 
                className={`tab-button ${activeTab === 'open' ? 'active' : ''}`}
                onClick={() => setActiveTab('open')}
              >
                Open ({stats.open || 0})
              </button>
              <button 
                className={`tab-button ${activeTab === 'in-progress' ? 'active' : ''}`}
                onClick={() => setActiveTab('in-progress')}
              >
                In Progress ({stats.inProgress || 0})
              </button>
              <button 
                className={`tab-button ${activeTab === 'resolved' ? 'active' : ''}`}
                onClick={() => setActiveTab('resolved')}
              >
                Resolved ({stats.resolved || 0})
              </button>
            </div>
          </div>

          {filteredTickets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No Tickets Found</h3>
              <p>
                {activeTab === 'all' 
                  ? "You haven't created any support tickets yet."
                  : `You don't have any ${activeTab.replace('-', ' ')} tickets.`
                }
              </p>
              <Link to="/tickets/create" className="btn-primary">
                Create Your First Ticket
              </Link>
            </div>
          ) : (
            <>
              <div className="tickets-grid">
                {filteredTickets.map(ticket => (
                  <TicketCard key={ticket._id || ticket.id} ticket={ticket} />
                ))}
              </div>
              
              {myTickets.length > 0 && (
                <div className="view-all">
                  <Link to="/tickets" className="btn-secondary">
                    View All My Tickets ({myTickets.length})
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {/* Support Contact Info */}
        <div className="support-info">
          <div className="support-card">
            <h3>Bugema IT Support</h3>
            <div className="contact-methods">
              <div className="contact-item">
                <span className="contact-icon">📞</span>
                <div className="contact-details">
                  <strong>Phone Support</strong>
                  <span>IT Help Desk: Ext. 1234</span>
                </div>
              </div>
              <div className="contact-item">
                <span className="contact-icon">📧</span>
                <div className="contact-details">
                  <strong>Email Support</strong>
                  <span>support@bugemauniv.ac.ug</span>
                </div>
              </div>
              <div className="contact-item">
                <span className="contact-icon">🏢</span>
                <div className="contact-details">
                  <strong>Walk-in Help</strong>
                  <span>IT Building, Ground Floor</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentDashboard;