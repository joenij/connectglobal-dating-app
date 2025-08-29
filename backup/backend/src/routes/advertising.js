const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/security');
const EnterpriseAdService = require('../services/EnterpriseAdService');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');

const router = express.Router();

// POST /api/v1/advertising/track - Track ad engagement (impression, click, reward)
router.post('/track', [
  authenticateToken,
  body('adNetwork').isIn(['admob', 'facebook', 'unity']),
  body('adType').isIn(['banner', 'interstitial', 'rewarded_video', 'native']),
  body('placementLocation').isLength({ min: 1, max: 50 }),
  body('action').isIn(['impression', 'click', 'reward_earned', 'dismissed']),
  body('adUnitId').optional().isLength({ min: 1, max: 100 }),
  body('rewardType').optional().isIn(['video_unlock', 'extra_likes', 'premium_preview', 'boost_profile']),
  body('rewardAmount').optional().isInt({ min: 0, max: 100 }),
  body('revenueUsd').optional().isFloat({ min: 0, max: 100 }),
  body('sessionId').optional().isLength({ min: 1, max: 50 }),
  body('deviceType').optional().isIn(['android', 'ios', 'web'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      adNetwork,
      adType, 
      placementLocation,
      action,
      adUnitId,
      rewardType,
      rewardAmount = 0,
      revenueUsd = 0.00,
      sessionId,
      deviceType = 'unknown'
    } = req.body;

    const result = await EnterpriseAdService.trackAdEngagement(req.user.id, {
      adNetwork,
      adType,
      adUnitId,
      placementLocation,
      action,
      rewardType,
      rewardAmount,
      revenueUsd,
      sessionId,
      deviceType
    });

    EnterpriseLogger.info('Ad engagement tracked successfully', req.user.id, {
      adNetwork,
      adType,
      placementLocation,
      action,
      rewardGranted: result.rewardGranted,
      ip: req.ip
    });

    res.json({
      success: true,
      engagementId: result.engagementId,
      rewardGranted: result.rewardGranted,
      message: result.rewardGranted ? 'Reward earned!' : 'Engagement tracked',
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Ad engagement tracking failed', error, {
      userId: req.user.id,
      adData: req.body,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to track ad engagement',
      enterprise: true
    });
  }
});

// GET /api/v1/advertising/can-watch-rewarded - Check if user can watch rewarded ad
router.get('/can-watch-rewarded', [
  authenticateToken,
  body('rewardType').optional().isIn(['video_unlock', 'extra_likes', 'premium_preview', 'boost_profile']),
  body('placementLocation').optional().isLength({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const {
      rewardType = 'video_unlock',
      placementLocation = 'video_unlock'
    } = req.query;

    const eligibility = await EnterpriseAdService.canUserWatchRewardedAd(
      req.user.id,
      rewardType,
      placementLocation
    );

    EnterpriseLogger.info('Rewarded ad eligibility checked', req.user.id, {
      rewardType,
      placementLocation,
      canWatch: eligibility.canWatch,
      reason: eligibility.reason,
      ip: req.ip
    });

    res.json({
      success: true,
      eligibility,
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to check rewarded ad eligibility', error, {
      userId: req.user.id,
      query: req.query,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to check ad eligibility',
      enterprise: true
    });
  }
});

// GET /api/v1/advertising/rewards - Get user's available rewards
router.get('/rewards', authenticateToken, async (req, res) => {
  try {
    const rewards = await EnterpriseAdService.getUserRewards(req.user.id);

    EnterpriseLogger.info('User rewards retrieved', req.user.id, {
      totalRewards: rewards.totalRewards,
      ip: req.ip
    });

    res.json({
      success: true,
      ...rewards,
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to get user rewards', error, {
      userId: req.user.id,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to get rewards',
      enterprise: true
    });
  }
});

// POST /api/v1/advertising/use-reward - Use/consume a user reward
router.post('/use-reward', [
  authenticateToken,
  body('rewardType').isIn(['video_unlock', 'extra_likes', 'premium_preview', 'boost_profile']),
  body('amount').optional().isInt({ min: 1, max: 10 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      rewardType,
      amount = 1
    } = req.body;

    const result = await EnterpriseAdService.useUserReward(req.user.id, rewardType, amount);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.reason,
        message: result.message,
        enterprise: true
      });
    }

    EnterpriseLogger.info('User reward consumed', req.user.id, {
      rewardType,
      amountUsed: result.rewardUsed,
      rewardId: result.rewardId,
      ip: req.ip
    });

    res.json({
      success: true,
      rewardUsed: result.rewardUsed,
      rewardId: result.rewardId,
      message: `${rewardType} reward used successfully!`,
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to use user reward', error, {
      userId: req.user.id,
      rewardData: req.body,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to use reward',
      enterprise: true
    });
  }
});

