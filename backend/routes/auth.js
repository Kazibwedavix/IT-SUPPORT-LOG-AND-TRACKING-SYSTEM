/**
 * Authentication Routes
 * 
 * @version 1.0.0
 * @author Bugema University IT Support System
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const tokenService = require('../services/tokenService');
const emailService = require('../services/emailService');
const auditService = require('../services/auditService');
const { auth } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// ============================================================================
// VALIDATION RULES
// ============================================================================

const registrationValidation = [
  // Name fields - now flexible
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  
  // Email validation
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  // Password validation
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  
  // Student ID validation (Bugema format)
  body('studentId')
    .optional()
    .matches(/^[0-9]{2}\/[A-Z]{3}\/[A-Z]{2}\/[A-Z]\/[0-9]{4}$|^[A-Z0-9\/\-_]{6,20}$/)
    .withMessage('Student ID format: YY/DEPT/CAMPUS/LEVEL/NUMBER (e.g., 22/BIT/BU/R/0010)'),
  
  // Department validation
  body('department')
    .optional()
    .isIn(['computer_science', 'engineering', 'business', 'arts_sciences', 
           'medicine', 'law', 'education', 'it_services', 'administration', 
           'facilities', 'library', 'student_services', 'research', 'other'])
    .withMessage('Please select a valid department'),
  
  // Role validation
  body('role')
    .optional()
    .isIn(['student', 'staff', 'technician', 'admin'])
    .withMessage('Invalid role'),
  
  // Phone validation
  body('phone')
    .optional()
    .matches(/^[\+]?[1-9][\d]{0,15}$/)
    .withMessage('Please provide a valid phone number')
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize name fields from request body
 * Ensures we have firstName, lastName, and fullName
 */
const normalizeNameFields = (body) => {
  let { firstName, lastName, fullName } = body;

  // If fullName is missing but we have firstName and lastName
  if ((!fullName || fullName.trim() === '') && firstName && lastName) {
    fullName = `${firstName} ${lastName}`.trim();
  }
  
  // If firstName/lastName are missing but we have fullName
  if (fullName && (!firstName || !lastName)) {
    const nameParts = fullName.trim().split(/\s+/);
    firstName = firstName || nameParts[0] || '';
    lastName = lastName || nameParts.slice(1).join(' ') || 'User';
  }

  // Ensure we have at least something
  if (!firstName && !lastName && !fullName) {
    throw new Error('At least firstName and lastName, or fullName is required');
  }

  return {
    firstName: firstName?.trim() || '',
    lastName: lastName?.trim() || '',
    fullName: fullName?.trim() || `${firstName || ''} ${lastName || ''}`.trim()
  };
};

/**
 * Generate unique username from email
 */
const generateUsername = async (email) => {
  let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Ensure username is not empty
  if (!username) {
    username = 'user' + Date.now().toString().slice(-6);
  }

  // Check if username already exists
  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    // Add random number if username exists
    username = username + Math.floor(Math.random() * 1000);
  }

  return username;
};

/**
 * Map frontend department values to User model enum values
 * Frontend sends: lowercase_with_underscores
 * User model expects: UPPERCASE_WITH_UNDERSCORES (for professionalInfo)
 */
const mapDepartmentToEnum = (department, role) => {
  // For students, use lowercase values (academicInfo.department)
  if (role === 'student') {
    return department || 'computer_science';
  }
  
  // For staff/technicians/admins, map to uppercase enum values (professionalInfo.department)
  const departmentMap = {
    'computer_science': 'INFORMATION_TECHNOLOGY',
    'engineering': 'ACADEMIC_AFFAIRS',
    'business': 'FINANCE',
    'arts_sciences': 'ACADEMIC_AFFAIRS',
    'medicine': 'ACADEMIC_AFFAIRS',
    'law': 'ACADEMIC_AFFAIRS',
    'education': 'ACADEMIC_AFFAIRS',
    'it_services': 'IT_SERVICES',
    'administration': 'ADMINISTRATION',
    'facilities': 'ADMINISTRATION',
    'library': 'LIBRARY',
    'student_services': 'STUDENT_AFFAIRS',
    'research': 'RESEARCH',
    'other': 'ADMINISTRATION'
  };
  
  return departmentMap[department] || 'ADMINISTRATION';
};

