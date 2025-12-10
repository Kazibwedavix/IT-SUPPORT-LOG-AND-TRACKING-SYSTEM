/**
 * BUGEMA UNIVERSITY IT SUPPORT SYSTEM
 * Audit Log Model
 * 
 * @version 1.0.0
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // User who performed the action (null for system events)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  // Action performed
  action: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  // Entity type (e.g., 'User', 'Ticket', 'System')
  entityType: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  // Entity ID
  entityId: {
    type: String,
    required: true,
    index: true
  },

  // Detailed information about the action
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Severity level
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info',
    index: true
  },

  // IP address of the requester
  ipAddress: String,

  // User agent
  userAgent: String,

  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Flags
  isSystemEvent: {
    type: Boolean,
    default: false,
    index: true
  },

  isSecurityEvent: {
    type: Boolean,
    default: false,
    index: true
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
    expires: 365 * 24 * 60 * 60 // Auto-expire after 1 year
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for common queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ severity: 1, createdAt: -1 });
auditLogSchema.index({ isSecurityEvent: 1, createdAt: -1 });

// Virtual for formatted timestamp
auditLogSchema.virtual('formattedTime').get(function() {
  return this.createdAt.toLocaleString();
});

// Static methods
auditLogSchema.statics.findByUser = function(userId, options = {}) {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  return this.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'firstName lastName email role')
    .lean();
};

auditLogSchema.statics.findByEntity = function(entityType, entityId, options = {}) {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  return this.find({ entityType, entityId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'firstName lastName email role')
    .lean();
};

auditLogSchema.statics.getStatistics = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        count: { $sum: 1 },
        users: { $addToSet: '$userId' },
        actions: { $addToSet: '$action' },
        severityCount: {
          $push: {
            k: '$severity',
            v: 1
          }
        }
      }
    },
    {
      $sort: { _id: 1 }
    },
    {
      $project: {
        date: '$_id',
        count: 1,
        uniqueUsers: { $size: '$users' },
        uniqueActions: { $size: '$actions' },
        severityBreakdown: {
          $arrayToObject: '$severityCount'
        },
        _id: 0
      }
    }
  ]);
};

module.exports = mongoose.model('AuditLog', auditLogSchema);