import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { jest } from '@jest/globals';
import AdBanner from '../components/AdBanner';
import AdService from '../services/AdService';

// Mock AdService
jest.mock('../services/AdService', () => ({
  initialize: jest.fn(),
  getAdConfig: jest.fn(),
}));

// Mock react-native-google-mobile-ads
jest.mock('react-native-google-mobile-ads', () => ({
  BannerAd: ({ onAdLoaded, onAdFailedToLoad, onAdOpened, onAdClosed, ...props }: any) => {
    const MockBannerAd = require('react-native').View;
    
    // Simulate ad loading after mount
    React.useEffect(() => {
      setTimeout(() => {
        if (props.unitId && props.unitId !== '') {
          onAdLoaded?.();
        } else {
          onAdFailedToLoad?.(new Error('Invalid ad unit ID'));
        }
      }, 100);
    }, [props.unitId]);
    
    return React.createElement(MockBannerAd, {
      testID: 'banner-ad',
      onTouchEnd: () => {
        onAdOpened?.();
        setTimeout(() => onAdClosed?.(), 50);
      },
      ...props
    });
  },
  BannerAdSize: {
    ADAPTIVE_BANNER: 'ADAPTIVE_BANNER',
  },
  TestIds: {
    BANNER: 'ca-app-pub-3940256099942544/6300978111',
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('AdBanner Component', () => {
  const mockAdService = AdService as jest.Mocked<typeof AdService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAdService.initialize.mockResolvedValue(true);
    mockAdService.getAdConfig.mockResolvedValue({
      adNetwork: 'admob',
      adType: 'banner',
      adUnitId: 'ca-app-pub-test-banner',
      placementLocation: 'home_screen'
    });

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  describe('Rendering', () => {
    it('should render loading state initially', () => {
      const { getByText } = render(
        <AdBanner placement="home_screen" userTier="free" />
      );

      expect(getByText('Loading ad...')).toBeTruthy();
    });

    it('should render banner ad for free users', async () => {
      const { getByTestId, queryByText } = render(
        <AdBanner placement="home_screen" userTier="free" />
      );

      await waitFor(() => {
        expect(getByTestId('banner-ad')).toBeTruthy();
        expect(queryByText('Loading ad...')).toBeNull();
      });

      expect(mockAdService.initialize).toHaveBeenCalled();
      expect(mockAdService.getAdConfig).toHaveBeenCalledWith('home_screen', 'US', 'free');
    });

    it('should not render ads for premium users', async () => {
      const { queryByTestId, queryByText } = render(
        <AdBanner placement="home_screen" userTier="premium" />
      );

      await waitFor(() => {
        expect(queryByText('Loading ad...')).toBeNull();
        expect(queryByTestId('banner-ad')).toBeNull();
      });

      expect(mockAdService.getAdConfig).not.toHaveBeenCalled();
    });

    it('should not render ads for basic users', async () => {
      const { queryByTestId } = render(
        <AdBanner placement="home_screen" userTier="basic" />
      );

      await waitFor(() => {
        expect(queryByTestId('banner-ad')).toBeNull();
      });
    });

    it('should handle missing ad configuration gracefully', async () => {
      mockAdService.getAdConfig.mockResolvedValue(null);

      const { queryByTestId } = render(
        <AdBanner placement="unknown_placement" userTier="free" />
      );

      await waitFor(() => {
        expect(queryByTestId('banner-ad')).toBeTruthy(); // Should show test ad in dev
      });
    });
  });

  describe('Ad Tracking', () => {
    const mockGetAuthToken = jest.fn().mockResolvedValue('test-token');

    beforeEach(() => {
      // Mock getAuthToken function
      (global as any).getAuthToken = mockGetAuthToken;
    });

    it('should track ad impressions', async () => {
      const { getByTestId } = render(
        <AdBanner placement="home_screen" userTier="free" />
      );

      await waitFor(() => {
        expect(getByTestId('banner-ad')).toBeTruthy();
      });

      // Wait for ad load event
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/advertising/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          },
          body: JSON.stringify({
            adNetwork: 'admob',
            adType: 'banner',
            placementLocation: 'home_screen',
            action: 'impression',
            adUnitId: 'ca-app-pub-test-banner',
            deviceType: 'mobile'
          })
        });
      });
    });

    it('should track ad clicks', async () => {
      const { getByTestId } = render(
        <AdBanner placement="home_screen" userTier="free" />
      );

      const bannerAd = await waitFor(() => getByTestId('banner-ad'));

      // Simulate ad click
      act(() => {
        bannerAd.props.onTouchEnd();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/advertising/track', 
          expect.objectContaining({
            body: expect.stringContaining('"action":"click"')
          })
        );
      });
    });

    it('should track ad dismissals', async () => {
      const { getByTestId } = render(
        <AdBanner placement="home_screen" userTier="free" />
      );

      const bannerAd = await waitFor(() => getByTestId('banner-ad'));

      // Simulate ad click and close
      act(() => {
        bannerAd.props.onTouchEnd();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/v1/advertising/track',
          expect.objectContaining({
            body: expect.stringContaining('"action":"dismissed"')
          })
        );
      }, { timeout: 200 });
    });

    it('should handle tracking failures gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const { getByTestId } = render(
        <AdBanner placement="home_screen" userTier="free" />
      );

      // Should still render the ad even if tracking fails
      await waitFor(() => {
        expect(getByTestId('banner-ad')).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle AdMob initialization failure', async () => {
      mockAdService.initialize.mockResolvedValue(false);

      const { queryByTestId } = render(
        <AdBanner placement="home_screen" userTier="free" />
      );

      await waitFor(() => {
        expect(queryByTestId('banner-ad')).toBeNull();
      });
    });

    it('should handle ad loading failures', async () => {
      mockAdService.getAdConfig.mockResolvedValue({
        adNetwork: 'admob',
        adType: 'banner',
        adUnitId: '', // Invalid unit ID
        placementLocation: 'home_screen'
      });

      const { queryByTestId } = render(
        <AdBanner placement="home_screen" userTier="free" />
      );

      await waitFor(() => {
        expect(queryByTestId('banner-ad')).toBeNull();
      });
    });

    it('should handle network errors during ad config fetch', async () => {
      mockAdService.getAdConfig.mockRejectedValue(new Error('Network error'));

      const { queryByTestId } = render(
        <AdBanner placement="home_screen" userTier="free" />
      );

      await waitFor(() => {
        expect(queryByTestId('banner-ad')).toBeTruthy(); // Should fallback to test ad
      });
    });
  });

  describe('Props and Configuration', () => {
    it('should accept custom BannerAdSize', async () => {
      const { getByTestId } = render(
        <AdBanner 
          placement="home_screen" 
          userTier="free" 
          size="BANNER" as any
        />
      );

      const bannerAd = await waitFor(() => getByTestId('banner-ad'));
      expect(bannerAd.props.size).toBe('BANNER');
    });

    it('should apply custom styles', async () => {
      const customStyle = { backgroundColor: 'red', margin: 10 };

      const { getByTestId } = render(
        <AdBanner 
          placement="home_screen" 
          userTier="free"
          style={customStyle}
        />
      );

      // Check that container has custom styles applied
      const container = getByTestId('banner-ad').parent;
      expect(container?.props.style).toEqual(expect.arrayContaining([
        expect.objectContaining(customStyle)
      ]));
    });

    it('should handle different placement locations', async () => {
      const placements = ['home_screen', 'profile_view', 'matches_list'];

      for (const placement of placements) {
        mockAdService.getAdConfig.mockClear();
        
        render(<AdBanner placement={placement} userTier="free" />);
        
        await waitFor(() => {
          expect(mockAdService.getAdConfig).toHaveBeenCalledWith(placement, 'US', 'free');
        });
      }
    });
  });

  describe('Lifecycle Management', () => {
    it('should reinitialize when props change', async () => {
      const { rerender } = render(
        <AdBanner placement="home_screen" userTier="free" />
      );

      await waitFor(() => {
        expect(mockAdService.getAdConfig).toHaveBeenCalledTimes(1);
      });

      // Change placement
      rerender(
        <AdBanner placement="profile_view" userTier="free" />
      );

      await waitFor(() => {
        expect(mockAdService.getAdConfig).toHaveBeenCalledTimes(2);
        expect(mockAdService.getAdConfig).toHaveBeenLastCalledWith('profile_view', 'US', 'free');
      });
    });

    it('should handle user tier changes', async () => {
      const { rerender, queryByTestId } = render(
        <AdBanner placement="home_screen" userTier="free" />
      );

      await waitFor(() => {
        expect(queryByTestId('banner-ad')).toBeTruthy();
      });

      // Upgrade to premium
      rerender(
        <AdBanner placement="home_screen" userTier="premium" />
      );

      await waitFor(() => {
        expect(queryByTestId('banner-ad')).toBeNull();
      });
    });

    it('should cleanup on unmount', () => {
      const { unmount } = render(
        <AdBanner placement="home_screen" userTier="free" />
      );

      // Should not throw errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should not initialize ads unnecessarily', async () => {
      mockAdService.initialize.mockClear();

      render(<AdBanner placement="home_screen" userTier="premium" />);

      await waitFor(() => {
        expect(mockAdService.initialize).not.toHaveBeenCalled();
      });
    });

    it('should debounce rapid prop changes', async () => {
      const { rerender } = render(
        <AdBanner placement="home_screen" userTier="free" />
      );

      // Rapid changes
      rerender(<AdBanner placement="profile_view" userTier="free" />);
      rerender(<AdBanner placement="matches_list" userTier="free" />);
      rerender(<AdBanner placement="home_screen" userTier="free" />);

      await waitFor(() => {
        // Should have been called for initial render + final state
        expect(mockAdService.getAdConfig).toHaveBeenCalledTimes(2);
      });
    });
  });
});