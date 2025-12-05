import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">BU  IT Support System</Link>
      </div>
      
      <div className="navbar-menu">
        {user && (
          <>
            {user.role === 'staff' ? (
              <>
                <Link to="/staff" className="navbar-item">Dashboard</Link>
                <Link to="/create-ticket" className="navbar-item">Create Ticket</Link>
                <Link to="/tickets" className="navbar-item">My Tickets</Link>
              </>
            ) : (
              <>
                <Link to="/admin" className="navbar-item">Dashboard</Link>
                <Link to="/tickets" className="navbar-item">All Tickets</Link>
                <Link to="/reports" className="navbar-item">Reports</Link>
              </>
            )}
            
            <div className="navbar-user">
              <span>Welcome, {user.username}</span>
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;