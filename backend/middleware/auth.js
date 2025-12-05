const express = require('express');
const router = express.Router(); // <--- FIX 1: Initialize Express Router
const { body, validationResult } = require('express-validator'); // <--- FIX 2: Needed for route validation
const crypto = require('crypto'); // <--- FIX 3: Needed for token hashing

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Assume emailService is located here, required for password reset confirmation email
const emailService = require('../services/emailService');

// Import audit service with error handling
let auditService;
try {
    auditService = require('../services/auditService');
    console.log('✅ Audit service loaded');
} catch (error) {
    console.warn('⚠️ Audit service not available:', error.message);
    auditService = null;
}

/**
 * Log security event with fallback handling
 */
const logSecurityEvent = (eventType, data = {}) => {
    try {
        if (auditService && typeof auditService.logSecurityEvent === 'function') {
            auditService.logSecurityEvent(eventType, data);
        } else {
            const timestamp = new Date().toLocaleString('en-UG', {
                timeZone: 'Africa/Kampala',
                hour12: true
            });
            console.log(`🔐 [${timestamp}] SECURITY - ${eventType}:`, JSON.stringify(data));
        }
    } catch (error) {
        console.error('❌ Failed to log security event:', error.message);
    }
};

/**
 * Extract token from request (supports multiple sources)
 */
const extractToken = (req) => {
    // 1. Check HTTP-only cookie (primary for production)
    if (req.cookies?.accessToken) {
        return req.cookies.accessToken;
    }
    
    // 2. Check Authorization header (for API clients)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.replace('Bearer ', '');
    }
    
    // 3. Check query parameter (for temporary links)
    if (req.query?.token) {
        return req.query.token;
    }
    
    // 4. Check x-access-token header
    if (req.headers['x-access-token']) {
        return req.headers['x-access-token'];
    }
    
    return null;
};

/**
 * Get user's display name from profile
 */
const getUserDisplayName = (user) => {
    if (user.profile?.fullName) {
        return user.profile.fullName;
    }
    if (user.profile?.firstName && user.profile?.lastName) {
        return `${user.profile.firstName} ${user.profile.lastName}`;
    }
    return user.username || user.email.split('@')[0];
};

/**
 * Get user's department based on role
 */
const getUserDepartment = (user) => {
    if (user.role === 'student' && user.academicInfo?.department) {
        return user.academicInfo.department;
    }
    if ((user.role === 'staff' || user.role === 'technician') && user.professionalInfo?.department) {
        return user.professionalInfo.department;
    }
    return null;
};

/**
 * Get user's campus based on role
 */
const getUserCampus = (user) => {
    if (user.academicInfo?.campus) {
        return user.academicInfo.campus;
    }
    if (user.professionalInfo?.department) {
        return 'MAIN';
    }
    return null;
};

/**
 * Main authentication middleware
 * FIXED: Now correctly reads 'userId' from JWT payload
 */
