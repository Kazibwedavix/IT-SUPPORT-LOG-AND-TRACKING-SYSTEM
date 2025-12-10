/**
 * Email Service - Production Ready with Gmail
 * 
 * Comprehensive email service with queue management, retry logic,
 * and fallback mechanisms for the Bugema University IT Support System.
 * 
 * Features:
 * - Gmail SMTP integration with secure authentication
 * - Email queue with rate limiting
 * - Automatic retry on failure (3 attempts)
 * - Fallback to file logging in development
 * - Professional HTML email templates
 * - Text-only fallback versions
 * - Connection pooling for performance
 * - Email validation
 * - Status monitoring
 * 
 * @version 3.0.0
 * @author Bugema University IT Support System
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
  constructor() {
    // Email transporter (SMTP connection)
    this.transporter = null;
    
    // Service state
    this.isConfigured = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    
    // Email queue management
    this.queue = [];
    this.processingQueue = false;
    
    // Initialize service
    this.init();
    this.startQueueProcessor();
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize email service with Gmail SMTP
   */
 init() {
  try {
    const emailConfig = this.getEmailConfig();
    
    // Check if email is properly configured
    if (!emailConfig.valid) {
      console.warn('⚠️  Email configuration incomplete:', emailConfig.missing);
      this.setupFallbackLogging();
      return;
    }

    // Create SMTP transporter
    this.transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.username,
        pass: emailConfig.password
      },
      tls: {
        rejectUnauthorized: false
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100
    });

    // Set as configured immediately since transporter is created
    this.isConfigured = true;
    console.log('✅ Email transporter created successfully');
    
    // Verify connection asynchronously (don't block initialization)
    this.verifyConnection();
    
  } catch (error) {
    console.error('❌ Email service initialization failed:', error.message);
    this.setupFallbackLogging();
  }
}

  /**
   * Get and validate email configuration from environment variables
   * 
   * @returns {Object} Email configuration with validation status
   */
  getEmailConfig() {
    // Required environment variables
    const required = ['EMAIL_HOST', 'EMAIL_USERNAME', 'EMAIL_PASSWORD'];
    const missing = required.filter(key => !process.env[key]);
    
    // Return validation result
    if (missing.length > 0) {
      return { valid: false, missing };
    }

    return {
      valid: true,
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      username: process.env.EMAIL_USERNAME,
      password: process.env.EMAIL_PASSWORD,
      from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
      fromName: process.env.EMAIL_FROM_NAME || 'Bugema IT Support'
    };
  }

  /**
   * Verify SMTP connection with retry logic
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service connected to Gmail successfully');
      this.retryCount = 0;
    } catch (error) {
      console.error('❌ Email connection failed:', error.message);
      
      // Retry connection with exponential backoff
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryCount * 2;
        console.log(`🔄 Retrying connection in ${delay} seconds... (Attempt ${this.retryCount}/${this.maxRetries})`);
        setTimeout(() => this.verifyConnection(), delay * 1000);
      } else {
        console.log('📧 Maximum retries reached. Falling back to logging mode');
        this.setupFallbackLogging();
      }
    }
  }

  /**
   * Setup fallback logging for development/testing
   */
  setupFallbackLogging() {
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    console.log('📧 Running in development mode - emails will be logged to logs/emails.log');
  }

  // ==========================================================================
  // EMAIL SENDING
  // ==========================================================================

  /**
   * Send email with automatic retry and queue management
   * 
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject
   * @param {string} options.template - Template name
   * @param {Object} options.context - Template context data
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(options) {
    // Validate email address
    if (!this.validateEmail(options.to)) {
      return this.handleError('Invalid email address', options);
    }

    // Add email to queue for processing
    return new Promise((resolve) => {
      this.queue.push({ options, resolve });
      this.processQueue();
    });
  }

  /**
   * Process email queue with rate limiting
   */
  async processQueue() {
    // Prevent concurrent queue processing
    if (this.processingQueue || this.queue.length === 0) return;
    
    this.processingQueue = true;
    
    while (this.queue.length > 0) {
      const { options, resolve } = this.queue.shift();
      
      try {
        const result = await this.sendEmailDirect(options);
        resolve(result);
      } catch (error) {
        const errorResult = this.handleError(error.message, options);
        resolve(errorResult);
      }
      
      // Rate limiting: 100ms delay between emails to prevent spam flags
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.processingQueue = false;
  }

  /**
   * Start automatic queue processor (runs every second)
   */
  startQueueProcessor() {
    setInterval(() => this.processQueue(), 1000);
  }

  /**
   * Direct email sending with retry logic
   * 
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Send result
   */
  async sendEmailDirect(options) {
  const emailConfig = this.getEmailConfig();
  
  // If not configured, log to file
  if (!this.isConfigured || !this.transporter) {
    console.log('📧 Email not sent - transporter not configured');
    return this.logEmailToFile(options);
  }

    // Production sending with retry logic (3 attempts)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const mailOptions = {
          from: `${emailConfig.fromName} <${emailConfig.from}>`,
          to: options.to,
          subject: options.subject,
          html: this.getTemplate(options.template, options.context),
          text: options.text || this.getTextVersion(options.template, options.context),
          replyTo: process.env.EMAIL_REPLY_TO || emailConfig.from,
          headers: {
            'X-Priority': '1',
            'X-Mailer': 'BugemaITSupport/3.0'
          }
        };

        const info = await this.transporter.sendMail(mailOptions);
        
        console.log('✅ Email sent successfully:', {
          to: options.to,
          messageId: info.messageId,
          subject: options.subject.substring(0, 50)
        });

        return {
          success: true,
          messageId: info.messageId,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        console.error(`❌ Email attempt ${attempt} failed:`, error.message);
        
        // If this was the final attempt, log to file as fallback
        if (attempt === 3) {
          return this.logEmailToFile(options, error.message);
        }
        
        // Wait before retry (exponential backoff: 1s, 2s, 3s)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  /**
   * Log email to file (fallback for development/failures)
   * 
   * @param {Object} options - Email options
   * @param {string} error - Error message (if any)
   * @returns {Object} Log result
   */
  logEmailToFile(options, error = null) {
    const logsDir = path.join(__dirname, '../../logs');
    const emailLogFile = path.join(logsDir, 'emails.log');
    
    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      to: options.to,
      subject: options.subject,
      template: options.template,
      context: options.context,
      error: error,
      mode: this.isConfigured ? 'production-fallback' : 'development'
    };
    
    // Append to log file
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(emailLogFile, logLine, { encoding: 'utf8' });
    
    console.log('📧 Email logged to file:', {
      to: options.to,
      subject: options.subject,
      logFile: 'logs/emails.log'
    });
    
    return {
      success: !error,
      simulated: true,
      logged: true,
      error: error,
      timestamp: new Date().toISOString()
    };
  }

  // ==========================================================================
  // EMAIL TEMPLATES
  // ==========================================================================

  /**
   * Get HTML email template
   * 
   * @param {string} template - Template name
   * @param {Object} context - Template context data
   * @returns {string} HTML email content
   */
  getTemplate(template, context = {}) {
    const templates = {
      // ========================================================================
      // EMAIL VERIFICATION TEMPLATE
      // ========================================================================
      emailVerification: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - Bugema University</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #1a56db 0%, #1e40af 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px; }
            .button { display: inline-block; padding: 15px 30px; background: #1a56db; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; margin: 25px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
            .university-logo { font-size: 28px; font-weight: bold; color: white; margin-bottom: 10px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; color: #856404; }
            .code { background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 14px; margin: 10px 0; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="university-logo">BUGEMA UNIVERSITY</div>
              <h1 style="margin: 10px 0; font-weight: 300;">IT Support System</h1>
            </div>
            
            <div class="content">
              <h2 style="color: #1a56db; margin-top: 0;">Verify Your Email Address</h2>
              
              <p>Dear <strong>${context.name || 'Valued User'}</strong>,</p>
              
              <p>Welcome to the Bugema University IT Support System! To complete your registration and access all features, please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${context.verificationUrl}" class="button" style="color: white; text-decoration: none;">Verify Email Address</a>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> This verification link will expire in <strong>24 hours</strong>.
              </div>
              
              <p>If the button doesn't work, copy and paste this URL into your browser:</p>
              <div class="code">${context.verificationUrl}</div>
              
              <p>If you didn't create an account with Bugema University IT Support, please ignore this email or contact our support team immediately.</p>
              
              <p style="margin-top: 30px;">
                Best regards,<br>
                <strong>IT Support Team</strong><br>
                Bugema University<br>
                <small style="color: #6c757d;">Providing technical excellence since 1948</small>
              </p>
            </div>
            
            <div class="footer">
              <p>© ${new Date().getFullYear()} Bugema University. All rights reserved.</p>
              <p>This is an automated message. Please do not reply to this email.</p>
              <p>For assistance, contact: <a href="mailto:itsupport@bugema.ac.ug">itsupport@bugema.ac.ug</a></p>
            </div>
          </div>
        </body>
        </html>
      `,

      // ========================================================================
      // PASSWORD RESET REQUEST TEMPLATE
      // ========================================================================
      passwordReset: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset - Bugema University</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px; }
            .button { display: inline-block; padding: 15px 30px; background: #dc2626; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; margin: 25px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
            .security-alert { background: #fee; border: 1px solid #fcc; border-radius: 5px; padding: 15px; margin: 20px 0; color: #c00; }
            .code { background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 14px; margin: 10px 0; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-weight: 300;">🔒 Password Reset Request</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">Bugema University IT Support System</p>
            </div>
            
            <div class="content">
              <h2 style="color: #dc2626; margin-top: 0;">Reset Your Password</h2>
              
              <p>Hello <strong>${context.name || 'User'}</strong>,</p>
              
              <p>We received a request to reset your password for the Bugema University IT Support System. To reset your password, click the button below:</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${context.resetUrl}" class="button" style="color: white; text-decoration: none;">Reset Password</a>
              </div>
              
              <div class="security-alert">
                <strong>🔐 Security Notice:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>This link expires in <strong>10 minutes</strong></li>
                  <li>If you didn't request this reset, ignore this email</li>
                  <li>Never share your password or this link with anyone</li>
                  <li>Contact support immediately if suspicious</li>
                </ul>
              </div>
              
              <p>If the button doesn't work, use this link:</p>
              <div class="code">${context.resetUrl}</div>
              
              <p style="margin-top: 30px;">
                Best regards,<br>
                <strong>IT Security Team</strong><br>
                Bugema University
              </p>
            </div>
            
            <div class="footer">
              <p>© ${new Date().getFullYear()} Bugema University IT Security</p>
              <p>This is an automated security message. Do not reply.</p>
              <p>For security concerns: <a href="mailto:security@bugema.ac.ug">security@bugema.ac.ug</a></p>
            </div>
          </div>
        </body>
        </html>
      `,

      // ========================================================================
      // PASSWORD RESET SUCCESS TEMPLATE
      // ========================================================================
      passwordResetSuccess: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Successful - Bugema University</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px; }
            .button { display: inline-block; padding: 15px 30px; background: #059669; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; margin: 25px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
            .success-icon { font-size: 48px; margin-bottom: 20px; }
            .security-tips { background: #f0fdf4; border: 1px solid #86efac; border-radius: 5px; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="success-icon">✅</div>
              <h1 style="margin: 0; font-weight: 300;">Password Reset Successful</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">Bugema University IT Support System</p>
            </div>
            
            <div class="content">
              <h2 style="color: #059669; margin-top: 0;">Your Password Has Been Changed</h2>
              
              <p>Hello <strong>${context.name || 'User'}</strong>,</p>
              
              <p>This email confirms that your password for the Bugema University IT Support System has been successfully reset and updated.</p>
              
              <div class="security-tips">
                <strong>🔐 Security Tips:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                  <li>Never share your password with anyone</li>
                  <li>Use a unique password for each account</li>
                  <li>Enable two-factor authentication when available</li>
                  <li>Change your password regularly</li>
                </ul>
              </div>
              
              <p><strong>⚠️ Important:</strong> If you did NOT make this change, please contact our IT Security team immediately at <a href="mailto:security@bugema.ac.ug">security@bugema.ac.ug</a></p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/login" class="button" style="color: white; text-decoration: none;">Login to Your Account</a>
              </div>
              
              <p style="margin-top: 30px;">
                Best regards,<br>
                <strong>IT Security Team</strong><br>
                Bugema University<br>
                <small style="color: #6c757d;">Keeping your account secure since 1948</small>
              </p>
            </div>
            
            <div class="footer">
              <p>© ${new Date().getFullYear()} Bugema University IT Security</p>
              <p>This is an automated security notification. Please do not reply.</p>
              <p>For security concerns: <a href="mailto:security@bugema.ac.ug">security@bugema.ac.ug</a></p>
            </div>
          </div>
        </body>
        </html>
      `,

      // ========================================================================
      // WELCOME EMAIL TEMPLATE
      // ========================================================================
      welcome: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Bugema IT Support</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 40px 20px; text-align: center; }
            .content { padding: 40px; }
            .button { display: inline-block; padding: 15px 30px; background: #059669; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; margin: 25px 0; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
            .features { background: #f0fdf4; border-radius: 5px; padding: 20px; margin: 20px 0; }
            .feature-item { margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-weight: 300;">Welcome to Bugema IT Support! 👋</h1>
            </div>
            
            <div class="content">
              <h2 style="color: #059669; margin-top: 0;">Hello ${context.name}!</h2>
              
              <p>Your account is now fully activated and ready to use.</p>
              
              <div class="features">
                <h3 style="margin-top: 0; color: #059669;">What You Can Do:</h3>
                <div class="feature-item">✓ Submit IT support tickets</div>
                <div class="feature-item">✓ Track ticket status in real-time</div>
                <div class="feature-item">✓ Access knowledge base articles</div>
                <div class="feature-item">✓ Receive priority support notifications</div>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" class="button" style="color: white; text-decoration: none;">Go to Dashboard</a>
              </div>
              
              <p>If you need any assistance, our support team is here to help!</p>
              
              <p style="margin-top: 30px;">
                Best regards,<br>
                <strong>Bugema University IT Support Team</strong>
              </p>
            </div>
            
            <div class="footer">
              <p>© ${new Date().getFullYear()} Bugema University</p>
              <p>For assistance: <a href="mailto:itsupport@bugema.ac.ug">itsupport@bugema.ac.ug</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      // ========================================================================
// TICKET SYSTEM EMAIL TEMPLATES - Add these to your templates object
// ========================================================================

/**
 * Ticket Created Confirmation
 */
ticketCreated: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Created - Bugema University IT Support</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1a56db 0%, #1e40af 100%); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 30px; }
    .ticket-info { background: #f8f9fa; border-radius: 5px; padding: 20px; margin: 20px 0; }
    .ticket-detail { margin: 10px 0; display: flex; justify-content: space-between; border-bottom: 1px solid #e9ecef; padding: 5px 0; }
    .ticket-detail:last-child { border-bottom: none; }
    .status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .status-open { background: #10b981; color: white; }
    .status-critical { background: #dc2626; color: white; }
    .button { display: inline-block; padding: 12px 24px; background: #1a56db; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 15px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-weight: 300;">🎫 Ticket Created Successfully</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Bugema University IT Support System</p>
    </div>
    
    <div class="content">
      <h2 style="color: #1a56db; margin-top: 0;">Hello ${context.name || 'Valued User'}!</h2>
      
      <p>Your support ticket has been created successfully. Here are the details:</p>
      
      <div class="ticket-info">
        <div class="ticket-detail">
          <strong>Ticket Number:</strong>
          <span style="font-weight: bold; color: #1a56db;">${context.ticketNumber}</span>
        </div>
        <div class="ticket-detail">
          <strong>Title:</strong>
          <span>${context.title}</span>
        </div>
        <div class="ticket-detail">
          <strong>Category:</strong>
          <span>${context.category}</span>
        </div>
        <div class="ticket-detail">
          <strong>Priority:</strong>
          <span class="status-badge ${context.priority === 'Critical' ? 'status-critical' : 'status-open'}">
            ${context.priority}
          </span>
        </div>
        <div class="ticket-detail">
          <strong>Status:</strong>
          <span class="status-badge status-open">${context.status || 'Open'}</span>
        </div>
        <div class="ticket-detail">
          <strong>Created:</strong>
          <span>${new Date(context.createdAt).toLocaleString()}</span>
        </div>
      </div>
      
      <p>You can track your ticket status using this link:</p>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${context.ticketUrl}" class="button" style="color: white; text-decoration: none;">
          View Ticket Status
        </a>
      </div>
      
      <p><strong>📞 Need immediate help?</strong><br>
      Contact our support team:<br>
      Email: <a href="mailto:itsupport@bugemauniv.ac.ug">itsupport@bugemauniv.ac.ug</a><br>
      Phone: <a href="tel:0784845785">0784845785</a></p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>Bugema University IT Support Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} Bugema University IT Support</p>
      <p>This is an automated notification. Please do not reply.</p>
      <p>For assistance: <a href="mailto:itsupport@bugemauniv.ac.ug">itsupport@bugemauniv.ac.ug</a></p>
    </div>
  </div>
</body>
</html>
`,

/**
 * Ticket Assigned to Technician
 */
ticketAssigned: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Ticket Assigned - Bugema University IT Support</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 30px; }
    .ticket-info { background: #f8f9fa; border-radius: 5px; padding: 20px; margin: 20px 0; }
    .ticket-detail { margin: 10px 0; }
    .priority-high { color: #dc2626; font-weight: bold; }
    .deadline { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 5px; padding: 15px; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 15px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-weight: 300;">🎯 New Ticket Assigned</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Bugema University IT Support System</p>
    </div>
    
    <div class="content">
      <h2 style="color: #8b5cf6; margin-top: 0;">Hello ${context.technicianName || 'Technician'}!</h2>
      
      <p>A new ticket has been assigned to you. Please review and take action:</p>
      
      <div class="ticket-info">
        <div class="ticket-detail">
          <strong>Ticket Number:</strong> ${context.ticketNumber}
        </div>
        <div class="ticket-detail">
          <strong>Title:</strong> ${context.title}
        </div>
        <div class="ticket-detail">
          <strong>Category:</strong> ${context.category}
        </div>
        <div class="ticket-detail">
          <strong>Priority:</strong> 
          <span class="${context.priority === 'High' || context.priority === 'Critical' ? 'priority-high' : ''}">
            ${context.priority}
          </span>
        </div>
        <div class="ticket-detail">
          <strong>Submitted By:</strong> ${context.submittedBy}
        </div>
        <div class="ticket-detail">
          <strong>Department:</strong> ${context.department || 'Not specified'}
        </div>
        <div class="ticket-detail">
          <strong>Description:</strong><br>
          <p style="background: #f1f5f9; padding: 10px; border-radius: 5px; margin: 5px 0;">
            ${context.description}
          </p>
        </div>
      </div>
      
      ${context.dueDate ? `
      <div class="deadline">
        <strong>⚠️ Response Deadline:</strong><br>
        ${new Date(context.dueDate).toLocaleString()}<br>
        <small>Please respond before this deadline to meet SLA requirements</small>
      </div>
      ` : ''}
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${context.ticketUrl}" class="button" style="color: white; text-decoration: none;">
          View Ticket Details
        </a>
      </div>
      
      <p><strong>📋 Required Actions:</strong></p>
      <ol>
        <li>Review ticket details</li>
        <li>Acknowledge assignment</li>
        <li>Contact user if needed</li>
        <li>Begin investigation</li>
        <li>Update ticket status</li>
      </ol>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>Bugema University IT Support Management</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} Bugema University IT Support</p>
      <p>This is an automated assignment notification.</p>
    </div>
  </div>
</body>
</html>
`,

/**
 * Ticket Status Updated
 */
ticketStatusUpdate: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Status Update - Bugema University IT Support</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 30px; }
    .update-info { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0; }
    .status-change { background: #e0f2fe; border-radius: 5px; padding: 15px; margin: 15px 0; display: flex; align-items: center; }
    .status-icon { font-size: 24px; margin-right: 15px; }
    .button { display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 15px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-weight: 300;">📊 Ticket Status Update</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Bugema University IT Support System</p>
    </div>
    
    <div class="content">
      <h2 style="color: #0ea5e9; margin-top: 0;">Hello ${context.userName}!</h2>
      
      <p>The status of your ticket has been updated:</p>
      
      <div class="status-change">
        <div class="status-icon">
          ${context.newStatus === 'Resolved' ? '✅' : 
            context.newStatus === 'In Progress' ? '🔄' : 
            context.newStatus === 'Closed' ? '🔒' : '📝'}
        </div>
        <div>
          <strong>${context.ticketNumber} - ${context.title}</strong><br>
          Status changed from <strong>${context.oldStatus}</strong> to <strong>${context.newStatus}</strong>
        </div>
      </div>
      
      ${context.updateNotes ? `
      <div class="update-info">
        <strong>Update Notes:</strong><br>
        ${context.updateNotes}
      </div>
      ` : ''}
      
      ${context.updatedBy ? `
      <p><strong>Updated by:</strong> ${context.updatedBy}</p>
      ` : ''}
      
      <p><strong>Next Steps:</strong><br>
      ${context.nextSteps || 'Please check the ticket for more details and updates.'}</p>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${context.ticketUrl}" class="button" style="color: white; text-decoration: none;">
          View Updated Ticket
        </a>
      </div>
      
      ${context.contactInfo ? `
      <p><strong>📞 Need to discuss this update?</strong><br>
      Contact the assigned technician:<br>
      ${context.contactInfo}</p>
      ` : ''}
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>Bugema University IT Support Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} Bugema University IT Support</p>
      <p>This is an automated status update notification.</p>
      <p>For questions: <a href="mailto:itsupport@bugemauniv.ac.ug">itsupport@bugemauniv.ac.ug</a></p>
    </div>
  </div>
</body>
</html>
`,

/**
 * Ticket Resolution Notification
 */
ticketResolved: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Resolved - Bugema University IT Support</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 30px; }
    .resolution-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 5px; padding: 20px; margin: 20px 0; }
    .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
    .stats { background: #f8f9fa; border-radius: 5px; padding: 15px; margin: 20px 0; }
    .stat-item { display: flex; justify-content: space-between; margin: 10px 0; }
    .feedback { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 5px; padding: 20px; margin: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 15px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="success-icon">✅</div>
      <h1 style="margin: 0; font-weight: 300;">Issue Resolved!</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Bugema University IT Support System</p>
    </div>
    
    <div class="content">
      <h2 style="color: #10b981; margin-top: 0;">Great news, ${context.userName}!</h2>
      
      <p>Your support ticket has been resolved. Here are the details:</p>
      
      <div class="resolution-box">
        <h3 style="margin-top: 0; color: #059669;">Resolution Summary</h3>
        <p><strong>Ticket:</strong> ${context.ticketNumber} - ${context.title}</p>
        <p><strong>Resolved by:</strong> ${context.resolvedBy}</p>
        <p><strong>Resolution Time:</strong> ${context.resolutionTime}</p>
        
        <p><strong>Resolution Details:</strong></p>
        <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
          ${context.resolutionDetails}
        </div>
      </div>
      
      <div class="stats">
        <h4 style="margin-top: 0; color: #6b7280;">Ticket Statistics</h4>
        <div class="stat-item">
          <span>Time to Resolution:</span>
          <span><strong>${context.resolutionTime}</strong></span>
        </div>
        <div class="stat-item">
          <span>Status:</span>
          <span style="color: #10b981; font-weight: bold;">✅ Resolved</span>
        </div>
        ${context.slaMet !== undefined ? `
        <div class="stat-item">
          <span>SLA Compliance:</span>
          <span style="${context.slaMet ? 'color: #10b981' : 'color: #dc2626'}; font-weight: bold;">
            ${context.slaMet ? '✅ Met' : '⚠️ Breached'}
          </span>
        </div>
        ` : ''}
      </div>
      
      <div class="feedback">
        <h4 style="margin-top: 0; color: #d97706;">📝 How was your experience?</h4>
        <p>Your feedback helps us improve our service. Please take a moment to rate your experience:</p>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="${context.feedbackUrl}" class="button" style="background: #f59e0b; color: white; text-decoration: none;">
            Provide Feedback
          </a>
        </div>
        
        <p style="font-size: 12px; color: #92400e;">
          <strong>Note:</strong> This ticket will be automatically closed in 7 days unless reopened.
        </p>
      </div>
      
      <p><strong>🔧 Need further assistance?</strong><br>
      If your issue is not fully resolved, you can:<br>
      1. Add a comment to the ticket<br>
      2. Contact the technician directly<br>
      3. Reopen the ticket if needed</p>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${context.ticketUrl}" class="button" style="color: white; text-decoration: none;">
          View Complete Resolution
        </a>
      </div>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>Bugema University IT Support Team</strong><br>
        <small style="color: #6c757d;">Thank you for choosing Bugema University IT Support</small>
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} Bugema University IT Support</p>
      <p>This is an automated resolution notification.</p>
      <p>For assistance: <a href="mailto:itsupport@bugemauniv.ac.ug">itsupport@bugemauniv.ac.ug</a> | <a href="tel:0784845785">0784845785</a></p>
    </div>
  </div>
</body>
</html>
`,

/**
 * New Comment Added Notification
 */
newComment: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Comment on Ticket - Bugema University IT Support</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 30px; }
    .comment-box { background: #fef3c7; border-radius: 5px; padding: 20px; margin: 20px 0; position: relative; }
    .comment-box:before { content: '💬'; position: absolute; left: -10px; top: 20px; font-size: 24px; }
    .comment-author { font-weight: bold; color: #d97706; margin-bottom: 5px; }
    .comment-time { font-size: 12px; color: #92400e; }
    .comment-text { margin: 10px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 15px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
    .internal-note { border-left: 4px solid #dc2626; background: #fef2f2; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-weight: 300;">💬 New Comment Added</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Bugema University IT Support System</p>
    </div>
    
    <div class="content">
      <h2 style="color: #f59e0b; margin-top: 0;">Hello ${context.recipientName}!</h2>
      
      <p>A new comment has been added to your ticket:</p>
      
      <div class="comment-box ${context.isInternal ? 'internal-note' : ''}">
        <div class="comment-author">
          ${context.commenterName} ${context.isInternal ? '(Internal Note)' : ''}
        </div>
        <div class="comment-time">
          ${new Date(context.commentTime).toLocaleString()}
        </div>
        <div class="comment-text">
          ${context.commentText}
        </div>
      </div>
      
      ${context.isInternal ? `
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 5px; padding: 10px; margin: 15px 0;">
        <strong>⚠️ Internal Note:</strong> This comment is visible only to IT staff.
      </div>
      ` : ''}
      
      <p><strong>Ticket Details:</strong></p>
      <ul>
        <li><strong>Ticket:</strong> ${context.ticketNumber}</li>
        <li><strong>Title:</strong> ${context.ticketTitle}</li>
        <li><strong>Status:</strong> ${context.ticketStatus}</li>
      </ul>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${context.ticketUrl}" class="button" style="color: white; text-decoration: none;">
          View Ticket & Reply
        </a>
      </div>
      
      ${context.canReply ? `
      <p><strong>💡 Need to respond?</strong><br>
      You can reply directly in the ticket or contact the commenter:</p>
      
      <div style="background: #f1f5f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <strong>Contact Information:</strong><br>
        Commenter: ${context.commenterName}<br>
        ${context.commenterEmail ? `Email: ${context.commenterEmail}<br>` : ''}
        ${context.commenterPhone ? `Phone: ${context.commenterPhone}` : ''}
      </div>
      ` : ''}
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>Bugema University IT Support Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} Bugema University IT Support</p>
      <p>This is an automated comment notification.</p>
      <p>For assistance: <a href="mailto:itsupport@bugemauniv.ac.ug">itsupport@bugemauniv.ac.ug</a></p>
    </div>
  </div>
</body>
</html>
`,

/**
 * SLA Breach Alert
 */
slaBreachAlert: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚠️ SLA Breach Alert - Bugema University IT Support</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px 20px; text-align: center; }
    .content { padding: 30px; }
    .alert-box { background: #fef2f2; border: 2px solid #dc2626; border-radius: 5px; padding: 20px; margin: 20px 0; }
    .breach-type { display: inline-block; padding: 5px 15px; background: #dc2626; color: white; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 10px; }
    .deadline-info { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 5px; padding: 15px; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 15px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-weight: 300;">⚠️ SLA Breach Alert</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Bugema University IT Support System</p>
    </div>
    
    <div class="content">
      <h2 style="color: #dc2626; margin-top: 0;">URGENT: Service Level Agreement Breach</h2>
      
      <div class="alert-box">
        <div class="breach-type">${context.breachType.toUpperCase()} BREACH</div>
        <h3 style="margin: 10px 0; color: #dc2626;">${context.ticketNumber} - ${context.title}</h3>
        
        <p><strong>Breach Details:</strong></p>
        <ul>
          <li><strong>Breach Type:</strong> ${context.breachType}</li>
          <li><strong>Breached At:</strong> ${new Date(context.breachTime).toLocaleString()}</li>
          <li><strong>Target Time:</strong> ${context.targetTime}</li>
          <li><strong>Actual Time:</strong> ${context.actualTime}</li>
          <li><strong>Delay:</strong> ${context.delayAmount}</li>
        </ul>
        
        <p><strong>Assigned Technician:</strong> ${context.assignedTo || 'Unassigned'}</p>
        <p><strong>Ticket Priority:</strong> ${context.priority}</p>
      </div>
      
      <div class="deadline-info">
        <strong>🕒 SLA Requirements:</strong><br>
        ${context.slaRequirements}
      </div>
      
      <p><strong>🚨 Required Actions:</strong></p>
      <ol>
        <li>Immediately review the ticket</li>
        <li>Escalate to supervisor if needed</li>
        <li>Contact the user to apologize</li>
        <li>Provide revised timeline</li>
        <li>Document breach in system</li>
      </ol>
      
      <div style="text-align: center; margin: 20px 0;">
        <a href="${context.ticketUrl}" class="button" style="color: white; text-decoration: none;">
          Take Action Now
        </a>
      </div>
      
      ${context.escalationInfo ? `
      <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 5px; padding: 15px; margin: 15px 0;">
        <strong>📈 Escalation Information:</strong><br>
        ${context.escalationInfo}
      </div>
      ` : ''}
      
      <p><strong>📞 Contact Information:</strong><br>
      Supervisor: ${context.supervisorContact || 'N/A'}<br>
      IT Manager: ${context.managerContact || 'N/A'}</p>
      
      <p style="margin-top: 30px; font-size: 12px; color: #6c757d;">
        <strong>Note:</strong> This breach will be logged in performance metrics and may affect SLA compliance reports.
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} Bugema University IT Support</p>
      <p>This is an automated SLA compliance alert.</p>
      <p>For escalation: <a href="mailto:sla@bugemauniv.ac.ug">sla@bugemauniv.ac.ug</a></p>
    </div>
  </div>
</body>
</html>
`
    };

    return templates[template] || `<p>${context.message || 'Notification from Bugema University IT Support'}</p>`;
  }

  /**
   * Get plain text version of email (for email clients that don't support HTML)
   * 
   * @param {string} template - Template name
   * @param {Object} context - Template context data
   * @returns {string} Plain text email content
   */
  getTextVersion(template, context = {}) {
    const textVersions = {
      emailVerification: `
BUGEMA UNIVERSITY IT SUPPORT SYSTEM
===================================

EMAIL VERIFICATION REQUIRED

Dear ${context.name || 'User'},

Thank you for registering with Bugema University IT Support System.

VERIFICATION LINK: ${context.verificationUrl}

This link expires in 24 hours.

If you didn't create this account, please ignore this email.

Best regards,
IT Support Team
Bugema University

-----------------------------------
This is an automated message.
Contact: itsupport@bugema.ac.ug
      `,

      passwordReset: `
BUGEMA UNIVERSITY IT SUPPORT SYSTEM
===================================

PASSWORD RESET REQUEST

Hello ${context.name || 'User'},

Reset your password using this link:
${context.resetUrl}

⚠️ SECURITY NOTICE:
- Link expires in 10 minutes
- If you didn't request this, ignore this email
- Never share this link with anyone

Best regards,
IT Security Team
Bugema University

-----------------------------------
Security contact: security@bugema.ac.ug
      `,

      passwordResetSuccess: `
BUGEMA UNIVERSITY IT SUPPORT SYSTEM
===================================

✅ PASSWORD RESET SUCCESSFUL

Hello ${context.name || 'User'},

Your password has been successfully reset and updated.

🔐 SECURITY TIPS:
- Never share your password
- Use unique passwords for each account
- Enable 2FA when available
- Change passwords regularly

⚠️ IMPORTANT: If you didn't make this change, contact security immediately.

Login: ${process.env.CLIENT_URL || 'http://localhost:3000'}/login

Best regards,
IT Security Team
Bugema University

-----------------------------------
Security contact: security@bugema.ac.ug
      `,

      welcome: `
BUGEMA UNIVERSITY IT SUPPORT SYSTEM
===================================

WELCOME! 👋

Hello ${context.name}!

Your account is now fully activated.

WHAT YOU CAN DO:
✓ Submit IT support tickets
✓ Track ticket status in real-time
✓ Access knowledge base articles
✓ Receive priority support notifications

Dashboard: ${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard

Best regards,
Bugema University IT Support Team

-----------------------------------
Contact: itsupport@bugema.ac.ug
      `,
      ticketCreated: `
BUGEMA UNIVERSITY IT SUPPORT SYSTEM
===================================

🎫 TICKET CREATED SUCCESSFULLY

Hello ${context.name || 'User'}!

Your support ticket has been created successfully.

TICKET DETAILS:
- Ticket Number: ${context.ticketNumber}
- Title: ${context.title}
- Category: ${context.category}
- Priority: ${context.priority}
- Status: ${context.status || 'Open'}
- Created: ${new Date(context.createdAt).toLocaleString()}

VIEW TICKET: ${context.ticketUrl}

📞 Immediate Assistance:
Email: itsupport@bugemauniv.ac.ug
Phone: 0784845785

Best regards,
Bugema University IT Support Team

-----------------------------------
Automated notification - Do not reply
`,

ticketAssigned: `
BUGEMA UNIVERSITY IT SUPPORT SYSTEM
===================================

🎯 NEW TICKET ASSIGNED

Hello ${context.technicianName || 'Technician'}!

A new ticket has been assigned to you.

TICKET DETAILS:
- Ticket: ${context.ticketNumber}
- Title: ${context.title}
- Category: ${context.category}
- Priority: ${context.priority}
- Submitted by: ${context.submittedBy}
- Department: ${context.department || 'N/A'}

DESCRIPTION:
${context.description}

${context.dueDate ? `
⚠️ RESPONSE DEADLINE: ${new Date(context.dueDate).toLocaleString()}
Please respond before this deadline to meet SLA requirements.
` : ''}

VIEW TICKET: ${context.ticketUrl}

REQUIRED ACTIONS:
1. Review ticket details
2. Acknowledge assignment
3. Contact user if needed
4. Begin investigation
5. Update ticket status

Best regards,
Bugema University IT Support Management

-----------------------------------
Automated assignment notification
`,

ticketStatusUpdate: `
BUGEMA UNIVERSITY IT SUPPORT SYSTEM
===================================

📊 TICKET STATUS UPDATE

Hello ${context.userName}!

Your ticket status has been updated.

TICKET: ${context.ticketNumber} - ${context.title}
STATUS: ${context.oldStatus} → ${context.newStatus}

${context.updateNotes ? `
UPDATE NOTES:
${context.updateNotes}
` : ''}

${context.updatedBy ? `Updated by: ${context.updatedBy}` : ''}

VIEW UPDATED TICKET: ${context.ticketUrl}

${context.contactInfo ? `
📞 Contact: ${context.contactInfo}
` : ''}

Best regards,
Bugema University IT Support Team

-----------------------------------
Automated status update
`,

ticketResolved: `
BUGEMA UNIVERSITY IT SUPPORT SYSTEM
===================================

✅ TICKET RESOLVED

Hello ${context.userName}!

Your support ticket has been resolved.

TICKET: ${context.ticketNumber} - ${context.title}
RESOLVED BY: ${context.resolvedBy}
RESOLUTION TIME: ${context.resolutionTime}

RESOLUTION DETAILS:
${context.resolutionDetails}

STATISTICS:
- Time to Resolution: ${context.resolutionTime}
- Status: Resolved
${context.slaMet !== undefined ? `- SLA Compliance: ${context.slaMet ? 'Met' : 'Breached'}` : ''}

📝 FEEDBACK REQUESTED:
Please provide feedback at: ${context.feedbackUrl}

Note: Ticket will auto-close in 7 days unless reopened.

VIEW COMPLETE RESOLUTION: ${context.ticketUrl}

🔧 Further Assistance:
1. Add a comment to the ticket
2. Contact the technician directly
3. Reopen ticket if needed

Best regards,
Bugema University IT Support Team

-----------------------------------
Automated resolution notification
`,

newComment: `
BUGEMA UNIVERSITY IT SUPPORT SYSTEM
===================================

💬 NEW COMMENT ADDED

Hello ${context.recipientName}!

A new comment has been added to your ticket.

TICKET: ${context.ticketNumber} - ${context.ticketTitle}
COMMENTER: ${context.commenterName} ${context.isInternal ? '(Internal Note)' : ''}
TIME: ${new Date(context.commentTime).toLocaleString()}

COMMENT:
${context.commentText}

${context.isInternal ? '⚠️ NOTE: This is an internal comment visible only to IT staff.' : ''}

VIEW TICKET: ${context.ticketUrl}

${context.canReply ? `
💡 Need to respond?
You can reply directly in the ticket or contact the commenter.

CONTACT INFORMATION:
Commenter: ${context.commenterName}
${context.commenterEmail ? `Email: ${context.commenterEmail}` : ''}
${context.commenterPhone ? `Phone: ${context.commenterPhone}` : ''}
` : ''}

Best regards,
Bugema University IT Support Team

-----------------------------------
Automated comment notification
`,

slaBreachAlert: `
BUGEMA UNIVERSITY IT SUPPORT SYSTEM
===================================

⚠️ SLA BREACH ALERT

URGENT: Service Level Agreement Breach

TICKET: ${context.ticketNumber} - ${context.title}
BREACH TYPE: ${context.breachType}
BREACHED AT: ${new Date(context.breachTime).toLocaleString()}
TARGET TIME: ${context.targetTime}
ACTUAL TIME: ${context.actualTime}
DELAY: ${context.delayAmount}

ASSIGNED TECHNICIAN: ${context.assignedTo || 'Unassigned'}
PRIORITY: ${context.priority}

🚨 REQUIRED ACTIONS:
1. Immediately review the ticket
2. Escalate to supervisor if needed
3. Contact the user to apologize
4. Provide revised timeline
5. Document breach in system

VIEW TICKET: ${context.ticketUrl}

${context.escalationInfo ? `
ESCALATION INFORMATION:
${context.escalationInfo}
` : ''}

CONTACT INFORMATION:
Supervisor: ${context.supervisorContact || 'N/A'}
IT Manager: ${context.managerContact || 'N/A'}

Note: This breach will be logged in performance metrics.

Best regards,
SLA Compliance System

-----------------------------------
Automated SLA alert - Immediate action required
`
    };

    return textVersions[template] || 'Notification from Bugema University IT Support System';
  }

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  /**
   * Send email verification email
   * 
   * @param {string} to - Recipient email
   * @param {string} name - User name
   * @param {string} verificationUrl - Verification URL
   * @returns {Promise<Object>} Send result
   */
  async sendVerificationEmail(to, name, verificationUrl) {
    return this.sendEmail({
      to,
      subject: 'Verify Your Email - Bugema University IT Support',
      template: 'emailVerification',
      context: { name, verificationUrl }
    });
  }

  /**
   * Send password reset email
   * 
   * @param {string} to - Recipient email
   * @param {string} name - User name
   * @param {string} resetUrl - Password reset URL
   * @returns {Promise<Object>} Send result
   */
  async sendPasswordResetEmail(to, name, resetUrl) {
    return this.sendEmail({
      to,
      subject: '🔒 Password Reset Request - Bugema University',
      template: 'passwordReset',
      context: { name, resetUrl }
    });
  }

  /**
   * Send password reset success notification
   * 
   * @param {string} to - Recipient email
   * @param {string} name - User name
   * @returns {Promise<Object>} Send result
   */
  async sendPasswordResetSuccessEmail(to, name) {
    return this.sendEmail({
      to,
      subject: '✅ Password Reset Successful - Bugema University',
      template: 'passwordResetSuccess',
      context: { name }
    });
  }

  /**
   * Send welcome email
   * 
   * @param {string} to - Recipient email
   * @param {string} name - User name
   * @returns {Promise<Object>} Send result
   */
  async sendWelcomeEmail(to, name) {
    return this.sendEmail({
      to,
      subject: '👋 Welcome to Bugema University IT Support',
      template: 'welcome',
      context: { name }
    });
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Validate email address format
   * 
   * @param {string} email - Email address to validate
   * @returns {boolean} True if valid, false otherwise
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // RFC 5322 compliant email regex (simplified)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.toLowerCase());
  }

  /**
   * Handle email sending errors
   * 
   * @param {string} error - Error message
   * @param {Object} options - Original email options
   * @returns {Object} Error result
   */
  handleError(error, options) {
    console.error('❌ Email error:', {
      error,
      to: options.to,
      subject: options.subject
    });

    return {
      success: false,
      error: error,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get queue status
   * 
   * @returns {Object} Queue status information
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processingQueue,
      configured: this.isConfigured
    };
  }

  /**
 * Send ticket created confirmation email
 */
async sendTicketCreatedEmail(to, name, ticketData) {
  return this.sendEmail({
    to,
    subject: `🎫 Ticket Created: ${ticketData.ticketNumber} - Bugema University IT Support`,
    template: 'ticketCreated',
    context: {
      name,
      ...ticketData
    }
  });
}

/**
 * Send ticket assigned notification
 */
async sendTicketAssignedEmail(to, technicianName, ticketData) {
  return this.sendEmail({
    to,
    subject: `🎯 New Ticket Assigned: ${ticketData.ticketNumber}`,
    template: 'ticketAssigned',
    context: {
      technicianName,
      ...ticketData
    }
  });
}

/**
 * Send ticket status update
 */
async sendTicketStatusUpdateEmail(to, userName, updateData) {
  return this.sendEmail({
    to,
    subject: `📊 Ticket Status Update: ${updateData.ticketNumber}`,
    template: 'ticketStatusUpdate',
    context: {
      userName,
      ...updateData
    }
  });
}

/**
 * Send ticket resolution notification
 */
async sendTicketResolvedEmail(to, userName, resolutionData) {
  return this.sendEmail({
    to,
    subject: `✅ Ticket Resolved: ${resolutionData.ticketNumber} - ${resolutionData.title}`,
    template: 'ticketResolved',
    context: {
      userName,
      ...resolutionData
    }
  });
}

/**
 * Send new comment notification
 */
async sendNewCommentEmail(to, recipientName, commentData) {
  return this.sendEmail({
    to,
    subject: `💬 New Comment on Ticket: ${commentData.ticketNumber}`,
    template: 'newComment',
    context: {
      recipientName,
      ...commentData
    }
  });
}

/**
 * Send SLA breach alert
 */
async sendSLABreachAlert(to, breachData) {
  return this.sendEmail({
    to,
    subject: `⚠️ SLA BREACH: ${breachData.ticketNumber} - ${breachData.breachType}`,
    template: 'slaBreachAlert',
    context: breachData
  });
}
  /**
   * Clear email queue (useful for testing/debugging)
   * 
   * @returns {number} Number of emails cleared
   */
  clearQueue() {
    const clearedCount = this.queue.length;
    this.queue = [];
    console.log(`🗑️  Cleared ${clearedCount} emails from queue`);
    return clearedCount;
  }

  /**
   * Test email configuration
   * 
   * @returns {Promise<Object>} Test result
   */
  async testConnection() {
    if (!this.isConfigured) {
      return {
        success: false,
        message: 'Email service not configured',
        config: this.getEmailConfig()
      };
    }

    try {
      await this.transporter.verify();
      return {
        success: true,
        message: 'Email service is working correctly'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Connection failed',
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new EmailService();