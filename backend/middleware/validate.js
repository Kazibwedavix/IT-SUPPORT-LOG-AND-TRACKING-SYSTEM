/**
 * BUGEMA UNIVERSITY IT SUPPORT SYSTEM
 * Request Validation Middleware
 * 
 * @version 1.0.0
 */

const { validationResult } = require('express-validator');

/**
 * Middleware to validate request using express-validator
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 * @returns {Object} Validation result
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Format errors for consistent response
    const formattedErrors = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: formattedErrors,
      supportContact: {
        email: 'itsupport@bugemauniv.ac.ug',
        phone: '0784845785'
      }
    });
  }
  
  next();
};

/**
 * Validate MongoDB ObjectId
 * 
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid ObjectId
 */
const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Validate email address
 * 
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Uganda format)
 * 
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone
 */
const isValidPhone = (phone) => {
  // Uganda phone format: 07XXXXXXXX or +2567XXXXXXXX
  const phoneRegex = /^(07\d{8}|\+2567\d{8})$/;
  return phoneRegex.test(phone);
};

/**
 * Validate date string
 * 
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid date
 */
const isValidDate = (dateStr) => {
  return !isNaN(Date.parse(dateStr));
};

/**
 * Sanitize input string
 * 
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeInput = (str) => {
  if (typeof str !== 'string') return str;
  
  // Remove potentially dangerous characters
  return str
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
};

/**
 * Validate file upload
 * 
 * @param {Object} file - File object from multer
 * @param {Array} allowedTypes - Allowed MIME types
 * @param {number} maxSize - Maximum file size in bytes
 * @returns {Object} Validation result
 */
const validateFile = (file, allowedTypes, maxSize) => {
  const errors = [];
  
  if (!file) {
    errors.push('No file provided');
    return { valid: false, errors };
  }
  
  // Check file type
  if (!allowedTypes.includes(file.mimetype)) {
    errors.push(`File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }
  
  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    errors.push(`File size ${(file.size / (1024 * 1024)).toFixed(2)}MB exceeds maximum ${maxSizeMB}MB`);
  }
  
  // Check filename for security
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js'];
  const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();
  
  if (dangerousExtensions.includes(fileExtension)) {
    errors.push(`File extension ${fileExtension} is not allowed for security reasons`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  validate,
  isValidObjectId,
  isValidEmail,
  isValidPhone,
  isValidDate,
  sanitizeInput,
  validateFile
};