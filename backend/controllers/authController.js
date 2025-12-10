/**
 * Authentication Controller
 * Handles user authentication operations with email verification
 * 
 * @version 2.0.0
 * @author Bugema University IT Support System
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const EmailService = require('../services/emailService');

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
    const { email, password, rememberMe } = req.body;
    
    console.log('🔐 [LOGIN] Attempt for:', email);
    
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
      console.log('❌ [LOGIN] User not found:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // 3. Check if user is active
    if (user.status !== 'active') {
      console.log('❌ [LOGIN] Account not active:', email, 'status:', user.status);
      return res.status(403).json({
        success: false,
        message: 'Account is not active. Please contact support.'
      });
    }
    
    // 4. Verify password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      console.log('❌ [LOGIN] Invalid password for:', email);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // 5. Check if email is verified (only for non-admin users)
    if (!user.emailVerified && user.role !== 'admin') {
      console.log('⚠️ [LOGIN] Email not verified for:', email);
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in',
        requiresVerification: true,
        email: user.email
      });
    }
    
    // 6. Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);
    
    // 7. Save refresh token to database
    user.refreshToken = refreshToken;
    if (rememberMe) {
      // Extend token expiry for remember me
      user.refreshTokenExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    }
    
    // 8. Update last login
    user.lastLogin = new Date();
    user.loginAttempts = 0; // Reset login attempts on successful login
    await user.save();
    
    // 9. Set cookies with appropriate expiry
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    };
    
    if (rememberMe) {
      cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }
    
    res.cookie('accessToken', accessToken, cookieOptions);
    res.cookie('refreshToken', refreshToken, cookieOptions);
    
    // 10. Prepare user data for response
    const userData = {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      emailVerified: user.emailVerified,
      status: user.status
    };
    
    console.log('✅ [LOGIN] Successful for:', email, 'role:', user.role);
    
    // 11. Send response
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        accessToken // Also send in response body for clients that don't use cookies
      }
    });
    
  } catch (error) {
    console.error('❌ [LOGIN] Error:', error);
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
    console.log('🚪 [LOGOUT] User:', req.user?.userId);
    
    // Clear refresh token from database
    if (req.user) {
      await User.findByIdAndUpdate(req.user.userId, {
        refreshToken: null,
        refreshTokenExpiry: null
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
    console.error('❌ [LOGOUT] Error:', error);
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
    
    const userData = {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    };
    
    res.status(200).json({
      success: true,
      data: {
        user: userData
      }
    });
    
  } catch (error) {
    console.error('❌ [GET_ME] Error:', error);
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
    
    // Check if refresh token is expired
    if (user.refreshTokenExpiry && user.refreshTokenExpiry < Date.now()) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired'
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
    console.error('❌ [REFRESH_TOKEN] Error:', error);
    
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
 * @desc    Register new user with email verification
 * @access  Public
 */