// GET /api/v1/advertising/config/:placement - Get ad configuration for placement
router.get('/config/:placement', authenticateToken, async (req, res) => {
  try {
    const { placement } = req.params;
    const { country = 'US', tier = 'free' } = req.query;

    const config = await EnterpriseAdService.getAdConfiguration(placement, country, tier);

    if (!config) {
      return res.status(404).json({
        error: 'No ad configuration found for this placement',
        placement,
        enterprise: true
      });
    }

    // Don't expose sensitive internal config
    const publicConfig = {
      adNetwork: config.ad_network,
      adType: config.ad_type,
      adUnitId: config.ad_unit_id,
      placementLocation: config.placement_location,
      rewardType: config.reward_type,
      rewardAmount: config.reward_amount,
      frequencyCapPerHour: config.frequency_cap_per_hour,
      minimumInterval: config.minimum_interval_seconds
    };

    EnterpriseLogger.info('Ad configuration retrieved', req.user.id, {
      placement,
      adNetwork: config.ad_network,
      adType: config.ad_type,
      ip: req.ip
    });

    res.json({
      success: true,
      config: publicConfig,
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to get ad configuration', error, {
      userId: req.user.id,
      placement: req.params.placement,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to get ad configuration',
      enterprise: true
    });
  }
});

// POST /api/v1/advertising/video-unlock-request - Request video unlock via rewarded ad
router.post('/video-unlock-request', authenticateToken, async (req, res) => {
  try {
    // Check if user is eligible for video unlock
    const eligibility = await EnterpriseAdService.canUserWatchRewardedAd(
      req.user.id,
      'video_unlock',
      'video_unlock'
    );

    if (!eligibility.canWatch) {
      return res.status(400).json({
        success: false,
        reason: eligibility.reason,
        message: eligibility.message,
        canWatch: false,
        enterprise: true
      });
    }

    // Get ad configuration for video unlock
    const adConfig = await EnterpriseAdService.getAdConfiguration('video_unlock', 'US', 'free');

    if (!adConfig) {
      return res.status(503).json({
        error: 'Video unlock ads temporarily unavailable',
        message: 'Please try again later',
        enterprise: true
      });
    }

    EnterpriseLogger.info('Video unlock ad requested', req.user.id, {
      eligibilityCheck: eligibility,
      adUnit: adConfig.ad_unit_id,
      ip: req.ip
    });

    res.json({
      success: true,
      canWatch: true,
      adConfig: {
        adNetwork: adConfig.ad_network,
        adType: adConfig.ad_type,
        adUnitId: adConfig.ad_unit_id,
        rewardType: adConfig.reward_type,
        rewardAmount: adConfig.reward_amount
      },
      remaining: {
        rewardedVideosToday: eligibility.remainingToday,
        videoUnlocksToday: eligibility.remainingRewards
      },
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Video unlock request failed', error, {
      userId: req.user.id,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to process video unlock request',
      enterprise: true
    });
  }
});

// ADMIN ENDPOINTS

// GET /api/v1/advertising/analytics - Get revenue analytics (Admin only)
router.get('/analytics', [
  authenticateToken,
  // TODO: Add admin role check middleware
], async (req, res) => {
  try {
    // TODO: Implement admin role check
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    const {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0],
      groupBy = 'day'
    } = req.query;

    const analytics = await EnterpriseAdService.getRevenueAnalytics(startDate, endDate, groupBy);

    EnterpriseLogger.info('Revenue analytics requested', req.user.id, {
      startDate,
      endDate,
      groupBy,
      recordCount: analytics.analytics.length,
      ip: req.ip
    });

    res.json({
      success: true,
      ...analytics,
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to get revenue analytics', error, {
      userId: req.user.id,
      query: req.query,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to get revenue analytics',
      enterprise: true
    });
  }
});

// GET /api/v1/advertising/health - Ad service health check
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const health = await EnterpriseAdService.healthCheck();
    
    res.json({
      ...health,
      endpoint: 'advertising/health',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    EnterpriseLogger.error('Ad service health check failed', error, {
      userId: req.user.id,
      ip: req.ip
    });
    
    res.status(500).json({
      status: 'error',
      service: 'Enterprise Ad Service',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;