/**
 * Email Configuration for Bugema University IT Support System
 * Production-ready email setup
 */
const nodemailer = require('nodemailer');

const emailConfig = {
  // SMTP Configuration
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  
  // Authentication
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  
  // Email Settings
  fromName: process.env.EMAIL_FROM_NAME || 'Bugema University IT Support',
  fromAddress: process.env.EMAIL_FROM_ADDRESS || 'support@bugemauniv.ac.ug',
  
  // Timeouts
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  
  // Logger for debugging
  logger: process.env.NODE_ENV === 'development',
  debug: process.env.NODE_ENV === 'development'
};

// Create transporter
let transporter;

try {
  transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: emailConfig.auth,
    connectionTimeout: emailConfig.connectionTimeout,
    greetingTimeout: emailConfig.greetingTimeout,
    logger: emailConfig.logger,
    debug: emailConfig.debug
  });
  
  console.log('✅ Email transporter initialized successfully');
  
  // Verify connection
  transporter.verify(function(error, success) {
    if (error) {
      console.error('❌ Email configuration error:', error.message);
      console.log('💡 To fix email issues:');
      console.log('   1. For Gmail: Enable "Less secure app access" or use App Password');
      console.log('   2. Check your SMTP credentials in .env file');
      console.log('   3. Ensure SMTP port is not blocked by firewall');
    } else {
      console.log('✅ Email server is ready to send messages');
    }
  });
  
} catch (error) {
  console.error('❌ Failed to create email transporter:', error.message);
  transporter = null;
}

module.exports = {
  transporter,
  emailConfig,
  
  getFromAddress() {
    return `"${emailConfig.fromName}" <${emailConfig.fromAddress}>`;
  },
  
  isEmailConfigured() {
    return transporter !== null && 
           emailConfig.auth.user && 
           emailConfig.auth.pass;
  }
};