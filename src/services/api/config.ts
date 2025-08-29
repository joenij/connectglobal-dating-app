// API Configuration with Environment Support
import { getCurrentEnvConfig, buildApiUrl } from './environment';

const envConfig = getCurrentEnvConfig();

export const API_CONFIG = {
  BASE_URL: envConfig.API_BASE_URL,
  API_VERSION: 'v1',
  TIMEOUT: envConfig.TIMEOUT,
  DEBUG_MODE: envConfig.DEBUG_MODE,
  LOG_LEVEL: envConfig.LOG_LEVEL,
  ENDPOINTS: {
    AUTH: {
      REGISTER: '/auth/register',
      LOGIN: '/auth/login',
      LOGOUT: '/auth/logout',
      REFRESH: '/auth/refresh',
      VERIFY_PHONE: '/auth/verify-phone',
    },
    USERS: {
      PROFILE: '/users/profile',
      PREFERENCES: '/users/preferences',
      PHOTOS: '/users/photos',
    },
    MATCHING: {
      DISCOVER: '/matching/discover',
      ACTION: '/matching/action',
      MATCHES: '/matching/matches',
    },
    MESSAGING: {
      CONVERSATIONS: '/messaging/conversations',
      MESSAGES: '/messaging/messages',
      SEND: '/messaging/send',
    },
    PRICING: {
      PLANS: '/pricing',
      BETA_JOIN: '/pricing/join-beta',
      BETA_STATUS: '/pricing/beta-status',
    },
  },
};

export const getApiUrl = (endpoint: string) => {
  return buildApiUrl(endpoint);
};

// Log API configuration for debugging
if (API_CONFIG.DEBUG_MODE) {
  console.log('🌐 ConnectGlobal API Configuration:', {
    baseUrl: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
    debugMode: API_CONFIG.DEBUG_MODE,
    sampleEndpoint: getApiUrl('/health')
  });
}