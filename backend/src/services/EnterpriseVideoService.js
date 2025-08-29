const EnterpriseLogger = require('./EnterpriseLoggerService');
const EnterpriseAdService = require('./EnterpriseAdService');
const { query } = require('../config/database');
const S3Service = require('./S3Service');

/**
 * Enterprise Video Service - FREEMIUM VIDEO FEATURES
 * ================================================
 * 
 * This service manages video features with freemium model:
 * - Free users: Limited videos + ad-unlocked videos
 * - Premium users: Unlimited videos + HD processing
 * - Video verification and quality gates
 * - Ad-based video unlock system
 * - Enterprise video analytics
 */
class EnterpriseVideoService {
  constructor() {
    this.videoLimits = {
      free: {
        videosPerDay: 1,
        maxDurationSeconds: 15,
        qualityLevel: 'standard', // 480p
        unlockMethod: 'rewarded_ad',
        maxVideosViaAds: 3 // Additional videos per day via ads
      },
      basic: {
        videosPerDay: 3,
        maxDurationSeconds: 30,
        qualityLevel: 'hd', // 720p
        unlockMethod: 'subscription'
      },
      premium: {
        videosPerDay: 10,
        maxDurationSeconds: 60,
        qualityLevel: 'hd', // 720p
        unlockMethod: 'subscription',
        hasFilters: true
      },
      ultimate: {
        videosPerDay: 'unlimited',
        maxDurationSeconds: 120,
        qualityLevel: 'fullhd', // 1080p
        unlockMethod: 'subscription',
        hasFilters: true,
        hasEffects: true
      }
    };

    this.isInitialized = false;
    this.initialize();
  }

  async initialize() {
    try {
      await this.createVideoTables();
      this.isInitialized = true;
      
      EnterpriseLogger.info('✅ Enterprise Video Service initialized', null, {
        service: 'EnterpriseVideoService',
        tiers: Object.keys(this.videoLimits),
        freemiumEnabled: true,
        adIntegration: true,
        enterprise: true
      });
    } catch (error) {
      EnterpriseLogger.error('❌ Enterprise Video Service initialization failed', error);
      throw error;
    }
  }

  async createVideoTables() {
    // Enhanced video usage tracking
    const createVideoUsageTable = `
      CREATE TABLE IF NOT EXISTS user_video_usage (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        
        -- DAILY COUNTERS
        videos_uploaded_today INTEGER DEFAULT 0,
        videos_unlocked_via_ads INTEGER DEFAULT 0,
        total_video_duration_seconds INTEGER DEFAULT 0,
        
        -- QUALITY METRICS
        videos_hd_processed INTEGER DEFAULT 0,
        videos_with_filters INTEGER DEFAULT 0,
        videos_with_effects INTEGER DEFAULT 0,
        
        -- VERIFICATION STATUS
        videos_pending_verification INTEGER DEFAULT 0,
        videos_verified INTEGER DEFAULT 0,
        videos_rejected INTEGER DEFAULT 0,
        
        -- METADATA
        last_video_upload TIMESTAMP,
        last_ad_unlock TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, date)
      );
    `;

    // Video metadata with processing info
    const createVideoMetadataTable = `
      CREATE TABLE IF NOT EXISTS video_metadata (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        
        -- FILE INFO
        original_filename VARCHAR(255),
        file_size_bytes BIGINT,
        duration_seconds INTEGER,
        resolution VARCHAR(20), -- '480p', '720p', '1080p'
        format VARCHAR(10), -- 'mp4', 'mov', etc.
        
        -- PROCESSING INFO
        processing_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
        quality_level VARCHAR(20) DEFAULT 'standard', -- 'standard', 'hd', 'fullhd'
        has_filters BOOLEAN DEFAULT false,
        has_effects BOOLEAN DEFAULT false,
        
        -- STORAGE INFO
        s3_key VARCHAR(500),
        s3_url VARCHAR(1000),
        thumbnail_url VARCHAR(1000),
        
        -- UNLOCK METHOD
        unlock_method VARCHAR(20) DEFAULT 'subscription', -- 'subscription', 'rewarded_ad', 'free_limit'
        unlock_ad_engagement_id INTEGER, -- Reference to ad that unlocked this video
        
        -- VERIFICATION
        verification_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
        verification_notes TEXT,
        verified_at TIMESTAMP,
        verified_by INTEGER,
        
        -- TIMESTAMPS
        uploaded_at TIMESTAMP DEFAULT NOW(),
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (unlock_ad_engagement_id) REFERENCES user_ad_engagement(id)
      );
    `;

    await query(createVideoUsageTable);
    await query(createVideoMetadataTable);

    EnterpriseLogger.info('✅ Enterprise video tables created', null, {
      tables: ['user_video_usage', 'video_metadata'],
      enterprise: true
    });
  }

