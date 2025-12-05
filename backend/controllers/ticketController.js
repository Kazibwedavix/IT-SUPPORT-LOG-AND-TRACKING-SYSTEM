const Ticket = require('../models/Ticket');
const User = require('../models/User');

// Create a new ticket
exports.createTicket = async (req, res) => {
  try {
    const { title, description, issueType, urgency, location } = req.body;
    
    // Validation
    if (!title || !description || !issueType) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and issue type are required'
      });
    }

    // Get user info for department
    const user = await User.findById(req.user.id);
    
    const newTicket = new Ticket({
      title,
      description,
      issueType,
      urgency: urgency || 'medium',
      createdBy: req.user.id,
      department: user?.department || 'General',
      location: location || 'Main Campus',
      status: 'open'
    });

    const savedTicket = await newTicket.save();
    
    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: {
        ticket: savedTicket
      }
    });

  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create ticket',
      error: error.message
    });
  }
};

// Get all tickets for current user
exports.getUserTickets = async (req, res) => {
  try {
    const { status, issueType, urgency } = req.query;
    
    const filter = { createdBy: req.user.id };
    
    if (status) filter.status = status;
    if (issueType) filter.issueType = issueType;
    if (urgency) filter.urgency = urgency;
    
    const tickets = await Ticket.find(filter)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email');
    
    res.json({
      success: true,
      data: {
        tickets,
        count: tickets.length
      }
    });

  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets',
      error: error.message
    });
  }
};

// Get single ticket
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email department')
      .populate('assignedTo', 'firstName lastName email');
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Check permission (user can only view their own tickets unless admin)
    if (ticket.createdBy._id.toString() !== req.user.id.toString() && 
        !['it_admin', 'system_admin', 'it_technician'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
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
      message: 'Failed to fetch ticket',
      error: error.message
    });
  }
};

// Update ticket status
exports.updateTicketStatus = async (req, res) => {
  try {
    const { status, resolutionNotes } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Check permissions
    if (ticket.createdBy.toString() !== req.user.id.toString() && 
        !['it_admin', 'system_admin', 'it_technician'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Update ticket
    ticket.status = status || ticket.status;
    
    if (resolutionNotes) {
      ticket.resolutionNotes = resolutionNotes;
    }
    
    if (status === 'resolved') {
      ticket.resolvedAt = new Date();
    } else if (status === 'closed') {
      ticket.closedAt = new Date();
    }
    
    const updatedTicket = await ticket.save();
    
    res.json({
      success: true,
      message: 'Ticket updated successfully',
      data: { ticket: updatedTicket }
    });

  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket',
      error: error.message
    });
  }
};

// Assign ticket to technician
exports.assignTicket = async (req, res) => {
  try {
    const { technicianId } = req.body;
    
    if (!technicianId) {
      return res.status(400).json({
        success: false,
        message: 'Technician ID is required'
      });
    }
    
    // Check if user is admin or technician
    if (!['it_admin', 'system_admin', 'it_technician'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only IT staff can assign tickets.'
      });
    }
    
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Check if technician exists
    const technician = await User.findById(technicianId);
    if (!technician || !['it_technician', 'it_admin', 'system_admin'].includes(technician.role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid technician'
      });
    }
    
    ticket.assignedTo = technicianId;
    ticket.status = 'in-progress';
    
    const updatedTicket = await ticket.save();
    
    res.json({
      success: true,
      message: `Ticket assigned to ${technician.firstName} ${technician.lastName}`,
      data: { ticket: updatedTicket }
    });

  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign ticket',
      error: error.message
    });
  }
};

// Get ticket statistics
exports.getTicketStats = async (req, res) => {
  try {
    const stats = {};
    
    if (['it_admin', 'system_admin', 'it_technician'].includes(req.user.role)) {
      // Admin/technician sees all tickets
      stats.total = await Ticket.countDocuments();
      stats.open = await Ticket.countDocuments({ status: 'open' });
      stats.inProgress = await Ticket.countDocuments({ status: 'in-progress' });
      stats.resolved = await Ticket.countDocuments({ status: 'resolved' });
      stats.closed = await Ticket.countDocuments({ status: 'closed' });
      
      // Urgency breakdown
      stats.critical = await Ticket.countDocuments({ urgency: 'critical' });
      stats.high = await Ticket.countDocuments({ urgency: 'high' });
      stats.medium = await Ticket.countDocuments({ urgency: 'medium' });
      stats.low = await Ticket.countDocuments({ urgency: 'low' });
      
      // Issue type breakdown
      stats.byIssueType = await Ticket.aggregate([
        { $group: { _id: '$issueType', count: { $sum: 1 } } }
      ]);
    } else {
      // Regular user sees only their tickets
      stats.total = await Ticket.countDocuments({ createdBy: req.user.id });
      stats.open = await Ticket.countDocuments({ 
        createdBy: req.user.id, 
        status: 'open' 
      });
      stats.inProgress = await Ticket.countDocuments({ 
        createdBy: req.user.id, 
        status: 'in-progress' 
      });
      stats.resolved = await Ticket.countDocuments({ 
        createdBy: req.user.id, 
        status: 'resolved' 
      });
      stats.closed = await Ticket.countDocuments({ 
        createdBy: req.user.id, 
        status: 'closed' 
      });
    }
    
    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
};