const auth = async (req, res, next) => {
    try {
        // Extract token from request
        const token = extractToken(req);
        
        if (!token) {
            logSecurityEvent('AUTH_FAILED_NO_TOKEN', {
                ip: req.ip || req.connection.remoteAddress,
                path: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString()
            });
            
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please login to access this resource.',
                code: 'AUTH_REQUIRED',
                timestamp: new Date().toISOString(),
                path: req.originalUrl
            });
        }

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
            logSecurityEvent('AUTH_FAILED_INVALID_TOKEN', {
                ip: req.ip,
                error: jwtError.name,
                message: jwtError.message,
                timestamp: new Date().toISOString()
            });
            
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Your session has expired. Please login again.',
                    code: 'TOKEN_EXPIRED',
                    action: 'login'
                });
            }
            
            if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid authentication token.',
                    code: 'INVALID_TOKEN',
                    action: 'login'
                });
            }
            
            return res.status(401).json({
                success: false,
                message: 'Authentication failed. Please try again.',
                code: 'AUTH_FAILED'
            });
        }

        // FIXED: Validate token structure - now checks for 'userId'
        if (!decoded.userId) {
            logSecurityEvent('AUTH_FAILED_MALFORMED_TOKEN', {
                ip: req.ip,
                decodedKeys: Object.keys(decoded),
                timestamp: new Date().toISOString()
            });
            
            return res.status(401).json({
                success: false,
                message: 'Invalid token format.',
                code: 'MALFORMED_TOKEN'
            });
        }

        // FIXED: Find user by 'userId' from token
        const user = await User.findById(decoded.userId)
            .select('-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -loginAttempts -lockUntil');

        // Validate user existence
        if (!user) {
            logSecurityEvent('AUTH_FAILED_USER_NOT_FOUND', {
                ip: req.ip,
                userId: decoded.userId,
                timestamp: new Date().toISOString()
            });
            
            return res.status(401).json({
                success: false,
                message: 'User account not found.',
                code: 'USER_NOT_FOUND'
            });
        }

        // Check if account is active
        if (!user.isActive) {
            logSecurityEvent('AUTH_FAILED_ACCOUNT_INACTIVE', {
                ip: req.ip,
                userId: user._id,
                email: user.email,
                deactivationReason: user.deactivationReason,
                timestamp: new Date().toISOString()
            });
            
            return res.status(403).json({
                success: false,
                message: 'Account is deactivated. Please contact Bugema University IT Support.',
                code: 'ACCOUNT_INACTIVE',
                support: {
                    email: 'itsupport@bugemauniv.ac.ug',
                    phone: '+256 392 730 104',
                    office: 'IT Department, Main Campus'
                }
            });
        }

        // Check if email is verified (configurable)
        if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.isEmailVerified) {
            logSecurityEvent('AUTH_FAILED_EMAIL_NOT_VERIFIED', {
                ip: req.ip,
                userId: user._id,
                email: user.email,
                timestamp: new Date().toISOString()
            });
            
            return res.status(403).json({
                success: false,
                message: 'Please verify your email address to continue.',
                code: 'EMAIL_NOT_VERIFIED',
                action: 'verify_email'
            });
        }

        // Check if password was changed after token was issued
        if (user.passwordChangedAt) {
            const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
            if (decoded.iat < changedTimestamp) {
                logSecurityEvent('AUTH_FAILED_PASSWORD_CHANGED', {
                    ip: req.ip,
                    userId: user._id,
                    email: user.email,
                    timestamp: new Date().toISOString()
                });
                
                return res.status(401).json({
                    success: false,
                    message: 'Password was changed recently. Please login again.',
                    code: 'PASSWORD_CHANGED',
                    action: 'login'
                });
            }
        }

        // Update user's last activity (non-blocking)
        user.lastLogin = new Date();
        user.lastActivity = new Date();
        user.save().catch(err => {
            console.error('Failed to update user activity:', err.message);
        });

        // Build user object for request
        const userData = {
            id: user._id,
            userId: user._id, 
            username: user.username,
            email: user.email,
            role: user.role,
            displayName: getUserDisplayName(user),
            firstName: user.profile?.firstName || '',
            lastName: user.profile?.lastName || '',
            avatar: user.profile?.avatar || '',
            department: getUserDepartment(user),
            campus: getUserCampus(user),
            studentId: user.academicInfo?.studentId || null,
            employeeId: user.professionalInfo?.employeeId || null,
            isEmailVerified: user.isEmailVerified,
            isActive: user.isActive,
            permissions: user.permissions || [],
            preferences: user.preferences || {},
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
        };

        // Attach user to request
        req.user = userData;
        req.userId = user._id;
        
        // Also attach the full user object for specific operations
        req.userObj = user;

        // Log successful authentication
        logSecurityEvent('AUTH_SUCCESS', {
            userId: user._id,
            email: user.email,
            role: user.role,
            username: user.username,
            department: userData.department,
            campus: userData.campus,
            ip: req.ip,
            path: req.originalUrl,
            method: req.method,
            timestamp: new Date().toISOString()
        });

        next();

    } catch (error) {
        console.error('❌ Auth middleware error:', error.message);
        
        logSecurityEvent('AUTH_SYSTEM_ERROR', {
            error: error.message,
            stack: error.stack?.split('\n')[0],
            ip: req.ip,
            path: req.originalUrl,
            timestamp: new Date().toISOString()
        });
        
        res.status(500).json({
            success: false,
            message: 'Authentication system error. Please try again later.',
            code: 'AUTH_SYSTEM_ERROR',
            timestamp: new Date().toISOString(),
            support: 'itsupport@bugemauniv.ac.ug'
        });
    }
};

