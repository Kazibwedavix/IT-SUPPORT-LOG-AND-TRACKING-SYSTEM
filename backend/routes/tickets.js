/**
 * BUGEMA UNIVERSITY IT SUPPORT SYSTEM
 * Complete Ticket Routes - Production Ready
 * 
 * Contact: itsupport.bugemauniv.ac.ug | 0784845785
 * 
 * @version 3.0.0
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { auth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { validate } = require('../middleware/validate');

// Public routes
router.post(
  '/',
  [
    body('title').trim().isLength({ min: 5, max: 200 }).withMessage('Title must be 5-200 characters'),
    body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('category').isIn(['Hardware', 'Software', 'Network', 'Email', 'Account', 'Access', 'Other']).withMessage('Invalid category'),
    body('priority').isIn(['Low', 'Medium', 'High', 'Critical']).withMessage('Invalid priority'),
    body('location.building').optional().trim(),
    body('location.room').optional().trim(),
    body('location.campus').optional().trim(),
    validate
  ],
  ticketController.createTicket
);

// Get ticket by number (public with access token)
router.get(
  '/number/:ticketNumber',
  [
    param('ticketNumber').matches(/^TKT-\d{8}-\d{4}$/).withMessage('Invalid ticket number format'),
    query('accessToken').optional().isJWT()
  ],
  ticketController.getTicketByNumber
);

// Protected routes (require authentication)
router.use(auth);

// Ticket CRUD operations
router.get(
  '/',
  [
    query('status').optional().isIn(['Open', 'In Progress', 'Resolved', 'Closed', 'Reopened']),
    query('priority').optional().isIn(['Low', 'Medium', 'High', 'Critical']),
    query('category').optional(),
    query('department').optional(),
    query('assignedTo').optional().isMongoId(),
    query('createdBy').optional().isMongoId(),
    query('fromDate').optional().isISO8601(),
    query('toDate').optional().isISO8601(),
    query('search').optional().trim(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    validate
  ],
  ticketController.getAllTickets
);

router.get(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    validate
  ],
  ticketController.getTicket
);

router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('title').optional().trim().isLength({ min: 5, max: 200 }),
    body('description').optional().trim().isLength({ min: 10 }),
    body('category').optional().isIn(['Hardware', 'Software', 'Network', 'Email', 'Account', 'Access', 'Other']),
    body('priority').optional().isIn(['Low', 'Medium', 'High', 'Critical']),
    body('location').optional().isObject(),
    validate
  ],
  ticketController.updateTicket
);

router.delete(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    validate
  ],
  requireRole(['Admin']),
  ticketController.deleteTicket
);

// Ticket Actions
router.post(
  '/:id/assign',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('technicianId').isMongoId().withMessage('Invalid technician ID'),
    body('reason').optional().trim(),
    validate
  ],
  requireRole(['Technician', 'Admin']),
  ticketController.assignTicket
);

router.post(
  '/:id/escalate',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('reason').trim().isLength({ min: 10 }).withMessage('Escalation reason must be at least 10 characters'),
    body('targetPriority').optional().isIn(['Medium', 'High', 'Critical']),
    validate
  ],
  ticketController.escalateTicket
);

router.put(
  '/:id/status',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('status').isIn(['Open', 'In Progress', 'Resolved', 'Closed', 'Reopened']).withMessage('Invalid status'),
    body('notes').optional().trim(),
    validate
  ],
  ticketController.updateStatus
);

router.post(
  '/:id/resolve',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('resolution').trim().isLength({ min: 10 }).withMessage('Resolution description must be at least 10 characters'),
    body('satisfaction').optional().isInt({ min: 1, max: 5 }),
    validate
  ],
  requireRole(['Technician', 'Admin']),
  ticketController.resolveTicket
);

router.post(
  '/:id/reopen',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('reason').trim().isLength({ min: 10 }).withMessage('Reopen reason must be at least 10 characters'),
    validate
  ],
  ticketController.reopenTicket
);

// Comments
router.post(
  '/:id/comments',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    body('content').trim().isLength({ min: 1 }).withMessage('Comment cannot be empty'),
    body('isInternal').optional().isBoolean(),
    validate
  ],
  ticketController.addComment
);

router.put(
  '/:id/comments/:commentId',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    param('commentId').isMongoId().withMessage('Invalid comment ID'),
    body('content').trim().isLength({ min: 1 }),
    validate
  ],
  ticketController.updateComment
);

router.delete(
  '/:id/comments/:commentId',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    param('commentId').isMongoId().withMessage('Invalid comment ID'),
    validate
  ],
  ticketController.deleteComment
);

// File Attachments
router.post(
  '/:id/attachments',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    upload.array('files', 5) // Max 5 files per upload
  ],
  ticketController.addAttachments
);

router.delete(
  '/:id/attachments/:attachmentId',
  [
    param('id').isMongoId().withMessage('Invalid ticket ID'),
    param('attachmentId').isMongoId().withMessage('Invalid attachment ID'),
    validate
  ],
  ticketController.deleteAttachment
);

// Search & Analytics
router.get(
  '/search/advanced',
  [
    query('q').optional().trim(),
    query('tags').optional(),
    query('statuses').optional(),
    query('priorities').optional(),
    query('categories').optional(),
    query('dateRange').optional(),
    query('sortBy').optional().isIn(['createdAt', 'updatedAt', 'priority', 'dueDate']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    validate
  ],
  ticketController.advancedSearch
);

router.get(
  '/analytics/overview',
  requireRole(['Admin', 'Technician']),
  ticketController.getAnalyticsOverview
);

router.get(
  '/analytics/department/:department',
  [
    param('department').trim(),
    query('fromDate').optional().isISO8601(),
    query('toDate').optional().isISO8601(),
    validate
  ],
  requireRole(['Admin']),
  ticketController.getDepartmentAnalytics
);

// My Tickets
router.get('/my/created', ticketController.getMyCreatedTickets);
router.get('/my/assigned', ticketController.getMyAssignedTickets);

module.exports = router;