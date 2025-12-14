/**
 * Bugema University IT Support System - PRODUCTION READY
 * REAL DATABASE SAVING WITH EMAIL VERIFICATION & PASSWORD RESET
 * 
 * @version 4.0.0
 * Production Date: ${new Date().toISOString()}
 */

// ============================================
// IMPORTS - ALL IMPORTS MUST BE AT THE TOP
// ============================================
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

// ============================================
// APP INITIALIZATION - MUST BE AFTER IMPORTS
// ============================================
const app = express();
const PORT = process.env.PORT || 5002;

// ============================================
// MIDDLEWARE - NOW WE CAN USE app
// ============================================

// Security middleware - NOW THIS COMES AFTER app IS CREATED
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.'
  }
});
app.use('/api/', limiter);

// CORS for production
app.use(cors({
  origin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// DATABASE CONNECTION
// ============================================
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/it_support_system';
    
    console.log(`🔗 Connecting to MongoDB: ${mongoURI}`);
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`✅ MongoDB Connected Successfully!`);
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🏠 Host: ${mongoose.connection.host}`);
    return true;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    console.log('💡 To fix this:');
    console.log('   1. Install MongoDB: https://www.mongodb.com/try/download/community');
    console.log('   2. Start MongoDB service:');
    console.log('      - Windows: net start MongoDB');
    console.log('      - Mac/Linux: brew services start mongodb-community');
    console.log('      - Ubuntu: sudo systemctl start mongod');
    console.log('   3. Or use MongoDB Atlas for cloud database');
    return false;
  }
};

// ============================================
// EMAIL CONFIGURATION
// ============================================
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  fromName: process.env.EMAIL_FROM_NAME || 'Bugema University IT Support',
  fromAddress: process.env.EMAIL_FROM_ADDRESS || 'support@bugemauniv.ac.ug'
};

let emailTransporter = null;

if (emailConfig.auth.user && emailConfig.auth.pass) {
  try {
    emailTransporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: emailConfig.auth
    });
    
    console.log('✅ Email transporter initialized');
  } catch (error) {
    console.error('❌ Email configuration error:', error.message);
  }
} else {
  console.warn('⚠️  Email not configured. Set SMTP_USER and SMTP_PASS in .env');
}

// ============================================
// DATABASE MODELS
// ============================================

// Department mapping
const DEPARTMENT_MAPPING = {
  'computer_science': 'computer_science',
  'engineering': 'engineering',
  'business': 'business',
  'arts_sciences': 'other',
  'medicine': 'health_sciences',
  'law': 'other',
  'education': 'education',
  'administration': 'administration',
  'it_services': 'it',
  'facilities': 'administration',
  'library': 'other',
  'student_services': 'administration',
  'research': 'other',
  'other': 'other',
  'ACADEMIC_AFFAIRS': 'administration',
  'ADMINISTRATION': 'administration',
  'IT_SERVICES': 'it',
  'LIBRARY': 'other',
  'STUDENT_AFFAIRS': 'administration',
  'RESEARCH': 'other'
};

// User Schema (Production Ready)
const userSchema = new mongoose.Schema({
  // Authentication
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  
  // Profile Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  
  phone: {
    type: String,
    trim: true
  },
  
  // University Information
  role: {
    type: String,
    enum: ['student', 'staff', 'technician', 'admin'],
    default: 'student',
    required: true
  },
  
  department: {
    type: String,
    enum: ['computer_science', 'engineering', 'business', 'health_sciences', 'education', 'it', 'administration', 'other'],
    default: 'computer_science'
  },
  
  originalDepartment: {
    type: String
  },
  
  studentId: {
    type: String,
    trim: true,
    uppercase: true
  },
  
  employeeId: {
    type: String,
    trim: true,
    uppercase: true
  },
  
  campus: {
    type: String,
    enum: ['BU', 'MA', 'KA', 'AR', 'MB', 'OTHER'],
    default: 'BU'
  },
  
  yearOfEntry: {
    type: Number
  },
  
  semester: {
    type: Number
  },
  
  // Account Status
  isEmailVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  isLocked: {
    type: Boolean,
    default: false
  },
  
  verifiedAt: {
    type: Date
  },
  
  // Security
  loginAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  
  lockUntil: {
    type: Date,
    select: false
  },
  
  passwordChangedAt: {
    type: Date,
    select: false
  },
  
  passwordResetToken: {
    type: String,
    select: false
  },
  
  passwordResetExpires: {
    type: Date,
    select: false
  },
  
  emailVerificationToken: {
    type: String,
    select: false
  },
  
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  
  lastPasswordResetAt: {
    type: Date,
    select: false
  },
  
  // Activity
  lastLogin: {
    type: Date
  },
  
  lastActivity: {
    type: Date
  },
  
  // Permissions
  permissions: {
    type: [String],
    default: function() {
      const rolePermissions = {
        admin: ['all'],
        technician: ['create_ticket', 'view_all_tickets', 'assign_tickets', 'resolve_tickets'],
        staff: ['create_ticket', 'view_department_tickets', 'edit_profile'],
        student: ['create_ticket', 'view_own_tickets', 'edit_profile']
      };
      return rolePermissions[this.role] || rolePermissions.student;
    }
  },
  
  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.emailVerificationToken;
      delete ret.emailVerificationExpires;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      return ret;
    }
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 3600000; // 1 hour
  return resetToken;
};

// Create email verification token
userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
  this.emailVerificationExpires = Date.now() + 86400000; // 24 hours
  return verificationToken;
};

// Increment failed login attempts
userSchema.methods.incrementFailedAttempts = function() {
  this.loginAttempts += 1;
  if (this.loginAttempts >= 5) {
    this.isLocked = true;
    this.lockUntil = new Date(Date.now() + 900000); // 15 minutes
  }
};

// Reset failed login attempts
userSchema.methods.resetFailedAttempts = function() {
  this.loginAttempts = 0;
  this.isLocked = false;
  this.lockUntil = undefined;
};

// Check if account is locked
userSchema.methods.isAccountLocked = function() {
  if (!this.isLocked) return false;
  if (this.lockUntil && this.lockUntil > new Date()) {
    return true;
  }
  this.isLocked = false;
  this.lockUntil = undefined;
  this.loginAttempts = 0;
  return false;
};

const User = mongoose.model('User', userSchema);

// Ticket Schema
const TICKET_SLA = {
  critical: { hours: 4, color: '#dc2626', label: 'Critical (4hrs)' },
  high: { hours: 8, color: '#ea580c', label: 'High (8hrs)' },
  medium: { hours: 24, color: '#d97706', label: 'Medium (24hrs)' },
  low: { hours: 72, color: '#059669', label: 'Low (72hrs)' }
};

// Ticket Categories with Icons
const TICKET_CATEGORIES = {
  network: { name: 'Network Issues', icon: '🌐', color: '#3b82f6' },
  software: { name: 'Software Issues', icon: '💻', color: '#8b5cf6' },
  hardware: { name: 'Hardware Issues', icon: '🔧', color: '#f59e0b' },
  account: { name: 'Account Issues', icon: '👤', color: '#10b981' },
  email: { name: 'Email Issues', icon: '📧', color: '#6366f1' },
  website: { name: 'Website Issues', icon: '🌍', color: '#ec4899' },
  other: { name: 'Other Issues', icon: '❓', color: '#6b7280' }
};

// Ticket Status Workflow
const TICKET_STATUS = {
  open: { name: 'Open', color: '#3b82f6', order: 1 },
  'in-progress': { name: 'In Progress', color: '#f59e0b', order: 2 },
  resolved: { name: 'Resolved', color: '#10b981', order: 3 },
  closed: { name: 'Closed', color: '#6b7280', order: 4 },
  pending: { name: 'Pending', color: '#8b5cf6', order: 2.5 }
};

// Enhanced Ticket Schema
const enhancedTicketSchema = new mongoose.Schema({
  // Unique Identifier
  ticketId: {
    type: String,
    unique: true,
    index: true
  },
  
  // Ticket Information
  title: {
    type: String,
    required: [true, 'Ticket title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Ticket description is required'],
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  
  // Classification
  status: {
    type: String,
    enum: Object.keys(TICKET_STATUS),
    default: 'open',
    index: true
  },
  
  priority: {
    type: String,
    enum: Object.keys(TICKET_SLA),
    default: 'medium',
    index: true
  },
  
  category: {
    type: String,
    enum: Object.keys(TICKET_CATEGORIES),
    default: 'other',
    index: true
  },
  
  // Additional Categories for Bugema University
  subCategory: {
    type: String,
    enum: ['internet', 'wifi', 'campus_network', 'software_installation', 'software_license', 
           'virus_removal', 'computer_repair', 'printer_issues', 'peripheral_devices',
           'password_reset', 'account_lockout', 'access_permissions', 'email_setup',
           'email_spam', 'website_access', 'cms_issues', 'online_learning_platform',
           'general_inquiry', 'suggestion', 'complaint'],
    default: 'general_inquiry'
  },
  
  // Campus Location
  campus: {
    type: String,
    enum: ['BU', 'MA', 'KA', 'AR', 'MB', 'OTHER'],
    default: 'BU',
    index: true
  },
  
  location: {
    type: String,
    trim: true
  },
  
  building: {
    type: String,
    trim: true
  },
  
  roomNumber: {
    type: String,
    trim: true
  },
  
  // People
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // SLA & Timelines
  slaDueDate: {
    type: Date
  },
  
  actualResolutionTime: {
    type: Number // in minutes
  },
  
  firstResponseAt: {
    type: Date
  },
  
  resolvedAt: {
    type: Date
  },
  
  closedAt: {
    type: Date
  },
  
  // Attachments
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    fileSize: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Comments/Conversation
  comments: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId()
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    message: {
      type: String,
      required: [true, 'Comment message is required'],
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters']
    },
    isInternal: {
      type: Boolean,
      default: false
    },
    attachments: [{
      fileName: String,
      fileUrl: String,
      fileType: String,
      fileSize: Number
    }],
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Resolution Details
  resolution: {
    summary: String,
    details: String,
    solutionSteps: [String],
    rootCause: String,
    preventedFromRecurring: Boolean,
    preventiveMeasures: [String]
  },
  
  // Feedback
  customerSatisfaction: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  
  feedbackComment: {
    type: String,
    maxlength: [1000, 'Feedback comment cannot exceed 1000 characters']
  },
  
  // Metadata
  tags: [{
    type: String,
    trim: true
  }],
  
  relatedTickets: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket'
  }],
  
  escalationLevel: {
    type: Number,
    default: 1,
    min: 1,
    max: 3
  },
  
  // Activity Tracking
  viewedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Audit Trail
  history: [{
    action: String,
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    reason: String
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  dueDate: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      delete ret.history;
      return ret;
    }
  }
});

// Virtual for SLA status
enhancedTicketSchema.virtual('slaStatus').get(function() {
  if (this.status === 'closed' || this.status === 'resolved') return 'completed';
  if (!this.slaDueDate) return 'no-sla';
  
  const now = new Date();
  const timeRemaining = this.slaDueDate - now;
  
  if (timeRemaining < 0) return 'breached';
  if (timeRemaining < 60 * 60 * 1000) return 'critical'; // Less than 1 hour
  if (timeRemaining < 4 * 60 * 60 * 1000) return 'warning'; // Less than 4 hours
  return 'normal';
});

// Virtual for SLA time remaining
enhancedTicketSchema.virtual('slaTimeRemaining').get(function() {
  if (!this.slaDueDate) return null;
  
  const now = new Date();
  const timeRemaining = this.slaDueDate - now;
  
  return Math.max(0, Math.floor(timeRemaining / (1000 * 60))); // in minutes
});

// Virtual for age
enhancedTicketSchema.virtual('ageInHours').get(function() {
  const created = new Date(this.createdAt);
  const now = new Date();
  return Math.floor((now - created) / (1000 * 60 * 60));
});

// Pre-save middleware
enhancedTicketSchema.pre('save', async function(next) {
  try {
    // Generate ticket ID if not exists
    if (!this.ticketId) {
      const year = new Date().getFullYear().toString().slice(-2);
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      
      // Get count of tickets this month
      const count = await this.constructor.countDocuments({
        createdAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        }
      });
      
      const sequence = (count + 1).toString().padStart(4, '0');
      this.ticketId = `TKT-${year}${month}-${sequence}`;
    }
    
    // Calculate SLA due date based on priority
    if (this.isModified('priority') || this.isNew) {
      const slaHours = TICKET_SLA[this.priority].hours;
      this.slaDueDate = new Date(Date.now() + (slaHours * 60 * 60 * 1000));
    }
    
    // Update timestamps based on status changes
    if (this.isModified('status')) {
      if (this.status === 'resolved' && !this.resolvedAt) {
        this.resolvedAt = new Date();
        
        // Calculate actual resolution time
        if (this.createdAt) {
          const resolutionTimeMs = new Date() - this.createdAt;
          this.actualResolutionTime = Math.floor(resolutionTimeMs / (1000 * 60)); // minutes
        }
      }
      
      if (this.status === 'closed' && !this.closedAt) {
        this.closedAt = new Date();
      }
    }
    
    this.updatedAt = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Add history tracking middleware
enhancedTicketSchema.pre('save', function(next) {
  const ticket = this;
  
  if (ticket.isNew) {
    // Don't add history for new documents
    return next();
  }
  
  try {
    const modifiedPaths = ticket.modifiedPaths();
    const changes = [];
    
    // Track all changes except internal fields
    const excludedFields = ['updatedAt', 'viewedBy', 'history', '__v'];
    
    modifiedPaths.forEach(path => {
      if (excludedFields.includes(path)) return;
      
      const oldValue = ticket._original ? ticket._original[path] : undefined;
      const newValue = ticket[path];
      
      // Only track if value actually changed
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          action: 'UPDATE',
          field: path,
          oldValue,
          newValue,
          changedBy: ticket._modifiedBy || null,
          reason: ticket._changeReason || null
        });
      }
    });
    
    // Add changes to history
    if (changes.length > 0) {
      if (!ticket.history) ticket.history = [];
      ticket.history.push(...changes);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
enhancedTicketSchema.methods.addComment = async function(commentData, userId) {
  const comment = {
    user: userId,
    message: commentData.message,
    isInternal: commentData.isInternal || false,
    attachments: commentData.attachments || []
  };
  
  this.comments.push(comment);
  
  // Update first response time if this is the first agent comment
  if (commentData.isInternal === false && !this.firstResponseAt) {
    this.firstResponseAt = new Date();
  }
  
  await this.save();
  return this.comments[this.comments.length - 1];
};

enhancedTicketSchema.methods.addAttachment = async function(fileData) {
  this.attachments.push({
    fileName: fileData.fileName,
    fileUrl: fileData.fileUrl,
    fileType: fileData.fileType,
    fileSize: fileData.fileSize,
    uploadedAt: new Date()
  });
  
  await this.save();
  return this.attachments[this.attachments.length - 1];
};

enhancedTicketSchema.methods.assignToUser = async function(userId, changedBy, reason) {
  this.assignedTo = userId;
  this._modifiedBy = changedBy;
  this._changeReason = reason || 'Ticket reassigned';
  this.status = 'in-progress';
  
  await this.save();
  return this;
};

enhancedTicketSchema.methods.updateStatus = async function(newStatus, changedBy, reason) {
  const oldStatus = this.status;
  this.status = newStatus;
  this._modifiedBy = changedBy;
  this._changeReason = reason || `Status changed from ${oldStatus} to ${newStatus}`;
  
  await this.save();
  return this;
};

// Static methods
enhancedTicketSchema.statics.getDashboardStats = async function(userId, userRole) {
  const query = {};
  
  // Apply role-based filtering
  if (userRole === 'student') {
    query.createdBy = userId;
  } else if (userRole === 'staff') {
    // Staff can see department tickets
    // This will need user department data
  }
  
  const stats = await this.aggregate([
    { $match: query },
    {
      $facet: {
        byStatus: [
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ],
        byPriority: [
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ],
        byCategory: [
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ],
        responseTime: [
          {
            $match: { firstResponseAt: { $exists: true } }
          },
          {
            $project: {
              responseTime: {
                $divide: [
                  { $subtract: ['$firstResponseAt', '$createdAt'] },
                  1000 * 60 * 60 // Convert to hours
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
        ],
        slaStatus: [
          {
            $addFields: {
              slaBreached: {
                $cond: [
                  { $and: [
                    { $ne: ['$status', 'closed'] },
                    { $ne: ['$status', 'resolved'] },
                    { $lt: ['$slaDueDate', new Date()] }
                  ]},
                  true,
                  false
                ]
              }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              breached: {
                $sum: { $cond: ['$slaBreached', 1, 0] }
              }
            }
          }
        ]
      }
    }
  ]);
  
  return stats[0];
};

// Create indexes for performance
enhancedTicketSchema.index({ ticketId: 1 });
enhancedTicketSchema.index({ status: 1, priority: 1 });
enhancedTicketSchema.index({ createdBy: 1, createdAt: -1 });
enhancedTicketSchema.index({ assignedTo: 1, status: 1 });
enhancedTicketSchema.index({ slaDueDate: 1 });
enhancedTicketSchema.index({ category: 1, subCategory: 1 });
enhancedTicketSchema.index({ campus: 1, status: 1 });

const Ticket = mongoose.model('Ticket', enhancedTicketSchema);
// ============================================
// HELPER FUNCTIONS
// ============================================

const mapDepartment = (frontendDepartment) => {
  if (!frontendDepartment) return 'computer_science';
  const mapped = DEPARTMENT_MAPPING[frontendDepartment];
  return mapped || 'other';
};

const sendEmail = async (to, subject, html) => {
  if (!emailTransporter) {
    console.warn('📧 Email not sent - transporter not configured');
    return false;
  }
  
  try {
    const mailOptions = {
      from: `"${emailConfig.fromName}" <${emailConfig.fromAddress}>`,
      to,
      subject,
      html
    };
    
    await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Email sent to: ${to}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    return false;
  }
};

const sendVerificationEmail = async (user, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #004d40; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2>BUGEMA UNIVERSITY</h2>
        <p>IT Support System - Email Verification</p>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <h3>Hello ${user.firstName},</h3>
        <p>Welcome to Bugema University IT Support System! Please verify your email address to activate your account.</p>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #e0e0e0;">
          <p><strong>Account Details:</strong></p>
          <p>Name: ${user.firstName} ${user.lastName}</p>
          <p>Email: ${user.email}</p>
          <p>Role: ${user.role}</p>
          <p>Department: ${user.originalDepartment || user.department}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background: #004d40; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        
        <p>Or copy this link into your browser:</p>
        <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">
          ${verificationUrl}
        </p>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
          <p><strong>⚠️ Important:</strong> This verification link expires in 24 hours.</p>
          <p>If you did not create an account, please ignore this email.</p>
        </div>
        
        <p>Need help? Contact our IT support team:</p>
        <ul>
          <li>📧 support@bugemauniv.ac.ug</li>
          <li>📞 +256 784-845-785</li>
          <li>🏢 Main Campus IT Office, Luweero</li>
        </ul>
      </div>
      <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
        <p>© ${new Date().getFullYear()} Bugema University IT Department</p>
      </div>
    </div>
  `;
  
  return sendEmail(user.email, 'Verify Your Bugema University IT Support Account', html);
};

const sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #d32f2f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2>BUGEMA UNIVERSITY</h2>
        <p>IT Support System - Password Reset</p>
      </div>
      <div style="padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <h3>Password Reset Request</h3>
        
        <p>Hello ${user.firstName},</p>
        <p>We received a request to reset your password for the Bugema University IT Support System.</p>
        
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #e0e0e0;">
          <p><strong>Account Information:</strong></p>
          <p>Name: ${user.firstName} ${user.lastName}</p>
          <p>Email: ${user.email}</p>
          <p>Request Time: ${new Date().toLocaleString()}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background: #d32f2f; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        
        <p>Or copy this link into your browser:</p>
        <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 5px;">
          ${resetUrl}
        </p>
        
        <div style="background: #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #fdcb6e;">
          <p><strong>⚠️ Security Notice:</strong></p>
          <ul>
            <li>This link expires in 1 hour</li>
            <li>If you didn't request this, please ignore this email</li>
            <li>Never share this link with anyone</li>
          </ul>
        </div>
        
        <p>Need help? Contact IT Support:</p>
        <ul>
          <li>📧 support@bugemauniv.ac.ug</li>
          <li>📞 +256 784-845-785 (Mon-Fri, 8AM-5PM)</li>
        </ul>
      </div>
      <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
        <p>© ${new Date().getFullYear()} Bugema University IT Department</p>
      </div>
    </div>
  `;
  
  return sendEmail(user.email, 'Reset Your Bugema University IT Support Password', html);
};

// ============================================
// AUTH MIDDLEWARE
// ============================================
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    req.user = await User.findById(decoded.userId).select('-password');
    
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token.' 
    });
  }
};

// ============================================
// AUTH ENDPOINTS
// ============================================

// Health Check
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  let dbStatusText = 'disconnected';
  
  switch(dbStatus) {
    case 0: dbStatusText = 'disconnected'; break;
    case 1: dbStatusText = 'connected'; break;
    case 2: dbStatusText = 'connecting'; break;
    case 3: dbStatusText = 'disconnecting'; break;
  }
  
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Bugema IT Support API v4.0.0',
    uptime: process.uptime(),
    database: dbStatusText,
    emailConfigured: emailTransporter !== null,
    environment: process.env.NODE_ENV || 'development',
    features: ['registration', 'email_verification', 'password_reset', 'ticketing']
  });
});

// Register User
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📝 [REGISTER] Attempt:', {
      email: req.body.email,
      username: req.body.username,
      role: req.body.role,
      department: req.body.department
    });

    // Validate required fields
    if (!req.body.email || !req.body.password || !req.body.username) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and username are required'
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({ 
      $or: [
        { email: req.body.email.toLowerCase() },
        { username: req.body.username }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === req.body.email.toLowerCase() 
          ? 'Email already registered' 
          : 'Username already taken',
        field: existingUser.email === req.body.email.toLowerCase() ? 'email' : 'username'
      });
    }

    // Map department
    const frontendDepartment = req.body.department;
    const mappedDepartment = mapDepartment(frontendDepartment);
    
    console.log(`🔄 Department mapping: ${frontendDepartment} → ${mappedDepartment}`);

    // Create new user
    const userData = {
      username: req.body.username,
      email: req.body.email.toLowerCase(),
      password: req.body.password,
      role: req.body.role || 'student',
      department: mappedDepartment,
      originalDepartment: frontendDepartment,
      firstName: req.body.firstName || req.body.username,
      lastName: req.body.lastName || 'User',
      phone: req.body.phone,
      studentId: req.body.studentId,
      employeeId: req.body.employeeId,
      campus: req.body.campus,
      yearOfEntry: req.body.yearOfEntry,
      semester: req.body.semester,
      isEmailVerified: false, // User must verify email
      metadata: req.body.metadata || {}
    };

    const user = new User(userData);

    // Generate verification token
    const verificationToken = user.createEmailVerificationToken();

    // Save user to database
    const savedUser = await user.save();
    
    console.log(`✅ [REGISTER] User saved: ${savedUser.email}`);

    // Send verification email
    const emailSent = await sendVerificationEmail(savedUser, verificationToken);
    
    if (!emailSent && process.env.NODE_ENV !== 'production') {
      console.log(`🔗 Verification URL for development: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${verificationToken}`);
    }

    // Create JWT token (for immediate login if needed)
    const token = jwt.sign(
      { 
        userId: savedUser._id, 
        role: savedUser.role,
        email: savedUser.email 
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      data: {
        user: savedUser.toJSON(),
        token,
        requiresVerification: true,
        emailSent,
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000)
      }
    });

  } catch (error) {
    console.error('❌ [REGISTER] Error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email or username already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// Verify Email
app.get('/api/auth/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Hash the token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Find user with valid token
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    }).select('+emailVerificationToken +emailVerificationExpires');
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }
    
    // Update user as verified
    user.isEmailVerified = true;
    user.verifiedAt = new Date();
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    console.log(`✅ [EMAIL VERIFIED] ${user.email}`);
    
    // Return success with redirect URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/login?verified=true&email=${encodeURIComponent(user.email)}`;
    
    res.json({
      success: true,
      message: 'Email verified successfully!',
      redirectUrl,
      data: {
        email: user.email,
        username: user.username
      }
    });
    
  } catch (error) {
    console.error('❌ [VERIFY EMAIL] Error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Resend Verification Email
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // For security, don't reveal if user exists
      return res.json({
        success: true,
        message: 'If an account exists, a verification link has been sent'
      });
    }
    
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }
    
    // Generate new verification token
    const verificationToken = user.createEmailVerificationToken();
    await user.save();
    
    // Send verification email
    const emailSent = await sendVerificationEmail(user, verificationToken);
    
    res.json({
      success: true,
      message: 'Verification email sent successfully',
      emailSent
    });
    
  } catch (error) {
    console.error('❌ [RESEND VERIFICATION] Error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // For security, don't reveal if user exists
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent'
      });
    }
    
    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save();
    
    console.log(`🔑 [PASSWORD RESET] Token for ${user.email}: ${resetToken}`);
    
    // Send password reset email
    const emailSent = await sendPasswordResetEmail(user, resetToken);
    
    if (!emailSent && process.env.NODE_ENV !== 'production') {
      console.log(`🔗 Reset URL for development: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`);
    }
    
    res.json({
      success: true,
      message: 'Password reset email sent',
      emailSent
    });
    
  } catch (error) {
    console.error('❌ [FORGOT PASSWORD] Error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Reset Password
app.post('/api/auth/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }
    
    // Hash the token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetExpires');
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token'
      });
    }
    
    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = Date.now();
    user.lastPasswordResetAt = new Date();
    user.resetFailedAttempts(); // Reset failed attempts
    await user.save();
    
    console.log(`✅ [PASSWORD RESET] Password updated for ${user.email}`);
    
    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
    
  } catch (error) {
    console.error('❌ [RESET PASSWORD] Error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Validate Reset Token
app.get('/api/auth/validate-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Hash the token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('+passwordResetToken +passwordResetExpires');
    
    if (!user) {
      return res.json({
        success: false,
        valid: false,
        message: 'Invalid or expired token'
      });
    }
    
    res.json({
      success: true,
      valid: true,
      message: 'Token is valid',
      email: user.email
    });
    
  } catch (error) {
    console.error('❌ [VALIDATE TOKEN] Error:', error);
    
    res.status(500).json({
      success: false,
      valid: false,
      message: 'Server error'
    });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 [LOGIN] Attempt:', { email: req.body.email });

    const { email, password, rememberMe = false } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password +loginAttempts +lockUntil');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      const remainingTime = Math.ceil((user.lockUntil - new Date()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account is locked. Try again in ${remainingTime} minutes.`,
        locked: true,
        lockedUntil: user.lockUntil
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in',
        requiresVerification: true,
        email: user.email
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      // Increment failed attempts
      user.incrementFailedAttempts();
      await user.save();
      
      const remainingAttempts = 5 - user.loginAttempts;
      
      return res.status(401).json({
        success: false,
        message: `Invalid email or password. ${remainingAttempts > 0 ? `${remainingAttempts} attempts remaining` : 'Account locked for 15 minutes'}`,
        remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0,
        locked: user.loginAttempts >= 5
      });
    }

    // Reset failed attempts on successful login
    user.resetFailedAttempts();
    user.lastLogin = new Date();
    user.lastActivity = new Date();
    await user.save();

    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        role: user.role,
        email: user.email,
        isEmailVerified: user.isEmailVerified
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: rememberMe ? '30d' : '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token,
        expiresAt: rememberMe 
          ? Date.now() + (30 * 24 * 60 * 60 * 1000)
          : Date.now() + (7 * 24 * 60 * 60 * 1000)
      }
    });

  } catch (error) {
    console.error('❌ [LOGIN] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user.toJSON()
    });
  } catch (error) {
    console.error('❌ [GET USER] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Check username availability
app.get('/api/auth/check-username/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    
    res.json({
      success: true,
      available: !user,
      suggestions: user ? [
        `${req.params.username}123`,
        `${req.params.username}_${Date.now().toString().slice(-3)}`,
        `${req.params.username}${Math.floor(Math.random() * 100)}`
      ] : []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Check email availability
app.get('/api/auth/check-email/:email', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    
    res.json({
      success: true,
      available: !user,
      isUniversityEmail: req.params.email.includes('bugemauniv.ac.ug')
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Change Password (Authenticated)
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    
    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    console.log(`✅ [PASSWORD CHANGE] Password changed for ${user.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('❌ [CHANGE PASSWORD] Error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// DASHBOARD ENDPOINTS
// ============================================

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get REAL dashboard statistics (Production Ready) - FIXED VERSION
 * @access  Private
 */
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    console.log(`📊 [DASHBOARD STATS] Request from ${req.user.role}: ${req.user._id}`);
    
    const userId = req.user._id;
    const userRole = req.user.role;
    
    // Build query based on user role
    let ticketQuery = {};
    let canViewAll = false;
    
    switch (userRole) {
      case 'admin':
        ticketQuery = {};
        canViewAll = true;
        break;
      case 'technician':
        ticketQuery = {
          $or: [
            { assignedTo: userId },
            { status: 'open' }
          ]
        };
        canViewAll = true;
        break;
      case 'staff':
        const staff = await User.findById(userId);
        ticketQuery = {
          $or: [
            { createdBy: userId },
            { department: staff?.department }
          ]
        };
        break;
      case 'student':
        ticketQuery = { createdBy: userId };
        break;
      default:
        ticketQuery = { createdBy: userId };
    }
    
    // Get basic counts in parallel
    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      highPriorityTickets,
      criticalTickets,
      overdueTickets,
      myCreatedTickets,
      assignedToMe,
      totalUsers,
      activeUsers,
      verifiedUsers
    ] = await Promise.all([
      // Total tickets based on role
      Ticket.countDocuments(ticketQuery),
      
      // Open tickets
      Ticket.countDocuments({ ...ticketQuery, status: 'open' }),
      
      // In Progress tickets
      Ticket.countDocuments({ ...ticketQuery, status: 'in-progress' }),
      
      // Resolved/Closed tickets
      Ticket.countDocuments({ 
        ...ticketQuery, 
        status: { $in: ['resolved', 'closed'] } 
      }),
      
      // High priority tickets
      Ticket.countDocuments({ 
        ...ticketQuery, 
        priority: 'high' 
      }),
      
      // Critical priority tickets
      Ticket.countDocuments({ 
        ...ticketQuery, 
        priority: 'critical' 
      }),
      
      // Overdue tickets (SLA breached) - SIMPLIFIED
      Ticket.countDocuments({
        ...ticketQuery,
        slaDueDate: { $lt: new Date() },
        status: { $nin: ['resolved', 'closed'] }
      }),
      
      // Tickets created by me
      Ticket.countDocuments({ createdBy: userId }),
      
      // Tickets assigned to me
      Ticket.countDocuments({ 
        assignedTo: userId,
        status: { $nin: ['resolved', 'closed'] }
      }),
      
      // User statistics (only for admins/technicians)
      canViewAll ? User.countDocuments() : Promise.resolve(0),
      
      canViewAll ? User.countDocuments({ isActive: true }) : Promise.resolve(0),
      
      canViewAll ? User.countDocuments({ isEmailVerified: true }) : Promise.resolve(0)
    ]);
    
    // Get recent tickets for the table
    const recentTicketsData = await Ticket.find(ticketQuery)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .select('ticketId title description status priority category createdAt updatedAt slaDueDate')
      .lean();
    
    // Calculate average resolution time - SIMPLIFIED
    let avgResolutionHours = 0;
    try {
      const resolvedSample = await Ticket.find({
        ...ticketQuery,
        status: { $in: ['resolved', 'closed'] },
        resolvedAt: { $exists: true, $ne: null },
        createdAt: { $exists: true, $ne: null }
      })
      .select('createdAt resolvedAt')
      .limit(10)
      .lean();
      
      if (resolvedSample.length > 0) {
        const totalHours = resolvedSample.reduce((sum, ticket) => {
          if (ticket.resolvedAt && ticket.createdAt) {
            const hours = (new Date(ticket.resolvedAt) - new Date(ticket.createdAt)) / (1000 * 60 * 60);
            return sum + (hours > 0 ? hours : 0);
          }
          return sum;
        }, 0);
        
        avgResolutionHours = Math.round(totalHours / resolvedSample.length);
      }
    } catch (error) {
      console.error('❌ [AVG RESOLUTION TIME ERROR]', error.message);
      avgResolutionHours = 0;
    }
    
    // Calculate SLA compliance rate - FIXED VERSION
    let slaCompliantTickets = 0;
    try {
      const slaResults = await Ticket.aggregate([
        { $match: { ...ticketQuery, status: { $in: ['resolved', 'closed'] } } },
        {
          $project: {
            resolvedAt: 1,
            slaDueDate: 1,
            isCompliant: {
              $cond: {
                if: {
                  $and: [
                    { $ne: ['$resolvedAt', null] },
                    { $ne: ['$slaDueDate', null] },
                    { $lt: ['$resolvedAt', '$slaDueDate'] }
                  ]
                },
                then: 1,
                else: 0
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            compliantCount: { $sum: '$isCompliant' },
            totalCount: { $sum: 1 }
          }
        }
      ]);
      
      if (slaResults.length > 0) {
        slaCompliantTickets = slaResults[0].compliantCount;
      }
    } catch (error) {
      console.error('❌ [SLA COMPLIANCE QUERY ERROR]', error.message);
      slaCompliantTickets = 0;
    }
    
    const slaComplianceRate = resolvedTickets > 0 
      ? Math.round((slaCompliantTickets / resolvedTickets) * 100)
      : 0;
    
    // Prepare comprehensive stats object
    const stats = {
      // Core metrics
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets: await Ticket.countDocuments({ ...ticketQuery, status: 'closed' }),
      
      // Priority breakdown
      highPriority: highPriorityTickets + criticalTickets,
      criticalTickets,
      mediumPriority: await Ticket.countDocuments({ ...ticketQuery, priority: 'medium' }),
      lowPriority: await Ticket.countDocuments({ ...ticketQuery, priority: 'low' }),
      
      // Performance metrics
      overdueTickets,
      averageResolutionTime: avgResolutionHours < 24 
        ? `${avgResolutionHours} hours` 
        : `${Math.round(avgResolutionHours / 24)} days`,
      slaComplianceRate: `${slaComplianceRate}%`,
      
      // User-specific metrics
      myTickets: myCreatedTickets,
      assignedTickets: assignedToMe,
      pendingResponse: await Ticket.countDocuments({
        ...ticketQuery,
        status: 'open',
        firstResponseAt: { $exists: false }
      }),
      
      // System metrics (for admins/technicians)
      totalUsers: canViewAll ? totalUsers : myCreatedTickets,
      activeUsers: canViewAll ? activeUsers : 1,
      verifiedUsers: canViewAll ? verifiedUsers : 1,
      
      // Calculated percentages
      resolutionRate: totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0,
      openRate: totalTickets > 0 ? Math.round((openTickets / totalTickets) * 100) : 0,
      inProgressRate: totalTickets > 0 ? Math.round((inProgressTickets / totalTickets) * 100) : 0,
      
      // User info for frontend
      userRole,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      userEmail: req.user.email,
      userDepartment: req.user.department,
      
      // Timestamp
      lastUpdated: new Date().toISOString()
    };
    
    // Format recent tickets for frontend table
    const recentTickets = recentTicketsData.map(ticket => ({
      id: ticket._id,
      ticketId: ticket.ticketId,
      title: ticket.title,
      description: ticket.description?.substring(0, 100) + (ticket.description?.length > 100 ? '...' : ''),
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      ageInHours: Math.floor((new Date() - new Date(ticket.createdAt)) / (1000 * 60 * 60)),
      createdBy: ticket.createdBy ? {
        name: `${ticket.createdBy.firstName} ${ticket.createdBy.lastName}`,
        email: ticket.createdBy.email
      } : null,
      assignedTo: ticket.assignedTo ? {
        name: `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`,
        email: ticket.assignedTo.email
      } : null,
      isOverdue: ticket.slaDueDate && new Date() > new Date(ticket.slaDueDate) && 
                 !['resolved', 'closed'].includes(ticket.status)
    }));
    
    console.log(`✅ [DASHBOARD STATS] Real data sent: ${totalTickets} tickets found`);
    
    // Return in exact format frontend expects
    res.json({
      success: true,
      data: {
        stats: stats,
        tickets: recentTickets,
        systemInfo: {
          environment: process.env.NODE_ENV || 'production',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [DASHBOARD STATS ERROR]', error);
    
    // Production error handling - never send mock data
    res.status(500).json({
      success: false,
      error: 'DASHBOARD_DATA_FETCH_FAILED',
      message: 'Unable to load dashboard statistics: ' + error.message,
      timestamp: new Date().toISOString(),
      referenceId: `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      supportContact: 'itsupport@bugemauniv.ac.ug'
    });
  }
});

// ============================================
// TICKET ENDPOINTS - ADDED MISSING ROUTE
// ============================================

// Create ticket
app.post('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const ticketData = {
      ...req.body,
      createdBy: req.user._id
    };

    const ticket = new Ticket(ticketData);
    await ticket.save();

    await ticket.populate('createdBy', 'username email firstName lastName role');

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: ticket
    });
  } catch (error) {
    console.error('❌ [CREATE TICKET] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating ticket'
    });
  }
});

