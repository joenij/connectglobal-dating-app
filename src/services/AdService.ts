import {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
  MobileAds
} from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

export interface AdConfig {
  adNetwork: 'admob';
  adType: 'banner' | 'interstitial' | 'rewarded_video';
  adUnitId: string;
  placementLocation: string;
  rewardType?: 'video_unlock' | 'extra_likes' | 'premium_preview' | 'boost_profile';
  rewardAmount?: number;
}

export interface RewardResult {
  type: string;
  amount: number;
}

class AdService {
  private initialized = false;
  private interstitialAd?: InterstitialAd;
  private rewardedAd?: RewardedAd;

  // Test Ad Unit IDs (use in development)
  private testAdUnits = {
    banner: TestIds.BANNER,
    interstitial: TestIds.INTERSTITIAL,
    rewarded: TestIds.REWARDED_VIDEO,
  };

  // Production Ad Unit IDs (set in environment)
  private productionAdUnits = {
    banner: Platform.OS === 'ios' ? 
      process.env.ADMOB_IOS_BANNER_ID : 
      process.env.ADMOB_ANDROID_BANNER_ID,
    interstitial: Platform.OS === 'ios' ?
      process.env.ADMOB_IOS_INTERSTITIAL_ID :
      process.env.ADMOB_ANDROID_INTERSTITIAL_ID,
    rewarded: Platform.OS === 'ios' ?
      process.env.ADMOB_IOS_REWARDED_ID :
      process.env.ADMOB_ANDROID_REWARDED_ID,
  };

  async initialize(): Promise<boolean> {
    try {
      await MobileAds().initialize();
      
      // Set test device IDs for development
      if (__DEV__) {
        await MobileAds().setTestDeviceIds(['EMULATOR']);
      }

      this.initialized = true;
      console.log('✅ AdMob initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ AdMob initialization failed:', error);
      return false;
    }
  }

  private getAdUnitId(adType: string): string {
    const adUnits = __DEV__ ? this.testAdUnits : this.productionAdUnits;
    return adUnits[adType as keyof typeof adUnits] || this.testAdUnits[adType as keyof typeof this.testAdUnits];
  }

