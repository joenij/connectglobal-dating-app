interface AnalyticsResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface RevenueDashboardData {
  summary: {
    total_ad_impressions: number;
    total_revenue_usd: number;
    unique_users: number;
    avg_revenue_per_impression: number;
    rewards_earned: number;
    banner_impressions: number;
    interstitial_impressions: number;
    rewarded_impressions: number;
  };
  revenueTrend: Array<{
    period: string;
    revenue: number;
    impressions: number;
    unique_users: number;
    avg_cpm: number;
  }>;
  adTypePerformance: Array<{
    ad_type: string;
    impressions: number;
    total_revenue: number;
    avg_revenue_per_impression: number;
    clicks: number;
    ctr_percentage: number;
    rewards_earned: number;
  }>;
  geoPerformance: Array<{
    user_country_code: string;
    impressions: number;
    total_revenue: number;
    unique_users: number;
    avg_revenue_per_user: number;
  }>;
  tierPerformance: Array<{
    user_subscription_tier: string;
    impressions: number;
    total_revenue: number;
    unique_users: number;
    rewards_earned: number;
  }>;
  placementPerformance: Array<{
    placement_location: string;
    impressions: number;
    total_revenue: number;
    clicks: number;
    ctr_percentage: number;
  }>;
  topRevenueUsers: Array<{
    user_id: string;
    total_impressions: number;
    total_revenue: number;
    rewards_earned: number;
    last_activity: string;
    user_subscription_tier: string;
    user_country_code: string;
  }>;
}

interface RealTimeData {
  last24Hours: {
    impressions_24h: number;
    revenue_24h: number;
    users_24h: number;
    rewards_24h: number;
  };
  lastHour: {
    impressions_1h: number;
    revenue_1h: number;
    users_1h: number;
  };
  hourlyBreakdown: Array<{
    hour: string;
    impressions: number;
    revenue: number;
    unique_users: number;
  }>;
  activePlacements: Array<{
    placement_location: string;
    recent_impressions: number;
    last_impression: string;
  }>;
}

interface UserLTVData {
  userLTV: Array<{
    user_subscription_tier: string;
    user_count: number;
    avg_ltv: number;
    avg_impressions: number;
    avg_rewards: number;
    avg_active_days: number;
    median_ltv: number;
    p90_ltv: number;
  }>;
  cohortAnalysis: Array<{
    cohort_month: string;
    users: number;
    avg_revenue_per_user: number;
    total_cohort_revenue: number;
  }>;
}

interface ConversionFunnelData {
  rewardedVideoFunnel: {
    total_ad_impressions: number;
    users_clicked: number;
    users_earned_reward: number;
    click_rate: number;
    completion_rate: number;
  };
  placementFunnels: Array<{
    placement_location: string;
    ad_type: string;
    impressions: number;
    clicks: number;
    rewards: number;
    ctr: number;
    completion_rate: number;
  }>;
}

class AnalyticsService {
  private baseURL = '/api/v1/analytics';

