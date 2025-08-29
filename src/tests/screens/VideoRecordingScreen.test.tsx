import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { jest } from '@jest/globals';
import VideoRecordingScreen from '../screens/main/VideoRecordingScreen';
import AdService from '../services/AdService';

// Mock dependencies
jest.mock('../services/AdService');
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Alert: {
    alert: jest.fn(),
  },
  Dimensions: {
    get: () => ({ width: 375, height: 667 }),
  },
}));

// Mock navigation
const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
};

// Mock fetch
global.fetch = jest.fn();

describe('VideoRecordingScreen', () => {
  const mockAdService = AdService as jest.Mocked<typeof AdService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockAdService.initialize.mockResolvedValue(true);
    mockAdService.requestVideoUnlock.mockResolvedValue({
      success: true,
      canWatch: true,
      adConfig: {
        adNetwork: 'admob',
        adType: 'rewarded_video',
        adUnitId: 'test-unit-id',
        rewardType: 'video_unlock'
      }
    });
    mockAdService.showRewardedVideoAd.mockResolvedValue({
      type: 'video_unlock',
      amount: 1
    });

    // Mock video upload eligibility API
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (url.includes('/can-upload')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            canUpload: true,
            subscriptionTier: 'free',
            limits: {
              videosPerDay: 1,
              maxDurationSeconds: 30,
              qualityLevel: 'standard',
              maxVideosViaAds: 3
            },
            upgrade: {
              canUnlockViaAd: true,
              upgradeRecommended: true
            }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize and check video upload eligibility', async () => {
      render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(mockAdService.initialize).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/videos/can-upload',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: expect.any(String)
            })
          })
        );
      });
    });

    it('should show loading screen during initialization', () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);
      expect(getByText('Checking video availability...')).toBeTruthy();
    });

    it('should handle initialization errors gracefully', async () => {
      mockAdService.initialize.mockRejectedValue(new Error('AdMob init failed'));

      render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Initialization Error',
          'Failed to initialize video features. Please try again.'
        );
      });
    });
  });

  describe('Free User Video Recording Flow', () => {
    it('should show intro screen for eligible free users', async () => {
      render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(render.getByText('Record Your Profile Video')).toBeTruthy();
        expect(render.getByText('📱 FREE Plan')).toBeTruthy();
        expect(render.getByText('• 1 video per day')).toBeTruthy();
      });
    });

    it('should allow recording when user has uploads available', async () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        const startButton = getByText('Start Recording');
        expect(startButton).toBeTruthy();
      });

      fireEvent.press(getByText('Start Recording'));

      await waitFor(() => {
        expect(getByText('● REC')).toBeTruthy();
        expect(getByText('0:00 / 0:30')).toBeTruthy();
      });
    });

    it('should enforce minimum recording duration', async () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        fireEvent.press(getByText('Start Recording'));
      });

      await waitFor(() => {
        expect(getByText('5s min')).toBeTruthy();
      });

      // Advance timer but not enough
      act(() => {
        jest.advanceTimersByTime(3000); // 3 seconds
      });

      expect(getByText('2s min')).toBeTruthy();
    });

    it('should allow stopping after minimum duration', async () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        fireEvent.press(getByText('Start Recording'));
      });

      // Advance timer past minimum
      act(() => {
        jest.advanceTimersByTime(6000); // 6 seconds
      });

      await waitFor(() => {
        expect(getByText('Stop')).toBeTruthy();
      });

      fireEvent.press(getByText('Stop'));

      await waitFor(() => {
        expect(getByText('Video Preview')).toBeTruthy();
        expect(getByText('Duration: 0:06')).toBeTruthy();
      });
    });

    it('should auto-stop at maximum duration', async () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        fireEvent.press(getByText('Start Recording'));
      });

      // Advance timer to maximum duration
      act(() => {
        jest.advanceTimersByTime(30000); // 30 seconds
      });

      await waitFor(() => {
        expect(getByText('Video Preview')).toBeTruthy();
        expect(getByText('Duration: 0:30')).toBeTruthy();
      });
    });
  });

  describe('Ad Unlock Flow', () => {
    beforeEach(() => {
      // Mock user without available uploads
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/can-upload')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              canUpload: false,
              subscriptionTier: 'free',
              limits: {
                videosPerDay: 1,
                maxDurationSeconds: 15,
                qualityLevel: 'standard'
              },
              upgrade: {
                canUnlockViaAd: true,
                upgradeRecommended: true
              }
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      });
    });

    it('should show ad unlock screen when user has no uploads available', async () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(getByText('🎬 Unlock Video Recording')).toBeTruthy();
        expect(getByText("You've used your daily free video. Watch a short ad to unlock another video recording!")).toBeTruthy();
        expect(getByText('📺 Watch Ad to Unlock')).toBeTruthy();
      });
    });

    it('should show loading state while preparing ad', async () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        fireEvent.press(getByText('📺 Watch Ad to Unlock'));
      });

      expect(getByText('Loading ad...')).toBeTruthy();
    });

    it('should show rewarded video ad successfully', async () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        fireEvent.press(getByText('📺 Watch Ad to Unlock'));
      });

      await waitFor(() => {
        expect(mockAdService.requestVideoUnlock).toHaveBeenCalled();
        expect(mockAdService.showRewardedVideoAd).toHaveBeenCalledWith('video_unlock', 'video_unlock');
      });

      // Mock successful ad completion
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          '🎉 Video Unlocked!',
          'You earned a video upload! You can now record your video.',
          expect.arrayContaining([
            expect.objectContaining({
              text: 'Start Recording'
            })
          ])
        );
      });
    });

    it('should handle ad request failures', async () => {
      mockAdService.requestVideoUnlock.mockResolvedValue({
        success: false,
        canWatch: false,
        message: 'No ads available right now'
      });

      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        fireEvent.press(getByText('📺 Watch Ad to Unlock'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Ad Unavailable',
          'No ads available right now'
        );
      });
    });

    it('should handle ad not completed', async () => {
      mockAdService.showRewardedVideoAd.mockResolvedValue(null);

      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        fireEvent.press(getByText('📺 Watch Ad to Unlock'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Ad Not Completed',
          'You need to watch the full ad to unlock video recording.'
        );
      });
    });

    it('should show upgrade option', async () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        fireEvent.press(getByText('✨ Or Upgrade to Premium'));
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('PricingScreen');
    });

    it('should allow canceling ad unlock flow', async () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        fireEvent.press(getByText('Cancel'));
      });

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  describe('Video Upload Flow', () => {
    it('should handle video upload successfully', async () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      // Complete recording flow
      await waitFor(() => {
        fireEvent.press(getByText('Start Recording'));
      });

      act(() => {
        jest.advanceTimersByTime(10000); // 10 seconds
      });

      fireEvent.press(getByText('Stop'));

      await waitFor(() => {
        fireEvent.press(getByText('Upload Video'));
      });

      expect(getByText('Uploading your video...')).toBeTruthy();

      // Fast-forward upload simulation
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Video Uploaded!',
          expect.stringContaining('uploaded successfully'),
          expect.arrayContaining([
            expect.objectContaining({
              text: 'OK',
              onPress: expect.any(Function)
            })
          ])
        );
      });
    });

    it('should allow retaking video', async () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      // Complete recording
      await waitFor(() => {
        fireEvent.press(getByText('Start Recording'));
      });

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      fireEvent.press(getByText('Stop'));

      await waitFor(() => {
        fireEvent.press(getByText('Retake'));
      });

      // Should return to intro screen
      expect(getByText('Record Your Profile Video')).toBeTruthy();
    });

    it('should handle upload failures', async () => {
      // Mock upload failure
      global.setTimeout = jest.fn().mockImplementation((callback) => {
        callback();
        return 1;
      });

      const originalImplementation = global.setTimeout;
      const mockSetTimeout = jest.fn((callback, delay) => {
        if (delay === 3000) {
          // Simulate upload failure
          throw new Error('Upload failed');
        }
        return originalImplementation(callback, delay);
      });

      global.setTimeout = mockSetTimeout;

      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      // Complete recording flow
      await waitFor(() => {
        fireEvent.press(getByText('Start Recording'));
      });

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      fireEvent.press(getByText('Stop'));
      fireEvent.press(getByText('Upload Video'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Upload Failed',
          'Please try again later.'
        );
      });
    });
  });

  describe('Premium User Experience', () => {
    beforeEach(() => {
      // Mock premium user
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/can-upload')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              canUpload: true,
              subscriptionTier: 'premium',
              limits: {
                videosPerDay: -1, // Unlimited
                maxDurationSeconds: 60,
                qualityLevel: 'hd'
              },
              upgrade: {
                canUnlockViaAd: false,
                upgradeRecommended: false
              }
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      });
    });

    it('should not show freemium limitations for premium users', async () => {
      const { queryByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(queryByText('📱 FREE Plan')).toBeNull();
        expect(queryByText('Watch ads for extra videos')).toBeNull();
        expect(queryByText('✨ Upgrade for Unlimited Videos')).toBeNull();
      });
    });

    it('should show longer recording time for premium users', async () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(getByText('Show your personality in a 60 second video!')).toBeTruthy();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle API errors during eligibility check', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      // Should fallback to intro screen
      await waitFor(() => {
        expect(getByText('Record Your Profile Video')).toBeTruthy();
      });
    });

    it('should handle upgrade prompt for users at daily limit', async () => {
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/can-upload')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              canUpload: false,
              subscriptionTier: 'free',
              limits: { videosPerDay: 1 },
              upgrade: {
                canUnlockViaAd: false,
                upgradeRecommended: true
              }
            })
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });

      render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Video Limit Reached',
          expect.stringContaining('Upgrade to Premium'),
          expect.arrayContaining([
            expect.objectContaining({ text: 'Cancel' }),
            expect.objectContaining({ text: 'Upgrade' })
          ])
        );
      });
    });

    it('should handle back button press', () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      fireEvent.press(getByText('✕'));

      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });

  describe('Performance and Memory', () => {
    it('should cleanup timers on unmount', () => {
      const { unmount } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should handle rapid state changes gracefully', async () => {
      const { getByText } = render(<VideoRecordingScreen navigation={mockNavigation} />);

      await waitFor(() => {
        fireEvent.press(getByText('Start Recording'));
      });

      // Rapid button presses
      fireEvent.press(getByText('5s min')); // Should not crash
      fireEvent.press(getByText('5s min'));
      fireEvent.press(getByText('5s min'));

      // Should still work normally
      act(() => {
        jest.advanceTimersByTime(6000);
      });

      expect(getByText('Stop')).toBeTruthy();
    });
  });
});