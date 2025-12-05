import React, { useState } from 'react';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useDeactivateUser, useReactivateUser } from '../../hooks/useAdminData';
import CreateUserModal from './CreateUserModal';
import EditUserModal from './EditUserModal';


const UserManagement = () => {
  // State management for UI controls and data
  const [filters, setFilters] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data fetching hooks with React Query
  const { data: usersData, isLoading, error, refetch } = useUsers(filters);
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const deactivateUserMutation = useDeactivateUser();
  const reactivateUserMutation = useReactivateUser();

  // Data processing and normalization
  const users = usersData?.users || [];
  const pagination = usersData || {};

  /**
   * Handles creation of new user accounts
   * @param {Object} userData - User information for account creation
   */
  const handleCreateUser = async (userData) => {
    try {
      await createUserMutation.mutateAsync(userData);
      setShowCreateModal(false);
      refetch();
    } catch (error) {
      console.error('User creation failed:', error);
      alert('Error creating user: ' + error.message);
    }
  };

  /**
   * Handles updating existing user accounts
   * @param {Object} userData - Updated user information
   */
  const handleUpdateUser = async (userData) => {
    try {
      await updateUserMutation.mutateAsync({
        id: editingUser._id,
        userData
      });
      setEditingUser(null);
      refetch();
    } catch (error) {
      console.error('User update failed:', error);
      alert('Error updating user: ' + error.message);
    }
  };

  /**
   * Handles user account deletion with confirmation
   * @param {string} userId - ID of user to delete
   */
  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await deleteUserMutation.mutateAsync(userId);
        refetch();
        alert('User deleted successfully');
      } catch (error) {
        console.error('User deletion failed:', error);
        
        // Enhanced error handling with deactivation option
        if (error.message?.includes('associated tickets')) {
          const user = users.find(u => u._id === userId);
          if (user && confirm('This user has associated tickets and cannot be deleted. Would you like to deactivate them instead? They will not be able to log in but their data will be preserved.')) {
            handleDeactivateUser(userId);
          }
        } else {
          alert('Error deleting user: ' + error.message);
        }
      }
    }
  };

  /**
   * Handles user account deactivation
   * @param {string} userId - ID of user to deactivate
   */
  const handleDeactivateUser = async (userId) => {
    if (window.confirm('Deactivate this user? They will not be able to log in but their data will be preserved.')) {
      try {
        await deactivateUserMutation.mutateAsync(userId);
        refetch();
        alert('User deactivated successfully');
      } catch (error) {
        console.error('User deactivation failed:', error);
        alert('Error deactivating user: ' + error.message);
      }
    }
  };

  /**
   * Handles user account reactivation
   * @param {string} userId - ID of user to reactivate
   */
  const handleReactivateUser = async (userId) => {
    try {
      await reactivateUserMutation.mutateAsync(userId);
      refetch();
      alert('User reactivated successfully');
    } catch (error) {
      console.error('User reactivation failed:', error);
      alert('Error reactivating user: ' + error.message);
    }
  };

  /**
   * Applies search filter to user list
   * @param {string} term - Search term for filtering users
   */
  const handleSearch = (term) => {
    setSearchTerm(term);
    if (term.trim()) {
      setFilters(prev => ({ ...prev, search: term }));
    } else {
      const { search, ...restFilters } = filters;
      setFilters(restFilters);
    }
  };

  /**
   * Applies role-based filter to user list
   * @param {string} role - User role for filtering
   */
  const handleRoleFilter = (role) => {
    if (role && role !== 'all') {
      setFilters(prev => ({ ...prev, role }));
    } else {
      const { role, ...restFilters } = filters;
      setFilters(restFilters);
    }
  };

  /**
   * Applies status filter to user list
   * @param {boolean} isActive - Active status for filtering
   */
  const handleStatusFilter = (isActive) => {
    if (isActive !== undefined) {
      setFilters(prev => ({ ...prev, isActive: isActive.toString() }));
    } else {
      const { isActive, ...restFilters } = filters;
      setFilters(restFilters);
    }
  };

  // Loading and error state handling
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading user data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <h3>Data Loading Error</h3>
        <p>Unable to load user information: {error.message}</p>
        <button onClick={refetch} className="btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="user-management">
      {/* Header section with title and action buttons */}
      <div className="section-header">
        <div className="header-title">
          <h2>User Management</h2>
          <p className="subtitle">
            Manage system user accounts and permissions
          </p>
        </div>
        <div className="header-actions">
          <button 
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
            disabled={createUserMutation.isLoading}
          >
            {createUserMutation.isLoading ? 'Creating...' : 'Create New User'}
          </button>
          <button 
            className="btn-secondary"
            onClick={refetch}
            disabled={isLoading}
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Search and filter controls */}
      <div className="controls-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search users by name, email, or ID..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-controls">
          <select 
            onChange={(e) => handleRoleFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Roles</option>
            <option value="student">Students</option>
            <option value="staff">Staff</option>
            <option value="technician">Technicians</option>
            <option value="admin">Administrators</option>
          </select>
          <select 
            onChange={(e) => handleStatusFilter(e.target.value === 'all' ? undefined : e.target.value === 'active')}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* User statistics summary */}
      <div className="stats-summary">
        <div className="stat-item">
          <span className="stat-value">{pagination.total || 0}</span>
          <span className="stat-label">Total Users</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {users.filter(user => user.isActive).length}
          </span>
          <span className="stat-label">Active Users</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">
            {users.filter(user => user.role === 'admin').length}
          </span>
          <span className="stat-label">Administrators</span>
        </div>
      </div>

      {/* Users data table */}
      <div className="users-table-container">
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>User Information</th>
                <th>Contact</th>
                <th>Role</th>
                <th>Department</th>
                <th>Account Status</th>
                <th>Management Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    <div className="empty-icon">👥</div>
                    <h3>No Users Found</h3>
                    <p>
                      {Object.keys(filters).length > 0 
                        ? 'No users match your current filters' 
                        : 'No user accounts have been created yet'
                      }
                    </p>
                    {Object.keys(filters).length > 0 && (
                      <button 
                        onClick={() => setFilters({})}
                        className="btn-secondary"
                      >
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user._id} className="user-row">
                    <td className="user-info">
                      <div className="user-avatar">
                        {user.username?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="user-details">
                        <strong className="username">{user.username}</strong>
                        <div 
                          className="view-details-link"
                          onClick={() => setViewingUser(user)}
                        >
                          View complete profile
                        </div>
                      </div>
                    </td>
                    <td className="contact-info">
                      <div className="email">{user.email}</div>
                      {user.phone && (
                        <div className="phone">{user.phone}</div>
                      )}
                    </td>
                    <td>
                      <span className={`role-badge ${user.role}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="department">
                      {user.department}
                    </td>
                    <td className="status-cell">
                      <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {user.isVerified && (
                        <div className="verification-status">
                          <span className="verified-indicator">✓</span>
                          Verified
                        </div>
                      )}
                    </td>
                    <td className="action-buttons">
                      <button 
                        className="btn-sm edit-btn"
                        onClick={() => setEditingUser(user)}
                        title="Edit user account"
                      >
                        Edit
                      </button>
                      <button 
                        className="btn-sm view-btn"
                        onClick={() => setViewingUser(user)}
                        title="View user details"
                      >
                        View
                      </button>
                      <button 
                        className="btn-sm danger delete-btn"
                        onClick={() => handleDeleteUser(user._id)}
                        disabled={deleteUserMutation.isLoading}
                        title="Delete user account (only if no tickets)"
                      >
                        {deleteUserMutation.isLoading ? 'Deleting...' : 'Delete'}
                      </button>
                      {user.isActive ? (
                        <button 
                          className="btn-sm warning-btn"
                          onClick={() => handleDeactivateUser(user._id)}
                          disabled={deactivateUserMutation.isLoading}
                          title="Deactivate user (cannot login but data preserved)"
                        >
                          {deactivateUserMutation.isLoading ? 'Deactivating...' : 'Deactivate'}
                        </button>
                      ) : (
                        <button 
                          className="btn-sm success-btn"
                          onClick={() => handleReactivateUser(user._id)}
                          disabled={reactivateUserMutation.isLoading}
                          title="Reactivate user account"
                        >
                          {reactivateUserMutation.isLoading ? 'Reactivating...' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination information */}
      {pagination.totalPages > 1 && (
        <div className="pagination-section">
          <div className="pagination-info">
            <span>
              Displaying {users.length} of {pagination.total} user accounts
            </span>
            {pagination.totalPages > 1 && (
              <span className="page-info">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
            )}
          </div>
          {pagination.totalPages > 1 && (
            <div className="pagination-controls">
              <button 
                disabled={!pagination.hasPrevPage}
                onClick={() => setFilters(prev => ({ ...prev, page: pagination.currentPage - 1 }))}
                className="pagination-btn"
              >
                Previous
              </button>
              <button 
                disabled={!pagination.hasNextPage}
                onClick={() => setFilters(prev => ({ ...prev, page: pagination.currentPage + 1 }))}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal 
          onSubmit={handleCreateUser}
          onClose={() => setShowCreateModal(false)}
          loading={createUserMutation.isLoading}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal 
          user={editingUser}
          onSubmit={handleUpdateUser}
          onClose={() => setEditingUser(null)}
          loading={updateUserMutation.isLoading}
        />
      )}

      {/* User Details View Modal */}
      {viewingUser && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h3>User Account Details</h3>
              <button 
                onClick={() => setViewingUser(null)}
                className="close-btn"
              >
                ×
              </button>
            </div>
            <div className="user-profile">
              <div className="profile-header">
                <div className="profile-avatar">
                  {viewingUser.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="profile-info">
                  <h4>{viewingUser.username}</h4>
                  <p className="user-email">{viewingUser.email}</p>
                  <div className="profile-badges">
                    <span className={`role-badge ${viewingUser.role}`}>
                      {viewingUser.role}
                    </span>
                    <span className={`status-badge ${viewingUser.isActive ? 'active' : 'inactive'}`}>
                      {viewingUser.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {viewingUser.isVerified && (
                      <span className="verified-badge">Verified</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="profile-details">
                <div className="details-grid">
                  <div className="detail-group">
                    <label>Department</label>
                    <span>{viewingUser.department}</span>
                  </div>
                  <div className="detail-group">
                    <label>Student ID</label>
                    <span>{viewingUser.studentId || 'Not provided'}</span>
                  </div>
                  <div className="detail-group">
                    <label>Phone Number</label>
                    <span>{viewingUser.phone || 'Not provided'}</span>
                  </div>
                  <div className="detail-group">
                    <label>Account Created</label>
                    <span>{new Date(viewingUser.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="detail-group">
                    <label>Last Updated</label>
                    <span>{new Date(viewingUser.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="detail-group">
                    <label>User ID</label>
                    <span className="user-id">{viewingUser._id}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => {
                  setViewingUser(null);
                  setEditingUser(viewingUser);
                }}
                className="btn-primary"
              >
                Edit User Account
              </button>
              {viewingUser.isActive ? (
                <button 
                  onClick={() => {
                    setViewingUser(null);
                    handleDeactivateUser(viewingUser._id);
                  }}
                  className="btn-warning"
                >
                  Deactivate User
                </button>
              ) : (
                <button 
                  onClick={() => {
                    setViewingUser(null);
                    handleReactivateUser(viewingUser._id);
                  }}
                  className="btn-success"
                >
                  Reactivate User
                </button>
              )}
              <button 
                onClick={() => setViewingUser(null)}
                className="btn-secondary"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;