// backend/src/models/User.js
/**
 * User Model - Enterprise Grade
 * 
 * Comprehensive user schema for Bugema University IT Support System
 * 
 * Features:
 * - Complete user profile management
 * - Role-based access control (RBAC)
 * - Academic information for students
 * - Professional information for staff/technicians
 * - Security fields and audit trail
 * - Email and phone validation
 * - Password management with security features
 * - Account status tracking
 * - Metadata for analytics
 * - Indexes for performance optimization
 * 
 * @version 3.0.1
 * @author Bugema University IT Department
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const crypto = require('crypto');

/**
 * User Schema for Bugema University IT Support System
 */
const userSchema = new mongoose.Schema({
  // ====================
  // AUTHENTICATION FIELDS
  // ====================
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [50, 'Username cannot exceed 50 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    index: true
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: validator.isEmail,
      message: 'Please provide a valid email address'
    },
    index: true
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  
  // ====================
  // PROFILE INFORMATION
  // ====================
  profile: {
    firstName: {
      type: String,
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    
    fullName: {
      type: String,
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters']
    },
    
    avatar: {
      type: String,
      default: '',
      maxlength: [500, 'Avatar URL cannot exceed 500 characters']
    },
    
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      default: ''
    },
    
    phone: {
      type: String,
      validate: {
        validator: function(v) {
          if (!v) return true; // Allow empty
          const cleaned = v.replace(/\D/g, '');
          return /^[\+]?[1-9][\d]{0,15}$/.test(cleaned);
        },
        message: 'Please provide a valid phone number'
      }
    },
    
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer-not-to-say'],
      default: 'prefer-not-to-say'
    },
    
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function(v) {
          if (!v) return true;
          const age = new Date().getFullYear() - v.getFullYear();
          return age >= 16 && age <= 100;
        },
        message: 'User must be between 16 and 100 years old'
      }
    },
    
    nationality: {
      type: String,
      default: 'Ugandan'
    },
    
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    }
  },
  
  // ====================
  // ACADEMIC INFORMATION (For Students)
  // ====================
  academicInfo: {
    studentId: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v) return true; // Allow empty for non-students
          
          // Bugema University student ID format validation
          const patterns = [
            /^[0-9]{2}\/[A-Z]{3,5}\/[A-Z]{2}\/[A-Z]\/[0-9]{3,5}$/, // Format: 22/BIT/BU/R/0010
            /^[A-Z0-9\/\-_]{6,20}$/ // General pattern
          ];
          
          return patterns.some(pattern => pattern.test(v));
        },
        message: 'Student ID must follow format: YY/DEPT/CAMPUS/LEVEL/NUMBER (e.g., 22/BIT/BU/R/0010)'
      }
    },
    
    department: {
      type: String,
      enum: [
        'computer_science',
        'engineering',
        'business',
        'arts_sciences',
        'medicine',
        'law',
        'education',
        'it_services',
        'administration',
        'facilities',
        'library',
        'student_services',
        'research',
        'other'
      ]
    },
    
    program: {
      type: String,
      enum: [
        'BSC_COMPUTER_SCIENCE',
        'BSC_INFORMATION_TECHNOLOGY', 
        'BSC_SOFTWARE_ENGINEERING',
        'BSC_NETWORKING',
        'BSC_CYBER_SECURITY',
        'BBA_BUSINESS_ADMINISTRATION',
        'BA_EDUCATION',
        'BA_THEOLOGY',
        'BSC_ENGINEERING',
        'BSC_MEDICINE'
      ]
    },
    
    campus: {
      type: String,
      enum: ['BU', 'MA', 'KA', 'AR', 'MB', 'OTHER'],
      default: 'BU'
    },
    
    yearOfEntry: {
      type: Number,
      min: 2000,
      max: new Date().getFullYear()
    },
    
    currentYear: {
      type: Number,
      min: 1,
      max: 5
    },
    
    semester: {
      type: Number,
      min: 1,
      max: 8
    },
    
    academicStatus: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'graduated', 'withdrawn'],
      default: 'active'
    },
    
    expectedGraduation: {
      type: Number
    },
    
    gpa: {
      type: Number,
      min: 0,
      max: 5.0
    }
  },
  
  // ====================
  // PROFESSIONAL INFORMATION (For Staff/Technicians)
  // ====================
  professionalInfo: {
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true
    },
    
    jobTitle: {
      type: String,
      enum: [
        'LECTURER', 'SENIOR_LECTURER', 'ASSOCIATE_PROFESSOR', 'PROFESSOR',
        'IT_MANAGER', 'SYSTEM_ADMINISTRATOR', 'NETWORK_ADMINISTRATOR',
        'HELPDESK_SUPPORT', 'TECHNICAL_SUPPORT', 'SOFTWARE_DEVELOPER',
        'DATABASE_ADMINISTRATOR', 'SECURITY_ANALYST', 'IT_DIRECTOR'
      ]
    },
    
    department: {
      type: String,
      enum: [
        'academic_affairs',
        'administration',
        'finance',
        'human_resources',
        'information_technology',
        'it_services',
        'library',
        'research',
        'student_affairs'
      ]
    },
    
    officeNumber: {
      type: String
    },
    
    officePhone: {
      type: String
    },
    
    employmentDate: {
      type: Date
    },
    
    employmentType: {
      type: String,
      enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY']
    },
    
    supervisor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // ====================
  // ROLE AND PERMISSIONS
  // ====================
  role: {
    type: String,
    enum: ['student', 'staff', 'technician', 'admin'],
    default: 'student',
    required: true,
    index: true
  },
  
  permissions: {
    type: [String],
    enum: [
      'create_ticket', 'view_tickets', 'update_tickets', 'delete_tickets',
      'assign_tickets', 'resolve_tickets', 'reopen_tickets',
      'view_users', 'manage_users', 'deactivate_users',
      'view_reports', 'generate_reports', 'export_data',
      'manage_knowledge_base', 'view_analytics', 'system_settings'
    ],
    default: function() {
      if (this.role === 'admin') {
        return [
          'create_ticket', 'view_tickets', 'update_tickets', 'delete_tickets',
          'assign_tickets', 'resolve_tickets', 'reopen_tickets',
          'view_users', 'manage_users', 'deactivate_users',
          'view_reports', 'generate_reports', 'export_data',
          'manage_knowledge_base', 'view_analytics', 'system_settings'
        ];
      } else if (this.role === 'technician') {
        return [
          'create_ticket', 'view_tickets', 'update_tickets',
          'assign_tickets', 'resolve_tickets', 'reopen_tickets',
          'manage_knowledge_base'
        ];
      } else if (this.role === 'staff') {
        return ['create_ticket', 'view_tickets', 'update_tickets'];
      } else {
        return ['create_ticket', 'view_tickets'];
      }
    }
  },
  
  // ====================
  // ACCOUNT STATUS
  // ====================
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
  
  activatedAt: {
    type: Date,
    default: Date.now
  },
  
  deactivatedAt: {
    type: Date
  },
  
  deactivationReason: {
    type: String,
    enum: ['voluntary', 'inactivity', 'violation', 'other']
  },
  
  // ====================
  // SECURITY FIELDS
  // ====================
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
  
  // ====================
  // SESSION AND ACTIVITY
  // ====================
  lastLogin: {
    type: Date
  },
  
  lastActivity: {
    type: Date
  },
  
  currentSessions: [{
    sessionId: String,
    ipAddress: String,
    userAgent: String,
    deviceType: String,
    loginAt: Date,
    lastActiveAt: Date,
    expiresAt: Date
  }],
  
  loginHistory: [{
    ipAddress: String,
    userAgent: String,
    deviceType: String,
    location: String,
    loginAt: Date,
    logoutAt: Date,
    status: String
  }],
  
  // ====================
  // PREFERENCES
  // ====================
  preferences: {
    notifications: {
      email: {
        ticketUpdates: { type: Boolean, default: true },
        announcements: { type: Boolean, default: true },
        securityAlerts: { type: Boolean, default: true }
      },
      push: {
        ticketUpdates: { type: Boolean, default: true },
        announcements: { type: Boolean, default: false }
      },
      sms: {
        urgentTickets: { type: Boolean, default: false }
      }
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    language: {
      type: String,
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'Africa/Kampala'
    },
    ticketView: {
      type: String,
      enum: ['list', 'grid', 'table'],
      default: 'table'
    }
  },
  
  // ====================
  // AUDIT AND METADATA
  // ====================
  metadata: {
    registrationSource: {
      type: String,
      enum: ['web', 'mobile', 'api', 'admin'],
      default: 'web'
    },
    registrationIP: String,
    registrationUserAgent: String,
    registrationReferrer: String,
    lastVerificationEmailSent: Date,
    lastPasswordResetRequest: Date,
    deviceFingerprint: String,
    termsAcceptedAt: Date,
    termsVersion: String,
    marketingConsent: {
      type: Boolean,
      default: false
    }
  },
  
  // ====================
  // AUDIT TRAIL
  // ====================
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove sensitive fields
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.emailVerificationToken;
      delete ret.emailVerificationExpires;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.emailVerificationToken;
      delete ret.emailVerificationExpires;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      delete ret.__v;
      return ret;
    }
  }
});

