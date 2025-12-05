const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  emailNotifications: {
    ticketAssigned: { type: Boolean, default: true },
    statusUpdated: { type: Boolean, default: true },
    newComment: { type: Boolean, default: true }
  },
  emailFrequency: {
    type: String,
    enum: ['immediate', 'digest', 'none'],
    default: 'immediate'
  },
  dataMinimization: {
    type: Boolean,
    default: true // Limit data in emails by default
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);