  /**
   * CHECK IF USER CAN UPLOAD VIDEO
   */
  async canUserUploadVideo(userId) {
    try {
      // Get user subscription info
      const userResult = await query(`
        SELECT subscription_tier, subscription_status, country_code
        FROM users WHERE id = $1
      `, [userId]);

      const user = userResult.rows[0];
      if (!user) {
        throw new Error('User not found');
      }

      const subscriptionTier = user.subscription_status === 'active' ? 
        user.subscription_tier : 'free';
      
      const limits = this.videoLimits[subscriptionTier] || this.videoLimits.free;

      // Get today's usage
      const today = new Date().toISOString().split('T')[0];
      const usageResult = await query(`
        SELECT videos_uploaded_today, videos_unlocked_via_ads, last_video_upload
        FROM user_video_usage
        WHERE user_id = $1 AND date = $2
      `, [userId, today]);

      const usage = usageResult.rows[0] || { 
        videos_uploaded_today: 0, 
        videos_unlocked_via_ads: 0,
        last_video_upload: null
      };

      // Calculate available videos
      let availableVideos = 0;

      if (limits.videosPerDay === 'unlimited') {
        availableVideos = 999; // Effectively unlimited
      } else {
        availableVideos = limits.videosPerDay - usage.videos_uploaded_today;
        
        // For free users, add videos unlocked via ads
        if (subscriptionTier === 'free') {
          const maxAdVideos = limits.maxVideosViaAds || 0;
          const usedAdVideos = usage.videos_unlocked_via_ads || 0;
          availableVideos += Math.max(0, maxAdVideos - usedAdVideos);
        }
      }

      // Check cooldown period (prevent spam)
      let cooldownRemaining = 0;
      if (usage.last_video_upload) {
        const lastUploadTime = new Date(usage.last_video_upload);
        const cooldownMinutes = subscriptionTier === 'free' ? 30 : 5; // 30 min for free, 5 min for premium
        const cooldownExpiry = new Date(lastUploadTime.getTime() + cooldownMinutes * 60 * 1000);
        
        if (Date.now() < cooldownExpiry.getTime()) {
          cooldownRemaining = Math.ceil((cooldownExpiry.getTime() - Date.now()) / (1000 * 60));
        }
      }

      const canUpload = availableVideos > 0 && cooldownRemaining === 0;

      // If free user is out of videos, check if they can unlock via ads
      let canUnlockViaAd = false;
      if (!canUpload && subscriptionTier === 'free' && availableVideos <= 0) {
        const adEligibility = await EnterpriseAdService.canUserWatchRewardedAd(
          userId, 'video_unlock', 'video_unlock'
        );
        canUnlockViaAd = adEligibility.canWatch;
      }

      return {
        canUpload,
        subscriptionTier,
        limits,
        usage: {
          videosToday: usage.videos_uploaded_today,
          videosViaAds: usage.videos_unlocked_via_ads,
          availableVideos,
          lastUpload: usage.last_video_upload
        },
        restrictions: {
          cooldownRemaining,
          maxDuration: limits.maxDurationSeconds,
          qualityLevel: limits.qualityLevel
        },
        upgrade: {
          canUnlockViaAd,
          upgradeRecommended: subscriptionTier === 'free' && !canUnlockViaAd
        }
      };

    } catch (error) {
      EnterpriseLogger.error('Failed to check video upload eligibility', error, { userId });
      throw error;
    }
  }

  /**
   * UNLOCK VIDEO UPLOAD VIA REWARDED AD
   */
  async unlockVideoViaAd(userId, adEngagementId) {
    try {
      // Verify the ad reward exists and is valid
      const rewardResult = await EnterpriseAdService.useUserReward(userId, 'video_unlock', 1);
      
      if (!rewardResult.success) {
        return {
          success: false,
          reason: rewardResult.reason,
          message: rewardResult.message
        };
      }

      // Update today's usage to include the unlocked video
      const today = new Date().toISOString().split('T')[0];
      await query(`
        INSERT INTO user_video_usage (user_id, date, videos_unlocked_via_ads, last_ad_unlock)
        VALUES ($1, $2, 1, NOW())
        ON CONFLICT (user_id, date)
        DO UPDATE SET
          videos_unlocked_via_ads = user_video_usage.videos_unlocked_via_ads + 1,
          last_ad_unlock = NOW()
      `, [userId, today]);

      EnterpriseLogger.info('Video upload unlocked via rewarded ad', userId, {
        adEngagementId,
        rewardUsed: rewardResult.rewardUsed,
        date: today
      });

      return {
        success: true,
        videosUnlocked: 1,
        expiresIn: '24 hours',
        message: 'Video upload unlocked! You can now record your video.'
      };

    } catch (error) {
      EnterpriseLogger.error('Failed to unlock video via ad', error, { userId, adEngagementId });
      throw error;
    }
  }

