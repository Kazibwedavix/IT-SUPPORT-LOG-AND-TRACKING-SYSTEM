/**
 * BUGEMA UNIVERSITY IT SUPPORT SYSTEM
 * Complete Ticket Controller - Production Ready
 * 
 * Contact: itsupport@bugemauniv.ac.ug | 0784845785
 * 
 * @version 3.0.0
 */

/**
 * BUGEMA UNIVERSITY IT SUPPORT SYSTEM
 * Complete Ticket Controller - Production Ready
 * 
 * Contact: itsupport@bugemauniv.ac.ug | 0784845785
 * 
 * @version 3.0.1 - Fixed with graceful fallbacks
 */

const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');

// Try to import notificationService, but provide fallback if not available
let createNotification;
try {
  const notificationService = require('../services/notificationService');
  createNotification = notificationService.createNotification.bind(notificationService);
} catch (error) {
  console.warn('⚠️ Notification service not found. Using fallback.');
  createNotification = async () => ({
    success: false,
    message: 'Notification service unavailable'
  });
}

// Try to import slaService, but provide fallback if not available
let calculateSLADeadlines;
try {
  const slaService = require('../services/slaService');
  calculateSLADeadlines = slaService.calculateDeadlines.bind(slaService);
} catch (error) {
  console.warn('⚠️ SLA service not found. Using fallback deadlines.');
  calculateSLADeadlines = (priority) => {
    const responseTimes = {
      Critical: 30,
      High: 60,
      Medium: 240,
      Low: 480
    };
    
    const resolutionTimes = {
      Critical: 240,
      High: 480,
      Medium: 1440,
      Low: 2880
    };
    
    const now = new Date();
    return {
      responseDeadline: new Date(now.getTime() + (responseTimes[priority] || 240) * 60 * 1000),
      resolutionDeadline: new Date(now.getTime() + (resolutionTimes[priority] || 1440) * 60 * 1000),
      responseTime: responseTimes[priority] || 240,
      resolutionTime: resolutionTimes[priority] || 1440
    };
  };
}

const logger = require('../config/logger') || console;

// ... rest of your ticketController.js remains the same ...
/**
 * @desc    Create a new ticket
 * @route   POST /api/tickets
 * @access  Public
 */
exports.createTicket = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      priority,
      location,
      department,
      attachments
    } = req.body;

    // Create ticket
    const ticket = new Ticket({
      title,
      description,
      category: category || 'Other',
      priority: priority || 'Medium',
      location,
      department,
      createdBy: req.user ? req.user.id : null,
      sla: {
        responseDeadline: calculateSLADeadlines(priority || 'Medium').responseDeadline,
        resolutionDeadline: calculateSLADeadlines(priority || 'Medium').resolutionDeadline
      }
    });

    // Auto-assign based on category/department
    if (category) {
      const availableTech = await User.getAvailableTechnicians(category, department);
      if (availableTech) {
        ticket.assignedTo = availableTech._id;
        ticket.status = 'Assigned';
        ticket.assignedAt = new Date();
        ticket.assignedBy = req.user ? req.user.id : null;
      }
    }

    await ticket.save();

    // Generate ticket number (if not auto-generated)
    if (!ticket.ticketNumber) {
      ticket.ticketNumber = await generateTicketNumber();
      await ticket.save();
    }

    // Log the creation
    ticket.addHistory({
      action: 'CREATED',
      performedBy: req.user ? req.user.id : null,
      changes: { status: 'Open' }
    });

    // Send notification emails
    if (req.user && req.user.email) {
      await sendEmail({
        to: req.user.email,
        subject: `Ticket Created: ${ticket.ticketNumber} - ${ticket.title}`,
        template: 'ticketCreated',
        context: {
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          category: ticket.category,
          priority: ticket.priority,
          createdAt: ticket.createdAt,
          contactEmail: 'itsupport.bugemauniv.ac.ug',
          contactPhone: '0784845785'
        }
      });
    }

    // Notify available technicians if auto-assigned
    if (ticket.assignedTo) {
      const technician = await User.findById(ticket.assignedTo);
      if (technician && technician.email) {
        await sendEmail({
          to: technician.email,
          subject: `New Ticket Assigned: ${ticket.ticketNumber}`,
          template: 'ticketAssigned',
          context: {
            ticketNumber: ticket.ticketNumber,
            title: ticket.title,
            category: ticket.category,
            priority: ticket.priority,
            assignedBy: 'System Auto-Assignment',
            contactEmail: 'itsupport.bugemauniv.ac.ug'
          }
        });

        await createNotification({
          userId: technician._id,
          title: 'New Ticket Assigned',
          message: `Ticket ${ticket.ticketNumber} has been assigned to you`,
          type: 'assignment',
          relatedTo: ticket._id
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        ticket,
        message: 'Ticket created successfully. You will receive updates via email.',
        contactInfo: {
          email: 'itsupport.bugemauniv.ac.ug',
          phone: '0784845785'
        }
      }
    });

    logger.info(`Ticket created: ${ticket.ticketNumber} by ${req.user ? req.user.id : 'anonymous'}`);

  } catch (error) {
    logger.error(`Ticket creation error: ${error.message}`, { stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Failed to create ticket. Please contact support.',
      supportContact: {
        email: 'itsupport@bugemauniv.ac.ug',
        phone: '0784845785'
      }
    });
  }
};

