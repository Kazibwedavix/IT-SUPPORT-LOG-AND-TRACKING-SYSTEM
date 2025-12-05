import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/QuickActionCard.css';

const QuickActionCard = ({ label, description, icon, path, action, color = 'primary', emergency = false }) => {
  const CardContent = () => (
    <div className={`quick-action-card ${color} ${emergency ? 'emergency' : ''}`}>
      <div className="action-icon">{icon}</div>
      <div className="action-content">
        <h4 className="action-label">{label}</h4>
        <p className="action-description">{description}</p>
      </div>
      <div className="action-arrow">→</div>
    </div>
  );

  if (path) {
    return (
      <Link to={path} className="quick-action-link">
        <CardContent />
      </Link>
    );
  }

  return (
    <button onClick={action} className="quick-action-button">
      <CardContent />
    </button>
  );
};

export default QuickActionCard;