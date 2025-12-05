import React, { useState, useEffect } from 'react';

const EditUserModal = ({ user, onSubmit, onClose, loading }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: 'student',
    department: 'General',
    isActive: true,
    isVerified: false,
    studentId: '',
    phone: ''
  });

  // Initialize form with user data when modal opens
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        email: user.email || '',
        role: user.role || 'student',
        department: user.department || 'General',
        isActive: user.isActive !== undefined ? user.isActive : true,
        isVerified: user.isVerified !== undefined ? user.isVerified : false,
        studentId: user.studentId || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (!user) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Edit User: {user.username}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username:</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              minLength="3"
            />
          </div>

          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Role:</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="student">Student</option>
              <option value="staff">Staff</option>
              <option value="technician">Technician</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="form-group">
            <label>Department:</label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Student ID:</label>
            <input
              type="text"
              name="studentId"
              value={formData.studentId}
              onChange={handleChange}
              placeholder="Optional"
            />
          </div>

          <div className="form-group">
            <label>Phone:</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Optional"
            />
          </div>

          <div className="form-row">
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                />
                Active User
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="isVerified"
                  checked={formData.isVerified}
                  onChange={handleChange}
                />
                Email Verified
              </label>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;