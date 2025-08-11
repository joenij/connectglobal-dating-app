const twilio = require('twilio');

class TwilioService {
  constructor() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.warn('Twilio credentials not configured - SMS features disabled');
      this.client = null;
      return;
    }

    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  async sendSMS(to, message) {
    if (!this.client) {
      console.log(`SMS simulation - To: ${to}, Message: ${message}`);
      return { sid: 'simulated', status: 'delivered' };
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to
      });

      return {
        sid: result.sid,
        status: result.status,
        dateCreated: result.dateCreated
      };
    } catch (error) {
      console.error('Twilio SMS error:', error);
      throw new Error('Failed to send SMS');
    }
  }

  async sendVerificationCode(phoneNumber) {
    const code = Math.floor(100000 + Math.random() * 900000); // 6-digit code
    const message = `Your ConnectGlobal verification code is: ${code}. Valid for 10 minutes.`;

    try {
      const result = await this.sendSMS(phoneNumber, message);
      
      return {
        verificationCode: code,
        messageSid: result.sid,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      };
    } catch (error) {
      console.error('Error sending verification code:', error);
      throw error;
    }
  }

  async sendMatchNotification(phoneNumber, matchName) {
    const message = `🎉 You have a new match on ConnectGlobal! ${matchName} is interested in connecting with you. Open the app to start chatting!`;
    
    try {
      return await this.sendSMS(phoneNumber, message);
    } catch (error) {
      console.error('Error sending match notification:', error);
      // Don't throw - notifications are non-critical
      return null;
    }
  }

  async sendMessageNotification(phoneNumber, senderName) {
    const message = `💬 New message from ${senderName} on ConnectGlobal! Open the app to reply.`;
    
    try {
      return await this.sendSMS(phoneNumber, message);
    } catch (error) {
      console.error('Error sending message notification:', error);
      return null;
    }
  }
}

module.exports = new TwilioService();