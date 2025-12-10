/**
 * Bugema University IT Support System - PRODUCTION READY
 * REAL DATABASE SAVING WITH EMAIL VERIFICATION & PASSWORD RESET
 * 
 * @version 4.0.0
 * Production Date: ${new Date().toISOString()}
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5002;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
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
const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true
  },
  
  title: {
    type: String,
    required: true
  },
  
  description: {
    type: String,
    required: true
  },
  
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed', 'pending'],
    default: 'open'
  },
  
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  category: {
    type: String,
    enum: ['network', 'software', 'hardware', 'account', 'email', 'website', 'other'],
    default: 'other'
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  attachments: [String],
  
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  resolution: String,
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  resolvedAt: Date,
  
  dueDate: Date
});

// Auto-generate ticket ID
ticketSchema.pre('save', async function(next) {
  if (!this.ticketId) {
    const count = await this.constructor.countDocuments();
    this.ticketId = `TKT-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

const Ticket = mongoose.model('Ticket', ticketSchema);

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

// Get dashboard stats
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const stats = {
      totalTickets: await Ticket.countDocuments(),
      openTickets: await Ticket.countDocuments({ status: 'open' }),
      inProgressTickets: await Ticket.countDocuments({ status: 'in-progress' }),
      resolvedTickets: await Ticket.countDocuments({ status: 'resolved' }),
      highPriority: await Ticket.countDocuments({ priority: 'high' }),
      totalUsers: await User.countDocuments(),
      activeUsers: await User.countDocuments({ isActive: true }),
      verifiedUsers: await User.countDocuments({ isEmailVerified: true })
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ [STATS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// ============================================
// TICKET ENDPOINTS
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
app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const { status, priority, category, page = 1, limit = 10 } = req.query;
    
    const query = {};
    
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    
    if (req.user.role !== 'admin' && req.user.role !== 'technician') {
      query.createdBy = req.user._id;
    }

    const tickets = await Ticket.find(query)
      .populate('createdBy', 'username email firstName lastName role')
      .populate('assignedTo', 'username email firstName lastName role')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Ticket.countDocuments(query);

    res.json({
      success: true,
      data: tickets,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ [GET TICKETS] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching tickets'
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