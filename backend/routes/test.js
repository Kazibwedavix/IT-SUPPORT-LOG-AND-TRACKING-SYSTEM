const express = require('express');
const emailService = require('../services/emailService');

const router = express.Router();

// Test email route (remove in production)
router.get('/test-email', async (req, res) => {
  try {
    const testTicket = {
      _id: 'test123',
      ticketId: 'TKT-0001',
      title: 'Test Ticket - Monitor Not Working',
      description: 'This is a test ticket description for email testing',
      issueType: 'hardware',
      urgency: 'high'
    };

    await emailService.sendAssignmentNotification(
      process.env.EMAIL_USER, // Send test to yourself
      'Test Technician',
      testTicket
    );

    res.json({ message: 'Test email sent successfully!' });
  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({ 
      message: 'Test email failed', 
      error: error.message 
    });
  }
});

module.exports = router;