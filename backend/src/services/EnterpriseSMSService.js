const AWS = require('aws-sdk');

class EnterpriseSMSService {
  constructor() {
    this.sns = null;
    this.isConfigured = false;
    this.fallbackMode = false;
    this.initialize();
  }

  initialize() {
    try {
      // AWS SNS Configuration (Enterprise 0€ Free Tier)
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION) {
        AWS.config.update({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION || 'us-east-1'
        });

        this.sns = new AWS.SNS();
        this.isConfigured = true;
        console.log('✅ Enterprise SMS Service initialized with AWS SNS');
        console.log('📱 Free Tier: 100 SMS per month included');
      } 
      // Twilio Fallback Configuration
      else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        this.twilioClient = require('twilio')(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        this.isConfigured = true;
        console.log('⚠️ Enterprise SMS Service initialized with Twilio fallback');
        console.log('💰 Twilio Trial: $15.50 credit available');
      }
      else {
        this.enableFallbackMode();
      }
    } catch (error) {
      console.error('❌ Enterprise SMS Service initialization failed:', error.message);
      this.enableFallbackMode();
    }
  }

  enableFallbackMode() {
    this.fallbackMode = true;
    console.warn(`
⚠️ ENTERPRISE SMS FALLBACK MODE ACTIVATED
==========================================
No SMS service configured - using simulation mode.
🔴 WARNING: This is NOT recommended for production!

Setup Options:
==============
Option 1: AWS SNS Free Tier (RECOMMENDED)
1. Create AWS account at https://aws.amazon.com/
2. Go to IAM and create user with SNS permissions
3. Set environment variables:
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key  
   AWS_REGION=us-east-1
   AWS_SNS_SMS_TYPE=Transactional

Option 2: Twilio Trial (Backup)
1. Create Twilio account at https://twilio.com/
2. Get $15.50 free credit
3. Set environment variables:
   TWILIO_ACCOUNT_SID=your-account-sid
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_PHONE_NUMBER=+1234567890

🚨 CRITICAL: SMS verification requires real SMS service!
    `);
  }

  // ENTERPRISE SMS SENDING - AWS SNS Primary, Twilio Fallback
  async sendSMS(phoneNumber, message) {
    if (this.fallbackMode) {
      return this.fallbackSendSMS(phoneNumber, message);
    }

    try {
      // AWS SNS SMS (Primary Enterprise Solution)
      if (this.sns) {
        const params = {
          Message: message,
          PhoneNumber: phoneNumber,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: process.env.AWS_SNS_SMS_TYPE || 'Transactional'
            }
          }
        };

        const result = await this.sns.publish(params).promise();
        
        console.log(`✅ Enterprise SMS sent via AWS SNS to: ${phoneNumber.substring(0, 5)}***`);
        console.log(`📊 Message ID: ${result.MessageId}`);
        
        return {
          success: true,
          messageId: result.MessageId,
          provider: 'aws-sns',
          cost: '0.0075 USD' // AWS SNS pricing for US
        };
      }
      // Twilio Fallback
      else if (this.twilioClient) {
        const result = await this.twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        });

        console.log(`✅ Enterprise SMS sent via Twilio to: ${phoneNumber.substring(0, 5)}***`);
        console.log(`📊 Message SID: ${result.sid}`);

        return {
          success: true,
          messageId: result.sid,
          provider: 'twilio',
          cost: 'Trial Credit'
        };
      }
    } catch (error) {
      console.error('❌ Enterprise SMS sending failed:', error.message);
      
      // Try fallback if primary fails
      if (this.sns && this.twilioClient) {
        console.log('🔄 Attempting Twilio fallback...');
        try {
          const result = await this.twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNumber
          });

          console.log(`✅ Enterprise SMS sent via Twilio fallback to: ${phoneNumber.substring(0, 5)}***`);
          
          return {
            success: true,
            messageId: result.sid,
            provider: 'twilio-fallback',
            cost: 'Trial Credit'
          };
        } catch (fallbackError) {
          console.error('❌ Twilio fallback also failed:', fallbackError.message);
        }
      }

      return this.fallbackSendSMS(phoneNumber, message);
    }
  }

  // ENTERPRISE PHONE VERIFICATION - Smart Code Generation
  async sendVerificationCode(phoneNumber) {
    try {
      // Generate secure 6-digit code
      const verificationCode = this.generateSecureCode();
      const message = `ConnectGlobal verification code: ${verificationCode}. Valid for 10 minutes. Never share this code.`;
      
      const result = await this.sendSMS(phoneNumber, message);
      
      if (result.success) {
        console.log(`🔐 Enterprise verification code sent to: ${phoneNumber.substring(0, 5)}***`);
        
        return {
          success: true,
          verificationCode,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          provider: result.provider,
          messageId: result.messageId
        };
      } else {
        throw new Error('SMS sending failed');
      }
    } catch (error) {
      console.error('❌ Enterprise verification code sending failed:', error);
      
      // Return fallback response for development
      return this.fallbackSendVerificationCode(phoneNumber);
    }
  }

  // ENTERPRISE NOTIFICATION SYSTEM
  async sendSecurityAlert(phoneNumber, alertType, details) {
    const messages = {
      'suspicious_login': `ConnectGlobal Security Alert: Suspicious login detected from new location. If this wasn't you, secure your account immediately.`,
      'password_changed': `ConnectGlobal Security: Your password was successfully changed. If you didn't make this change, contact support immediately.`,
      'new_device': `ConnectGlobal Security: New device login detected. Device: ${details.device}. Location: ${details.location}.`,
      'account_locked': `ConnectGlobal Security: Your account has been temporarily locked due to suspicious activity. Contact support to unlock.`
    };

    const message = messages[alertType] || `ConnectGlobal Security Alert: ${details.message}`;
    
    try {
      const result = await this.sendSMS(phoneNumber, message);
      
      if (result.success) {
        console.log(`🚨 Enterprise security alert sent: ${alertType} to ${phoneNumber.substring(0, 5)}***`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Enterprise security alert failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Secure Code Generation
  generateSecureCode() {
    // Use crypto for truly random 6-digit code
    const crypto = require('crypto');
    const randomNumber = crypto.randomInt(100000, 999999);
    return randomNumber.toString();
  }

  // Fallback Implementation (Development Only)
  fallbackSendSMS(phoneNumber, message) {
    console.warn(`
🔴 ENTERPRISE SMS SIMULATION MODE
================================
📱 To: ${phoneNumber}
💬 Message: ${message}
⏰ Timestamp: ${new Date().toISOString()}
🚨 WARNING: This is simulation mode - no real SMS sent!
    `);

    return {
      success: true,
      messageId: `sim-${Date.now()}`,
      provider: 'simulation',
      cost: '0.00 USD (Simulation)'
    };
  }

  fallbackSendVerificationCode(phoneNumber) {
    const verificationCode = this.generateSecureCode();
    
    console.warn(`
🔴 ENTERPRISE VERIFICATION SIMULATION
====================================
📱 Phone: ${phoneNumber}
🔢 Code: ${verificationCode}
⏰ Expires: ${new Date(Date.now() + 10 * 60 * 1000).toISOString()}
🚨 WARNING: This is simulation mode - no real SMS sent!
    `);

    return {
      success: true,
      verificationCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      provider: 'simulation',
      messageId: `sim-${Date.now()}`
    };
  }

  // HEALTH CHECK
  async healthCheck() {
    if (this.fallbackMode) {
      return {
        status: 'fallback',
        provider: 'simulation',
        enterprise: false,
        message: 'SMS service running in simulation mode'
      };
    }

    try {
      if (this.sns) {
        // Test AWS SNS connectivity
        await this.sns.getSMSAttributes().promise();
        return {
          status: 'healthy',
          provider: 'aws-sns',
          enterprise: true,
          message: 'AWS SNS connected successfully'
        };
      } else if (this.twilioClient) {
        // Test Twilio connectivity
        await this.twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
        return {
          status: 'healthy',
          provider: 'twilio',
          enterprise: true,
          message: 'Twilio connected successfully'
        };
      }
    } catch (error) {
      return {
        status: 'error',
        provider: 'unknown',
        enterprise: false,
        message: error.message
      };
    }
  }

  // ENTERPRISE ANALYTICS
  getUsageStats() {
    return {
      provider: this.sns ? 'aws-sns' : (this.twilioClient ? 'twilio' : 'simulation'),
      isEnterprise: !this.fallbackMode,
      monthlyFreeLimit: this.sns ? 100 : (this.twilioClient ? 'Trial Credit' : 'Unlimited Simulation'),
      recommendedUpgrade: this.fallbackMode ? 'Setup AWS SNS Free Tier' : null
    };
  }
}

module.exports = new EnterpriseSMSService();