// ====================
// VIRTUAL PROPERTIES
// ====================
userSchema.virtual('displayName').get(function() {
  if (this.profile?.fullName) {
    return this.profile.fullName;
  }
  if (this.profile?.firstName && this.profile?.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.username;
});

userSchema.virtual('emailType').get(function() {
  const universityDomains = [
    'bugemauniv.ac.ug',
    'students.bugemauniv.ac.ug',
    'staff.bugemauniv.ac.ug',
    'bugema.ac.ug'
  ];
  
  const isUniversityEmail = universityDomains.some(domain => 
    this.email.toLowerCase().endsWith(domain.toLowerCase())
  );
  
  return isUniversityEmail ? 'university' : 'personal';
});

userSchema.virtual('isStaffOrAdmin').get(function() {
  return ['staff', 'technician', 'admin'].includes(this.role);
});

userSchema.virtual('isStudent').get(function() {
  return this.role === 'student';
});

userSchema.virtual('accountAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// ====================
// INDEXES FOR PERFORMANCE
// ====================
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'academicInfo.studentId': 1 });
userSchema.index({ 'professionalInfo.employeeId': 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isEmailVerified: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ 'profile.fullName': 'text' });
userSchema.index({ 'academicInfo.department': 1 });
userSchema.index({ 'academicInfo.campus': 1 });
userSchema.index({ 'preferences.language': 1 });

