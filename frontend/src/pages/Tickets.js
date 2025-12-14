// src/pages/Tickets.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api from '../services/api';
import '../styles/Tickets.css'; // We'll create this CSS file

const Tickets = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Get user's full name - FIXED VERSION
  const getUserName = () => {
    if (!user) return 'User';
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    if (user.firstName) return user.firstName;
    if (user.username) return user.username;
    if (user.email) return user.email.split('@')[0];
    return 'User';
  };

  // Fetch tickets from API
  useEffect(() => {
    const fetchTickets = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      setLoading(true);
      setError('');
      
      try {
        console.log('📋 Fetching tickets for user:', user._id);
        
        // Build query parameters based on role
        const params = {};
        
        // For students, only show their own tickets
        if (user.role === 'student') {
          params.createdBy = user._id;
        }
        
        // Apply status filter if not "all"
        if (statusFilter !== 'all') {
          params.status = statusFilter;
        }
        
        // Apply search term if exists
        if (searchTerm.trim()) {
          params.search = searchTerm.trim();
        }
        
        const response = await api.get('/api/tickets', { params });
        console.log('✅ Tickets response:', response);
        
        if (response.data.success) {
          // Handle different response formats
          const ticketsData = response.data.data?.tickets || response.data.tickets || response.data.data || [];
          setTickets(ticketsData);
        } else {
          setError(response.data.message || 'Failed to load tickets');
        }
      } catch (err) {
        console.error('❌ Error fetching tickets:', err);
        
        if (err.name === 'AuthError') {
          setError('Your session has expired. Please log in again.');
          logout();
          navigate('/login');
          return;
        }
        
        setError(err.message || 'Failed to load tickets. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [user, statusFilter, searchTerm, navigate, logout]);

  // Handle search with debounce
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
  };

  // Format date
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'N/A';
    }
  };

  // Get status badge style
  const getStatusStyle = (status) => {
    switch (status) {
      case 'open': return { background: '#3b82f6', color: 'white' };
      case 'in-progress': return { background: '#f59e0b', color: 'white' };
      case 'resolved': return { background: '#10b981', color: 'white' };
      case 'closed': return { background: '#6b7280', color: 'white' };
      case 'pending': return { background: '#8b5cf6', color: 'white' };
      default: return { background: '#e5e7eb', color: '#374151' };
    }
  };

  // Get priority badge style
  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'critical': return { background: '#dc2626', color: 'white' };
      case 'high': return { background: '#ea580c', color: 'white' };
      case 'medium': return { background: '#d97706', color: 'white' };
      case 'low': return { background: '#059669', color: 'white' };
      default: return { background: '#e5e7eb', color: '#374151' };
    }
  };

  // View ticket details
  const viewTicketDetails = (ticketId) => {
    navigate(`/tickets/${ticketId}`);
  };

  // Create new ticket
  const createNewTicket = () => {
    navigate('/create-ticket');
  };

  // Calculate ticket statistics
  const getTicketStats = () => {
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in-progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length
    };
    return stats;
  };

  const stats = getTicketStats();

  if (!user) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid rgba(255, 255, 255, 0.3)',
          borderTopColor: 'white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px'
        }}></div>
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      <Navbar />
      
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '2.5rem', 
              color: '#2c3e50', 
              marginBottom: '0.5rem' 
            }}>
              Tickets
            </h1>
            <p style={{ color: '#6c757d', fontSize: '1.1rem', margin: 0 }}>
              Welcome, <strong>{getUserName()}</strong>. 
              {user.role === 'student' ? ' View your support tickets below.' : ' Manage all support tickets below.'}
            </p>
          </div>
          <div>
            <button 
              onClick={createNewTicket}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 10px 20px rgba(102, 126, 234, 0.3)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              + Create New Ticket
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
            textAlign: 'center',
            transition: 'transform 0.3s ease'
          }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#2c3e50' }}>
              {stats.total}
            </div>
            <div style={{ color: '#6c757d', fontSize: '0.9rem', textTransform: 'uppercase' }}>
              Total Tickets
            </div>
          </div>
          
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#3b82f6' }}>
              {stats.open}
            </div>
            <div style={{ color: '#6c757d', fontSize: '0.9rem', textTransform: 'uppercase' }}>
              Open
            </div>
          </div>
          
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#f59e0b' }}>
              {stats.inProgress}
            </div>
            <div style={{ color: '#6c757d', fontSize: '0.9rem', textTransform: 'uppercase' }}>
              In Progress
            </div>
          </div>
          
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#10b981' }}>
              {stats.resolved}
            </div>
            <div style={{ color: '#6c757d', fontSize: '0.9rem', textTransform: 'uppercase' }}>
              Resolved
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', color: '#495057', marginBottom: '0.5rem' }}>
                Status Filter
              </label>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '2px solid #dee2e6',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
          
          <div style={{ position: 'relative', maxWidth: '500px' }}>
            <input
              type="text"
              placeholder="Search tickets by ID, title, or description..."
              value={searchTerm}
              onChange={handleSearch}
              style={{
                width: '100%',
                padding: '0.75rem 1rem 0.75rem 3rem',
                border: '2px solid #dee2e6',
                borderRadius: '8px',
                fontSize: '1rem'
              }}
            />
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }}>
              🔍
            </span>
            {searchTerm && (
              <button 
                onClick={clearSearch}
                style={{
                  position: 'absolute',
                  right: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#6c757d',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: '1px solid #f5c6cb'
          }}>
            <span>{error}</span>
            <button 
              onClick={() => setError('')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#721c24'
              }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '4rem', 
            background: 'white', 
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #667eea',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }}></div>
            <p style={{ color: '#6c757d' }}>Loading tickets...</p>
          </div>
        ) : (
          /* Tickets Table */
          <div style={{ 
            background: 'white', 
            borderRadius: '10px',
            boxShadow: '0 2px 20px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden'
          }}>
            {tickets.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '4rem' 
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: '0.5' }}>📋</div>
                <h3 style={{ color: '#2c3e50', marginBottom: '0.5rem' }}>No tickets found</h3>
                <p style={{ color: '#6c757d', marginBottom: '1.5rem' }}>
                  {searchTerm || statusFilter !== 'all' 
                    ? 'No tickets match your current filters.' 
                    : 'You haven\'t created any tickets yet.'}
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  {(searchTerm || statusFilter !== 'all') && (
                    <button 
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                      }}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                  <button 
                    onClick={createNewTicket}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Create Your First Ticket
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  minWidth: '800px'
                }}>
                  <thead style={{ background: '#f8f9fa' }}>
                    <tr>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'left', 
                        fontWeight: '600', 
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>Ticket ID</th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'left', 
                        fontWeight: '600', 
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>Title</th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'left', 
                        fontWeight: '600', 
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>Status</th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'left', 
                        fontWeight: '600', 
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>Priority</th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'left', 
                        fontWeight: '600', 
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>Created</th>
                      <th style={{ 
                        padding: '1rem', 
                        textAlign: 'left', 
                        fontWeight: '600', 
                        color: '#495057',
                        borderBottom: '2px solid #dee2e6'
                      }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr key={ticket.id || ticket._id} 
                          style={{ transition: 'background 0.2s ease' }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f8f9fa'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '1rem', borderBottom: '1px solid #dee2e6' }}>
                          <span style={{
                            background: '#e9ecef',
                            color: '#495057',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontFamily: "'Courier New', monospace",
                            fontWeight: '600',
                            fontSize: '0.85rem'
                          }}>
                            {ticket.ticketId || `TKT-${(ticket.id || ticket._id).toString().slice(-6)}`}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', borderBottom: '1px solid #dee2e6', maxWidth: '300px' }}>
                          <div style={{ fontWeight: '600', color: '#2c3e50', marginBottom: '0.25rem' }}>
                            {ticket.title}
                          </div>
                          <div style={{ color: '#6c757d', fontSize: '0.9rem' }}>
                            {ticket.description?.substring(0, 60)}...
                          </div>
                        </td>
                        <td style={{ padding: '1rem', borderBottom: '1px solid #dee2e6' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            ...getStatusStyle(ticket.status)
                          }}>
                            {ticket.status}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', borderBottom: '1px solid #dee2e6' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            ...getPriorityStyle(ticket.priority)
                          }}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', borderBottom: '1px solid #dee2e6', whiteSpace: 'nowrap' }}>
                          {formatDate(ticket.createdAt)}
                        </td>
                        <td style={{ padding: '1rem', borderBottom: '1px solid #dee2e6' }}>
                          <button 
                            onClick={() => viewTicketDetails(ticket.id || ticket._id)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              fontSize: '0.9rem',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => {
                              e.target.style.background = '#0056b3';
                              e.target.style.transform = 'translateY(-2px)';
                            }}
                            onMouseOut={(e) => {
                              e.target.style.background = '#007bff';
                              e.target.style.transform = 'translateY(0)';
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ 
          marginTop: '2rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '1rem 0',
          borderTop: '1px solid #dee2e6'
        }}>
          <Link 
            to="/dashboard" 
            style={{ 
              color: '#007bff', 
              textDecoration: 'none', 
              fontWeight: '600' 
            }}
            onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            ← Back to Dashboard
          </Link>
          <div style={{ color: '#6c757d', fontSize: '0.9rem' }}>
            Showing {tickets.length} of {stats.total} tickets
          </div>
        </div>
      </div>

      <style jsx="true">{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .tickets-container {
            padding: 1rem;
          }
          
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .header-section {
            flex-direction: column;
            gap: 1rem;
          }
        }
        
        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default Tickets;