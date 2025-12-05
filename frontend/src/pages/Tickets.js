import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TicketCard from '../components/TicketCard';
import ticketService from '../services/ticketService';
import '../styles/Tickets.css';

// Constants
const CONFIG = {
  PAGE_SIZE: 10,
  DEBOUNCE_DELAY: 300,
  MAX_BULK_SELECTION: 50
};

// Debounce utility
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const Tickets = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const abortControllerRef = useRef(null);
  
  // State
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [exporting, setExporting] = useState(false);
  const [processingBulk, setProcessingBulk] = useState(false);
  
  const [filters, setFilters] = useState({
    status: '',
    urgency: '',
    issueType: '',
    assignedTo: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    page: 1,
    limit: CONFIG.PAGE_SIZE,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  
  const [pagination, setPagination] = useState({
    totalPages: 1,
    currentPage: 1,
    total: 0,
    hasNext: false,
    hasPrev: false
  });

  // Authentication check
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError('');
      
      const response = await ticketService.getTickets(filters);
      
      if (response?.success) {
        // Extract tickets from response
        const ticketsData = extractTicketsData(response);
        const paginationData = extractPaginationData(response);
        
        setTickets(ticketsData);
        setPagination(paginationData);
        
        // Clean up selections that no longer exist
        if (selectedTickets.size > 0) {
          const validIds = new Set(ticketsData.map(t => t._id));
          const newSelection = new Set(
            Array.from(selectedTickets).filter(id => validIds.has(id))
          );
          if (newSelection.size !== selectedTickets.size) {
            setSelectedTickets(newSelection);
          }
        }
      } else {
        throw new Error(response?.message || 'Failed to load tickets');
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      
      console.error('Error fetching tickets:', error);
      setError(error.message || 'Failed to load tickets. Please try again.');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [filters, selectedTickets]);

  // Initial fetch and filter changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchTickets();
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchTickets, isAuthenticated]);

  // Extract tickets from API response
  const extractTicketsData = (response) => {
    const possiblePaths = [
      response.data?.tickets,
      response.tickets,
      response.data?.data?.tickets,
      response.data,
      response
    ];
    
    for (const path of possiblePaths) {
      if (Array.isArray(path)) {
        return path.filter(ticket => 
          ticket && 
          (ticket._id || ticket.id) && 
          typeof ticket === 'object'
        );
      }
    }
    
    return [];
  };

  // Extract pagination from API response
  const extractPaginationData = (response) => {
    const total = response.total || response.data?.total || 0;
    const currentPage = response.currentPage || response.data?.currentPage || filters.page;
    const totalPages = response.totalPages || response.data?.totalPages || Math.ceil(total / CONFIG.PAGE_SIZE) || 1;
    
    return {
      total,
      currentPage,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1
    };
  };

  // Handlers
  const debouncedSearch = useCallback(
    debounce((value) => {
      setFilters(prev => ({
        ...prev,
        search: value.trim(),
        page: 1
      }));
    }, CONFIG.DEBOUNCE_DELAY),
    []
  );

  const handleSearch = (e) => {
    debouncedSearch(e.target.value);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1
    }));
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setFilters(prev => ({ ...prev, page: newPage }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      urgency: '',
      issueType: '',
      assignedTo: '',
      dateFrom: '',
      dateTo: '',
      search: '',
      page: 1,
      limit: CONFIG.PAGE_SIZE,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    setSelectedTickets(new Set());
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedTickets.size === 0) return;
    
    try {
      setProcessingBulk(true);
      
      await ticketService.bulkUpdateStatus(
        Array.from(selectedTickets), 
        bulkAction,
        `Bulk action by ${user?.email || 'user'}`
      );
      
      await fetchTickets();
      setSelectedTickets(new Set());
      setBulkAction('');
      
    } catch (error) {
      console.error('Bulk update error:', error);
      setError('Bulk update failed. Please try again.');
    } finally {
      setProcessingBulk(false);
    }
  };

  const handleTicketSelect = (ticketId) => {
    if (!ticketId) return;
    
    setSelectedTickets(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(ticketId)) {
        newSelection.delete(ticketId);
      } else {
        newSelection.add(ticketId);
      }
      return newSelection;
    });
  };

  const selectAllTickets = () => {
    if (tickets.length === 0) return;
    
    const validTicketIds = tickets
      .map(ticket => ticket._id)
      .filter(id => id);
    
    if (selectedTickets.size === validTicketIds.length) {
      setSelectedTickets(new Set());
    } else {
      setSelectedTickets(new Set(validTicketIds));
    }
  };

  const exportTickets = async () => {
    try {
      setExporting(true);
      
      const blob = await ticketService.exportTickets(filters, 'csv');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().split('T')[0];
      
      a.href = url;
      a.download = `tickets-${timestamp}.csv`;
      a.style.display = 'none';
      
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
    } catch (error) {
      console.error('Export error:', error);
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const navigateToCreateTicket = () => {
    navigate('/tickets/create');
  };

  const navigateToTicketDetail = (ticketId) => {
    if (ticketId) {
      navigate(`/tickets/${ticketId}`);
    }
  };

  // Loading state
  if (loading && tickets.length === 0) {
    return (
      <>
        <Navbar />
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading tickets...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="tickets-page">
        {/* Header */}
        <div className="tickets-header">
          <div>
            <h1>{user?.role === 'staff' ? 'My Support Tickets' : 'Ticket Management'}</h1>
            <p className="page-subtitle">Track and manage your support requests</p>
          </div>
          <div className="header-actions">
            {user?.role === 'staff' && (
              <button
                onClick={navigateToCreateTicket}
                className="btn-primary"
              >
                + Create Ticket
              </button>
            )}
            <button
              onClick={exportTickets}
              className="btn-secondary"
              disabled={exporting || tickets.length === 0}
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <span>{error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* Filters */}
        <div className="filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search tickets by title, description, or ID..."
              onChange={handleSearch}
              defaultValue={filters.search}
            />
          </div>

          <div className="filter-grid">
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="awaiting-user">Awaiting User</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <select
              value={filters.urgency}
              onChange={(e) => handleFilterChange('urgency', e.target.value)}
            >
              <option value="">All Urgency</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>

            <select
              value={filters.issueType}
              onChange={(e) => handleFilterChange('issueType', e.target.value)}
            >
              <option value="">All Types</option>
              <option value="hardware">Hardware</option>
              <option value="software">Software</option>
              <option value="network">Network</option>
              <option value="account">Account</option>
              <option value="security">Security</option>
              <option value="other">Other</option>
            </select>

            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              placeholder="From Date"
            />
            
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              placeholder="To Date"
              min={filters.dateFrom}
            />

            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            >
              <option value="createdAt">Newest First</option>
              <option value="updatedAt">Recently Updated</option>
              <option value="urgency">High Urgency</option>
              <option value="title">Title A-Z</option>
            </select>

            <button onClick={clearFilters} className="btn-secondary">
              Clear Filters
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedTickets.size > 0 && (
          <div className="bulk-actions">
            <div className="bulk-info">
              <span>{selectedTickets.size} ticket(s) selected</span>
            </div>
            <div className="bulk-controls">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                disabled={processingBulk}
              >
                <option value="">Bulk Actions</option>
                <option value="in-progress">Mark In Progress</option>
                <option value="resolved">Mark Resolved</option>
                <option value="closed">Mark Closed</option>
                <option value="reopen">Reopen</option>
              </select>
              
              <button
                onClick={handleBulkAction}
                className="btn-primary"
                disabled={!bulkAction || processingBulk}
              >
                {processingBulk ? 'Processing...' : 'Apply'}
              </button>
              
              <button
                onClick={() => setSelectedTickets(new Set())}
                className="btn-secondary"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Tickets List */}
        <div className="tickets-container">
          {tickets.length === 0 ? (
            <div className="no-tickets">
              <div className="empty-icon">📋</div>
              <h3>No Tickets Found</h3>
              <p>
                {filters.search || filters.status ? 
                  'No tickets match your filters. Try adjusting your criteria.' :
                  "You haven't created any tickets yet."
                }
              </p>
              {user?.role === 'staff' && (
                <button
                  onClick={navigateToCreateTicket}
                  className="btn-primary"
                >
                  Create Your First Ticket
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="tickets-stats">
                <div className="stats-header">
                  <p>
                    Showing {tickets.length} of {pagination.total} tickets
                    <span className="page-info">
                      (Page {pagination.currentPage} of {pagination.totalPages})
                    </span>
                  </p>
                  <div className="select-all">
                    <input
                      type="checkbox"
                      checked={selectedTickets.size === tickets.length && tickets.length > 0}
                      onChange={selectAllTickets}
                      disabled={tickets.length === 0}
                    />
                    <span>Select All</span>
                  </div>
                </div>
              </div>
              
              <div className="tickets-grid">
                {tickets.map(ticket => (
                  <div 
                    key={ticket._id} 
                    className="ticket-card-wrapper"
                    onClick={() => navigateToTicketDetail(ticket._id)}
                  >
                    <input
                      type="checkbox"
                      className="ticket-select"
                      checked={selectedTickets.has(ticket._id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleTicketSelect(ticket._id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <TicketCard ticket={ticket} />
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => handlePageChange(pagination.currentPage - 1)}
                    disabled={!pagination.hasPrev || loading}
                    className="pagination-btn"
                  >
                    Previous
                  </button>
                  
                  <div className="pagination-info">
                    <span>
                      Page {pagination.currentPage} of {pagination.totalPages}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(pagination.currentPage + 1)}
                    disabled={!pagination.hasNext || loading}
                    className="pagination-btn"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Tickets;