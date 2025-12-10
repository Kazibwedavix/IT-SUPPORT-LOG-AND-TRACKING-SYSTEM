// src/components/LoadingScreen.js
import React, { useState, useEffect } from 'react';

const LoadingScreen = ({ message = "Loading...", subtitle = "Please wait", showProgress = true }) => {
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (showProgress) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) return 100;
          return prev + 1;
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [showProgress]);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(dotInterval);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f7fafc',
      backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      color: 'white'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '500px',
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Logo */}
        <div style={{
          marginBottom: '32px'
        }}>
          <div style={{
            fontSize: '64px',
            color: '#667eea',
            marginBottom: '16px'
          }}>
            🛠️
          </div>
          <h1 style={{
            fontSize: '28px',
            color: '#2d3748',
            marginBottom: '8px',
            fontWeight: '700'
          }}>
            Bugema University IT Support System
          </h1>
          <p style={{
            color: '#718096',
            fontSize: '14px',
            letterSpacing: '1px'
          }}>
            ENTERPRISE IT SUPPORT MANAGEMENT
          </p>
        </div>
        
        {/* Loading Content */}
        <div style={{
          marginBottom: '32px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 24px'
          }} />
          
          <h2 style={{
            fontSize: '24px',
            color: '#4a5568',
            marginBottom: '12px',
            fontWeight: '600'
          }}>
            {message}
            <span style={{ color: '#667eea' }}>{dots}</span>
          </h2>
          
          <p style={{
            color: '#718096',
            fontSize: '16px',
            marginBottom: '32px'
          }}>
            {subtitle}
          </p>
        </div>
        
        {/* Progress Bar */}
        {showProgress && (
          <div style={{
            marginBottom: '32px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <span style={{ color: '#4a5568', fontSize: '14px', fontWeight: '500' }}>
                Initializing Services
              </span>
              <span style={{ color: '#667eea', fontSize: '14px', fontWeight: '600' }}>
                {progress}%
              </span>
            </div>
            <div style={{
              width: '100%',
              backgroundColor: '#edf2f7',
              borderRadius: '9999px',
              height: '8px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress}%`,
                backgroundColor: '#667eea',
                height: '100%',
                borderRadius: '9999px',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        )}
        
        {/* Loading Steps */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '32px'
        }}>
          {[
            { text: 'Authentication', active: progress > 20 },
            { text: 'Database', active: progress > 40 },
            { text: 'API Services', active: progress > 60 },
            { text: 'User Interface', active: progress > 80 }
          ].map((step, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: step.active ? '#38a169' : '#e2e8f0',
                transition: 'background-color 0.3s'
              }} />
              <span style={{
                color: step.active ? '#4a5568' : '#a0aec0',
                fontSize: '14px',
                fontWeight: step.active ? '500' : '400'
              }}>
                {step.text}
              </span>
            </div>
          ))}
        </div>
        
        {/* Security Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: '#f0fff4',
          padding: '12px 24px',
          borderRadius: '9999px',
          border: '1px solid #c6f6d5',
          marginTop: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <div style={{
              width: '14px',
              height: '14px',
              backgroundColor: '#38a169',
              borderRadius: '50%',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '4px',
                left: '4px',
                width: '6px',
                height: '6px',
                backgroundColor: 'white',
                borderRadius: '50%'
              }} />
            </div>
            <span style={{
              color: '#276749',
              fontSize: '14px',
              fontWeight: '600',
              letterSpacing: '0.5px'
            }}>
              Secure Connection • Encrypted
            </span>
          </div>
        </div>
        
        {/* Footer */}
        <p style={{
          color: '#a0aec0',
          fontSize: '12px',
          marginTop: '32px',
          paddingTop: '16px',
          borderTop: '1px solid #e2e8f0'
        }}>
          {process.env.REACT_APP_VERSION ? 
            `Version ${process.env.REACT_APP_VERSION} • Bugema University IT Department` :
            'Bugema University IT Support System • All rights reserved'
          }
        </p>
      </div>
      
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default LoadingScreen;