// ============================================================================
// REGISTRATION ENDPOINT
// ============================================================================

/**
 * @route   POST /api/auth/register
 * @desc    Register new user 
 * @access  Public
 */
router.post('/register', registrationValidation, async (req, res) => {
  try {
    // Normalize name fields BEFORE validation check
    try {
      const names = normalizeNameFields(req.body);
      req.body.firstName = names.firstName;
      req.body.lastName = names.lastName;
      req.body.fullName = names.fullName;
    } catch (nameError) {
      return res.status(400).json({
        success: false,
        message: nameError.message,
        code: 'INVALID_NAME_FIELDS'
      });
    }

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      console.log('📨 Received data:', {
        email: req.body.email,
        role: req.body.role,
        hasFirstName: !!req.body.firstName,
        hasLastName: !!req.body.lastName,
        hasFullName: !!req.body.fullName
      });
      
      return res.status(400).json({ 
        success: false, 
        message: 'Please fix the form errors',
        errors: errors.array(),
        code: 'VALIDATION_ERROR'
      });
    }

    const {
      firstName,
      lastName,
      fullName,
      email,
      password,
      studentId,
      department,
      role = 'student',
      phone,
      campus,
      yearOfEntry,
      semester,
      employeeId
    } = req.body;

    console.log('📝 Registration attempt:', { 
      email, 
      role, 
      fullName,
      department: department || 'Not specified',
      timestamp: new Date().toISOString()
    });

    // Check if user already exists
    const existingUser = await User.findOne({ 
      email: email.toLowerCase().trim() 
    });

    if (existingUser) {
      console.log('❌ User already exists:', email);
      return res.status(409).json({ 
        success: false, 
        message: 'An account with this email already exists',
        code: 'USER_EXISTS'
      });
    }

    // Generate unique username
    const username = await generateUsername(email);

    // Build user data object
    const userData = {
      username,
      email: email.toLowerCase().trim(),
      password,
      role: ['student', 'staff', 'technician', 'admin'].includes(role) ? role : 'student',

      // Profile information (required for all users)
      profile: {
        firstName,
        lastName,
        fullName,
        phone: phone ? phone.replace(/\D/g, '') : undefined
      },

      // Academic information (only for students)
      ...(role === 'student' && {
        academicInfo: {
          studentId: studentId ? studentId.toUpperCase().trim() : undefined,
          department: department || 'computer_science',
          campus: campus || 'BU',
          yearOfEntry: yearOfEntry ? parseInt(yearOfEntry) : new Date().getFullYear(),
          semester: semester ? parseInt(semester) : 1,
          academicStatus: 'active'
        }
      }),

      // Professional information (for staff/technicians/admins)
      ...((role === 'staff' || role === 'technician' || role === 'admin') && {
        professionalInfo: {
          department: department || 'administration',
          employeeId: employeeId ? employeeId.toUpperCase().trim() : undefined
        }
      }),

      // Account status
      isEmailVerified: false,
      isActive: true,

      // Metadata
      metadata: {
        registrationSource: 'web',
        registrationIP: req.ip || req.connection.remoteAddress,
        registrationUserAgent: req.get('User-Agent'),
        termsAcceptedAt: new Date(),
        termsVersion: '1.0'
      }
    };

    console.log('✅ Creating user:', {
      email: userData.email,
      username: userData.username,
      role: userData.role,
      fullName: userData.profile.fullName
    });

    // Create and save user
    const user = new User(userData);
    await user.save();
    
    console.log('✅ User saved to database with ID:', user._id);

    // Generate verification token
    const verificationToken = tokenService.generateEmailVerificationToken(user._id);
    user.emailVerificationToken = verificationToken.hashedToken;
    user.emailVerificationExpires = verificationToken.expires;
    await user.save();

    // Generate JWT tokens
    const tokens = tokenService.generateTokens({
      userId: user._id,
      email: user.email,
      role: user.role
    });

    // Store refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    // Send verification email (non-blocking)
    const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email/${verificationToken.token}`;
    try {
      await emailService.sendVerificationEmail(user.email, user.username, verificationUrl);
      console.log('✅ Verification email sent to:', user.email);
    } catch (emailError) {
      console.error('❌ Failed to send verification email:', emailError.message);
    }

    // Set secure cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    res.cookie('accessToken', tokens.accessToken, cookieOptions);
    res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

    // Log audit event
    auditService.logUserActivity(user._id, 'REGISTER', 'USER', {
      username: user.username,
      email: user.email,
      role: user.role
    });

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.profile?.firstName,
          lastName: user.profile?.lastName,
          fullName: user.profile?.fullName,
          department: department,
          studentId: user.academicInfo?.studentId,
          isEmailVerified: user.isEmailVerified,
          isActive: user.isActive,
          status: user.status
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      email: req.body.email
    });

    // Handle specific errors
    let statusCode = 500;
    let message = 'Registration failed. Please try again.';
    let code = 'REGISTRATION_FAILED';

    if (error.name === 'ValidationError') {
      statusCode = 400;
      message = 'Invalid user data';
      code = 'USER_VALIDATION_ERROR';
    } else if (error.code === 11000) {
      statusCode = 409;
      const field = Object.keys(error.keyPattern)[0];
      message = `${field} already exists`;
      code = 'DUPLICATE_USER';
      console.log(`❌ Duplicate ${field}:`, error.keyValue[field]);
    }

    // Log audit event for failure
    if (auditService && auditService.logSystemEvent) {
      auditService.logSystemEvent('REGISTRATION_ERROR', {
        error: error.message,
        email: req.body.email,
        code: error.code
      });
    }

    res.status(statusCode).json({ 
      success: false, 
      message,
      code,
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.message
      })
    });
  }
});

// ============================================================================
// LOGIN ENDPOINT
// ============================================================================

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', authLimiter, [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    // Find user
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      auditService.logAuthAttempt(email, false, 'USER_NOT_FOUND', ip);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      auditService.logAuthAttempt(email, false, 'ACCOUNT_INACTIVE', ip);
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact support.'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      auditService.logAuthAttempt(email, false, 'INVALID_PASSWORD', ip);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Generate tokens
    const tokens = tokenService.generateTokens({
      userId: user._id,
      email: user.email,
      role: user.role
    });

    // Update refresh token
    user.refreshToken = tokens.refreshToken;
    user.lastLogin = new Date();
    await user.save();

    // Set cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    };

    res.cookie('accessToken', tokens.accessToken, cookieOptions);
    res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

    // Log successful login
    auditService.logAuthAttempt(email, true, null, ip);
    auditService.logUserActivity(user._id, 'LOGIN', 'AUTH', { ip });

    // Return response
   res.json({
  success: true,
  message: 'Login successful',
  data: {
    user: {
      _id: user._id,           
      id: user._id,            
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.profile?.firstName,
      lastName: user.profile?.lastName,
      fullName: user.profile?.fullName,
      department: user.academicInfo?.department || user.professionalInfo?.department,
      isEmailVerified: user.isEmailVerified,  
      isActive: user.isActive,
      status: user.status
    },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: 15 * 60 * 1000
  }
});

  } catch (error) {
    console.error('Login error:', error);
    auditService.logSystemEvent('LOGIN_ERROR', {
      error: error.message,
      email: req.body.email
    });
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

// ============================================================================
// LOGOUT ENDPOINT
// ============================================================================

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Clear refresh token from database
    await User.findByIdAndUpdate(userId, { 
      $unset: { refreshToken: 1 } 
    });

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    // Log logout event
    auditService.logUserActivity(userId, 'LOGOUT', 'AUTH');

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during logout' 
    });
  }
});

// ============================================================================
// TOKEN REFRESH ENDPOINT
// ============================================================================

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ 
        success: false, 
        message: 'Refresh token required' 
      });
    }

    // Verify refresh token
    const decoded = tokenService.verifyRefreshToken(refreshToken);
    
    // Find user with this refresh token
    const user = await User.findOne({ 
      _id: decoded.userId, 
      refreshToken 
    });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid refresh token' 
      });
    }

    // Generate new tokens
    const tokens = tokenService.generateTokens({
      userId: user._id,
      email: user.email,
      role: user.role
    });

    // Update refresh token in database
    user.refreshToken = tokens.refreshToken;
    await user.save();

    // Set new cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    };

    res.cookie('accessToken', tokens.accessToken, cookieOptions);
    res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

    // Log token refresh
    auditService.logUserActivity(user._id, 'TOKEN_REFRESH', 'AUTH');

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 15 * 60 * 1000
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired refresh token' 
    });
  }
});
// ============================================================================
// EMAIL VERIFICATION ENDPOINT
// ============================================================================

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify email address
 * @access  Public
 */
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    console.log('🔍 Email verification attempt:', {
      tokenLength: token?.length,
      tokenPreview: token?.substring(0, 10) + '...',
      timestamp: new Date().toISOString()
    });

    // Hash the token
    const crypto = require('crypto');
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    console.log('🔍 Hashed token:', hashedToken.substring(0, 10) + '...');

    // Use findOneAndUpdate for atomic operation - prevents race conditions
    const user = await User.findOneAndUpdate(
      {
        emailVerificationToken: hashedToken,
        isEmailVerified: false // Only update if not already verified
      },
      {
        $set: {
          isEmailVerified: true,
          isActive: true,
          verifiedAt: new Date()
        }
        // DON'T unset the token - keep it for audit trail
      },
      {
        new: true, // Return updated document
        runValidators: false // Skip validators for this update
      }
    );

    console.log('🔍 User lookup result:', {
      userFound: !!user,
      userId: user?._id,
      userEmail: user?.email,
      isEmailVerified: user?.isEmailVerified
    });

    // If no user found, check if already verified
    if (!user) {
      // Try to find user with this token (might already be verified)
      const existingUser = await User.findOne({
        emailVerificationToken: hashedToken
      });

      if (existingUser && existingUser.isEmailVerified) {
        console.log('✅ Email already verified for user:', existingUser.email);
        return res.status(200).json({
          success: true,
          message: 'Email already verified. You can now log in.',
          alreadyVerified: true
        });
      }

      console.log('❌ No user found with verification token');
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification link'
      });
    }

    console.log('✅ Email verification successful for user:', user.email);

    // Log verification
    auditService.logUserActivity(user._id, 'EMAIL_VERIFICATION', 'USER');

    res.json({
      success: true,
      message: 'Email verified successfully! You can now log in.'
    });

  } catch (error) {
    console.error('❌ Email verification error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({
      success: false,
      message: 'Server error during email verification'
    });
  }
});
// ============================================================================
// PASSWORD RESET REQUEST ENDPOINT
// ============================================================================

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal that user doesn't exist
      return res.json({
        success: true,
        message: 'If an account exists with this email, a reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = tokenService.generatePasswordResetToken(user._id);
    user.passwordResetToken = resetToken.hashedToken;
    user.passwordResetExpires = resetToken.expires;
    await user.save();

    // Send reset email
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken.token}`;
    await emailService.sendPasswordResetEmail(user.email, user.username, resetUrl);

    // Log password reset request
    auditService.logUserActivity(user._id, 'PASSWORD_RESET_REQUEST', 'AUTH');

    res.json({
      success: true,
      message: 'Password reset email sent'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ============================================================================
// PASSWORD RESET ENDPOINT
// ============================================================================

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password/:token', [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { token } = req.params;
    const { password } = req.body;

    // Hash the token
    const crypto = require('crypto');
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = Date.now();
    await user.save();

    // Invalidate all refresh tokens
    user.refreshToken = undefined;
    await user.save();

    // Send confirmation email
    await emailService.sendEmail({
      to: user.email,
      subject: 'Password Reset Successful - Bugema IT Support',
      template: 'passwordResetSuccess',
      context: { name: user.username }
    });

    // Log password reset
    auditService.logUserActivity(user._id, 'PASSWORD_RESET_COMPLETE', 'AUTH');

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ============================================================================
// GET CURRENT USER ENDPOINT
// ============================================================================

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password -refreshToken -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;