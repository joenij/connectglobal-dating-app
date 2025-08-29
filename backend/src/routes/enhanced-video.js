const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/security');
const EnhancedVideoService = require('../services/EnhancedVideoService');
const PushNotificationService = require('../services/PushNotificationService');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');

const router = express.Router();

// POST /api/v1/videos/upload - Upload and process video with AI verification
router.post('/upload', authenticateToken, (req, res) => {
  const upload = EnhancedVideoService.upload.single('video');
  
  upload(req, res, async (err) => {
    if (err) {
      EnterpriseLogger.error('Video upload error', err, { userId: req.user.id });
      return res.status(400).json({ 
        error: err.message,
        code: 'UPLOAD_ERROR'
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        error: 'No video file provided',
        code: 'NO_FILE'
      });
    }

    try {
      const options = {
        isProfileVideo: req.body.isProfileVideo === 'true',
        enableAIVerification: req.body.enableAIVerification !== 'false',
        enableDeepfakeDetection: req.body.enableDeepfakeDetection !== 'false',
        generateThumbnails: req.body.generateThumbnails !== 'false'
      };

      EnterpriseLogger.info('Processing video upload', req.user.id, {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        ...options
      });

      const result = await EnhancedVideoService.processVideoUpload(
        req.user.id, 
        req.file, 
        options
      );

      // Send notification if video was approved automatically
      if (result.aiVerified && options.isProfileVideo) {
        try {
          await PushNotificationService.sendVideoApprovedNotification(req.user.id);
        } catch (notificationError) {
          EnterpriseLogger.error('Video approval notification failed', notificationError, { 
            userId: req.user.id,
            videoId: result.id 
          });
        }
      }

      res.json({
        success: true,
        video: result,
        processing: {
          aiVerified: result.aiVerified,
          deepfakeScore: result.deepfakeScore,
          status: result.status
        },
        message: result.aiVerified ? 
          'Video uploaded and verified successfully' : 
          'Video uploaded and is pending review'
      });

    } catch (error) {
      EnterpriseLogger.error('Video processing failed', error, { 
        userId: req.user.id,
        fileName: req.file?.originalname 
      });
      
      res.status(500).json({ 
        error: 'Video processing failed',
        details: error.message,
        code: 'PROCESSING_ERROR'
      });
    }
  });
});

// GET /api/v1/videos/user/:userId - Get user's videos
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Users can only view their own videos or videos of users they matched with
    if (userId !== req.user.id.toString()) {
      // TODO: Check if users are matched
      // const areMatched = await Match.areUsersMatched(req.user.id, userId);
      // if (!areMatched) {
      //   return res.status(403).json({ error: 'Access denied' });
      // }
    }

    // TODO: Implement getUserVideos in database layer
    // const videos = await UserMedia.findByUserId(userId, 'video');
    
    res.json({
      success: true,
      videos: [], // Placeholder
      userId: parseInt(userId)
    });

  } catch (error) {
    EnterpriseLogger.error('Get user videos failed', error, { 
      userId: req.user.id,
      requestedUserId: req.params.userId 
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch videos',
      code: 'FETCH_ERROR'
    });
  }
});

// DELETE /api/v1/videos/:videoId - Delete user's video
router.delete('/:videoId', authenticateToken, async (req, res) => {
  try {
    const { videoId } = req.params;
    
    // TODO: Verify video ownership before deletion
    // const video = await UserMedia.findByIdAndUserId(videoId, req.user.id);
    // if (!video) {
    //   return res.status(404).json({ error: 'Video not found or access denied' });
    // }

    await EnhancedVideoService.deleteVideo(videoId, req.user.id);

    EnterpriseLogger.info('Video deleted', req.user.id, { videoId });

    res.json({
      success: true,
      message: 'Video deleted successfully',
      videoId
    });

  } catch (error) {
    EnterpriseLogger.error('Video deletion failed', error, { 
      userId: req.user.id,
      videoId: req.params.videoId 
    });
    
    res.status(500).json({ 
      error: 'Failed to delete video',
      code: 'DELETE_ERROR'
    });
  }
});

// GET /api/v1/videos/statistics - Get video processing statistics (admin)
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    // if (!req.user.isAdmin) {
    //   return res.status(403).json({ error: 'Admin access required' });
    // }

    const statistics = await EnhancedVideoService.getVideoStatistics();

    res.json({
      success: true,
      statistics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    EnterpriseLogger.error('Get video statistics failed', error, { userId: req.user.id });
    
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      code: 'STATS_ERROR'
    });
  }
});

// POST /api/v1/videos/:videoId/report - Report inappropriate video
router.post('/:videoId/report', [
  authenticateToken,
  body('reason').isIn(['inappropriate', 'fake', 'spam', 'harassment', 'other']),
  body('details').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { videoId } = req.params;
    const { reason, details } = req.body;

    // TODO: Implement video reporting system
    // await VideoReport.create({
    //   videoId,
    //   reporterId: req.user.id,
    //   reason,
    //   details,
    //   status: 'pending'
    // });

    EnterpriseLogger.info('Video reported', req.user.id, { 
      videoId, 
      reason,
      hasDetails: !!details 
    });

    res.json({
      success: true,
      message: 'Video report submitted successfully',
      videoId,
      reason
    });

  } catch (error) {
    EnterpriseLogger.error('Video report failed', error, { 
      userId: req.user.id,
      videoId: req.params.videoId 
    });
    
    res.status(500).json({ 
      error: 'Failed to submit report',
      code: 'REPORT_ERROR'
    });
  }
});

module.exports = router;