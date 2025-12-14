// controllers/ticketController.js - ENHANCED VERSION
/**
 * BUGEMA UNIVERSITY IT SUPPORT SYSTEM
 * Complete Ticket Controller - Production Ready v4.0
 * 
 * @description Production-grade ticket management with enhanced features
 * @version 4.0.0
 */
const mongoose = require('mongoose');

const { Ticket, TICKET_PRIORITIES, TICKET_CATEGORIES } = require('../models/Ticket');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const logger = require('../config/logger') || console;

// Notification service with fallback
let notificationService;
try {
  notificationService = require('../services/notificationService');
} catch (error) {
  logger.warn('⚠️ Notification service not available');
  notificationService = {
    createNotification: async () => ({ success: false, message: 'Service unavailable' })
  };
}

// SLA service with fallback
let slaService;
try {
  slaService = require('../services/slaService');
} catch (error) {
  logger.warn('⚠️ SLA service not available, using defaults');
  slaService = {
    calculateDeadlines: (priority) => {
      const priorityData = TICKET_PRIORITIES[priority] || TICKET_PRIORITIES.Medium;
      const now = new Date();
      return {
        responseDeadline: new Date(now.getTime() + priorityData.responseTime * 60 * 1000),
        resolutionDeadline: new Date(now.getTime() + priorityData.resolutionTime * 60 * 1000),
        responseTime: priorityData.responseTime,
        resolutionTime: priorityData.resolutionTime
      };
    }
  };
}

/**
 * @class TicketController
 * @description Production-grade ticket controller with enhanced features
 */
class TicketController {
  
  /**
   * @method createTicket
   * @description Create a new ticket with enhanced validation and auto-assignment
   */
  static async createTicket(req, res) {
    const session = await Ticket.startSession();
    session.startTransaction();
    
    try {
      const userId = req.user.id;
      const {
        title,
        description,
        category,
        priority,
        location,
        department,
        subCategory,
        campus,
        building,
        roomNumber,
        attachments
      } = req.body;
      
      // Enhanced validation
      const validationErrors = [];
      
      if (!title || title.trim().length < 5) {
        validationErrors.push('Title must be at least 5 characters');
      }
      
      if (!description || description.trim().length < 10) {
        validationErrors.push('Description must be at least 10 characters');
      }
      
      if (!category || !Object.keys(TICKET_CATEGORIES).includes(category)) {
        validationErrors.push('Valid category is required');
      }
      
      if (validationErrors.length > 0) {
        await session.abortTransaction();
        session.endSession();
        
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          errors: validationErrors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      // Calculate SLA deadlines
      const slaDeadlines = slaService.calculateDeadlines(priority || 'Medium');
      
      // Create ticket
      const ticketData = {
        title: title.trim(),
        description: description.trim(),
        category: category,
        priority: priority || 'Medium',
        location: location,
        department: department,
        subCategory: subCategory,
        campus: campus || 'BU',
        building: building,
        roomNumber: roomNumber,
        createdBy: userId,
        sla: {
          responseDeadline: slaDeadlines.responseDeadline,
          resolutionDeadline: slaDeadlines.resolutionDeadline
        }
      };
      
      if (attachments && Array.isArray(attachments)) {
        ticketData.attachments = attachments.map(att => ({
          ...att,
          uploadedBy: userId
        }));
      }
      
      const ticket = new Ticket(ticketData);
      
      // Auto-assign based on category
      if (category) {
        const availableTech = await User.findOne({
          role: 'Technician',
          supportAreas: category,
          availabilityStatus: 'Available',
          $or: [
            { maxTickets: { $gt: '$currentTickets' } },
            { maxTickets: { $exists: false } }
          ]
        }).session(session);
        
        if (availableTech) {
          ticket.assignedTo = availableTech._id;
          ticket.assignedBy = userId;
          ticket.assignedAt = new Date();
          ticket.status = 'Assigned';
          
          // Update technician's current ticket count
          await User.findByIdAndUpdate(
            availableTech._id,
            { $inc: { currentTickets: 1 } },
            { session }
          );
        }
      }
      
      await ticket.save({ session });
      
      // Add to history
      ticket.history.push({
        action: 'CREATED',
        performedBy: userId,
        changes: { status: 'Open' }
      });
      
      await ticket.save({ session });
      
      // Send notifications
      const notifications = [];
      
      // Notify creator
      const creator = await User.findById(userId).session(session);
      if (creator && creator.email) {
        notifications.push(
          sendEmail({
            to: creator.email,
            subject: `Ticket Created: ${ticket.ticketNumber} - ${ticket.title}`,
            template: 'ticketCreated',
            context: {
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              category: ticket.category,
              priority: ticket.priority,
              createdAt: ticket.createdAt,
              contactEmail: 'itsupport@bugemauniv.ac.ug',
              contactPhone: '0784845785',
              estimatedResponse: `Within ${TICKET_PRIORITIES[ticket.priority].responseTime} minutes`
            }
          })
        );
      }
      
      // Notify assigned technician
      if (ticket.assignedTo) {
        const technician = await User.findById(ticket.assignedTo).session(session);
        if (technician && technician.email) {
          notifications.push(
            sendEmail({
              to: technician.email,
              subject: `New Ticket Assigned: ${ticket.ticketNumber}`,
              template: 'ticketAssigned',
              context: {
                ticketNumber: ticket.ticketNumber,
                title: ticket.title,
                category: ticket.category,
                priority: ticket.priority,
                createdBy: creator ? `${creator.firstName} ${creator.lastName}` : 'User',
                contactEmail: 'itsupport@bugemauniv.ac.ug'
              }
            })
          );
          
          notifications.push(
            notificationService.createNotification({
              userId: technician._id,
              title: 'New Ticket Assigned',
              message: `Ticket ${ticket.ticketNumber} has been assigned to you`,
              type: 'assignment',
              relatedTo: ticket._id,
              priority: 'high'
            })
          );
        }
      }
      
      // Notify department head if exists
      if (department) {
        const departmentHead = await User.findOne({
          role: 'Admin',
          department: department,
          notificationPreferences: { $in: ['department_tickets'] }
        }).session(session);
        
        if (departmentHead && departmentHead.email) {
          notifications.push(
            sendEmail({
              to: departmentHead.email,
              subject: `New Ticket in Your Department: ${ticket.ticketNumber}`,
              template: 'departmentTicket',
              context: {
                ticketNumber: ticket.ticketNumber,
                title: ticket.title,
                department: department,
                priority: ticket.priority,
                contactEmail: 'itsupport@bugemauniv.ac.ug'
              }
            })
          );
        }
      }
      
      // Execute all notifications in parallel
      await Promise.allSettled(notifications);
      
      // Commit transaction
      await session.commitTransaction();
      session.endSession();
      
      logger.info(`Ticket created: ${ticket.ticketNumber} by ${userId}`, {
        ticketId: ticket._id,
        category: ticket.category,
        priority: ticket.priority,
        assignedTo: ticket.assignedTo
      });
      
      res.status(201).json({
        success: true,
        data: {
          ticket: await ticket.populate(['createdBy', 'assignedTo']),
          message: 'Ticket created successfully',
          metadata: {
            ticketNumber: ticket.ticketNumber,
            estimatedResponse: `Within ${TICKET_PRIORITIES[ticket.priority].responseTime} minutes`,
            nextSteps: [
              'Your ticket has been logged and assigned a unique number',
              'You will receive email updates on progress',
              'Check your dashboard for status updates',
              'Contact support at itsupport@bugemauniv.ac.ug for urgent issues'
            ],
            sla: {
              responseDeadline: ticket.sla.responseDeadline,
              resolutionDeadline: ticket.sla.resolutionDeadline
            }
          },
          supportContact: {
            email: 'itsupport@bugemauniv.ac.ug',
            phone: '0784845785',
            hours: 'Mon-Fri: 8:00 AM - 5:00 PM'
          }
        }
      });
      
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      logger.error(`Ticket creation error: ${error.message}`, {
        userId: req.user?.id,
        error: error.stack
      });
      
      // Handle specific error cases
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }));
        
