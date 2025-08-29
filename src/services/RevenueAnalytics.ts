import { Platform } from 'react-native';

export interface AdRevenueData {
  timestamp: Date;
  adType: 'banner' | 'interstitial' | 'rewarded';
  adUnitId: string;
  revenue: number;
  currency: string;
  impressions: number;
  clicks: number;
  ctr: number; // Click-through rate
  ecpm: number; // Effective cost per mille
  fillRate: number;
}

export interface DailyRevenueReport {
  date: string;
  totalRevenue: number;
  totalImpressions: number;
  totalClicks: number;
  averageCTR: number;
  averageECPM: number;
  adTypeBreakdown: {
    banner: AdRevenueData;
    interstitial: AdRevenueData;
    rewarded: AdRevenueData;
  };
}

export interface UserEngagementMetrics {
  userId?: string;
  sessionStart: Date;
  sessionEnd?: Date;
  adsViewed: number;
  rewardedAdsCompleted: number;
  premiumUnlocked: boolean;
  revenueGenerated: number;
  adInteractionEvents: Array<{
    type: 'impression' | 'click' | 'reward_earned' | 'ad_failed';
    adType: string;
    timestamp: Date;
    metadata?: any;
  }>;
}

class RevenueAnalyticsService {
  private static instance: RevenueAnalyticsService;
  private revenueData: AdRevenueData[] = [];
  private userSessions: UserEngagementMetrics[] = [];
  private currentSession: UserEngagementMetrics | null = null;

  // AdMob App ID for production analytics
  private readonly appId = 'ca-app-pub-7754034105228049~1593088501';

  public static getInstance(): RevenueAnalyticsService {
    if (!RevenueAnalyticsService.instance) {
      RevenueAnalyticsService.instance = new RevenueAnalyticsService();
    }
    return RevenueAnalyticsService.instance;
  }

  /**
   * Initialize revenue tracking for the session
   */
  public startSession(userId?: string): void {
    this.currentSession = {
      userId,
      sessionStart: new Date(),
      adsViewed: 0,
      rewardedAdsCompleted: 0,
      premiumUnlocked: false,
      revenueGenerated: 0,
      adInteractionEvents: []
    };

    // Import FrontendLogger dynamically to avoid circular dependencies
    import('./FrontendLogger').then(({ default: FrontendLogger }) => {
      FrontendLogger.revenue.sessionStarted(userId);
    });
  }

  /**
   * Track ad impression with revenue data
   */
  public trackAdImpression(
    adType: 'banner' | 'interstitial' | 'rewarded',
    adUnitId: string,
    revenueData?: {
      revenue: number;
      currency: string;
      ecpm: number;
    }
  ): void {
    // Import FrontendLogger dynamically to avoid circular dependencies
    import('./FrontendLogger').then(({ default: FrontendLogger }) => {
      FrontendLogger.revenue.impressionTracked(adType, adUnitId, revenueData?.revenue);
    });
    // Add to current session
    if (this.currentSession) {
      this.currentSession.adsViewed++;
      this.currentSession.adInteractionEvents.push({
        type: 'impression',
        adType,
        timestamp: new Date(),
        metadata: { adUnitId, revenueData }
      });

      if (revenueData) {
        this.currentSession.revenueGenerated += revenueData.revenue;
      }
    }

    // Store revenue data
    if (revenueData) {
      const adRevenue: AdRevenueData = {
        timestamp: new Date(),
        adType,
        adUnitId,
        revenue: revenueData.revenue,
        currency: revenueData.currency,
        impressions: 1,
        clicks: 0,
        ctr: 0,
        ecpm: revenueData.ecpm,
        fillRate: 1.0
      };

      this.revenueData.push(adRevenue);
    }
  }

