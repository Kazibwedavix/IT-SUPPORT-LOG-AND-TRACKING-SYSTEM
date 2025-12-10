// backend/src/models/User.js
/**
 * BUGEMA UNIVERSITY IT SUPPORT SYSTEM
 * Enhanced User Model - Production Optimized
 * 
 * Contact: itsupport.bugemauniv.ac.ug | 0784845785
 * 
 * @version 3.1.0
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  // Authentication
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
  
  // Profile
  profile: {
    firstName: { type: String, trim: true, maxlength: 50 },
    lastName: { type: String, trim: true, maxlength: 50 },
    fullName: { type: String, trim: true, maxlength: 100 },
    avatar: { type: String, default: '', maxlength: 500 },
    bio: { type: String, maxlength: 500, default: '' },
    phone: {
      type: String,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^[\+]?[1-9][\d]{0,15}$/.test(v.replace(/\D/g, ''));
        },
        message: 'Please provide a valid phone number'
      }
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer-not-to-say'],
      default: 'prefer-not-to-say'
    },
    dateOfBirth: Date,
    nationality: { type: String, default: 'Ugandan' },
    address: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: 'Uganda' },
      postalCode: String
    }
  },
  
  // Academic Info (Students)
  academicInfo: {
    studentId: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true
    },
    department: {
      type: String,
      enum: ['computer_science', 'information_technology', 'software_engineering', 
             'business_administration', 'education', 'theology', 'engineering', 
             'medicine', 'nursing', 'law', 'arts_sciences', 'other']
    },
    program: {
      type: String,
      enum: ['BSC_COMPUTER_SCIENCE', 'BSC_INFORMATION_TECHNOLOGY', 
             'BSC_SOFTWARE_ENGINEERING', 'BSC_NETWORKING', 'BSC_CYBER_SECURITY',
             'BBA_BUSINESS_ADMINISTRATION', 'BA_EDUCATION', 'BA_THEOLOGY',
             'BSC_ENGINEERING', 'BSC_MEDICINE', 'BSC_NURSING', 'LLB_LAW', 'OTHER']
    },
    campus: {
      type: String,
      enum: ['BU', 'MA', 'KA', 'AR', 'MB', 'OTHER'],
      default: 'BU'
    },
    yearOfEntry: Number,
    currentYear: { type: Number, min: 1, max: 5 },
    semester: { type: Number, min: 1, max: 8 },
    academicStatus: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'graduated', 'withdrawn'],
      default: 'active'
    },
    expectedGraduation: Number,
    gpa: { type: Number, min: 0, max: 5.0 },
    hostel: {
      name: String,
      room: String,
      block: String
    }
  },
  
  // Professional Info (Staff/Technicians)
  professionalInfo: {
    employeeId: { type: String, unique: true, sparse: true, uppercase: true },
    jobTitle: {
      type: String,
      enum: ['LECTURER', 'SENIOR_LECTURER', 'ASSOCIATE_PROFESSOR', 'PROFESSOR',
             'IT_MANAGER', 'SYSTEM_ADMINISTRATOR', 'NETWORK_ADMINISTRATOR',
             'HELPDESK_SUPPORT', 'TECHNICAL_SUPPORT', 'SOFTWARE_DEVELOPER',
             'DATABASE_ADMINISTRATOR', 'SECURITY_ANALYST', 'IT_DIRECTOR',
             'IT_SUPPORT_SPECIALIST', 'NETWORK_ENGINEER', 'SYSTEMS_ENGINEER']
    },
    department: {
      type: String,
      enum: ['academic_affairs', 'administration', 'finance', 'human_resources',
             'information_technology', 'it_services', 'library', 'research',
             'student_affairs', 'facilities_management', 'security']
    },
    officeNumber: String,
    officePhone: String,
    officeLocation: {
      building: String,
      floor: String,
      campus: { type: String, enum: ['BU', 'MA', 'KA', 'AR', 'MB', 'OTHER'], default: 'BU' }
    },
    employmentDate: Date,
    employmentType: {
      type: String,
      enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY']
    },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    supportAreas: [{
      type: String,
      enum: ['Hardware', 'Software', 'Network', 'Email', 'Account Access',
             'Printer', 'Phone', 'Server', 'Database', 'Security', 'Other']
    }],
    maxConcurrentTickets: { type: Number, default: 10, min: 1, max: 50 },
    availabilityStatus: {
      type: String,
      enum: ['available', 'busy', 'away', 'offline'],
      default: 'available'
    }
  },
  
  // Role & Permissions
  role: {
    type: String,
    enum: ['student', 'staff', 'technician', 'admin'],
    default: 'student',
    required: true,
    index: true
  },
  
  permissions: {
    type: [String],
    default: function() {
      const rolePermissions = {
        admin: ['create_ticket', 'view_tickets', 'update_tickets', 'delete_tickets',
                'assign_tickets', 'resolve_tickets', 'reopen_tickets', 'escalate_tickets',
                'view_users', 'manage_users', 'deactivate_users', 'view_reports',
                'generate_reports', 'export_data', 'manage_knowledge_base',
                'view_analytics', 'system_settings', 'manage_sla', 'view_audit_logs'],
        technician: ['create_ticket', 'view_tickets', 'update_tickets', 'assign_tickets',
                     'resolve_tickets', 'reopen_tickets', 'escalate_tickets',
                     'manage_knowledge_base', 'view_reports'],
        staff: ['create_ticket', 'view_tickets', 'update_tickets'],
        student: ['create_ticket', 'view_tickets']
      };
      return rolePermissions[this.role] || rolePermissions.student;
    }
  },
  
  // Account Status
  isEmailVerified: { type: Boolean, default: false, index: true },
  isActive: { type: Boolean, default: true, index: true },
  isLocked: { type: Boolean, default: false },
  verifiedAt: Date,
  activatedAt: { type: Date, default: Date.now },
  deactivatedAt: Date,
  deactivationReason: {
    type: String,
    enum: ['voluntary', 'inactivity', 'violation', 'graduation', 'termination', 'other']
  },
  
  // Security
  loginAttempts: { type: Number, default: 0, select: false },
  lockUntil: { type: Date, select: false },
  passwordChangedAt: { type: Date, select: false },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  emailVerificationToken: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },
  lastPasswordResetAt: { type: Date, select: false },
  
  // Activity
  lastLogin: { type: Date, index: true },
  lastActivity: { type: Date, index: true },
  
  // Statistics (Technicians)
  statistics: {
    ticketsCreated: { type: Number, default: 0 },
    ticketsAssigned: { type: Number, default: 0 },
    ticketsResolved: { type: Number, default: 0 },
    averageResolutionTime: { type: Number, default: 0 },
    satisfactionRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // Preferences
  preferences: {
    notifications: {
      email: {
        ticketUpdates: { type: Boolean, default: true },
        announcements: { type: Boolean, default: true },
        securityAlerts: { type: Boolean, default: true }
      }
    },
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'Africa/Kampala' }
  },
  
  // Audit
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedAt: Date
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  }
});

// Virtuals
userSchema.virtual('displayName').get(function() {
  if (this.profile?.fullName) return this.profile.fullName;
  if (this.profile?.firstName && this.profile?.lastName) {
    return `${this.profile.firstName} ${this.profile.lastName}`;
  }
  return this.username;
});

userSchema.virtual('isStudent').get(function() {
  return this.role === 'student';
});

userSchema.virtual('isTechnician').get(function() {
  return this.role === 'technician' || this.role === 'admin';
});

// Middleware
userSchema.pre('save', async function(next) {
  if (this.profile?.firstName && this.profile?.lastName && !this.profile?.fullName) {
    this.profile.fullName = `${this.profile.firstName} ${this.profile.lastName}`.trim();
  }
  
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = this.isNew ? Date.now() - 1000 : Date.now();
    next();
  } catch (error) {
    next(error);
  }
});

// Instance Methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  return verificationToken;
};

userSchema.methods.hasPermission = function(permission) {
  return this.permissions && this.permissions.includes(permission);
};

userSchema.methods.canAcceptTicket = function() {
  if (this.role !== 'technician') return false;
  if (this.professionalInfo?.availabilityStatus !== 'available') return false;
  const currentLoad = this.statistics?.ticketsAssigned || 0;
  const maxLoad = this.professionalInfo?.maxConcurrentTickets || 10;
  return currentLoad < maxLoad;
};

// Static Methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

userSchema.statics.getAvailableTechnicians = function(category) {
  const query = {
    role: 'technician',
    isActive: true,
    'professionalInfo.availabilityStatus': 'available'
  };
  
  if (category) {
    query['professionalInfo.supportAreas'] = category;
  }
  
  return this.find(query)
    .select('profile professionalInfo statistics')
    .sort({ 'statistics.ticketsAssigned': 1 });
};

const User = mongoose.model('User', userSchema);
module.exports = User;