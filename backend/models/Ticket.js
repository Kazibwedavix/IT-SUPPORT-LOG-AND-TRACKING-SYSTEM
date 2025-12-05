const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  // Basic Information
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
    minlength: [10, 'Description must be at least 10 characters']
  },
  
  // Classification
  category: {
    type: String,
    enum: ['Hardware', 'Software', 'Network', 'Account', 'Other'],
    required: [true, 'Category is required'],
    default: 'Other'
  },
  
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    required: [true, 'Priority is required'],
    default: 'Medium'
  },
  
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed', 'Reopened'],
    default: 'Open'
  },
  
  // Relationships
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Comments
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    isInternal: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Resolution Details
  resolution: {
    description: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date
  },
  
  // Attachments
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimeType: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  closedAt: Date,
  
  // SLA Tracking
  dueDate: Date,
  responseTime: Number, // in hours
  resolutionTime: Number // in hours
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Update updatedAt timestamp
ticketSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for performance
ticketSchema.index({ createdBy: 1 });
ticketSchema.index({ assignedTo: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ category: 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ updatedAt: -1 });
ticketSchema.index({ status: 1, priority: -1 });

// Virtual for ticket number
ticketSchema.virtual('ticketNumber').get(function() {
  return `TICKET-${this._id.toString().substring(18, 24).toUpperCase()}`;
});

// Virtual for isOverdue
ticketSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate) return false;
  return new Date() > this.dueDate && this.status !== 'Resolved' && this.status !== 'Closed';
});

module.exports = mongoose.model('Ticket', ticketSchema);