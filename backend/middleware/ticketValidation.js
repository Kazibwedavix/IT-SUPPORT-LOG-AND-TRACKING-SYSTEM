const { body, param, query } = require('express-validator');

// Ticket creation validation
exports.validateTicketCreation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
  
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 10, max: 5000 }).withMessage('Description must be 10-5000 characters'),
  
  body('category')
    .isIn(['Hardware', 'Software', 'Network', 'Email', 'Account Access', 'Printer', 'Phone', 'Other'])
    .withMessage('Invalid category'),
  
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Critical'])
    .withMessage('Invalid priority'),
  
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Department name too long'),
  
  body('location.building')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Building name too long'),
  
  body('location.room')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Room number too long'),
  
  body('attachments')
    .optional()
    .isArray().withMessage('Attachments must be an array'),
  
  body('attachments.*.filename')
    .if(body('attachments').exists())
    .notEmpty().withMessage('Attachment filename is required'),
  
  body('attachments.*.size')
    .if(body('attachments').exists())
    .isInt({ max: 10485760 }).withMessage('Attachment size cannot exceed 10MB')
];

// Comment validation
exports.validateComment = [
  body('content')
    .trim()
    .notEmpty().withMessage('Comment content is required')
    .isLength({ min: 1, max: 2000 }).withMessage('Comment must be 1-2000 characters'),
  
  body('isInternal')
    .optional()
    .isBoolean().withMessage('isInternal must be a boolean')
];

// Bulk operations validation
exports.validateBulkOperations = [
  body('ticketIds')
    .isArray().withMessage('ticketIds must be an array')
    .notEmpty().withMessage('At least one ticket ID is required'),
  
  body('ticketIds.*')
    .isMongoId().withMessage('Invalid ticket ID'),
  
  body('updates')
    .isObject().withMessage('Updates must be an object')
    .notEmpty().withMessage('Updates cannot be empty'),
  
  body('changeReason')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Change reason too long')
];

// Export validation
exports.validateExport = [
  body('format')
    .optional()
    .isIn(['csv', 'excel', 'json']).withMessage('Invalid export format'),
  
  body('filters')
    .optional()
    .isObject().withMessage('Filters must be an object')
];

// Ticket ID validation
exports.validateTicketId = [
  param('id')
    .notEmpty().withMessage('Ticket ID is required')
    .custom(value => {
      if (!/^[0-9a-fA-F]{24}$/.test(value) && !/^TKT-[0-9]{8}-[0-9]{4}$/.test(value)) {
        throw new Error('Invalid ticket ID format');
      }
      return true;
    })
];