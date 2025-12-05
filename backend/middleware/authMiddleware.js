/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user to request
 * 
 * @version 1.0.0
 * @author Bugema University IT Support System
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-key-change-this-in-production';

/**
 * Verify JWT token and attach user to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    // 1. Get token from headers, cookies, or query
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.query?.token) {
      token = req.query.token;
    }
    
    // 2. Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }
    
    // 3. Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 4. Check if token type is 'access'
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type. Please use an access token.'
      });
    }
    
    // 5. Find user and check if still exists
    const user = await User.findById(decoded.userId).select('-password -refreshToken');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists.'
      });
    }
    
    // 6. Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact support.'
      });
    }
    
    // 7. Check if password was changed after token was issued
    if (user.passwordChangedAt) {
      const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
      if (decoded.iat < changedTimestamp) {
        return res.status(401).json({
          success: false,
          message: 'Password was recently changed. Please login again.'
        });
      }
    }
    
    // 8. Attach user to request
    req.user = {
      userId: user._id,
      email: user.email,
      role: user.role,
      username: user.username
    };
    
    next();
    
  } catch (error) {
    console.error('Authentication error:', error.message);
    
    let message = 'Authentication failed';
    let statusCode = 401;
    
    if (error.name === 'TokenExpiredError') {
      message = 'Token has expired. Please refresh or login again.';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Invalid token. Please login again.';
    } else if (error.name === 'NotBeforeError') {
      message = 'Token not active yet.';
    } else {
      statusCode = 500;
      message = 'Authentication service error';
    }
    
    res.status(statusCode).json({
      success: false,
      message
    });
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`
      });
    }
    
    next();
  };
};

/**
 * Optional authentication middleware
 * (Doesn't fail if no token, just doesn't attach user)
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (decoded.type === 'access') {
        const user = await User.findById(decoded.userId).select('-password -refreshToken');
        
        if (user && user.status === 'active') {
          req.user = {
            userId: user._id,
            email: user.email,
            role: user.role,
            username: user.username
          };
        }
      }
    }
    
    next();
    
  } catch (error) {
    // Ignore token errors for optional auth
    next();
  }
};

module.exports = {
  authMiddleware,
  authorize,
  optionalAuth
};