/**
 * @desc    Get all tickets with filters
 * @route   GET /api/tickets
 * @access  Private
 */
exports.getAllTickets = async (req, res) => {
  try {
    const {
      status,
      priority,
      category,
      department,
      assignedTo,
      createdBy,
      fromDate,
      toDate,
      search,
      page = 1,
      limit = 20
    } = req.query;

    // Build filter object
    const filter = {};

    // Role-based filtering
    if (req.user.role === 'Student' || req.user.role === 'Staff') {
      filter.createdBy = req.user.id;
    } else if (req.user.role === 'Technician') {
      filter.$or = [
        { assignedTo: req.user.id },
        { assignedTo: null, category: req.user.supportAreas }
      ];
    }

    // Apply filters
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (department) filter.department = department;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (createdBy) filter.createdBy = createdBy;

    // Date range filter
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    // Search filter
    if (search) {
      filter.$text = { $search: search };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get tickets with population
    const tickets = await Ticket.find(filter)
      .populate('createdBy', 'firstName lastName email role')
      .populate('assignedTo', 'firstName lastName email role supportAreas')
      .populate('comments.user', 'firstName lastName role')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Ticket.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    // Add virtual fields for frontend
    const enhancedTickets = tickets.map(ticket => ({
      ...ticket,
      ticketNumber: ticket.ticketNumber || `TKT-${ticket._id.toString().substring(18, 24)}`,
      isOverdue: ticket.dueDate ? new Date() > new Date(ticket.dueDate) && 
                 ticket.status !== 'Resolved' && ticket.status !== 'Closed' : false,
      daysOpen: Math.floor((new Date() - new Date(ticket.createdAt)) / (1000 * 60 * 60 * 24))
    }));

    res.json({
      success: true,
      data: {
        tickets: enhancedTickets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        filters: {
          status,
          priority,
          category,
          department,
          search
        }
      }
    });

  } catch (error) {
    logger.error(`Get all tickets error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tickets'
    });
  }
};

/**
 * @desc    Get single ticket
 * @route   GET /api/tickets/:id
 * @access  Private
 */
exports.getTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email role department phone')
      .populate('assignedTo', 'firstName lastName email role supportAreas phone availabilityStatus')
      .populate('comments.user', 'firstName lastName role')
      .populate('attachments.uploadedBy', 'firstName lastName')
      .populate('history.performedBy', 'firstName lastName role');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Check permissions
    if (!canViewTicket(req.user, ticket)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this ticket'
      });
    }

    // Increment view count
    await ticket.incrementView(req.user.id);

    res.json({
      success: true,
      data: {
        ticket,
        permissions: {
          canEdit: canEditTicket(req.user, ticket),
          canAssign: canAssignTicket(req.user),
          canResolve: canResolveTicket(req.user, ticket),
          canDelete: canDeleteTicket(req.user)
        },
        supportContact: {
          email: 'itsupport.bugemauniv.ac.ug',
          phone: '0784845785'
        }
      }
    });

  } catch (error) {
    logger.error(`Get ticket error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ticket'
    });
  }
};

/**
 * @desc    Update ticket
 * @route   PUT /api/tickets/:id
 * @access  Private
 */