/**
 * Role-based authorization middleware
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required.',
                    code: 'AUTH_REQUIRED'
                });
            }

            if (!roles.includes(req.user.role)) {
                logSecurityEvent('ROLE_AUTHORIZATION_FAILED', {
                    userId: req.user.id,
                    email: req.user.email,
                    userRole: req.user.role,
                    requiredRoles: roles,
                    ip: req.ip,
                    path: req.originalUrl,
                    method: req.method,
                    timestamp: new Date().toISOString()
                });
                
                return res.status(403).json({
                    success: false,
                    message: 'You do not have the required role to access this resource.',
                    code: 'INSUFFICIENT_ROLE',
                    requiredRoles: roles,
                    userRole: req.user.role
                });
            }

            next();
        } catch (error) {
            console.error('❌ Role middleware error:', error.message);
            
            res.status(500).json({
                success: false,
                message: 'Role authorization system error.',
                code: 'ROLE_SYSTEM_ERROR'
            });
        }
    };
};

/**
 * Optional authentication middleware
 */
const optionalAuth = async (req, res, next) => {
    try {
        const token = extractToken(req);
        
        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId) // FIXED: Use userId
            .select('-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires');
        
        if (user && user.isActive) {
            req.user = {
                id: user._id,
                userId: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                displayName: getUserDisplayName(user),
                department: getUserDepartment(user),
                campus: getUserCampus(user),
                isActive: user.isActive,
                isEmailVerified: user.isEmailVerified
            };
        } else {
            req.user = null;
        }
        
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};
/**
 * @route   GET /api/auth/verify-reset-token/:token
 * @desc    Verify password reset token validity
 * @access  Public
 */
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    console.log('🔍 Reset token verification attempt:', {
      tokenLength: token?.length,
      tokenPreview: token?.substring(0, 10) + '...',
      timestamp: new Date().toISOString()
    });

    // Hash the token to match stored hash
    
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select('email username');

    if (!user) {
      console.log('❌ Invalid or expired reset token');
      return res.status(400).json({
        success: false,
        valid: false,
        message: 'Invalid or expired reset token',
        code: 'TOKEN_INVALID'
      });
    }

    console.log('✅ Reset token is valid for user:', user.email);

    // Log token verification
    // Using the locally defined logSecurityEvent as a fallback if auditService is unavailable
    logSecurityEvent('PASSWORD_RESET_TOKEN_VERIFIED', {
      userId: user._id,
      email: user.email
    });

    res.json({
      success: true,
      valid: true,
      message: 'Token is valid',
      data: {
        email: user.email,
        username: user.username
      }
    });

  } catch (error) {
    console.error('❌ Token verification error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      valid: false,
      message: 'Server error during token verification',
      code: 'SERVER_ERROR'
    });
  }
});


// ============================================================================
// UPDATE YOUR EXISTING RESET PASSWORD ENDPOINT
// Replace your current POST /reset-password/:token with this improved version
// ============================================================================

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password/:token', [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: errors.array()[0].msg,
        errors: errors.array() 
      });
    }

    const { token } = req.params;
    const { password } = req.body;

    console.log('🔍 Password reset attempt:', {
      tokenLength: token?.length,
      timestamp: new Date().toISOString()
    });

    // Hash the token
    
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
      console.log('❌ Invalid or expired reset token');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token',
        code: 'TOKEN_INVALID'
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = Date.now();
    await user.save();

    // Invalidate all refresh tokens for security
    user.refreshToken = undefined;
    await user.save();

    console.log('✅ Password reset successful for user:', user.email);

    // Send confirmation email
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Password Reset Successful - Bugema IT Support',
        template: 'passwordResetSuccess',
        context: { name: user.username || user.profile?.fullName }
      });
    } catch (emailError) {
      console.error('❌ Failed to send confirmation email:', emailError.message);
      // Don't fail the request if email fails
    }

    // Log password reset
    logSecurityEvent('PASSWORD_RESET_COMPLETE', {
      userId: user._id,
      email: user.email,
      type: 'AUTH'
    });

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });

  } catch (error) {
    console.error('❌ Reset password error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({ 
      success: false, 
      message: 'Server error during password reset' 
    });
  }
});

// Export all middleware and the router instance
module.exports = {
    auth,
    requireRole,
    optionalAuth,
    extractToken,
    router, 
    _helpers: {
        getUserDisplayName,
        getUserDepartment,
        getUserCampus,
        logSecurityEvent
    }
};