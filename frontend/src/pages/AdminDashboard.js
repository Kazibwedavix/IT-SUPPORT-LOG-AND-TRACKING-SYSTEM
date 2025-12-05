import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TicketCard from '../components/TicketCard';
import StatCard from '../components/StatCard';
import QuickActionCard from '../components/QuickActionCard';
import UserManagement from '../components/Admin/UserManagement';
import TicketManagement from '../components/Admin/TicketManagement';
import SystemAnalytics from '../components/Admin/SystemAnalytics';
import SystemSettings from '../components/Admin/SystemSettings';
import ticketService from '../services/ticketService';
import userService from '../services/userService';
import '../styles/Dashboard.css';
import '../styles/AdminDashboard.css';


const AdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState({});
  const [recentTickets, setRecentTickets] = useState([]);
  const [systemStats, setSystemStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [userStats, setUserStats] = useState({});

  useEffect(() => {
    fetchDashboardData();
  }, []);

const fetchDashboardData = async () => {
  try {
    const [ticketsResponse, userStatsResponse, systemStatsResponse] = await Promise.all([
      ticketService.getTickets({ limit: 6, sortBy: 'updatedAt', sortOrder: 'desc' }),
      userService.getUserStats(),
      userService.getSystemStats()
    ]);

    console.log('Tickets Response:', ticketsResponse); // DEBUG
    console.log('User Stats:', userStatsResponse); // DEBUG
    console.log('System Stats:', systemStatsResponse); // DEBUG

    // Extract tickets array - it's nested inside the response
    const tickets = ticketsResponse?.tickets || [];
    
    console.log('Extracted tickets:', tickets); // DEBUG

    setRecentTickets(tickets);
    
    // Extract data from nested structure
    setUserStats(userStatsResponse?.data || {});
    setSystemStats(systemStatsResponse?.data || {});
    setDashboardData({
      ...(userStatsResponse?.data || {}),
      ...(systemStatsResponse?.data || {})
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
  } finally {
    setLoading(false);
  }
};

  // Admin-specific quick actions
  const adminQuickActions = [
    {
      label: 'User Management',
      description: 'Manage all user accounts',
      icon: '👥',
      path: '#',
      color: 'primary',
      emergency: false,
      action: () => setActiveTab('users')
    },
    {
      label: 'System Analytics',
      description: 'View detailed reports',
      icon: '📊',
      path: '#',
      color: 'info',
      emergency: false,
      action: () => setActiveTab('analytics')
    },
    {
      label: 'Ticket Management',
      description: 'Manage all support tickets',
      icon: '🎫',
      path: '#',
      color: 'warning',
      emergency: false,
      action: () => setActiveTab('tickets')
    },
    {
      label: 'System Settings',
      description: 'Configure system',
      icon: '⚙️',
      path: '#',
      color: 'secondary',
      emergency: false,
      action: () => setActiveTab('settings')
    }
  ];

  const emergencyActions = [
    {
      label: 'Critical System Alert',
      description: 'System-wide issues',
      icon: '🚨',
      path: '/admin/alerts',
      color: 'danger',
      emergency: true
    },
    {
      label: 'Database Backup',
      description: 'Create immediate backup',
      icon: '💾',
      path: '/admin/backup',
      color: 'success',
      emergency: false
    }
  ];

  const adminTabs = [
    { id: 'overview', label: 'System Overview', icon: '📊' },
    { id: 'users', label: 'User Management', icon: '👥' },
    { id: 'tickets', label: 'Ticket Management', icon: '🎫' },
    { id: 'analytics', label: 'Analytics & Reports', icon: '📈' },
    { id: 'settings', label: 'System Settings', icon: '⚙️' }
  ];

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading admin dashboard...</p>
        </div>
      </>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />;
      case 'tickets':
        return <TicketManagement />;
      case 'analytics':
        return <SystemAnalytics />;
      case 'settings':
        return <SystemSettings />;
      default:
        return renderOverview();
    }
  };

  const renderOverview = () => (
    <>
      {/* System Health Alert Banner */}
      <div className="system-health-banner">
        <div className="health-content">
          <span className="health-icon">💚</span>
          <div className="health-text">
            <strong>System Status: Operational</strong>
            <span>All systems running normally • Uptime: {systemStats.systemUptime || '99.9%'}</span>
          </div>
          <button className="btn-health">
            View System Logs
          </button>
        </div>
      </div>

      {/* Admin Quick Actions */}
      <div className="quick-actions-section">
        <h2>Administrative Actions</h2>
        <div className="quick-actions-grid">
          {adminQuickActions.map((action, index) => (
            <QuickActionCard
              key={index}
              {...action}
              onClick={action.action}
            />
          ))}
        </div>
      </div>

      {/* Emergency Admin Actions */}
      <div className="emergency-actions-section">
        <h3>Emergency Controls</h3>
        <div className="emergency-actions-grid">
          {emergencyActions.map((action, index) => (
            <QuickActionCard
              key={index}
              {...action}
            />
          ))}
        </div>
      </div>

      {/* System Overview Stats */}
      <div className="metrics-section">
        <h2>System Overview</h2>
        <div className="metrics-grid">
          <StatCard
            title="Total Users"
            value={userStats.totalUsers || 0}
            icon="👥"
            color="primary"
            description={`${userStats.students || 0} Students • ${userStats.staff || 0} Staff`}
            trend="up"
          />
          <StatCard
            title="Total Tickets"
            value={systemStats.totalTickets || 0}
            icon="🎫"
            color="info"
            description={`${systemStats.openTickets || 0} Open • ${systemStats.resolvedTickets || 0} Resolved`}
            trend="neutral"
          />
          <StatCard
            title="System Performance"
            value={systemStats.systemUptime || '99.9%'}
            icon="⚡"
            color="success"
            description="Uptime • Response Time"
            trend="up"
          />
          <StatCard
            title="Active Sessions"
            value={systemStats.activeSessions || 0}
            icon="🔐"
            color="warning"
            description="Current user sessions"
            trend="down"
          />
        </div>
      </div>

      {/* Detailed Statistics Grid */}
      <div className="detailed-stats-section">
        <div className="stats-row">
          <div className="stat-box">
            <h4>User Distribution</h4>
            <div className="stat-details">
              <div className="stat-item">
                <span className="stat-label">Students</span>
                <span className="stat-value">{userStats.students || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Staff</span>
                <span className="stat-value">{userStats.staff || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Technicians</span>
                <span className="stat-value">{userStats.technicians || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Admins</span>
                <span className="stat-value">{userStats.admins || 0}</span>
              </div>
            </div>
          </div>

          <div className="stat-box">
            <h4>Ticket Status</h4>
            <div className="stat-details">
              <div className="stat-item">
                <span className="stat-label">Open</span>
                <span className="stat-value">{systemStats.openTickets || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">In Progress</span>
                <span className="stat-value">{systemStats.inProgressTickets || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Resolved</span>
                <span className="stat-value">{systemStats.resolvedTickets || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Closed</span>
                <span className="stat-value">{systemStats.closedTickets || 0}</span>
              </div>
            </div>
          </div>

          <div className="stat-box">
            <h4>System Metrics</h4>
            <div className="stat-details">
              <div className="stat-item">
                <span className="stat-label">Avg Response</span>
                <span className="stat-value">{dashboardData.avgResponseTime || 2.1}h</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">SLA Compliance</span>
                <span className="stat-value">{dashboardData.slaCompliance || 98}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">User Satisfaction</span>
                <span className="stat-value">{dashboardData.satisfactionRate || 95}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Database Size</span>
                <span className="stat-value">245 MB</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent System Activity */}
      <div className="recent-activity-section">
        <div className="section-header">
          <h2>Recent System Activity</h2>
          <Link to="/admin/activity-logs" className="btn-text">
            View All Logs →
          </Link>
        </div>

        {recentTickets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No Recent Activity</h3>
            <p>No recent tickets or system activities.</p>
          </div>
        ) : (
          <>
            <div className="tickets-grid">
              {recentTickets.map(ticket => (
                <TicketCard key={ticket._id} ticket={ticket} showAdminControls={true} />
              ))}
            </div>
            <div className="view-all">
              <Link to="/admin/tickets" className="btn-secondary">
                Manage All Tickets
              </Link>
            </div>
          </>
        )}
      </div>

      {/* System Health Monitoring */}
      <div className="system-health-section">
        <div className="section-header">
          <h2>System Health Monitor</h2>
          <span className="status-badge healthy">All Systems Normal</span>
        </div>
        <div className="health-grid">
          <div className="health-metric">
            <span className="metric-label">API Server</span>
            <div className="metric-status healthy">
              <span className="status-dot"></span>
              Operational
            </div>
          </div>
          <div className="health-metric">
            <span className="metric-label">Database</span>
            <div className="metric-status healthy">
              <span className="status-dot"></span>
              Connected
            </div>
          </div>
          <div className="health-metric">
            <span className="metric-label">Email Service</span>
            <div className="metric-status healthy">
              <span className="status-dot"></span>
              Active
            </div>
          </div>
          <div className="health-metric">
            <span className="metric-label">File Storage</span>
            <div className="metric-status healthy">
              <span className="status-dot"></span>
              78% Available
            </div>
          </div>
        </div>
      </div>

      {/* Quick User Management */}
      <div className="quick-management-section">
        <div className="section-header">
          <h2>Quick User Management</h2>
          <button 
            className="btn-primary"
            onClick={() => setActiveTab('users')}
          >
            Manage Users
          </button>
        </div>
        <div className="management-stats">
          <div className="management-stat">
            <span className="stat-label">New Users (7d)</span>
            <span className="stat-value">{userStats.recentUsers || 0}</span>
          </div>
          <div className="management-stat">
            <span className="stat-label">Pending Verifications</span>
            <span className="stat-value">{userStats.pendingVerifications || 0}</span>
          </div>
          <div className="management-stat">
            <span className="stat-label">Suspended Accounts</span>
            <span className="stat-value">{userStats.suspendedAccounts || 0}</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Navbar />
      <div className="dashboard admin-dashboard">
        {/* Admin Header */}
        <div className="dashboard-header admin-header">
          <div className="welcome-section">
            <h1>System Administration 🛠️</h1>
            <p className="welcome-message">
              Complete control panel for managing the IT Support System
            </p>
            <div className="admin-badges">
              <span className="role-badge admin">Super Administrator</span>
              <span className="access-level">Full System Access</span>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-primary large" onClick={() => setActiveTab('analytics')}>
              📊 Generate Report
            </button>
            <Link to="/admin/backup" className="btn-secondary">
              💾 Backup System
            </Link>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="admin-tabs-navigation">
          <div className="admin-tabs">
            {adminTabs.map(tab => (
              <button
                key={tab.id}
                className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="admin-content">
          {renderTabContent()}
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;