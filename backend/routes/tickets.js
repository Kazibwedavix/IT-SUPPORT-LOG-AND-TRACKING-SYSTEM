// routes/tickets.js - COMPLETE ROUTES
const express = require('express');
const router = express.Router();
const TicketController = require('../controllers/ticketController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Validation middleware
const validateTicketCreation = (req, res, next) => {
  const { title, description, category } = req.body;
  const errors = [];
  
  if (!title || title.trim().length < 5) {
    errors.push({
      field: 'title',
      message: 'Title must be at least 5 characters'
    });
  }
  
  if (!description || description.trim().length < 10) {
    errors.push({
      field: 'description',
      message: 'Description must be at least 10 characters'
    });
  }
  
  if (!category) {
    errors.push({
      field: 'category',
      message: 'Category is required'
    });
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors,
      code: 'VALIDATION_ERROR'
    });
  }
  
  next();
};

const validateComment = (req, res, next) => {
  const { content } = req.body;
  
  if (!content || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Comment content is required',
      code: 'VALIDATION_ERROR'
    });
  }
  
  if (content.length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'Comment cannot exceed 2000 characters',
      code: 'VALIDATION_ERROR'
    });
  }
  
  next();
};

// All routes require authentication
router.use(authenticateToken);

// ============================================
// TICKET MANAGEMENT ROUTES
// ============================================

/**
 * @route   POST /api/tickets
 * @desc    Create a new ticket
 * @access  All authenticated users
 */
router.post('/', validateTicketCreation, async (req, res) => {
  await TicketController.createTicket(req, res);
});

/**
 * @route   GET /api/tickets
 * @desc    Get all tickets with filters
 * @access  Private (Role-based)
 */
router.get('/', async (req, res) => {
  await TicketController.getTickets(req, res);
});

/**
 * @route   GET /api/tickets/statistics
 * @desc    Get ticket statistics
 * @access  Private
 */
router.get('/statistics', async (req, res) => {
  await TicketController.getTicketStatistics(req, res);
});

/**
 * @route   GET /api/tickets/:id
 * @desc    Get single ticket
 * @access  Private (Role-based)
 */
router.get('/:id', async (req, res) => {
  await TicketController.getTicket(req, res);
});

/**
 * @route   PUT /api/tickets/:id
 * @desc    Update ticket
 * @access  Private (Owner, Assigned, Admin, Technician)
 */
router.put('/:id', async (req, res) => {
  await TicketController.updateTicket(req, res);
});

/**
 * @route   DELETE /api/tickets/:id
 * @desc    Soft delete ticket
 * @access  Private/Admin only
 */
router.delete('/:id', authorizeRoles('Admin'), async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }
    
    ticket.isDeleted = true;
    ticket.deletedAt = new Date();
    ticket.deletedBy = req.user.id;
    
    await ticket.save();
    
    res.json({
      success: true,
      message: 'Ticket deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete ticket'
    });
  }
});

// ============================================
// TICKET OPERATIONS
// ============================================

/**
 * @route   POST /api/tickets/:id/assign
 * @desc    Assign ticket to technician
 * @access  Private/Technician, Admin
 */
router.post('/:id/assign', authorizeRoles('Technician', 'Admin'), async (req, res) => {
  await TicketController.assignTicket(req, res);
});

/**
 * @route   POST /api/tickets/:id/comments
 * @desc    Add comment to ticket
 * @access  Private (All authenticated users with access)
 */
router.post('/:id/comments', validateComment, async (req, res) => {
  await TicketController.addComment(req, res);
});

/**
 * @route   POST /api/tickets/:id/resolve
 * @desc    Resolve ticket
 * @access  Private/Technician, Admin
 */
router.post('/:id/resolve', authorizeRoles('Technician', 'Admin'), async (req, res) => {
  await TicketController.resolveTicket(req, res);
});

/**
 * @route   POST /api/tickets/:id/escalate
 * @desc    Escalate ticket
 * @access  Private/Technician, Admin
 */
router.post('/:id/escalate', authorizeRoles('Technician', 'Admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }
    
    await ticket.escalate(req.user.id, reason);
    
    res.json({
      success: true,
      message: 'Ticket escalated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to escalate ticket'
    });
  }
});

/**
 * @route   POST /api/tickets/:id/reopen
 * @desc    Reopen ticket
 * @access  Private (Admin or ticket creator)
 */
router.post('/:id/reopen', async (req, res) => {
  try {
    const { reason } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }
    
    // Check permissions
    if (req.user.role !== 'Admin' && ticket.createdBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to reopen this ticket'
      });
    }
    
    await ticket.reopen(req.user.id, reason);
    
    res.json({
      success: true,
      message: 'Ticket reopened successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reopen ticket'
    });
  }
});

/**
 * @route   POST /api/tickets/:id/rate
 * @desc    Rate ticket resolution
 * @access  Private (Ticket creator only)
 */
