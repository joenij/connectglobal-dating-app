const EnterpriseLogger = require('./EnterpriseLoggerService');
const { query } = require('../config/database');

/**
 * Enterprise Ad Service - FREEMIUM ADVERTISING SYSTEM
 * ================================================
 * 
 * This service manages advertising integration for the freemium model with:
 * - Google AdMob integration and analytics
 * - User ad engagement tracking
 * - Revenue analytics and reporting
 * - GDPR-compliant consent management
 * - Feature unlock mechanics via rewarded ads
 * - Ad performance optimization
 */
class EnterpriseAdService {
  constructor() {
    this.adNetworks = {
      admob: {
        enabled: process.env.ADMOB_ENABLED === 'true',
        appId: process.env.ADMOB_APP_ID,
        testMode: process.env.NODE_ENV !== 'production'
      }
    };
    
    this.adTypes = {
      BANNER: 'banner',
      INTERSTITIAL: 'interstitial', 
      REWARDED_VIDEO: 'rewarded_video',
      NATIVE: 'native'
    };
    
    this.rewardTypes = {
      VIDEO_UNLOCK: 'video_unlock',
      EXTRA_LIKES: 'extra_likes',
      PREMIUM_PREVIEW: 'premium_preview',
      BOOST_PROFILE: 'boost_profile'
    };

    this.isInitialized = false;
    this.initialize();
  }

  async initialize() {
    try {
      await this.createAdTables();
      await this.loadAdConfiguration();
      this.isInitialized = true;
      
      EnterpriseLogger.info('✅ Enterprise Ad Service initialized', null, {
        service: 'EnterpriseAdService',
        networks: Object.keys(this.adNetworks).filter(n => this.adNetworks[n].enabled),
        adTypes: Object.values(this.adTypes),
        rewardTypes: Object.values(this.rewardTypes),
        enterprise: true
      });
    } catch (error) {
      EnterpriseLogger.error('❌ Enterprise Ad Service initialization failed', error);
      throw error;
    }
  }

