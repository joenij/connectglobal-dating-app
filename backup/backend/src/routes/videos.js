const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/security');
const EnterpriseVideoService = require('../services/EnterpriseVideoService');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');

const router = express.Router();

// Configure multer for video uploads (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept video files only
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// GET /api/v1/videos/can-upload - Check if user can upload video
router.get('/can-upload', authenticateToken, async (req, res) => {
  try {
    const eligibility = await EnterpriseVideoService.canUserUploadVideo(req.user.id);

    EnterpriseLogger.info('Video upload eligibility checked', req.user.id, {
      canUpload: eligibility.canUpload,
      subscriptionTier: eligibility.subscriptionTier,
      availableVideos: eligibility.usage.availableVideos,
      canUnlockViaAd: eligibility.upgrade.canUnlockViaAd,
      ip: req.ip
    });

    res.json({
      success: true,
      ...eligibility,
      freemium: {
        isFreeTier: eligibility.subscriptionTier === 'free',
        upgradeRequired: eligibility.upgrade.upgradeRecommended,
        adUnlockAvailable: eligibility.upgrade.canUnlockViaAd
      },
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to check video upload eligibility', error, {
      userId: req.user.id,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to check upload eligibility',
      enterprise: true
    });
  }
});

// POST /api/v1/videos/unlock-via-ad - Unlock video upload via rewarded ad
router.post('/unlock-via-ad', [
  authenticateToken,
  body('adEngagementId').isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { adEngagementId } = req.body;

    const result = await EnterpriseVideoService.unlockVideoViaAd(req.user.id, adEngagementId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        ...result,
        enterprise: true
      });
    }

    EnterpriseLogger.info('Video upload unlocked via rewarded ad', req.user.id, {
      adEngagementId,
      videosUnlocked: result.videosUnlocked,
      ip: req.ip
    });

    res.json({
      success: true,
      ...result,
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to unlock video via ad', error, {
      userId: req.user.id,
      adEngagementId: req.body.adEngagementId,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to unlock video upload',
      enterprise: true
    });
  }
});

// POST /api/v1/videos/upload - Upload video with freemium restrictions
router.post('/upload', [
  authenticateToken,
  upload.single('video'),
  body('durationSeconds').isInt({ min: 5, max: 120 }),
  body('unlockAdEngagementId').optional().isInt({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Video file is required',
        enterprise: true
      });
    }

    const {
      durationSeconds,
      unlockAdEngagementId
    } = req.body;

    const metadata = {
      durationSeconds: parseInt(durationSeconds),
      unlockAdEngagementId: unlockAdEngagementId ? parseInt(unlockAdEngagementId) : null
    };

    const result = await EnterpriseVideoService.processVideoUpload(
      req.user.id,
      req.file,
      metadata
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        ...result,
        enterprise: true
      });
    }

    EnterpriseLogger.info('Video uploaded successfully', req.user.id, {
      videoId: result.videoId,
      filename: req.file.originalname,
      fileSize: req.file.size,
      duration: metadata.durationSeconds,
      qualityLevel: result.processing.qualityLevel,
      ip: req.ip
    });

    res.json({
      success: true,
      ...result,
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Video upload failed', error, {
      userId: req.user.id,
      filename: req.file?.originalname,
      fileSize: req.file?.size,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Video upload failed',
      enterprise: true
    });
  }
});

// GET /api/v1/videos/stats - Get user's video statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await EnterpriseVideoService.getUserVideoStats(req.user.id);

    EnterpriseLogger.info('Video stats retrieved', req.user.id, {
      subscriptionTier: stats.subscriptionTier,
      videosToday: stats.usage.today.videosUploaded,
      totalVideos: stats.usage.total.allTimeVideos,
      ip: req.ip
    });

    res.json(stats);

  } catch (error) {
    EnterpriseLogger.error('Failed to get video stats', error, {
      userId: req.user.id,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to get video statistics',
      enterprise: true
    });
  }
});

// GET /api/v1/videos/my-videos - Get user's uploaded videos
router.get('/my-videos', authenticateToken, async (req, res) => {
  try {
    const {
      limit = 20,
      offset = 0,
      status = 'all' // 'all', 'pending', 'approved', 'rejected'
    } = req.query;

    // Build status filter
    let statusFilter = '';
    if (status !== 'all') {
      statusFilter = 'AND verification_status = $3';
    }

    const query = `
      SELECT 
        id, original_filename, duration_seconds, resolution, quality_level,
        s3_url, thumbnail_url, processing_status, verification_status,
        unlock_method, uploaded_at, processed_at, verified_at
      FROM video_metadata
      WHERE user_id = $1
      ${statusFilter}
      ORDER BY uploaded_at DESC
      LIMIT $${status === 'all' ? 2 : 3} OFFSET $${status === 'all' ? 3 : 4}
    `;

    const queryParams = status === 'all' ? 
      [req.user.id, limit, offset] :
      [req.user.id, limit, offset, status];

    const result = await query(query, queryParams);

    const videos = result.rows.map(video => ({
      id: video.id,
      filename: video.original_filename,
      duration: video.duration_seconds,
      resolution: video.resolution,
      qualityLevel: video.quality_level,
      videoUrl: video.s3_url,
      thumbnailUrl: video.thumbnail_url,
      processing: {
        status: video.processing_status,
        processedAt: video.processed_at
      },
      verification: {
        status: video.verification_status,
        verifiedAt: video.verified_at
      },
      unlockMethod: video.unlock_method,
      uploadedAt: video.uploaded_at
    }));

    EnterpriseLogger.info('User videos retrieved', req.user.id, {
      videoCount: videos.length,
      status,
      limit,
      offset,
      ip: req.ip
    });

    res.json({
      success: true,
      videos,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: videos.length === parseInt(limit)
      },
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to get user videos', error, {
      userId: req.user.id,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to get videos',
      enterprise: true
    });
  }
});

