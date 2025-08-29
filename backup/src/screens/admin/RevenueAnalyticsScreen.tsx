import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';

interface AnalyticsData {
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
}

const RevenueAnalyticsScreen: React.FC = ({ navigation }: any) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [realTimeData, setRealTimeData] = useState<RealTimeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'real-time'>('overview');

  useEffect(() => {
    loadAnalyticsData();
    
    // Set up real-time data refresh
    const interval = setInterval(() => {
      if (activeTab === 'real-time') {
        loadRealTimeData();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [selectedPeriod, activeTab]);

  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/v1/analytics/revenue/dashboard?groupBy=${selectedPeriod}`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.status}`);
      }

      const result = await response.json();
      setAnalyticsData(result.data);

      // Load real-time data if on that tab
      if (activeTab === 'real-time') {
        await loadRealTimeData();
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      Alert.alert('Error', 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRealTimeData = async () => {
    try {
      const response = await fetch('/api/v1/analytics/revenue/real-time', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setRealTimeData(result.data);
      }
    } catch (error) {
      console.error('Failed to load real-time data:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAnalyticsData();
    setIsRefreshing(false);
  };

  const getAuthToken = async (): Promise<string> => {
    // This would get the token from your auth system
    return 'your_auth_token_here';
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const renderSummaryCards = () => {
    if (!analyticsData) return null;

    const { summary } = analyticsData;

    return (
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatCurrency(summary.total_revenue_usd)}</Text>
          <Text style={styles.summaryLabel}>Total Revenue</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatNumber(summary.total_ad_impressions)}</Text>
          <Text style={styles.summaryLabel}>Ad Impressions</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatNumber(summary.unique_users)}</Text>
          <Text style={styles.summaryLabel}>Active Users</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatCurrency(summary.avg_revenue_per_impression)}</Text>
          <Text style={styles.summaryLabel}>Avg. CPM</Text>
        </View>
      </View>
    );
  };

  const renderAdTypePerformance = () => {
    if (!analyticsData?.adTypePerformance) return null;

    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Ad Type Performance</Text>
        {analyticsData.adTypePerformance.map((adType, index) => (
          <View key={index} style={styles.performanceItem}>
            <View style={styles.performanceHeader}>
              <Text style={styles.performanceTitle}>
                {adType.ad_type.replace('_', ' ').toUpperCase()}
              </Text>
              <Text style={styles.performanceRevenue}>
                {formatCurrency(adType.total_revenue)}
              </Text>
            </View>
            <View style={styles.performanceMetrics}>
              <Text style={styles.performanceMetric}>
                {formatNumber(adType.impressions)} impressions
              </Text>
              <Text style={styles.performanceMetric}>
                {adType.ctr_percentage.toFixed(1)}% CTR
              </Text>
              {adType.rewards_earned > 0 && (
                <Text style={styles.performanceMetric}>
                  {adType.rewards_earned} rewards
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderGeoPerformance = () => {
    if (!analyticsData?.geoPerformance) return null;

    return (
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Top Countries</Text>
        {analyticsData.geoPerformance.slice(0, 10).map((country, index) => (
          <View key={index} style={styles.geoItem}>
            <View style={styles.geoHeader}>
              <Text style={styles.geoCountry}>
                🏳️ {country.user_country_code}
              </Text>
              <Text style={styles.geoRevenue}>
                {formatCurrency(country.total_revenue)}
              </Text>
            </View>
            <View style={styles.geoMetrics}>
              <Text style={styles.geoMetric}>
                {formatNumber(country.impressions)} impressions
              </Text>
              <Text style={styles.geoMetric}>
                {formatNumber(country.unique_users)} users
              </Text>
              <Text style={styles.geoMetric}>
                {formatCurrency(country.avg_revenue_per_user)} avg/user
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderRealTimeData = () => {
    if (!realTimeData) return null;

    return (
      <View style={styles.realTimeContainer}>
        <View style={styles.realTimeSection}>
          <Text style={styles.sectionTitle}>Last 24 Hours</Text>
          <View style={styles.realTimeGrid}>
            <View style={styles.realTimeCard}>
              <Text style={styles.realTimeValue}>
                {formatCurrency(realTimeData.last24Hours.revenue_24h)}
              </Text>
              <Text style={styles.realTimeLabel}>Revenue</Text>
            </View>
            <View style={styles.realTimeCard}>
              <Text style={styles.realTimeValue}>
                {formatNumber(realTimeData.last24Hours.impressions_24h)}
              </Text>
              <Text style={styles.realTimeLabel}>Impressions</Text>
            </View>
            <View style={styles.realTimeCard}>
              <Text style={styles.realTimeValue}>
                {formatNumber(realTimeData.last24Hours.users_24h)}
              </Text>
              <Text style={styles.realTimeLabel}>Users</Text>
            </View>
            <View style={styles.realTimeCard}>
              <Text style={styles.realTimeValue}>
                {formatNumber(realTimeData.last24Hours.rewards_24h)}
              </Text>
              <Text style={styles.realTimeLabel}>Rewards</Text>
            </View>
          </View>
        </View>

        <View style={styles.realTimeSection}>
          <Text style={styles.sectionTitle}>Last Hour</Text>
          <View style={styles.realTimeGrid}>
            <View style={styles.realTimeCard}>
              <Text style={styles.realTimeValue}>
                {formatCurrency(realTimeData.lastHour.revenue_1h)}
              </Text>
              <Text style={styles.realTimeLabel}>Revenue</Text>
            </View>
            <View style={styles.realTimeCard}>
              <Text style={styles.realTimeValue}>
                {formatNumber(realTimeData.lastHour.impressions_1h)}
              </Text>
              <Text style={styles.realTimeLabel}>Impressions</Text>
            </View>
            <View style={styles.realTimeCard}>
              <Text style={styles.realTimeValue}>
                {formatNumber(realTimeData.lastHour.users_1h)}
              </Text>
              <Text style={styles.realTimeLabel}>Users</Text>
            </View>
          </View>
        </View>

        <View style={styles.realTimeSection}>
          <Text style={styles.sectionTitle}>Hourly Trend (Last 6h)</Text>
          {realTimeData.hourlyBreakdown.slice(0, 6).map((hour, index) => (
            <View key={index} style={styles.trendItem}>
              <Text style={styles.trendTime}>
                {new Date(hour.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <View style={styles.trendMetrics}>
                <Text style={styles.trendMetric}>
                  {formatCurrency(hour.revenue)}
                </Text>
                <Text style={styles.trendMetric}>
                  {formatNumber(hour.impressions)} imp
                </Text>
                <Text style={styles.trendMetric}>
                  {formatNumber(hour.unique_users)} users
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderTabButtons = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'overview' && styles.activeTab]}
        onPress={() => setActiveTab('overview')}
      >
        <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
          Overview
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'performance' && styles.activeTab]}
        onPress={() => setActiveTab('performance')}
      >
        <Text style={[styles.tabText, activeTab === 'performance' && styles.activeTabText]}>
          Performance
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'real-time' && styles.activeTab]}
        onPress={() => setActiveTab('real-time')}
      >
        <Text style={[styles.tabText, activeTab === 'real-time' && styles.activeTabText]}>
          Real-time
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderPeriodSelector = () => (
    <View style={styles.periodContainer}>
      {(['day', 'week', 'month'] as const).map((period) => (
        <TouchableOpacity
          key={period}
          style={[
            styles.periodButton,
            selectedPeriod === period && styles.activePeriodButton
          ]}
          onPress={() => setSelectedPeriod(period)}
        >
          <Text style={[
            styles.periodText,
            selectedPeriod === period && styles.activePeriodText
          ]}>
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (isLoading && !analyticsData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Revenue Analytics</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Text style={styles.refreshButton}>⟲</Text>
        </TouchableOpacity>
      </View>

      {renderTabButtons()}
      
      {activeTab !== 'real-time' && renderPeriodSelector()}

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {activeTab === 'overview' && (
          <>
            {renderSummaryCards()}
            {renderAdTypePerformance()}
          </>
        )}

        {activeTab === 'performance' && (
          <>
            {renderGeoPerformance()}
          </>
        )}

        {activeTab === 'real-time' && renderRealTimeData()}
      </ScrollView>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  backButton: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  refreshButton: {
    color: '#FF6B6B',
    fontSize: 20,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 4,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#FF6B6B',
  },
  tabText: {
    color: '#cccccc',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#ffffff',
  },
  periodContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  periodButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
    borderRadius: 15,
  },
  activePeriodButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.3)',
  },
  periodText: {
    color: '#cccccc',
    fontSize: 12,
  },
  activePeriodText: {
    color: '#FF6B6B',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  summaryCard: {
    width: (width - 60) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    marginRight: 10,
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryLabel: {
    color: '#cccccc',
    fontSize: 12,
  },
  sectionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  performanceItem: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  performanceTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  performanceRevenue: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  performanceMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performanceMetric: {
    color: '#cccccc',
    fontSize: 12,
  },
  geoItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  geoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  geoCountry: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  geoRevenue: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: 'bold',
  },
  geoMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  geoMetric: {
    color: '#cccccc',
    fontSize: 11,
  },
  realTimeContainer: {
    marginBottom: 20,
  },
  realTimeSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  realTimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  realTimeCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  realTimeValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  realTimeLabel: {
    color: '#cccccc',
    fontSize: 11,
  },
  trendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  trendTime: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    width: 60,
  },
  trendMetrics: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-around',
  },
  trendMetric: {
    color: '#cccccc',
    fontSize: 11,
  },
});

export default RevenueAnalyticsScreen;