const mongoose = require('mongoose');

/**
 * BUGEMA UNIVERSITY IT SUPPORT SYSTEM
 * Enhanced Ticket Model - Production Ready
 * 
 * Features:
 * - Auto-generated ticket numbers
 * - Complete SLA tracking
 * - Department & location management
 * - Escalation system
 * - Full audit trail
 * - Advanced search capabilities
 * - Related tickets linking
 */

const ticketSchema = new mongoose.Schema({
  // ============================================
  // TICKET IDENTIFICATION
  // ============================================
  ticketNumber: {
    type: String,
    unique: true,
    sparse: true // Allows null during creation before pre-save hook
  },
  
  // ============================================
  // BASIC INFORMATION
  // ============================================
  title: {
    type: String,
    required: [true, 'Ticket title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Ticket description is required'],
    trim: true,
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  
  // ============================================
  // CLASSIFICATION
  // ============================================
  category: {
    type: String,
    enum: {
      values: ['Hardware', 'Software', 'Network', 'Email', 'Account Access', 'Printer', 'Phone', 'Other'],
      message: '{VALUE} is not a valid category'
    },
    required: [true, 'Category is required'],
    default: 'Other'
  },
  
  subCategory: {
    type: String,
    trim: true,
    maxlength: [100, 'Sub-category cannot exceed 100 characters']
  },
  
  priority: {
    type: String,
    enum: {
      values: ['Low', 'Medium', 'High', 'Critical'],
      message: '{VALUE} is not a valid priority'
    },
    required: [true, 'Priority is required'],
    default: 'Medium'
  },
  
  status: {
    type: String,
    enum: {
      values: ['Open', 'Assigned', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Reopened', 'Cancelled'],
      message: '{VALUE} is not a valid status'
    },
    default: 'Open',
    index: true
  },
  
  // ============================================
  // USER RELATIONSHIPS
  // ============================================
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required'],
    index: true
  },
  
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  assignedAt: {
    type: Date
  },
  
  // ============================================
  // LOCATION & DEPARTMENT
  // ============================================
  location: {
    building: {
      type: String,
      trim: true,
      maxlength: [100, 'Building name cannot exceed 100 characters']
    },
    room: {
      type: String,
      trim: true,
      maxlength: [50, 'Room number cannot exceed 50 characters']
    },
    campus: {
      type: String,
      enum: ['Main Campus', 'Kampala Campus', 'Other'],
      default: 'Main Campus'
    },
    floor: {
      type: String,
      trim: true,
      maxlength: [20, 'Floor cannot exceed 20 characters']
    }
  },
  
  department: {
    type: String,
    trim: true,
    maxlength: [100, 'Department name cannot exceed 100 characters'],
    index: true
  },
  
  // ============================================
  // CONTACT INFORMATION
  // ============================================
  contactInfo: {
    phone: {
      type: String,
      trim: true,
      match: [/^[0-9+\-\s()]+$/, 'Please provide a valid phone number']
    },
    alternateEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    }
  },
  
  // ============================================
  // COMMENTS & COMMUNICATION
  // ============================================
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      minlength: [1, 'Comment cannot be empty'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters']
    },
    isInternal: {
      type: Boolean,
      default: false,
      index: true
    },
    attachments: [{
      filename: String,
      originalName: String,
      path: String,
      size: Number,
      mimeType: String
    }],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    editedAt: Date,
    isEdited: {
      type: Boolean,
      default: false
    }
  }],
  
  // ============================================
  // ATTACHMENTS
  // ============================================
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true,
      max: [10485760, 'File size cannot exceed 10MB'] // 10MB limit
    },
    mimeType: {
      type: String,
      required: true
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ============================================
  // SLA TRACKING (Enhanced)
  // ============================================
  sla: {
    responseTime: {
      target: {
        type: Number, // in minutes
        default: function() {
          // Auto-calculate based on priority
          const priorityTargets = {
            'Critical': 30,    // 30 minutes
            'High': 120,       // 2 hours
            'Medium': 480,     // 8 hours
            'Low': 1440        // 24 hours
          };
          return priorityTargets[this.priority] || 480;
        }
      },
      actual: Number, // Calculated when first response is made
      deadline: Date,
      breached: {
        type: Boolean,
        default: false
      }
    },
    resolutionTime: {
      target: {
        type: Number, // in minutes
        default: function() {
          // Auto-calculate based on priority
          const priorityTargets = {
            'Critical': 240,    // 4 hours
            'High': 1440,       // 24 hours
            'Medium': 4320,     // 3 days
            'Low': 10080        // 7 days
          };
          return priorityTargets[this.priority] || 4320;
        }
      },
      actual: Number, // Calculated when resolved
      deadline: Date,
      breached: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // ============================================
  // RESOLUTION DETAILS
  // ============================================
  resolution: {
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Resolution description cannot exceed 2000 characters']
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    resolutionTime: Number, // Total time in minutes
    satisfactionRating: {
      type: Number,
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5']
    },
    satisfactionComment: {
      type: String,
      trim: true,
      maxlength: [500, 'Satisfaction comment cannot exceed 500 characters']
    },
    ratedAt: Date
  },
  
  // ============================================
  // ESCALATION SYSTEM
  // ============================================
  escalation: {
    level: {
      type: Number,
      default: 0,
      min: [0, 'Escalation level cannot be negative'],
      max: [3, 'Maximum escalation level is 3']
    },
    escalatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    escalatedAt: Date,
    reason: {
      type: String,
      trim: true,
      maxlength: [500, 'Escalation reason cannot exceed 500 characters']
    },
    history: [{
      level: Number,
      escalatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      escalatedAt: Date,
      reason: String
    }]
  },
  
  // ============================================
  // RELATED & LINKED TICKETS
  // ============================================
  relatedTickets: [{
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket'
    },
    relationship: {
      type: String,
      enum: ['Duplicate', 'Related', 'Blocks', 'Blocked By', 'Parent', 'Child'],
      default: 'Related'
    },
    linkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    linkedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ============================================
  // SEARCH & TAGGING
  // ============================================
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  
  searchKeywords: {
    type: String,
    select: false // Hidden by default, used for search indexing
  },
  
  // ============================================
  // METADATA & TRACKING
  // ============================================
  viewCount: {
    type: Number,
    default: 0,
    min: [0, 'View count cannot be negative']
  },
  
  lastViewedAt: Date,
  
  lastViewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // ============================================
  // STATUS HISTORY (Audit Trail)
  // ============================================
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    comment: String
  }],
  
  // ============================================
  // TIMESTAMPS
  // ============================================
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  closedAt: {
    type: Date,
    index: true
  },
  
  reopenedAt: Date,
  
  reopenCount: {
    type: Number,
    default: 0,
    min: [0, 'Reopen count cannot be negative']
  },
  
  // ============================================
  // SOFT DELETE
  // ============================================
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  
  deletedAt: Date,
  
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================
ticketSchema.index({ createdBy: 1, status: 1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ status: 1, priority: -1, createdAt: -1 });
ticketSchema.index({ category: 1, status: 1 });
ticketSchema.index({ department: 1, status: 1 });
ticketSchema.index({ tags: 1 });
ticketSchema.index({ 'sla.responseTime.breached': 1, 'sla.resolutionTime.breached': 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ updatedAt: -1 });
// Text index for search functionality
ticketSchema.index({ 
  title: 'text', 
  description: 'text', 
  ticketNumber: 'text',
  tags: 'text',
  searchKeywords: 'text'
}, {
  weights: {
    ticketNumber: 10,
    title: 5,
    tags: 3,
    description: 2,
    searchKeywords: 1
  }
});

// ============================================
// PRE-SAVE HOOKS
// ============================================

// Generate ticket number before first save
ticketSchema.pre('save', async function(next) {
  try {
    // Only generate ticket number for new documents
    if (this.isNew && !this.ticketNumber) {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      // Count tickets created today
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));
      
      const count = await this.constructor.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      });
      
      const sequence = String(count + 1).padStart(4, '0');
      this.ticketNumber = `TKT-${year}${month}${day}-${sequence}`;
    }
    
    // Update timestamp
    this.updatedAt = Date.now();
    
    // Calculate SLA deadlines for new tickets
    if (this.isNew) {
      const now = new Date();
      
      // Response time deadline
      if (this.sla.responseTime.target) {
        this.sla.responseTime.deadline = new Date(
          now.getTime() + this.sla.responseTime.target * 60000
        );
      }
      
      // Resolution time deadline
      if (this.sla.resolutionTime.target) {
        this.sla.resolutionTime.deadline = new Date(
          now.getTime() + this.sla.resolutionTime.target * 60000
        );
      }
      
      // Initialize status history
      this.statusHistory.push({
        status: this.status,
        changedBy: this.createdBy,
        changedAt: now,
        comment: 'Ticket created'
      });
    }
    
    // Build search keywords
    this.searchKeywords = [
      this.title,
      this.description,
      this.category,
      this.priority,
      this.department,
      ...this.tags
    ].filter(Boolean).join(' ').toLowerCase();
    
    next();
  } catch (error) {
    next(error);
  }
});

