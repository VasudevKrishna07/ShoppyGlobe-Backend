const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../config/logger');

class EmailService {
  constructor() {
    this.transporter = this.createTransport();
    this.templates = new Map();
    this.loadTemplates();
  }

  /**
   * Create email transporter based on environment
   */
  createTransport() {
    // Development configuration (using Ethereal or MailHog)
    if (process.env.NODE_ENV === 'development') {
      return nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD
        }
      });
    }

    // Production configuration
    if (process.env.EMAIL_SERVICE === 'gmail') {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD // Use App Password for Gmail
        }
      });
    }

    // SMTP configuration
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_PORT == 465,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  /**
   * Load email templates
   */
  async loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, '../templates/emails');
      
      // Ensure templates directory exists
      try {
        await fs.access(templatesDir);
      } catch (error) {
        logger.warn('Email templates directory not found. Creating basic templates.');
        return;
      }

      const templateFiles = await fs.readdir(templatesDir);
      
      for (const file of templateFiles) {
        if (file.endsWith('.html')) {
          const templateName = file.replace('.html', '');
          const templatePath = path.join(templatesDir, file);
          const templateContent = await fs.readFile(templatePath, 'utf8');
          this.templates.set(templateName, templateContent);
        }
      }

      logger.info(`Loaded ${this.templates.size} email templates`);
    } catch (error) {
      logger.error('Failed to load email templates:', error);
    }
  }

  /**
   * Get email template with variable replacement
   * @param {string} templateName - Template name
   * @param {Object} variables - Variables to replace in template
   * @returns {string} Processed template
   */
  getTemplate(templateName, variables = {}) {
    let template = this.templates.get(templateName);
    
    if (!template) {
      // Return basic template if specific template not found
      template = this.getBasicTemplate(templateName);
    }

    // Replace variables in template
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, variables[key] || '');
    });

    return template;
  }

  /**
   * Get basic template for common email types
   * @param {string} type - Email type
   * @returns {string} Basic template
   */
  getBasicTemplate(type) {
    const baseTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{{subject}}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; }
          .footer { background: #333; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
          .button:hover { background: #5a6fd8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ShoppyGlobe</h1>
          </div>
          <div class="content">
            {{content}}
          </div>
          <div class="footer">
            <p>&copy; 2025 ShoppyGlobe. All rights reserved.</p>
            <p>Visit us at <a href="{{clientUrl}}" style="color: #667eea;">ShoppyGlobe.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    const templates = {
      welcome: `
        <h2>Welcome to ShoppyGlobe!</h2>
        <p>Hi {{firstName}},</p>
        <p>Thank you for joining ShoppyGlobe! We're excited to have you as part of our community.</p>
        <p>To complete your registration, please verify your email address by clicking the button below:</p>
        <a href="{{verificationUrl}}" class="button">Verify Email Address</a>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p><a href="{{verificationUrl}}">{{verificationUrl}}</a></p>
        <p>This verification link will expire in 24 hours.</p>
        <p>If you didn't create this account, please ignore this email.</p>
        <p>Happy shopping!</p>
      `,
      
      emailVerification: `
        <h2>Verify Your Email Address</h2>
        <p>Hi {{firstName}},</p>
        <p>Please click the button below to verify your email address:</p>
        <a href="{{verificationUrl}}" class="button">Verify Email</a>
        <p>If the button doesn't work, copy and paste this link:</p>
        <p><a href="{{verificationUrl}}">{{verificationUrl}}</a></p>
        <p>This link expires in 24 hours.</p>
      `,
      
      passwordReset: `
        <h2>Password Reset Request</h2>
        <p>Hi {{firstName}},</p>
        <p>We received a request to reset your password for your ShoppyGlobe account.</p>
        <p>Click the button below to reset your password:</p>
        <a href="{{resetUrl}}" class="button">Reset Password</a>
        <p>If the button doesn't work, copy and paste this link:</p>
        <p><a href="{{resetUrl}}">{{resetUrl}}</a></p>
        <p>This link expires in 10 minutes for security reasons.</p>
        <p>If you didn't request this password reset, please ignore this email or contact support if you're concerned.</p>
      `,
      
      orderConfirmation: `
        <h2>Order Confirmation</h2>
        <p>Hi {{firstName}},</p>
        <p>Thank you for your order! We've received your order and are processing it.</p>
        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Order Details</h3>
          <p><strong>Order Number:</strong> {{orderNumber}}</p>
          <p><strong>Order Date:</strong> {{orderDate}}</p>
          <p><strong>Total Amount:</strong> ₹{{totalAmount}}</p>
        </div>
        <p>We'll send you another email when your order ships with tracking information.</p>
        <a href="{{orderUrl}}" class="button">View Order Details</a>
      `,
      
      orderShipped: `
        <h2>Your Order Has Shipped!</h2>
        <p>Hi {{firstName}},</p>
        <p>Great news! Your order has been shipped and is on its way to you.</p>
        <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Shipping Details</h3>
          <p><strong>Order Number:</strong> {{orderNumber}}</p>
          <p><strong>Tracking Number:</strong> {{trackingNumber}}</p>
          <p><strong>Estimated Delivery:</strong> {{estimatedDelivery}}</p>
        </div>
        <a href="{{trackingUrl}}" class="button">Track Your Package</a>
      `,
      
      passwordChanged: `
        <h2>Password Changed Successfully</h2>
        <p>Hi {{firstName}},</p>
        <p>Your password has been successfully changed for your ShoppyGlobe account.</p>
        <p>If you made this change, no further action is required.</p>
        <p>If you did not make this change, please contact our support team immediately.</p>
        <a href="mailto:support@shoppyglobe.com" class="button">Contact Support</a>
      `
    };

    let content = templates[type] || `
      <h2>{{subject}}</h2>
      <p>{{message}}</p>
    `;

    return baseTemplate.replace('{{content}}', content);
  }

  /**
   * Send email
   * @param {Object} options - Email options
   * @returns {Promise} Email result
   */
  async sendEmail(options) {
    try {
      const {
        to,
        subject,
        template,
        variables = {},
        attachments = []
      } = options;

      // Get processed template
      const html = this.getTemplate(template, {
        ...variables,
        subject,
        clientUrl: process.env.CLIENT_URL || 'http://localhost:3000'
      });

      const mailOptions = {
        from: `"ShoppyGlobe" <${process.env.EMAIL_FROM || process.env.EMAIL_USERNAME}>`,
        to,
        subject,
        html,
        attachments
      };

      const result = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        to,
        subject,
        messageId: result.messageId,
        template
      });

      return {
        success: true,
        messageId: result.messageId,
        previewUrl: process.env.NODE_ENV === 'development' 
          ? nodemailer.getTestMessageUrl(result) 
          : null
      };

    } catch (error) {
      logger.error('Failed to send email:', {
        error: error.message,
        to: options.to,
        subject: options.subject,
        template: options.template
      });

      throw error;
    }
  }

  /**
   * Send welcome email
   * @param {Object} user - User object
   * @param {string} verificationUrl - Email verification URL
   */
  async sendWelcomeEmail(user, verificationUrl) {
    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to ShoppyGlobe! Please verify your email',
      template: 'welcome',
      variables: {
        firstName: user.firstName,
        verificationUrl
      }
    });
  }

  /**
   * Send email verification
   * @param {Object} user - User object
   * @param {string} verificationUrl - Email verification URL
   */
  async sendEmailVerification(user, verificationUrl) {
    return this.sendEmail({
      to: user.email,
      subject: 'Verify Your Email Address',
      template: 'emailVerification',
      variables: {
        firstName: user.firstName,
        verificationUrl
      }
    });
  }

  /**
   * Send password reset email
   * @param {Object} user - User object
   * @param {string} resetUrl - Password reset URL
   */
  async sendPasswordReset(user, resetUrl) {
    return this.sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      template: 'passwordReset',
      variables: {
        firstName: user.firstName,
        resetUrl
      }
    });
  }

  /**
   * Send order confirmation email
   * @param {Object} user - User object
   * @param {Object} order - Order object
   */
  async sendOrderConfirmation(user, order) {
    return this.sendEmail({
      to: user.email,
      subject: `Order Confirmation #${order.orderNumber}`,
      template: 'orderConfirmation',
      variables: {
        firstName: user.firstName,
        orderNumber: order.orderNumber,
        orderDate: order.createdAt.toLocaleDateString(),
        totalAmount: order.totalAmount.toFixed(2),
        orderUrl: `${process.env.CLIENT_URL}/orders/${order._id}`
      }
    });
  }

  /**
   * Send order shipped notification
   * @param {Object} user - User object
   * @param {Object} order - Order object
   */
  async sendOrderShipped(user, order) {
    return this.sendEmail({
      to: user.email,
      subject: `Your Order #${order.orderNumber} Has Shipped!`,
      template: 'orderShipped',
      variables: {
        firstName: user.firstName,
        orderNumber: order.orderNumber,
        trackingNumber: order.tracking.trackingNumber,
        estimatedDelivery: order.estimatedDelivery 
          ? order.estimatedDelivery.toLocaleDateString() 
          : 'TBD',
        trackingUrl: order.tracking.trackingUrl || '#'
      }
    });
  }

  /**
   * Send password changed notification
   * @param {Object} user - User object
   */
  async sendPasswordChanged(user) {
    return this.sendEmail({
      to: user.email,
      subject: 'Password Changed Successfully',
      template: 'passwordChanged',
      variables: {
        firstName: user.firstName
      }
    });
  }

  /**
   * Send custom email
   * @param {Object} options - Email options
   */
  async sendCustomEmail(options) {
    return this.sendEmail({
      ...options,
      template: options.template || 'custom'
    });
  }

  /**
   * Send bulk emails
   * @param {Array} emails - Array of email options
   * @returns {Promise} Results array
   */
  async sendBulkEmails(emails) {
    const results = [];
    
    for (const email of emails) {
      try {
        const result = await this.sendEmail(email);
        results.push({ success: true, ...result });
      } catch (error) {
        results.push({ 
          success: false, 
          error: error.message,
          to: email.to 
        });
      }
    }

    return results;
  }

  /**
   * Verify email service configuration
   * @returns {Promise} Verification result
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified successfully');
      return { success: true, message: 'Email service is working' };
    } catch (error) {
      logger.error('Email service verification failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new EmailService();