  private async getAuthToken(): Promise<string> {
    // This would get the token from your auth system
    return 'your_auth_token_here';
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<AnalyticsResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Analytics service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get comprehensive revenue dashboard data
   */
  async getRevenueDashboard(params: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
    adNetwork?: string;
  } = {}): Promise<AnalyticsResponse<RevenueDashboardData>> {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        queryParams.append(key, value);
      }
    });

    return this.makeRequest<RevenueDashboardData>(
      `/revenue/dashboard?${queryParams.toString()}`
    );
  }

  /**
   * Get real-time revenue metrics
   */
  async getRealTimeData(): Promise<AnalyticsResponse<RealTimeData>> {
    return this.makeRequest<RealTimeData>('/revenue/real-time');
  }

  /**
   * Get user lifetime value analysis
   */
  async getUserLTV(params: {
    minDays?: number;
    tier?: string;
  } = {}): Promise<AnalyticsResponse<UserLTVData>> {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });

    return this.makeRequest<UserLTVData>(
      `/user-ltv?${queryParams.toString()}`
    );
  }

  /**
   * Get ad conversion funnel analysis
   */
  async getConversionFunnel(params: {
    startDate?: string;
    endDate?: string;
  } = {}): Promise<AnalyticsResponse<ConversionFunnelData>> {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        queryParams.append(key, value);
      }
    });

    return this.makeRequest<ConversionFunnelData>(
      `/conversion-funnel?${queryParams.toString()}`
    );
  }

  /**
   * Export analytics data to CSV
   */
  async exportToCSV(params: {
    dataType: 'revenue-summary' | 'ad-performance' | 'user-ltv' | 'geo-performance';
    startDate?: string;
    endDate?: string;
    format?: 'csv' | 'xlsx';
  }): Promise<AnalyticsResponse<{ downloadUrl: string }>> {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        queryParams.append(key, value);
      }
    });

    return this.makeRequest<{ downloadUrl: string }>(
      `/export?${queryParams.toString()}`,
      { method: 'POST' }
    );
  }

  /**
   * Get performance alerts and insights
   */
  async getPerformanceAlerts(): Promise<AnalyticsResponse<{
    alerts: Array<{
      type: 'revenue_drop' | 'ctr_decline' | 'high_performance' | 'anomaly';
      severity: 'low' | 'medium' | 'high' | 'critical';
      title: string;
      description: string;
      recommendation: string;
      timestamp: string;
      data: any;
    }>;
    insights: Array<{
      category: 'revenue' | 'engagement' | 'user_behavior' | 'optimization';
      title: string;
      description: string;
      impact: 'positive' | 'negative' | 'neutral';
      confidence: number;
      data: any;
    }>;
  }>> {
    return this.makeRequest('/performance-alerts');
  }

  /**
   * Get custom analytics query results
   */
  async getCustomQuery(params: {
    query: string;
    parameters?: Record<string, any>;
  }): Promise<AnalyticsResponse<Array<Record<string, any>>>> {
    return this.makeRequest<Array<Record<string, any>>>(
      '/custom-query',
      {
        method: 'POST',
        body: JSON.stringify(params)
      }
    );
  }

  /**
   * Schedule automated report
   */
  async scheduleReport(params: {
    reportType: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    dataTypes: string[];
    schedule: string; // cron format
    enabled: boolean;
  }): Promise<AnalyticsResponse<{ reportId: string }>> {
    return this.makeRequest<{ reportId: string }>(
      '/schedule-report',
      {
        method: 'POST',
        body: JSON.stringify(params)
      }
    );
  }

  /**
   * Get scheduled reports status
   */
  async getScheduledReports(): Promise<AnalyticsResponse<Array<{
    id: string;
    reportType: string;
    recipients: string[];
    schedule: string;
    lastRun?: string;
    nextRun: string;
    enabled: boolean;
    status: 'active' | 'paused' | 'failed';
  }>>> {
    return this.makeRequest('/scheduled-reports');
  }

  /**
   * Update report schedule
   */
  async updateReportSchedule(
    reportId: string, 
    updates: Partial<{
      recipients: string[];
      schedule: string;
      enabled: boolean;
    }>
  ): Promise<AnalyticsResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>(
      `/scheduled-reports/${reportId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates)
      }
    );
  }

  /**
   * Delete scheduled report
   */
  async deleteScheduledReport(reportId: string): Promise<AnalyticsResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>(
      `/scheduled-reports/${reportId}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Get A/B test results for ad placements
   */
  async getABTestResults(testId?: string): Promise<AnalyticsResponse<{
    tests: Array<{
      id: string;
      name: string;
      status: 'running' | 'completed' | 'paused';
      startDate: string;
      endDate?: string;
      variants: Array<{
        name: string;
        traffic: number;
        impressions: number;
        revenue: number;
        ctr: number;
        significance?: number;
      }>;
      winner?: string;
      insights: string[];
    }>;
  }>> {
    const endpoint = testId ? `/ab-tests/${testId}` : '/ab-tests';
    return this.makeRequest(endpoint);
  }

  /**
   * Create new A/B test for ad placement
   */
  async createABTest(params: {
    name: string;
    description: string;
    placements: string[];
    variants: Array<{
      name: string;
      config: Record<string, any>;
      traffic: number;
    }>;
    duration: number; // days
    successMetric: 'revenue' | 'ctr' | 'completion_rate';
  }): Promise<AnalyticsResponse<{ testId: string }>> {
    return this.makeRequest<{ testId: string }>(
      '/ab-tests',
      {
        method: 'POST',
        body: JSON.stringify(params)
      }
    );
  }

  /**
   * Get revenue forecasting data
   */
  async getRevenueForecast(params: {
    period: 'week' | 'month' | 'quarter';
    confidence?: number;
  }): Promise<AnalyticsResponse<{
    forecast: Array<{
      period: string;
      predicted_revenue: number;
      confidence_lower: number;
      confidence_upper: number;
      factors: string[];
    }>;
    accuracy: {
      mae: number; // Mean Absolute Error
      mape: number; // Mean Absolute Percentage Error
      last_month_accuracy: number;
    };
  }>> {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });

    return this.makeRequest(`/revenue-forecast?${queryParams.toString()}`);
  }
}

export default new AnalyticsService();