  /**
   * Track ad click
   */
  public trackAdClick(
    adType: 'banner' | 'interstitial' | 'rewarded',
    adUnitId: string
  ): void {
    // Import FrontendLogger dynamically to avoid circular dependencies
    import('./FrontendLogger').then(({ default: FrontendLogger }) => {
      FrontendLogger.revenue.clickTracked(adType, adUnitId);
    });

    if (this.currentSession) {
      this.currentSession.adInteractionEvents.push({
        type: 'click',
        adType,
        timestamp: new Date(),
        metadata: { adUnitId }
      });
    }

    // Update click data in revenue tracking
    const recentAd = this.revenueData
      .filter(ad => ad.adType === adType && ad.adUnitId === adUnitId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (recentAd) {
      recentAd.clicks++;
      recentAd.ctr = (recentAd.clicks / recentAd.impressions) * 100;
    }
  }

  /**
   * Track rewarded ad completion
   */
  public trackRewardedAdCompleted(
    adUnitId: string,
    reward: { type: string; amount: number },
    revenueData?: { revenue: number; currency: string; ecpm: number }
  ): void {
    if (this.currentSession) {
      this.currentSession.rewardedAdsCompleted++;
      this.currentSession.premiumUnlocked = true;
      this.currentSession.adInteractionEvents.push({
        type: 'reward_earned',
        adType: 'rewarded',
        timestamp: new Date(),
        metadata: { adUnitId, reward, revenueData }
      });

      if (revenueData) {
        this.currentSession.revenueGenerated += revenueData.revenue;
      }
    }

    // Import FrontendLogger dynamically to avoid circular dependencies
    import('./FrontendLogger').then(({ default: FrontendLogger }) => {
      FrontendLogger.revenue.rewardCompleted(adUnitId, reward, revenueData?.revenue);
    });
  }

  /**
   * Track ad failure
   */
  public trackAdFailure(
    adType: 'banner' | 'interstitial' | 'rewarded',
    adUnitId: string,
    error: string
  ): void {
    if (this.currentSession) {
      this.currentSession.adInteractionEvents.push({
        type: 'ad_failed',
        adType,
        timestamp: new Date(),
        metadata: { adUnitId, error }
      });
    }

    // Import FrontendLogger dynamically to avoid circular dependencies
    import('./FrontendLogger').then(({ default: FrontendLogger }) => {
      FrontendLogger.revenue.adFailure(adType, adUnitId, error);
    });
  }

  /**
   * End current session and store data
   */
  public endSession(): UserEngagementMetrics | null {
    if (this.currentSession) {
      this.currentSession.sessionEnd = new Date();
      this.userSessions.push({ ...this.currentSession });

      const sessionSummary = {
        duration: this.getSessionDuration(this.currentSession),
        adsViewed: this.currentSession.adsViewed,
        rewardedCompleted: this.currentSession.rewardedAdsCompleted,
        revenueGenerated: this.currentSession.revenueGenerated
      };

      // Import FrontendLogger dynamically to avoid circular dependencies
      import('./FrontendLogger').then(({ default: FrontendLogger }) => {
        FrontendLogger.info('Revenue', 'Session Summary', sessionSummary);
      });

      const completedSession = this.currentSession;
      this.currentSession = null;
      return completedSession;
    }
    return null;
  }

  /**
   * Get daily revenue report
   */
  public getDailyRevenue(date?: string): DailyRevenueReport {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    const dailyData = this.revenueData.filter(ad => 
      ad.timestamp.toISOString().split('T')[0] === targetDate
    );

    const totalRevenue = dailyData.reduce((sum, ad) => sum + ad.revenue, 0);
    const totalImpressions = dailyData.reduce((sum, ad) => sum + ad.impressions, 0);
    const totalClicks = dailyData.reduce((sum, ad) => sum + ad.clicks, 0);

    const bannerData = dailyData.filter(ad => ad.adType === 'banner');
    const interstitialData = dailyData.filter(ad => ad.adType === 'interstitial');
    const rewardedData = dailyData.filter(ad => ad.adType === 'rewarded');

    return {
      date: targetDate,
      totalRevenue,
      totalImpressions,
      totalClicks,
      averageCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      averageECPM: totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 0,
      adTypeBreakdown: {
        banner: this.aggregateAdTypeData(bannerData),
        interstitial: this.aggregateAdTypeData(interstitialData),
        rewarded: this.aggregateAdTypeData(rewardedData)
      }
    };
  }

  /**
   * Get current session metrics
   */
  public getCurrentSessionMetrics(): UserEngagementMetrics | null {
    return this.currentSession;
  }

  /**
   * Get total revenue across all time
   */
  public getTotalRevenue(): { total: number; currency: string; breakdown: any } {
    const total = this.revenueData.reduce((sum, ad) => sum + ad.revenue, 0);
    const currency = this.revenueData[0]?.currency || 'USD';
    
    const breakdown = {
      banner: this.revenueData.filter(ad => ad.adType === 'banner').reduce((sum, ad) => sum + ad.revenue, 0),
      interstitial: this.revenueData.filter(ad => ad.adType === 'interstitial').reduce((sum, ad) => sum + ad.revenue, 0),
      rewarded: this.revenueData.filter(ad => ad.adType === 'rewarded').reduce((sum, ad) => sum + ad.revenue, 0)
    };

    return { total, currency, breakdown };
  }

  /**
   * Get performance insights
   */
  public getPerformanceInsights(): {
    topPerformingAdType: string;
    averageSessionRevenue: number;
    premiumConversionRate: number;
    recommendations: string[];
  } {
    const revenue = this.getTotalRevenue();
    const totalSessions = this.userSessions.length;
    const premiumUnlocks = this.userSessions.filter(s => s.premiumUnlocked).length;

    // Find top performing ad type
    const { breakdown } = revenue;
    const topPerformingAdType = Object.entries(breakdown)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || 'banner';

    const recommendations: string[] = [];
    
    if (breakdown.rewarded > breakdown.banner + breakdown.interstitial) {
      recommendations.push('Rewarded ads are driving the most revenue - consider showing more opportunities for rewards');
    }
    
    if (premiumUnlocks / Math.max(totalSessions, 1) < 0.3) {
      recommendations.push('Low premium conversion rate - consider improving reward incentives');
    }

    if (this.revenueData.length > 0 && revenue.total / this.revenueData.length < 0.01) {
      recommendations.push('Low average revenue per impression - optimize ad placement and timing');
    }

    return {
      topPerformingAdType,
      averageSessionRevenue: totalSessions > 0 ? revenue.total / totalSessions : 0,
      premiumConversionRate: totalSessions > 0 ? (premiumUnlocks / totalSessions) * 100 : 0,
      recommendations
    };
  }

  /**
   * Export analytics data for external analysis
   */
  public exportAnalyticsData(): {
    appId: string;
    exportDate: string;
    totalRevenue: number;
    revenueData: AdRevenueData[];
    userSessions: UserEngagementMetrics[];
    summary: any;
  } {
    return {
      appId: this.appId,
      exportDate: new Date().toISOString(),
      totalRevenue: this.getTotalRevenue().total,
      revenueData: this.revenueData,
      userSessions: this.userSessions,
      summary: this.getPerformanceInsights()
    };
  }

  // Private helper methods
  private getSessionDuration(session: UserEngagementMetrics): number {
    if (!session.sessionEnd) return 0;
    return session.sessionEnd.getTime() - session.sessionStart.getTime();
  }

  private aggregateAdTypeData(adData: AdRevenueData[]): AdRevenueData {
    if (adData.length === 0) {
      return {
        timestamp: new Date(),
        adType: 'banner',
        adUnitId: '',
        revenue: 0,
        currency: 'USD',
        impressions: 0,
        clicks: 0,
        ctr: 0,
        ecpm: 0,
        fillRate: 0
      };
    }

    const totalRevenue = adData.reduce((sum, ad) => sum + ad.revenue, 0);
    const totalImpressions = adData.reduce((sum, ad) => sum + ad.impressions, 0);
    const totalClicks = adData.reduce((sum, ad) => sum + ad.clicks, 0);

    return {
      timestamp: new Date(),
      adType: adData[0].adType,
      adUnitId: 'aggregated',
      revenue: totalRevenue,
      currency: adData[0].currency,
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      ecpm: totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 0,
      fillRate: 1.0
    };
  }
}

export default RevenueAnalyticsService.getInstance();