// Get all tickets
/**
 * @route   GET /api/tickets
 * @desc    Get REAL tickets with pagination and filtering (Production Ready)
 * @access  Private
 */
app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    
    const { 
      status, 
      priority, 
      category, 
      campus,
      assignedTo,
      createdBy,
      search,
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    console.log(`🎫 [TICKETS LIST] Request from ${userRole}`, {
      status, priority, category, page, limit, search
    });
    
    // Build role-based query
    const query = {};
    
    if (userRole === 'student') {
      query.createdBy = userId;
    } else if (userRole === 'staff') {
      const staff = await User.findById(userId);
      query.$or = [
        { createdBy: userId },
        { department: staff?.department }
      ];
    }
    // Technicians and admins see all tickets
    
    // Apply filters
    if (status && status !== 'all') {
      const statuses = status.split(',');
      query.status = statuses.length > 1 ? { $in: statuses } : status;
    }
    
    if (priority && priority !== 'all') {
      const priorities = priority.split(',');
      query.priority = priorities.length > 1 ? { $in: priorities } : priority;
    }
    
    if (category && category !== 'all') {
      const categories = category.split(',');
      query.category = categories.length > 1 ? { $in: categories } : category;
    }
    
    if (campus && campus !== 'all') {
      query.campus = campus;
    }
    
    if (assignedTo && assignedTo !== 'all') {
      query.assignedTo = assignedTo === 'unassigned' ? null : assignedTo;
    }
    
    if (createdBy && createdBy !== 'all') {
      query.createdBy = createdBy;
    }
    
    // Search functionality
    if (search && search.trim().length >= 2) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { ticketId: { $regex: searchRegex } },
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { 'resolution.summary': { $regex: searchRegex } }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Ticket.countDocuments(query);
    
    // Build sort object
    const sort = {};
    const sortFields = {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      priority: 'priority',
      status: 'status',
      ticketId: 'ticketId'
    };
    
    if (sortFields[sortBy]) {
      sort[sortFields[sortBy]] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1; // Default sort
    }
    
    // Execute query with performance optimization
    const tickets = await Ticket.find(query)
      .populate('createdBy', 'firstName lastName email role department phone')
      .populate('assignedTo', 'firstName lastName email role department')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v -history -viewedBy') // Exclude heavy fields
      .lean();
    
    // Format tickets for frontend
    const formattedTickets = tickets.map(ticket => ({
      id: ticket._id,
      ticketId: ticket.ticketId,
      title: ticket.title,
      description: ticket.description?.substring(0, 200) + (ticket.description?.length > 200 ? '...' : ''),
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      subCategory: ticket.subCategory,
      campus: ticket.campus,
      location: ticket.location,
      building: ticket.building,
      roomNumber: ticket.roomNumber,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      slaDueDate: ticket.slaDueDate,
      resolvedAt: ticket.resolvedAt,
      closedAt: ticket.closedAt,
      
      // Virtual fields calculated on the fly
      ageInHours: Math.floor((new Date() - new Date(ticket.createdAt)) / (1000 * 60 * 60)),
      ageInDays: Math.floor((new Date() - new Date(ticket.createdAt)) / (1000 * 60 * 60 * 24)),
      isOverdue: ticket.slaDueDate && new Date() > new Date(ticket.slaDueDate) && 
                 !['resolved', 'closed'].includes(ticket.status),
      isAssigned: !!ticket.assignedTo,
      hasAttachments: ticket.attachments && ticket.attachments.length > 0,
      hasComments: ticket.comments && ticket.comments.length > 0,
      
      // User information
      createdBy: ticket.createdBy ? {
        id: ticket.createdBy._id,
        name: `${ticket.createdBy.firstName} ${ticket.createdBy.lastName}`,
        email: ticket.createdBy.email,
        role: ticket.createdBy.role,
        department: ticket.createdBy.department,
        phone: ticket.createdBy.phone
      } : null,
      
      assignedTo: ticket.assignedTo ? {
        id: ticket.assignedTo._id,
        name: `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`,
        email: ticket.assignedTo.email,
        role: ticket.assignedTo.role,
        department: ticket.assignedTo.department
      } : null,
      
      // Counts
      commentCount: ticket.comments?.length || 0,
      attachmentCount: ticket.attachments?.length || 0,
      
      // SLA information
      slaStatus: (() => {
        if (ticket.status === 'closed' || ticket.status === 'resolved') return 'completed';
        if (!ticket.slaDueDate) return 'no-sla';
        if (new Date() > ticket.slaDueDate) return 'breached';
        const timeRemaining = ticket.slaDueDate - new Date();
        if (timeRemaining < 60 * 60 * 1000) return 'critical'; // Less than 1 hour
        if (timeRemaining < 4 * 60 * 60 * 1000) return 'warning'; // Less than 4 hours
        return 'normal';
      })(),
      
      slaTimeRemaining: ticket.slaDueDate ? 
        Math.max(0, Math.floor((ticket.slaDueDate - new Date()) / (1000 * 60))) : null // in minutes
    }));
    
    // Get aggregation data for filters
    const filterData = await Ticket.aggregate([
      { $match: query },
      {
        $facet: {
          statusCounts: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          priorityCounts: [
            { $group: { _id: '$priority', count: { $sum: 1 } } }
          ],
          categoryCounts: [
            { $group: { _id: '$category', count: { $sum: 1 } } }
          ],
          campusCounts: [
            { $group: { _id: '$campus', count: { $sum: 1 } } }
          ]
        }
      }
    ]);
    
    console.log(`✅ [TICKETS LIST] Found ${total} tickets, returning ${formattedTickets.length}`);
    
    // Return in exact format frontend expects
    res.json({
      success: true,
      data: {
        tickets: formattedTickets,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
          hasNextPage: (parseInt(page) * parseInt(limit)) < total,
          hasPrevPage: parseInt(page) > 1
        },
        filters: {
          status: status || 'all',
          priority: priority || 'all',
          category: category || 'all',
          campus: campus || 'all',
          counts: filterData[0] || {}
        },
        metadata: {
          timestamp: new Date().toISOString(),
          queryTime: Date.now(),
          userRole,
          canCreateTicket: true,
          canAssignTickets: ['admin', 'technician'].includes(userRole),
          canExport: ['admin', 'technician'].includes(userRole)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [TICKETS LIST ERROR]', error);
    
    res.status(500).json({
      success: false,
      error: 'TICKETS_FETCH_FAILED',
      message: 'Unable to load tickets',
      timestamp: new Date().toISOString(),
      referenceId: `TICKET-ERR-${Date.now()}`
    });
  }
});

// ============================================
// ADDED: GET SINGLE TICKET BY ID - THIS WAS MISSING!
// ============================================

/**
 * @route   GET /api/tickets/:id
 * @desc    Get single ticket by ID - ADDED THIS MISSING ROUTE
 * @access  Private
 */
app.get('/api/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    console.log(`🎫 [GET TICKET] Request for ID: ${id} by ${req.user.email}`);
    
    // Build query - handle both ObjectId and ticketId
    let query;
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else {
      // Try ticketId format like TKT-2401-0001
      query = { ticketId: id };
    }
    
    // Find the ticket
    const ticket = await Ticket.findOne(query)
      .populate('createdBy', 'firstName lastName email role department')
      .populate('assignedTo', 'firstName lastName email role department')
      .populate('comments.user', 'firstName lastName role');
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found',
        code: 'TICKET_NOT_FOUND'
      });
    }
    
    // Check permissions
    const isOwner = ticket.createdBy._id.toString() === userId.toString();
    const isAssigned = ticket.assignedTo && ticket.assignedTo._id.toString() === userId.toString();
    const isAdminOrTech = ['admin', 'technician'].includes(userRole);
    
    if (!isOwner && !isAssigned && !isAdminOrTech) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this ticket',
        code: 'PERMISSION_DENIED'
      });
    }
    
    // Format the response
    const formattedTicket = {
      _id: ticket._id,
      ticketId: ticket.ticketId,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      subCategory: ticket.subCategory,
      campus: ticket.campus,
      location: ticket.location,
      building: ticket.building,
      roomNumber: ticket.roomNumber,
      slaDueDate: ticket.slaDueDate,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      resolvedAt: ticket.resolvedAt,
      closedAt: ticket.closedAt,
      attachments: ticket.attachments || [],
      comments: ticket.comments || [],
      
      // User info
      createdBy: {
        _id: ticket.createdBy._id,
        name: `${ticket.createdBy.firstName} ${ticket.createdBy.lastName}`,
        email: ticket.createdBy.email,
        role: ticket.createdBy.role,
        department: ticket.createdBy.department
      },
      
      assignedTo: ticket.assignedTo ? {
        _id: ticket.assignedTo._id,
        name: `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}`,
        email: ticket.assignedTo.email,
        role: ticket.assignedTo.role,
        department: ticket.assignedTo.department
      } : null,
      
      // Calculated fields
      ageInHours: Math.floor((new Date() - new Date(ticket.createdAt)) / (1000 * 60 * 60)),
      isOverdue: ticket.slaDueDate && new Date() > ticket.slaDueDate && 
                 !['resolved', 'closed'].includes(ticket.status),
      slaStatus: (() => {
        if (ticket.status === 'closed' || ticket.status === 'resolved') return 'completed';
        if (!ticket.slaDueDate) return 'no-sla';
        if (new Date() > ticket.slaDueDate) return 'breached';
        const timeRemaining = ticket.slaDueDate - new Date();
        if (timeRemaining < 60 * 60 * 1000) return 'critical'; // < 1 hour
        if (timeRemaining < 4 * 60 * 60 * 1000) return 'warning'; // < 4 hours
        return 'normal';
      })()
    };
    
    console.log(`✅ [GET TICKET] Found: ${ticket.ticketId}`);
    
    res.json({
      success: true,
      data: formattedTicket
    });
    
  } catch (error) {
    console.error('❌ [GET TICKET ERROR]', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve ticket',
      code: 'SERVER_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update ticket
app.put('/api/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    const ticket = await Ticket.findById(id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    // Check permissions
    const isOwner = ticket.createdBy.toString() === userId.toString();
    const isAssigned = ticket.assignedTo && ticket.assignedTo.toString() === userId.toString();
    const isAdminOrTech = ['admin', 'technician'].includes(userRole);
    
    if (!isOwner && !isAssigned && !isAdminOrTech) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this ticket'
      });
    }
    
    // Update ticket
    Object.assign(ticket, req.body);
    await ticket.save();
    
    await ticket.populate('createdBy', 'username email firstName lastName role');
    await ticket.populate('assignedTo', 'username email firstName lastName role');
    
    res.json({
      success: true,
      message: 'Ticket updated successfully',
      data: ticket
    });
  } catch (error) {
    console.error('❌ [UPDATE TICKET] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating ticket'
    });
  }
});

