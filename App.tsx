import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AdMobService from './src/services/admob';
import BannerAdComponent from './src/components/ads/BannerAd';
import RewardedAdButton from './src/components/ads/RewardedAd';
import EnhancedMatchingScreen from './src/screens/main/EnhancedMatchingScreen';
// Import Production API Configuration
import './src/services/api';

const App: React.FC = () => {
  const [adMobReady, setAdMobReady] = useState(false);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'home' | 'matching'>('home');

  useEffect(() => {
    initializeAdMob();
    initializeProduction();
  }, []);

  const initializeProduction = async () => {
    // Start revenue analytics session with professional logging
    import('./src/services/RevenueAnalytics').then(({ default: RevenueAnalytics }) => {
      RevenueAnalytics.startSession('demo_user_123');
    });
    
    // Initialize FrontendLogger
    import('./src/services/FrontendLogger').then(({ default: FrontendLogger }) => {
      FrontendLogger.setUserId('demo_user_123');
      FrontendLogger.info('App', 'ConnectGlobal Dating App started', {
        version: '2.0.0',
        features: ['Enhanced AI Matching', 'Production AdMob', 'Revenue Analytics', 'Production API']
      });
    });

    // Test Production API Connection
    try {
      const { testApiConnection } = await import('./src/services/api/test-connection');
      const result = await testApiConnection();
      if (result.success) {
        console.log('🎉 Production API connected successfully!');
      } else {
        console.warn('⚠️ Production API connection issue:', result.message);
      }
    } catch (error) {
      console.error('❌ API connection test failed:', error);
    }
  };

  const initializeAdMob = async () => {
    const FrontendLogger = (await import('./src/services/FrontendLogger')).default;
    
    try {
      await AdMobService.initialize();
      setAdMobReady(true);
      FrontendLogger.admob.initialized();
    } catch (error) {
      FrontendLogger.admob.initFailed(error);
      Alert.alert('Info', 'Ad services are not available.');
    }
  };

  const handleRewardEarned = (reward: { type: string; amount: number }) => {
    Alert.alert(
      '🎉 Premium Unlocked!', 
      `You earned ${reward.amount} ${reward.type}! Premium features are now available.`,
      [{ text: 'Great!', onPress: () => setPremiumUnlocked(true) }]
    );
  };

  // Show Enhanced Matching Screen if selected
  if (currentScreen === 'matching') {
    return <EnhancedMatchingScreen />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4A90E2" />
      <View style={styles.header}>
        <Text style={styles.title}>ConnectGlobal</Text>
        <Text style={styles.subtitle}>Global Dating App</Text>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌍 Welcome to ConnectGlobal</Text>
          <Text style={styles.description}>
            Connect with people worldwide through authentic cultural exchange and meaningful relationships.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✨ Enhanced Features</Text>
          <Text style={styles.feature}>🧠 AI-Powered Compatibility Matching</Text>
          <Text style={styles.feature}>🌍 Cultural & Lifestyle Scoring</Text>
          <Text style={styles.feature}>
            🎥 AI-Verified Video Profiles {premiumUnlocked ? '(UNLOCKED)' : '(Premium)'}
          </Text>
          <Text style={styles.feature}>🔔 Smart Push Notifications</Text>
          <Text style={styles.feature}>⚡ Real-Time Messaging</Text>
          <Text style={styles.feature}>🛡️ Deepfake Detection</Text>
          <Text style={styles.feature}>💰 GDP-based Fair Pricing</Text>
          <Text style={styles.feature}>🔐 Enterprise Security</Text>
          <Text style={styles.feature}>📱 AdMob Integration {adMobReady ? '✅' : '⏳'}</Text>
        </View>

        {!premiumUnlocked && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎁 Unlock Premium Features</Text>
            <Text style={styles.description}>
              Watch a short video to unlock premium features like Video Profiles!
            </Text>
            <View style={styles.adContainer}>
              <RewardedAdButton 
                onRewardEarned={handleRewardEarned}
                buttonText="Watch Video to Unlock Premium"
              />
            </View>
          </View>
        )}

        {!premiumUnlocked && (
          <View style={styles.adContainer}>
            <BannerAdComponent />
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.enhancedMatchingButton}
            onPress={() => setCurrentScreen('matching')}
          >
            <Text style={styles.enhancedMatchingButtonText}>🧠 Try Enhanced Matching</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.loginButton}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.registerButton}>
            <Text style={styles.registerButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🎉 Successfully running on your Xiaomi Redmi Note 13!
          </Text>
          <Text style={styles.version}>
            Version 2.0.0 • Production API Backend • React Native 0.73.2 • AdMob {adMobReady ? '🟢' : '🟡'}
          </Text>
          <Text style={styles.debug}>
            🌐 PRODUCTION DEPLOYMENT ✅ • API: jneconnect.com • Premium: {premiumUnlocked ? 'YES' : 'NO'} • AI Ready 🧠
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#4A90E2',
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#e3f2fd',
    fontWeight: '300',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#5a6c7d',
    lineHeight: 24,
  },
  feature: {
    fontSize: 16,
    color: '#5a6c7d',
    marginBottom: 8,
    paddingLeft: 10,
  },
  buttonContainer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  enhancedMatchingButton: {
    backgroundColor: '#6A5ACD',
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#6A5ACD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  enhancedMatchingButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  loginButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  registerButton: {
    backgroundColor: 'transparent',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4A90E2',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerButtonText: {
    color: '#4A90E2',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#27ae60',
    textAlign: 'center',
    marginBottom: 8,
  },
  version: {
    fontSize: 12,
    color: '#95a5a6',
    textAlign: 'center',
    marginBottom: 4,
  },
  debug: {
    fontSize: 10,
    color: '#e74c3c',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  adContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
});

export default App;