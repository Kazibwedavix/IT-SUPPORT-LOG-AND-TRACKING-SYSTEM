/**
 * User Routes
 * 
 * @version 1.0.0
 * @author Bugema University IT Support System
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const { auth, requireRole } = require('../middleware/auth');
const auditService = require('../services/auditService');

const router = express.Router();

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password -refreshToken -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', auth, [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('department')
    .optional()
    .isIn(['Computer Science', 'Information Technology', 'Business Computing', 'Network Systems', 'Other'])
    .withMessage('Invalid department')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const updates = {};
    const allowedFields = ['username', 'email', 'department', 'phoneNumber', 'avatar'];
    
    // Filter allowed fields
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key) && req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });

    // Check if email is being changed and if it's already taken
    if (updates.email && updates.email !== req.user.email) {
      const existingUser = await User.findOne({ email: updates.email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
      updates.emailVerified = false; // Require verification for new email
    }

    // Check if username is being changed and if it's already taken
    if (updates.username && updates.username !== req.user.username) {
      const existingUser = await User.findOne({ username: updates.username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -refreshToken -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires');

    auditService.logUserActivity(req.user.userId, 'UPDATE_PROFILE', 'USER', {
      updatedFields: Object.keys(updates)
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
});

/**
 * @route   PUT /api/users/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password', auth, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.userId).select('+password');
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    await user.save();

    // Invalidate refresh token
    user.refreshToken = undefined;
    await user.save();

    auditService.logUserActivity(req.user.userId, 'CHANGE_PASSWORD', 'AUTH');

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change'
    });
  }
});

/**
 * @route   GET /api/users
 * @desc    Get all users (Admin only)
 * @access  Private/Admin
 */
router.get('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, role, status, search } = req.query;
    
    const query = {};
    
    // Filter by role
    if (role) query.role = role;
    
    // Filter by status
    if (status) query.status = status;
    
    // Search by username, email, or studentId
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password -refreshToken -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    auditService.logUserActivity(req.user.userId, 'GET_ALL_USERS', 'USER', {
      page,
      limit,
      filters: { role, status, search }
    });

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: page * 1,
          limit: limit * 1,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID (Admin only)
 * @access  Private/Admin
 */
router.get('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -refreshToken -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    auditService.logUserActivity(req.user.userId, 'GET_USER_BY_ID', 'USER', {
      targetUserId: req.params.id
    });

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update user by ID (Admin only)
 * @access  Private/Admin
 */
router.put('/:id', auth, requireRole('admin'), [
  body('role')
    .optional()
    .isIn(['student', 'staff', 'technician', 'admin'])
    .withMessage('Invalid role'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended', 'pending'])
    .withMessage('Invalid status'),
  
  body('department')
    .optional()
    .isIn(['Computer Science', 'Information Technology', 'Business Computing', 'Network Systems', 'Other'])
    .withMessage('Invalid department')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const updates = {};
    const allowedFields = ['role', 'status', 'department', 'emailVerified'];
    
    // Filter allowed fields for admin updates
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key) && req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });

    // Prevent admin from demoting themselves
    if (req.params.id === req.user.userId && updates.role && updates.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own admin role'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -refreshToken -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    auditService.logUserActivity(req.user.userId, 'UPDATE_USER_BY_ID', 'USER', {
      targetUserId: req.params.id,
      updatedFields: Object.keys(updates)
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user update'
    });
  }
});

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (Admin only)
 * @access  Private/Admin
 */
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.params.id === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    auditService.logUserActivity(req.user.userId, 'DELETE_USER', 'USER', {
      targetUserId: req.params.id,
      deletedUser: {
        email: user.email,
        role: user.role
      }
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user deletion'
    });
  }
});

/**
 * @route   GET /api/users/admin/stats
 * @desc    Get user statistics (Admin only)
 * @access  Private/Admin
 */
router.get('/admin/stats', auth, requireRole('admin'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const inactiveUsers = await User.countDocuments({ status: 'inactive' });
    const suspendedUsers = await User.countDocuments({ status: 'suspended' });

    auditService.logUserActivity(req.user.userId, 'GET_USER_STATS', 'USER');

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        suspendedUsers
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/users/admin/system-stats
 * @desc    Get system statistics (Admin only)
 * @access  Private/Admin
 */
router.get('/admin/system-stats', auth, requireRole('admin'), async (req, res) => {
  try {
    const totalTickets = await Ticket.countDocuments();
    const openTickets = await Ticket.countDocuments({ status: 'Open' });
    const inProgressTickets = await Ticket.countDocuments({ status: 'In Progress' });
    const resolvedTickets = await Ticket.countDocuments({ status: 'Resolved' });
    const closedTickets = await Ticket.countDocuments({ status: 'Closed' });

    auditService.logUserActivity(req.user.userId, 'GET_SYSTEM_STATS', 'TICKET');

    res.json({
      success: true,
      data: {
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets
      }
    });

  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
