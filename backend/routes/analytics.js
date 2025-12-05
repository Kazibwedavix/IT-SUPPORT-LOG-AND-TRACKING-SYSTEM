/**
 * Analytics Routes
 * 
 * @version 1.0.0
 * @author Bugema University IT Support System
 */

const express = require('express');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);

/**
 * @route   GET /api/analytics
 * @desc    Get analytics data
 * @access  Private
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Analytics API',
    data: {
      message: 'Analytics features coming soon'
    }
  });
});

module.exports = router;