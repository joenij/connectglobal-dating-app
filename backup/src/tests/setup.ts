import '@testing-library/jest-native/extend-expect';
import { jest } from '@jest/globals';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock React Native components
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'ios',
      select: jest.fn((config) => config.ios || config.default),
    },
    Dimensions: {
      get: jest.fn(() => ({ width: 375, height: 667 })),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    Alert: {
      alert: jest.fn(),
    },
    Linking: {
      openURL: jest.fn(() => Promise.resolve()),
      canOpenURL: jest.fn(() => Promise.resolve(true)),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    Share: {
      share: jest.fn(() => Promise.resolve()),
    },
    Clipboard: {
      setString: jest.fn(),
      getString: jest.fn(() => Promise.resolve('')),
    },
  };
});

// Mock react-navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    isFocused: jest.fn(() => true),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
    name: 'TestScreen',
    key: 'test-key',
  }),
  useFocusEffect: jest.fn(),
}));

// Mock react-native-google-mobile-ads
jest.mock('react-native-google-mobile-ads', () => ({
  MobileAds: jest.fn(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    setTestDeviceIds: jest.fn().mockResolvedValue(undefined),
  })),
  BannerAd: jest.fn().mockImplementation(({ children, ...props }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { ...props, testID: 'banner-ad' }, children);
  }),
  InterstitialAd: {
    createForAdRequest: jest.fn(() => ({
      addAdEventListener: jest.fn(),
      load: jest.fn().mockResolvedValue(undefined),
      show: jest.fn().mockResolvedValue(undefined),
    })),
  },
  RewardedAd: {
    createForAdRequest: jest.fn(() => ({
      addAdEventListener: jest.fn(),
      load: jest.fn().mockResolvedValue(undefined),
      show: jest.fn().mockResolvedValue(undefined),
    })),
  },
  AdsConsent: {
    requestConsentInfoUpdate: jest.fn().mockResolvedValue(undefined),
    loadConsentForm: jest.fn().mockResolvedValue({
      show: jest.fn().mockResolvedValue(undefined),
    }),
    getConsentStatus: jest.fn().mockResolvedValue('OBTAINED'),
    canRequestAds: jest.fn().mockResolvedValue(true),
    reset: jest.fn().mockResolvedValue(undefined),
  },
  BannerAdSize: {
    ADAPTIVE_BANNER: 'ADAPTIVE_BANNER',
    BANNER: 'BANNER',
    LARGE_BANNER: 'LARGE_BANNER',
  },
  TestIds: {
    BANNER: 'ca-app-pub-3940256099942544/6300978111',
    INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
    REWARDED_VIDEO: 'ca-app-pub-3940256099942544/5224354917',
  },
  AdEventType: {
    LOADED: 'loaded',
    OPENED: 'opened',
    CLOSED: 'closed',
    ERROR: 'error',
  },
  RewardedAdEventType: {
    EARNED_REWARD: 'earned_reward',
  },
  AdsConsentStatus: {
    UNKNOWN: 'UNKNOWN',
    REQUIRED: 'REQUIRED',
    NOT_REQUIRED: 'NOT_REQUIRED',
    OBTAINED: 'OBTAINED',
  },
}));

// Mock react-native-encrypted-storage
jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/Ionicons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return jest.fn().mockImplementation(({ name, size, color, ...props }) =>
    React.createElement(Text, { ...props }, name)
  );
});

// Mock react-native-permissions
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    IOS: {
      CAMERA: 'ios.permission.CAMERA',
      MICROPHONE: 'ios.permission.MICROPHONE',
    },
    ANDROID: {
      CAMERA: 'android.permission.CAMERA',
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    },
  },
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    DENIED: 'denied',
    LIMITED: 'limited',
    GRANTED: 'granted',
    BLOCKED: 'blocked',
  },
  request: jest.fn(() => Promise.resolve('granted')),
  check: jest.fn(() => Promise.resolve('granted')),
  requestMultiple: jest.fn(() => Promise.resolve({})),
  checkMultiple: jest.fn(() => Promise.resolve({})),
}));

// Mock react-native-video
jest.mock('react-native-video', () => {
  const React = require('react');
  const { View } = require('react-native');
  return jest.fn().mockImplementation((props) =>
    React.createElement(View, { ...props, testID: 'video-player' })
  );
});

// Mock react-native-vision-camera
jest.mock('react-native-vision-camera', () => ({
  Camera: {
    getAvailableCameraDevices: jest.fn(() => Promise.resolve([])),
    getCameraPermissionStatus: jest.fn(() => Promise.resolve('granted')),
    getMicrophonePermissionStatus: jest.fn(() => Promise.resolve('granted')),
    requestCameraPermission: jest.fn(() => Promise.resolve('granted')),
    requestMicrophonePermission: jest.fn(() => Promise.resolve('granted')),
  },
  useCameraDevices: jest.fn(() => ({
    back: { id: 'back', position: 'back' },
    front: { id: 'front', position: 'front' },
  })),
  useFrameProcessor: jest.fn(),
}));

// Global fetch mock
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
) as jest.Mock;

// Global console overrides for cleaner test output
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  // Suppress specific warnings in tests
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render is deprecated') ||
       args[0].includes('Warning: react-test-renderer') ||
       args[0].includes('componentWillReceiveProps has been renamed'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('componentWillReceiveProps has been renamed') ||
       args[0].includes('componentWillMount has been renamed'))
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Global test utilities
global.__TEST_UTILS__ = {
  // Mock user authentication
  mockAuthenticatedUser: (userData = {}) => {
    const defaultUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      subscription_tier: 'free',
      country_code: 'US',
      ...userData,
    };

    // Mock auth token
    global.fetch = jest.fn().mockImplementation((url, options) => {
      if (url.includes('/auth/') || options?.headers?.Authorization) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ user: defaultUser, success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as jest.Mock;

    return defaultUser;
  },

  // Mock API responses
  mockApiResponse: (data: any, status = 200) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    }) as jest.Mock;
  },

  // Mock timer utilities
  advanceTimersByTime: (ms: number) => {
    jest.advanceTimersByTime(ms);
  },

  // Wait for async operations
  waitFor: async (callback: () => void, timeout = 1000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkCondition = () => {
        try {
          callback();
          resolve(true);
        } catch (error) {
          if (Date.now() - startTime > timeout) {
            reject(new Error(`Timeout waiting for condition: ${error}`));
          } else {
            setTimeout(checkCondition, 10);
          }
        }
      };
      checkCondition();
    });
  },
};

// Type declarations for global utilities
declare global {
  var __TEST_UTILS__: {
    mockAuthenticatedUser: (userData?: any) => any;
    mockApiResponse: (data: any, status?: number) => void;
    advanceTimersByTime: (ms: number) => void;
    waitFor: (callback: () => void, timeout?: number) => Promise<any>;
  };
}

export {};