// ENHANCED TICKET MANAGEMENT SYSTEM

/**
 * @desc    Create a new ticket (Enhanced)
 * @route   POST /api/v2/tickets
 * @access  Private
 */
app.post('/api/v2/tickets', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    
    const {
      title,
      description,
      category,
      priority,
      subCategory,
      campus,
      location,
      building,
      roomNumber,
      department,
      attachments = []
    } = req.body;
    
    // Enhanced validation
    const validationErrors = [];
    
    if (!title || title.trim().length < 5) {
      validationErrors.push({
        field: 'title',
        message: 'Title must be at least 5 characters'
      });
    }
    
    if (!description || description.trim().length < 10) {
      validationErrors.push({
        field: 'description',
        message: 'Description must be at least 10 characters'
      });
    }
    
    if (!category || !Object.keys(TICKET_CATEGORIES).includes(category)) {
      validationErrors.push({
        field: 'category',
        message: 'Valid category is required'
      });
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
    
    // Calculate SLA due date
    const slaHours = TICKET_SLA[priority || 'medium'].hours;
    const slaDueDate = new Date(Date.now() + (slaHours * 60 * 60 * 1000));
    
    // Build ticket data
    const ticketData = {
      title: title.trim(),
      description: description.trim(),
      category,
      priority: priority || 'medium',
      subCategory: subCategory || 'general_inquiry',
      campus: campus || 'BU',
      location,
      building,
      roomNumber,
      department,
      createdBy: userId,
      slaDueDate,
      attachments: attachments.map(att => ({
        fileName: att.fileName,
        fileUrl: att.fileUrl,
        fileType: att.fileType,
        fileSize: att.fileSize,
        uploadedAt: new Date()
      }))
    };
    
    // Create ticket
    const ticket = new Ticket(ticketData);
    
    // Auto-assign based on category for technicians/admins
    if (['technician', 'admin'].includes(userRole)) {
      // Find available technician for this category
      const availableTech = await User.findOne({
        role: 'technician',
        department: category === 'network' ? 'it' : 'computer_science',
        isActive: true
      }).session(session);
      
      if (availableTech) {
        ticket.assignedTo = availableTech._id;
        ticket.status = 'in-progress';
        
        // Add to history
        ticket.history.push({
          action: 'ASSIGNED',
          field: 'assignedTo',
          oldValue: null,
          newValue: availableTech._id,
          changedBy: userId,
          changedAt: new Date(),
          reason: 'Auto-assigned based on category'
        });
      }
    }
    
    await ticket.save({ session });
    
    // Add creation to history
    ticket.history.push({
      action: 'CREATED',
      field: 'status',
      oldValue: null,
      newValue: 'open',
      changedBy: userId,
      changedAt: new Date(),
      reason: 'Ticket created'
    });
    
    await ticket.save({ session });
    
    // Send notification to creator
    if (req.user.email) {
      await sendEmail({
        to: req.user.email,
        subject: `Ticket Created: ${ticket.ticketId} - ${ticket.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #004d40; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h2>BUGEMA UNIVERSITY IT SUPPORT</h2>
              <p>Ticket Created Successfully</p>
            </div>
            <div style="padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
              <h3>Hello ${req.user.firstName},</h3>
              <p>Your support ticket has been created successfully.</p>
              
              <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #e0e0e0;">
                <p><strong>Ticket Details:</strong></p>
                <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
                <p><strong>Title:</strong> ${ticket.title}</p>
                <p><strong>Category:</strong> ${ticket.category}</p>
                <p><strong>Priority:</strong> ${ticket.priority}</p>
                <p><strong>Status:</strong> ${ticket.status}</p>
                <p><strong>Created:</strong> ${new Date(ticket.createdAt).toLocaleString()}</p>
                <p><strong>SLA Deadline:</strong> ${new Date(ticket.slaDueDate).toLocaleString()}</p>
              </div>
              
              <div style="background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #c8e6c9;">
                <p><strong>📋 Next Steps:</strong></p>
                <ul>
                  <li>Track your ticket status in the dashboard</li>
                  <li>You will receive updates via email</li>
                  <li>Expected response: Within ${TICKET_SLA[ticket.priority].hours} hours</li>
                </ul>
              </div>
              
              <p><strong>Need urgent assistance?</strong></p>
              <ul>
                <li>📧 Email: support@bugemauniv.ac.ug</li>
                <li>📞 Phone: 0784845785 (8:00 AM - 5:00 PM)</li>
                <li>🏢 Location: Main Campus IT Office</li>
              </ul>
            </div>
          </div>
        `
      });
    }
    
    // Send notification to assigned technician
    if (ticket.assignedTo) {
      const technician = await User.findById(ticket.assignedTo).session(session);
      if (technician && technician.email) {
        await sendEmail({
          to: technician.email,
          subject: `New Ticket Assigned: ${ticket.ticketId}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1976d2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2>BUGEMA UNIVERSITY IT SUPPORT</h2>
                <p>New Ticket Assignment</p>
              </div>
              <div style="padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                <h3>Hello ${technician.firstName},</h3>
                <p>A new ticket has been assigned to you.</p>
                
                <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #e0e0e0;">
                  <p><strong>Ticket Details:</strong></p>
                  <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
                  <p><strong>Title:</strong> ${ticket.title}</p>
                  <p><strong>Category:</strong> ${ticket.category}</p>
                  <p><strong>Priority:</strong> ${ticket.priority}</p>
                  <p><strong>Created By:</strong> ${req.user.firstName} ${req.user.lastName}</p>
                  <p><strong>SLA Deadline:</strong> ${new Date(ticket.slaDueDate).toLocaleString()}</p>
                  <p><strong>Time Remaining:</strong> ${TICKET_SLA[ticket.priority].label}</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket._id}" 
                     style="background: #1976d2; color: white; padding: 12px 30px; 
                            text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    View Ticket
                  </a>
                </div>
                
                <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
                  <p><strong>⚠️ SLA Alert:</strong> This ticket has a ${ticket.priority} priority with ${TICKET_SLA[ticket.priority].hours} hour SLA.</p>
                </div>
              </div>
            </div>
          `
        });
      }
    }
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    // Populate for response
    await ticket.populate('createdBy', 'firstName lastName email role');
    await ticket.populate('assignedTo', 'firstName lastName email role');
    
    console.log(`✅ [TICKET CREATED] ${ticket.ticketId} by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: {
        ticket,
        metadata: {
          ticketId: ticket.ticketId,
          slaDeadline: ticket.slaDueDate,
          estimatedResponse: `Within ${TICKET_SLA[ticket.priority].hours} hours`,
          nextSteps: [
            'Your ticket has been logged with a unique ID',
            'You will receive email updates on progress',
            'Check your dashboard for status updates'
          ]
        },
        supportContact: {
          email: 'support@bugemauniv.ac.ug',
          phone: '0784845785',
          hours: 'Mon-Fri: 8:00 AM - 5:00 PM'
        }
      }
    });
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('❌ [CREATE TICKET ERROR]', error);
    
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
        error: 'Ticket ID conflict. Please try again.',
        code: 'DUPLICATE_TICKET_ID'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create ticket',
      code: 'SERVER_ERROR',
      reference: `TICKET-${Date.now()}`,
      supportContact: {
        email: 'support@bugemauniv.ac.ug',
        phone: '0784845785'
      }
    });
  }
});

/**
 * @desc    Get tickets with advanced filtering (Enhanced)
 * @route   GET /api/v2/tickets
 * @access  Private
 */
app.get('/api/v2/tickets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    
    const {
      status,
      priority,
      category,
      campus,
      assignedTo,
      createdBy,
      fromDate,
      toDate,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Build query based on user role
    const query = {};
    
    // Role-based access control
    if (userRole === 'student') {
      query.createdBy = userId;
    } else if (userRole === 'staff') {
      query.$or = [
        { createdBy: userId },
        // Add department-based query
      ];
    }
    // Technicians and admins can see all tickets
    
    // Apply filters
    if (status) {
      const statuses = status.split(',');
      query.status = { $in: statuses };
    }
    
    if (priority) {
      const priorities = priority.split(',');
      query.priority = { $in: priorities };
    }
    
    if (category) {
      const categories = category.split(',');
      query.category = { $in: categories };
    }
    
    if (campus) query.campus = campus;
    if (assignedTo) query.assignedTo = assignedTo;
    if (createdBy) query.createdBy = createdBy;
    
    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }
    
    // Search functionality
    if (search) {
      query.$or = [
        { ticketId: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Ticket.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute query
    const tickets = await Ticket.find(query)
      .populate('createdBy', 'firstName lastName email role department')
      .populate('assignedTo', 'firstName lastName email role')
      .populate('comments.user', 'firstName lastName role')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Enhance tickets with virtual fields
    const enhancedTickets = tickets.map(ticket => ({
      ...ticket,
      slaStatus: ticket.slaStatus,
      slaTimeRemaining: ticket.slaTimeRemaining,
      ageInHours: ticket.ageInHours,
      isOverdue: new Date() > ticket.slaDueDate && 
                 !['resolved', 'closed'].includes(ticket.status)
    }));
    
    res.json({
      success: true,
      data: {
        tickets: enhancedTickets,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        },
        filters: {
          applied: Object.keys(req.query).filter(key => 
            !['page', 'limit', 'sortBy', 'sortOrder'].includes(key)
          ),
          available: {
            status: ['open', 'in-progress', 'resolved', 'closed', 'pending'],
            priority: ['low', 'medium', 'high', 'critical'],
            category: Object.keys(TICKET_CATEGORIES),
            campus: ['BU', 'MA', 'KA', 'AR', 'MB', 'OTHER']
          }
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [GET TICKETS ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tickets',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * @desc    Get single ticket with full details
 * @route   GET /api/v2/tickets/:id
 * @access  Private
 */
app.get('/api/v2/tickets/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    
    // Find by ID or ticketId
    const query = mongoose.Types.ObjectId.isValid(id) 
      ? { _id: id }
      : { ticketId: id };
    
    const ticket = await Ticket.findOne(query)
      .populate('createdBy', 'firstName lastName email role department phone campus')
      .populate('assignedTo', 'firstName lastName email role department phone')
      .populate('comments.user', 'firstName lastName role')
      .populate('viewedBy.user', 'firstName lastName role')
      .lean();
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        code: 'TICKET_NOT_FOUND'
      });
    }
    
    // Check permissions
    const isOwner = ticket.createdBy._id.toString() === userId.toString();
    const isAssigned = ticket.assignedTo && ticket.assignedTo._id.toString() === userId.toString();
    const isAdminOrTech = ['admin', 'technician'].includes(userRole);
    
    if (!isOwner && !isAssigned && !isAdminOrTech) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this ticket',
        code: 'PERMISSION_DENIED'
      });
    }
    
    // Record view for analytics
    await Ticket.findByIdAndUpdate(ticket._id, {
      $push: {
        viewedBy: {
          user: userId,
          viewedAt: new Date()
        }
      }
    });
    
    // Add SLA information
    const slaInfo = {
      priorityLabel: TICKET_SLA[ticket.priority].label,
      dueDate: ticket.slaDueDate,
      status: ticket.slaStatus,
      timeRemaining: ticket.slaTimeRemaining,
      age: ticket.ageInHours
    };
    
    res.json({
      success: true,
      data: {
        ...ticket,
        sla: slaInfo,
        permissions: {
          canEdit: isOwner || isAdminOrTech || isAssigned,
          canAssign: isAdminOrTech,
          canResolve: isAdminOrTech || isAssigned,
          canComment: true
        },
        analytics: {
          viewCount: ticket.viewedBy?.length || 0,
          commentCount: ticket.comments?.length || 0,
          ageInDays: Math.floor(ticket.ageInHours / 24)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [GET TICKET ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve ticket',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * @desc    Update ticket (Enhanced)
 * @route   PUT /api/v2/tickets/:id
 * @access  Private
 */
app.put('/api/v2/tickets/:id', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    const updates = req.body;
    
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
    const isOwner = ticket.createdBy.toString() === userId.toString();
    const isAssigned = ticket.assignedTo && ticket.assignedTo.toString() === userId.toString();
    const isAdminOrTech = ['admin', 'technician'].includes(userRole);
    
    if (!isOwner && !isAssigned && !isAdminOrTech) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update this ticket',
        code: 'PERMISSION_DENIED'
      });
    }
    
    const oldTicket = ticket.toObject();
    const changes = {};
    
    // Track changes
    const allowedUpdates = ['status', 'priority', 'category', 'subCategory', 
                           'campus', 'location', 'building', 'roomNumber', 
                           'assignedTo', 'dueDate', 'resolution'];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined && updates[field] !== ticket[field]) {
        changes[field] = {
          old: ticket[field],
          new: updates[field]
        };
      }
    });
    
    // Apply updates
    Object.assign(ticket, updates);
    
    // Special handling for assignment
    if (updates.assignedTo && updates.assignedTo !== oldTicket.assignedTo?.toString()) {
      ticket._modifiedBy = userId;
      ticket._changeReason = updates.changeReason || 'Ticket reassigned';
      ticket.status = 'in-progress';
      
      // Notify new assignee
      const newAssignee = await User.findById(updates.assignedTo).session(session);
      if (newAssignee && newAssignee.email) {
        await sendEmail({
          to: newAssignee.email,
          subject: `Ticket Assigned: ${ticket.ticketId}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1976d2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2>BUGEMA UNIVERSITY IT SUPPORT</h2>
                <p>Ticket Assigned to You</p>
              </div>
              <div style="padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                <h3>Hello ${newAssignee.firstName},</h3>
                <p>A ticket has been assigned to you.</p>
                
                <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #e0e0e0;">
                  <p><strong>Ticket Details:</strong></p>
                  <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
                  <p><strong>Title:</strong> ${ticket.title}</p>
                  <p><strong>Priority:</strong> ${ticket.priority}</p>
                  <p><strong>Assigned By:</strong> ${req.user.firstName} ${req.user.lastName}</p>
                  <p><strong>SLA Deadline:</strong> ${new Date(ticket.slaDueDate).toLocaleString()}</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket._id}" 
                     style="background: #1976d2; color: white; padding: 12px 30px; 
                            text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                    View Ticket
                  </a>
                </div>
              </div>
            </div>
          `
        });
      }
    }
    
    // Special handling for resolution
    if (updates.status === 'resolved' && oldTicket.status !== 'resolved') {
      ticket.resolvedAt = new Date();
      
      // Calculate actual resolution time
      if (ticket.createdAt) {
        const resolutionTimeMs = ticket.resolvedAt - ticket.createdAt;
        ticket.actualResolutionTime = Math.floor(resolutionTimeMs / (1000 * 60));
      }
      
      // Notify creator
      const creator = await User.findById(ticket.createdBy).session(session);
      if (creator && creator.email) {
        await sendEmail({
          to: creator.email,
          subject: `Ticket Resolved: ${ticket.ticketId}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #2e7d32; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h2>BUGEMA UNIVERSITY IT SUPPORT</h2>
                <p>Ticket Resolved</p>
              </div>
              <div style="padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                <h3>Hello ${creator.firstName},</h3>
                <p>Your support ticket has been resolved.</p>
                
                <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #e0e0e0;">
                  <p><strong>Ticket Details:</strong></p>
                  <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
                  <p><strong>Title:</strong> ${ticket.title}</p>
                  <p><strong>Resolution:</strong> ${ticket.resolution?.summary || 'Issue resolved'}</p>
                  <p><strong>Resolved By:</strong> ${req.user.firstName} ${req.user.lastName}</p>
                  <p><strong>Resolved At:</strong> ${new Date(ticket.resolvedAt).toLocaleString()}</p>
                  ${ticket.actualResolutionTime ? `<p><strong>Resolution Time:</strong> ${Math.floor(ticket.actualResolutionTime / 60)} hours ${ticket.actualResolutionTime % 60} minutes</p>` : ''}
                </div>
                
                <div style="background: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #c8e6c9;">
                  <p><strong>📋 Next Steps:</strong></p>
                  <ul>
                    <li>The ticket will be closed after 7 days if no further action is required</li>
                    <li>You can reopen the ticket if the issue persists</li>
                    <li>Please rate your satisfaction with the resolution</li>
                  </ul>
                </div>
              </div>
            </div>
          `
        });
      }
    }
    
    // Save the ticket
    await ticket.save({ session });
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    // Populate for response
    await ticket.populate('createdBy', 'firstName lastName email role');
    await ticket.populate('assignedTo', 'firstName lastName email role');
    
    console.log(`✅ [TICKET UPDATED] ${ticket.ticketId} by ${req.user.email}`);
    
    res.json({
      success: true,
      message: 'Ticket updated successfully',
      data: ticket,
      changes: Object.keys(changes)
    });
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('❌ [UPDATE TICKET ERROR]', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        error: 'Ticket update validation failed',
        errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update ticket',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * @desc    Add comment to ticket
 * @route   POST /api/v2/tickets/:id/comments
 * @access  Private
 */
app.post('/api/v2/tickets/:id/comments', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;
    const { message, isInternal = false, attachments = [] } = req.body;
    
    // Validate message
    if (!message || message.trim().length === 0) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(400).json({
        success: false,
        error: 'Comment message is required',
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
    if (isInternal && !['technician', 'admin'].includes(userRole)) {
      await session.abortTransaction();
      session.endSession();
      
      return res.status(403).json({
        success: false,
        error: 'Only staff can add internal comments',
        code: 'PERMISSION_DENIED'
      });
    }
    
    // Add comment
    const commentData = {
      message: message.trim(),
      isInternal,
      attachments
    };
    
    const comment = await ticket.addComment(commentData, userId);
    
    // Update first response time if this is the first non-internal comment from staff
    if (!isInternal && !ticket.firstResponseAt && ['technician', 'admin'].includes(userRole)) {
      ticket.firstResponseAt = new Date();
      await ticket.save({ session });
    }
    
    // Send notifications
    const notifications = [];
    
    // Notify creator if commenter is not the creator
    if (ticket.createdBy.toString() !== userId.toString() && !isInternal) {
      const creator = await User.findById(ticket.createdBy).session(session);
      if (creator && creator.email) {
        notifications.push(
          sendEmail({
            to: creator.email,
            subject: `New Update on Your Ticket: ${ticket.ticketId}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1976d2; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h2>BUGEMA UNIVERSITY IT SUPPORT</h2>
                  <p>New Update on Your Ticket</p>
                </div>
                <div style="padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                  <h3>Hello ${creator.firstName},</h3>
                  <p>There's a new update on your support ticket.</p>
                  
                  <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #e0e0e0;">
                    <p><strong>Ticket Details:</strong></p>
                    <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
                    <p><strong>Title:</strong> ${ticket.title}</p>
                    <p><strong>Update From:</strong> ${req.user.firstName} ${req.user.lastName}</p>
                    <p><strong>Message:</strong> ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}</p>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket._id}" 
                       style="background: #1976d2; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                      View Ticket
                    </a>
                  </div>
                </div>
              </div>
            `
          })
        );
      }
    }
    
    // Notify assigned technician if exists and not the commenter
    if (ticket.assignedTo && ticket.assignedTo.toString() !== userId.toString()) {
      const technician = await User.findById(ticket.assignedTo).session(session);
      if (technician && technician.email) {
        notifications.push(
          sendEmail({
            to: technician.email,
            subject: `New Comment on Ticket: ${ticket.ticketId}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #f57c00; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h2>BUGEMA UNIVERSITY IT SUPPORT</h2>
                  <p>New Comment on Assigned Ticket</p>
                </div>
                <div style="padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                  <h3>Hello ${technician.firstName},</h3>
                  <p>A new comment has been added to your assigned ticket.</p>
                  
                  <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #e0e0e0;">
                    <p><strong>Ticket Details:</strong></p>
                    <p><strong>Ticket ID:</strong> ${ticket.ticketId}</p>
                    <p><strong>Title:</strong> ${ticket.title}</p>
                    <p><strong>Comment By:</strong> ${req.user.firstName} ${req.user.lastName}</p>
                    <p><strong>Message:</strong> ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}</p>
                    <p><strong>Internal:</strong> ${isInternal ? 'Yes' : 'No'}</p>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket._id}" 
                       style="background: #f57c00; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                      View Ticket
                    </a>
                  </div>
                </div>
              </div>
            `
          })
        );
      }
    }
    
    // Execute notifications
    await Promise.allSettled(notifications);
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    // Get populated comment for response
    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('comments.user', 'firstName lastName role');
    
    const newComment = populatedTicket.comments.find(c => 
      c._id.toString() === comment._id.toString()
    );
    
    console.log(`💬 [COMMENT ADDED] Ticket: ${ticket.ticketId}, User: ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        comment: newComment,
        ticketId: ticket.ticketId
      }
    });
    
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('❌ [ADD COMMENT ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add comment',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * @desc    Get ticket statistics for dashboard
 * @route   GET /api/v2/tickets/stats/dashboard
 * @access  Private
 */
app.get('/api/v2/tickets/stats/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    
    // Get ticket statistics
    const stats = await Ticket.getDashboardStats(userId, userRole);
    
    // Get user-specific stats
    const userStats = {
      myTickets: await Ticket.countDocuments({ createdBy: userId }),
      assignedTickets: await Ticket.countDocuments({ assignedTo: userId, status: { $ne: 'closed' } }),
      openTickets: await Ticket.countDocuments({ createdBy: userId, status: 'open' }),
      resolvedTickets: await Ticket.countDocuments({ createdBy: userId, status: 'resolved' })
    };
    
    // Get recent activity
    const recentTickets = await Ticket.find(
      userRole === 'student' ? { createdBy: userId } : {}
    )
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('createdBy', 'firstName lastName')
      .populate('assignedTo', 'firstName lastName')
      .select('ticketId title status priority updatedAt')
      .lean();
    
    res.json({
      success: true,
      data: {
        overview: stats,
        user: userStats,
        recentActivity: recentTickets,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ [DASHBOARD STATS ERROR]', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard statistics',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * @desc    Get ticket categories and metadata
 * @route   GET /api/v2/tickets/metadata
 * @access  Public
 */
app.get('/api/v2/tickets/metadata', (req, res) => {
  res.json({
    success: true,
    data: {
      categories: TICKET_CATEGORIES,
      priorities: TICKET_SLA,
      statuses: TICKET_STATUS,
      campuses: ['BU', 'MA', 'KA', 'AR', 'MB', 'OTHER'],
      subCategories: {
        network: ['internet', 'wifi', 'campus_network'],
        software: ['software_installation', 'software_license', 'virus_removal'],
        hardware: ['computer_repair', 'printer_issues', 'peripheral_devices'],
        account: ['password_reset', 'account_lockout', 'access_permissions'],
        email: ['email_setup', 'email_spam'],
        website: ['website_access', 'cms_issues', 'online_learning_platform'],
        other: ['general_inquiry', 'suggestion', 'complaint']
      }
    }
  });
});

/**
 * @desc    Search tickets with suggestions
 * @route   GET /api/v2/tickets/search/suggestions
 * @access  Private
 */
app.get('/api/v2/tickets/search/suggestions', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: [],
        message: 'Search query too short'
      });
    }
    
    const suggestions = await Ticket.find({
      $or: [
        { ticketId: { $regex: q, $options: 'i' } },
        { title: { $regex: q, $options: 'i' } }
      ]
    })
    .select('ticketId title status category priority')
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
 * @desc    Get user's ticket statistics
 * @route   GET /api/v2/tickets/stats/user
 * @access  Private
 */
app.get('/api/v2/tickets/stats/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    const stats = await Ticket.aggregate([
      { $match: { createdBy: userId } },
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byPriority: [
            { $group: { _id: '$priority', count: { $sum: 1 } } }
          ],
          byMonth: [
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 6 }
          ]
        }
      }
    ]);
    
    res.json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get ticket statistics'
    });
  }
});

