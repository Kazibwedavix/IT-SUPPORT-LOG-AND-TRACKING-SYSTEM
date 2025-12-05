// backend/src/services/auditService.js
/**
 * Audit Service
 * 
 * Security and audit logging service
 * 
 * @version 1.0.0
 * @author Bugema University IT Support System
 */

const fs = require('fs');
const path = require('path');

class AuditService {
  constructor() {
    this.logsDir = path.join(__dirname, '../../logs');
    this.securityLogFile = path.join(this.logsDir, 'security.log');
    this.auditLogFile = path.join(this.logsDir, 'audit.log');
    
    this.ensureLogsDirectory();
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Log security event
   */
  logSecurityEvent(eventType, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'SECURITY',
      event: eventType,
      ...data
    };

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 [SECURITY]', logEntry);
    }

    // Write to security log file
    this.writeToLog(this.securityLogFile, logEntry);
  }

  /**
   * Log audit event
   */
  logAuditEvent(eventType, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'AUDIT',
      event: eventType,
      ...data
    };

    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 [AUDIT]', logEntry);
    }

    // Write to audit log file
    this.writeToLog(this.auditLogFile, logEntry);
  }

  /**
   * Write log entry to file
   */
  writeToLog(filePath, logEntry) {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(filePath, logLine, { encoding: 'utf8' });
    } catch (error) {
      console.error('❌ Failed to write log:', error);
    }
  }

  /**
   * Get security logs
   */
  getSecurityLogs(limit = 100) {
    try {
      if (!fs.existsSync(this.securityLogFile)) {
        return [];
      }

      const content = fs.readFileSync(this.securityLogFile, 'utf8');
      const lines = content.trim().split('\n');
      const logs = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      }).filter(log => log !== null);

      return logs.slice(-limit);
    } catch (error) {
      console.error('❌ Failed to read security logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs
   */
  getAuditLogs(limit = 100) {
    try {
      if (!fs.existsSync(this.auditLogFile)) {
        return [];
      }

      const content = fs.readFileSync(this.auditLogFile, 'utf8');
      const lines = content.trim().split('\n');
      const logs = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      }).filter(log => log !== null);

      return logs.slice(-limit);
    } catch (error) {
      console.error('❌ Failed to read audit logs:', error);
      return [];
    }
  }

  /**
   * Clear old logs
   */
  clearOldLogs(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffTimestamp = cutoffDate.toISOString();

      // Security logs
      if (fs.existsSync(this.securityLogFile)) {
        const logs = this.getSecurityLogs();
        const filteredLogs = logs.filter(log => log.timestamp >= cutoffTimestamp);
        fs.writeFileSync(this.securityLogFile, filteredLogs.map(log => JSON.stringify(log)).join('\n') + '\n');
      }

      // Audit logs
      if (fs.existsSync(this.auditLogFile)) {
        const logs = this.getAuditLogs();
        const filteredLogs = logs.filter(log => log.timestamp >= cutoffTimestamp);
        fs.writeFileSync(this.auditLogFile, filteredLogs.map(log => JSON.stringify(log)).join('\n') + '\n');
      }

      console.log(`✅ Cleared logs older than ${daysToKeep} days`);
    } catch (error) {
      console.error('❌ Failed to clear old logs:', error);
    }
  }

  /**
   * Log user activity
   */
  logUserActivity(userId, action, resource, details = {}) {
    this.logAuditEvent('USER_ACTIVITY', {
      userId,
      action,
      resource,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log system event
   */
  logSystemEvent(event, details = {}) {
    this.logAuditEvent('SYSTEM_EVENT', {
      event,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log authentication attempt
   */
  logAuthAttempt(email, success, reason = '', ip = '') {
    this.logSecurityEvent('AUTH_ATTEMPT', {
      email,
      success,
      reason,
      ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log authorization failure
   */
  logAuthFailure(userId, action, reason, ip = '') {
    this.logSecurityEvent('AUTH_FAILURE', {
      userId,
      action,
      reason,
      ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log data access
   */
  logDataAccess(userId, resourceType, resourceId, action, details = {}) {
    this.logAuditEvent('DATA_ACCESS', {
      userId,
      resourceType,
      resourceId,
      action,
      ...details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log data modification
   */
  logDataModification(userId, resourceType, resourceId, action, changes = {}) {
    this.logAuditEvent('DATA_MODIFICATION', {
      userId,
      resourceType,
      resourceId,
      action,
      changes,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = new AuditService();