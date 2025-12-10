/**
 * BUGEMA UNIVERSITY IT SUPPORT SYSTEM
 * Notification Model
 * 
 * @version 1.0.0
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // User who receives the notification
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Notification content
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },

  // Notification type for categorization
  type: {
    type: String,
    enum: [
      'info',          // General information
      'ticket',        // Ticket-related
      'assignment',    // Ticket assignment
      'comment',       // New comment
      'ticket_update', // Ticket status update
      'ticket_resolved', // Ticket resolved
      'sla_alert',     // SLA breach
      'sla_escalation', // SLA escalation
      'system',        // System notification
      'reminder'       // Reminder notification
    ],
    default: 'info'
  },

  // Priority for styling and sorting
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },

  // Related entity (e.g., Ticket, Article)
  relatedTo: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedModel',
    index: true
  },

  // Dynamic reference to related model
  relatedModel: {
    type: String,
    enum: ['Ticket', 'Article', 'User'],
    required: function() {
      return this.relatedTo !== undefined;
    }
  },

  // Read status
  read: {
    type: Boolean,
    default: false,
    index: true
  },

  readAt: {
    type: Date
  },

  // Additional metadata for the notification
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Action buttons for the notification
  actions: [{
    label: String,
    url: String,
    method: String, // GET, POST, etc.
    color: String   // Button color
  }],

  // Expiration date for auto-cleanup
  expiresAt: {
    type: Date,
    default: function() {
      // Default expiration: 90 days from creation
      const date = new Date();
      date.setDate(date.getDate() + 90);
      return date;
    },
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ createdAt: -1 });

// Virtual for formatted time ago
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return created.toLocaleDateString();
});

// Virtual for isExpired
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && new Date() > this.expiresAt;
});

// Pre-save middleware
notificationSchema.pre('save', function(next) {
  // Set relatedModel if relatedTo is set
  if (this.relatedTo && !this.relatedModel) {
    // This should be set when creating the notification
    // Default to Ticket if not specified
    this.relatedModel = 'Ticket';
  }
  
  // Set readAt when marked as read
  if (this.isModified('read') && this.read && !this.readAt) {
    this.readAt = new Date();
  }
  
  next();
});

// Static methods
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({ userId, read: false });
};

notificationSchema.statics.markAllAsRead = async function(userId) {
  return await this.updateMany(
    { userId, read: false },
    { 
      $set: { 
        read: true,
        readAt: new Date()
      }
    }
  );
};

// Instance methods
notificationSchema.methods.markAsRead = function() {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.toClientFormat = function() {
  const obj = this.toObject();
  
  // Add virtual fields
  obj.timeAgo = this.timeAgo;
  obj.isExpired = this.isExpired;
  
  // Remove sensitive/unnecessary fields
  delete obj.__v;
  delete obj.updatedAt;
  
  return obj;
};

module.exports = mongoose.model('Notification', notificationSchema);