// Compound indexes
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ role: 1, 'academicInfo.campus': 1 });
userSchema.index({ isActive: 1, isEmailVerified: 1 });

// ====================
// MIDDLEWARE
// ====================
userSchema.pre('save', async function(next) {
  // Generate full name from first and last name
  if (this.profile?.firstName && this.profile?.lastName && !this.profile?.fullName) {
    this.profile.fullName = `${this.profile.firstName} ${this.profile.lastName}`.trim();
  }
  
  // Hash password if modified
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    // Update password changed timestamp (for new users, set slightly in past)
    if (this.isNew) {
      this.passwordChangedAt = Date.now() - 1000;
    } else {
      this.passwordChangedAt = Date.now();
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.pre('save', function(next) {
  // Format student ID to uppercase
  if (this.academicInfo?.studentId) {
    this.academicInfo.studentId = this.academicInfo.studentId.toUpperCase().trim();
  }
  
  // Format employee ID to uppercase
  if (this.professionalInfo?.employeeId) {
    this.professionalInfo.employeeId = this.professionalInfo.employeeId.toUpperCase().trim();
  }
  
  // Set activation date for new users
  if (this.isNew && this.isActive && !this.activatedAt) {
    this.activatedAt = new Date();
  }
  
  next();
});

// ====================
// INSTANCE METHODS
// ====================
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  this.lastPasswordResetAt = new Date();
  
  return resetToken;
};

userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

userSchema.methods.incrementLoginAttempts = function() {
  this.loginAttempts += 1;
  
  // Lock account after 5 failed attempts for 15 minutes
  if (this.loginAttempts >= 5) {
    this.lockUntil = Date.now() + 15 * 60 * 1000;
    this.isLocked = true;
  }
  
  return this.save();
};

userSchema.methods.resetLoginAttempts = function() {
  this.loginAttempts = 0;
  this.lockUntil = null;
  this.isLocked = false;
  this.lastLogin = new Date();
  return this.save();
};

userSchema.methods.addSession = function(sessionData) {
  if (!this.currentSessions) {
    this.currentSessions = [];
  }
  
  this.currentSessions.push({
    sessionId: sessionData.sessionId || crypto.randomUUID(),
    ipAddress: sessionData.ipAddress,
    userAgent: sessionData.userAgent,
    deviceType: this.getDeviceType(sessionData.userAgent),
    loginAt: new Date(),
    lastActiveAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  });
  
  return this.save();
};

userSchema.methods.removeSession = function(sessionId) {
  if (this.currentSessions) {
    this.currentSessions = this.currentSessions.filter(session => session.sessionId !== sessionId);
  }
  return this.save();
};

userSchema.methods.getDeviceType = function(userAgent) {
  if (!userAgent) return 'unknown';
  
  if (/mobile/i.test(userAgent)) return 'mobile';
  if (/tablet/i.test(userAgent)) return 'tablet';
  if (/tv/i.test(userAgent)) return 'tv';
  if (/bot|crawler|spider/i.test(userAgent)) return 'bot';
  
  return 'desktop';
};

userSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission);
};

