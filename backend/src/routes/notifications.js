const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/security');
const PushNotificationService = require('../services/PushNotificationService');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');

const router = express.Router();

// POST /api/v1/notifications/register-token - Register push notification token
router.post('/register-token', [
  authenticateToken,
  body('token').notEmpty().withMessage('Push token is required'),
  body('platform').isIn(['firebase', 'expo', 'apns']).withMessage('Valid platform required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { token, platform } = req.body;

    await PushNotificationService.registerPushToken(req.user.id, token, platform);

    EnterpriseLogger.info('Push token registered', req.user.id, { 
      platform, 
      tokenPrefix: token.substring(0, 20) 
    });

    res.json({
      success: true,
      message: 'Push token registered successfully',
      platform
    });

  } catch (error) {
    EnterpriseLogger.error('Push token registration failed', error, { 
      userId: req.user.id,
      platform: req.body.platform 
    });
    
    res.status(500).json({ 
      error: 'Failed to register push token',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// DELETE /api/v1/notifications/unregister-token - Unregister push notification token
router.delete('/unregister-token', [
  authenticateToken,
  body('token').notEmpty().withMessage('Push token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { token } = req.body;

    await PushNotificationService.unregisterPushToken(req.user.id, token);

    EnterpriseLogger.info('Push token unregistered', req.user.id);

    res.json({
      success: true,
      message: 'Push token unregistered successfully'
    });

  } catch (error) {
    EnterpriseLogger.error('Push token unregistration failed', error, { userId: req.user.id });
    
    res.status(500).json({ 
      error: 'Failed to unregister push token',
      code: 'UNREGISTRATION_ERROR'
    });
  }
});

// PUT /api/v1/notifications/preferences - Update notification preferences
router.put('/preferences', [
  authenticateToken,
  body('matches').optional().isBoolean(),
  body('messages').optional().isBoolean(),
  body('profile_views').optional().isBoolean(),
  body('system').optional().isBoolean(),
  body('marketing').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const preferences = {
      matches: req.body.matches,
      messages: req.body.messages,
      profile_views: req.body.profile_views,
      system: req.body.system,
      marketing: req.body.marketing
    };

    // Remove undefined values
    Object.keys(preferences).forEach(key => {
      if (preferences[key] === undefined) {
        delete preferences[key];
      }
    });

    await PushNotificationService.updateNotificationPreferences(req.user.id, preferences);

    EnterpriseLogger.info('Notification preferences updated', req.user.id, preferences);

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences
    });

  } catch (error) {
    EnterpriseLogger.error('Notification preferences update failed', error, { 
      userId: req.user.id,
      preferences: req.body 
    });
    
    res.status(500).json({ 
      error: 'Failed to update notification preferences',
      code: 'PREFERENCES_ERROR'
    });
  }
});

// GET /api/v1/notifications/preferences - Get user's notification preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const data = await PushNotificationService.getUserNotificationData(req.user.id);

    res.json({
      success: true,
      preferences: data.preferences,
      pushTokens: {
        firebase: data.pushTokens.fcm.length,
        expo: data.pushTokens.expo.length
      }
    });

  } catch (error) {
    EnterpriseLogger.error('Get notification preferences failed', error, { userId: req.user.id });
    
    res.status(500).json({ 
      error: 'Failed to fetch notification preferences',
      code: 'FETCH_ERROR'
    });
  }
});

// POST /api/v1/notifications/test - Send test notification (development only)
router.post('/test', [
  authenticateToken,
  body('type').isIn(['new_match', 'new_message', 'profile_viewed', 'daily_matches']),
  body('title').optional().isLength({ min: 1, max: 100 }),
  body('body').optional().isLength({ min: 1, max: 200 })
], async (req, res) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ 
        error: 'Test notifications not available in production' 
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { type, title, body } = req.body;

    const notification = {
      type,
      title: title || 'Test Notification',
      body: body || 'This is a test notification from ConnectGlobal',
      data: {
        test: true,
        timestamp: new Date().toISOString()
      }
    };

    const result = await PushNotificationService.sendToUser(req.user.id, notification);

    EnterpriseLogger.info('Test notification sent', req.user.id, { type, result });

    res.json({
      success: true,
      message: 'Test notification sent',
      result,
      notification
    });

  } catch (error) {
    EnterpriseLogger.error('Test notification failed', error, { 
      userId: req.user.id,
      type: req.body.type 
    });
    
    res.status(500).json({ 
      error: 'Failed to send test notification',
      code: 'TEST_ERROR'
    });
  }
});

// POST /api/v1/notifications/send-daily-matches - Trigger daily matches notification
router.post('/send-daily-matches', authenticateToken, async (req, res) => {
  try {
    // This would typically be called by a cron job, but allow manual trigger for testing
    const matchCount = req.body.matchCount || Math.floor(Math.random() * 10) + 1;
    
    const result = await PushNotificationService.sendDailyMatchesNotification(
      req.user.id, 
      matchCount
    );

    EnterpriseLogger.info('Daily matches notification triggered', req.user.id, { matchCount });

    res.json({
      success: true,
      message: 'Daily matches notification sent',
      matchCount,
      result
    });

  } catch (error) {
    EnterpriseLogger.error('Daily matches notification failed', error, { userId: req.user.id });
    
    res.status(500).json({ 
      error: 'Failed to send daily matches notification',
      code: 'DAILY_MATCHES_ERROR'
    });
  }
});

// GET /api/v1/notifications/scheduled - Get scheduled notifications status (admin)
router.get('/scheduled', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    res.json({
      success: true,
      scheduledJobs: {
        dailyMatches: {
          enabled: true,
          schedule: '0 9 * * *', // 9 AM daily
          lastRun: new Date().toISOString(),
          nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        },
        subscriptionReminders: {
          enabled: true,
          schedule: '0 10 * * *', // 10 AM daily
          lastRun: new Date().toISOString(),
          nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
      },
      statistics: {
        totalNotificationsSent: 0,
        successRate: 0.95,
        avgDeliveryTime: '2.3s'
      }
    });

  } catch (error) {
    EnterpriseLogger.error('Get scheduled notifications failed', error, { userId: req.user.id });
    
    res.status(500).json({ 
      error: 'Failed to fetch scheduled notifications',
      code: 'SCHEDULED_ERROR'
    });
  }
});

module.exports = router;