  /**
   * TRACK AD ENGAGEMENT WITH BACKEND
   */
  private async trackAdEngagement(
    adNetwork: string,
    adType: string,
    placementLocation: string,
    action: 'impression' | 'click' | 'reward_earned' | 'dismissed',
    options: {
      adUnitId?: string;
      rewardType?: string;
      rewardAmount?: number;
      revenueUsd?: number;
      sessionId?: string;
      deviceType?: string;
    } = {}
  ): Promise<void> {
    try {
      const response = await fetch('/api/v1/advertising/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({
          adNetwork,
          adType,
          placementLocation,
          action,
          adUnitId: options.adUnitId,
          rewardType: options.rewardType,
          rewardAmount: options.rewardAmount || 0,
          revenueUsd: options.revenueUsd || 0.00,
          sessionId: options.sessionId || this.generateSessionId(),
          deviceType: Platform.OS
        })
      });

      if (!response.ok) {
        throw new Error(`Ad tracking failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('Ad engagement tracked:', result);
    } catch (error) {
      console.error('Failed to track ad engagement:', error);
    }
  }

  /**
   * SHOW BANNER AD
   */
  createBannerAd(placementLocation: string): React.ReactElement | null {
    if (!this.initialized) {
      console.warn('AdMob not initialized, cannot show banner');
      return null;
    }

    const adUnitId = this.getAdUnitId('banner');

    return (
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          console.log('Banner ad loaded');
          this.trackAdEngagement('admob', 'banner', placementLocation, 'impression', {
            adUnitId
          });
        }}
        onAdFailedToLoad={(error) => {
          console.error('Banner ad failed to load:', error);
        }}
        onAdOpened={() => {
          console.log('Banner ad opened');
          this.trackAdEngagement('admob', 'banner', placementLocation, 'click', {
            adUnitId
          });
        }}
        onAdClosed={() => {
          console.log('Banner ad closed');
        }}
      />
    );
  }

  /**
   * LOAD AND SHOW INTERSTITIAL AD
   */
  async showInterstitialAd(placementLocation: string): Promise<boolean> {
    if (!this.initialized) {
      console.warn('AdMob not initialized, cannot show interstitial');
      return false;
    }

    try {
      const adUnitId = this.getAdUnitId('interstitial');
      
      // Create new interstitial ad
      this.interstitialAd = InterstitialAd.createForAdRequest(adUnitId);

      // Set up event listeners
      this.interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
        console.log('Interstitial ad loaded');
        this.trackAdEngagement('admob', 'interstitial', placementLocation, 'impression', {
          adUnitId
        });
      });

      this.interstitialAd.addAdEventListener(AdEventType.OPENED, () => {
        console.log('Interstitial ad opened');
        this.trackAdEngagement('admob', 'interstitial', placementLocation, 'click', {
          adUnitId
        });
      });

      this.interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
        console.log('Interstitial ad closed');
        this.trackAdEngagement('admob', 'interstitial', placementLocation, 'dismissed', {
          adUnitId
        });
      });

      // Load the ad
      await this.interstitialAd.load();
      
      // Show the ad if loaded
      await this.interstitialAd.show();
      
      return true;
    } catch (error) {
      console.error('Failed to show interstitial ad:', error);
      return false;
    }
  }

  /**
   * LOAD AND SHOW REWARDED VIDEO AD
   */
  async showRewardedVideoAd(
    placementLocation: string,
    rewardType: string = 'video_unlock'
  ): Promise<RewardResult | null> {
    if (!this.initialized) {
      console.warn('AdMob not initialized, cannot show rewarded video');
      return null;
    }

    return new Promise((resolve, reject) => {
      try {
        const adUnitId = this.getAdUnitId('rewarded');
        
        // Create new rewarded ad
        this.rewardedAd = RewardedAd.createForAdRequest(adUnitId);

        let adShown = false;

        // Set up event listeners
        this.rewardedAd.addAdEventListener(AdEventType.LOADED, () => {
          console.log('Rewarded ad loaded');
          this.trackAdEngagement('admob', 'rewarded_video', placementLocation, 'impression', {
            adUnitId,
            rewardType
          });
        });

        this.rewardedAd.addAdEventListener(AdEventType.OPENED, () => {
          console.log('Rewarded ad opened');
          adShown = true;
        });

        this.rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
          console.log('Rewarded ad reward earned:', reward);
          
          // Track reward earned
          this.trackAdEngagement('admob', 'rewarded_video', placementLocation, 'reward_earned', {
            adUnitId,
            rewardType,
            rewardAmount: 1, // Usually 1 video unlock
            revenueUsd: 0.05 // Estimated revenue per rewarded video
          });

          resolve({
            type: rewardType,
            amount: 1
          });
        });

        this.rewardedAd.addAdEventListener(AdEventType.CLOSED, () => {
          console.log('Rewarded ad closed');
          
          if (!adShown) {
            // Ad was closed before being shown
            this.trackAdEngagement('admob', 'rewarded_video', placementLocation, 'dismissed', {
              adUnitId,
              rewardType
            });
            reject(new Error('Rewarded ad closed before completion'));
          }
        });

        this.rewardedAd.addAdEventListener(AdEventType.ERROR, (error) => {
          console.error('Rewarded ad error:', error);
          reject(new Error(`Rewarded ad failed: ${error.message}`));
        });

        // Load and show the ad
        this.rewardedAd.load().then(() => {
          this.rewardedAd?.show();
        }).catch((error) => {
          console.error('Failed to load rewarded ad:', error);
          reject(error);
        });

      } catch (error) {
        console.error('Failed to create rewarded ad:', error);
        reject(error);
      }
    });
  }

  /**
   * CHECK IF USER CAN WATCH REWARDED AD
   */
  async canWatchRewardedAd(rewardType: string = 'video_unlock'): Promise<{
    canWatch: boolean;
    reason?: string;
    message?: string;
    remaining?: any;
  }> {
    try {
      const response = await fetch(`/api/v1/advertising/can-watch-rewarded?rewardType=${rewardType}&placementLocation=video_unlock`, {
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const result = await response.json();
      return result.eligibility;
    } catch (error) {
      console.error('Failed to check rewarded ad eligibility:', error);
      return {
        canWatch: false,
        reason: 'error',
        message: 'Unable to check ad availability'
      };
    }
  }

  /**
   * REQUEST VIDEO UNLOCK (checks eligibility and returns ad config)
   */
  async requestVideoUnlock(): Promise<{
    success: boolean;
    canWatch: boolean;
    adConfig?: AdConfig;
    remaining?: any;
    reason?: string;
    message?: string;
  }> {
    try {
      const response = await fetch('/api/v1/advertising/video-unlock-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          canWatch: false,
          reason: error.reason,
          message: error.message
        };
      }

      const result = await response.json();
      return {
        success: true,
        canWatch: result.canWatch,
        adConfig: result.adConfig,
        remaining: result.remaining
      };
    } catch (error) {
      console.error('Failed to request video unlock:', error);
      return {
        success: false,
        canWatch: false,
        reason: 'error',
        message: 'Failed to request video unlock'
      };
    }
  }

  /**
   * GET USER'S CURRENT REWARDS
   */
  async getUserRewards(): Promise<{
    success: boolean;
    rewards: Array<{
      type: string;
      amount: number;
      expiresAt: string;
      isExpiringSoon: boolean;
    }>;
  }> {
    try {
      const response = await fetch('/api/v1/advertising/rewards', {
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get user rewards:', error);
      return { success: false, rewards: [] };
    }
  }

  /**
   * USE/CONSUME A REWARD
   */
  async useReward(rewardType: string, amount: number = 1): Promise<{
    success: boolean;
    rewardUsed?: number;
    message?: string;
    error?: string;
  }> {
    try {
      const response = await fetch('/api/v1/advertising/use-reward', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({
          rewardType,
          amount
        })
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error,
          message: error.message
        };
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to use reward:', error);
      return {
        success: false,
        error: 'Failed to use reward'
      };
    }
  }

  // UTILITY METHODS

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getAuthToken(): Promise<string> {
    // This would get the token from your auth system
    // For now, returning a placeholder
    return 'your_auth_token_here';
  }

  /**
   * GET AD CONFIGURATION FOR PLACEMENT
   */
  async getAdConfig(placement: string, country: string = 'US', tier: string = 'free'): Promise<AdConfig | null> {
    try {
      const response = await fetch(`/api/v1/advertising/config/${placement}?country=${country}&tier=${tier}`, {
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      return result.config;
    } catch (error) {
      console.error('Failed to get ad configuration:', error);
      return null;
    }
  }

  /**
   * PRELOAD ADS FOR BETTER PERFORMANCE
   */
  async preloadAds(): Promise<void> {
    if (!this.initialized) return;

    try {
      // Preload interstitial
      const interstitialAdUnitId = this.getAdUnitId('interstitial');
      this.interstitialAd = InterstitialAd.createForAdRequest(interstitialAdUnitId);
      this.interstitialAd.load().catch(error => {
        console.warn('Failed to preload interstitial:', error);
      });

      // Preload rewarded video
      const rewardedAdUnitId = this.getAdUnitId('rewarded');
      this.rewardedAd = RewardedAd.createForAdRequest(rewardedAdUnitId);
      this.rewardedAd.load().catch(error => {
        console.warn('Failed to preload rewarded video:', error);
      });

      console.log('Ads preloaded successfully');
    } catch (error) {
      console.error('Failed to preload ads:', error);
    }
  }

  /**
   * CLEANUP RESOURCES
   */
  cleanup(): void {
    this.interstitialAd = undefined;
    this.rewardedAd = undefined;
  }
}

export default new AdService();