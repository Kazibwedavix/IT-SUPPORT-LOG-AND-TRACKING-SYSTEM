import React, { useState, useEffect } from 'react';

const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState('');

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNotificationType('online');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setNotificationType('offline');
      setShowNotification(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showNotification) return null;

  const styles = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '12px 20px',
    borderRadius: '8px',
    color: 'white',
    zIndex: 9999,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    animation: 'slideIn 0.3s ease'
  };

  const onlineStyle = {
    ...styles,
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
  };

  const offlineStyle = {
    ...styles,
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
  };

  return (
    <div style={notificationType === 'online' ? onlineStyle : offlineStyle}>
      <span style={{ fontSize: '20px' }}>
        {notificationType === 'online' ? '✅' : '⚠️'}
      </span>
      <div>
        <div style={{ fontWeight: 'bold' }}>
          {notificationType === 'online' ? 'Back Online' : 'Connection Lost'}
        </div>
        <div style={{ fontSize: '14px', opacity: 0.9 }}>
          {notificationType === 'online' 
            ? 'Your connection has been restored.' 
            : 'Please check your internet connection.'}
        </div>
      </div>
      <button
        onClick={() => setShowNotification(false)}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: 'white',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '4px',
          marginLeft: '10px'
        }}
      >
        ×
      </button>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default ConnectionStatus;