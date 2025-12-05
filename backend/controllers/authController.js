/**
 * Authentication Controller
 * Handles user authentication operations
 * 
 * @version 1.0.0
 * @author Bugema University IT Support System
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-key-change-this-in-production';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '30d';

/**
 * Generate JWT tokens
 */
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRE }
  );
  
  return { accessToken, refreshToken };
};

/**
 * Set token cookies
 */
const setTokenCookies = (res, accessToken, refreshToken) => {
  // Access token cookie (7 days)
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  
  // Refresh token cookie (30 days)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
};

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 1. Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }
    
    // 2. Find user and include password field
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // 3. Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact support.'
      });
    }
    
    // 4. Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // 5. Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);
    
    // 6. Save refresh token to database
    user.refreshToken = refreshToken;
    await user.save();
    
    // 7. Set cookies
    setTokenCookies(res, accessToken, refreshToken);
    
    // 8. Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // 9. Send response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName
        },
        accessToken // Also send in response body for clients that don't use cookies
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
exports.logout = async (req, res) => {
  try {
    // Clear refresh token from database
    if (req.user) {
      await User.findByIdAndUpdate(req.user.userId, {
        refreshToken: null
      });
    }
    
    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password -refreshToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
          createdAt: user.createdAt
        }
      }
    });
    
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user data'
    });
  }
};

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not found'
      });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }
    
    // Find user
    const user = await User.findById(decoded.userId);
    
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    // Generate new tokens
    const tokens = generateTokens(user._id);
    
    // Update refresh token in database
    user.refreshToken = tokens.refreshToken;
    await user.save();
    
    // Set new cookies
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
    
    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: tokens.accessToken
      }
    });
    
  } catch (error) {
    console.error('Refresh token error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired. Please login again.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Token refresh failed'
    });
  }
};

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
exports.register = async (req, res) => {
  try {
    const { email, password, username, firstName, lastName, role } = req.body;
    
    // 1. Validate input
    if (!email || !password || !username) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, and username'
      });
    }
    
    // 2. Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }
    
    // 3. Create user
    const user = await User.create({
      email,
      password,
      username,
      firstName,
      lastName,
      role: role || 'student' // Default role
    });
    
    // 4. Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);
    
    // 5. Save refresh token
    user.refreshToken = refreshToken;
    await user.save();
    
    // 6. Set cookies
    setTokenCookies(res, accessToken, refreshToken);
    
    // 7. Send response
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role
        },
        accessToken
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
};