exports.updateTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Check permissions
    if (!canEditTicket(req.user, ticket)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this ticket'
      });
    }

    const oldTicket = { ...ticket.toObject() };
    const updates = req.body;
    const changes = {};

    // Track changes
    Object.keys(updates).forEach(key => {
      if (ticket[key] !== updates[key]) {
        changes[key] = {
          old: ticket[key],
          new: updates[key]
        };
      }
    });

    // Apply updates
    Object.assign(ticket, updates);
    ticket.updatedAt = new Date();

    // Add to history if there are changes
    if (Object.keys(changes).length > 0) {
      ticket.addHistory({
        action: 'UPDATED',
        performedBy: req.user.id,
        changes
      });
    }

    await ticket.save();

    // Send notification if assigned technician changed
    if (changes.assignedTo) {
      // Notify old technician
      if (oldTicket.assignedTo) {
        await createNotification({
          userId: oldTicket.assignedTo,
          title: 'Ticket Unassigned',
          message: `Ticket ${ticket.ticketNumber} has been unassigned from you`,
          type: 'assignment',
          relatedTo: ticket._id
        });
      }

      // Notify new technician
      if (ticket.assignedTo) {
        const newTech = await User.findById(ticket.assignedTo);
        if (newTech && newTech.email) {
          await sendEmail({
            to: newTech.email,
            subject: `Ticket Assigned: ${ticket.ticketNumber}`,
            template: 'ticketAssigned',
            context: {
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              priority: ticket.priority,
              assignedBy: req.user.firstName + ' ' + req.user.lastName,
              contactEmail: 'itsupport.bugemauniv.ac.ug'
            }
          });

          await createNotification({
            userId: ticket.assignedTo,
            title: 'Ticket Assigned',
            message: `Ticket ${ticket.ticketNumber} has been assigned to you`,
            type: 'assignment',
            relatedTo: ticket._id
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        ticket,
        message: 'Ticket updated successfully',
        changes: Object.keys(changes)
      }
    });

    logger.info(`Ticket updated: ${ticket.ticketNumber} by ${req.user.id}`);

  } catch (error) {
    logger.error(`Update ticket error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to update ticket'
    });
  }
};

/**
 * @desc    Delete ticket
 * @route   DELETE /api/tickets/:id
 * @access  Private/Admin only
 */
exports.deleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Log before deletion
    logger.info(`Ticket deleted: ${ticket.ticketNumber} by ${req.user.id}`, {
      ticket: ticket.toObject()
    });

    await ticket.remove();

    res.json({
      success: true,
      data: {
        message: 'Ticket deleted successfully'
      }
    });

  } catch (error) {
    logger.error(`Delete ticket error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to delete ticket'
    });
  }
};

/**
 * @desc    Assign ticket to technician
 * @route   POST /api/tickets/:id/assign
 * @access  Private/Technician, Admin
 */