// Track status changes
ticketSchema.pre('save', function(next) {
  if (!this.isNew && this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      changedBy: this.modifiedBy || this.createdBy, // Set via middleware
      changedAt: new Date(),
      comment: `Status changed to ${this.status}`
    });
    
    // Update closedAt when status changes to Closed
    if (this.status === 'Closed' && !this.closedAt) {
      this.closedAt = new Date();
      
      // Calculate actual resolution time
      if (!this.resolution.resolutionTime) {
        const duration = this.closedAt - this.createdAt;
        this.resolution.resolutionTime = Math.round(duration / 60000); // Convert to minutes
        this.sla.resolutionTime.actual = this.resolution.resolutionTime;
      }
    }
    
    // Track reopen
    if (this.status === 'Reopened') {
      this.reopenedAt = new Date();
      this.reopenCount += 1;
      this.closedAt = null; // Clear closed date
    }
  }
  
  next();
});

// ============================================
// VIRTUAL FIELDS
// ============================================

// Virtual for formatted ticket number (already exists in ID)
ticketSchema.virtual('formattedNumber').get(function() {
  return this.ticketNumber || `TKT-${this._id.toString().substring(18, 24).toUpperCase()}`;
});

// Virtual for overdue status
ticketSchema.virtual('isOverdue').get(function() {
  if (this.status === 'Resolved' || this.status === 'Closed' || this.status === 'Cancelled') {
    return false;
  }
  
  const now = new Date();
  return (
    (this.sla.responseTime.deadline && now > this.sla.responseTime.deadline && !this.sla.responseTime.actual) ||
    (this.sla.resolutionTime.deadline && now > this.sla.resolutionTime.deadline && !this.resolution.resolvedAt)
  );
});

