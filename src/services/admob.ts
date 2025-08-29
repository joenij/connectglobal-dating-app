import { Platform } from 'react-native';
import MobileAds, { 
  MaxAdContentRating, 
  AdsConsent, 
  AdsConsentStatus 
} from 'react-native-google-mobile-ads';

export class AdMobService {
  private static instance: AdMobService;
  private isInitialized = false;

  // 🎉 PRODUCTION Ad Unit IDs - GOOGLE APPROVED! 
  public readonly adUnitIds = {
    android: {
      banner: 'ca-app-pub-7754034105228049/8924234879',
      interstitial: 'ca-app-pub-7754034105228049/7487030120',
      rewarded: 'ca-app-pub-7754034105228049/3793512915',
    },
    ios: {
      // TODO: Add iOS Ad Unit IDs when iOS app is ready
      banner: 'ca-app-pub-7754034105228049/8924234879',
      interstitial: 'ca-app-pub-7754034105228049/7487030120',
      rewarded: 'ca-app-pub-7754034105228049/3793512915',
    },
  };

  public static getInstance(): AdMobService {
    if (!AdMobService.instance) {
      AdMobService.instance = new AdMobService();
    }
    return AdMobService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check GDPR consent status
      const consentInfo = await AdsConsent.requestInfoUpdate();
      
      if (consentInfo.isConsentFormAvailable && consentInfo.status === AdsConsentStatus.REQUIRED) {
        // Show consent form for GDPR
        await AdsConsent.showForm();
      }

      // Initialize Mobile Ads SDK
      await MobileAds().initialize();

      // Configure settings for family-friendly content
      await MobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.T, // Teen rating
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });

      this.isInitialized = true;
      console.log('🎯 AdMob initialized successfully');
    } catch (error) {
      console.error('❌ AdMob initialization failed:', error);
      throw error;
    }
  }

  public getBannerAdUnitId(): string {
    return Platform.OS === 'android' 
      ? this.adUnitIds.android.banner 
      : this.adUnitIds.ios.banner;
  }

  public getInterstitialAdUnitId(): string {
    return Platform.OS === 'android' 
      ? this.adUnitIds.android.interstitial 
      : this.adUnitIds.ios.interstitial;
  }

  public getRewardedAdUnitId(): string {
    return Platform.OS === 'android' 
      ? this.adUnitIds.android.rewarded 
      : this.adUnitIds.ios.rewarded;
  }

  public isReady(): boolean {
    return this.isInitialized;
  }
}

export default AdMobService.getInstance();