// ConnectGlobal API - Main Export File
export { apiClient as default } from './client';
export { API_CONFIG, getApiUrl } from './config';
export { getCurrentEnvConfig, isProduction, isDevelopment, buildApiUrl } from './environment';
export { testApiConnection } from './test-connection';

// Initialize API configuration
import { API_CONFIG } from './config';
import { isProduction } from './environment';

console.log(`🚀 ConnectGlobal API initialized for ${isProduction() ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`🌐 Base URL: ${API_CONFIG.BASE_URL}`);

if (__DEV__) {
  console.log('🔧 Development mode - API debugging enabled');
  console.log('📍 Sample endpoints:');
  console.log('  Health: /health');
  console.log('  API Status: /api/status');
  console.log('  Auth: /auth/login');
  console.log('  Matching: /matching/discover');
}