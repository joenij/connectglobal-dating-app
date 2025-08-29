import { Platform } from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { MobileAds, AdsConsent, AdsConsentStatus } from 'react-native-google-mobile-ads';

export interface ConsentInfo {
  hasConsent: boolean;
  consentStatus: AdsConsentStatus;
  canShowAds: boolean;
  canShowPersonalizedAds: boolean;
  consentDate: string;
  gdprApplies: boolean;
  userLocation: 'EU' | 'NON_EU' | 'UNKNOWN';
}

export interface ConsentSettings {
  analytics: boolean;
  advertising: boolean;
  personalizedAds: boolean;
  essentialCookies: boolean;
}

class ConsentManager {
  private static instance: ConsentManager;
  private consentInfo: ConsentInfo | null = null;
  private isInitialized = false;

  // GDPR countries (EU + EEA)
  private gdprCountries = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO'
  ];

  public static getInstance(): ConsentManager {
    if (!ConsentManager.instance) {
      ConsentManager.instance = new ConsentManager();
    }
    return ConsentManager.instance;
  }

  /**
   * Initialize consent system - call this on app startup
   */
  async initialize(): Promise<ConsentInfo> {
    try {
      console.log('🔒 Initializing GDPR Consent Manager...');

      // Load saved consent preferences
      const savedConsent = await this.loadSavedConsent();
      
      // Detect user location for GDPR compliance
      const userLocation = await this.detectUserLocation();
      const gdprApplies = userLocation === 'EU';

      // Initialize Google's User Messaging Platform (UMP) for GDPR
      await this.initializeUMP();

      // Get current consent status
      const consentStatus = await AdsConsent.getConsentStatus();
      const canRequestAds = await AdsConsent.canRequestAds();

      this.consentInfo = {
        hasConsent: canRequestAds && (consentStatus === AdsConsentStatus.OBTAINED),
        consentStatus,
        canShowAds: canRequestAds,
        canShowPersonalizedAds: savedConsent?.personalizedAds ?? false,
        consentDate: savedConsent?.consentDate || new Date().toISOString(),
        gdprApplies,
        userLocation
      };

      // If GDPR applies and no consent yet, request consent
      if (gdprApplies && consentStatus === AdsConsentStatus.REQUIRED) {
        await this.requestConsent();
      }

      this.isInitialized = true;
      console.log('✅ Consent Manager initialized:', this.consentInfo);

      return this.consentInfo;

    } catch (error) {
      console.error('❌ Consent Manager initialization failed:', error);
      
      // Fallback consent info
      this.consentInfo = {
        hasConsent: false,
        consentStatus: AdsConsentStatus.UNKNOWN,
        canShowAds: false,
        canShowPersonalizedAds: false,
        consentDate: new Date().toISOString(),
        gdprApplies: false,
        userLocation: 'UNKNOWN'
      };

      return this.consentInfo;
    }
  }

  /**
   * Initialize Google's User Messaging Platform
   */
  private async initializeUMP(): Promise<void> {
    try {
      // Request consent information update
      await AdsConsent.requestConsentInfoUpdate({
        debugSettings: __DEV__ ? {
          testDeviceIds: ['TEST_DEVICE_ID'],
          geography: 'EEA' // Test GDPR flow in development
        } : undefined
      });

      console.log('UMP consent info updated');
    } catch (error) {
      console.error('UMP initialization failed:', error);
    }
  }

  /**
   * Request user consent (shows Google's consent dialog)
   */
  async requestConsent(): Promise<boolean> {
    try {
      console.log('🔒 Requesting user consent...');

      const consentStatus = await AdsConsent.getConsentStatus();
      
      if (consentStatus === AdsConsentStatus.REQUIRED) {
        // Load and show consent form
        const form = await AdsConsent.loadConsentForm();
        const result = await form.show();
        
        console.log('Consent form result:', result);

        // Update consent info after user action
        await this.updateConsentStatus();
        return this.consentInfo?.hasConsent || false;
      }

      return true; // Consent not required
    } catch (error) {
      console.error('Consent request failed:', error);
      return false;
    }
  }

  /**
   * Update consent status after user interaction
   */
  private async updateConsentStatus(): Promise<void> {
    const consentStatus = await AdsConsent.getConsentStatus();
    const canRequestAds = await AdsConsent.canRequestAds();

    if (this.consentInfo) {
      this.consentInfo.consentStatus = consentStatus;
      this.consentInfo.hasConsent = canRequestAds && (consentStatus === AdsConsentStatus.OBTAINED);
      this.consentInfo.canShowAds = canRequestAds;
      this.consentInfo.consentDate = new Date().toISOString();
    }

    // Save consent to secure storage
    await this.saveConsentPreferences({
      analytics: this.consentInfo?.hasConsent || false,
      advertising: this.consentInfo?.hasConsent || false,
      personalizedAds: this.consentInfo?.canShowPersonalizedAds || false,
      essentialCookies: true // Always required
    });

    console.log('Consent status updated:', this.consentInfo);
  }

  /**
   * Get current consent information
   */
  getConsentInfo(): ConsentInfo | null {
    return this.consentInfo;
  }

  /**
   * Check if we can show ads
   */
  canShowAds(): boolean {
    return this.consentInfo?.canShowAds || false;
  }

  /**
   * Check if we can show personalized ads
   */
  canShowPersonalizedAds(): boolean {
    return this.consentInfo?.canShowPersonalizedAds || false;
  }

  /**
   * Check if GDPR applies to this user
   */
  isGdprApplicable(): boolean {
    return this.consentInfo?.gdprApplies || false;
  }

  /**
   * Update consent preferences manually
   */
  async updateConsentPreferences(settings: ConsentSettings): Promise<void> {
    try {
      await this.saveConsentPreferences(settings);

      if (this.consentInfo) {
        this.consentInfo.canShowPersonalizedAds = settings.personalizedAds;
        this.consentInfo.canShowAds = settings.advertising;
        this.consentInfo.consentDate = new Date().toISOString();
      }

      console.log('Consent preferences updated:', settings);
    } catch (error) {
      console.error('Failed to update consent preferences:', error);
    }
  }

  /**
   * Reset consent (for testing or user request)
   */
  async resetConsent(): Promise<void> {
    try {
      await AdsConsent.reset();
      await EncryptedStorage.removeItem('consent_preferences');
      
      this.consentInfo = null;
      this.isInitialized = false;

      console.log('Consent reset successfully');
    } catch (error) {
      console.error('Failed to reset consent:', error);
    }
  }

  /**
   * Show privacy settings (custom modal/screen)
   */
  async showPrivacySettings(): Promise<ConsentSettings | null> {
    try {
      // This would show a custom privacy settings screen
      // For now, return current settings
      const saved = await this.loadSavedConsent();
      return saved || {
        analytics: false,
        advertising: false,
        personalizedAds: false,
        essentialCookies: true
      };
    } catch (error) {
      console.error('Failed to show privacy settings:', error);
      return null;
    }
  }

  /**
   * Track consent change for analytics
   */
  private async trackConsentChange(oldSettings: ConsentSettings, newSettings: ConsentSettings): Promise<void> {
    try {
      // Only track if we have consent for analytics
      if (!newSettings.analytics) return;

      const changes = {
        analytics_changed: oldSettings.analytics !== newSettings.analytics,
        advertising_changed: oldSettings.advertising !== newSettings.advertising,
        personalized_ads_changed: oldSettings.personalizedAds !== newSettings.personalizedAds,
        timestamp: new Date().toISOString()
      };

      // Send to analytics service (implement based on your analytics setup)
      console.log('Consent changes tracked:', changes);
    } catch (error) {
      console.error('Failed to track consent change:', error);
    }
  }

  // PRIVATE HELPER METHODS

  private async detectUserLocation(): Promise<'EU' | 'NON_EU' | 'UNKNOWN'> {
    try {
      // In production, you'd detect this via IP geolocation or user settings
      // For now, return a default based on test settings
      if (__DEV__) {
        return 'EU'; // Test GDPR flow in development
      }

      // Try to get location from device settings or previous app data
      const savedLocation = await EncryptedStorage.getItem('user_location');
      if (savedLocation) {
        const location = JSON.parse(savedLocation);
        return this.gdprCountries.includes(location.countryCode) ? 'EU' : 'NON_EU';
      }

      return 'UNKNOWN';
    } catch (error) {
      console.error('Failed to detect user location:', error);
      return 'UNKNOWN';
    }
  }

  private async loadSavedConsent(): Promise<ConsentSettings | null> {
    try {
      const saved = await EncryptedStorage.getItem('consent_preferences');
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Failed to load saved consent:', error);
      return null;
    }
  }

  private async saveConsentPreferences(settings: ConsentSettings): Promise<void> {
    try {
      const consentData = {
        ...settings,
        consentDate: new Date().toISOString(),
        version: '1.0' // Track consent version for compliance
      };

      await EncryptedStorage.setItem('consent_preferences', JSON.stringify(consentData));
    } catch (error) {
      console.error('Failed to save consent preferences:', error);
    }
  }

  /**
   * Get consent summary for privacy dashboard
   */
  getConsentSummary(): {
    status: string;
    details: ConsentInfo | null;
    settings: ConsentSettings | null;
    lastUpdated: string;
  } {
    const settings = this.loadSavedConsent();
    
    return {
      status: this.isInitialized ? 'initialized' : 'not_initialized',
      details: this.consentInfo,
      settings: settings || null,
      lastUpdated: this.consentInfo?.consentDate || 'never'
    };
  }

  /**
   * Generate consent report for GDPR compliance
   */
  async generateComplianceReport(): Promise<{
    userId?: string;
    consentGiven: boolean;
    consentDate: string;
    gdprApplies: boolean;
    consentMethod: string;
    dataProcessingPurposes: string[];
    retentionPeriod: string;
    withdrawalMethod: string;
  }> {
    const consent = this.getConsentInfo();
    const settings = await this.loadSavedConsent();

    return {
      consentGiven: consent?.hasConsent || false,
      consentDate: consent?.consentDate || 'not_given',
      gdprApplies: consent?.gdprApplies || false,
      consentMethod: 'mobile_app_dialog',
      dataProcessingPurposes: [
        ...(settings?.analytics ? ['analytics'] : []),
        ...(settings?.advertising ? ['advertising'] : []),
        ...(settings?.personalizedAds ? ['personalized_advertising'] : []),
        'essential_functionality'
      ],
      retentionPeriod: '24_months',
      withdrawalMethod: 'app_privacy_settings'
    };
  }
}

export default ConsentManager.getInstance();