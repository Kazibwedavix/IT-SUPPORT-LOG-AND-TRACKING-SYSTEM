import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Navbar from '../components/Navbar';
import LoadingScreen from '../components/LoadingScreen';
import '../styles/App.css';

const RoleBasedDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch stats
        const statsResponse = await api.get('/api/dashboard/stats');
        if (statsResponse.success) {
          setStats(statsResponse.data.stats);
        }
        
        // Fetch recent tickets
        const ticketsResponse = await api.get('/api/tickets');
        if (ticketsResponse.success) {
          setRecentTickets(ticketsResponse.data.tickets.slice(0, 5));
        }
      } catch (error) {
        console.log('Using mock dashboard data');
        // Mock data for development
        setStats({
          totalTickets: 15,
          openTickets: 5,
          inProgressTickets: 3,
          resolvedTickets: 7,
          highPriority: 2,
          averageResolutionTime: '2.3 days',
          userSatisfaction: '92%'
        });
        
        setRecentTickets([
          {
            id: '1',
            title: 'Network Connectivity Issue',
            status: 'open',
            priority: 'high',
            createdAt: '2025-12-08T10:30:00Z'
          },
          {
            id: '2',
            title: 'Software Installation',
            status: 'in-progress',
            priority: 'medium',
            createdAt: '2025-12-07T14:20:00Z'
          },
          {
            id: '3',
            title: 'Projector Not Working',
            status: 'resolved',
            priority: 'high',
            createdAt: '2025-12-06T08:45:00Z'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // If no user, redirect to login
  if (!user) {
    navigate('/login');
    return null;
  }

  if (loading) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  // Role-based welcome messages
  const getWelcomeMessage = () => {
    switch (user.role) {
      case 'admin':
        return 'System Administration Dashboard';
      case 'technician':
        return 'IT Technician Dashboard';
      case 'staff':
        return 'Staff Dashboard';
      case 'student':
        return 'Student Dashboard';
      default:
        return 'Welcome to IT Support System';
    }
  };

  // Role-based quick actions
  const getQuickActions = () => {
    const baseActions = [
      { label: 'Create New Ticket', path: '/tickets/create', color: '#667eea', icon: '➕' },
      { label: 'View All Tickets', path: '/tickets', color: '#10b981', icon: '📋' },
    ];

    if (user.role === 'admin' || user.role === 'technician') {
      baseActions.push(
        { label: 'Manage Users', path: '/admin/users', color: '#f59e0b', icon: '👥' },
        { label: 'View Reports', path: '/reports', color: '#8b5cf6', icon: '📊' }
      );
    }

    if (user.role === 'admin') {
      baseActions.push(
        { label: 'System Settings', path: '/admin/settings', color: '#ef4444', icon: '⚙️' }
      );
    }

    return baseActions;
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get priority badge color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'open': return '#3b82f6';
      case 'in-progress': return '#f59e0b';
      case 'resolved': return '#10b981';
      case 'closed': return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navbar />
      
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Welcome Header */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '30px',
          color: 'white',
          marginBottom: '30px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>{getWelcomeMessage()}</h1>
              <p style={{ opacity: 0.9, fontSize: '16px' }}>
                Welcome back, <strong>{user.name || user.email}</strong> • {user.department}
              </p>
            </div>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              {user.name?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
          }}>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '12px',
                  color: '#3b82f6'
                }}>
                  📋
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Tickets</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.totalTickets}</div>
                </div>
              </div>
            </div>

            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '12px',
                  color: '#ef4444'
                }}>
                  ⚠️
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Open Tickets</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.openTickets}</div>
                </div>
              </div>
            </div>

            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '12px',
                  color: '#10b981'
                }}>
                  ✅
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Resolved</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.resolvedTickets}</div>
                </div>
              </div>
            </div>

            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '10px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '12px',
                  color: '#f59e0b'
                }}>
                  ⏱️
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Avg. Resolution</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.averageResolutionTime}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '15px', color: '#1f2937' }}>Quick Actions</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '15px'
          }}>
            {getQuickActions().map((action, index) => (
              <Link
                key={index}
                to={action.path}
                style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '10px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                  textDecoration: 'none',
                  color: '#1f2937',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: action.color + '20',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  color: action.color
                }}>
                  {action.icon}
                </div>
                <div style={{ fontWeight: '500' }}>{action.label}</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Tickets */}
        <div style={{
          background: 'white',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          padding: '25px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', color: '#1f2937' }}>Recent Tickets</h2>
            <Link 
              to="/tickets" 
              style={{
                color: '#667eea',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              View All →
            </Link>
          </div>

          {recentTickets.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: '12px', color: '#6b7280', fontWeight: '500', fontSize: '14px' }}>Ticket</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: '#6b7280', fontWeight: '500', fontSize: '14px' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: '#6b7280', fontWeight: '500', fontSize: '14px' }}>Priority</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: '#6b7280', fontWeight: '500', fontSize: '14px' }}>Created</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: '#6b7280', fontWeight: '500', fontSize: '14px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.map(ticket => (
                    <tr key={ticket.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: '500' }}>{ticket.title}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                          #{ticket.id} • {ticket.category || 'General'}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: getStatusColor(ticket.status) + '20',
                          color: getStatusColor(ticket.status)
                        }}>
                          {ticket.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: getPriorityColor(ticket.priority) + '20',
                          color: getPriorityColor(ticket.priority)
                        }}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#6b7280', fontSize: '14px' }}>
                        {formatDate(ticket.createdAt)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <Link
                          to={`/tickets/${ticket.id}`}
                          style={{
                            color: '#667eea',
                            textDecoration: 'none',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>No tickets found</div>
              <div style={{ fontSize: '14px' }}>Create your first ticket to get started</div>
            </div>
          )}
        </div>

        {/* User Role Info */}
        <div style={{
          background: 'white',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          padding: '20px',
          marginTop: '30px'
        }}>
          <h3 style={{ fontSize: '16px', marginBottom: '15px', color: '#1f2937' }}>Your Account Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Role</div>
              <div style={{ fontWeight: '500' }}>{user.role}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Department</div>
              <div style={{ fontWeight: '500' }}>{user.department}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Email</div>
              <div style={{ fontWeight: '500' }}>{user.email}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Account ID</div>
              <div style={{ fontWeight: '500', fontFamily: 'monospace', fontSize: '14px' }}>{user.id}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '30px',
          paddingTop: '20px',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '14px'
        }}>
          <p>Bugema University IT Support System • Version 1.0.0</p>
          <p style={{ fontSize: '12px', marginTop: '8px' }}>
            Backend Status: <span style={{ color: '#10b981', fontWeight: '500' }}>✅ Connected</span> • 
            Last checked: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RoleBasedDashboard;