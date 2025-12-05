const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: false  // CHANGE THIS FROM true TO false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true
  },
  oldValue: {
    type: String,
    default: ''
  },
  newValue: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    required: true
  },
  // ADD THESE NEW OPTIONAL FIELDS FOR USER MANAGEMENT ACTIVITIES
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  details: {
    type: mongoose.Schema.Types.Mixed  // For storing additional data
  },
  ipAddress: {
    type: String
  }
}, {
  timestamps: true
});

// Add indexes for better performance
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ ticketId: 1 });
activitySchema.index({ action: 1 });
activitySchema.index({ targetUserId: 1 });

module.exports = mongoose.model('Activity', activitySchema);