// Virtual for age in days
ticketSchema.virtual('ageInDays').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffTime = Math.abs(now - created);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for age in hours
ticketSchema.virtual('ageInHours').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffTime = Math.abs(now - created);
  return Math.ceil(diffTime / (1000 * 60 * 60));
});

// Virtual for comment count
ticketSchema.virtual('commentCount').get(function() {
  return this.comments ? this.comments.length : 0;
});

// Virtual for attachment count
ticketSchema.virtual('attachmentCount').get(function() {
  return this.attachments ? this.attachments.length : 0;
});

// Virtual for user-facing comments only
ticketSchema.virtual('publicComments').get(function() {
  return this.comments ? this.comments.filter(c => !c.isInternal) : [];
});

// ============================================
// INSTANCE METHODS
// ============================================

// Add comment to ticket
ticketSchema.methods.addComment = function(userId, content, isInternal = false, attachments = []) {
  this.comments.push({
    user: userId,
    content: content,
    isInternal: isInternal,
    attachments: attachments,
    createdAt: new Date()
  });
  return this.save();
};

// Assign ticket to technician
ticketSchema.methods.assignTo = function(technicianId, assignedById) {
  this.assignedTo = technicianId;
  this.assignedBy = assignedById;
  this.assignedAt = new Date();
  this.status = 'Assigned';
  return this.save();
};

// Update status
ticketSchema.methods.updateStatus = function(newStatus, userId, comment = '') {
  this.status = newStatus;
  this.modifiedBy = userId; // This will be picked up by pre-save hook
  
  if (comment) {
    this.statusHistory[this.statusHistory.length - 1].comment = comment;
  }
  
  return this.save();
};

// Escalate ticket
ticketSchema.methods.escalate = function(userId, reason) {
  this.escalation.level += 1;
  this.escalation.escalatedBy = userId;
  this.escalation.escalatedAt = new Date();
  this.escalation.reason = reason;
  
  this.escalation.history.push({
    level: this.escalation.level,
    escalatedBy: userId,
    escalatedAt: new Date(),
    reason: reason
  });
  
  // Auto-increase priority on escalation
  if (this.escalation.level === 1 && this.priority === 'Low') {
    this.priority = 'Medium';
  } else if (this.escalation.level === 2 && this.priority === 'Medium') {
    this.priority = 'High';
  } else if (this.escalation.level >= 3 && this.priority !== 'Critical') {
    this.priority = 'Critical';
  }
  
  return this.save();
};

