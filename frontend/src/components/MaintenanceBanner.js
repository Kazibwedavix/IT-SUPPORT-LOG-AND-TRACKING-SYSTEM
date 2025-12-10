// src/components/MaintenanceBanner.js
import React from 'react';

const MaintenanceBanner = ({ onResume }) => {
  const handleResume = () => {
    // Double-check before resuming
    const confirmResume = window.confirm(
      'Are you sure you want to resume access? Maintenance mode was activated for a reason.'
    );
    
    if (confirmResume) {
      onResume();
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1a202c',
      backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '600px',
        textAlign: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          fontSize: '60px',
          marginBottom: '24px',
          color: '#667eea'
        }}>
          🛠️
        </div>
        
        <h1 style={{
          fontSize: '32px',
          color: '#2d3748',
          marginBottom: '16px',
          fontWeight: '700'
        }}>
          System Maintenance
        </h1>
        
        <p style={{
          color: '#4a5568',
          marginBottom: '32px',
          lineHeight: '1.8',
          fontSize: '18px'
        }}>
          The Bugema University IT Support System is currently undergoing scheduled maintenance to improve performance and security.
        </p>
        
        <div style={{
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          padding: '24px',
          borderRadius: '12px',
          marginBottom: '32px',
          border: '1px solid rgba(102, 126, 234, 0.2)'
        }}>
          <h3 style={{
            color: '#4a5568',
            marginBottom: '16px',
            fontSize: '18px',
            fontWeight: '600'
          }}>
            📅 Maintenance Schedule
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            textAlign: 'left',
            marginBottom: '16px'
          }}>
            <div>
              <div style={{ color: '#718096', fontSize: '14px' }}>Start Time</div>
              <div style={{ color: '#4a5568', fontWeight: '500' }}>9:00 PM EAT</div>
            </div>
            <div>
              <div style={{ color: '#718096', fontSize: '14px' }}>Expected End</div>
              <div style={{ color: '#4a5568', fontWeight: '500' }}>12:00 AM EAT</div>
            </div>
          </div>
          
          <p style={{
            color: '#718096',
            fontSize: '14px',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(102, 126, 234, 0.1)'
          }}>
            <strong>Impact:</strong> All services will be temporarily unavailable during this window.
          </p>
        </div>
        
        <div style={{
          backgroundColor: '#f7fafc',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '32px',
          textAlign: 'left'
        }}>
          <h4 style={{
            color: '#4a5568',
            marginBottom: '12px',
            fontSize: '16px',
            fontWeight: '600'
          }}>
            📋 During Maintenance
          </h4>
          <ul style={{
            color: '#718096',
            paddingLeft: '20px',
            margin: 0,
            lineHeight: '1.8'
          }}>
            <li>System will be in read-only mode</li>
            <li>New ticket creation disabled</li>
            <li>Email notifications paused</li>
            <li>Report generation unavailable</li>
          </ul>
        </div>
        
        <div style={{ marginBottom: '32px' }}>
          <p style={{
            color: '#4a5568',
            marginBottom: '16px',
            fontSize: '16px'
          }}>
            <strong>🚨 Emergency Support</strong>
          </p>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'center'
          }}>
            <a 
              href="tel:+256784845785"
              style={{
                color: '#667eea',
                textDecoration: 'none',
                fontSize: '18px',
                fontWeight: '600'
              }}
            >
              📞 +256 784-845-785
            </a>
            <a 
              href="mailto:support@bugemauniv.ac.ug"
              style={{
                color: '#667eea',
                textDecoration: 'none',
                fontSize: '16px'
              }}
            >
              📧 support@bugemauniv.ac.ug
            </a>
          </div>
        </div>
        
        <button
          onClick={handleResume}
          style={{
            backgroundColor: '#667eea',
            color: 'white',
            border: 'none',
            padding: '16px 40px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = '#5a67d8';
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 8px rgba(102, 126, 234, 0.4)';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = '#667eea';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 6px rgba(102, 126, 234, 0.3)';
          }}
        >
          Resume System Access
        </button>
        
        <p style={{
          color: '#a0aec0',
          fontSize: '12px',
          marginTop: '32px',
          paddingTop: '16px',
          borderTop: '1px solid #e2e8f0'
        }}>
          Bugema University IT Support System • Version {process.env.REACT_APP_VERSION || '2.0.0'}
        </p>
      </div>
    </div>
  );
};

export default MaintenanceBanner;