        return res.status(400).json({
          success: false,
          error: 'Ticket validation failed',
          errors,
          code: 'VALIDATION_ERROR'
        });
      }
      
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          error: 'Ticket number conflict. Please try again.',
          code: 'DUPLICATE_TICKET'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to create ticket. Please try again.',
        code: 'SERVER_ERROR',
        reference: `TICKET-ERR-${Date.now()}`,
        supportContact: {
          email: 'itsupport@bugemauniv.ac.ug',
          phone: '0784845785'
        }
      });
    }
  }
  
  /**
   * @method getAllTickets
   * @description Get tickets with advanced filtering, pagination, and analytics
   */
  static async getAllTickets(req, res) {
    try {
      const {
        status,
        priority,
        category,
        department,
        assignedTo,
        createdBy,
        campus,
        fromDate,
        toDate,
        search,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        includeAnalytics = false
      } = req.query;
      
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Build base query with role-based permissions
      const baseQuery = this.buildRoleBasedQuery(userId, userRole);
      const query = { ...baseQuery };
      
      // Apply advanced filters
      this.applyAdvancedFilters(query, req.query);
      
      // Text search
      if (search && search.trim()) {
        query.$or = [
          { ticketNumber: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { 'comments.content': { $regex: search, $options: 'i' } }
        ];
      }
      
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await Ticket.countDocuments(query);
      const totalPages = Math.ceil(total / parseInt(limit));
      
      // Build sort
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
      
      // Fetch tickets with advanced population
      const tickets = await Ticket.find(query)
        .populate('createdBy', 'firstName lastName email role department avatar')
        .populate('assignedTo', 'firstName lastName email role supportAreas availabilityStatus')
        .populate('comments.user', 'firstName lastName role avatar')
        .populate('attachments.uploadedBy', 'firstName lastName')
        .populate('history.performedBy', 'firstName lastName role')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
      
      // Enhance tickets with virtual fields
      const enhancedTickets = tickets.map(ticket => ({
        ...ticket,
        isOverdue: this.isTicketOverdue(ticket),
        slaStatus: this.calculateSLAStatus(ticket),
        ageInHours: Math.floor((new Date() - new Date(ticket.createdAt)) / (1000 * 60 * 60)),
        urgencyScore: this.calculateUrgencyScore(ticket)
      }));
      
      // Get analytics if requested
      let analytics = null;
      if (includeAnalytics === 'true') {
        analytics = await this.getQueryAnalytics(query);
      }
      
      // Calculate response metadata
      const responseMetadata = {
        queryTime: new Date().toISOString(),
        filtersApplied: Object.keys(req.query).filter(key => 
          !['page', 'limit', 'sortBy', 'sortOrder', 'includeAnalytics'].includes(key)
        ),
        availableFilters: {
          status: ['Open', 'Assigned', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Escalated'],
          priority: Object.keys(TICKET_PRIORITIES),
          category: Object.keys(TICKET_CATEGORIES),
          campuses: ['BU', 'MA', 'KA', 'AR', 'MB', 'OTHER']
        }
      };
      
      res.json({
        success: true,
        data: {
          tickets: enhancedTickets,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages,
            hasNextPage: parseInt(page) < totalPages,
            hasPrevPage: parseInt(page) > 1
          },
          analytics,
          metadata: responseMetadata
        }
      });
      
    } catch (error) {
      logger.error(`Get all tickets error: ${error.message}`, {
        userId: req.user?.id,
        query: req.query
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch tickets',
        code: 'SERVER_ERROR'
      });
    }
  }
  
  /**
   * @method getTicket
   * @description Get single ticket with full details and permissions
   */
  static async getTicket(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Find by ticketNumber or ID
      const query = mongoose.Types.ObjectId.isValid(id) 
        ? { _id: id }
        : { $or: [{ ticketNumber: id }, { ticketId: id }] };
      
      const ticket = await Ticket.findOne(query)
        .populate('createdBy', 'firstName lastName email role department phone campus')
        .populate('assignedTo', 'firstName lastName email role supportAreas phone availabilityStatus')
        .populate('comments.user', 'firstName lastName role avatar')
        .populate('attachments.uploadedBy', 'firstName lastName')
        .populate('history.performedBy', 'firstName lastName role')
        .populate('relatedTickets', 'ticketNumber title status priority')
        .populate('escalatedTo', 'firstName lastName email role')
        .lean();
      
      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found',
          code: 'TICKET_NOT_FOUND'
        });
      }
      
      // Check permissions
      const canView = this.checkViewPermission(userId, userRole, ticket);
      if (!canView) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to view this ticket',
          code: 'PERMISSION_DENIED'
        });
      }
      
      // Increment view count
      await Ticket.findByIdAndUpdate(ticket._id, {
        $inc: { viewCount: 1 },
        $push: {
          viewedBy: {
            user: userId,
            viewedAt: new Date()
          }
        }
      });
      
      // Enhance ticket with additional data
      const enhancedTicket = {
        ...ticket,
        sla: {
          ...ticket.sla,
          status: this.calculateSLAStatus(ticket),
          timeRemaining: this.calculateSLATimeRemaining(ticket),
          isBreached: this.isSLABreached(ticket)
        },
        analytics: {
          viewCount: ticket.viewCount,
          commentCount: ticket.comments?.length || 0,
          attachmentCount: ticket.attachments?.length || 0,
          ageInDays: Math.floor((new Date() - new Date(ticket.createdAt)) / (1000 * 60 * 60 * 24))
        },
        permissions: {
          canEdit: this.checkEditPermission(userId, userRole, ticket),
          canAssign: this.checkAssignPermission(userRole),
          canResolve: this.checkResolvePermission(userId, userRole, ticket),
          canComment: true,
          canEscalate: this.checkEscalatePermission(userRole),
          canAttach: true
        }
      };
      
      // Get suggested related tickets
      const relatedTickets = await this.findRelatedTickets(ticket);
      
      res.json({
        success: true,
        data: {
          ticket: enhancedTicket,
          relatedTickets,
          supportContact: {
            email: 'itsupport@bugemauniv.ac.ug',
            phone: '0784845785',
            escalationEmail: 'escalation@bugemauniv.ac.ug'
          }
        }
      });
      
    } catch (error) {
      logger.error(`Get ticket error: ${error.message}`, {
        ticketId: req.params.id,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch ticket details',
        code: 'SERVER_ERROR'
      });
    }
  }
  
  /**
   * @method updateTicket
   * @description Update ticket with comprehensive change tracking
   */
  static async updateTicket(req, res) {
    const session = await Ticket.startSession();
    session.startTransaction();
    
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      const updates = req.body;
      const changeReason = req.body.changeReason || 'Updated via API';
      
      // Find ticket
      const ticket = await Ticket.findById(id).session(session);
      
      if (!ticket) {
        await session.abortTransaction();
        session.endSession();
        
        return res.status(404).json({
          success: false,
          error: 'Ticket not found',
          code: 'TICKET_NOT_FOUND'
        });
      }
      
      // Check permissions
      if (!this.checkEditPermission(userId, userRole, ticket)) {
        await session.abortTransaction();
        session.endSession();
        
        return res.status(403).json({
          success: false,
          error: 'Not authorized to update this ticket',
          code: 'PERMISSION_DENIED'
        });
      }
      
      // Track old values for history
      const oldTicket = ticket.toObject();
      const changes = {};
      
      // Apply updates with validation
      const allowedUpdates = [
        'title', 'description', 'category', 'subCategory', 'priority',
        'status', 'location', 'building', 'roomNumber', 'department',
        'assignedTo', 'dueDate', 'tags', 'escalationLevel', 'campus'
      ];
      
      // Validate and apply updates
      for (const field of allowedUpdates) {
        if (updates[field] !== undefined && updates[field] !== ticket[field]) {
          // Validate specific fields
          if (field === 'priority' && !Object.keys(TICKET_PRIORITIES).includes(updates[field])) {
            throw new Error(`Invalid priority: ${updates[field]}`);
          }
          
          if (field === 'category' && !Object.keys(TICKET_CATEGORIES).includes(updates[field])) {
            throw new Error(`Invalid category: ${updates[field]}`);
          }
          
          if (field === 'status' && !['Open', 'Assigned', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Escalated'].includes(updates[field])) {
            throw new Error(`Invalid status: ${updates[field]}`);
          }
          
          // Track changes
          changes[field] = {
            old: ticket[field],
            new: updates[field]
          };
          
          // Apply update
          ticket[field] = updates[field];
        }
      }
      
      // Special handling for assignment
      if (updates.assignedTo && updates.assignedTo !== oldTicket.assignedTo?.toString()) {
        await this.handleAssignmentChange(ticket, oldTicket.assignedTo, updates.assignedTo, userId, session);
      }
      
      // Special handling for status changes
      if (updates.status && updates.status !== oldTicket.status) {
        await this.handleStatusChange(ticket, oldTicket.status, updates.status, userId, session);
      }
      
      // Special handling for escalation
      if (updates.escalationLevel && updates.escalationLevel > oldTicket.escalationLevel) {
        await this.handleEscalation(ticket, updates.escalationLevel, userId, session);
      }
      
      // Add to history if changes were made
      if (Object.keys(changes).length > 0) {
        ticket.history.push({
          action: 'UPDATED',
          performedBy: userId,
          changes,
          notes: changeReason,
          timestamp: new Date()
        });
      }
      
      ticket.updatedAt = new Date();
      await ticket.save({ session });
      
      // Send notifications for significant changes
      await this.sendUpdateNotifications(ticket, oldTicket, userId, changes, session);
      
      // Commit transaction
      await session.commitTransaction();
      session.endSession();
      
      // Populate for response
      await ticket.populate(['createdBy', 'assignedTo', 'comments.user']);
      
      logger.info(`Ticket updated: ${ticket.ticketNumber} by ${userId}`, {
        ticketId: ticket._id,
        changes: Object.keys(changes),
        userRole: userRole
      });
      
      res.json({
        success: true,
        data: {
          ticket,
          message: 'Ticket updated successfully',
          changes: Object.keys(changes),
          metadata: {
            updatedAt: ticket.updatedAt,
            historyEntryId: ticket.history[ticket.history.length - 1]?._id
          }
        }
      });
      
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      logger.error(`Update ticket error: ${error.message}`, {
        ticketId: req.params.id,
        userId: req.user?.id,
        error: error.stack
      });
      
      if (error.message.includes('Invalid')) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'VALIDATION_ERROR'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to update ticket',
        code: 'SERVER_ERROR'
      });
    }
  }
  
  /**
   * @method addComment
   * @description Add comment with enhanced features
   */
  static async addComment(req, res) {
    const session = await Ticket.startSession();
    session.startTransaction();
    
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      const { content, isInternal = false, attachments = [] } = req.body;
      
      // Validate content
      if (!content || content.trim().length === 0) {
        await session.abortTransaction();
        session.endSession();
        
        return res.status(400).json({
          success: false,
          error: 'Comment content is required',
          code: 'VALIDATION_ERROR'
        });
      }
      
      if (content.length > 2000) {
        await session.abortTransaction();
        session.endSession();
        
        return res.status(400).json({
          success: false,
          error: 'Comment cannot exceed 2000 characters',
          code: 'VALIDATION_ERROR'
        });
      }
      
      // Find ticket
      const ticket = await Ticket.findById(id).session(session);
      
      if (!ticket) {
        await session.abortTransaction();
        session.endSession();
        
        return res.status(404).json({
          success: false,
          error: 'Ticket not found',
          code: 'TICKET_NOT_FOUND'
        });
      }
      
      // Check permissions for internal comments
      if (isInternal && !['Technician', 'Admin'].includes(userRole)) {
        await session.abortTransaction();
        session.endSession();
        
        return res.status(403).json({
          success: false,
          error: 'Only technicians and admins can add internal comments',
          code: 'PERMISSION_DENIED'
        });
      }
      
      // Add comment
      const comment = {
        user: userId,
        content: content.trim(),
        isInternal,
        attachments: attachments.map(att => ({
          ...att,
          uploadedBy: userId
        })),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      ticket.comments.push(comment);
      
      // Update first response time if this is the first staff comment
      if (!isInternal && !ticket.firstResponseAt && ['Technician', 'Admin'].includes(userRole)) {
        ticket.firstResponseAt = new Date();
      }
      
      // Add to history
      ticket.history.push({
        action: 'COMMENTED',
        performedBy: userId,
        changes: {
          commentAdded: true
        },
        notes: `Comment added: ${content.substring(0, 50)}...`
      });
      
      await ticket.save({ session });
      
      // Send notifications
      await this.sendCommentNotifications(ticket, comment, userId, userRole, session);
      
      // Commit transaction
      await session.commitTransaction();
      session.endSession();
      
      // Get populated comment for response
      const populatedTicket = await Ticket.findById(ticket._id)
        .populate('comments.user', 'firstName lastName role avatar');
      
      const newComment = populatedTicket.comments[populatedTicket.comments.length - 1];
      
      logger.info(`Comment added to ticket: ${ticket.ticketNumber} by ${userId}`, {
        ticketId: ticket._id,
        isInternal,
        commentLength: content.length
      });
      
      res.status(201).json({
        success: true,
        data: {
          comment: newComment,
          message: 'Comment added successfully',
          metadata: {
            commentId: newComment._id,
            isInternal,
            createdAt: newComment.createdAt
          }
        }
      });
      
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      logger.error(`Add comment error: ${error.message}`, {
        ticketId: req.params.id,
        userId: req.user?.id,
        error: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to add comment',
        code: 'SERVER_ERROR'
      });
    }
  }
  
  /**
   * @method getDashboardStats
   * @description Get comprehensive dashboard statistics
   */
  static async getDashboardStats(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Get base query
      const baseQuery = this.buildRoleBasedQuery(userId, userRole);
      
      // Get various statistics
      const [
        totalTickets,
        openTickets,
        assignedTickets,
        highPriorityTickets,
        overdueTickets,
        categoryStats,
        priorityStats,
        responseTimeStats,
        technicianStats
      ] = await Promise.all([
        // Total tickets
        Ticket.countDocuments(baseQuery),
        
        // Open tickets
        Ticket.countDocuments({ ...baseQuery, status: 'Open' }),
        
        // Assigned tickets (for technicians/admins)
        Ticket.countDocuments({ ...baseQuery, assignedTo: userId }),
        
        // High priority tickets
        Ticket.countDocuments({ ...baseQuery, priority: { $in: ['High', 'Critical'] } }),
        
        // Overdue tickets
        Ticket.countDocuments({
          ...baseQuery,
          dueDate: { $lt: new Date() },
          status: { $nin: ['Resolved', 'Closed'] }
        }),
        
        // Category statistics
        Ticket.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        
        // Priority statistics
        Ticket.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$priority', count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]),
        
        // Response time statistics
        Ticket.aggregate([
          { 
            $match: { 
              ...baseQuery, 
              firstResponseAt: { $exists: true } 
            } 
          },
          {
            $project: {
              responseTime: {
                $divide: [
                  { $subtract: ['$firstResponseAt', '$createdAt'] },
                  1000 * 60 // minutes
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              avgResponseTime: { $avg: '$responseTime' },
              minResponseTime: { $min: '$responseTime' },
              maxResponseTime: { $max: '$responseTime' }
            }
          }
        ]),
        
        // Technician statistics (admin only)
        userRole === 'Admin' ? User.aggregate([
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
              _id: 1,
              firstName: 1,
              lastName: 1,
              email: 1,
              availabilityStatus: 1,
              totalAssigned: { $size: '$assignedTickets' },
              openTickets: {
                $size: {
                  $filter: {
                    input: '$assignedTickets',
                    as: 'ticket',
                    cond: { $ne: ['$$ticket.status', 'Resolved'] }
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
          { $sort: { totalAssigned: -1 } },
          { $limit: 5 }
        ]) : []
      ]);
      
      // Get recent activity
      const recentActivity = await Ticket.find(baseQuery)
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate('createdBy', 'firstName lastName')
        .populate('assignedTo', 'firstName lastName')
        .select('ticketNumber title status priority updatedAt')
        .lean();
      
      // Calculate SLA compliance
      const slaCompliance = await Ticket.aggregate([
        { 
          $match: { 
            ...baseQuery,
            status: 'Resolved',
            'sla.resolutionDeadline': { $exists: true }
          } 
        },
        {
          $group: {
            _id: null,
            totalResolved: { $sum: 1 },
            slaCompliant: {
              $sum: {
                $cond: [
                  { $lte: ['$resolvedAt', '$sla.resolutionDeadline'] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);
      
      const complianceRate = slaCompliance.length > 0 && slaCompliance[0].totalResolved > 0
        ? (slaCompliance[0].slaCompliant / slaCompliance[0].totalResolved) * 100
        : 0;
      
      // Build response
      const stats = {
        overview: {
          totalTickets,
          openTickets,
          assignedTickets,
          highPriorityTickets,
          overdueTickets,
          resolutionRate: totalTickets > 0 
            ? ((totalTickets - openTickets) / totalTickets) * 100 
            : 0,
          avgResponseTime: responseTimeStats[0]?.avgResponseTime || 0
        },
        breakdown: {
          byCategory: categoryStats,
          byPriority: priorityStats
        },
        performance: {
          slaCompliance: parseFloat(complianceRate.toFixed(2)),
          avgResolutionTime: responseTimeStats[0]?.avgResponseTime || 0,
          topTechnicians: technicianStats
        },
        recentActivity,
        timeframe: {
          generatedAt: new Date().toISOString(),
          period: 'All time'
        }
      };
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      logger.error(`Get dashboard stats error: ${error.message}`, {
        userId: req.user?.id,
        error: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard statistics',
        code: 'SERVER_ERROR'
      });
    }
  }
  
  // ============================================
  // HELPER METHODS
  // ============================================
  
  /**
   * Build role-based query
   */
  static buildRoleBasedQuery(userId, userRole) {
    const query = {};
    
    switch (userRole) {
      case 'Student':
      case 'Staff':
        query.createdBy = userId;
        break;
        
      case 'Technician':
        query.$or = [
          { assignedTo: userId },
          { assignedTo: null, category: { $in: ['Network', 'Software'] } }, // Example: Technician's support areas
          { escalatedTo: userId }
        ];
        break;
        
      case 'Admin':
        // Admins can see all tickets
        break;
        
      default:
        query.createdBy = userId;
    }
    
    return query;
  }
  
  /**
   * Apply advanced filters to query
   */
  static applyAdvancedFilters(query, filters) {
    const filterMap = {
      status: 'status',
      priority: 'priority',
      category: 'category',
      department: 'department',
      assignedTo: 'assignedTo',
      createdBy: 'createdBy',
      campus: 'campus'
    };
    
    Object.entries(filterMap).forEach(([key, field]) => {
      if (filters[key]) {
        if (Array.isArray(filters[key])) {
          query[field] = { $in: filters[key] };
        } else {
          query[field] = filters[key];
        }
      }
    });
    
    // Date range filter
    if (filters.fromDate || filters.toDate) {
      query.createdAt = {};
      if (filters.fromDate) query.createdAt.$gte = new Date(filters.fromDate);
      if (filters.toDate) query.createdAt.$lte = new Date(filters.toDate);
    }
    
    // Overdue filter
    if (filters.overdue === 'true') {
      query.dueDate = { $lt: new Date() };
      query.status = { $nin: ['Resolved', 'Closed'] };
    }
  }
  
  /**
   * Check view permission
   */
  static checkViewPermission(userId, userRole, ticket) {
    if (userRole === 'Admin') return true;
    
    if (userRole === 'Technician') {
      if (ticket.assignedTo && ticket.assignedTo.toString() === userId.toString()) return true;
      if (ticket.escalatedTo && ticket.escalatedTo.toString() === userId.toString()) return true;
    }
    
    if (ticket.createdBy && ticket.createdBy.toString() === userId.toString()) return true;
    
    return false;
  }
  
  /**
   * Check edit permission
   */
  static checkEditPermission(userId, userRole, ticket) {
    if (userRole === 'Admin') return true;
    
    if (userRole === 'Technician') {
      if (ticket.assignedTo && ticket.assignedTo.toString() === userId.toString()) return true;
    }
    
    if (ticket.createdBy && ticket.createdBy.toString() === userId.toString() && 
        ticket.status === 'Open') {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check assign permission
   */
  static checkAssignPermission(userRole) {
    return ['Technician', 'Admin'].includes(userRole);
  }
  
  /**
   * Check resolve permission
   */
  static checkResolvePermission(userId, userRole, ticket) {
    if (userRole === 'Admin') return true;
    
    if (userRole === 'Technician') {
      return ticket.assignedTo && ticket.assignedTo.toString() === userId.toString();
    }
    
    return false;
  }
  
  /**
   * Check escalate permission
   */
  static checkEscalatePermission(userRole) {
    return ['Technician', 'Admin'].includes(userRole);
  }
  
  /**
   * Calculate SLA status
   */
  static calculateSLAStatus(ticket) {
    if (ticket.status === 'Closed' || ticket.status === 'Resolved') return 'completed';
    if (!ticket.sla?.resolutionDeadline) return 'no-sla';
    
    const now = new Date();
    const timeRemaining = ticket.sla.resolutionDeadline - now;
    
    if (timeRemaining < 0) return 'breached';
    if (timeRemaining < 60 * 60 * 1000) return 'critical';
    if (timeRemaining < 4 * 60 * 60 * 1000) return 'warning';
    return 'normal';
  }
  
  /**
   * Calculate SLA time remaining
   */
  static calculateSLATimeRemaining(ticket) {
    if (!ticket.sla?.resolutionDeadline) return null;
    
    const now = new Date();
    const timeRemaining = ticket.sla.resolutionDeadline - now;
    
    return Math.max(0, Math.floor(timeRemaining / (1000 * 60))); // minutes
  }
  
  /**
   * Check if SLA is breached
   */
  static isSLABreached(ticket) {
    if (ticket.status === 'Closed' || ticket.status === 'Resolved') return false;
    if (!ticket.sla?.resolutionDeadline) return false;
    
    return new Date() > ticket.sla.resolutionDeadline;
  }
  
  /**
   * Check if ticket is overdue
   */
  static isTicketOverdue(ticket) {
    if (!ticket.dueDate) return false;
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') return false;
    
    return new Date() > new Date(ticket.dueDate);
  }
  
  /**
   * Calculate urgency score (1-10)
   */
  static calculateUrgencyScore(ticket) {
    let score = 0;
    
    // Priority weight
    const priorityWeights = {
      Critical: 4,
      High: 3,
      Medium: 2,
      Low: 1
    };
    score += priorityWeights[ticket.priority] || 0;
    
    // Age weight (older tickets get higher score)
    const ageInDays = Math.floor((new Date() - new Date(ticket.createdAt)) / (1000 * 60 * 60 * 24));
    if (ageInDays > 7) score += 3;
    else if (ageInDays > 3) score += 2;
    else if (ageInDays > 1) score += 1;
    
    // Overdue weight
    if (this.isTicketOverdue(ticket)) score += 2;
    
    // SLA breach weight
    if (this.isSLABreached(ticket)) score += 3;
    
    // Cap at 10
    return Math.min(score, 10);
  }
  
  /**
   * Handle assignment change
   */
  static async handleAssignmentChange(ticket, oldAssigneeId, newAssigneeId, changedBy, session) {
    // Update old technician's ticket count
    if (oldAssigneeId) {
      await User.findByIdAndUpdate(
        oldAssigneeId,
        { $inc: { currentTickets: -1 } },
        { session }
      );
    }
    
    // Update new technician's ticket count
    if (newAssigneeId) {
      await User.findByIdAndUpdate(
        newAssigneeId,
        { $inc: { currentTickets: 1 } },
        { session }
      );
    }
    
    ticket.assignedBy = changedBy;
    ticket.assignedAt = new Date();
  }
  
  /**
   * Handle status change
   */
  static async handleStatusChange(ticket, oldStatus, newStatus, changedBy, session) {
    // If resolving ticket
    if (newStatus === 'Resolved') {
      ticket.resolvedAt = new Date();
      
      // Calculate resolution time
      if (ticket.createdAt) {
        const resolutionTimeMs = new Date() - ticket.createdAt;
        ticket.resolutionTime = Math.floor(resolutionTimeMs / (1000 * 60)); // minutes
      }
      
      // Check SLA compliance
      if (ticket.sla?.resolutionDeadline) {
        ticket.sla.breached = ticket.resolvedAt > ticket.sla.resolutionDeadline;
      }
    }
    
    // If closing ticket
    if (newStatus === 'Closed') {
      ticket.closedAt = new Date();
    }
  }
  
  /**
   * Handle escalation
   */
  static async handleEscalation(ticket, newLevel, escalatedBy, session) {
    ticket.isEscalated = true;
    ticket.escalationLevel = newLevel;
    ticket.escalatedAt = new Date();
    
    // Find appropriate technician/admin for escalation
    const escalationTarget = await User.findOne({
      role: newLevel >= 3 ? 'Admin' : 'Technician',
      availabilityStatus: 'Available',
      canHandleEscalations: true
    }).session(session);
    
    if (escalationTarget) {
      ticket.escalatedTo = escalationTarget._id;
    }
  }
  
  /**
   * Send update notifications
   */
  static async sendUpdateNotifications(ticket, oldTicket, changedBy, changes, session) {
    const notifications = [];
    
    // Notify creator if important fields changed
    const importantFields = ['status', 'priority', 'assignedTo'];
    const hasImportantChange = importantFields.some(field => changes[field]);
    
    if (hasImportantChange && ticket.createdBy.toString() !== changedBy.toString()) {
      const creator = await User.findById(ticket.createdBy).session(session);
      if (creator && creator.email) {
        notifications.push(
          sendEmail({
            to: creator.email,
            subject: `Ticket Updated: ${ticket.ticketNumber}`,
            template: 'ticketUpdated',
            context: {
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              changes: Object.keys(changes),
              updatedBy: req.user ? `${req.user.firstName} ${req.user.lastName}` : 'System',
              contactEmail: 'itsupport@bugemauniv.ac.ug'
            }
          })
        );
      }
    }
    
    // Notify old technician if unassigned
    if (changes.assignedTo && oldTicket.assignedTo && 
        oldTicket.assignedTo.toString() !== changes.assignedTo.new.toString()) {
      const oldTech = await User.findById(oldTicket.assignedTo).session(session);
      if (oldTech && oldTech.email) {
        notifications.push(
          sendEmail({
            to: oldTech.email,
            subject: `Ticket Unassigned: ${ticket.ticketNumber}`,
            template: 'ticketUnassigned',
            context: {
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              unassignedBy: req.user ? `${req.user.firstName} ${req.user.lastName}` : 'System',
              contactEmail: 'itsupport@bugemauniv.ac.ug'
            }
          })
        );
        
        notifications.push(
          notificationService.createNotification({
            userId: oldTicket.assignedTo,
            title: 'Ticket Unassigned',
            message: `Ticket ${ticket.ticketNumber} has been unassigned from you`,
            type: 'assignment',
            relatedTo: ticket._id
          })
        );
      }
    }
    
    // Notify new technician if assigned
    if (changes.assignedTo && ticket.assignedTo && 
        (!oldTicket.assignedTo || oldTicket.assignedTo.toString() !== ticket.assignedTo.toString())) {
      const newTech = await User.findById(ticket.assignedTo).session(session);
      if (newTech && newTech.email) {
        notifications.push(
          sendEmail({
            to: newTech.email,
            subject: `New Ticket Assigned: ${ticket.ticketNumber}`,
            template: 'ticketAssigned',
            context: {
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              category: ticket.category,
              priority: ticket.priority,
              assignedBy: req.user ? `${req.user.firstName} ${req.user.lastName}` : 'System',
              contactEmail: 'itsupport@bugemauniv.ac.ug'
            }
          })
        );
        
        notifications.push(
          notificationService.createNotification({
            userId: ticket.assignedTo,
            title: 'Ticket Assigned',
            message: `Ticket ${ticket.ticketNumber} has been assigned to you`,
            type: 'assignment',
            relatedTo: ticket._id,
            priority: 'high'
          })
        );
      }
    }
    
    // Execute notifications
    await Promise.allSettled(notifications);
  }
  
  /**
   * Send comment notifications
   */
  static async sendCommentNotifications(ticket, comment, commenterId, commenterRole, session) {
    const notifications = [];
    
    // Determine who to notify
    const notifyUsers = new Set();
    
    // Always notify creator if not the commenter
    if (ticket.createdBy.toString() !== commenterId.toString()) {
      notifyUsers.add(ticket.createdBy.toString());
    }
    
    // Notify assigned technician if exists and not the commenter
    if (ticket.assignedTo && ticket.assignedTo.toString() !== commenterId.toString()) {
      notifyUsers.add(ticket.assignedTo.toString());
    }
    
    // For internal comments, notify all technicians/admins
    if (comment.isInternal) {
      const staffMembers = await User.find({
        role: { $in: ['Technician', 'Admin'] },
        _id: { $ne: commenterId }
      }).session(session);
      
      staffMembers.forEach(user => notifyUsers.add(user._id.toString()));
    }
    
    // Send notifications
    for (const userId of notifyUsers) {
      const user = await User.findById(userId).session(session);
      if (!user) continue;
      
      // Email notification for important comments
      if (user.emailPreferences?.comments && user.email) {
        notifications.push(
          sendEmail({
            to: user.email,
            subject: `New Comment on Ticket: ${ticket.ticketNumber}`,
            template: 'newComment',
            context: {
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              commenter: req.user ? `${req.user.firstName} ${req.user.lastName}` : 'User',
              comment: comment.content.substring(0, 100) + (comment.content.length > 100 ? '...' : ''),
              isInternal: comment.isInternal,
              contactEmail: 'itsupport@bugemauniv.ac.ug'
            }
          })
        );
      }
      
      // In-app notification
      notifications.push(
        notificationService.createNotification({
          userId: user._id,
          title: 'New Comment on Ticket',
          message: `${req.user ? `${req.user.firstName} ${req.user.lastName}` : 'User'} added a comment to ticket ${ticket.ticketNumber}`,
          type: 'comment',
          relatedTo: ticket._id,
          priority: comment.isInternal ? 'high' : 'normal'
        })
      );
    }
    
    // Execute notifications
    await Promise.allSettled(notifications);
  }
  
  /**
   * Get query analytics
   */
  static async getQueryAnalytics(query) {
    const analytics = await Ticket.aggregate([
      { $match: query },
      {
        $facet: {
          statusSummary: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          prioritySummary: [
            { $group: { _id: '$priority', count: { $sum: 1 } } }
          ],
          categorySummary: [
            { $group: { _id: '$category', count: { $sum: 1 } } }
          ],
          responseMetrics: [
            {
              $match: { firstResponseAt: { $exists: true } }
            },
            {
              $group: {
                _id: null,
                avgResponseTime: { $avg: { $subtract: ['$firstResponseAt', '$createdAt'] } },
                count: { $sum: 1 }
              }
            }
          ],
          ageDistribution: [
            {
              $project: {
                ageInDays: {
                  $floor: {
                    $divide: [
                      { $subtract: [new Date(), '$createdAt'] },
                      1000 * 60 * 60 * 24
                    ]
                  }
                }
              }
            },
            {
              $bucket: {
                groupBy: '$ageInDays',
                boundaries: [0, 1, 3, 7, 14, 30],
                default: '30+',
                output: {
                  count: { $sum: 1 }
                }
              }
            }
          ]
        }
      }
    ]);
    
    return analytics[0] || {};
  }
  
  /**
   * Find related tickets
   */
  static async findRelatedTickets(ticket) {
    const relatedQuery = {
      _id: { $ne: ticket._id },
      $or: [
        { createdBy: ticket.createdBy },
        { category: ticket.category },
        { department: ticket.department },
        { campus: ticket.campus }
      ]
    };
    
    return await Ticket.find(relatedQuery)
      .limit(5)
      .select('ticketNumber title status priority createdAt')
      .sort({ createdAt: -1 })
      .lean();
  }
}

// Export existing methods for backward compatibility
exports.createTicket = TicketController.createTicket;
exports.getAllTickets = TicketController.getAllTickets;
exports.getTicket = TicketController.getTicket;
exports.updateTicket = TicketController.updateTicket;
exports.assignTicket = TicketController.assignTicket;
exports.addComment = TicketController.addComment;
exports.resolveTicket = TicketController.resolveTicket;
exports.deleteTicket = TicketController.deleteTicket;
exports.getAnalyticsOverview = TicketController.getDashboardStats;

// Export new methods
exports.TicketController = TicketController;