// Resolve ticket
ticketSchema.methods.resolve = function(userId, resolutionDescription) {
  this.status = 'Resolved';
  this.resolution.description = resolutionDescription;
  this.resolution.resolvedBy = userId;
  this.resolution.resolvedAt = new Date();
  
  // Calculate resolution time
  const duration = this.resolution.resolvedAt - this.createdAt;
  this.resolution.resolutionTime = Math.round(duration / 60000); // Convert to minutes
  this.sla.resolutionTime.actual = this.resolution.resolutionTime;
  
  // Check SLA breach
  if (this.sla.resolutionTime.deadline && this.resolution.resolvedAt > this.sla.resolutionTime.deadline) {
    this.sla.resolutionTime.breached = true;
  }
  
  return this.save();
};

// Close ticket
ticketSchema.methods.close = function(userId) {
  this.status = 'Closed';
  this.closedAt = new Date();
  this.modifiedBy = userId;
  return this.save();
};

// Reopen ticket
ticketSchema.methods.reopen = function(userId, reason) {
  this.status = 'Reopened';
  this.reopenedAt = new Date();
  this.reopenCount += 1;
  this.closedAt = null;
  this.modifiedBy = userId;
  
  this.addComment(userId, `Ticket reopened: ${reason}`, false);
  
  return this.save();
};

// Add satisfaction rating
ticketSchema.methods.addRating = function(rating, comment = '') {
  this.resolution.satisfactionRating = rating;
  this.resolution.satisfactionComment = comment;
  this.resolution.ratedAt = new Date();
  return this.save();
};

// Increment view count
ticketSchema.methods.incrementView = function(userId) {
  this.viewCount += 1;
  this.lastViewedAt = new Date();
  this.lastViewedBy = userId;
  return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

// Get tickets by status
ticketSchema.statics.getByStatus = function(status) {
  return this.find({ status, isDeleted: false })
    .populate('createdBy', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .sort({ priority: -1, createdAt: -1 });
};

// Get overdue tickets
ticketSchema.statics.getOverdue = function() {
  const now = new Date();
  return this.find({
    status: { $in: ['Open', 'Assigned', 'In Progress', 'Pending'] },
    $or: [
      { 'sla.responseTime.deadline': { $lt: now }, 'sla.responseTime.actual': null },
      { 'sla.resolutionTime.deadline': { $lt: now }, 'resolution.resolvedAt': null }
    ],
    isDeleted: false
  })
    .populate('createdBy', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email')
    .sort({ priority: -1, createdAt: 1 });
};

// Get tickets by user
ticketSchema.statics.getByUser = function(userId) {
  return this.find({ createdBy: userId, isDeleted: false })
    .populate('assignedTo', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

// Get assigned tickets
ticketSchema.statics.getAssignedTickets = function(technicianId) {
  return this.find({ 
    assignedTo: technicianId, 
    status: { $nin: ['Closed', 'Cancelled'] },
    isDeleted: false 
  })
    .populate('createdBy', 'firstName lastName email')
    .sort({ priority: -1, createdAt: -1 });
};

// Search tickets
ticketSchema.statics.searchTickets = function(query) {
  return this.find(
    { 
      $text: { $search: query },
      isDeleted: false 
    },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .populate('createdBy', 'firstName lastName email')
    .populate('assignedTo', 'firstName lastName email');
};

// Get statistics
ticketSchema.statics.getStatistics = async function(filters = {}) {
  const baseQuery = { isDeleted: false, ...filters };
  
  const [total, open, assigned, inProgress, resolved, closed] = await Promise.all([
    this.countDocuments(baseQuery),
    this.countDocuments({ ...baseQuery, status: 'Open' }),
    this.countDocuments({ ...baseQuery, status: 'Assigned' }),
    this.countDocuments({ ...baseQuery, status: 'In Progress' }),
    this.countDocuments({ ...baseQuery, status: 'Resolved' }),
    this.countDocuments({ ...baseQuery, status: 'Closed' })
  ]);
  
  return {
    total,
    open,
    assigned,
    inProgress,
    resolved,
    closed,
    active: open + assigned + inProgress
  };
};

module.exports = mongoose.model('Ticket', ticketSchema);