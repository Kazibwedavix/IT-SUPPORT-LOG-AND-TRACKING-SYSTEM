import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Navbar from '../components/Navbar';
import LoadingScreen from '../components/LoadingScreen';
import ErrorBoundary from '../components/ErrorBoundary';
import '../styles/App.css';

const RoleBasedDashboard = () => {
  const { user, logout, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch REAL dashboard data from production
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 [PRODUCTION] Fetching real dashboard data...');
      
      // Fetch dashboard stats from production backend
      const response = await api.get('/api/dashboard/stats');
      
      console.log('📥 [PRODUCTION] API Response:', {
        success: response.data.success,
        hasStats: !!response.data.data?.stats,
        hasTickets: !!response.data.data?.tickets,
        statsKeys: response.data.data?.stats ? Object.keys(response.data.data.stats) : []
      });
      
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        
        // Ensure we have the expected structure
        const processedData = {
          stats: data.stats || {
            totalTickets: 0,
            openTickets: 0,
            inProgressTickets: 0,
            resolvedTickets: 0,
            closedTickets: 0,
            highPriority: 0,
            criticalTickets: 0,
            overdueTickets: 0,
            averageResolutionTime: '0 hours',
            slaComplianceRate: '0%',
            myTickets: 0,
            assignedTickets: 0,
            resolutionRate: 0,
            openRate: 0,
            inProgressRate: 0,
            userRole: user?.role,
            userName: user?.name || user?.email,
            userEmail: user?.email,
            userDepartment: user?.department,
            lastUpdated: new Date().toISOString(),
            dataSource: 'Production Database'
          },
          tickets: data.tickets || [],
          systemInfo: data.systemInfo || {
            environment: 'production',
            timestamp: new Date().toISOString(),
            database: 'MongoDB Connected'
          }
        };
        
        console.log('✅ [PRODUCTION] Processed dashboard data:', {
          totalTickets: processedData.stats.totalTickets,
          openTickets: processedData.stats.openTickets,
          recentTickets: processedData.tickets.length
        });
        
        setDashboardData(processedData);
        setLastUpdated(new Date());
        
        // Store in session storage for offline viewing (cache for 2 minutes only)
        try {
          sessionStorage.setItem('dashboardCache', JSON.stringify({
            data: processedData,
            timestamp: Date.now(),
            userId: user?.id
          }));
        } catch (storageError) {
          console.warn('⚠️ Could not cache dashboard data:', storageError.message);
        }
      } else {
        throw new Error(response.data.message || 'Invalid response format from server');
      }
    } catch (error) {
      console.error('❌ [PRODUCTION] Dashboard fetch error:', error);
      
      // Try to use cached data if available and recent (2 minutes)
      try {
        const cached = sessionStorage.getItem('dashboardCache');
        if (cached) {
          const { data, timestamp, userId } = JSON.parse(cached);
          
          // Only use cache if it's for the same user and less than 2 minutes old
          if (userId === user?.id && Date.now() - timestamp < 2 * 60 * 1000) {
            console.log('⚠️ [PRODUCTION] Using cached dashboard data (2 min old)');
            setDashboardData(data);
            setError('Using cached data. Connection issue detected.');
            return;
          }
        }
      } catch (cacheError) {
        console.error('❌ Cache read error:', cacheError);
      }
      
      // Set appropriate error message
      let errorMessage = 'Failed to load dashboard data from production server';
      if (error.response?.status === 401) {
        errorMessage = 'Session expired. Please login again.';
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.message.includes('Network Error')) {
        errorMessage = 'Network error. Check your connection.';
      }
      
      setError(errorMessage);
      
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 60 seconds
  useEffect(() => {
    fetchDashboardData();
    
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDashboardData();
      }
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Manual refresh
  const handleRefresh = () => {
    fetchDashboardData();
  };

  // If no user, redirect to login
  if (!user) {
    navigate('/login');
    return null;
  }

  if (loading && !dashboardData) {
    return (
      <LoadingScreen 
        message="Loading real dashboard data from production database..." 
        subMessage="Fetching live statistics and ticket information"
      />
    );
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
      { 
        label: 'Create New Ticket', 
        path: '/tickets/create', 
        color: '#667eea', 
        icon: '➕',
        permission: ['student', 'staff', 'technician', 'admin']
      },
      { 
        label: 'View All Tickets', 
        path: '/tickets', 
        color: '#10b981', 
        icon: '📋',
        permission: ['student', 'staff', 'technician', 'admin']
      },
    ];

    if (['admin', 'technician'].includes(user.role)) {
      baseActions.push(
        { 
          label: 'Manage Tickets', 
          path: '/technician/tickets', 
          color: '#f59e0b', 
          icon: '🎫',
          permission: ['technician', 'admin']
        }
      );
    }

    if (user.role === 'admin') {
      baseActions.push(
        { 
          label: 'Manage Users', 
          path: '/admin/users', 
          color: '#8b5cf6', 
          icon: '👥',
          permission: ['admin']
        },
        { 
          label: 'System Reports', 
          path: '/reports', 
          color: '#ec4899', 
          icon: '📊',
          permission: ['admin']
        },
        { 
          label: 'System Settings', 
          path: '/admin/settings', 
          color: '#ef4444', 
          icon: '⚙️',
          permission: ['admin']
        }
      );
    }

    return baseActions.filter(action => action.permission.includes(user.role));
  };

  // Format numbers with commas
  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString();
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority) => {
    if (!priority) return '#6b7280';
    switch (priority.toLowerCase()) {
      case 'critical': return '#dc2626';
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  // Get status badge color
  const getStatusColor = (status) => {
    if (!status) return '#6b7280';
    switch (status.toLowerCase()) {
      case 'open': return '#3b82f6';
      case 'in-progress': return '#f59e0b';
      case 'resolved': return '#10b981';
      case 'closed': return '#6b7280';
      default: return '#6b7280';
    }
  };

  // Get status display text
  const getStatusText = (status) => {
    if (!status) return 'Unknown';
    return status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get priority display text
  const getPriorityText = (priority) => {
    if (!priority) return 'N/A';
    return priority.toUpperCase();
  };

  return (
    <ErrorBoundary>
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Navbar />
        
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
          {/* Error Alert */}
          {error && (
            <div style={{
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '15px 20px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong style={{ color: '#dc2626' }}>⚠️ Alert:</strong> {error}
              </div>
              <button
                onClick={handleRefresh}
                style={{
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🔄 Retry
              </button>
            </div>
          )}

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
                <h1 style={{ fontSize: '28px', marginBottom: '8px', fontWeight: '600' }}>{getWelcomeMessage()}</h1>
                <p style={{ opacity: 0.9, fontSize: '16px', marginBottom: '4px' }}>
                  Welcome back, <strong>{user.name || user.email}</strong>
                </p>
                <p style={{ opacity: 0.8, fontSize: '14px' }}>
                  {user.department} • {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </p>
                {lastUpdated && (
                  <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '12px' }}>
                    Data last updated: {formatDate(lastUpdated)}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <button
                  onClick={handleRefresh}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                  }}
                >
                  🔄 Refresh Data
                </button>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  border: '2px solid rgba(255,255,255,0.3)'
                }}>
                  {user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          {dashboardData?.stats && (
            <>
              <div style={{ marginBottom: '30px' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '20px' 
                }}>
                  <h2 style={{ fontSize: '20px', color: '#1f2937', fontWeight: '600' }}>
                    System Overview
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#6b7280', 
                      fontWeight: '400',
                      marginLeft: '10px',
                      background: '#f3f4f6',
                      padding: '4px 10px',
                      borderRadius: '12px'
                    }}>
                      LIVE DATA
                    </span>
                  </h2>
                  <div style={{ fontSize: '14px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#10b981',
                      animation: 'pulse 2s infinite'
                    }}></div>
                    Connected to Production Database
                  </div>
                </div>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px'
                }}>
                  {/* Total Tickets */}
                  <div style={{
                    background: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    borderLeft: '4px solid #3b82f6',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
                  }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '15px',
                        fontSize: '20px',
                        color: '#3b82f6'
                      }}>
                        📋
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                          Total Tickets
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
                          {formatNumber(dashboardData.stats.totalTickets || 0)}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#6b7280',
                      marginTop: '10px'
                    }}>
                      <span>Open: {formatNumber(dashboardData.stats.openTickets || 0)}</span>
                      <span>Resolved: {formatNumber(dashboardData.stats.resolvedTickets || 0)}</span>
                    </div>
                  </div>

                  {/* Active Tickets */}
                  <div style={{
                    background: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    borderLeft: '4px solid #ef4444',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(239, 68, 68, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
                  }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '15px',
                        fontSize: '20px',
                        color: '#ef4444'
                      }}>
                        ⚠️
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                          Active Tickets
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
                          {formatNumber((dashboardData.stats.openTickets || 0) + (dashboardData.stats.inProgressTickets || 0))}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#6b7280',
                      marginTop: '10px'
                    }}>
                      <span>Open: {formatNumber(dashboardData.stats.openTickets || 0)}</span>
                      <span>In Progress: {formatNumber(dashboardData.stats.inProgressTickets || 0)}</span>
                    </div>
                  </div>

                  {/* Resolution Rate */}
                  <div style={{
                    background: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    borderLeft: '4px solid #10b981',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
                  }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '15px',
                        fontSize: '20px',
                        color: '#10b981'
                      }}>
                        📈
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                          Resolution Rate
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937' }}>
                          {dashboardData.stats.resolutionRate || 0}%
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#6b7280',
                      marginTop: '10px'
                    }}>
                      <span>Resolved: {formatNumber(dashboardData.stats.resolvedTickets || 0)}</span>
                      <span>Closed: {formatNumber(dashboardData.stats.closedTickets || 0)}</span>
                    </div>
                  </div>

                  {/* SLA Compliance */}
                  <div style={{
                    background: 'white',
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    borderLeft: '4px solid #8b5cf6',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(139, 92, 246, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
                  }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        background: 'rgba(139, 92, 246, 0.1)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '15px',
                        fontSize: '20px',
                        color: '#8b5cf6'
                      }}>
                        ⏱️
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                          Performance Metrics
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937', lineHeight: '1.3' }}>
                          {dashboardData.stats.averageResolutionTime || '0 hours'}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      color: '#6b7280',
                      marginTop: '10px'
                    }}>
                      <span>SLA: {dashboardData.stats.slaComplianceRate || '0%'}</span>
                      <span>Overdue: {formatNumber(dashboardData.stats.overdueTickets || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div style={{ marginBottom: '30px' }}>
                <h2 style={{ fontSize: '20px', marginBottom: '15px', color: '#1f2937', fontWeight: '600' }}>
                  Quick Actions
                  <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '400', marginLeft: '10px' }}>
                    Based on your role: {user.role}
                  </span>
                </h2>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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
                        gap: '15px',
                        transition: 'all 0.2s ease',
                        border: '1px solid transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
                        e.currentTarget.style.borderColor = action.color;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      <div style={{
                        width: '44px',
                        height: '44px',
                        background: `${action.color}15`,
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '22px',
                        color: action.color
                      }}>
                        {action.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '15px' }}>{action.label}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                          Click to access
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recent Tickets */}
              <div style={{
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                padding: '25px',
                marginBottom: '30px',
                border: '1px solid #f3f4f6'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '20px' 
                }}>
                  <div>
                    <h2 style={{ fontSize: '20px', color: '#1f2937', marginBottom: '4px', fontWeight: '600' }}>
                      Recent Tickets
                    </h2>
                    <p style={{ fontSize: '14px', color: '#6b7280' }}>
                      Showing {dashboardData.tickets?.length || 0} most recent tickets
                      {dashboardData.stats?.myTickets && user.role !== 'admin' && user.role !== 'technician' && 
                        ` (You have ${dashboardData.stats.myTickets} total tickets)`
                      }
                    </p>
                  </div>
                  <Link 
                    to="/tickets" 
                    style={{
                      background: '#667eea',
                      color: 'white',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#5a67d8';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#667eea';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    View All Tickets →
                  </Link>
                </div>

                {dashboardData.tickets && dashboardData.tickets.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ 
                      width: '100%', 
                      borderCollapse: 'collapse',
                      minWidth: '800px'
                    }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={{ textAlign: 'left', padding: '14px', color: '#374151', fontWeight: '600', fontSize: '14px' }}>Ticket</th>
                          <th style={{ textAlign: 'left', padding: '14px', color: '#374151', fontWeight: '600', fontSize: '14px' }}>Status</th>
                          <th style={{ textAlign: 'left', padding: '14px', color: '#374151', fontWeight: '600', fontSize: '14px' }}>Priority</th>
                          <th style={{ textAlign: 'left', padding: '14px', color: '#374151', fontWeight: '600', fontSize: '14px' }}>Created</th>
                          <th style={{ textAlign: 'left', padding: '14px', color: '#374151', fontWeight: '600', fontSize: '14px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.tickets.map((ticket, index) => (
                          <tr key={ticket.id || index} style={{ 
                            borderBottom: '1px solid #f3f4f6',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                          >
                            <td style={{ padding: '14px' }}>
                              <div style={{ fontWeight: '600', fontSize: '15px', color: '#1f2937' }}>
                                {ticket.title || 'Untitled Ticket'}
                              </div>
                              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                                #{ticket.ticketId || 'N/A'} • {ticket.category || 'General'} 
                                {ticket.ageInHours && ` • ${ticket.ageInHours}h ago`}
                              </div>
                            </td>
                            <td style={{ padding: '14px' }}>
                              <span style={{
                                padding: '6px 12px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: '600',
                                background: `${getStatusColor(ticket.status)}15`,
                                color: getStatusColor(ticket.status),
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                <div style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: getStatusColor(ticket.status)
                                }}></div>
                                {getStatusText(ticket.status)}
                              </span>
                            </td>
                            <td style={{ padding: '14px' }}>
                              <span style={{
                                padding: '6px 12px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: '600',
                                background: `${getPriorityColor(ticket.priority)}15`,
                                color: getPriorityColor(ticket.priority),
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                <div style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: getPriorityColor(ticket.priority)
                                }}></div>
                                {getPriorityText(ticket.priority)}
                              </span>
                            </td>
                            <td style={{ padding: '14px', color: '#6b7280', fontSize: '14px' }}>
                              <div>{formatDate(ticket.createdAt)}</div>
                              {ticket.isOverdue && (
                                <div style={{ 
                                  fontSize: '11px', 
                                  color: '#dc2626',
                                  marginTop: '4px',
                                  background: '#fee2e2',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  display: 'inline-block'
                                }}>
                                  ⚠️ Overdue
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '14px' }}>
                              <Link
                                to={`/tickets/${ticket.id}`}
                                style={{
                                  background: '#f3f4f6',
                                  color: '#374151',
                                  padding: '8px 16px',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#e5e7eb';
                                  e.currentTarget.style.color = '#111827';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#f3f4f6';
                                  e.currentTarget.style.color = '#374151';
                                }}
                              >
                                View Details →
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '60px 20px', 
                    color: '#6b7280',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px dashed #e5e7eb'
                  }}>
                    <div style={{ fontSize: '60px', marginBottom: '20px', opacity: 0.5 }}>📭</div>
                    <div style={{ fontSize: '18px', marginBottom: '12px', fontWeight: '500' }}>
                      No tickets found
                    </div>
                    <div style={{ fontSize: '14px', marginBottom: '24px', maxWidth: '400px', margin: '0 auto' }}>
                      {user.role === 'admin' || user.role === 'technician' 
                        ? 'There are no tickets in the system yet.' 
                        : 'You haven\'t created any tickets yet.'
                      }
                    </div>
                    <Link
                      to="/tickets/create"
                      style={{
                        background: '#667eea',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: '500',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#5a67d8';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#667eea';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      ➕ Create New Ticket
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}

          {/* System Status Footer */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            padding: '20px',
            marginTop: '30px',
            border: '1px solid #f3f4f6'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '15px'
            }}>
              <div>
                <h3 style={{ fontSize: '16px', marginBottom: '12px', color: '#1f2937', fontWeight: '600' }}>
                  System Status
                </h3>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Backend Status</div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '500',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#10b981',
                        animation: 'pulse 2s infinite'
                      }}></div>
                      Operational
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Database</div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '500',
                      color: dashboardData?.systemInfo?.database === 'MongoDB Connected' ? '#10b981' : '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: dashboardData?.systemInfo?.database === 'MongoDB Connected' ? '#10b981' : '#ef4444'
                      }}></div>
                      {dashboardData?.systemInfo?.database || 'Checking...'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Data Freshness</div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>
                      {lastUpdated ? `${Math.floor((Date.now() - lastUpdated) / 1000)} seconds ago` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Environment</div>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '500',
                      color: dashboardData?.systemInfo?.environment === 'production' ? '#10b981' : '#f59e0b'
                    }}>
                      {dashboardData?.systemInfo?.environment || process.env.NODE_ENV || 'production'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>System Version</div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>v4.0.0 Production</div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                  Bugema University IT Support
                </div>
              </div>
            </div>
            
            <div style={{
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb',
              fontSize: '12px',
              color: '#6b7280',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                © {new Date().getFullYear()} Bugema University IT Support System
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <span>
                  Users: <strong>{dashboardData?.stats?.totalUsers || 0}</strong>
                </span>
                <span>
                  Tickets: <strong>{dashboardData?.stats?.totalTickets || 0}</strong>
                </span>
                <span>
                  Resolution: <strong>{dashboardData?.stats?.resolutionRate || 0}%</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Add CSS animation for pulse effect */}
      <style jsx="true">{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </ErrorBoundary>
  );
};

export default RoleBasedDashboard;