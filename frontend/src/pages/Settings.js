// src/pages/Settings.js
import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import Navbar from '../components/Navbar';
import '../styles/Settings.css';

const Settings = () => {
  const { isDark, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    ticketUpdates: true,
    announcements: true,
    newsletter: false
  });
  const [privacy, setPrivacy] = useState({
    profileVisibility: 'public',
    showOnlineStatus: true,
    allowSearch: true
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleNotificationChange = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handlePrivacyChange = (key, value) => {
    setPrivacy(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      localStorage.setItem('user_notifications', JSON.stringify(notifications));
      localStorage.setItem('user_privacy', JSON.stringify(privacy));
      setLoading(false);
      setSaved(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSaved(false), 3000);
    }, 500);
  };

  const handleReset = () => {
    setNotifications({
      email: true,
      push: true,
      ticketUpdates: true,
      announcements: true,
      newsletter: false
    });
    setPrivacy({
      profileVisibility: 'public',
      showOnlineStatus: true,
      allowSearch: true
    });
  };

  return (
    <div>
      <Navbar />
      <div className="settings-container">
        <div className="settings-header">
          <h1>Settings</h1>
          <p>Customize your system preferences and privacy settings</p>
        </div>

        <div className="settings-grid">
          {/* Theme Settings */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>Appearance</h3>
            </div>
            <div className="settings-card-body">
              <div className="setting-item">
                <div className="setting-info">
                  <h4>Theme</h4>
                  <p>Choose between light and dark mode</p>
                </div>
                <div className="setting-control">
                  <button
                    onClick={toggleTheme}
                    className="theme-toggle"
                  >
                    <span className={`toggle-option ${!isDark ? 'active' : ''}`}>
                      Light
                    </span>
                    <span className={`toggle-option ${isDark ? 'active' : ''}`}>
                      Dark
                    </span>
                  </button>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h4>Font Size</h4>
                  <p>Adjust text size for better readability</p>
                </div>
                <div className="setting-control">
                  <select className="font-size-select">
                    <option value="small">Small</option>
                    <option value="medium" selected>Medium</option>
                    <option value="large">Large</option>
                    <option value="xlarge">Extra Large</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>Notifications</h3>
              <p>Control how you receive updates</p>
            </div>
            <div className="settings-card-body">
              {Object.entries(notifications).map(([key, value]) => (
                <div key={key} className="setting-item">
                  <div className="setting-info">
                    <h4>
                      {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                    </h4>
                    <p>
                      {key === 'email' && 'Receive email notifications'}
                      {key === 'push' && 'Receive browser push notifications'}
                      {key === 'ticketUpdates' && 'Get notified about ticket updates'}
                      {key === 'announcements' && 'Receive system announcements'}
                      {key === 'newsletter' && 'Subscribe to monthly newsletter'}
                    </p>
                  </div>
                  <div className="setting-control">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={() => handleNotificationChange(key)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>Privacy</h3>
              <p>Manage your privacy preferences</p>
            </div>
            <div className="settings-card-body">
              <div className="setting-item">
                <div className="setting-info">
                  <h4>Profile Visibility</h4>
                  <p>Control who can see your profile</p>
                </div>
                <div className="setting-control">
                  <select
                    value={privacy.profileVisibility}
                    onChange={(e) => handlePrivacyChange('profileVisibility', e.target.value)}
                    className="privacy-select"
                  >
                    <option value="public">Public</option>
                    <option value="staff">Staff Only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h4>Show Online Status</h4>
                  <p>Display when you're active on the system</p>
                </div>
                <div className="setting-control">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={privacy.showOnlineStatus}
                      onChange={() => handlePrivacyChange('showOnlineStatus', !privacy.showOnlineStatus)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h4>Allow Search</h4>
                  <p>Allow others to find you by name or email</p>
                </div>
                <div className="setting-control">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={privacy.allowSearch}
                      onChange={() => handlePrivacyChange('allowSearch', !privacy.allowSearch)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* System Settings */}
          <div className="settings-card">
            <div className="settings-card-header">
              <h3>System</h3>
              <p>Advanced system preferences</p>
            </div>
            <div className="settings-card-body">
              <div className="setting-item">
                <div className="setting-info">
                  <h4>Auto-refresh</h4>
                  <p>Automatically refresh data every 5 minutes</p>
                </div>
                <div className="setting-control">
                  <label className="switch">
                    <input type="checkbox" defaultChecked />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h4>Data Export</h4>
                  <p>Allow exporting your data in CSV format</p>
                </div>
                <div className="setting-control">
                  <label className="switch">
                    <input type="checkbox" defaultChecked />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <h4>Session Timeout</h4>
                  <p>Auto-logout after 30 minutes of inactivity</p>
                </div>
                <div className="setting-control">
                  <label className="switch">
                    <input type="checkbox" defaultChecked />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-actions">
          {saved && (
            <div className="save-success">
              Settings saved successfully!
            </div>
          )}
          
          <div className="action-buttons">
            <button
              onClick={handleReset}
              className="btn-secondary"
              disabled={loading}
            >
              Reset to Defaults
            </button>
            <button
              onClick={handleSave}
              className="btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="settings-footer">
          <div className="system-info">
            <p><strong>System Version:</strong> {process.env.REACT_APP_VERSION || '2.0.0'}</p>
            <p><strong>Browser:</strong> {navigator.userAgent.split(') ')[0].split('(')[1]}</p>
            <p><strong>Screen:</strong> {window.screen.width} x {window.screen.height}</p>
          </div>
          
          <div className="danger-zone">
            <h4>Danger Zone</h4>
            <p>These actions are irreversible</p>
            <div className="danger-actions">
              <button className="btn-danger" onClick={() => {
                if (window.confirm('Are you sure you want to clear all local data? This will log you out.')) {
                  localStorage.clear();
                  window.location.href = '/login';
                }
              }}>
                Clear Local Data
              </button>
              <button className="btn-danger" onClick={() => {
                if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                  alert('Account deletion would be processed here');
                }
              }}>
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;