exports.register = async (req, res) => {
  try {
    const { email, password, username, firstName, lastName, role, department } = req.body;
    
    console.log('📝 [REGISTER] Attempt:', {
      email,
      username,
      role: role || 'student',
      department: department || 'general'
    });
    
    // 1. Validate input
    if (!email || !password || !username) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, and username'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
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
    
    // 3. Map department
    const departmentMapping = {
      'ADMINISTRATION': 'administration',
      'ACADEMIC': 'academic',
      'IT_SERVICES': 'it',
      'FINANCE': 'finance',
      'HR': 'hr',
      'LIBRARY': 'library',
      'MAINTENANCE': 'maintenance',
      'ADMIN': 'administration'
    };
    
    const mappedDepartment = departmentMapping[department] || 'general';
    console.log('🔄 Department mapping:', department, '→', mappedDepartment);
    
    // 4. Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    
    // 5. Create user with verification data
    const userData = {
      email: email.toLowerCase().trim(),
      password,
      username: username.trim(),
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
      role: role || 'student',
      department: mappedDepartment,
      emailVerified: false,
      verificationToken: verificationTokenHash,
      verificationTokenExpiry: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      status: 'pending_verification'
    };
    
    const user = await User.create(userData);
    
    console.log('✅ [REGISTER] User saved:', user.email);
    console.log('🔑 Verification token generated');
    console.log('👤 User ID:', user._id);
    
    // 6. Build verification URL
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${verificationToken}`;
    console.log('🔗 Verification URL:', verificationUrl);
    
    // 7. Try to send verification email
    const emailEnabled = process.env.DISABLE_EMAIL !== 'true' && 
                        process.env.EMAIL_ENABLED !== 'false' &&
                        process.env.EMAIL_USERNAME;
    
    if (emailEnabled) {
      try {
        await EmailService.sendVerificationEmail(email, username, verificationUrl);
        console.log('✅ Verification email sent');
      } catch (emailError) {
        console.error('❌ Email error:', emailError.message);
        console.log('📧 Email not sent - transporter not configured');
      }
    } else {
      console.log('📧 Email disabled in configuration');
    }
    
    // Always log the verification URL for development
    console.log('🔗 Verification URL for development:', verificationUrl);
    
    // 8. Return response (NO TOKENS until email is verified)
    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      data: {
        userId: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
        emailVerified: false,
        requiresVerification: true,
        department: user.department
      },
      // In development, include the verification URL
      ...(process.env.NODE_ENV === 'development' && {
        verificationUrl: verificationUrl
      })
    });
    
  } catch (error) {
    console.error('❌ [REGISTER] Error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verify user email
 * @access  Public
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    
    console.log('🔍 [VERIFY] Attempting email verification');
    console.log('   Token length:', token?.length);
    console.log('   First 10 chars:', token?.substring(0, 10) + '...');
    
    if (!token || token.length !== 64) {
      console.log('❌ [VERIFY] Invalid token format');
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token format'
      });
    }
    
    // Hash the token for comparison
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    console.log('🔑 Hashed token (first 20):', hashedToken.substring(0, 20) + '...');
    
    // Find user with this token that hasn't expired
    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationTokenExpiry: { $gt: Date.now() }
    });
    
    if (!user) {
      console.log('❌ [VERIFY] Token not found or expired');
      
      // Debug information
      const expiredUser = await User.findOne({
        verificationToken: hashedToken
      });
      
      if (expiredUser) {
        console.log('   Token found but expired for:', expiredUser.email);
        console.log('   Expiry:', new Date(expiredUser.verificationTokenExpiry).toISOString());
        console.log('   Current:', new Date().toISOString());
      }
      
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }
    
    // Check if already verified
    if (user.emailVerified) {
      console.log('ℹ️ [VERIFY] Email already verified for:', user.email);
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }
    
    // Update user
    user.emailVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    user.status = 'active';
    user.verifiedAt = new Date();
    
    await user.save();
    
    console.log('✅ [VERIFY] Email verified for:', user.email);
    console.log('   User ID:', user._id);
    console.log('   Role:', user.role);
    
    // Generate tokens now that email is verified
    const { accessToken, refreshToken } = generateTokens(user._id);
    
    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();
    
    // Set cookies
    setTokenCookies(res, accessToken, refreshToken);
    
    // Prepare response data
    const userData = {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
      emailVerified: true,
      status: user.status
    };
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You are now logged in.',
      data: {
        user: userData,
        accessToken
      }
    });
    
  } catch (error) {
    console.error('❌ [VERIFY] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend verification email
 * @access  Public
 */
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('🔄 [RESEND_VERIFICATION] Request for:', email);
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    // Find user
    const user = await User.findOne({ 
      email: email.toLowerCase().trim(),
      emailVerified: false 
    });
    
    if (!user) {
      console.log('❌ [RESEND_VERIFICATION] User not found or already verified:', email);
      return res.status(400).json({
        success: false,
        message: 'User not found or email already verified'
      });
    }
    
    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    
    // Update user with new token
    user.verificationToken = verificationTokenHash;
    user.verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    await user.save();
    
    // Build verification URL
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${verificationToken}`;
    
    console.log('🔄 Generated new verification token for:', email);
    console.log('🔗 New verification URL:', verificationUrl);
    
    // Try to send email
    const emailEnabled = process.env.DISABLE_EMAIL !== 'true' && 
                        process.env.EMAIL_ENABLED !== 'false' &&
                        process.env.EMAIL_USERNAME;
    
    if (emailEnabled) {
      try {
        await EmailService.sendVerificationEmail(email, user.username, verificationUrl);
        console.log('✅ Verification email resent');
      } catch (emailError) {
        console.error('❌ Email error:', emailError.message);
        // Continue - we'll still return success with URL
      }
    } else {
      console.log('📧 Email disabled - showing URL only');
    }
    
    res.status(200).json({
      success: true,
      message: 'Verification email sent. Please check your inbox.',
      data: {
        email: user.email,
        // In development, include the URL
        ...(process.env.NODE_ENV === 'development' && {
          verificationUrl: verificationUrl
        })
      }
    });
    
  } catch (error) {
    console.error('❌ [RESEND_VERIFICATION] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Find user
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      // Don't reveal that user doesn't exist (security)
      return res.status(200).json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link'
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    // Set reset token and expiry (1 hour)
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpiry = Date.now() + 60 * 60 * 1000;
    
    await user.save();
    
    // Build reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    
    // Send email
    try {
      await EmailService.sendPasswordResetEmail(email, user.username, resetUrl);
    } catch (emailError) {
      console.error('Password reset email error:', emailError);
    }
    
    res.status(200).json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link'
    });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request'
    });
  }
};

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password
 * @access  Public
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and password are required'
      });
    }
    
    // Validate password
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }
    
    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Find user with valid reset token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }
    
    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    
    await user.save();
    
    // Send confirmation email
    try {
      await EmailService.sendPasswordResetSuccessEmail(user.email, user.username);
    } catch (emailError) {
      console.error('Password reset confirmation email error:', emailError);
    }
    
    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
};