router.post('/:id/rate', async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }
    
    // Check if user is the creator
    if (ticket.createdBy.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Only the ticket creator can rate the resolution'
      });
    }
    
    // Check if ticket is resolved
    if (ticket.status !== 'Resolved') {
      return res.status(400).json({
        success: false,
        error: 'Only resolved tickets can be rated'
      });
    }
    
    // Check if already rated
    if (ticket.resolution.satisfactionRating) {
      return res.status(400).json({
        success: false,
        error: 'Ticket has already been rated'
      });
    }
    
    await ticket.addRating(rating, comment);
    
    res.json({
      success: true,
      message: 'Rating submitted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to submit rating'
    });
  }
});

// ============================================
// UTILITY ROUTES
// ============================================

/**
 * @route   GET /api/tickets/search/suggestions
 * @desc    Get search suggestions
 * @access  Private
 */
router.get('/search/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: [],
        message: 'Search query too short'
      });
    }
    
    const suggestions = await Ticket.find(
      { 
        $text: { $search: q },
        isDeleted: false 
      },
      { score: { $meta: 'textScore' } }
    )
    .select('ticketNumber title status category priority createdAt')
    .sort({ score: { $meta: 'textScore' } })
    .limit(10)
    .lean();
    
    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Search failed'
    });
  }
});

/**
 * @route   GET /api/tickets/overdue
 * @desc    Get overdue tickets
 * @access  Private/Technician, Admin
 */
router.get('/overdue', authorizeRoles('Technician', 'Admin'), async (req, res) => {
  try {
    const tickets = await Ticket.getOverdue();
    
    res.json({
      success: true,
      data: tickets,
      count: tickets.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch overdue tickets'
    });
  }
});

/**
 * @route   GET /api/tickets/my/created
 * @desc    Get tickets created by current user
 * @access  Private
 */
router.get('/my/created', async (req, res) => {
  try {
    const tickets = await Ticket.getByUser(req.user.id);
    
    res.json({
      success: true,
      data: tickets,
      count: tickets.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch your tickets'
    });
  }
});

/**
 * @route   GET /api/tickets/my/assigned
 * @desc    Get tickets assigned to current user
 * @access  Private/Technician, Admin
 */
router.get('/my/assigned', authorizeRoles('Technician', 'Admin'), async (req, res) => {
  try {
    const tickets = await Ticket.getAssignedTickets(req.user.id);
    
    res.json({
      success: true,
      data: tickets,
      count: tickets.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch assigned tickets'
    });
  }
});

/**
 * @route   GET /api/tickets/status/:status
 * @desc    Get tickets by status
 * @access  Private
 */
router.get('/status/:status', async (req, res) => {
  try {
    const tickets = await Ticket.getByStatus(req.params.status);
    
    res.json({
      success: true,
      data: tickets,
      count: tickets.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tickets by status'
    });
  }
});

/**
 * @route   GET /api/tickets/metadata/categories
 * @desc    Get ticket metadata (categories, priorities, etc.)
 * @access  Public
 */
router.get('/metadata/categories', (req, res) => {
  const categories = {
    Hardware: { name: 'Hardware Issues', icon: '🔧', color: '#f59e0b' },
    Software: { name: 'Software Issues', icon: '💻', color: '#8b5cf6' },
    Network: { name: 'Network Issues', icon: '🌐', color: '#3b82f6' },
    Email: { name: 'Email Issues', icon: '📧', color: '#6366f1' },
    'Account Access': { name: 'Account Access Issues', icon: '👤', color: '#10b981' },
    Printer: { name: 'Printer Issues', icon: '🖨️', color: '#ec4899' },
    Phone: { name: 'Phone Issues', icon: '📞', color: '#f97316' },
    Other: { name: 'Other Issues', icon: '❓', color: '#6b7280' }
  };
  
  const priorities = {
    Critical: { color: '#dc2626', responseTime: 30, resolutionTime: 240 },
    High: { color: '#ea580c', responseTime: 120, resolutionTime: 1440 },
    Medium: { color: '#d97706', responseTime: 480, resolutionTime: 4320 },
    Low: { color: '#059669', responseTime: 1440, resolutionTime: 10080 }
  };
  
  const statuses = {
    Open: { color: '#3b82f6', description: 'New ticket, not yet assigned' },
    Assigned: { color: '#f59e0b', description: 'Assigned to a technician' },
    'In Progress': { color: '#8b5cf6', description: 'Technician is working on it' },
    Pending: { color: '#6b7280', description: 'Waiting for information or parts' },
    Resolved: { color: '#10b981', description: 'Issue has been resolved' },
    Closed: { color: '#6b7280', description: 'Ticket closed' },
    Reopened: { color: '#ec4899', description: 'Ticket reopened after resolution' },
    Cancelled: { color: '#6b7280', description: 'Ticket cancelled' }
  };
  
  res.json({
    success: true,
    data: {
      categories,
      priorities,
      statuses,
      campuses: ['Main Campus', 'Kampala Campus', 'Other'],
      defaultCategory: 'Other',
      defaultPriority: 'Medium'
    }
  });
});

module.exports = router;