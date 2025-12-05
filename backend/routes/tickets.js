/**
 * Ticket Routes
 * 
 * @version 1.0.0
 * @author Bugema University IT Support System
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const Ticket = require('../models/Ticket');
const { auth, requireRole } = require('../middleware/auth');
const auditService = require('../services/auditService');

const router = express.Router();

/**
 * @route   GET /api/tickets
 * @desc    Get all tickets (with filters)
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, category, assignedTo, createdBy } = req.query;
    
    const query = {};
    
    // Regular users can only see their own tickets
    if (req.user.role !== 'admin' && req.user.role !== 'technician') {
      query.createdBy = req.user.userId;
    }
    
    // Technicians can see tickets assigned to them
    if (req.user.role === 'technician') {
      query.$or = [
        { createdBy: req.user.userId },
        { assignedTo: req.user.userId }
      ];
    }
    
    // Apply filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    if (assignedTo) query.assignedTo = assignedTo;
    if (createdBy) query.createdBy = createdBy;

    const tickets = await Ticket.find(query)
      .populate('createdBy', 'username email role department')
      .populate('assignedTo', 'username email role')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Ticket.countDocuments(query);

    res.json({
      success: true,
      data: {
        tickets,
        pagination: {
          total,
          page: page * 1,
          limit: limit * 1,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   POST /api/tickets
 * @desc    Create new ticket
 * @access  Private
 */
router.post('/', auth, [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters'),
  
  body('description')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters'),
  
  body('category')
    .isIn(['Hardware', 'Software', 'Network', 'Account', 'Other'])
    .withMessage('Invalid category'),
  
  body('priority')
    .isIn(['Low', 'Medium', 'High', 'Critical'])
    .withMessage('Invalid priority')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { title, description, category, priority, attachments } = req.body;

    const ticket = new Ticket({
      title,
      description,
      category,
      priority,
      createdBy: req.user.userId,
      status: 'Open'
    });

    await ticket.save();

    // Populate createdBy for response
    await ticket.populate('createdBy', 'username email role department');

    auditService.logUserActivity(req.user.userId, 'CREATE_TICKET', 'TICKET', {
      ticketId: ticket._id,
      title: ticket.title,
      category: ticket.category,
      priority: ticket.priority
    });

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: { ticket }
    });

  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during ticket creation'
    });
  }
});

/**
 * @route   GET /api/tickets/:id
 * @desc    Get ticket by ID
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('createdBy', 'username email role department')
      .populate('assignedTo', 'username email role')
      .populate({
        path: 'comments.user',
        select: 'username email role'
      });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && 
        req.user.role !== 'technician' && 
        ticket.createdBy._id.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this ticket'
      });
    }

    res.json({
      success: true,
      data: { ticket }
    });

  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   PUT /api/tickets/:id
 * @desc    Update ticket
 * @access  Private
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check permissions
    const canUpdate = req.user.role === 'admin' || 
                     req.user.role === 'technician' || 
                     ticket.createdBy.toString() === req.user.userId;

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this ticket'
      });
    }

    // Define allowed updates based on role
    const updates = {};
    const allowedFields = [];
    
    if (req.user.role === 'admin' || req.user.role === 'technician') {
      allowedFields.push('status', 'priority', 'assignedTo', 'category');
    }
    
    if (ticket.createdBy.toString() === req.user.userId) {
      allowedFields.push('title', 'description');
    }

    // Filter updates
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key) && req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    });

    // Update ticket
    Object.assign(ticket, updates);
    await ticket.save();

    // Populate for response
    await ticket.populate('createdBy', 'username email role department');
    await ticket.populate('assignedTo', 'username email role');

    auditService.logUserActivity(req.user.userId, 'UPDATE_TICKET', 'TICKET', {
      ticketId: ticket._id,
      updatedFields: Object.keys(updates)
    });

    res.json({
      success: true,
      message: 'Ticket updated successfully',
      data: { ticket }
    });

  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during ticket update'
    });
  }
});

/**
 * @route   POST /api/tickets/:id/comments
 * @desc    Add comment to ticket
 * @access  Private
 */
router.post('/:id/comments', auth, [
  body('content')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Comment content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check permissions
    const canComment = req.user.role === 'admin' || 
                      req.user.role === 'technician' || 
                      ticket.createdBy.toString() === req.user.userId ||
                      (ticket.assignedTo && ticket.assignedTo.toString() === req.user.userId);

    if (!canComment) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to comment on this ticket'
      });
    }

    const comment = {
      user: req.user.userId,
      content: req.body.content,
      isInternal: req.body.isInternal || false
    };

    ticket.comments.push(comment);
    ticket.updatedAt = Date.now();
    await ticket.save();

    // Populate user info in the added comment
    const addedComment = ticket.comments[ticket.comments.length - 1];
    await addedComment.populate('user', 'username email role');

    auditService.logUserActivity(req.user.userId, 'ADD_COMMENT', 'TICKET', {
      ticketId: ticket._id,
      commentId: addedComment._id,
      isInternal: comment.isInternal
    });

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: { comment: addedComment }
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during comment addition'
    });
  }
});

/**
 * @route   PUT /api/tickets/:id/assign
 * @desc    Assign ticket to technician (Admin only)
 * @access  Private/Admin
 */
router.put('/:id/assign', auth, requireRole('admin'), [
  body('technicianId')
    .notEmpty()
    .withMessage('Technician ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Verify technician exists and has technician role
    const technician = await User.findById(req.body.technicianId);
    if (!technician || technician.role !== 'technician') {
      return res.status(400).json({
        success: false,
        message: 'Invalid technician ID or user is not a technician'
      });
    }

    ticket.assignedTo = req.body.technicianId;
    ticket.status = 'In Progress';
    await ticket.save();

    await ticket.populate('assignedTo', 'username email role');

    auditService.logUserActivity(req.user.userId, 'ASSIGN_TICKET', 'TICKET', {
      ticketId: ticket._id,
      assignedTo: req.body.technicianId
    });

    res.json({
      success: true,
      message: 'Ticket assigned successfully',
      data: { ticket }
    });

  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during ticket assignment'
    });
  }
});

module.exports = router;