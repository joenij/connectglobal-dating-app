// Environment Configuration for ConnectGlobal API
type EnvironmentType = 'development' | 'test' | 'production';

// Get environment from build configuration or default
const getCurrentEnvironment = (): EnvironmentType => {
  // This will be set during build process
  return __DEV__ ? 'development' : 'production';
};

export const ENV_CONFIG = {
  CURRENT_ENV: getCurrentEnvironment(),
  
  ENVIRONMENTS: {
    development: {
      API_BASE_URL: 'http://localhost:8003',
      API_PATH_PREFIX: '/api/v1',
      WEBSOCKET_URL: 'ws://localhost:8003',
      DEBUG_MODE: true,
      LOG_LEVEL: 'debug' as const,
      TIMEOUT: 10000,
      ENVIRONMENT_NAME: 'Development',
      COLOR_SCHEME: '#007AFF', // Blue for dev
      ENABLE_TEST_FEATURES: true,
      SERVER_TYPE: 'local' as const
    },
    test: {
      API_BASE_URL: 'http://localhost:8002',
      API_PATH_PREFIX: '/api/v1', 
      WEBSOCKET_URL: 'ws://localhost:8002',
      DEBUG_MODE: true,
      LOG_LEVEL: 'debug' as const,
      TIMEOUT: 8000,
      ENVIRONMENT_NAME: 'Test with Sample Data',
      COLOR_SCHEME: '#FF9500', // Orange for test
      ENABLE_TEST_FEATURES: true,
      SERVER_TYPE: 'local-test' as const
    },
    production: {
      API_BASE_URL: 'https://api.jneconnect.com',
      API_PATH_PREFIX: '/api/v1',
      WEBSOCKET_URL: 'wss://api.jneconnect.com/socket.io',
      DEBUG_MODE: false,
      LOG_LEVEL: 'error' as const,
      TIMEOUT: 15000,
      ENVIRONMENT_NAME: 'Production',
      COLOR_SCHEME: '#34C759', // Green for production
      ENABLE_TEST_FEATURES: false,
      SERVER_TYPE: 'production' as const
    }
  }
};

// Get current environment configuration
export const getCurrentEnvConfig = () => {
  return ENV_CONFIG.ENVIRONMENTS[ENV_CONFIG.CURRENT_ENV];
};

// Utility functions
export const isProduction = () => ENV_CONFIG.CURRENT_ENV === 'production';
export const isDevelopment = () => ENV_CONFIG.CURRENT_ENV === 'development';
export const isTest = () => ENV_CONFIG.CURRENT_ENV === 'test';

// Get environment information
export const getEnvironmentInfo = () => {
  const config = getCurrentEnvConfig();
  return {
    environment: ENV_CONFIG.CURRENT_ENV,
    name: config.ENVIRONMENT_NAME,
    apiUrl: config.API_BASE_URL,
    debugMode: config.DEBUG_MODE,
    colorScheme: config.COLOR_SCHEME,
    serverType: config.SERVER_TYPE,
    isDevelopment: ENV_CONFIG.CURRENT_ENV === 'development',
    isTest: ENV_CONFIG.CURRENT_ENV === 'test',
    isProduction: ENV_CONFIG.CURRENT_ENV === 'production',
    features: {
      testFeatures: config.ENABLE_TEST_FEATURES
    }
  };
};

// API URL builder for current environment
export const buildApiUrl = (endpoint: string) => {
  const config = getCurrentEnvConfig();
  return `${config.API_BASE_URL}${config.API_PATH_PREFIX}${endpoint}`;
};