exports.assignTicket = async (req, res) => {
  try {
    const { technicianId, reason } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Check if technician exists and is available
    const technician = await User.findById(technicianId);
    if (!technician || !['Technician', 'Admin'].includes(technician.role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid technician'
      });
    }

    if (!technician.canAcceptTicket()) {
      return res.status(400).json({
        success: false,
        error: 'Technician is at full capacity'
      });
    }

    const oldTechnician = ticket.assignedTo;

    // Update ticket
    ticket.assignedTo = technicianId;
    ticket.status = 'Assigned';
    ticket.assignedAt = new Date();
    ticket.assignedBy = req.user.id;

    ticket.addHistory({
      action: 'ASSIGNED',
      performedBy: req.user.id,
      changes: {
        assignedTo: {
          old: oldTechnician,
          new: technicianId
        },
        status: {
          old: ticket.status,
          new: 'Assigned'
        }
      },
      notes: reason
    });

    await ticket.save();

    // Send notifications
    const notifications = [];

    // Notify old technician if changed
    if (oldTechnician && oldTechnician.toString() !== technicianId.toString()) {
      notifications.push(
        createNotification({
          userId: oldTechnician,
          title: 'Ticket Unassigned',
          message: `Ticket ${ticket.ticketNumber} has been unassigned from you`,
          type: 'assignment',
          relatedTo: ticket._id
        })
      );
    }

    // Notify new technician
    notifications.push(
      sendEmail({
        to: technician.email,
        subject: `Ticket Assigned: ${ticket.ticketNumber}`,
        template: 'ticketAssigned',
        context: {
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          category: ticket.category,
          priority: ticket.priority,
          assignedBy: req.user.firstName + ' ' + req.user.lastName,
          contactEmail: 'itsupport.bugemauniv.ac.ug'
        }
      })
    );

    notifications.push(
      createNotification({
        userId: technicianId,
        title: 'Ticket Assigned',
        message: `Ticket ${ticket.ticketNumber} has been assigned to you`,
        type: 'assignment',
        relatedTo: ticket._id
      })
    );

    // Notify creator
    const creator = await User.findById(ticket.createdBy);
    if (creator && creator.email) {
      notifications.push(
        sendEmail({
          to: creator.email,
          subject: `Your Ticket Has Been Assigned: ${ticket.ticketNumber}`,
          template: 'ticketAssignedUser',
          context: {
            ticketNumber: ticket.ticketNumber,
            title: ticket.title,
            technician: technician.firstName + ' ' + technician.lastName,
            contactEmail: 'itsupport.bugemauniv.ac.ug',
            contactPhone: '0784845785'
          }
        })
      );
    }

    await Promise.all(notifications);

    res.json({
      success: true,
      data: {
        ticket,
        message: 'Ticket assigned successfully',
        technician: {
          id: technician._id,
          name: technician.firstName + ' ' + technician.lastName,
          email: technician.email
        }
      }
    });

    logger.info(`Ticket assigned: ${ticket.ticketNumber} to ${technicianId} by ${req.user.id}`);

  } catch (error) {
    logger.error(`Assign ticket error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to assign ticket'
    });
  }
};

/**
 * @desc    Add comment to ticket
 * @route   POST /api/tickets/:id/comments
 * @access  Private
 */
exports.addComment = async (req, res) => {
  try {
    const { content, isInternal = false } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Check permissions for internal comments
    if (isInternal && !['Technician', 'Admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Only technicians and admins can add internal comments'
      });
    }

    const comment = {
      user: req.user.id,
      content,
      isInternal
    };

    ticket.comments.push(comment);
    await ticket.save();

    // Populate user info for response
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('comments.user', 'firstName lastName role');

    const newComment = populatedTicket.comments[populatedTicket.comments.length - 1];

    // Send notifications to relevant parties
    const notifications = [];

    // Determine who to notify
    const notifyUsers = new Set();

    // Always notify creator if not the commenter
    if (ticket.createdBy.toString() !== req.user.id) {
      notifyUsers.add(ticket.createdBy.toString());
    }

    // Notify assigned technician if exists and not the commenter
    if (ticket.assignedTo && ticket.assignedTo.toString() !== req.user.id) {
      notifyUsers.add(ticket.assignedTo.toString());
    }

    // For internal comments, notify all technicians/admins involved
    if (isInternal) {
      // Get all technicians/admins who have commented
      const internalCommenters = ticket.comments
        .filter(c => c.isInternal)
        .map(c => c.user.toString());

      internalCommenters.forEach(userId => {
        if (userId !== req.user.id) {
          notifyUsers.add(userId);
        }
      });
    }

    // Create notifications
    for (const userId of notifyUsers) {
      notifications.push(
        createNotification({
          userId,
          title: 'New Comment on Ticket',
          message: `${req.user.firstName} added a comment to ticket ${ticket.ticketNumber}`,
          type: 'comment',
          relatedTo: ticket._id
        })
      );
    }

    // Send email to ticket creator (if not the commenter)
    if (ticket.createdBy.toString() !== req.user.id) {
      const creator = await User.findById(ticket.createdBy);
      if (creator && creator.email) {
        notifications.push(
          sendEmail({
            to: creator.email,
            subject: `New Update on Your Ticket: ${ticket.ticketNumber}`,
            template: 'newComment',
            context: {
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              commenter: req.user.firstName + ' ' + req.user.lastName,
              comment: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
              contactEmail: 'itsupport.bugemauniv.ac.ug'
            }
          })
        );
      }
    }

    await Promise.all(notifications);

    res.json({
      success: true,
      data: {
        comment: newComment,
        message: 'Comment added successfully'
      }
    });

    logger.info(`Comment added to ticket: ${ticket.ticketNumber} by ${req.user.id}`);

  } catch (error) {
    logger.error(`Add comment error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to add comment'
    });
  }
};

/**
 * @desc    Resolve ticket
 * @route   POST /api/tickets/:id/resolve
 * @access  Private/Technician, Admin
 */
