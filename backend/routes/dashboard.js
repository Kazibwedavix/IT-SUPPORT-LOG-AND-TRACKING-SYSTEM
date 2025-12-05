/**
 * Dashboard Routes
 * 
 * @version 1.0.0
 * @author Bugema University IT Support System
 */

const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const auditService = require('../services/auditService');

const router = express.Router();

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private
 */
router.get('/stats', auth, async (req, res) => {
  try {
    let stats = {};

    // For regular users: show their ticket stats
    if (req.user.role === 'student' || req.user.role === 'staff') {
      const userTickets = await Ticket.aggregate([
        { $match: { createdBy: req.user.userId } },
        { $group: { 
          _id: '$status',
          count: { $sum: 1 }
        }}
      ]);

      stats = {
        totalTickets: 0,
        openTickets: 0,
        inProgressTickets: 0,
        resolvedTickets: 0,
        userRole: req.user.role
      };

      userTickets.forEach(ticket => {
        stats.totalTickets += ticket.count;
        if (ticket._id === 'Open') stats.openTickets = ticket.count;
        if (ticket._id === 'In Progress') stats.inProgressTickets = ticket.count;
        if (ticket._id === 'Resolved') stats.resolvedTickets = ticket.count;
      });

    } 
    // For technicians: show assigned tickets
    else if (req.user.role === 'technician') {
      const [assignedTickets, allTickets] = await Promise.all([
        Ticket.aggregate([
          { $match: { assignedTo: req.user.userId } },
          { $group: { 
            _id: '$status',
            count: { $sum: 1 }
          }}
        ]),
        Ticket.aggregate([
          { $group: { 
            _id: '$status',
            count: { $sum: 1 }
          }}
        ])
      ]);

      stats = {
        assignedTickets: 0,
        openAssignedTickets: 0,
        inProgressAssignedTickets: 0,
        totalSystemTickets: 0,
        userRole: req.user.role
      };

      assignedTickets.forEach(ticket => {
        stats.assignedTickets += ticket.count;
        if (ticket._id === 'Open') stats.openAssignedTickets = ticket.count;
        if (ticket._id === 'In Progress') stats.inProgressAssignedTickets = ticket.count;
      });

      allTickets.forEach(ticket => {
        stats.totalSystemTickets += ticket.count;
      });

    } 
    // For admins: show system-wide stats
    else if (req.user.role === 'admin') {
      const [ticketStats, userStats, recentTickets] = await Promise.all([
        Ticket.aggregate([
          { $group: { 
            _id: '$status',
            count: { $sum: 1 }
          }}
        ]),
        User.aggregate([
          { $group: { 
            _id: '$role',
            count: { $sum: 1 }
          }}
        ]),
        Ticket.find()
          .sort({ createdAt: -1 })
          .limit(5)
          .populate('createdBy', 'username email')
          .populate('assignedTo', 'username email')
          .select('title status priority category createdAt')
      ]);

      stats = {
        totalTickets: 0,
        openTickets: 0,
        inProgressTickets: 0,
        resolvedTickets: 0,
        closedTickets: 0,
        totalUsers: 0,
        students: 0,
        staff: 0,
        technicians: 0,
        admins: 0,
        recentTickets,
        userRole: req.user.role
      };

      ticketStats.forEach(ticket => {
        stats.totalTickets += ticket.count;
        if (ticket._id === 'Open') stats.openTickets = ticket.count;
        if (ticket._id === 'In Progress') stats.inProgressTickets = ticket.count;
        if (ticket._id === 'Resolved') stats.resolvedTickets = ticket.count;
        if (ticket._id === 'Closed') stats.closedTickets = ticket.count;
      });

      userStats.forEach(user => {
        stats.totalUsers += user.count;
        if (user._id === 'student') stats.students = user.count;
        if (user._id === 'staff') stats.staff = user.count;
        if (user._id === 'technician') stats.technicians = user.count;
        if (user._id === 'admin') stats.admins = user.count;
      });
    }

    auditService.logUserActivity(req.user.userId, 'GET_DASHBOARD_STATS', 'DASHBOARD');

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/dashboard/activity
 * @desc    Get recent activity
 * @access  Private
 */
router.get('/activity', auth, async (req, res) => {
  try {
    let activity = [];

    // Get recent tickets based on user role
    if (req.user.role === 'admin' || req.user.role === 'technician') {
      activity = await Ticket.find()
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('createdBy', 'username email role')
        .populate('assignedTo', 'username email')
        .select('title status priority category updatedAt');
    } else {
      activity = await Ticket.find({ createdBy: req.user.userId })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('assignedTo', 'username email')
        .select('title status priority category updatedAt');
    }

    res.json({
      success: true,
      data: { activity }
    });

  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/dashboard/overview
 * @desc    Get dashboard overview (admin only)
 * @access  Private/Admin
 */
router.get('/overview', auth, requireRole('admin'), async (req, res) => {
  try {
    const [ticketsByCategory, ticketsByPriority, ticketsByMonth, unresolvedTickets] = await Promise.all([
      // Tickets by category
      Ticket.aggregate([
        { $group: { 
          _id: '$category',
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } }
      ]),
      
      // Tickets by priority
      Ticket.aggregate([
        { $group: { 
          _id: '$priority',
          count: { $sum: 1 }
        }},
        { $sort: { count: -1 } }
      ]),
      
      // Tickets created by month (last 6 months)
      Ticket.aggregate([
        { 
          $match: { 
            createdAt: { 
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 6))
            }
          }
        },
        { 
          $group: { 
            _id: { 
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      
      // Unresolved tickets (older than 7 days)
      Ticket.find({ 
        status: { $in: ['Open', 'In Progress'] },
        createdAt: { $lte: new Date(new Date().setDate(new Date().getDate() - 7)) }
      })
      .populate('createdBy', 'username email')
      .populate('assignedTo', 'username email')
      .select('title status priority category createdAt')
      .limit(10)
    ]);

    const overview = {
      ticketsByCategory,
      ticketsByPriority,
      ticketsByMonth: ticketsByMonth.map(item => ({
        month: `${item._id.year}-${item._id.month}`,
        count: item.count
      })),
      unresolvedTickets,
      unresolvedCount: unresolvedTickets.length
    };

    auditService.logUserActivity(req.user.userId, 'GET_ADMIN_OVERVIEW', 'DASHBOARD');

    res.json({
      success: true,
      data: { overview }
    });

  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

/**
 * @route   GET /api/dashboard/user-stats
 * @desc    Get user-specific statistics
 * @access  Private
 */
router.get('/user-stats', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const [ticketStats, responseTime, resolutionRate] = await Promise.all([
      // Ticket statistics
      Ticket.aggregate([
        { $match: { createdBy: userId } },
        { $group: { 
          _id: '$status',
          count: { $sum: 1 }
        }}
      ]),
      
      // Average response time (for tickets with comments)
      Ticket.aggregate([
        { $match: { 
          createdBy: userId,
          'comments.0': { $exists: true }
        }},
        { $project: {
          responseTime: {
            $cond: {
              if: { $gt: [{ $size: '$comments' }, 0] },
              then: {
                $divide: [
                  { $subtract: [{ $arrayElemAt: ['$comments.createdAt', 0] }, '$createdAt'] },
                  3600000 // Convert to hours
                ]
              },
              else: null
            }
          }
        }},
        { $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' }
        }}
      ]),
      
      // Resolution rate
      Ticket.aggregate([
        { $match: { createdBy: userId } },
        { $group: {
          _id: null,
          total: { $sum: 1 },
          resolved: { 
            $sum: { 
              $cond: [{ $in: ['$status', ['Resolved', 'Closed']] }, 1, 0]
            }
          }
        }}
      ])
    ]);

    const userStats = {
      totalTickets: 0,
      openTickets: 0,
      inProgressTickets: 0,
      resolvedTickets: 0,
      avgResponseTime: responseTime[0]?.avgResponseTime || 0,
      resolutionRate: resolutionRate[0] ? 
        (resolutionRate[0].resolved / resolutionRate[0].total * 100).toFixed(1) : 0
    };

    ticketStats.forEach(stat => {
      userStats.totalTickets += stat.count;
      if (stat._id === 'Open') userStats.openTickets = stat.count;
      if (stat._id === 'In Progress') userStats.inProgressTickets = stat.count;
      if (stat._id === 'Resolved') userStats.resolvedTickets = stat.count;
      if (stat._id === 'Closed') userStats.resolvedTickets += stat.count;
    });

    res.json({
      success: true,
      data: { userStats }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;