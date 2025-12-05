import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ticketService from '../services/ticketService';
import userService from '../services/userService';
import '../styles/Reports.css';

const Reports = () => {
  const [reportData, setReportData] = useState([]);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    issueType: ''
  });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await userService.getDashboardStats();
      setStats(response);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const response = await ticketService.getTickets(filters);
      setReportData(response.tickets);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handlePrint = () => {
    window.print();
  };

  const exportToCSV = () => {
    const headers = ['Ticket ID', 'Title', 'Status', 'Urgency', 'Issue Type', 'Created Date', 'Assigned To'];
    const csvData = reportData.map(ticket => [
      ticket.ticketId,
      ticket.title,
      ticket.status,
      ticket.urgency,
      ticket.issueType,
      new Date(ticket.createdAt).toLocaleDateString(),
      ticket.assignedTo?.username || 'Unassigned'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      <Navbar />
      <div className="reports-page">
        <div className="reports-header">
          <h1>Ticket Reports</h1>
          <div className="report-actions">
            <button onClick={handlePrint} className="btn-secondary">
              Print Report
            </button>
            <button 
              onClick={exportToCSV} 
              disabled={reportData.length === 0}
              className="btn-primary"
            >
              Export to CSV
            </button>
          </div>
        </div>

        {/* Report Filters */}
        <div className="report-filters">
          <h3>Generate Custom Report</h3>
          <div className="filter-grid">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Issue Type</label>
              <select
                value={filters.issueType}
                onChange={(e) => handleFilterChange('issueType', e.target.value)}
              >
                <option value="">All Types</option>
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
                <option value="network">Network</option>
                <option value="account">Account</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          
          <button 
            onClick={generateReport}
            disabled={generating}
            className="btn-primary generate-btn"
          >
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>

        {/* Statistics */}
        <div className="report-stats">
          <h3>System Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Total Tickets</h4>
              <div className="stat-number">{stats.totalTickets || 0}</div>
            </div>
            <div className="stat-card">
              <h4>Open Tickets</h4>
              <div className="stat-number">{stats.openTickets || 0}</div>
            </div>
            <div className="stat-card">
              <h4>In Progress</h4>
              <div className="stat-number">{stats.inProgressTickets || 0}</div>
            </div>
            <div className="stat-card">
              <h4>Resolved</h4>
              <div className="stat-number">{stats.resolvedTickets || 0}</div>
            </div>
          </div>
        </div>

        {/* Report Results */}
        {reportData.length > 0 && (
          <div className="report-results">
            <h3>Report Results ({reportData.length} tickets)</h3>
            <div className="report-table-container">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Urgency</th>
                    <th>Issue Type</th>
                    <th>Created Date</th>
                    <th>Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map(ticket => (
                    <tr key={ticket._id}>
                      <td>{ticket.ticketId}</td>
                      <td>{ticket.title}</td>
                      <td>
                        <span className={`status-badge status-${ticket.status}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td>
                        <span className={`urgency-badge urgency-${ticket.urgency}`}>
                          {ticket.urgency}
                        </span>
                      </td>
                      <td>{ticket.issueType}</td>
                      <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                      <td>{ticket.assignedTo?.username || 'Unassigned'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Reports;