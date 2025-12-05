const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  isInternal: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const Comment = mongoose.model('Comment', commentSchema);
module.exports = Comment;