// API Configuration
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8003', // Using the working backend server
  API_VERSION: 'v1',
  TIMEOUT: 10000,
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
  return `${API_CONFIG.BASE_URL}/api/${API_CONFIG.API_VERSION}${endpoint}`;
};