// DEPRECATED: This service is replaced by EnterpriseSMSService
// Keeping for backward compatibility only
const EnterpriseSMSService = require('./EnterpriseSMSService');

class TwilioService {
  constructor() {
    console.warn(`
⚠️ DEPRECATION WARNING: TwilioService is deprecated
====================================================
Please use EnterpriseSMSService instead for:
- AWS SNS Free Tier (100 SMS/month)
- Twilio Fallback Support
- Enhanced Security Features
- Better Error Handling

This service will be removed in the next version.
    `);
    
    // Delegate to EnterpriseSMSService
    this.enterpriseService = EnterpriseSMSService;
  }

  async sendSMS(to, message) {
    console.warn('⚠️ TwilioService.sendSMS() is deprecated. Use EnterpriseSMSService.sendSMS()');
    const result = await this.enterpriseService.sendSMS(to, message);
    
    // Convert response format for backward compatibility
    return {
      sid: result.messageId,
      status: result.success ? 'delivered' : 'failed',
      dateCreated: new Date()
    };
  }

  async sendVerificationCode(phoneNumber) {
    console.warn('⚠️ TwilioService.sendVerificationCode() is deprecated. Use EnterpriseSMSService.sendVerificationCode()');
    const result = await this.enterpriseService.sendVerificationCode(phoneNumber);
    
    // Convert response format for backward compatibility
    return {
      verificationCode: result.verificationCode,
      messageSid: result.messageId,
      expiresAt: new Date(result.expiresAt)
    };
  }

  async sendMatchNotification(phoneNumber, matchName) {
    console.warn('⚠️ TwilioService.sendMatchNotification() is deprecated. Use EnterpriseSMSService.sendSMS()');
    const message = `🎉 You have a new match on ConnectGlobal! ${matchName} is interested in connecting with you. Open the app to start chatting!`;
    
    try {
      const result = await this.enterpriseService.sendSMS(phoneNumber, message);
      return {
        sid: result.messageId,
        status: result.success ? 'delivered' : 'failed'
      };
    } catch (error) {
      console.error('Error sending match notification:', error);
      return null;
    }
  }

  async sendMessageNotification(phoneNumber, senderName) {
    console.warn('⚠️ TwilioService.sendMessageNotification() is deprecated. Use EnterpriseSMSService.sendSMS()');
    const message = `💬 New message from ${senderName} on ConnectGlobal! Open the app to reply.`;
    
    try {
      const result = await this.enterpriseService.sendSMS(phoneNumber, message);
      return {
        sid: result.messageId,
        status: result.success ? 'delivered' : 'failed'
      };
    } catch (error) {
      console.error('Error sending message notification:', error);
      return null;
    }
  }
}

module.exports = new TwilioService();