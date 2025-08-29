import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import AdService from '../services/AdService';

interface AdBannerProps {
  placement: string;
  userTier?: 'free' | 'basic' | 'premium' | 'ultimate';
  style?: any;
  size?: BannerAdSize;
}

const AdBanner: React.FC<AdBannerProps> = ({ 
  placement, 
  userTier = 'free',
  style,
  size = BannerAdSize.ADAPTIVE_BANNER
}) => {
  const [shouldShowAd, setShouldShowAd] = useState(false);
  const [adUnitId, setAdUnitId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    initializeBanner();
  }, [userTier, placement]);

  const initializeBanner = async () => {
    try {
      // Only show ads for free tier users
      if (userTier !== 'free') {
        setShouldShowAd(false);
        setIsLoading(false);
        return;
      }

      // Initialize AdMob if not already done
      await AdService.initialize();

      // Get ad configuration for this placement
      const adConfig = await AdService.getAdConfig(placement, 'US', 'free');

      if (adConfig && adConfig.adType === 'banner') {
        setAdUnitId(adConfig.adUnitId);
        setShouldShowAd(true);
      } else {
        // Fallback to test ad for development
        setAdUnitId(__DEV__ ? TestIds.BANNER : '');
        setShouldShowAd(__DEV__); // Only show in dev if no config
      }
    } catch (error) {
      console.error('Failed to initialize banner ad:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const trackAdEngagement = async (action: 'impression' | 'click' | 'dismissed') => {
    try {
      const response = await fetch('/api/v1/advertising/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          adNetwork: 'admob',
          adType: 'banner',
          placementLocation: placement,
          action,
          adUnitId,
          deviceType: 'mobile'
        })
      });

      if (!response.ok) {
        console.warn('Failed to track ad engagement');
      }
    } catch (error) {
      console.error('Ad engagement tracking error:', error);
    }
  };

  const getAuthToken = async (): Promise<string> => {
    // This would get the token from your auth system
    return 'your_auth_token_here';
  };

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading ad...</Text>
        </View>
      </View>
    );
  }

  if (!shouldShowAd || hasError || !adUnitId) {
    return null; // Don't show anything for premium users or on error
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
          console.log(`Banner ad loaded for placement: ${placement}`);
          trackAdEngagement('impression');
        }}
        onAdFailedToLoad={(error) => {
          console.error(`Banner ad failed to load for ${placement}:`, error);
          setHasError(true);
        }}
        onAdOpened={() => {
          console.log(`Banner ad opened for placement: ${placement}`);
          trackAdEngagement('click');
        }}
        onAdClosed={() => {
          console.log(`Banner ad closed for placement: ${placement}`);
          trackAdEngagement('dismissed');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    marginVertical: 8,
  },
  loadingContainer: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 20,
  },
  loadingText: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic',
  },
});

export default AdBanner;