// GET /api/v1/videos/processing-status/:videoId - Get video processing status
router.get('/processing-status/:videoId', authenticateToken, async (req, res) => {
  try {
    const { videoId } = req.params;

    const result = await query(`
      SELECT processing_status, verification_status, processed_at, s3_url, thumbnail_url
      FROM video_metadata
      WHERE id = $1 AND user_id = $2
    `, [videoId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Video not found',
        enterprise: true
      });
    }

    const video = result.rows[0];

    const status = {
      processing: {
        status: video.processing_status,
        isCompleted: video.processing_status === 'completed',
        processedAt: video.processed_at
      },
      verification: {
        status: video.verification_status,
        isPending: video.verification_status === 'pending'
      },
      urls: video.processing_status === 'completed' ? {
        videoUrl: video.s3_url,
        thumbnailUrl: video.thumbnail_url
      } : null
    };

    res.json({
      success: true,
      videoId: parseInt(videoId),
      ...status,
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to get video processing status', error, {
      userId: req.user.id,
      videoId: req.params.videoId,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to get processing status',
      enterprise: true
    });
  }
});

// GET /api/v1/videos/limits - Get current tier limits and features
router.get('/limits', authenticateToken, async (req, res) => {
  try {
    // Get user subscription
    const userResult = await query(`
      SELECT subscription_tier, subscription_status FROM users WHERE id = $1
    `, [req.user.id]);

    const user = userResult.rows[0];
    const subscriptionTier = user?.subscription_status === 'active' ? 
      user.subscription_tier : 'free';

    // Get all tier information for comparison
    const allLimits = EnterpriseVideoService.videoLimits;
    const currentLimits = allLimits[subscriptionTier] || allLimits.free;

    // Get today's usage for context
    const eligibility = await EnterpriseVideoService.canUserUploadVideo(req.user.id);

    res.json({
      success: true,
      currentTier: subscriptionTier,
      limits: currentLimits,
      usage: eligibility.usage,
      upgradeOptions: {
        free: allLimits.free,
        basic: allLimits.basic,
        premium: allLimits.premium,
        ultimate: allLimits.ultimate
      },
      freemium: {
        isFreeTier: subscriptionTier === 'free',
        canUnlockViaAds: subscriptionTier === 'free',
        upgradeRecommended: subscriptionTier === 'free' && eligibility.usage.availableVideos === 0
      },
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to get video limits', error, {
      userId: req.user.id,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to get video limits',
      enterprise: true
    });
  }
});

// DELETE /api/v1/videos/:videoId - Delete user's video
router.delete('/:videoId', authenticateToken, async (req, res) => {
  try {
    const { videoId } = req.params;

    // Get video info first
    const videoResult = await query(`
      SELECT s3_key, original_filename FROM video_metadata
      WHERE id = $1 AND user_id = $2
    `, [videoId, req.user.id]);

    if (videoResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Video not found',
        enterprise: true
      });
    }

    const video = videoResult.rows[0];

    // Delete from storage (S3)
    if (video.s3_key) {
      try {
        await S3Service.deleteFile(video.s3_key);
      } catch (storageError) {
        EnterpriseLogger.warn('Failed to delete video from storage', storageError, {
          videoId,
          s3Key: video.s3_key
        });
      }
    }

    // Delete from database
    await query('DELETE FROM video_metadata WHERE id = $1 AND user_id = $2', [videoId, req.user.id]);

    // Update usage counters (decrease today's count if uploaded today)
    const today = new Date().toISOString().split('T')[0];
    await query(`
      UPDATE user_video_usage 
      SET videos_uploaded_today = GREATEST(videos_uploaded_today - 1, 0)
      WHERE user_id = $1 AND date = $2
    `, [req.user.id, today]);

    EnterpriseLogger.info('Video deleted successfully', req.user.id, {
      videoId,
      filename: video.original_filename,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Video deleted successfully',
      videoId: parseInt(videoId),
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to delete video', error, {
      userId: req.user.id,
      videoId: req.params.videoId,
      ip: req.ip
    });
    res.status(500).json({
      error: 'Failed to delete video',
      enterprise: true
    });
  }
});

// GET /api/v1/videos/health - Video service health check
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const health = await EnterpriseVideoService.healthCheck();
    
    res.json({
      ...health,
      endpoint: 'videos/health',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    EnterpriseLogger.error('Video service health check failed', error, {
      userId: req.user.id,
      ip: req.ip
    });
    
    res.status(500).json({
      status: 'error',
      service: 'Enterprise Video Service',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;