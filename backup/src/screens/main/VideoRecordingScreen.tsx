import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import AdService from '../../services/AdService';

// Enhanced video recording with freemium model and ads
const VideoRecordingScreen: React.FC = ({ navigation }: any) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingStep, setRecordingStep] = useState<'intro' | 'unlock-check' | 'ad-unlock' | 'recording' | 'preview' | 'uploading'>('intro');
  
  // Freemium & Ad states
  const [userTier, setUserTier] = useState<'free' | 'basic' | 'premium' | 'ultimate'>('free');
  const [canUpload, setCanUpload] = useState(false);
  const [videoLimits, setVideoLimits] = useState<any>(null);
  const [adUnlockAvailable, setAdUnlockAvailable] = useState(false);
  const [isLoadingAd, setIsLoadingAd] = useState(false);
  
  const maxDuration = 30; // 30 seconds max
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Initialize AdMob and check video upload eligibility
    initializeVideoRecording();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const initializeVideoRecording = async () => {
    try {
      // Initialize AdMob
      await AdService.initialize();
      
      // Check video upload eligibility
      await checkVideoUploadEligibility();
    } catch (error) {
      console.error('Failed to initialize video recording:', error);
      Alert.alert('Initialization Error', 'Failed to initialize video features. Please try again.');
    }
  };

  const checkVideoUploadEligibility = async () => {
    try {
      setRecordingStep('unlock-check');
      
      const response = await fetch('/api/v1/videos/can-upload', {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
      });

      const eligibility = await response.json();
      
      setUserTier(eligibility.subscriptionTier);
      setCanUpload(eligibility.canUpload);
      setVideoLimits(eligibility.limits);
      setAdUnlockAvailable(eligibility.upgrade.canUnlockViaAd);

      if (eligibility.canUpload) {
        setRecordingStep('intro');
      } else if (eligibility.upgrade.canUnlockViaAd) {
        setRecordingStep('ad-unlock');
      } else {
        // Show upgrade prompt
        showUpgradePrompt(eligibility);
      }
    } catch (error) {
      console.error('Failed to check video eligibility:', error);
      setRecordingStep('intro'); // Fallback to intro
    }
  };

  const showUpgradePrompt = (eligibility: any) => {
    Alert.alert(
      'Video Limit Reached',
      `You've reached your daily video limit. ${eligibility.upgrade.upgradeRecommended ? 'Upgrade to Premium for unlimited videos!' : 'Try again tomorrow.'}`,
      [
        { text: 'Cancel', onPress: () => navigation.goBack() },
        ...(eligibility.upgrade.upgradeRecommended ? [
          { 
            text: 'Upgrade', 
            onPress: () => navigation.navigate('PricingScreen') 
          }
        ] : [])
      ]
    );
  };

  const handleAdUnlock = async () => {
    try {
      setIsLoadingAd(true);
      
      // Request video unlock configuration
      const unlockRequest = await AdService.requestVideoUnlock();
      
      if (!unlockRequest.success || !unlockRequest.canWatch) {
        Alert.alert('Ad Unavailable', unlockRequest.message || 'Cannot show ad right now. Please try again later.');
        setIsLoadingAd(false);
        return;
      }

      // Show rewarded video ad
      const reward = await AdService.showRewardedVideoAd('video_unlock', 'video_unlock');
      
      if (reward) {
        // Successfully earned reward, unlock video
        Alert.alert(
          '🎉 Video Unlocked!',
          'You earned a video upload! You can now record your video.',
          [{ text: 'Start Recording', onPress: () => setRecordingStep('intro') }]
        );
      } else {
        Alert.alert('Ad Not Completed', 'You need to watch the full ad to unlock video recording.');
      }
    } catch (error) {
      console.error('Ad unlock failed:', error);
      Alert.alert('Ad Error', 'Failed to show ad. Please try again later.');
    } finally {
      setIsLoadingAd(false);
    }
  };

  const getAuthToken = async (): Promise<string> => {
    // This would get the token from your auth system
    // For now, returning a placeholder
    return 'your_auth_token_here';
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordedDuration(0);
    setRecordingStep('recording');
    
    // Simulate recording timer
    intervalRef.current = setInterval(() => {
      setRecordedDuration((prev) => {
        if (prev >= maxDuration) {
          stopRecording();
          return maxDuration;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setRecordingStep('preview');
  };

  const uploadVideo = async () => {
    setIsProcessing(true);
    setRecordingStep('uploading');
    
    try {
      // Simulate video upload process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      Alert.alert(
        'Video Uploaded!',
        'Your profile video has been uploaded successfully and submitted for verification. You\'ll be notified once it\'s approved.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Upload Failed', 'Please try again later.');
    } finally {
      setIsProcessing(false);
    }
  };

  const retakeVideo = () => {
    setRecordedDuration(0);
    setRecordingStep('intro');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderIntroScreen = () => (
    <View style={styles.centeredContent}>
      <Text style={styles.title}>Record Your Profile Video</Text>
      <Text style={styles.subtitle}>
        Show your personality in a {videoLimits?.maxDurationSeconds || 30} second video! This helps others get to know the real you.
      </Text>
      
      {/* Freemium Info */}
      {userTier === 'free' && videoLimits && (
        <View style={styles.freemiumInfo}>
          <Text style={styles.freemiumTitle}>📱 {userTier.toUpperCase()} Plan</Text>
          <Text style={styles.freemiumText}>• {videoLimits.videosPerDay} video per day</Text>
          <Text style={styles.freemiumText}>• {videoLimits.maxDurationSeconds}s max duration</Text>
          <Text style={styles.freemiumText}>• {videoLimits.qualityLevel} quality</Text>
          <Text style={styles.freemiumText}>• Watch ads for extra videos</Text>
        </View>
      )}
      
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>📹 Recording Tips:</Text>
        <Text style={styles.tip}>• Look directly at the camera</Text>
        <Text style={styles.tip}>• Speak clearly about yourself</Text>
        <Text style={styles.tip}>• Keep it natural and authentic</Text>
        <Text style={styles.tip}>• Good lighting helps!</Text>
      </View>
      
      <TouchableOpacity style={styles.startButton} onPress={startRecording}>
        <Text style={styles.startButtonText}>Start Recording</Text>
      </TouchableOpacity>
      
      {userTier === 'free' && (
        <TouchableOpacity 
          style={styles.upgradeButton} 
          onPress={() => navigation.navigate('PricingScreen')}
        >
          <Text style={styles.upgradeButtonText}>✨ Upgrade for Unlimited Videos</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderUnlockCheckScreen = () => (
    <View style={styles.centeredContent}>
      <ActivityIndicator size="large" color="#FF6B6B" />
      <Text style={styles.loadingText}>Checking video availability...</Text>
    </View>
  );

  const renderAdUnlockScreen = () => (
    <View style={styles.centeredContent}>
      <Text style={styles.title}>🎬 Unlock Video Recording</Text>
      <Text style={styles.subtitle}>
        You've used your daily free video. Watch a short ad to unlock another video recording!
      </Text>
      
      <View style={styles.adUnlockInfo}>
        <Text style={styles.adUnlockTitle}>📺 What you'll get:</Text>
        <Text style={styles.adUnlockBenefit}>• 1 additional video upload</Text>
        <Text style={styles.adUnlockBenefit}>• {videoLimits?.maxDurationSeconds || 15}s recording time</Text>
        <Text style={styles.adUnlockBenefit}>• Valid for 24 hours</Text>
      </View>
      
      {isLoadingAd ? (
        <View style={styles.loadingAdContainer}>
          <ActivityIndicator size="large" color="#FF6B6B" />
          <Text style={styles.loadingAdText}>Loading ad...</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.watchAdButton} onPress={handleAdUnlock}>
          <Text style={styles.watchAdButtonText}>📺 Watch Ad to Unlock</Text>
        </TouchableOpacity>
      )}
      
      <TouchableOpacity 
        style={styles.upgradeButton} 
        onPress={() => navigation.navigate('PricingScreen')}
      >
        <Text style={styles.upgradeButtonText}>✨ Or Upgrade to Premium</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.cancelButton} 
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRecordingScreen = () => (
    <View style={styles.recordingContainer}>
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.cameraPlaceholderText}>📹</Text>
        <Text style={styles.recordingIndicator}>● REC</Text>
      </View>
      
      <View style={styles.recordingControls}>
        <Text style={styles.timer}>
          {formatTime(recordedDuration)} / {formatTime(maxDuration)}
        </Text>
        
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${(recordedDuration / maxDuration) * 100}%` }
            ]} 
          />
        </View>
        
        <TouchableOpacity 
          style={styles.stopButton} 
          onPress={stopRecording}
          disabled={recordedDuration < 5} // Minimum 5 seconds
        >
          <Text style={styles.stopButtonText}>
            {recordedDuration < 5 ? `${5 - recordedDuration}s min` : 'Stop'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPreviewScreen = () => (
    <View style={styles.previewContainer}>
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.cameraPlaceholderText}>🎬</Text>
        <Text style={styles.previewText}>Video Preview</Text>
        <Text style={styles.durationText}>Duration: {formatTime(recordedDuration)}</Text>
      </View>
      
      <View style={styles.previewControls}>
        <TouchableOpacity style={styles.retakeButton} onPress={retakeVideo}>
          <Text style={styles.retakeButtonText}>Retake</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.uploadButton} onPress={uploadVideo}>
          <Text style={styles.uploadButtonText}>Upload Video</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderUploadingScreen = () => (
    <View style={styles.centeredContent}>
      <ActivityIndicator size="large" color="#FF6B6B" />
      <Text style={styles.uploadingText}>Uploading your video...</Text>
      <Text style={styles.uploadingSubtext}>
        Your video is being processed and will be reviewed for authenticity.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Video</Text>
        <View style={styles.placeholder} />
      </View>

      {recordingStep === 'unlock-check' && renderUnlockCheckScreen()}
      {recordingStep === 'ad-unlock' && renderAdUnlockScreen()}
      {recordingStep === 'intro' && renderIntroScreen()}
      {recordingStep === 'recording' && renderRecordingScreen()}
      {recordingStep === 'preview' && renderPreviewScreen()}
      {recordingStep === 'uploading' && renderUploadingScreen()}
    </View>
  );
};

const { width, height } = Dimensions.get('window');

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
  closeButton: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 24,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  tipsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    width: '100%',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  tip: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 6,
  },
  startButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 25,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  recordingContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    margin: 20,
    borderRadius: 12,
  },
  cameraPlaceholderText: {
    fontSize: 60,
    marginBottom: 10,
  },
  recordingIndicator: {
    color: '#FF4444',
    fontSize: 18,
    fontWeight: 'bold',
  },
  previewText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 10,
  },
  durationText: {
    color: '#cccccc',
    fontSize: 14,
    marginTop: 5,
  },
  recordingControls: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  timer: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 30,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF6B6B',
    borderRadius: 2,
  },
  stopButton: {
    backgroundColor: '#FF4444',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
  },
  stopButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  previewControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  retakeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retakeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadingText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  uploadingSubtext: {
    color: '#cccccc',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Freemium & Ad Styles
  freemiumInfo: {
    backgroundColor: 'rgba(106, 107, 234, 0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(106, 107, 234, 0.3)',
  },
  freemiumTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6A6BEA',
    marginBottom: 8,
    textAlign: 'center',
  },
  freemiumText: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 4,
  },
  adUnlockInfo: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  adUnlockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFC107',
    marginBottom: 12,
    textAlign: 'center',
  },
  adUnlockBenefit: {
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 6,
    textAlign: 'center',
  },
  watchAdButton: {
    backgroundColor: '#FFC107',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 25,
    marginBottom: 16,
    minWidth: 250,
  },
  watchAdButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  upgradeButton: {
    backgroundColor: 'rgba(106, 107, 234, 0.3)',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#6A6BEA',
  },
  upgradeButtonText: {
    color: '#6A6BEA',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  loadingAdContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingAdText: {
    color: '#FFC107',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
});

export default VideoRecordingScreen;