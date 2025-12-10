/**
 * Authentication Middleware - Production Ready
 * 
 * @version 3.0.0 - Production Ready with security features
 * @author Bugema University IT Support System
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-key-change-this-in-production';

/**
 * Log security event
 */
const logSecurityEvent = (eventType, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`🔐 [${timestamp}] SECURITY - ${eventType}:`, JSON.stringify(data));
};

/**
 * Extract token from request
 */
const extractToken = (req) => {
  // 1. Check HTTP-only cookie (primary for web apps)
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }
  
  // 2. Check Authorization header (for API clients)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }
  
  // 3. Check x-access-token header
  if (req.headers['x-access-token']) {
    return req.headers['x-access-token'];
  }
  
  return null;
};

/**
 * Main authentication middleware
 */
const auth = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    // Extract token from request
    const token = extractToken(req);
    
    if (!token) {
      logSecurityEvent('AUTH_FAILED_NO_TOKEN', {
        ip: req.ip || req.connection.remoteAddress,
        path: req.originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login to access this resource.',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      logSecurityEvent('AUTH_FAILED_INVALID_TOKEN', {
        ip: req.ip,
        error: jwtError.name,
        message: jwtError.message,
        path: req.originalUrl
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

    // Validate token structure
    if (!decoded.userId || decoded.type !== 'access') {
      logSecurityEvent('AUTH_FAILED_MALFORMED_TOKEN', {
        ip: req.ip,
        decodedKeys: Object.keys(decoded),
        path: req.originalUrl
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid token format.',
        code: 'MALFORMED_TOKEN'
      });
    }

    // Find user
    const user = await User.findById(decoded.userId)
      .select('-password -refreshToken -verificationToken -verificationTokenExpiry -resetPasswordToken -resetPasswordExpiry');

    // Validate user existence
    if (!user) {
      logSecurityEvent('AUTH_FAILED_USER_NOT_FOUND', {
        ip: req.ip,
        userId: decoded.userId,
        path: req.originalUrl
      });
      
      return res.status(401).json({
        success: false,
        message: 'User account not found.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      logSecurityEvent('AUTH_FAILED_ACCOUNT_INACTIVE', {
        ip: req.ip,
        userId: user._id,
        email: user.email,
        status: user.status,
        path: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact Bugema University IT Support.',
        code: 'ACCOUNT_INACTIVE',
        support: {
          email: 'itsupport@bugemauniv.ac.ug',
          phone: '+256 784-845-785',
          hours: 'Mon-Fri 8:00 AM - 5:00 PM'
        }
      });
    }

    // Check if email is verified (configurable)
    if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !user.emailVerified && user.role !== 'admin') {
      logSecurityEvent('AUTH_FAILED_EMAIL_NOT_VERIFIED', {
        ip: req.ip,
        userId: user._id,
        email: user.email,
        path: req.originalUrl
      });
      
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address to continue.',
        code: 'EMAIL_NOT_VERIFIED',
        action: 'verify_email',
        email: user.email
      });
    }

    // Build user object for request
    const userData = {
      id: user._id,
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      emailVerified: user.emailVerified,
      status: user.status,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    };

    // Attach user to request
    req.user = userData;
    req.userId = user._id;
    
    // Update user's last activity (non-blocking)
    user.lastActivity = new Date();
    user.save().catch(err => {
      console.error('Failed to update user activity:', err.message);
    });

    // Log successful authentication
    logSecurityEvent('AUTH_SUCCESS', {
      userId: user._id,
      email: user.email,
      role: user.role,
      duration: Date.now() - startTime,
      path: req.originalUrl,
      method: req.method
    });

    next();

  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    
    logSecurityEvent('AUTH_SYSTEM_ERROR', {
      error: error.message,
      ip: req.ip,
      path: req.originalUrl,
      duration: Date.now() - startTime
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
          method: req.method
        });
        
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this resource.',
          code: 'INSUFFICIENT_PERMISSIONS',
          requiredRoles: roles,
          userRole: req.user.role
        });
      }

      next();
    } catch (error) {
      console.error('❌ Role middleware error:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Authorization system error.',
        code: 'AUTHORIZATION_ERROR'
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

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId)
      .select('-password -refreshToken -verificationToken -verificationTokenExpiry');
    
    if (user && user.status === 'active') {
      req.user = {
        id: user._id,
        userId: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        emailVerified: user.emailVerified,
        status: user.status
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

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  auth,
  requireRole,
  optionalAuth,
  extractToken,
  logSecurityEvent
};