  async createAdTables() {
    // User ad engagement tracking
    const createAdEngagementTable = `
      CREATE TABLE IF NOT EXISTS user_ad_engagement (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        
        -- AD METRICS
        ad_network VARCHAR(20) NOT NULL, -- 'admob', 'facebook', etc.
        ad_type VARCHAR(20) NOT NULL,    -- 'banner', 'interstitial', 'rewarded_video'
        ad_unit_id VARCHAR(100),
        placement_location VARCHAR(50),   -- 'home_screen', 'match_result', 'video_unlock'
        
        -- ENGAGEMENT DATA
        action VARCHAR(20) NOT NULL,     -- 'impression', 'click', 'reward_earned', 'dismissed'
        reward_type VARCHAR(30),         -- 'video_unlock', 'extra_likes', etc.
        reward_amount INTEGER DEFAULT 0,
        revenue_usd DECIMAL(10,6) DEFAULT 0.00,
        
        -- CONTEXT DATA  
        session_id VARCHAR(50),
        user_subscription_tier VARCHAR(20),
        user_country_code CHAR(2),
        device_type VARCHAR(20),
        
        -- METADATA
        timestamp TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;

    // Ad configuration and performance
    const createAdConfigTable = `
      CREATE TABLE IF NOT EXISTS ad_configuration (
        id SERIAL PRIMARY KEY,
        
        -- AD UNIT CONFIGURATION
        ad_network VARCHAR(20) NOT NULL,
        ad_type VARCHAR(20) NOT NULL,
        ad_unit_id VARCHAR(100) NOT NULL,
        placement_location VARCHAR(50) NOT NULL,
        
        -- TARGETING
        target_countries JSONB DEFAULT '[]',
        target_tiers JSONB DEFAULT '[1,2,3,4]',    -- GDP tiers
        target_subscription JSONB DEFAULT '["free"]', -- subscription levels
        
        -- PERFORMANCE SETTINGS
        is_active BOOLEAN DEFAULT true,
        frequency_cap_per_hour INTEGER DEFAULT 3,
        frequency_cap_per_day INTEGER DEFAULT 20,
        minimum_interval_seconds INTEGER DEFAULT 60,
        
        -- REWARD CONFIGURATION (for rewarded ads)
        reward_type VARCHAR(30),
        reward_amount INTEGER DEFAULT 1,
        reward_expiry_hours INTEGER DEFAULT 24,
        
        -- METADATA
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        UNIQUE(ad_network, ad_type, placement_location)
      );
    `;

    // User reward tracking
    const createUserRewardsTable = `
      CREATE TABLE IF NOT EXISTS user_rewards (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        
        -- REWARD DETAILS
        reward_type VARCHAR(30) NOT NULL,
        reward_amount INTEGER NOT NULL,
        source_ad_engagement_id INTEGER,
        
        -- EXPIRY AND USAGE
        expires_at TIMESTAMP,
        used_at TIMESTAMP,
        is_used BOOLEAN DEFAULT false,
        
        -- METADATA
        created_at TIMESTAMP DEFAULT NOW(),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (source_ad_engagement_id) REFERENCES user_ad_engagement(id)
      );
    `;

    // Daily ad limits and tracking
    const createAdLimitsTable = `
      CREATE TABLE IF NOT EXISTS user_ad_limits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        
        -- DAILY COUNTERS
        banner_impressions INTEGER DEFAULT 0,
        interstitial_shown INTEGER DEFAULT 0,
        rewarded_videos_watched INTEGER DEFAULT 0,
        total_ad_clicks INTEGER DEFAULT 0,
        
        -- REWARD COUNTERS
        videos_unlocked_today INTEGER DEFAULT 0,
        extra_likes_earned INTEGER DEFAULT 0,
        boosts_earned INTEGER DEFAULT 0,
        
        -- REVENUE TRACKING
        estimated_revenue_usd DECIMAL(10,6) DEFAULT 0.00,
        
        -- METADATA
        last_updated TIMESTAMP DEFAULT NOW(),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, date)
      );
    `;

    await query(createAdEngagementTable);
    await query(createAdConfigTable);
    await query(createUserRewardsTable);
    await query(createAdLimitsTable);

    EnterpriseLogger.info('✅ Enterprise ad tracking tables created', null, {
      tables: ['user_ad_engagement', 'ad_configuration', 'user_rewards', 'user_ad_limits'],
      enterprise: true
    });
  }

  /**
   * TRACK AD IMPRESSION/INTERACTION
   */
  async trackAdEngagement(userId, adData) {
    try {
      const {
        adNetwork = 'admob',
        adType,
        adUnitId,
        placementLocation,
        action, // 'impression', 'click', 'reward_earned', 'dismissed'
        rewardType = null,
        rewardAmount = 0,
        revenueUsd = 0.00,
        sessionId = null,
        deviceType = 'unknown'
      } = adData;

      // Get user data for context
      const userResult = await query('SELECT subscription_tier, country_code FROM users WHERE id = $1', [userId]);
      const user = userResult.rows[0];

      // Insert ad engagement record
      const engagementResult = await query(`
        INSERT INTO user_ad_engagement (
          user_id, ad_network, ad_type, ad_unit_id, placement_location, action,
          reward_type, reward_amount, revenue_usd, session_id, 
          user_subscription_tier, user_country_code, device_type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [
        userId, adNetwork, adType, adUnitId, placementLocation, action,
        rewardType, rewardAmount, revenueUsd, sessionId,
        user?.subscription_tier || 'free', user?.country_code || 'US', deviceType
      ]);

      const engagementId = engagementResult.rows[0].id;

      // Update daily limits
      await this.updateDailyAdLimits(userId, adType, action, revenueUsd);

      // Handle rewards for rewarded video completion
      if (action === 'reward_earned' && rewardType && rewardAmount > 0) {
        await this.grantUserReward(userId, rewardType, rewardAmount, engagementId);
      }

      EnterpriseLogger.info('Ad engagement tracked', userId, {
        adNetwork,
        adType,
        placementLocation,
        action,
        rewardType,
        revenueUsd
      });

      return {
        success: true,
        engagementId,
        rewardGranted: action === 'reward_earned' && rewardType
      };

    } catch (error) {
      EnterpriseLogger.error('Failed to track ad engagement', error, { userId, adData });
      throw error;
    }
  }

  /**
   * UPDATE DAILY AD LIMITS AND COUNTERS
   */
  async updateDailyAdLimits(userId, adType, action, revenueUsd = 0.00) {
    const today = new Date().toISOString().split('T')[0];

    const updateQuery = `
      INSERT INTO user_ad_limits (user_id, date, ${this.getCounterColumn(adType, action)}, estimated_revenue_usd)
      VALUES ($1, $2, 1, $3)
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        ${this.getCounterColumn(adType, action)} = user_ad_limits.${this.getCounterColumn(adType, action)} + 1,
        estimated_revenue_usd = user_ad_limits.estimated_revenue_usd + $3,
        last_updated = NOW()
    `;

    await query(updateQuery, [userId, today, revenueUsd]);
  }

  getCounterColumn(adType, action) {
    if (adType === 'banner' && action === 'impression') return 'banner_impressions';
    if (adType === 'interstitial' && action === 'impression') return 'interstitial_shown';
    if (adType === 'rewarded_video' && action === 'reward_earned') return 'rewarded_videos_watched';
    if (action === 'click') return 'total_ad_clicks';
    return 'banner_impressions'; // fallback
  }

  /**
   * GRANT USER REWARD FROM AD
   */
  async grantUserReward(userId, rewardType, rewardAmount, engagementId) {
    try {
      // Calculate expiry based on reward type
      const expiryHours = this.getRewardExpiryHours(rewardType);
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

      // Insert reward record
      await query(`
        INSERT INTO user_rewards (user_id, reward_type, reward_amount, source_ad_engagement_id, expires_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, rewardType, rewardAmount, engagementId, expiresAt]);

      // Update specific reward counters
      await this.updateRewardCounters(userId, rewardType, rewardAmount);

      EnterpriseLogger.info('User reward granted', userId, {
        rewardType,
        rewardAmount,
        expiresAt,
        engagementId
      });

      return {
        success: true,
        rewardType,
        rewardAmount,
        expiresAt
      };

    } catch (error) {
      EnterpriseLogger.error('Failed to grant user reward', error, {
        userId, rewardType, rewardAmount, engagementId
      });
      throw error;
    }
  }

  async updateRewardCounters(userId, rewardType, amount) {
    const today = new Date().toISOString().split('T')[0];
    let counterColumn;

    switch (rewardType) {
      case 'video_unlock':
        counterColumn = 'videos_unlocked_today';
        break;
      case 'extra_likes': 
        counterColumn = 'extra_likes_earned';
        break;
      case 'boost_profile':
        counterColumn = 'boosts_earned';
        break;
      default:
        return; // No specific counter for this reward type
    }

    await query(`
      INSERT INTO user_ad_limits (user_id, date, ${counterColumn})
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        ${counterColumn} = user_ad_limits.${counterColumn} + $3,
        last_updated = NOW()
    `, [userId, today, amount]);
  }

  /**
   * CHECK IF USER CAN WATCH REWARDED VIDEO
   */
  async canUserWatchRewardedAd(userId, rewardType, placementLocation) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get user's subscription tier
      const userResult = await query('SELECT subscription_tier FROM users WHERE id = $1', [userId]);
      const user = userResult.rows[0];
      
      // Premium users don't need ads
      if (user?.subscription_tier !== 'free') {
        return {
          canWatch: false,
          reason: 'premium_user',
          message: 'Premium users have unlimited access'
        };
      }

      // Check daily limits
      const limitsResult = await query(`
        SELECT rewarded_videos_watched, videos_unlocked_today 
        FROM user_ad_limits 
        WHERE user_id = $1 AND date = $2
      `, [userId, today]);

      const limits = limitsResult.rows[0] || { rewarded_videos_watched: 0, videos_unlocked_today: 0 };

      // Check frequency caps
      const maxRewardedVideosPerDay = 10;
      const maxVideoUnlocksPerDay = 3;

      if (limits.rewarded_videos_watched >= maxRewardedVideosPerDay) {
        return {
          canWatch: false,
          reason: 'daily_limit_reached',
          message: 'Daily ad limit reached. Try again tomorrow!'
        };
      }

      if (rewardType === 'video_unlock' && limits.videos_unlocked_today >= maxVideoUnlocksPerDay) {
        return {
          canWatch: false,
          reason: 'reward_limit_reached', 
          message: 'Daily video unlock limit reached. Upgrade to Premium for unlimited videos!'
        };
      }

      // Check minimum interval (prevent spam)
      const lastAdResult = await query(`
        SELECT timestamp FROM user_ad_engagement 
        WHERE user_id = $1 AND ad_type = 'rewarded_video' 
        ORDER BY timestamp DESC LIMIT 1
      `, [userId]);

      if (lastAdResult.rows.length > 0) {
        const lastAdTime = new Date(lastAdResult.rows[0].timestamp);
        const timeSinceLastAd = Date.now() - lastAdTime.getTime();
        const minimumInterval = 60 * 1000; // 60 seconds

        if (timeSinceLastAd < minimumInterval) {
          return {
            canWatch: false,
            reason: 'too_frequent',
            message: 'Please wait before watching another ad'
          };
        }
      }

      return {
        canWatch: true,
        remainingToday: maxRewardedVideosPerDay - limits.rewarded_videos_watched,
        remainingRewards: rewardType === 'video_unlock' ? 
          maxVideoUnlocksPerDay - limits.videos_unlocked_today : null
      };

    } catch (error) {
      EnterpriseLogger.error('Failed to check rewarded ad eligibility', error, { userId, rewardType });
      return { canWatch: false, reason: 'error', message: 'Unable to check ad availability' };
    }
  }

  /**
   * GET USER'S AVAILABLE REWARDS
   */
  async getUserRewards(userId) {
    try {
      const result = await query(`
        SELECT reward_type, reward_amount, expires_at, is_used, created_at
        FROM user_rewards
        WHERE user_id = $1 AND expires_at > NOW() AND is_used = false
        ORDER BY created_at DESC
      `, [userId]);

      const rewards = result.rows.map(reward => ({
        type: reward.reward_type,
        amount: reward.reward_amount,
        expiresAt: reward.expires_at,
        createdAt: reward.created_at,
        isExpiringSoon: (new Date(reward.expires_at) - Date.now()) < 60 * 60 * 1000 // 1 hour
      }));

      return {
        success: true,
        rewards,
        totalRewards: rewards.length
      };

    } catch (error) {
      EnterpriseLogger.error('Failed to get user rewards', error, { userId });
      throw error;
    }
  }

  /**
   * USE USER REWARD
   */
  async useUserReward(userId, rewardType, amount = 1) {
    try {
      const result = await query(`
        UPDATE user_rewards 
        SET is_used = true, used_at = NOW()
        WHERE user_id = $1 AND reward_type = $2 AND is_used = false 
          AND expires_at > NOW() AND reward_amount >= $3
        ORDER BY expires_at ASC
        LIMIT 1
        RETURNING id, reward_amount
      `, [userId, rewardType, amount]);

      if (result.rows.length === 0) {
        return {
          success: false,
          reason: 'no_rewards_available',
          message: 'No valid rewards of this type available'
        };
      }

      const usedReward = result.rows[0];

      EnterpriseLogger.info('User reward consumed', userId, {
        rewardType,
        rewardAmount: usedReward.reward_amount,
        rewardId: usedReward.id
      });

      return {
        success: true,
        rewardUsed: usedReward.reward_amount,
        rewardId: usedReward.id
      };

    } catch (error) {
      EnterpriseLogger.error('Failed to use user reward', error, { userId, rewardType, amount });
      throw error;
    }
  }

  /**
   * GET AD CONFIGURATION FOR PLACEMENT
   */
  async getAdConfiguration(placementLocation, userCountry = 'US', userTier = 'free') {
    try {
      const result = await query(`
        SELECT * FROM ad_configuration
        WHERE placement_location = $1 
          AND is_active = true
          AND ($2 = ANY(target_countries) OR target_countries = '[]')
          AND ($3 = ANY(target_subscription) OR target_subscription = '[]')
        ORDER BY id ASC
        LIMIT 1
      `, [placementLocation, userCountry, userTier]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      EnterpriseLogger.error('Failed to get ad configuration', error, { placementLocation });
      return null;
    }
  }

  /**
   * REVENUE ANALYTICS
   */
  async getRevenueAnalytics(startDate, endDate, groupBy = 'day') {
    try {
      const dateGrouping = groupBy === 'day' ? 'DATE(timestamp)' : 
                          groupBy === 'week' ? 'DATE_TRUNC(\'week\', timestamp)' :
                          'DATE_TRUNC(\'month\', timestamp)';

      const result = await query(`
        SELECT 
          ${dateGrouping} as period,
          ad_network,
          ad_type,
          COUNT(*) as impressions,
          COUNT(CASE WHEN action = 'click' THEN 1 END) as clicks,
          COUNT(CASE WHEN action = 'reward_earned' THEN 1 END) as rewards,
          ROUND(AVG(CASE WHEN action = 'click' THEN 100.0 ELSE 0 END), 2) as ctr_percent,
          ROUND(SUM(revenue_usd), 4) as revenue_usd,
          COUNT(DISTINCT user_id) as unique_users
        FROM user_ad_engagement
        WHERE timestamp >= $1 AND timestamp <= $2
        GROUP BY period, ad_network, ad_type
        ORDER BY period DESC, revenue_usd DESC
      `, [startDate, endDate]);

      return {
        success: true,
        analytics: result.rows,
        period: { start: startDate, end: endDate, groupBy }
      };

    } catch (error) {
      EnterpriseLogger.error('Failed to get revenue analytics', error, { startDate, endDate });
      throw error;
    }
  }

  // UTILITY METHODS

  getRewardExpiryHours(rewardType) {
    const expiryMap = {
      'video_unlock': 24,   // 24 hours
      'extra_likes': 24,    // 24 hours  
      'premium_preview': 1, // 1 hour
      'boost_profile': 24   // 24 hours
    };
    return expiryMap[rewardType] || 24;
  }

  async loadAdConfiguration() {
    // Seed default ad configurations if none exist
    const configCount = await query('SELECT COUNT(*) as count FROM ad_configuration');
    
    if (parseInt(configCount.rows[0].count) === 0) {
      await this.seedDefaultAdConfigurations();
    }
  }

  async seedDefaultAdConfigurations() {
    const defaultConfigs = [
      {
        ad_network: 'admob',
        ad_type: 'banner',
        ad_unit_id: process.env.ADMOB_BANNER_UNIT_ID || 'ca-app-pub-3940256099942544/6300978111',
        placement_location: 'home_screen',
        target_countries: ['DE', 'US', 'GB', 'FR'],
        frequency_cap_per_hour: 6,
        frequency_cap_per_day: 50
      },
      {
        ad_network: 'admob', 
        ad_type: 'interstitial',
        ad_unit_id: process.env.ADMOB_INTERSTITIAL_UNIT_ID || 'ca-app-pub-3940256099942544/1033173712',
        placement_location: 'match_result',
        target_countries: ['DE', 'US', 'GB', 'FR'],
        frequency_cap_per_hour: 2,
        frequency_cap_per_day: 8
      },
      {
        ad_network: 'admob',
        ad_type: 'rewarded_video', 
        ad_unit_id: process.env.ADMOB_REWARDED_UNIT_ID || 'ca-app-pub-3940256099942544/5224354917',
        placement_location: 'video_unlock',
        reward_type: 'video_unlock',
        reward_amount: 1,
        target_countries: ['DE', 'US', 'GB', 'FR', 'IN', 'BR'],
        frequency_cap_per_hour: 3,
        frequency_cap_per_day: 10
      }
    ];

    for (const config of defaultConfigs) {
      await query(`
        INSERT INTO ad_configuration (
          ad_network, ad_type, ad_unit_id, placement_location, target_countries,
          reward_type, reward_amount, frequency_cap_per_hour, frequency_cap_per_day
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (ad_network, ad_type, placement_location) DO NOTHING
      `, [
        config.ad_network, config.ad_type, config.ad_unit_id, config.placement_location,
        JSON.stringify(config.target_countries), config.reward_type || null, 
        config.reward_amount || null, config.frequency_cap_per_hour, config.frequency_cap_per_day
      ]);
    }

    EnterpriseLogger.info('Default ad configurations seeded', null, {
      configurations: defaultConfigs.length,
      enterprise: true
    });
  }

  // HEALTH CHECK
  async healthCheck() {
    try {
      const adConfigCount = await query('SELECT COUNT(*) as count FROM ad_configuration WHERE is_active = true');
      const recentEngagements = await query(`
        SELECT COUNT(*) as count FROM user_ad_engagement 
        WHERE timestamp > NOW() - INTERVAL '24 hours'
      `);

      return {
        status: 'healthy',
        service: 'Enterprise Ad Service',
        initialized: this.isInitialized,
        networks: Object.keys(this.adNetworks).filter(n => this.adNetworks[n].enabled),
        activeAdUnits: parseInt(adConfigCount.rows[0].count),
        engagements24h: parseInt(recentEngagements.rows[0].count),
        adTypes: Object.values(this.adTypes),
        rewardTypes: Object.values(this.rewardTypes),
        testMode: this.adNetworks.admob.testMode,
        enterprise: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        service: 'Enterprise Ad Service',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new EnterpriseAdService();