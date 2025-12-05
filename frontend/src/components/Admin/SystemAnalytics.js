import React from 'react';
import { useDashboardData } from '../../hooks/useAdminData';

const SystemAnalytics = () => {
  const { data, isLoading } = useDashboardData();

  if (isLoading) return <div className="loading">Loading analytics...</div>;

  return (
    <div className="system-analytics">
      <h2>System Analytics & Reports</h2>
      
      <div className="analytics-grid">
        <div className="analytics-card">
          <h3>User Statistics</h3>
          {data?.userStats && (
            <div>
              <p><strong>Total Users:</strong> {data.userStats.totalUsers}</p>
              <p><strong>Active Users:</strong> {data.userStats.activeUsers}</p>
              <p><strong>Students:</strong> {data.userStats.students}</p>
              <p><strong>Staff:</strong> {data.userStats.staff}</p>
              <p><strong>Technicians:</strong> {data.userStats.technicians}</p>
              <p><strong>Admins:</strong> {data.userStats.admins}</p>
            </div>
          )}
        </div>

        <div className="analytics-card">
          <h3>Ticket Statistics</h3>
          {data?.systemStats && (
            <div>
              <p><strong>Total Tickets:</strong> {data.systemStats.totalTickets}</p>
              <p><strong>Open Tickets:</strong> {data.systemStats.openTickets}</p>
              <p><strong>Resolved Tickets:</strong> {data.systemStats.resolvedTickets}</p>
              <p><strong>Closed Tickets:</strong> {data.systemStats.closedTickets}</p>
            </div>
          )}
        </div>

        <div className="analytics-card">
          <h3>System Performance</h3>
          {data?.systemStats && (
            <div>
              <p><strong>Uptime:</strong> {data.systemStats.systemUptime}</p>
              <p><strong>Active Sessions:</strong> {data.systemStats.activeSessions}</p>
              <p><strong>SLA Compliance:</strong> {data.systemStats.slaCompliance}%</p>
              <p><strong>Avg Resolution Time:</strong> {data.systemStats.avgResolutionTime || 'N/A'} hours</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemAnalytics;