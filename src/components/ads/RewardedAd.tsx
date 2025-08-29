import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import AdMobService from '../../services/admob';
import RevenueAnalytics from '../../services/RevenueAnalytics';
import FrontendLogger from '../../services/FrontendLogger';

interface RewardedAdButtonProps {
  onRewardEarned: (reward: { type: string; amount: number }) => void;
  buttonText?: string;
  style?: any;
  disabled?: boolean;
}

export const RewardedAdButton: React.FC<RewardedAdButtonProps> = ({
  onRewardEarned,
  buttonText = 'Watch Ad to Unlock',
  style,
  disabled = false,
}) => {
  const [rewardedAd, setRewardedAd] = useState<RewardedAd | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  // 🎉 Now using PRODUCTION Ad Unit IDs - Google Approved!  
  const adUnitId = AdMobService.getRewardedAdUnitId();

  useEffect(() => {
    if (!AdMobService.isReady()) return;

    const ad = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      FrontendLogger.admob.rewardedLoaded(adUnitId);
      RevenueAnalytics.trackAdImpression('rewarded', adUnitId);
      setLoaded(true);
      setLoading(false);
    });

    const unsubscribeEarned = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      (reward) => {
        FrontendLogger.admob.rewardedEarned(adUnitId, reward);
        RevenueAnalytics.trackRewardedAdCompleted(adUnitId, reward);
        onRewardEarned(reward);
      }
    );

    const unsubscribeOpened = ad.addAdEventListener(RewardedAdEventType.OPENED, () => {
      FrontendLogger.admob.rewardedOpened(adUnitId);
      RevenueAnalytics.trackAdClick('rewarded', adUnitId);
    });

    const unsubscribeClosed = ad.addAdEventListener(RewardedAdEventType.CLOSED, () => {
      FrontendLogger.debug('AdMob', 'Rewarded ad closed - Preloading next ad', { adUnitId });
      // Preload next ad
      loadAd();
    });

    const unsubscribeError = ad.addAdEventListener(RewardedAdEventType.ERROR, (error) => {
      FrontendLogger.admob.rewardedFailed(adUnitId, error);
      RevenueAnalytics.trackAdFailure('rewarded', adUnitId, error.message);
      setLoaded(false);
      setLoading(false);
      Alert.alert('Error', 'Failed to load ad. Please try again.');
    });

    setRewardedAd(ad);
    loadAd();

    return () => {
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeOpened();
      unsubscribeClosed();
      unsubscribeError();
    };
  }, []);

  const loadAd = () => {
    if (!rewardedAd || loading) return;
    
    setLoading(true);
    setLoaded(false);
    rewardedAd.load();
  };

  const showAd = async () => {
    if (!loaded || !rewardedAd) {
      Alert.alert('Ad not ready', 'Please wait for the ad to load.');
      return;
    }

    try {
      await rewardedAd.show();
    } catch (error) {
      FrontendLogger.error('AdMob', 'Failed to show rewarded ad', error, { adUnitId });
      Alert.alert('Error', 'Failed to show ad. Please try again.');
    }
  };

  const getButtonText = () => {
    if (!AdMobService.isReady()) return 'AdMob not ready';
    if (loading) return 'Loading ad...';
    if (!loaded) return 'Ad not loaded';
    return buttonText;
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        (!loaded || disabled || !AdMobService.isReady()) && styles.buttonDisabled,
        style,
      ]}
      onPress={showAd}
      disabled={!loaded || disabled || !AdMobService.isReady()}
    >
      <Text style={[
        styles.buttonText,
        (!loaded || disabled || !AdMobService.isReady()) && styles.buttonTextDisabled,
      ]}>
        {getButtonText()}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextDisabled: {
    color: '#666666',
  },
});

export default RewardedAdButton;