exports.resolveTicket = async (req, res) => {
  try {
    const { resolution, satisfaction } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Check if user can resolve this ticket
    if (!canResolveTicket(req.user, ticket)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to resolve this ticket'
      });
    }

    // Update ticket
    ticket.status = 'Resolved';
    ticket.resolution = {
      description: resolution,
      resolvedBy: req.user.id,
      resolvedAt: new Date()
    };

    if (satisfaction) {
      ticket.resolution.satisfaction = satisfaction;
    }

    // Calculate actual resolution time
    const resolutionTime = (new Date() - new Date(ticket.createdAt)) / (1000 * 60); // in minutes
    ticket.resolutionTime = resolutionTime;

    // Check SLA compliance
    if (ticket.sla && ticket.sla.resolutionDeadline) {
      ticket.sla.breached = new Date() > ticket.sla.resolutionDeadline;
    }

    ticket.addHistory({
      action: 'RESOLVED',
      performedBy: req.user.id,
      changes: {
        status: {
          old: ticket.status,
          new: 'Resolved'
        }
      },
      notes: `Resolved: ${resolution.substring(0, 50)}...`
    });

    await ticket.save();

    // Send resolution email to creator
    const creator = await User.findById(ticket.createdBy);
    if (creator && creator.email) {
      await sendEmail({
        to: creator.email,
        subject: `Ticket Resolved: ${ticket.ticketNumber} - ${ticket.title}`,
        template: 'ticketResolved',
        context: {
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          resolution,
          resolvedBy: req.user.firstName + ' ' + req.user.lastName,
          resolvedAt: ticket.resolution.resolvedAt,
          contactEmail: 'itsupport.bugemauniv.ac.ug',
          contactPhone: '0784845785'
        }
      });
    }

    // Update technician statistics
    if (ticket.assignedTo) {
      await User.findByIdAndUpdate(ticket.assignedTo, {
        $inc: {
          'statistics.ticketsResolved': 1
        }
      });
    }

    res.json({
      success: true,
      data: {
        ticket,
        message: 'Ticket resolved successfully',
        resolutionTime: `${Math.floor(resolutionTime / 60)}h ${Math.floor(resolutionTime % 60)}m`
      }
    });

    logger.info(`Ticket resolved: ${ticket.ticketNumber} by ${req.user.id}`);

  } catch (error) {
    logger.error(`Resolve ticket error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve ticket'
    });
  }
};

/**
 * @desc    Get ticket analytics overview
 * @route   GET /api/tickets/analytics/overview
 * @access  Private/Admin, Technician
 */
exports.getAnalyticsOverview = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const filter = {};

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    // Role-based filtering
    if (req.user.role === 'Technician') {
      filter.$or = [
        { assignedTo: req.user.id },
        { createdBy: req.user.id }
      ];
    }

    const [
      totalTickets,
      openTickets,
      resolvedTickets,
      ticketsByCategory,
      ticketsByPriority,
      ticketsByStatus,
      avgResolutionTime,
      topTechnicians
    ] = await Promise.all([
      // Total tickets
      Ticket.countDocuments(filter),

      // Open tickets
      Ticket.countDocuments({ ...filter, status: { $in: ['Open', 'In Progress', 'Assigned'] } }),

      // Resolved tickets
      Ticket.countDocuments({ ...filter, status: 'Resolved' }),

      // Tickets by category
      Ticket.aggregate([
        { $match: filter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Tickets by priority
      Ticket.aggregate([
        { $match: filter },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),

      // Tickets by status
      Ticket.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),

      // Average resolution time (for resolved tickets)
      Ticket.aggregate([
        { $match: { ...filter, status: 'Resolved', resolutionTime: { $exists: true } } },
        { $group: { _id: null, avgTime: { $avg: '$resolutionTime' } } }
      ]),

      // Top technicians (only for admin)
      req.user.role === 'Admin' ? User.aggregate([
        { $match: { role: 'Technician' } },
        { 
          $lookup: {
            from: 'tickets',
            localField: '_id',
            foreignField: 'assignedTo',
            as: 'assignedTickets'
          }
        },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            email: 1,
            totalTickets: { $size: '$assignedTickets' },
            resolvedTickets: {
              $size: {
                $filter: {
                  input: '$assignedTickets',
                  as: 'ticket',
                  cond: { $eq: ['$$ticket.status', 'Resolved'] }
                }
              }
            },
            avgResolutionTime: {
              $avg: {
                $map: {
                  input: {
                    $filter: {
                      input: '$assignedTickets',
                      as: 'ticket',
                      cond: { $eq: ['$$ticket.status', 'Resolved'] }
                    }
                  },
                  as: 'ticket',
                  in: '$$ticket.resolutionTime'
                }
              }
            }
          }
        },
        { $sort: { resolvedTickets: -1 } },
        { $limit: 5 }
      ]) : []
    ]);

    // Calculate SLA compliance
    const slaCompliance = await Ticket.aggregate([
      { 
        $match: { 
          ...filter, 
          status: 'Resolved',
          'sla.resolutionDeadline': { $exists: true }
        } 
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          compliant: {
            $sum: {
              $cond: [
                { $lte: ['$resolution.resolvedAt', '$sla.resolutionDeadline'] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const complianceRate = slaCompliance.length > 0 ? 
      (slaCompliance[0].compliant / slaCompliance[0].total) * 100 : 0;

    const analytics = {
      summary: {
        totalTickets,
        openTickets,
        resolvedTickets,
        resolutionRate: totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0,
        avgResolutionTime: avgResolutionTime[0]?.avgTime || 0
      },
      breakdown: {
        byCategory: ticketsByCategory,
        byPriority: ticketsByPriority,
        byStatus: ticketsByStatus
      },
      performance: {
        slaCompliance: parseFloat(complianceRate.toFixed(2)),
        topTechnicians
      },
      timeframe: {
        fromDate: fromDate || 'All time',
        toDate: toDate || 'Now'
      }
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error(`Get analytics error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
};

// Helper Functions

/**
 * Check if user can view ticket
 */
const canViewTicket = (user, ticket) => {
  // Admins can view all tickets
  if (user.role === 'Admin') return true;
  
  // Technicians can view assigned tickets or tickets in their categories
  if (user.role === 'Technician') {
    if (ticket.assignedTo && ticket.assignedTo.equals(user.id)) return true;
    if (user.supportAreas && user.supportAreas.includes(ticket.category)) return true;
  }
  
  // Users can view their own tickets
  if (ticket.createdBy && ticket.createdBy.equals(user.id)) return true;
  
  return false;
};

/**
 * Check if user can edit ticket
 */
const canEditTicket = (user, ticket) => {
  if (user.role === 'Admin') return true;
  
  if (user.role === 'Technician') {
    if (ticket.assignedTo && ticket.assignedTo.equals(user.id)) return true;
  }
  
  // Users can edit their own tickets if still open
  if (ticket.createdBy && ticket.createdBy.equals(user.id) && 
      ticket.status === 'Open') {
    return true;
  }
  
  return false;
};

/**
 * Check if user can assign tickets
 */
const canAssignTicket = (user) => {
  return ['Technician', 'Admin'].includes(user.role);
};

/**
 * Check if user can resolve ticket
 */
const canResolveTicket = (user, ticket) => {
  if (user.role === 'Admin') return true;
  
  if (user.role === 'Technician') {
    return ticket.assignedTo && ticket.assignedTo.equals(user.id);
  }
  
  return false;
};

/**
 * Check if user can delete ticket
 */
const canDeleteTicket = (user) => {
  return user.role === 'Admin';
};

/**
 * Generate unique ticket number
 */
const generateTicketNumber = async () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Find the last ticket number for today
  const lastTicket = await Ticket.findOne({
    ticketNumber: new RegExp(`^TKT-${dateStr}-`)
  }).sort({ ticketNumber: -1 });
  
  let sequence = 1;
  if (lastTicket && lastTicket.ticketNumber) {
    const lastSeq = parseInt(lastTicket.ticketNumber.split('-')[2]);
    sequence = lastSeq + 1;
  }
  
  return `TKT-${dateStr}-${sequence.toString().padStart(4, '0')}`;
};

// Additional controller methods to be implemented:
exports.escalateTicket = async (req, res) => { /* Implementation */ };
exports.updateStatus = async (req, res) => { /* Implementation */ };
exports.reopenTicket = async (req, res) => { /* Implementation */ };
exports.updateComment = async (req, res) => { /* Implementation */ };
exports.deleteComment = async (req, res) => { /* Implementation */ };
exports.addAttachments = async (req, res) => { /* Implementation */ };
exports.deleteAttachment = async (req, res) => { /* Implementation */ };
exports.advancedSearch = async (req, res) => { /* Implementation */ };
exports.getDepartmentAnalytics = async (req, res) => { /* Implementation */ };
exports.getMyCreatedTickets = async (req, res) => { /* Implementation */ };
exports.getMyAssignedTickets = async (req, res) => { /* Implementation */ };
exports.getTicketByNumber = async (req, res) => { /* Implementation */ };