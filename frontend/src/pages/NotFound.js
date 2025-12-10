// src/pages/NotFound.js
import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import '../styles/NotFound.css';

const NotFound = () => {
  return (
    <div>
      <Navbar />
      <div className="not-found-container">
        <div className="not-found-content">
          <div className="not-found-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/>
            </svg>
          </div>
          
          <h1 className="not-found-title">404 - Page Not Found</h1>
          
          <p className="not-found-message">
            The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </p>
          
          <div className="not-found-actions">
            <Link to="/dashboard" className="btn-primary">
              Go to Dashboard
            </Link>
            <Link to="/tickets" className="btn-secondary">
              View Tickets
            </Link>
            <button 
              onClick={() => window.history.back()} 
              className="btn-text"
            >
              Go Back
            </button>
          </div>
          
          <div className="not-found-help">
            <h3>Need Help?</h3>
            <div className="help-options">
              <div className="help-option">
                <div className="help-icon">📞</div>
                <div>
                  <h4>IT Help Desk</h4>
                  <p>+256 784-845-785</p>
                </div>
              </div>
              
              <div className="help-option">
                <div className="help-icon">📧</div>
                <div>
                  <h4>Email Support</h4>
                  <p>support@bugemauniv.ac.ug</p>
                </div>
              </div>
              
              <div className="help-option">
                <div className="help-icon">🏢</div>
                <div>
                  <h4>IT Office</h4>
                  <p>Main Building, Room 205</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="not-found-search">
            <h4>Try Searching</h4>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search for tickets, users, or help articles..."
                className="search-input"
              />
              <button className="search-button">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div className="not-found-footer">
            <p>
              <strong>Bugema University IT Support System</strong> • 
              Version {process.env.REACT_APP_VERSION || '2.0.0'}
            </p>
            <p className="timestamp">
              Error occurred at: {new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;