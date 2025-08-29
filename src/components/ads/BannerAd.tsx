import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import AdMobService from '../../services/admob';
import RevenueAnalytics from '../../services/RevenueAnalytics';
import FrontendLogger from '../../services/FrontendLogger';

interface BannerAdComponentProps {
  size?: BannerAdSize;
  style?: any;
}

export const BannerAdComponent: React.FC<BannerAdComponentProps> = ({ 
  size = BannerAdSize.BANNER,
  style 
}) => {
  // 🎉 Now using PRODUCTION Ad Unit IDs - Google Approved!
  const adUnitId = AdMobService.getBannerAdUnitId();

  if (!AdMobService.isReady()) {
    return (
      <View style={[styles.placeholder, style]}>
        <Text style={styles.placeholderText}>Loading ad...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <BannerAd
        unitId={adUnitId}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          FrontendLogger.admob.bannerLoaded(adUnitId);
          RevenueAnalytics.trackAdImpression('banner', adUnitId);
        }}
        onAdFailedToLoad={(error) => {
          FrontendLogger.admob.bannerFailed(adUnitId, error);
          RevenueAnalytics.trackAdFailure('banner', adUnitId, error.message);
        }}
        onAdOpened={() => {
          FrontendLogger.admob.bannerClicked(adUnitId);
          RevenueAnalytics.trackAdClick('banner', adUnitId);
        }}
        onAdClosed={() => {
          FrontendLogger.debug('AdMob', 'Banner ad closed', { adUnitId });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholder: {
    height: 50,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
  },
  placeholderText: {
    color: '#666',
    fontSize: 12,
  },
});

export default BannerAdComponent;