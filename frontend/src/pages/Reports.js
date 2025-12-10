import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const Reports = () => {
  const { user } = useAuth();

  return (
    <div>
      <Navbar />
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1>Reports</h1>
        <p>Welcome, {user?.name}. This is the reports page.</p>
        <Link to="/dashboard">Back to Dashboard</Link>
      </div>
    </div>
  );
};

export default Reports;