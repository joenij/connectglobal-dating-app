#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 Starting ConnectGlobal Test Server with Sample Data');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Environment configuration
const ENV_CONFIG = {
  NODE_ENV: 'test',
  TEST_DATA_ENABLED: 'true',
  PORT: '8002',
  API_VERSION: 'v1',
  LOG_LEVEL: 'debug'
};

// Set environment variables
Object.entries(ENV_CONFIG).forEach(([key, value]) => {
  process.env[key] = value;
  console.log(`📝 ${key}=${value}`);
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Backend directory path
const backendDir = path.join(__dirname, '..', 'backend');

// Check if backend directory exists
if (!fs.existsSync(backendDir)) {
  console.error('❌ Backend directory not found:', backendDir);
  process.exit(1);
}

// Start the backend server
console.log('🚀 Starting backend server...');
console.log(`📁 Working directory: ${backendDir}`);
console.log(`🌐 Server will be available at: http://localhost:${ENV_CONFIG.PORT}`);
console.log(`📊 API Endpoint: http://localhost:${ENV_CONFIG.PORT}/api/v1`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const serverProcess = spawn('node', ['src/server.js'], {
  cwd: backendDir,
  stdio: 'inherit',
  env: { ...process.env, ...ENV_CONFIG }
});

// Handle process events
serverProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Backend server process exited with code ${code}`);
  } else {
    console.log('✅ Backend server stopped gracefully');
  }
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start backend server:', error);
});

// Handle graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Shutting down test server...`);
  serverProcess.kill();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Display helpful information
setTimeout(() => {
  console.log('\n💡 Test Server Information:');
  console.log('   • Environment: Test with Sample Data');
  console.log('   • Database: SQLite (in-memory test data)');
  console.log('   • Test Users: Auto-generated with realistic data');
  console.log('   • API Documentation: Check /health endpoint');
  console.log('\n🧪 Ready for testing the matching system!');
  console.log('   Use Ctrl+C to stop the server');
}, 2000);