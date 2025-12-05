// backend/src/middleware/validation.js
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

/**
 * Registration validation middleware
 */
exports.validateRegistration = [
  // Username validation
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores'),
  
  // Email validation
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .custom(async (email) => {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        throw new Error('Email is already registered');
      }
      return true;
    }),
  
  // Password validation
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain at least one special character'),
  
  // Role validation
  body('role')
    .optional()
    .isIn(['student', 'staff', 'technician', 'admin']).withMessage('Invalid role'),
  
  // Student ID validation for students
  body('studentId')
    .if(body('role').equals('student'))
    .notEmpty().withMessage('Student ID is required for students')
    .matches(/^[0-9]{2}\/[A-Z]{3,5}\/[A-Z]{2}\/[A-Z]\/[0-9]{3,5}$/).withMessage('Invalid student ID format'),
  
  // Department validation
  body('department')
    .notEmpty().withMessage('Department is required')
    .trim(),
  
  // Phone validation
  body('phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Invalid phone number'),
  
  // Terms agreement
  body('agreeToTerms')
    .equals(true).withMessage('You must agree to the terms and conditions'),
  
  // Validation result handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        })),
        code: 'VALIDATION_ERROR'
      });
    }
    next();
  }
];

/**
 * Login validation middleware
 */
exports.validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email'),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
];