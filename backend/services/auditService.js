/**
 * Safe Email Service - Development Version
 * Won't crash on connection errors
 */

const nodemailer = require('nodemailer');

class SafeEmailService {
  constructor() {
    this.transporter = null;
    this.enabled = false;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) {
      return;
    }

    // Check if email should be disabled
    if (process.env.DISABLE_EMAIL === 'true' || process.env.EMAIL_ENABLED === 'false') {
      console.log('📧 Email service disabled via environment variable');
      this.enabled = false;
      this.initialized = true;
      return;
    }

    try {
      const config = {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER || '',
          pass: process.env.EMAIL_PASS || ''
        },
        tls: {
          rejectUnauthorized: false
        }
      };

      // Only create transporter if credentials exist
      if (config.auth.user && config.auth.pass) {
        this.transporter = nodemailer.createTransport(config);
        
        // Test connection (non-blocking)
        this.transporter.verify()
          .then(() => {
            console.log('✅ Email service connected successfully');
            this.enabled = true;
          })
          .catch(verifyError => {
            console.warn('⚠️ Email connection test failed:', verifyError.message);
            console.log('📧 Emails will not be sent, but server will continue running');
            this.enabled = false;
          });
      } else {
        console.log('📧 Email credentials not configured, using mock mode');
        this.enabled = false;
      }

      this.initialized = true;
    } catch (error) {
      console.warn('⚠️ Email service initialization error:', error.message);
      console.log('📧 Using mock email mode');
      this.enabled = false;
      this.initialized = true;
    }
  }

  async sendEmail(to, subject, html, text = '') {
    if (!this.initialized) {
      await this.init();
    }

    if (!this.enabled) {
      // Mock sending - log but don't actually send
      console.log(`📨 [MOCK EMAIL] To: ${to}, Subject: "${subject}"`);
      console.log(`   Preview: ${html?.substring(0, 100)}${html?.length > 100 ? '...' : ''}`);
      return { success: true, message: 'Email logged (mock mode)' };
    }

    try {
      const mailOptions = {
        from: `"IT Support System" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: subject,
        html: html,
        text: text || html.replace(/<[^>]*>/g, '')
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📨 Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Email sending failed:', error.message);
      return { 
        success: false, 
        error: error.message,
        message: 'Email sending failed, but operation continues'
      };
    }
  }

  async verifyConnection() {
    if (!this.transporter) {
      return { success: false, message: 'No email transporter configured' };
    }

    try {
      await this.transporter.verify();
      return { success: true, message: 'Email connection verified' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  destroy() {
    if (this.transporter) {
      this.transporter.close();
      console.log('📧 Email service closed');
    }
  }
}

// Export singleton instance
module.exports = new SafeEmailService();