  /**
   * PROCESS VIDEO UPLOAD
   */
  async processVideoUpload(userId, videoFile, metadata = {}) {
    try {
      // Check upload eligibility first
      const eligibility = await this.canUserUploadVideo(userId);
      if (!eligibility.canUpload) {
        return {
          success: false,
          reason: 'upload_not_allowed',
          message: 'Video upload not allowed. Check your daily limits.',
          eligibility
        };
      }

      // Get user subscription info
      const userResult = await query(`
        SELECT subscription_tier, subscription_status 
        FROM users WHERE id = $1
      `, [userId]);

      const user = userResult.rows[0];
      const subscriptionTier = user.subscription_status === 'active' ? 
        user.subscription_tier : 'free';
      
      const limits = this.videoLimits[subscriptionTier];

      // Validate video duration
      if (metadata.durationSeconds > limits.maxDurationSeconds) {
        return {
          success: false,
          reason: 'duration_too_long',
          message: `Video too long. Maximum duration: ${limits.maxDurationSeconds} seconds`,
          maxDuration: limits.maxDurationSeconds
        };
      }

      // Determine unlock method
      let unlockMethod = 'subscription';
      let unlockAdEngagementId = null;

      if (subscriptionTier === 'free') {
        const usage = eligibility.usage;
        if (usage.videosToday === 0) {
          unlockMethod = 'free_limit';
        } else {
          unlockMethod = 'rewarded_ad';
          // This would be provided from the frontend after ad completion
          unlockAdEngagementId = metadata.unlockAdEngagementId || null;
        }
      }

      // Upload to S3/storage
      const uploadResult = await this.uploadVideoToStorage(userId, videoFile, {
        subscriptionTier,
        qualityLevel: limits.qualityLevel
      });

      if (!uploadResult.success) {
        throw new Error('Video upload to storage failed');
      }

      // Save video metadata
      const videoMetadataResult = await query(`
        INSERT INTO video_metadata (
          user_id, original_filename, file_size_bytes, duration_seconds,
          resolution, format, quality_level, s3_key, s3_url, thumbnail_url,
          unlock_method, unlock_ad_engagement_id, processing_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'processing')
        RETURNING id
      `, [
        userId, videoFile.originalname, videoFile.size, metadata.durationSeconds,
        uploadResult.resolution, uploadResult.format, limits.qualityLevel,
        uploadResult.s3Key, uploadResult.s3Url, uploadResult.thumbnailUrl,
        unlockMethod, unlockAdEngagementId
      ]);

      const videoId = videoMetadataResult.rows[0].id;

      // Update usage counters
      const today = new Date().toISOString().split('T')[0];
      await query(`
        INSERT INTO user_video_usage (user_id, date, videos_uploaded_today, total_video_duration_seconds, last_video_upload)
        VALUES ($1, $2, 1, $3, NOW())
        ON CONFLICT (user_id, date)
        DO UPDATE SET
          videos_uploaded_today = user_video_usage.videos_uploaded_today + 1,
          total_video_duration_seconds = user_video_usage.total_video_duration_seconds + $3,
          last_video_upload = NOW()
      `, [userId, today, metadata.durationSeconds]);

      // Start background processing
      this.startVideoProcessing(videoId, limits.qualityLevel);

      EnterpriseLogger.info('Video upload processed successfully', userId, {
        videoId,
        filename: videoFile.originalname,
        duration: metadata.durationSeconds,
        qualityLevel: limits.qualityLevel,
        unlockMethod,
        subscriptionTier
      });

      return {
        success: true,
        videoId,
        uploadResult,
        processing: {
          status: 'processing',
          qualityLevel: limits.qualityLevel,
          estimatedTime: this.estimateProcessingTime(metadata.durationSeconds, limits.qualityLevel)
        },
        message: 'Video uploaded successfully and is being processed'
      };

    } catch (error) {
      EnterpriseLogger.error('Video upload processing failed', error, { userId });
      throw error;
    }
  }

