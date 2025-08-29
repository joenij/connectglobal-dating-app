import { jest } from '@jest/globals';
import AdService from '../services/AdService';
import { MobileAds, TestIds } from 'react-native-google-mobile-ads';

// Mock react-native-google-mobile-ads
jest.mock('react-native-google-mobile-ads', () => ({
  MobileAds: jest.fn(() => ({
    initialize: jest.fn(),
    setTestDeviceIds: jest.fn(),
  })),
  TestIds: {
    BANNER: 'ca-app-pub-3940256099942544/6300978111',
    INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
    REWARDED_VIDEO: 'ca-app-pub-3940256099942544/5224354917',
  },
  BannerAd: jest.fn(),
  InterstitialAd: {
    createForAdRequest: jest.fn(),
  },
  RewardedAd: {
    createForAdRequest: jest.fn(),
  },
  AdEventType: {
    LOADED: 'loaded',
    OPENED: 'opened',
    CLOSED: 'closed',
    ERROR: 'error',
  },
  RewardedAdEventType: {
    EARNED_REWARD: 'earned_reward',
  },
}));

// Mock Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('AdService', () => {
  const mockMobileAds = {
    initialize: jest.fn(),
    setTestDeviceIds: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (MobileAds as jest.Mock).mockReturnValue(mockMobileAds);
    
    // Reset AdService state
    (AdService as any).initialized = false;
  });

  describe('initialize', () => {
    it('should initialize AdMob successfully', async () => {
      mockMobileAds.initialize.mockResolvedValue(undefined);
      mockMobileAds.setTestDeviceIds.mockResolvedValue(undefined);

      const result = await AdService.initialize();

      expect(result).toBe(true);
      expect(mockMobileAds.initialize).toHaveBeenCalled();
      expect(mockMobileAds.setTestDeviceIds).toHaveBeenCalledWith(['EMULATOR']);
    });

    it('should handle initialization failure', async () => {
      mockMobileAds.initialize.mockRejectedValue(new Error('AdMob init failed'));

      const result = await AdService.initialize();

      expect(result).toBe(false);
    });

    it('should only initialize once', async () => {
      mockMobileAds.initialize.mockResolvedValue(undefined);

      await AdService.initialize();
      await AdService.initialize();

      expect(mockMobileAds.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('trackAdEngagement', () => {
    beforeEach(() => {
      // Mock getAuthToken
      (AdService as any).getAuthToken = jest.fn().mockResolvedValue('test-token');
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    it('should track ad engagement with backend', async () => {
      await (AdService as any).trackAdEngagement(
        'admob',
        'banner',
        'home_screen',
        'impression',
        {
          adUnitId: 'test-unit-id',
          deviceType: 'ios'
        }
      );

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/advertising/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          adNetwork: 'admob',
          adType: 'banner',
          placementLocation: 'home_screen',
          action: 'impression',
          adUnitId: 'test-unit-id',
          rewardType: undefined,
          rewardAmount: 0,
          revenueUsd: 0.00,
          sessionId: expect.any(String),
          deviceType: 'ios'
        })
      });
    });

    it('should handle tracking failures gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      // Should not throw error
      await expect((AdService as any).trackAdEngagement(
        'admob',
        'banner', 
        'home_screen',
        'impression'
      )).resolves.not.toThrow();
    });
  });

  describe('showRewardedVideoAd', () => {
    let mockRewardedAd: any;

    beforeEach(() => {
      mockRewardedAd = {
        addAdEventListener: jest.fn(),
        load: jest.fn().mockResolvedValue(undefined),
        show: jest.fn().mockResolvedValue(undefined),
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    it('should show rewarded video ad successfully', async () => {
      const { RewardedAd } = require('react-native-google-mobile-ads');
      RewardedAd.createForAdRequest.mockReturnValue(mockRewardedAd);

      // Mock successful reward earning
      let rewardListener: (reward: any) => void;
      mockRewardedAd.addAdEventListener.mockImplementation((eventType: string, callback: any) => {
        if (eventType === 'earned_reward') {
          rewardListener = callback;
          // Simulate reward earned after short delay
          setTimeout(() => callback({ type: 'reward', amount: 1 }), 100);
        }
      });

      const rewardPromise = AdService.showRewardedVideoAd('video_unlock', 'video_unlock');
      
      // Wait a bit for the event listener to be set up
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await rewardPromise;

      expect(result).toEqual({
        type: 'video_unlock',
        amount: 1
      });

      expect(RewardedAd.createForAdRequest).toHaveBeenCalledWith(TestIds.REWARDED_VIDEO);
      expect(mockRewardedAd.load).toHaveBeenCalled();
      expect(mockRewardedAd.show).toHaveBeenCalled();
    });

    it('should handle ad load failure', async () => {
      const { RewardedAd } = require('react-native-google-mobile-ads');
      RewardedAd.createForAdRequest.mockReturnValue(mockRewardedAd);
      
      mockRewardedAd.load.mockRejectedValue(new Error('Ad failed to load'));

      await expect(AdService.showRewardedVideoAd('video_unlock')).rejects.toThrow('Ad failed to load');
    });

    it('should handle ad closed before completion', async () => {
      const { RewardedAd } = require('react-native-google-mobile-ads');
      RewardedAd.createForAdRequest.mockReturnValue(mockRewardedAd);

      // Mock ad closed event
      mockRewardedAd.addAdEventListener.mockImplementation((eventType: string, callback: any) => {
        if (eventType === 'closed') {
          setTimeout(() => callback(), 100);
        }
      });

      await expect(AdService.showRewardedVideoAd('video_unlock')).rejects.toThrow('Rewarded ad closed before completion');
    });

    it('should not show rewarded ads if not initialized', async () => {
      await expect(AdService.showRewardedVideoAd('video_unlock')).resolves.toBeNull();
    });
  });

  describe('canWatchRewardedAd', () => {
    beforeEach(() => {
      (AdService as any).getAuthToken = jest.fn().mockResolvedValue('test-token');
    });

    it('should check rewarded ad eligibility', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          eligibility: {
            canWatch: true,
            remaining: { adsToday: 3, cooldownMinutes: 0 }
          }
        }),
      });

      const result = await AdService.canWatchRewardedAd('video_unlock');

      expect(result).toEqual({
        canWatch: true,
        remaining: { adsToday: 3, cooldownMinutes: 0 }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/advertising/can-watch-rewarded?rewardType=video_unlock&placementLocation=video_unlock',
        {
          headers: {
            'Authorization': 'Bearer test-token',
          },
        }
      );
    });

    it('should handle cooldown periods', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          eligibility: {
            canWatch: false,
            reason: 'cooldown_active',
            message: 'Please wait 15 minutes',
            remaining: { adsToday: 2, cooldownMinutes: 15 }
          }
        }),
      });

      const result = await AdService.canWatchRewardedAd('video_unlock');

      expect(result).toEqual({
        canWatch: false,
        reason: 'cooldown_active',
        message: 'Please wait 15 minutes',
        remaining: { adsToday: 2, cooldownMinutes: 15 }
      });
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await AdService.canWatchRewardedAd('video_unlock');

      expect(result).toEqual({
        canWatch: false,
        reason: 'error',
        message: 'Unable to check ad availability'
      });
    });
  });

  describe('requestVideoUnlock', () => {
    beforeEach(() => {
      (AdService as any).getAuthToken = jest.fn().mockResolvedValue('test-token');
    });

    it('should request video unlock successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          canWatch: true,
          adConfig: {
            adNetwork: 'admob',
            adType: 'rewarded_video',
            adUnitId: 'test-unit-id',
            rewardType: 'video_unlock'
          },
          remaining: { adsToday: 2 }
        }),
      });

      const result = await AdService.requestVideoUnlock();

      expect(result).toEqual({
        success: true,
        canWatch: true,
        adConfig: expect.objectContaining({
          adNetwork: 'admob',
          adType: 'rewarded_video'
        }),
        remaining: { adsToday: 2 }
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/advertising/video-unlock-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      });
    });

    it('should handle daily limit reached', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          reason: 'daily_limit_reached',
          message: 'Daily video unlock limit reached'
        }),
      });

      const result = await AdService.requestVideoUnlock();

      expect(result).toEqual({
        success: false,
        canWatch: false,
        reason: 'daily_limit_reached',
        message: 'Daily video unlock limit reached'
      });
    });
  });

  describe('getUserRewards', () => {
    beforeEach(() => {
      (AdService as any).getAuthToken = jest.fn().mockResolvedValue('test-token');
    });

    it('should get user rewards successfully', async () => {
      const mockRewards = [
        {
          type: 'video_unlock',
          amount: 2,
          expiresAt: '2024-12-31T23:59:59Z',
          isExpiringSoon: false
        }
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          rewards: mockRewards
        }),
      });

      const result = await AdService.getUserRewards();

      expect(result).toEqual({
        success: true,
        rewards: mockRewards
      });
    });

    it('should handle empty rewards', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          rewards: []
        }),
      });

      const result = await AdService.getUserRewards();

      expect(result).toEqual({
        success: true,
        rewards: []
      });
    });
  });

  describe('useReward', () => {
    beforeEach(() => {
      (AdService as any).getAuthToken = jest.fn().mockResolvedValue('test-token');
    });

    it('should use reward successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          rewardUsed: 1,
          message: 'Reward used successfully!'
        }),
      });

      const result = await AdService.useReward('video_unlock', 1);

      expect(result).toEqual({
        success: true,
        rewardUsed: 1,
        message: 'Reward used successfully!'
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/advertising/use-reward', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          rewardType: 'video_unlock',
          amount: 1
        })
      });
    });

    it('should handle insufficient reward amount', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          error: 'insufficient_amount',
          message: 'Not enough rewards available'
        }),
      });

      const result = await AdService.useReward('video_unlock', 5);

      expect(result).toEqual({
        success: false,
        error: 'insufficient_amount',
        message: 'Not enough rewards available'
      });
    });
  });

  describe('getAdConfig', () => {
    beforeEach(() => {
      (AdService as any).getAuthToken = jest.fn().mockResolvedValue('test-token');
    });

    it('should get ad configuration for placement', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          config: {
            adNetwork: 'admob',
            adType: 'banner',
            adUnitId: 'ca-app-pub-test-banner',
            placementLocation: 'home_screen'
          }
        }),
      });

      const result = await AdService.getAdConfig('home_screen', 'US', 'free');

      expect(result).toEqual({
        adNetwork: 'admob',
        adType: 'banner',
        adUnitId: 'ca-app-pub-test-banner',
        placementLocation: 'home_screen'
      });
    });

    it('should handle missing ad configuration', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await AdService.getAdConfig('unknown_placement');

      expect(result).toBeNull();
    });
  });

  describe('preloadAds', () => {
    let mockInterstitialAd: any;

    beforeEach() {
      (AdService as any).initialized = true;
      
      mockInterstitialAd = {
        load: jest.fn().mockResolvedValue(undefined),
      };

      const { InterstitialAd, RewardedAd } = require('react-native-google-mobile-ads');
      InterstitialAd.createForAdRequest.mockReturnValue(mockInterstitialAd);
      RewardedAd.createForAdRequest.mockReturnValue(mockInterstitialAd);
    });

    it('should preload ads successfully', async () => {
      await AdService.preloadAds();

      const { InterstitialAd, RewardedAd } = require('react-native-google-mobile-ads');
      expect(InterstitialAd.createForAdRequest).toHaveBeenCalled();
      expect(RewardedAd.createForAdRequest).toHaveBeenCalled();
      expect(mockInterstitialAd.load).toHaveBeenCalledTimes(2);
    });

    it('should handle preload failures gracefully', async () => {
      mockInterstitialAd.load.mockRejectedValue(new Error('Preload failed'));

      // Should not throw error
      await expect(AdService.preloadAds()).resolves.not.toThrow();
    });

    it('should not preload if not initialized', async () => {
      (AdService as any).initialized = false;

      await AdService.preloadAds();

      const { InterstitialAd } = require('react-native-google-mobile-ads');
      expect(InterstitialAd.createForAdRequest).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup ad resources', () => {
      AdService.cleanup();

      // Should not throw errors
      expect(() => AdService.cleanup()).not.toThrow();
    });
  });

  describe('Utility Methods', () => {
    it('should generate unique session IDs', () => {
      const sessionId1 = (AdService as any).generateSessionId();
      const sessionId2 = (AdService as any).generateSessionId();

      expect(sessionId1).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(sessionId2).toMatch(/^session_\d+_[a-z0-9]+$/);
      expect(sessionId1).not.toBe(sessionId2);
    });

    it('should return correct ad unit IDs for different environments', () => {
      // Development mode
      (global as any).__DEV__ = true;
      let adUnitId = (AdService as any).getAdUnitId('banner');
      expect(adUnitId).toBe(TestIds.BANNER);

      // Production mode  
      (global as any).__DEV__ = false;
      process.env.ADMOB_IOS_BANNER_ID = 'ca-app-pub-production-banner';
      
      adUnitId = (AdService as any).getAdUnitId('banner');
      expect(adUnitId).toBe('ca-app-pub-production-banner');
    });
  });
});