userSchema.methods.deactivateAccount = function(reason = 'voluntary') {
  this.isActive = false;
  this.deactivatedAt = new Date();
  this.deactivationReason = reason;
  
  // Clear all active sessions
  this.currentSessions = [];
  
  return this.save();
};

userSchema.methods.reactivateAccount = function() {
  this.isActive = true;
  this.deactivatedAt = null;
  this.deactivationReason = null;
  this.activatedAt = new Date();
  
  return this.save();
};

userSchema.methods.verifyEmail = function() {
  this.isEmailVerified = true;
  this.verifiedAt = new Date();
  // this.emailVerificationToken = undefined;
  // this.emailVerificationExpires = undefined;
  
  return this.save();
};

// ====================
// STATIC METHODS
// ====================
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

userSchema.statics.findByStudentId = function(studentId) {
  return this.findOne({ 'academicInfo.studentId': studentId.toUpperCase().trim() });
};

userSchema.statics.findByEmployeeId = function(employeeId) {
  return this.findOne({ 'professionalInfo.employeeId': employeeId.toUpperCase().trim() });
};

userSchema.statics.getUsersByRole = function(role, options = {}) {
  const query = { role };
  
  if (options.activeOnly) {
    query.isActive = true;
  }
  
  if (options.verifiedOnly) {
    query.isEmailVerified = true;
  }
  
  return this.find(query);
};

userSchema.statics.getStatistics = async function() {
  const totalUsers = await this.countDocuments();
  const activeUsers = await this.countDocuments({ isActive: true });
  const verifiedUsers = await this.countDocuments({ isEmailVerified: true });
  
  const usersByRole = await this.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]);
  
  const usersByCampus = await this.aggregate([
    { $group: { _id: '$academicInfo.campus', count: { $sum: 1 } } }
  ]);
  
  const recentRegistrations = await this.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } },
    { $limit: 30 }
  ]);
  
  return {
    totalUsers,
    activeUsers,
    verifiedUsers,
    usersByRole,
    usersByCampus,
    recentRegistrations,
    summary: {
      activePercentage: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0,
      verifiedPercentage: totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(2) : 0
    }
  };
};

// ====================
// QUERY HELPERS
// ====================
userSchema.query.active = function() {
  return this.where({ isActive: true });
};

userSchema.query.verified = function() {
  return this.where({ isEmailVerified: true });
};

userSchema.query.byRole = function(role) {
  return this.where({ role });
};

userSchema.query.byCampus = function(campus) {
  return this.where({ 'academicInfo.campus': campus });
};

userSchema.query.byDepartment = function(department) {
  return this.where({ 'academicInfo.department': department });
};

// ====================
// CREATE USER MODEL
// ====================
const User = mongoose.model('User', userSchema);

module.exports = User;