  /**
   * UPLOAD VIDEO TO STORAGE
   */
  async uploadVideoToStorage(userId, videoFile, options = {}) {
    try {
      const { subscriptionTier = 'free', qualityLevel = 'standard' } = options;
      
      // Generate unique file path
      const timestamp = Date.now();
      const fileExtension = videoFile.originalname.split('.').pop();
      const s3Key = `videos/${userId}/${timestamp}-${qualityLevel}.${fileExtension}`;
      
      // Upload to S3
      const s3Url = await S3Service.uploadBuffer(videoFile.buffer, s3Key, 'video/mp4');
      
      // Generate thumbnail (simplified for now)
      const thumbnailKey = `thumbnails/${userId}/${timestamp}-thumb.jpg`;
      const thumbnailUrl = S3Service.getPublicUrl(thumbnailKey);
      
      // Detect video properties
      const resolution = this.detectVideoResolution(qualityLevel);
      const format = fileExtension.toLowerCase();

      EnterpriseLogger.info('Video uploaded to storage', userId, {
        s3Key,
        qualityLevel,
        resolution,
        fileSize: videoFile.size
      });

      return {
        success: true,
        s3Key,
        s3Url,
        thumbnailUrl,
        resolution,
        format
      };

    } catch (error) {
      EnterpriseLogger.error('Video storage upload failed', error, { userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * GET USER VIDEO STATS
   */
  async getUserVideoStats(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get current subscription
      const userResult = await query(`
        SELECT subscription_tier, subscription_status FROM users WHERE id = $1
      `, [userId]);

      const user = userResult.rows[0];
      const subscriptionTier = user?.subscription_status === 'active' ? 
        user.subscription_tier : 'free';

      // Get today's usage
      const usageResult = await query(`
        SELECT * FROM user_video_usage WHERE user_id = $1 AND date = $2
      `, [userId, today]);

      const usage = usageResult.rows[0] || {};

      // Get total video count
      const totalVideosResult = await query(`
        SELECT COUNT(*) as total, 
               COUNT(CASE WHEN verification_status = 'approved' THEN 1 END) as approved
        FROM video_metadata WHERE user_id = $1
      `, [userId]);

      const totals = totalVideosResult.rows[0];

      // Get limits for current tier
      const limits = this.videoLimits[subscriptionTier] || this.videoLimits.free;

      return {
        success: true,
        subscriptionTier,
        limits,
        usage: {
          today: {
            videosUploaded: usage.videos_uploaded_today || 0,
            videosUnlockedViaAds: usage.videos_unlocked_via_ads || 0,
            totalDuration: usage.total_video_duration_seconds || 0,
            lastUpload: usage.last_video_upload
          },
          total: {
            allTimeVideos: parseInt(totals.total),
            approvedVideos: parseInt(totals.approved)
          }
        },
        features: {
          hasFilters: limits.hasFilters || false,
          hasEffects: limits.hasEffects || false,
          qualityLevel: limits.qualityLevel,
          maxDuration: limits.maxDurationSeconds
        },
        enterprise: true
      };

    } catch (error) {
      EnterpriseLogger.error('Failed to get user video stats', error, { userId });
      throw error;
    }
  }

  // UTILITY METHODS

  detectVideoResolution(qualityLevel) {
    const resolutionMap = {
      'standard': '480p',
      'hd': '720p', 
      'fullhd': '1080p'
    };
    return resolutionMap[qualityLevel] || '480p';
  }

  estimateProcessingTime(durationSeconds, qualityLevel) {
    const baseTime = durationSeconds * 2; // 2x realtime as base
    const qualityMultiplier = {
      'standard': 1.0,
      'hd': 1.5,
      'fullhd': 2.0
    }[qualityLevel] || 1.0;
    
    return Math.ceil(baseTime * qualityMultiplier); // seconds
  }

  async startVideoProcessing(videoId, qualityLevel) {
    // This would typically trigger background processing
    // For now, we'll just simulate it
    setTimeout(async () => {
      try {
        await query(`
          UPDATE video_metadata 
          SET processing_status = 'completed', processed_at = NOW()
          WHERE id = $1
        `, [videoId]);

        EnterpriseLogger.info('Video processing completed', null, { videoId, qualityLevel });
      } catch (error) {
        EnterpriseLogger.error('Video processing failed', error, { videoId });
      }
    }, 5000); // 5 second simulation
  }

  // HEALTH CHECK
  async healthCheck() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const videosToday = await query(`
        SELECT COUNT(*) as count FROM video_metadata 
        WHERE DATE(uploaded_at) = $1
      `, [today]);

      const processingQueue = await query(`
        SELECT COUNT(*) as count FROM video_metadata 
        WHERE processing_status = 'processing'
      `);

      return {
        status: 'healthy',
        service: 'Enterprise Video Service',
        initialized: this.isInitialized,
        features: {
          freemiumTiers: Object.keys(this.videoLimits),
          adIntegration: true,
          qualityLevels: ['standard', 'hd', 'fullhd']
        },
        metrics: {
          videosUploadedToday: parseInt(videosToday.rows[0].count),
          videosInProcessing: parseInt(processingQueue.rows[0].count)
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        service: 'Enterprise Video Service',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new EnterpriseVideoService();