/**
 * BUGEMA UNIVERSITY IT SUPPORT SYSTEM
 * Notification Service - Production Ready
 * 
 * @version 1.0.0
 */

const Notification = require('../models/Notification');
const User = require('../models/User');

class NotificationService {
  constructor() {
    this.onlineUsers = new Map();
    console.log('✅ Notification Service initialized');
  }

  /**
   * Create a new notification
   */
  async createNotification(notificationData) {
    try {
      console.log('📢 Creating notification:', notificationData);
      
      // Create notification in database
      const notification = new Notification({
        userId: notificationData.userId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type || 'info',
        priority: notificationData.priority || 'medium',
        relatedTo: notificationData.relatedTo,
        read: false,
        metadata: notificationData.metadata || {}
      });

      await notification.save();

      // Emit to user if online
      if (this.onlineUsers.has(notificationData.userId.toString())) {
        const socketData = this.onlineUsers.get(notificationData.userId.toString());
        if (socketData && socketData.socketId && global.io) {
          global.io.to(socketData.socketId).emit('notification:new', {
            notification: notification.toObject(),
            unreadCount: await this.getUnreadCount(notificationData.userId)
          });
        }
      }

      return {
        success: true,
        notification: notification.toObject(),
        message: 'Notification created successfully'
      };

    } catch (error) {
      console.error('❌ Failed to create notification:', error.message);
      return {
        success: false,
        error: 'Failed to create notification'
      };
    }
  }

  /**
   * Create ticket-related notifications
   */
  async createTicketNotifications(ticket, eventType, data = {}) {
    try {
      console.log(`🎫 Creating ticket notifications for ${ticket.ticketNumber}, event: ${eventType}`);
      
      const notifications = [];
      
      switch (eventType) {
        case 'ticket_created':
          // Notify available technicians
          const technicians = await User.find({
            role: 'Technician',
            'supportAreas': ticket.category,
            'availabilityStatus': 'available'
          }).limit(5);

          for (const tech of technicians) {
            const notification = await this.createNotification({
              userId: tech._id,
              title: 'New Ticket Available',
              message: `New ${ticket.category} ticket: ${ticket.title}`,
              type: 'ticket',
              relatedTo: ticket._id,
              priority: ticket.priority === 'Critical' ? 'high' : 'medium',
              metadata: {
                ticketNumber: ticket.ticketNumber,
                category: ticket.category,
                priority: ticket.priority
              }
            });

            if (notification.success) {
              notifications.push(notification.notification);
            }
          }
          break;

        case 'ticket_assigned':
          // Notify assigned technician
          if (ticket.assignedTo) {
            await this.createNotification({
              userId: ticket.assignedTo,
              title: 'Ticket Assigned to You',
              message: `Ticket ${ticket.ticketNumber} has been assigned to you`,
              type: 'assignment',
              relatedTo: ticket._id,
              priority: 'high',
              metadata: {
                ticketNumber: ticket.ticketNumber,
                assignedBy: data.assignedBy,
                priority: ticket.priority
              }
            });
          }
          break;

        case 'ticket_resolved':
          // Notify ticket creator
          if (ticket.createdBy) {
            await this.createNotification({
              userId: ticket.createdBy,
              title: 'Ticket Resolved',
              message: `Your ticket ${ticket.ticketNumber} has been resolved`,
              type: 'ticket_resolved',
              relatedTo: ticket._id,
              priority: 'high',
              metadata: {
                ticketNumber: ticket.ticketNumber,
                resolvedBy: data.resolvedBy,
                resolutionTime: data.resolutionTime
              }
            });
          }
          break;
      }

      return notifications;
    } catch (error) {
      console.error('❌ Failed to create ticket notifications:', error);
      return [];
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId) {
    try {
      return await Notification.countDocuments({ 
        userId, 
        read: false 
      });
    } catch (error) {
      console.error('❌ Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * Register user as online
   */
  async registerUser(userId, socketId, userData = {}) {
    const unreadCount = await this.getUnreadCount(userId);
    
    this.onlineUsers.set(userId.toString(), {
      socketId,
      lastSeen: new Date(),
      userData,
      unreadCount
    });

    console.log(`✅ User ${userId} registered as online`);
  }

  /**
   * Remove user from online list
   */
  unregisterUser(userId) {
    this.onlineUsers.delete(userId.toString());
    console.log(`👋 User ${userId} unregistered`);
  }

  /**
   * Get user socket ID
   */
  getUserSocketId(userId) {
    const user = this.onlineUsers.get(userId.toString());
    return user ? user.socketId : null;
  }

  /**
   * Emit to user
   */
  emitToUser(userId, event, data) {
    const socketId = this.getUserSocketId(userId);
    if (socketId && global.io) {
      global.io.to(socketId).emit(event, data);
    }
  }

  /**
   * Get service health
   */
  getHealthStatus() {
    return {
      status: 'healthy',
      onlineUsers: this.onlineUsers.size,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
module.exports = new NotificationService();