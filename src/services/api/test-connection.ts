// API Connection Test for ConnectGlobal Production Backend
import { getApiUrl, API_CONFIG } from './config';
import { isProduction, getCurrentEnvConfig } from './environment';

export const testApiConnection = async () => {
  console.log('🌐 Testing ConnectGlobal API Connection...');
  console.log('📍 Environment:', isProduction() ? 'PRODUCTION' : 'DEVELOPMENT');
  console.log('🔗 Base URL:', API_CONFIG.BASE_URL);
  
  const config = getCurrentEnvConfig();
  
  try {
    // Test health endpoint
    const healthUrl = getApiUrl('/health');
    console.log('🏥 Testing Health Check:', healthUrl);
    
    const healthResponse = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: API_CONFIG.TIMEOUT,
    });
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health Check Success:', healthData);
    } else {
      console.error('❌ Health Check Failed:', healthResponse.status);
    }
    
    // Test API status endpoint
    const statusUrl = getApiUrl('/api/status');
    console.log('📊 Testing API Status:', statusUrl);
    
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: API_CONFIG.TIMEOUT,
    });
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('✅ API Status Success:', statusData);
    } else {
      console.error('❌ API Status Failed:', statusResponse.status);
    }
    
    return {
      success: true,
      message: 'ConnectGlobal API is reachable',
      environment: isProduction() ? 'production' : 'development',
      baseUrl: API_CONFIG.BASE_URL
    };
    
  } catch (error) {
    console.error('❌ API Connection Failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      environment: isProduction() ? 'production' : 'development',
      baseUrl: API_CONFIG.BASE_URL
    };
  }
};

// Auto-test when imported in development
if (__DEV__ && API_CONFIG.DEBUG_MODE) {
  console.log('🔧 Development mode detected - running API connection test...');
  testApiConnection().then(result => {
    if (result.success) {
      console.log('🎉 API Connection Test Passed!');
    } else {
      console.log('⚠️ API Connection Test Failed:', result.message);
    }
  });
}