/**
 * @route   GET /api/auth/debug/tokens
 * @desc    Debug endpoint to check verification tokens (DEV ONLY)
 * @access  Public
 */
exports.debugTokens = async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }
  
  try {
    const users = await User.find(
      { $or: [{ verificationToken: { $exists: true } }, { resetPasswordToken: { $exists: true } }] },
      'email username verificationToken verificationTokenExpiry resetPasswordToken resetPasswordExpiry emailVerified status createdAt'
    ).lean();
    
    const currentTime = Date.now();
    
    const formattedUsers = users.map(user => ({
      email: user.email,
      username: user.username,
      verificationToken: user.verificationToken ? user.verificationToken.substring(0, 20) + '...' : null,
      verificationExpires: user.verificationTokenExpiry ? new Date(user.verificationTokenExpiry).toISOString() : null,
      verificationValid: user.verificationTokenExpiry && user.verificationTokenExpiry > currentTime,
      resetToken: user.resetPasswordToken ? user.resetPasswordToken.substring(0, 20) + '...' : null,
      resetExpires: user.resetPasswordExpiry ? new Date(user.resetPasswordExpiry).toISOString() : null,
      resetValid: user.resetPasswordExpiry && user.resetPasswordExpiry > currentTime,
      emailVerified: user.emailVerified,
      status: user.status,
      createdAt: user.createdAt
    }));
    
    res.json({
      success: true,
      currentTime: new Date(currentTime).toISOString(),
      count: formattedUsers.length,
      users: formattedUsers
    });
    
  } catch (error) {
    console.error('Debug tokens error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @route   GET /api/auth/check-email/:email
 * @desc    Check if email exists
 * @access  Public
 */
exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    res.json({
      success: true,
      exists: !!user,
      emailVerified: user?.emailVerified || false
    });
    
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check email'
    });
  }
};

module.exports = exports;