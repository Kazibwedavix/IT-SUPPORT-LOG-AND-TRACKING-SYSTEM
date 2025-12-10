import React, { useState, useEffect } from 'react';

const SystemStatusBar = () => {
  const [visible, setVisible] = useState(true);
  const [latency, setLatency] = useState(null);

  useEffect(() => {
    // Check backend latency
    const checkLatency = async () => {
      const start = performance.now();
      try {
        await fetch('http://localhost:5002/api/health');
        const end = performance.now();
        setLatency(Math.round(end - start));
      } catch (error) {
        setLatency(null);
      }
    };

    checkLatency();
    const interval = setInterval(checkLatency, 30000);

    // Auto-hide after 15 seconds
    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, 15000);

    return () => {
      clearInterval(interval);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      padding: '10px 20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 10000,
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      animation: 'slideDown 0.3s ease'
    }}>
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
      `}</style>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '18px' }}>✅</span>
        <span>IT Support System - Development Mode</span>
        {latency && (
          <span style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '12px'
          }}>
            Latency: {latency}ms
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          Refresh
        </button>
        <button
          onClick={() => setVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '20px',
            cursor: 'pointer',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%'
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default SystemStatusBar;