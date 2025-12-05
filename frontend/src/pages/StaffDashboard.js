import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TicketCard from '../components/TicketCard';
import ticketService from '../services/ticketService';
import '../styles/Dashboard.css';

const StaffDashboard = () => {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await ticketService.getTickets({ limit: 5 });
      setTickets(response.tickets);
      
      // Calculate stats
      const total = response.tickets.length;
      const open = response.tickets.filter(t => t.status === 'open').length;
      const inProgress = response.tickets.filter(t => t.status === 'in-progress').length;
      const resolved = response.tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
      
      setStats({ total, open, inProgress, resolved });
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="loading">Loading dashboard...</div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="dashboard">
        <div className="dashboard-header">
          <h1>Staff Dashboard</h1>
          <Link to="/create-ticket" className="btn-primary">
            Create New Ticket
          </Link>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Tickets</h3>
            <div className="stat-number">{stats.total}</div>
          </div>
          <div className="stat-card">
            <h3>Open</h3>
            <div className="stat-number">{stats.open}</div>
          </div>
          <div className="stat-card">
            <h3>In Progress</h3>
            <div className="stat-number">{stats.inProgress}</div>
          </div>
          <div className="stat-card">
            <h3>Resolved</h3>
            <div className="stat-number">{stats.resolved}</div>
          </div>
        </div>

        <div className="recent-tickets">
          <h2>Recent Tickets</h2>
          {tickets.length === 0 ? (
            <p>No tickets found. <Link to="/create-ticket">Create your first ticket</Link></p>
          ) : (
            <div className="tickets-grid">
              {tickets.map(ticket => (
                <TicketCard key={ticket._id} ticket={ticket} />
              ))}
            </div>
          )}
          <div className="view-all">
            <Link to="/tickets" className="btn-secondary">
              View All Tickets
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default StaffDashboard;