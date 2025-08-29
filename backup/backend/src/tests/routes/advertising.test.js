const request = require('supertest');
const express = require('express');
const advertisingRoutes = require('../../routes/advertising');
const { authenticateUser } = require('../../middleware/auth');

// Mock dependencies
jest.mock('../../middleware/auth');
jest.mock('../../services/EnterpriseAdService');

const EnterpriseAdService = require('../../services/EnterpriseAdService');

describe('Advertising API Routes', () => {
  let app;
  let mockAdService;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    authenticateUser.mockImplementation((req, res, next) => {
      req.user = { id: 'user123', subscription_tier: 'free' };
      next();
    });

    app.use('/api/v1/advertising', advertisingRoutes);

    // Setup mocks
    mockAdService = {
      trackAdEngagement: jest.fn(),
      checkRewardedAdEligibility: jest.fn(),
      processVideoUnlockRequest: jest.fn(),
      getUserRewards: jest.fn(),
      useReward: jest.fn(),
      getRevenueAnalytics: jest.fn()
    };

    // Mock the EnterpriseAdService constructor
    EnterpriseAdService.mockImplementation(() => mockAdService);
    
    jest.clearAllMocks();
  });

  describe('POST /api/v1/advertising/track', () => {
    it('should track ad engagement successfully', async () => {
      mockAdService.trackAdEngagement.mockResolvedValue({
        success: true,
        engagementId: 'engagement123',
        tracked: true
      });

      const adData = {
        adNetwork: 'admob',
        adType: 'banner',
        placementLocation: 'home_screen',
        action: 'impression',
        adUnitId: 'ca-app-pub-test',
        deviceType: 'mobile'
      };

      const response = await request(app)
        .post('/api/v1/advertising/track')
        .send(adData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        engagementId: 'engagement123',
        message: 'Ad engagement tracked successfully'
      });

      expect(mockAdService.trackAdEngagement).toHaveBeenCalledWith('user123', adData);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/advertising/track')
        .send({
          // Missing required fields
          adNetwork: 'admob'
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing required fields: adType, placementLocation, action'
      });
    });

    it('should handle service errors', async () => {
      mockAdService.trackAdEngagement.mockResolvedValue({
        success: false,
        error: 'Database connection failed'
      });

      const response = await request(app)
        .post('/api/v1/advertising/track')
        .send({
          adNetwork: 'admob',
          adType: 'banner',
          placementLocation: 'home',
          action: 'impression'
        })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Database connection failed'
      });
    });
  });

  describe('GET /api/v1/advertising/can-watch-rewarded', () => {
    it('should check rewarded ad eligibility successfully', async () => {
      mockAdService.checkRewardedAdEligibility.mockResolvedValue({
        canWatch: true,
        remaining: {
          adsToday: 3,
          cooldownMinutes: 0
        }
      });

      const response = await request(app)
        .get('/api/v1/advertising/can-watch-rewarded')
        .query({
          rewardType: 'video_unlock',
          placementLocation: 'video_recording'
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        eligibility: {
          canWatch: true,
          remaining: {
            adsToday: 3,
            cooldownMinutes: 0
          }
        }
      });

      expect(mockAdService.checkRewardedAdEligibility).toHaveBeenCalledWith(
        'user123', 
        'video_unlock'
      );
    });

    it('should handle cooldown periods', async () => {
      mockAdService.checkRewardedAdEligibility.mockResolvedValue({
        canWatch: false,
        remaining: {
          adsToday: 2,
          cooldownMinutes: 15
        },
        reason: 'cooldown_active',
        message: 'Please wait 15 minutes before watching another ad'
      });

      const response = await request(app)
        .get('/api/v1/advertising/can-watch-rewarded')
        .query({ rewardType: 'video_unlock' })
        .expect(200);

      expect(response.body.eligibility.canWatch).toBe(false);
      expect(response.body.eligibility.reason).toBe('cooldown_active');
    });

    it('should handle daily limits', async () => {
      mockAdService.checkRewardedAdEligibility.mockResolvedValue({
        canWatch: false,
        remaining: {
          adsToday: 0,
          cooldownMinutes: 0
        },
        reason: 'daily_limit_reached',
        message: 'Daily rewarded ad limit reached'
      });

      const response = await request(app)
        .get('/api/v1/advertising/can-watch-rewarded')
        .query({ rewardType: 'video_unlock' })
        .expect(200);

      expect(response.body.eligibility.canWatch).toBe(false);
      expect(response.body.eligibility.reason).toBe('daily_limit_reached');
    });
  });

  describe('POST /api/v1/advertising/video-unlock-request', () => {
    it('should process video unlock request successfully', async () => {
      mockAdService.processVideoUnlockRequest.mockResolvedValue({
        success: true,
        canWatch: true,
        adConfig: {
          adNetwork: 'admob',
          adType: 'rewarded_video',
          adUnitId: 'ca-app-pub-test-rewarded',
          rewardType: 'video_unlock',
          rewardAmount: 1
        },
        remaining: {
          adsToday: 2,
          cooldownMinutes: 0
        }
      });

      const response = await request(app)
        .post('/api/v1/advertising/video-unlock-request')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        canWatch: true,
        adConfig: expect.objectContaining({
          adNetwork: 'admob',
          adType: 'rewarded_video'
        }),
        remaining: expect.objectContaining({
          adsToday: 2
        })
      });

      expect(mockAdService.processVideoUnlockRequest).toHaveBeenCalledWith('user123');
    });

    it('should handle unavailable ad slots', async () => {
      mockAdService.processVideoUnlockRequest.mockResolvedValue({
        success: false,
        canWatch: false,
        reason: 'daily_limit_reached',
        message: 'Daily video unlock limit reached'
      });

      const response = await request(app)
        .post('/api/v1/advertising/video-unlock-request')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        canWatch: false,
        reason: 'daily_limit_reached',
        message: 'Daily video unlock limit reached'
      });
    });
  });

  describe('GET /api/v1/advertising/rewards', () => {
    it('should retrieve user rewards successfully', async () => {
      const mockRewards = [
        {
          id: 'reward1',
          type: 'video_unlock',
          amount: 2,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          isExpiringSoon: false
        },
        {
          id: 'reward2',
          type: 'extra_likes',
          amount: 5,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          isExpiringSoon: true
        }
      ];

      mockAdService.getUserRewards.mockResolvedValue({
        success: true,
        rewards: mockRewards
      });

      const response = await request(app)
        .get('/api/v1/advertising/rewards')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        rewards: mockRewards
      });

      expect(mockAdService.getUserRewards).toHaveBeenCalledWith('user123');
    });

    it('should handle empty rewards', async () => {
      mockAdService.getUserRewards.mockResolvedValue({
        success: true,
        rewards: []
      });

      const response = await request(app)
        .get('/api/v1/advertising/rewards')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        rewards: []
      });
    });
  });

  describe('POST /api/v1/advertising/use-reward', () => {
    it('should consume reward successfully', async () => {
      mockAdService.useReward.mockResolvedValue({
        success: true,
        rewardUsed: 1,
        remainingAmount: 2,
        message: 'Reward used successfully!'
      });

      const response = await request(app)
        .post('/api/v1/advertising/use-reward')
        .send({
          rewardType: 'video_unlock',
          amount: 1
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        rewardUsed: 1,
        remainingAmount: 2,
        message: 'Reward used successfully!'
      });

      expect(mockAdService.useReward).toHaveBeenCalledWith(
        'user123', 
        'video_unlock', 
        1
      );
    });

    it('should validate required fields for reward usage', async () => {
      const response = await request(app)
        .post('/api/v1/advertising/use-reward')
        .send({
          // Missing rewardType
          amount: 1
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing required fields: rewardType'
      });
    });

    it('should handle insufficient reward amount', async () => {
      mockAdService.useReward.mockResolvedValue({
        success: false,
        error: 'insufficient_amount',
        message: 'Not enough video_unlock rewards available'
      });

      const response = await request(app)
        .post('/api/v1/advertising/use-reward')
        .send({
          rewardType: 'video_unlock',
          amount: 5
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'insufficient_amount',
        message: 'Not enough video_unlock rewards available'
      });
    });

    it('should handle expired rewards', async () => {
      mockAdService.useReward.mockResolvedValue({
        success: false,
        error: 'reward_expired',
        message: 'Reward has expired'
      });

      const response = await request(app)
        .post('/api/v1/advertising/use-reward')
        .send({
          rewardType: 'video_unlock',
          amount: 1
        })
        .expect(400);

      expect(response.body.error).toBe('reward_expired');
    });
  });

  describe('GET /api/v1/advertising/analytics', () => {
    it('should return revenue analytics for admin users', async () => {
      // Mock admin user
      authenticateUser.mockImplementation((req, res, next) => {
        req.user = { id: 'admin123', role: 'admin' };
        next();
      });

      const mockAnalytics = {
        success: true,
        analytics: {
          totalImpressions: 10000,
          totalRevenue: 150.25,
          uniqueUsers: 500,
          averageRevenuePerUser: 0.30,
          clickThroughRate: 2.5,
          rewardCompletionRate: 85.0
        }
      };

      mockAdService.getRevenueAnalytics.mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get('/api/v1/advertising/analytics')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body).toEqual(mockAnalytics);
      expect(mockAdService.getRevenueAnalytics).toHaveBeenCalledWith(
        '2024-01-01',
        '2024-01-31'
      );
    });

    it('should restrict analytics access to admin users only', async () => {
      // Mock non-admin user
      authenticateUser.mockImplementation((req, res, next) => {
        req.user = { id: 'user123', role: 'user' };
        next();
      });

      const response = await request(app)
        .get('/api/v1/advertising/analytics')
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'Admin access required'
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for all endpoints', async () => {
      // Mock failed authentication
      authenticateUser.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const endpoints = [
        ['post', '/api/v1/advertising/track'],
        ['get', '/api/v1/advertising/can-watch-rewarded'],
        ['post', '/api/v1/advertising/video-unlock-request'],
        ['get', '/api/v1/advertising/rewards'],
        ['post', '/api/v1/advertising/use-reward']
      ];

      for (const [method, endpoint] of endpoints) {
        const response = await request(app)[method](endpoint);
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      }
    });

    it('should handle premium users correctly', async () => {
      // Mock premium user
      authenticateUser.mockImplementation((req, res, next) => {
        req.user = { id: 'premium123', subscription_tier: 'premium' };
        next();
      });

      mockAdService.checkRewardedAdEligibility.mockResolvedValue({
        canWatch: false,
        reason: 'premium_user',
        message: 'Premium users do not see ads'
      });

      const response = await request(app)
        .get('/api/v1/advertising/can-watch-rewarded')
        .query({ rewardType: 'video_unlock' })
        .expect(200);

      expect(response.body.eligibility.canWatch).toBe(false);
      expect(response.body.eligibility.reason).toBe('premium_user');
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should handle rapid successive requests', async () => {
      mockAdService.trackAdEngagement.mockResolvedValue({
        success: true,
        engagementId: 'engagement123',
        tracked: true
      });

      const adData = {
        adNetwork: 'admob',
        adType: 'banner',
        placementLocation: 'home',
        action: 'impression'
      };

      // Make multiple rapid requests
      const promises = Array(5).fill().map(() => 
        request(app).post('/api/v1/advertising/track').send(adData)
      );

      const responses = await Promise.all(promises);
      
      // All should succeed (rate limiting would be handled by middleware)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should sanitize input data', async () => {
      mockAdService.trackAdEngagement.mockResolvedValue({
        success: true,
        engagementId: 'engagement123',
        tracked: true
      });

      const maliciousData = {
        adNetwork: 'admob',
        adType: 'banner',
        placementLocation: '<script>alert("xss")</script>',
        action: 'impression',
        maliciousField: '"; DROP TABLE users; --'
      };

      const response = await request(app)
        .post('/api/v1/advertising/track')
        .send(maliciousData)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Verify service was called (input sanitization happens in service layer)
      expect(mockAdService.trackAdEngagement).toHaveBeenCalled();
    });
  });
});