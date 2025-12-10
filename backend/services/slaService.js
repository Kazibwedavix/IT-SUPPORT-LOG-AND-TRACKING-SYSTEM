/**
 * BUGEMA UNIVERSITY IT SUPPORT SYSTEM
 * SLA Service - Production Ready
 * 
 * @version 1.0.0
 */

class SLAService {
  constructor() {
    // Define SLA targets in minutes
    this.slaTargets = {
      response: {
        Critical: 30,    // 30 minutes
        High: 60,        // 1 hour
        Medium: 240,     // 4 hours
        Low: 480         // 8 hours
      },
      resolution: {
        Critical: 240,   // 4 hours
        High: 480,       // 8 hours
        Medium: 1440,    // 24 hours
        Low: 2880        // 48 hours
      }
    };

    console.log('✅ SLA Service initialized');
  }

  /**
   * Calculate SLA deadlines
   */
  calculateDeadlines(priority, createdAt = new Date()) {
    const responseTime = this.slaTargets.response[priority] || this.slaTargets.response.Medium;
    const resolutionTime = this.slaTargets.resolution[priority] || this.slaTargets.resolution.Medium;

    const createdDate = new Date(createdAt);

    return {
      responseDeadline: new Date(createdDate.getTime() + (responseTime * 60 * 1000)),
      resolutionDeadline: new Date(createdDate.getTime() + (resolutionTime * 60 * 1000)),
      responseTime,
      resolutionTime
    };
  }

  /**
   * Check if SLA is breached
   */
  checkSLABreach(ticket) {
    const now = new Date();
    const breaches = [];

    // Check response deadline
    if (ticket.sla && ticket.sla.responseDeadline) {
      const responseDeadline = new Date(ticket.sla.responseDeadline);
      if (now > responseDeadline && (!ticket.firstResponseTime || new Date(ticket.firstResponseTime) > responseDeadline)) {
        breaches.push({
          type: 'response',
          deadline: responseDeadline,
          breachedAt: now,
          targetTime: this.slaTargets.response[ticket.priority] || this.slaTargets.response.Medium,
          delay: Math.round((now - responseDeadline) / (1000 * 60))
        });
      }
    }

    // Check resolution deadline
    if (ticket.sla && ticket.sla.resolutionDeadline) {
      const resolutionDeadline = new Date(ticket.sla.resolutionDeadline);
      if (now > resolutionDeadline && ticket.status !== 'Resolved' && ticket.status !== 'Closed') {
        breaches.push({
          type: 'resolution',
          deadline: resolutionDeadline,
          breachedAt: now,
          targetTime: this.slaTargets.resolution[ticket.priority] || this.slaTargets.resolution.Medium,
          delay: Math.round((now - resolutionDeadline) / (1000 * 60))
        });
      }
    }

    return {
      breached: breaches.length > 0,
      breaches
    };
  }

  /**
   * Calculate time remaining
   */
  calculateTimeRemaining(ticket) {
    const now = new Date();
    const remaining = {};
    const warnings = [];

    // Check response time
    if (ticket.sla && ticket.sla.responseDeadline && !ticket.firstResponseTime) {
      const responseDeadline = new Date(ticket.sla.responseDeadline);
      const minutesRemaining = Math.round((responseDeadline - now) / (1000 * 60));
      
      remaining.response = {
        minutes: minutesRemaining,
        deadline: responseDeadline
      };

      if (minutesRemaining < 60) {
        warnings.push({
          type: 'critical',
          message: `Response SLA critical: ${minutesRemaining} minutes remaining`
        });
      } else if (minutesRemaining < 120) {
        warnings.push({
          type: 'warning',
          message: `Response SLA warning: ${minutesRemaining} minutes remaining`
        });
      }
    }

    // Check resolution time
    if (ticket.sla && ticket.sla.resolutionDeadline && ticket.status !== 'Resolved' && ticket.status !== 'Closed') {
      const resolutionDeadline = new Date(ticket.sla.resolutionDeadline);
      const minutesRemaining = Math.round((resolutionDeadline - now) / (1000 * 60));
      
      remaining.resolution = {
        minutes: minutesRemaining,
        deadline: resolutionDeadline
      };

      if (minutesRemaining < 120) {
        warnings.push({
          type: 'critical',
          message: `Resolution SLA critical: ${minutesRemaining} minutes remaining`
        });
      } else if (minutesRemaining < 240) {
        warnings.push({
          type: 'warning',
          message: `Resolution SLA warning: ${minutesRemaining} minutes remaining`
        });
      }
    }

    return {
      remaining,
      warnings,
      hasWarnings: warnings.length > 0
    };
  }

  /**
   * Get SLA requirements
   */
  getSLARequirements(priority) {
    const responseTime = this.slaTargets.response[priority];
    const resolutionTime = this.slaTargets.resolution[priority];

    return `Response: ${this.formatTime(responseTime)} | Resolution: ${this.formatTime(resolutionTime)}`;
  }

  /**
   * Format time for display
   */
  formatTime(minutes) {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours} hour${hours !== 1 ? 's' : ''}${
        remainingMinutes > 0 ? ` ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}` : ''
      }`;
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      return `${days} day${days !== 1 ? 's' : ''}${
        remainingHours > 0 ? ` ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}` : ''
      }`;
    }
  }
}

// Export singleton instance
module.exports = new SLAService();