/**
 * @desc    Get technician workload (admin only)
 * @route   GET /api/v2/tickets/analytics/workload
 * @access  Private/Admin
 */
app.get('/api/v2/tickets/analytics/workload', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }
    
    const workload = await Ticket.aggregate([
      {
        $match: {
          assignedTo: { $exists: true },
          status: { $nin: ['closed', 'resolved'] }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          openTickets: { $sum: 1 },
          highPriority: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
          },
          criticalTickets: {
            $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] }
          },
          avgAge: { $avg: { $subtract: [new Date(), '$createdAt'] } }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'technician'
        }
      },
      { $unwind: '$technician' },
      {
        $project: {
          technician: {
            _id: '$technician._id',
            name: { $concat: ['$technician.firstName', ' ', '$technician.lastName'] },
            email: '$technician.email',
            role: '$technician.role'
          },
          openTickets: 1,
          highPriority: 1,
          criticalTickets: 1,
          avgAge: { $divide: ['$avgAge', 1000 * 60 * 60] } // Convert to hours
        }
      }
    ]);
    
    res.json({
      success: true,
      data: workload
    });
  } catch (error) {
    console.error('Workload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get workload data'
    });
  }
});

// ============================================
// TICKET SYSTEM HEALTH ENDPOINT
// ============================================
app.get('/api/v2/ticket-system/health', authenticateToken, async (req, res) => {
  try {
    const ticketCount = await Ticket.countDocuments();
    const openTickets = await Ticket.countDocuments({ status: 'open' });
    const assignedTickets = await Ticket.countDocuments({ assignedTo: { $ne: null } });
    const overdueTickets = await Ticket.countDocuments({
      slaDueDate: { $lt: new Date() },
      status: { $nin: ['resolved', 'closed'] }
    });
    
    res.json({
      success: true,
      data: {
        system: 'Bugema University IT Support Ticket System',
        version: '2.0.0',
        status: 'operational',
        metrics: {
          totalTickets: ticketCount,
          openTickets,
          assignedTickets,
          overdueTickets,
          resolutionRate: ticketCount > 0 ? ((ticketCount - openTickets) / ticketCount) * 100 : 0
        },
        timestamp: new Date().toISOString(),
        supportContact: {
          email: 'support@bugemauniv.ac.ug',
          phone: '0784845785',
          hours: 'Mon-Fri: 8:00 AM - 5:00 PM'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get system health'
    });
  }
});

// ============================================
// USER MANAGEMENT
// ============================================

// Get all users (admin only)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    const users = await User.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('❌ [GET USERS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// UTILITY ENDPOINTS
// ============================================

// Get database status
app.get('/api/database/status', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    const userCount = await User.countDocuments();
    const ticketCount = await Ticket.countDocuments();
    const verifiedUserCount = await User.countDocuments({ isEmailVerified: true });
    
    res.json({
      success: true,
      database: mongoose.connection.name,
      host: mongoose.connection.host,
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      collections: collectionNames,
      counts: {
        users: userCount,
        verifiedUsers: verifiedUserCount,
        tickets: ticketCount
      },
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking database status'
    });
  }
});

