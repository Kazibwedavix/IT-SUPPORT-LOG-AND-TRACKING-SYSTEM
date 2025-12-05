import React from 'react';

const StatisticsCards = ({ userStats, systemStats }) => {
  const stats = [
    {
      title: 'Total Users',
      value: userStats?.totalUsers || 0,
      icon: '👥',
      color: 'blue'
    },
    {
      title: 'Active Users',
      value: userStats?.activeUsers || 0,
      icon: '✅',
      color: 'green'
    },
    {
      title: 'Total Tickets',
      value: systemStats?.totalTickets || 0,
      icon: '🎫',
      color: 'orange'
    },
    {
      title: 'Open Tickets',
      value: systemStats?.openTickets || 0,
      icon: '🔓',
      color: 'red'
    }
  ];

  return (
    <div className="stats-cards">
      {stats.map((stat, index) => (
        <div key={index} className={`stat-card ${stat.color}`}>
          <div className="stat-icon">{stat.icon}</div>
          <div className="stat-content">
            <h3>{stat.value}</h3>
            <p>{stat.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatisticsCards;