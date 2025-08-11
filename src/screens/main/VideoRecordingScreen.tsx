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

// For a zero-budget implementation, we'll use a placeholder for video recording
// In production, you would use react-native-vision-camera
const VideoRecordingScreen: React.FC = ({ navigation }: any) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingStep, setRecordingStep] = useState<'intro' | 'recording' | 'preview' | 'uploading'>('intro');
  
  const maxDuration = 30; // 30 seconds max
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

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
        Show your personality in a 15-30 second video! This helps others get to know the real you.
      </Text>
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
});

export default VideoRecordingScreen;