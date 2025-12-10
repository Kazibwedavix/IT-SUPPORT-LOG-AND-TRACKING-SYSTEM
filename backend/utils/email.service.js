/**
 * Production Email Service for Bugema University IT Support
 * Handles all email communications including verification and password reset
 */
const emailConfig = require('../config/email.config');

class EmailService {
  constructor() {
    this.transporter = emailConfig.transporter;
    this.isConfigured = emailConfig.isEmailConfigured();
    
    if (!this.isConfigured) {
      console.warn('⚠️  Email service is not fully configured. Some features may not work.');
    }
  }

  async sendVerificationEmail(user, verificationToken) {
    try {
      if (!this.isConfigured) {
        throw new Error('Email service not configured');
      }

      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${verificationToken}`;

      const mailOptions = {
        from: emailConfig.getFromAddress(),
        to: user.email,
        subject: '🔐 Verify Your Bugema University IT Support Account',
        html: this.generateVerificationEmailTemplate(user, verificationUrl),
        text: this.generateVerificationEmailText(user, verificationUrl)
      };

      console.log(`📧 Sending verification email to: ${user.email}`);
      
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Verification email sent to ${user.email}. Message ID: ${info.messageId}`);
      
      return {
        success: true,
        messageId: info.messageId,
        recipient: user.email
      };
      
    } catch (error) {
      console.error('❌ Failed to send verification email:', error.message);
      
      if (process.env.NODE_ENV === 'development') {
        const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email/${verificationToken}`;
        console.log(`🔗 Verification URL (for development): ${verificationUrl}`);
      }
      
      throw new Error(`Failed to send verification email: ${error.message}`);
    }
  }

  async sendPasswordResetEmail(user, resetToken) {
    try {
      if (!this.isConfigured) {
        throw new Error('Email service not configured');
      }

      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

      const mailOptions = {
        from: emailConfig.getFromAddress(),
        to: user.email,
        subject: '🔑 Reset Your Bugema University IT Support Password',
        html: this.generatePasswordResetEmailTemplate(user, resetUrl),
        text: this.generatePasswordResetEmailText(user, resetUrl)
      };

      console.log(`📧 Sending password reset email to: ${user.email}`);
      
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Password reset email sent to ${user.email}. Message ID: ${info.messageId}`);
      
      return {
        success: true,
        messageId: info.messageId,
        recipient: user.email
      };
      
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error.message);
      
      if (process.env.NODE_ENV === 'development') {
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
        console.log(`🔗 Password Reset URL (for development): ${resetUrl}`);
      }
      
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }
  }

  async sendWelcomeEmail(user) {
    try {
      if (!this.isConfigured) {
        return { success: false, message: 'Email service not configured' };
      }

      const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

      const mailOptions = {
        from: emailConfig.getFromAddress(),
        to: user.email,
        subject: '🎉 Welcome to Bugema University IT Support System',
        html: this.generateWelcomeEmailTemplate(user, loginUrl),
        text: this.generateWelcomeEmailText(user, loginUrl)
      };

      console.log(`📧 Sending welcome email to: ${user.email}`);
      
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log(`✅ Welcome email sent to ${user.email}`);
      
      return {
        success: true,
        messageId: info.messageId,
        recipient: user.email
      };
      
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Email template methods (keep the same as previous)
  generateVerificationEmailTemplate(user, verificationUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          /* ... (keep all the styles from previous) ... */
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">BUGEMA UNIVERSITY</div>
            <div>IT Support System</div>
          </div>
          
          <div class="content">
            <h2>Hello ${user.firstName || 'User'},</h2>
            <p>Welcome to the Bugema University IT Support System! Please verify your email address to activate your account.</p>
            
            <div class="info-box">
              <strong>Account Details:</strong><br>
              • Name: ${user.firstName} ${user.lastName}<br>
              • Email: ${user.email}<br>
              • Role: ${user.role}<br>
              • Department: ${user.originalDepartment || user.department}
            </div>
            
            <p>Click the button below to verify your email address:</p>
            
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #004d40;">
              ${verificationUrl}
            </p>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> This verification link will expire in 24 hours.
            </div>
            
            <p>Need help? Contact our IT support team:</p>
            <ul>
              <li>📧 support@bugemauniv.ac.ug</li>
              <li>📞 +256 784-845-785</li>
            </ul>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Bugema University IT Department.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generatePasswordResetEmailTemplate(user, resetUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          /* ... (keep all the styles from previous) ... */
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">BUGEMA UNIVERSITY</div>
            <div>IT Support System - Password Reset</div>
          </div>
          
          <div class="content">
            <h2>Password Reset Request</h2>
            
            <p>Hello ${user.firstName || 'User'},</p>
            <p>We received a request to reset your password for the Bugema University IT Support System.</p>
            
            <div class="info-box">
              <strong>Account Information:</strong><br>
              • Name: ${user.firstName} ${user.lastName}<br>
              • Email: ${user.email}<br>
              • Request Time: ${new Date().toLocaleString()}
            </div>
            
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul>
                <li>This link will expire in 1 hour</li>
                <li>If you didn't request this, please ignore this email</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Bugema University IT Department.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateWelcomeEmailTemplate(user, loginUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Bugema IT Support</title>
        <style>
          /* ... (keep all the styles from previous) ... */
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">BUGEMA UNIVERSITY</div>
            <div>IT Support System</div>
          </div>
          
          <div class="content">
            <h2>🎉 Welcome to Bugema IT Support, ${user.firstName}!</h2>
            <p>Your email has been verified successfully. Your account is now fully activated!</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: #e8f5e9; padding: 20px; border-radius: 10px; display: inline-block;">
                <div style="font-size: 48px; color: #4caf50;">✓</div>
                <div style="font-weight: bold; color: #2e7d32;">Account Verified</div>
              </div>
            </div>
            
            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">Login to Your Account</a>
            </div>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Bugema University IT Department</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Text versions (simplified)
  generateVerificationEmailText(user, verificationUrl) {
    return `Verify your email: ${verificationUrl}`;
  }

  generatePasswordResetEmailText(user, resetUrl) {
    return `Reset your password: ${resetUrl}`;
  }

  generateWelcomeEmailText(user, loginUrl) {
    return `Welcome ${user.firstName}! Login here: ${loginUrl}`;
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;