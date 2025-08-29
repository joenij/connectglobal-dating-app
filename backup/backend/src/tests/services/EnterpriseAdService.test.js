const { expect } = require('@jest/globals');
const EnterpriseAdService = require('../../services/EnterpriseAdService');
const { query } = require('../../services/database');

// Mock database
jest.mock('../../services/database');
const mockQuery = query;

describe('EnterpriseAdService', () => {
  let adService;

  beforeEach(() => {
    adService = new EnterpriseAdService();
    jest.clearAllMocks();
  });

  describe('trackAdEngagement', () => {
    it('should track ad engagement with all required fields', async () => {
      // Mock user lookup
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'user123', 
            subscription_tier: 'free', 
            country_code: 'DE' 
          }] 
        })
        .mockResolvedValueOnce({ 
          rows: [{ id: 'engagement123' }] 
        });

      const userId = 'user123';
      const adData = {
        adNetwork: 'admob',
        adType: 'rewarded_video',
        adUnitId: 'ca-app-pub-test',
        placementLocation: 'video_unlock',
        action: 'reward_earned',
        rewardType: 'video_unlock',
        rewardAmount: 1,
        revenueUsd: 0.05,
        sessionId: 'session123',
        deviceType: 'mobile'
      };

      const result = await adService.trackAdEngagement(userId, adData);

      expect(result).toEqual({
        success: true,
        engagementId: 'engagement123',
        tracked: true
      });

      // Verify database calls
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, subscription_tier, country_code FROM users'),
        [userId]
      );
    });

    it('should handle missing user gracefully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await adService.trackAdEngagement('nonexistent', {
        adNetwork: 'admob',
        adType: 'banner',
        action: 'impression'
      });

      expect(result).toEqual({
        success: false,
        error: 'User not found',
        tracked: false
      });
    });

    it('should calculate correct revenue for different ad types', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'user123', subscription_tier: 'free', country_code: 'US' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'engagement123' }] });

      const testCases = [
        { adType: 'banner', expectedRevenue: 0.01 },
        { adType: 'interstitial', expectedRevenue: 0.02 },
        { adType: 'rewarded_video', expectedRevenue: 0.05 }
      ];

      for (const testCase of testCases) {
        await adService.trackAdEngagement('user123', {
          adNetwork: 'admob',
          adType: testCase.adType,
          action: 'impression'
        });

        const insertCall = mockQuery.mock.calls.find(call => 
          call[0].includes('INSERT INTO user_ad_engagement')
        );
        expect(insertCall[1]).toContain(testCase.expectedRevenue);
        
        jest.clearAllMocks();
        mockQuery
          .mockResolvedValueOnce({ rows: [{ id: 'user123', subscription_tier: 'free', country_code: 'US' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'engagement123' }] });
      }
    });
  });

  describe('checkRewardedAdEligibility', () => {
    it('should allow rewarded ads for free users within limits', async () => {
      const mockUsageData = {
        rows: [{
          rewarded_ads_today: 2,
          last_rewarded_ad: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
        }]
      };
      
      mockQuery.mockResolvedValueOnce(mockUsageData);

      const result = await adService.checkRewardedAdEligibility('user123', 'video_unlock');

      expect(result).toEqual({
        canWatch: true,
        remaining: {
          adsToday: 3, // 5 max - 2 used
          cooldownMinutes: 0
        },
        reason: null
      });
    });

    it('should enforce daily limits for rewarded ads', async () => {
      const mockUsageData = {
        rows: [{
          rewarded_ads_today: 5,
          last_rewarded_ad: new Date().toISOString()
        }]
      };
      
      mockQuery.mockResolvedValueOnce(mockUsageData);

      const result = await adService.checkRewardedAdEligibility('user123', 'video_unlock');

      expect(result).toEqual({
        canWatch: false,
        remaining: {
          adsToday: 0,
          cooldownMinutes: 0
        },
        reason: 'daily_limit_reached',
        message: expect.stringContaining('daily limit')
      });
    });

    it('should enforce cooldown periods between rewarded ads', async () => {
      const mockUsageData = {
        rows: [{
          rewarded_ads_today: 1,
          last_rewarded_ad: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 5 minutes ago
        }]
      };
      
      mockQuery.mockResolvedValueOnce(mockUsageData);

      const result = await adService.checkRewardedAdEligibility('user123', 'video_unlock');

      expect(result).toEqual({
        canWatch: false,
        remaining: {
          adsToday: 4,
          cooldownMinutes: 25 // 30 minutes total - 5 elapsed
        },
        reason: 'cooldown_active',
        message: expect.stringContaining('wait 25 minutes')
      });
    });
  });

  describe('processRewardEarned', () => {
    it('should grant video unlock reward correctly', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'user123' }] }) // User exists
        .mockResolvedValueOnce({ rows: [{ id: 'reward123' }] }); // Reward created

      const result = await adService.processRewardEarned('user123', {
        rewardType: 'video_unlock',
        amount: 1,
        adNetwork: 'admob',
        adType: 'rewarded_video'
      });

      expect(result).toEqual({
        success: true,
        rewardGranted: {
          type: 'video_unlock',
          amount: 1,
          expiresAt: expect.any(String)
        },
        message: 'Video unlock reward granted! You can now record 1 additional video.'
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_rewards'),
        expect.arrayContaining(['user123', 'video_unlock', 1])
      );
    });

    it('should handle different reward types', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'user123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'reward123' }] });

      const rewardTypes = [
        { type: 'extra_likes', amount: 5, expectedMessage: '5 extra likes' },
        { type: 'boost_profile', amount: 1, expectedMessage: 'profile boost' },
        { type: 'premium_preview', amount: 1, expectedMessage: 'premium preview' }
      ];

      for (const reward of rewardTypes) {
        const result = await adService.processRewardEarned('user123', {
          rewardType: reward.type,
          amount: reward.amount,
          adNetwork: 'admob',
          adType: 'rewarded_video'
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain(reward.expectedMessage);
        
        jest.clearAllMocks();
        mockQuery
          .mockResolvedValueOnce({ rows: [{ id: 'user123' }] })
          .mockResolvedValueOnce({ rows: [{ id: 'reward123' }] });
      }
    });
  });

  describe('getUserRewards', () => {
    it('should return active rewards with expiration info', async () => {
      const mockRewards = {
        rows: [
          {
            id: 'reward1',
            reward_type: 'video_unlock',
            amount: 2,
            expires_at: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(), // 20 hours
            created_at: new Date().toISOString()
          },
          {
            id: 'reward2', 
            reward_type: 'extra_likes',
            amount: 3,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
            created_at: new Date().toISOString()
          }
        ]
      };

      mockQuery.mockResolvedValueOnce(mockRewards);

      const result = await adService.getUserRewards('user123');

      expect(result).toEqual({
        success: true,
        rewards: [
          {
            id: 'reward1',
            type: 'video_unlock',
            amount: 2,
            expiresAt: expect.any(String),
            isExpiringSoon: false
          },
          {
            id: 'reward2',
            type: 'extra_likes', 
            amount: 3,
            expiresAt: expect.any(String),
            isExpiringSoon: true
          }
        ]
      });
    });

    it('should return empty array when no rewards exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await adService.getUserRewards('user123');

      expect(result).toEqual({
        success: true,
        rewards: []
      });
    });
  });

  describe('useReward', () => {
    it('should consume reward and update amount', async () => {
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'reward1', 
            amount: 3, 
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() 
          }] 
        })
        .mockResolvedValueOnce({ rows: [{ id: 'reward1' }] }); // Update success

      const result = await adService.useReward('user123', 'video_unlock', 1);

      expect(result).toEqual({
        success: true,
        rewardUsed: 1,
        remainingAmount: 2,
        message: 'Reward used successfully!'
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_rewards SET amount = amount - $1'),
        [1, 'reward1']
      );
    });

    it('should handle insufficient reward amount', async () => {
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'reward1', 
          amount: 1, 
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() 
        }] 
      });

      const result = await adService.useReward('user123', 'video_unlock', 5);

      expect(result).toEqual({
        success: false,
        error: 'insufficient_amount',
        message: 'Not enough video_unlock rewards available (requested: 5, available: 1)'
      });
    });

    it('should handle expired rewards', async () => {
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'reward1', 
          amount: 5, 
          expires_at: new Date(Date.now() - 1000).toISOString() // Expired
        }] 
      });

      const result = await adService.useReward('user123', 'video_unlock', 1);

      expect(result).toEqual({
        success: false,
        error: 'reward_expired',
        message: 'Reward has expired'
      });
    });
  });

  describe('getRevenueAnalytics', () => {
    it('should calculate revenue metrics correctly', async () => {
      const mockRevenueData = {
        rows: [{
          total_impressions: 1500,
          total_revenue: 25.50,
          unique_users: 200,
          total_clicks: 45,
          total_rewards: 30
        }]
      };

      mockQuery.mockResolvedValueOnce(mockRevenueData);

      const result = await adService.getRevenueAnalytics('2024-01-01', '2024-01-31');

      expect(result).toEqual({
        success: true,
        analytics: {
          totalImpressions: 1500,
          totalRevenue: 25.50,
          uniqueUsers: 200,
          averageRevenuePerUser: 0.1275, // 25.50 / 200
          clickThroughRate: 3.0, // (45 / 1500) * 100
          rewardCompletionRate: 66.67, // (30 / 45) * 100
          averageCPM: 17.00 // (25.50 / 1500) * 1000
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      const result = await adService.trackAdEngagement('user123', {
        adNetwork: 'admob',
        adType: 'banner',
        action: 'impression'
      });

      expect(result).toEqual({
        success: false,
        error: 'Failed to track ad engagement: Database connection failed',
        tracked: false
      });
    });

    it('should validate required fields', async () => {
      const result = await adService.trackAdEngagement('user123', {
        // Missing required fields
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should sanitize input data', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'user123', subscription_tier: 'free', country_code: 'US' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'engagement123' }] });

      const maliciousInput = {
        adNetwork: 'admob',
        adType: "'; DROP TABLE users; --",
        action: 'impression',
        placementLocation: '<script>alert("xss")</script>'
      };

      const result = await adService.trackAdEngagement('user123', maliciousInput);

      // Should succeed but sanitize the input
      expect(result.success).toBe(true);
      
      const insertCall = mockQuery.mock.calls.find(call => 
        call[0].includes('INSERT INTO user_ad_engagement')
      );
      
      // Verify malicious content was sanitized
      expect(insertCall[1]).not.toContain('DROP TABLE');
      expect(insertCall[1]).not.toContain('<script>');
    });
  });
});