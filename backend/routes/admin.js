/**
 * Admin Routes
 * 
 * @version 1.0.0
 * @author Bugema University IT Support System
 */

const express = require('express');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// All admin routes require admin role
router.use(auth, requireRole('admin'));

/**
 * @route   GET /api/admin
 * @desc    Admin dashboard
 * @access  Private/Admin
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Admin dashboard',
    data: {
      features: [
        'User Management',
        'System Configuration',
        'Audit Logs',
        'Reports',
        'System Monitoring'
      ]
    }
  });
});

module.exports = router;