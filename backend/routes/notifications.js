/**
 * Notification Routes
 * 
 * @version 1.0.0
 * @author Bugema University IT Support System
 */

const express = require('express');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Notifications API',
    data: {
      notifications: [],
      unreadCount: 0
    }
  });
});

module.exports = router;