// ============================================
// ERROR HANDLING
// ============================================
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  console.error('❌ [SERVER ERROR]:', err);
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ============================================
// START SERVER
// ============================================
const startServer = async () => {
  const dbConnected = await connectDB();
  
  const server = app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════════╗
║                                                                                ║
║   🚀 BUGEMA UNIVERSITY IT SUPPORT SYSTEM BACKEND v4.0.0                        ║
║   📍 Production Ready with Email Verification & Password Reset                 ║
║                                                                                ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   📡 Server URL: http://localhost:${PORT}                                         ║
║   ✅ Health Check: http://localhost:${PORT}/api/health                            ║
║   📊 DB Status: http://localhost:${PORT}/api/database/status                      ║
║                                                                                ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   🔐 AUTH ENDPOINTS:                                                           ║
║     • POST /api/auth/register      - Register with email verification          ║
║     • POST /api/auth/login         - Login with email verification check       ║
║     • GET  /api/auth/verify-email/:token - Verify email address               ║
║     • POST /api/auth/forgot-password - Request password reset                  ║
║     • POST /api/auth/reset-password/:token - Reset password                    ║
║     • POST /api/auth/resend-verification - Resend verification email           ║
║                                                                                ║
║   🎫 TICKET ENDPOINTS:                                                         ║
║     • POST /api/tickets            - Create ticket                             ║
║     • GET  /api/tickets            - Get tickets                               ║
║     • GET  /api/tickets/:id        - Get single ticket (NEWLY ADDED!)          ║
║     • PUT  /api/tickets/:id        - Update ticket                             ║
║                                                                                ║
╠════════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   💾 DATABASE: ${dbConnected ? '✅ CONNECTED' : '❌ DISCONNECTED'}                       ║
║   📧 EMAIL: ${emailTransporter ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}                  ║
║   🌍 ENVIRONMENT: ${process.env.NODE_ENV || 'development'}                               ║
║   📁 DB NAME: ${mongoose.connection.name || 'Not connected'}                             ║
║                                                                                ║
╚════════════════════════════════════════════════════════════════════════════════╝
    `);
    
    if (!dbConnected) {
      console.log('\n⚠️  WARNING: Running without database connection.');
    }
    
    if (!emailTransporter) {
      console.log('\n⚠️  WARNING: Email not configured.');
      console.log('💡 To enable email features, add to .env:');
      console.log('   SMTP_USER=your-email@gmail.com');
      console.log('   SMTP_PASS=your-app-password');
      console.log('   EMAIL_FROM_NAME=Bugema University IT Support');
      console.log('   EMAIL_FROM_ADDRESS=support@bugemauniv.ac.ug');
    } else {
      console.log('\n✅ Email service is ready!');
      console.log('✅ Users will receive verification emails after registration.');
      console.log('✅ Password reset functionality is enabled.');
    }
    
    console.log('\n🎯 Features Enabled:');
    console.log('   • Email verification (24-hour expiry)');
    console.log('   • Password reset (1-hour expiry)');
    console.log('   • Account lockout after 5 failed attempts');
    console.log('   • Department mapping and validation');
    console.log('   • Role-based permissions');
    console.log('   • Real email sending (if configured)');
    console.log('   • ✅ Single ticket endpoint now available at /api/tickets/:id');
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed');
      mongoose.connection.close();
      console.log('✅ Database connection closed');
      process.exit(0);
    });
  });
};

// Check for required environment variables
if (!process.env.JWT_SECRET) {
  console.warn('\n⚠️  WARNING: JWT_SECRET not set in environment variables.');
  console.warn('   Using default secret for development only.');
  console.warn('   For production, set JWT_SECRET in .env file.');
  console.warn('   Example: JWT_SECRET=your-super-secret-jwt-key-change-this');
}

if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
  console.warn('\n⚠️  WARNING: Email not configured.');
  console.warn('   Registration will work but verification emails will not be sent.');
  console.warn('   To enable email features, set SMTP_USER and SMTP_PASS in .env');
}

startServer();

module.exports = app;