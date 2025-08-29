const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');
const User = require('../models/User');
const EnterpriseLogger = require('./EnterpriseLoggerService');

class PushNotificationService {
  constructor() {
    this.expo = new Expo();
    this.initializeFirebase();
    
    this.notificationTypes = {
      NEW_MATCH: 'new_match',
      NEW_MESSAGE: 'new_message',
      PROFILE_VIEWED: 'profile_viewed',
      VIDEO_APPROVED: 'video_approved',
      SUBSCRIPTION_REMINDER: 'subscription_reminder',
      DAILY_MATCHES: 'daily_matches'
    };
  }

  /**
   * Initialize Firebase Admin SDK
   */
  initializeFirebase() {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
          })
        });
      }
      this.messaging = admin.messaging();
      EnterpriseLogger.info('Firebase Admin SDK initialized successfully');
    } catch (error) {
      EnterpriseLogger.error('Firebase initialization failed', error);
    }
  }

  /**
   * Send push notification to user
   */
  async sendToUser(userId, notification, options = {}) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      const { pushTokens, preferences } = await this.getUserNotificationData(userId);
      if (!pushTokens || pushTokens.length === 0) {
        EnterpriseLogger.warn('No push tokens found for user', { userId });
        return { success: false, reason: 'No push tokens' };
      }

      // Check user notification preferences
      if (!this.shouldSendNotification(notification.type, preferences)) {
        EnterpriseLogger.info('Notification blocked by user preferences', { 
          userId, 
          type: notification.type 
        });
        return { success: false, reason: 'Blocked by user preferences' };
      }

      // Send to different platforms
      const results = await Promise.allSettled([
        this.sendFirebaseNotification(pushTokens.fcm, notification, options),
        this.sendExpoNotification(pushTokens.expo, notification, options)
      ]);

      // Log results
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      EnterpriseLogger.info('Push notification sent', {
        userId,
        type: notification.type,
        successCount,
        failureCount,
        totalTokens: pushTokens.fcm.length + pushTokens.expo.length
      });

      return {
        success: successCount > 0,
        results,
        sentTo: successCount,
        failed: failureCount
      };

    } catch (error) {
      EnterpriseLogger.error('Send push notification failed', error, { userId, notification });
      throw error;
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendToUsers(userIds, notification, options = {}) {
    try {
      const results = await Promise.allSettled(
        userIds.map(userId => this.sendToUser(userId, notification, options))
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;

      EnterpriseLogger.info('Bulk push notifications sent', {
        type: notification.type,
        totalUsers: userIds.length,
        successful,
        failed
      });

      return { successful, failed, results };

    } catch (error) {
      EnterpriseLogger.error('Bulk push notification failed', error);
      throw error;
    }
  }

  /**
   * Send Firebase Cloud Messaging notification
   */
  async sendFirebaseNotification(tokens, notification, options = {}) {
    if (!tokens || tokens.length === 0) return;

    try {
      const message = {
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.imageUrl
        },
        data: {
          type: notification.type,
          ...notification.data
        },
        android: {
          priority: 'high',
          notification: {
            icon: 'notification_icon',
            color: '#4A90E2',
            sound: 'default',
            channelId: 'connectglobal_default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: options.badge || 1,
              category: notification.type
            }
          }
        },
        tokens
      };

      const response = await this.messaging.sendMulticast(message);
      
      // Handle invalid tokens
      if (response.failureCount > 0) {
        await this.handleInvalidTokens(tokens, response.responses);
      }

      return response;

    } catch (error) {
      EnterpriseLogger.error('Firebase notification failed', error);
      throw error;
    }
  }

  /**
   * Send Expo push notification
   */
  async sendExpoNotification(tokens, notification, options = {}) {
    if (!tokens || tokens.length === 0) return;

    try {
      const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: {
          type: notification.type,
          ...notification.data
        },
        badge: options.badge || 1,
        channelId: 'connectglobal_default'
      }));

      // Filter out invalid tokens
      const validMessages = messages.filter(message => 
        Expo.isExpoPushToken(message.to)
      );

      if (validMessages.length === 0) return;

      const chunks = this.expo.chunkPushNotifications(validMessages);
      const results = [];

      for (const chunk of chunks) {
        try {
          const receipts = await this.expo.sendPushNotificationsAsync(chunk);
          results.push(...receipts);
        } catch (error) {
          EnterpriseLogger.error('Expo chunk send failed', error);
        }
      }

      return results;

    } catch (error) {
      EnterpriseLogger.error('Expo notification failed', error);
      throw error;
    }
  }

  /**
   * Send new match notification
   */
  async sendNewMatchNotification(userId, matchedUser) {
    const notification = {
      type: this.notificationTypes.NEW_MATCH,
      title: '🎉 New Match!',
      body: `You have a new match with ${matchedUser.first_name}!`,
      imageUrl: matchedUser.profile_picture,
      data: {
        matchId: matchedUser.matchId,
        userId: matchedUser.id
      }
    };

    return this.sendToUser(userId, notification, { badge: 1 });
  }

  /**
   * Send new message notification
   */
  async sendNewMessageNotification(userId, sender, message) {
    const notification = {
      type: this.notificationTypes.NEW_MESSAGE,
      title: sender.first_name,
      body: message.content || 'Sent you a message',
      imageUrl: sender.profile_picture,
      data: {
        conversationId: message.conversation_id,
        messageId: message.id,
        senderId: sender.id
      }
    };

    return this.sendToUser(userId, notification, { badge: 1 });
  }

  /**
   * Send profile viewed notification
   */
  async sendProfileViewedNotification(userId, viewer) {
    const notification = {
      type: this.notificationTypes.PROFILE_VIEWED,
      title: 'Profile Viewed',
      body: `${viewer.first_name} viewed your profile`,
      imageUrl: viewer.profile_picture,
      data: {
        viewerId: viewer.id
      }
    };

    return this.sendToUser(userId, notification);
  }

  /**
   * Send video approved notification
   */
  async sendVideoApprovedNotification(userId) {
    const notification = {
      type: this.notificationTypes.VIDEO_APPROVED,
      title: '✅ Video Approved!',
      body: 'Your profile video has been approved and is now live',
      data: {
        action: 'video_approved'
      }
    };

    return this.sendToUser(userId, notification);
  }

  /**
   * Send subscription reminder
   */
  async sendSubscriptionReminderNotification(userId, daysLeft) {
    const notification = {
      type: this.notificationTypes.SUBSCRIPTION_REMINDER,
      title: '⏰ Subscription Expiring',
      body: `Your premium subscription expires in ${daysLeft} days`,
      data: {
        action: 'renew_subscription',
        daysLeft
      }
    };

    return this.sendToUser(userId, notification);
  }

  /**
   * Send daily matches notification
   */
  async sendDailyMatchesNotification(userId, matchCount) {
    const notification = {
      type: this.notificationTypes.DAILY_MATCHES,
      title: '💕 New Matches Available',
      body: `${matchCount} new potential matches are waiting for you!`,
      data: {
        action: 'view_matches',
        matchCount
      }
    };

    return this.sendToUser(userId, notification);
  }

  /**
   * Register push token for user
   */
  async registerPushToken(userId, token, platform = 'unknown') {
    try {
      // Validate token format
      if (platform === 'expo' && !Expo.isExpoPushToken(token)) {
        throw new Error('Invalid Expo push token');
      }

      // Store token in database
      await User.addPushToken(userId, token, platform);

      EnterpriseLogger.info('Push token registered', { userId, platform, tokenPrefix: token.substring(0, 20) });

    } catch (error) {
      EnterpriseLogger.error('Register push token failed', error, { userId, platform });
      throw error;
    }
  }

  /**
   * Unregister push token
   */
  async unregisterPushToken(userId, token) {
    try {
      await User.removePushToken(userId, token);
      EnterpriseLogger.info('Push token unregistered', { userId });
    } catch (error) {
      EnterpriseLogger.error('Unregister push token failed', error, { userId });
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateNotificationPreferences(userId, preferences) {
    try {
      await User.updateNotificationPreferences(userId, preferences);
      EnterpriseLogger.info('Notification preferences updated', { userId, preferences });
    } catch (error) {
      EnterpriseLogger.error('Update notification preferences failed', error, { userId });
      throw error;
    }
  }

  /**
   * Get user notification data (tokens and preferences)
   */
  async getUserNotificationData(userId) {
    try {
      const userData = await User.getNotificationData(userId);
      
      return {
        pushTokens: {
          fcm: userData.fcm_tokens || [],
          expo: userData.expo_tokens || []
        },
        preferences: userData.notification_preferences || this.getDefaultPreferences()
      };
    } catch (error) {
      EnterpriseLogger.error('Get user notification data failed', error, { userId });
      return { pushTokens: { fcm: [], expo: [] }, preferences: this.getDefaultPreferences() };
    }
  }

  /**
   * Check if notification should be sent based on user preferences
   */
  shouldSendNotification(type, preferences) {
    if (!preferences) return true;
    
    const typeMap = {
      [this.notificationTypes.NEW_MATCH]: 'matches',
      [this.notificationTypes.NEW_MESSAGE]: 'messages',
      [this.notificationTypes.PROFILE_VIEWED]: 'profile_views',
      [this.notificationTypes.VIDEO_APPROVED]: 'system',
      [this.notificationTypes.SUBSCRIPTION_REMINDER]: 'system',
      [this.notificationTypes.DAILY_MATCHES]: 'matches'
    };

    const prefKey = typeMap[type];
    return prefKey ? (preferences[prefKey] !== false) : true;
  }

  /**
   * Handle invalid push tokens
   */
  async handleInvalidTokens(tokens, responses) {
    try {
      const invalidTokens = [];
      
      responses.forEach((response, index) => {
        if (!response.success) {
          const error = response.error;
          if (error.code === 'messaging/registration-token-not-registered' ||
              error.code === 'messaging/invalid-registration-token') {
            invalidTokens.push(tokens[index]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await User.removeInvalidPushTokens(invalidTokens);
        EnterpriseLogger.info('Invalid push tokens removed', { count: invalidTokens.length });
      }
    } catch (error) {
      EnterpriseLogger.error('Handle invalid tokens failed', error);
    }
  }

  /**
   * Get default notification preferences
   */
  getDefaultPreferences() {
    return {
      matches: true,
      messages: true,
      profile_views: true,
      system: true,
      marketing: false
    };
  }

  /**
   * Send scheduled notifications (for cron jobs)
   */
  async sendScheduledNotifications() {
    try {
      // Send subscription reminders
      await this.sendSubscriptionReminders();
      
      // Send daily matches
      await this.sendDailyMatches();
      
    } catch (error) {
      EnterpriseLogger.error('Scheduled notifications failed', error);
    }
  }

  /**
   * Send subscription reminders to users with expiring subscriptions
   */
  async sendSubscriptionReminders() {
    try {
      const expiringUsers = await User.getExpiringSubscriptions();
      
      for (const user of expiringUsers) {
        const daysLeft = Math.ceil((new Date(user.subscription_expires_at) - new Date()) / (1000 * 60 * 60 * 24));
        await this.sendSubscriptionReminderNotification(user.id, daysLeft);
      }
      
    } catch (error) {
      EnterpriseLogger.error('Send subscription reminders failed', error);
    }
  }

  /**
   * Send daily matches notifications
   */
  async sendDailyMatches() {
    try {
      const users = await User.getUsersForDailyMatches();
      
      for (const user of users) {
        const matchCount = await User.getNewMatchCount(user.id);
        if (matchCount > 0) {
          await this.sendDailyMatchesNotification(user.id, matchCount);
        }
      }
      
    } catch (error) {
      EnterpriseLogger.error('Send daily matches failed', error);
    }
  }
}

module.exports = new PushNotificationService();