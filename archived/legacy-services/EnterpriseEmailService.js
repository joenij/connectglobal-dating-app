const nodemailer = require('nodemailer');
const EnterpriseLogger = require('./EnterpriseLoggerService');

class EnterpriseEmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.fallbackMode = false;
    this.provider = 'none';
    this.initialize();
  }

  async initialize() {
    try {
      // AWS SES Configuration (Enterprise 0€ Free Tier - RECOMMENDED)
      if (process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY) {
        this.transporter = nodemailer.createTransporter({
          SES: {
            accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
            region: process.env.AWS_SES_REGION || 'us-east-1'
          }
        });
        this.provider = 'aws-ses';
        this.isConfigured = true;
        EnterpriseLogger.info('✅ Enterprise Email Service initialized with AWS SES');
        EnterpriseLogger.info('📧 Free Tier: 62,000 emails/month when sent from EC2');
      }
      // SendGrid Configuration (Free Tier Backup)
      else if (process.env.SENDGRID_API_KEY) {
        this.transporter = nodemailer.createTransporter({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
        this.provider = 'sendgrid';
        this.isConfigured = true;
        EnterpriseLogger.info('✅ Enterprise Email Service initialized with SendGrid');
        EnterpriseLogger.info('📧 Free Tier: 100 emails/day');
      }
      // Mailgun Configuration (Free Tier Alternative)
      else if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
        this.transporter = nodemailer.createTransporter({
          service: 'Mailgun',
          auth: {
            user: 'api',
            pass: process.env.MAILGUN_API_KEY
          }
        });
        this.provider = 'mailgun';
        this.isConfigured = true;
        EnterpriseLogger.info('✅ Enterprise Email Service initialized with Mailgun');
        EnterpriseLogger.info('📧 Free Tier: 100 emails/day for 3 months');
      }
      // Self-Hosted SMTP Server (Hetzner + Own Domain - RECOMMENDED for full control)
      else if (process.env.SELF_HOSTED_SMTP === 'true' && process.env.SMTP_HOST) {
        this.transporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          },
          // Additional options for self-hosted
          connectionTimeout: 60000,
          greetingTimeout: 30000,
          socketTimeout: 60000,
          dnsTimeout: 30000,
          tls: {
            rejectUnauthorized: false, // For self-signed certificates during setup
            ciphers: 'SSLv3'
          }
        });
        this.provider = 'self-hosted-smtp';
        this.isConfigured = true;
        EnterpriseLogger.info('✅ Enterprise Email Service initialized with Self-Hosted SMTP');
        EnterpriseLogger.info('🏠 Self-hosted on Hetzner server - Full control, unlimited emails');
      }
      // Generic SMTP Configuration
      else if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        this.transporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        this.provider = 'smtp';
        this.isConfigured = true;
        EnterpriseLogger.info('✅ Enterprise Email Service initialized with Generic SMTP');
      }
      else {
        this.enableFallbackMode();
        return;
      }

      // Verify transporter connection
      await this.transporter.verify();
      EnterpriseLogger.info(`🔗 ${this.provider.toUpperCase()} connection verified successfully`);

    } catch (error) {
      EnterpriseLogger.error('Enterprise Email Service initialization failed', error);
      this.enableFallbackMode();
    }
  }

  enableFallbackMode() {
    this.fallbackMode = true;
    EnterpriseLogger.warn(`
⚠️ ENTERPRISE EMAIL FALLBACK MODE ACTIVATED
==========================================
No email service configured - using simulation mode.
🔴 WARNING: This is NOT recommended for production!

Setup Options (0€ Cost):
========================
Option 1: Self-Hosted SMTP Server (RECOMMENDED - Full Control)
1. Order Hetzner server (€3-5/month for small VPS)
2. Register your domain (e.g., connectglobal.app)
3. Install Postfix/Dovecot or use Docker mail server:
   
   Quick Docker Setup:
   docker run -d --name mailserver \\
     -p 25:25 -p 587:587 -p 993:993 \\
     -v /etc/postfix:/etc/postfix \\
     -v /var/mail:/var/mail \\
     -e HOSTNAME=mail.yourdomain.com \\
     mailserver/docker-mailserver
   
4. Set DNS records:
   MX: mail.yourdomain.com (priority 10)
   A: mail.yourdomain.com → your-server-ip
   SPF: "v=spf1 mx ~all"
   DKIM: Generate and add DKIM key
   DMARC: "v=DMARC1; p=none; rua=mailto:postmaster@yourdomain.com"
   
5. Set environment variables:
   SELF_HOSTED_SMTP=true
   SMTP_HOST=mail.yourdomain.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=noreply@yourdomain.com
   SMTP_PASS=your-smtp-password
   FROM_EMAIL=noreply@yourdomain.com

Option 2: AWS SES Free Tier (Cloud Alternative)
1. Create AWS account at https://aws.amazon.com/
2. Go to SES and verify your domain/email
3. Set environment variables:
   AWS_SES_ACCESS_KEY_ID=your-access-key
   AWS_SES_SECRET_ACCESS_KEY=your-secret-key
   AWS_SES_REGION=us-east-1
   FROM_EMAIL=noreply@yourdomain.com

Option 3: SendGrid Free Tier (100 emails/day)
1. Create account at https://sendgrid.com/
2. Get API key from dashboard
3. Set environment variables:
   SENDGRID_API_KEY=your-api-key
   FROM_EMAIL=noreply@yourdomain.com

🚨 CRITICAL: Email verification requires real email service!
    `);
  }

  // ENTERPRISE EMAIL SENDING
  async sendEmail(to, subject, html, text = null) {
    if (this.fallbackMode) {
      return this.fallbackSendEmail(to, subject, html, text);
    }

    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@connectglobal.app',
        to,
        subject,
        html,
        text: text || this.htmlToText(html)
      };

      const result = await this.transporter.sendMail(mailOptions);

      EnterpriseLogger.info(`📧 Enterprise email sent via ${this.provider.toUpperCase()}`, {
        to: to.replace(/(.{3}).*(@.*)/, '$1***$2'), // Mask email for privacy
        subject,
        messageId: result.messageId,
        provider: this.provider
      });

      return {
        success: true,
        messageId: result.messageId,
        provider: this.provider,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      EnterpriseLogger.error('Enterprise email sending failed', error, {
        to: to.replace(/(.{3}).*(@.*)/, '$1***$2'),
        subject,
        provider: this.provider
      });

      return this.fallbackSendEmail(to, subject, html, text);
    }
  }

  // EMAIL VERIFICATION SYSTEM
  async sendEmailVerification(email, verificationToken) {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your ConnectGlobal Account</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        .security { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌍 ConnectGlobal</h1>
          <p>Welcome to the future of global dating</p>
        </div>
        <div class="content">
          <h2>Verify Your Email Address</h2>
          <p>Thank you for joining ConnectGlobal! To complete your registration and start connecting with amazing people worldwide, please verify your email address.</p>
          
          <p style="text-align: center;">
            <a href="${verificationUrl}" class="button">✅ Verify Email Address</a>
          </p>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: #f1f1f1; padding: 10px; border-radius: 5px;">
            ${verificationUrl}
          </p>
          
          <div class="security">
            <strong>🔐 Security Notice:</strong><br>
            This verification link expires in 24 hours for your security. If you didn't create a ConnectGlobal account, please ignore this email.
          </div>
          
          <p>After verification, you'll be able to:</p>
          <ul>
            <li>🎥 Create your video profile</li>
            <li>💫 Start matching with people worldwide</li>
            <li>💬 Send and receive messages</li>
            <li>🌟 Access premium features</li>
          </ul>
        </div>
        <div class="footer">
          <p>ConnectGlobal - Connecting hearts across the globe</p>
          <p>If you need help, contact us at support@connectglobal.app</p>
        </div>
      </div>
    </body>
    </html>`;

    const text = `
    Welcome to ConnectGlobal!
    
    Thank you for joining ConnectGlobal! To complete your registration, please verify your email address by clicking the link below:
    
    ${verificationUrl}
    
    This link expires in 24 hours for your security.
    
    If you didn't create a ConnectGlobal account, please ignore this email.
    
    Best regards,
    The ConnectGlobal Team
    `;

    return this.sendEmail(email, '✅ Verify Your ConnectGlobal Account', html, text);
  }

  // PASSWORD RESET EMAIL
  async sendPasswordResetEmail(email, resetToken, userName) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your ConnectGlobal Password</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #ff6b6b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .security { background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 ConnectGlobal</h1>
          <p>Password Reset Request</p>
        </div>
        <div class="content">
          <h2>Hello ${userName}!</h2>
          <p>We received a request to reset your ConnectGlobal account password. If you made this request, click the button below to reset your password:</p>
          
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">🔑 Reset Password</a>
          </p>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: #f1f1f1; padding: 10px; border-radius: 5px;">
            ${resetUrl}
          </p>
          
          <div class="security">
            <strong>🚨 Security Important:</strong><br>
            • This link expires in 1 hour for your security<br>
            • If you didn't request this reset, please ignore this email<br>
            • Your password remains unchanged until you create a new one<br>
            • Never share this link with anyone
          </div>
          
          <p>If you need assistance, please contact our support team.</p>
        </div>
        <div class="footer">
          <p>ConnectGlobal Security Team</p>
          <p>This is an automated message - please do not reply</p>
        </div>
      </div>
    </body>
    </html>`;

    const text = `
    Password Reset Request - ConnectGlobal
    
    Hello ${userName}!
    
    We received a request to reset your ConnectGlobal account password.
    
    Reset your password here: ${resetUrl}
    
    This link expires in 1 hour for your security.
    
    If you didn't request this reset, please ignore this email.
    
    ConnectGlobal Security Team
    `;

    return this.sendEmail(email, '🔐 Reset Your ConnectGlobal Password', html, text);
  }

  // WELCOME EMAIL
  async sendWelcomeEmail(email, userName) {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to ConnectGlobal!</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #4ecdc4 0%, #2ecc71 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .feature { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #4ecdc4; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome ${userName}!</h1>
          <p>You're now part of the ConnectGlobal community</p>
        </div>
        <div class="content">
          <h2>Your dating journey starts here!</h2>
          <p>Thank you for joining ConnectGlobal - where meaningful connections know no borders. Here's what you can do next:</p>
          
          <div class="feature">
            <h3>🎥 Create Your Video Profile</h3>
            <p>Show your authentic self with our video verification system. Stand out from the crowd!</p>
          </div>
          
          <div class="feature">
            <h3>🧠 Smart Cultural Matching</h3>
            <p>Our AI considers cultural compatibility, language preferences, and shared values.</p>
          </div>
          
          <div class="feature">
            <h3>💬 Secure Messaging</h3>
            <p>Connect safely with end-to-end encrypted conversations.</p>
          </div>
          
          <div class="feature">
            <h3>🌍 Global GDP-Based Pricing</h3>
            <p>Fair pricing based on your country's economic situation. Quality dating for everyone.</p>
          </div>
          
          <p style="text-align: center; margin-top: 30px;">
            <strong>Ready to find your perfect match?</strong><br>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile" style="display: inline-block; background: #4ecdc4; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 10px 0;">Complete Your Profile</a>
          </p>
        </div>
        <div class="footer">
          <p>ConnectGlobal - Connecting hearts across the globe</p>
          <p>Questions? Contact us at support@connectglobal.app</p>
        </div>
      </div>
    </body>
    </html>`;

    const text = `
    Welcome to ConnectGlobal, ${userName}!
    
    Thank you for joining our global dating community. Here's what makes ConnectGlobal special:
    
    🎥 Video Profiles - Show your authentic self
    🧠 Smart Cultural Matching - AI-powered compatibility  
    💬 Secure Messaging - End-to-end encryption
    🌍 Fair Global Pricing - Based on your country's economy
    
    Ready to get started? Complete your profile at:
    ${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile
    
    Welcome aboard!
    The ConnectGlobal Team
    `;

    return this.sendEmail(email, '🎉 Welcome to ConnectGlobal!', html, text);
  }

  // SECURITY ALERT EMAILS
  async sendSecurityAlert(email, alertType, details, userName) {
    const alerts = {
      'suspicious_login': {
        subject: '🚨 Suspicious Login Detected - ConnectGlobal',
        title: 'Suspicious Login Alert',
        message: `We detected a login to your account from a new location or device that seems unusual.`,
        action: 'If this was you, no action is needed. If not, secure your account immediately.'
      },
      'password_changed': {
        subject: '✅ Password Changed - ConnectGlobal',
        title: 'Password Successfully Changed',
        message: `Your ConnectGlobal account password was successfully changed.`,
        action: 'If you didn\'t make this change, contact support immediately.'
      },
      'account_locked': {
        subject: '🔒 Account Temporarily Locked - ConnectGlobal',
        title: 'Account Security Lock',
        message: `Your account has been temporarily locked due to suspicious activity.`,
        action: 'Contact our support team to unlock your account.'
      }
    };

    const alert = alerts[alertType] || alerts['suspicious_login'];

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${alert.subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff9a56 0%, #ff6b6b 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 ConnectGlobal Security</h1>
          <p>${alert.title}</p>
        </div>
        <div class="content">
          <h2>Hello ${userName},</h2>
          <p>${alert.message}</p>
          
          ${details ? `<div class="details">
            <strong>Details:</strong><br>
            ${Object.entries(details).map(([key, value]) => `${key}: ${value}`).join('<br>')}
          </div>` : ''}
          
          <div class="alert">
            <strong>⚠️ Action Required:</strong><br>
            ${alert.action}
          </div>
          
          <p>For your security, we monitor all account activity. If you have any concerns, please contact our support team immediately.</p>
        </div>
        <div class="footer">
          <p>ConnectGlobal Security Team</p>
          <p>Sent: ${new Date().toISOString()}</p>
        </div>
      </div>
    </body>
    </html>`;

    return this.sendEmail(email, alert.subject, html);
  }

  // UTILITY METHODS
  htmlToText(html) {
    return html
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  // FALLBACK IMPLEMENTATION (Development Only)
  fallbackSendEmail(to, subject, html, text) {
    EnterpriseLogger.warn(`
🔴 ENTERPRISE EMAIL SIMULATION MODE
==================================
📧 To: ${to}
📝 Subject: ${subject}
🕒 Timestamp: ${new Date().toISOString()}
📄 Content: ${text || this.htmlToText(html)}
🚨 WARNING: This is simulation mode - no real email sent!
    `);

    return {
      success: true,
      messageId: `sim-${Date.now()}`,
      provider: 'simulation',
      timestamp: new Date().toISOString()
    };
  }

  // HEALTH CHECK
  async healthCheck() {
    if (this.fallbackMode) {
      return {
        status: 'fallback',
        provider: 'simulation',
        enterprise: false,
        message: 'Email service running in simulation mode'
      };
    }

    try {
      await this.transporter.verify();
      return {
        status: 'healthy',
        provider: this.provider,
        enterprise: true,
        message: `${this.provider.toUpperCase()} connection verified`
      };
    } catch (error) {
      return {
        status: 'error',
        provider: this.provider,
        enterprise: false,
        message: error.message
      };
    }
  }

  // ENTERPRISE ANALYTICS
  getUsageStats() {
    const limits = {
      'aws-ses': '62,000 emails/month (EC2), 200/day (outside)',
      'sendgrid': '100 emails/day',
      'mailgun': '100 emails/day for 3 months',
      'smtp': 'Depends on provider',
      'simulation': 'Unlimited (Development Only)'
    };

    return {
      provider: this.provider,
      isEnterprise: !this.fallbackMode,
      monthlyFreeLimit: limits[this.provider] || 'Unknown',
      recommendedUpgrade: this.fallbackMode ? 'Setup AWS SES Free Tier' : null,
      configured: this.isConfigured
    };
  }
}

module.exports = new EnterpriseEmailService();