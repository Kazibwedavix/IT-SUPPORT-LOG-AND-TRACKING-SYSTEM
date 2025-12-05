import React from 'react';
import '../styles/StatCard.css';

const StatCard = ({ title, value, change, changeType, icon, color = 'primary', description }) => {
  const getChangeIcon = () => {
    if (!change) return null;
    return changeType === 'increase' ? '↗️' : '↘️';
  };

  const getChangeClass = () => {
    if (!change) return '';
    return changeType === 'increase' ? 'positive' : 'negative';
  };

  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-header">
        <div className="stat-icon">{icon}</div>
        <div className="stat-info">
          <h3 className="stat-title">{title}</h3>
          {description && <p className="stat-description">{description}</p>}
        </div>
      </div>
      
      <div className="stat-value">{value}</div>
      
      {change !== undefined && (
        <div className={`stat-change ${getChangeClass()}`}>
          <span className="change-icon">{getChangeIcon()}</span>
          <span className="change-value">{Math.abs(change)}%</span>
          <span className="change-label">from previous period</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;