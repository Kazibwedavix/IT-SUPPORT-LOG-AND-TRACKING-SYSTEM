import api from './api';

class HealthCheckService {
  constructor() {
    this.backendStatus = 'unknown';
    this.isOnline = navigator.onLine;
    this.checkInterval = null;
    this.healthCheckUrl = '/api/health';
    this.lastCheckTime = null;
  }

  init() {
    console.log('🩺 Health check service initialized');
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Start periodic health checks
    this.startPeriodicChecks();
    
    // Initial check
    this.checkBackend();
  }

  destroy() {
    console.log('🩺 Health check service destroyed');
    window.removeEventListener('online', this.handleOnline.bind(this));
    window.removeEventListener('offline', this.handleOffline.bind(this));
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  handleOnline() {
    console.log('🌐 Browser is online');
    this.isOnline = true;
    this.checkBackend();
    this.emitStatusChange();
  }

  handleOffline() {
    console.log('🌐 Browser is offline');
    this.isOnline = false;
    this.backendStatus = 'offline';
    this.emitStatusChange();
  }

  startPeriodicChecks() {
    // Check every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkBackend();
    }, 30000);
  }

  async checkBackend() {
    if (!this.isOnline) {
      this.backendStatus = 'offline';
      this.emitStatusChange();
      return false;
    }

    try {
      this.lastCheckTime = new Date();
      const response = await api.get(this.healthCheckUrl, {
        timeout: 5000,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const isHealthy = response.data.status === 'OK' || response.data.status === 'healthy';
      this.backendStatus = isHealthy ? 'healthy' : 'unhealthy';
      this.emitStatusChange();
      
      return isHealthy;
    } catch (error) {
      console.error('❌ Health check error:', error.message);
      this.backendStatus = 'unreachable';
      this.emitStatusChange();
      return false;
    }
  }

  emitStatusChange() {
    const event = new CustomEvent('health-status-change', {
      detail: {
        backendStatus: this.backendStatus,
        isOnline: this.isOnline,
        lastCheck: this.lastCheckTime,
        timestamp: new Date().toISOString()
      }
    });
    window.dispatchEvent(event);
  }

  getStatus() {
    return {
      backendStatus: this.backendStatus,
      isOnline: this.isOnline,
      lastCheck: this.lastCheckTime
    };
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();