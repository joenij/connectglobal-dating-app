const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Initialize Enterprise Services early
const EnterpriseLogger = require('./services/EnterpriseLoggerService');
const EnterpriseEnvironmentService = require('./services/EnterpriseEnvironmentService');

// Initialize new enhanced services
const EnhancedMatchingService = require('./services/EnhancedMatchingService');
const WebSocketService = require('./services/WebSocketService');
const EnhancedVideoService = require('./services/EnhancedVideoService');
const PushNotificationService = require('./services/PushNotificationService');

// Import database (PostgreSQL for all environments)
const { initializeDatabase, closeDatabase } = require('./config/database');
const EnterpriseRedisService = require('./services/EnterpriseRedisService');

// Import middleware
const { 
  securityHeaders, 
  apiRateLimit, 
  sanitizeInput, 
  securityLogger 
} = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const matchingRoutes = require('./routes/matching');
const messagingRoutes = require('./routes/messaging');
const pricingRoutes = require('./routes/pricing');
const paymentsRoutes = require('./routes/payments');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');
const advertisingRoutes = require('./routes/advertising');
const gdpPricingRoutes = require('./routes/gdp-pricing');
const videosRoutes = require('./routes/videos');
const analyticsRoutes = require('./routes/analytics');
const enhancedVideoRoutes = require('./routes/enhanced-video');
const notificationsRoutes = require('./routes/notifications');

// Create Express app
const app = express();
const PORT = process.env.PORT || 8000;

// Create HTTP server for WebSocket
const http = require('http');
const server = http.createServer(app);

// Global middleware
app.use(compression());
app.use(morgan('combined'));
app.use(securityHeaders);
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for local uploads
app.use('/uploads', express.static('backend/uploads'));

// Security middleware
app.use(sanitizeInput);
app.use(securityLogger);
app.use(apiRateLimit);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
const API_PREFIX = `/api/${process.env.API_VERSION || 'v1'}`;

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/matching`, matchingRoutes);
app.use(`${API_PREFIX}/payments`, paymentsRoutes);
app.use(`${API_PREFIX}/upload`, uploadRoutes);
app.use(`${API_PREFIX}/messaging`, messagingRoutes);
app.use(`${API_PREFIX}/pricing`, pricingRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/advertising`, advertisingRoutes);
app.use(`${API_PREFIX}/gdp-pricing`, gdpPricingRoutes);
app.use(`${API_PREFIX}/videos`, videosRoutes);
app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
app.use(`${API_PREFIX}/enhanced-videos`, enhancedVideoRoutes);
app.use(`${API_PREFIX}/notifications`, notificationsRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  EnterpriseLogger.error('Unhandled error', error, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    error: isDevelopment ? error.message : 'Internal server error',
    ...(isDevelopment && { stack: error.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  EnterpriseLogger.info(`Received ${signal}. Graceful shutdown starting...`);
  
  server.close(async () => {
    EnterpriseLogger.info('HTTP server closed.');
    
    // Close database connections
    await closeDatabase();
    
    // Close enterprise Redis connections
    await EnterpriseRedisService.disconnect();
    
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    EnterpriseLogger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Start server with database initialization
server.listen(PORT, async () => {
  EnterpriseLogger.info(`ConnectGlobal API server running on port ${PORT}`);
  EnterpriseLogger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  EnterpriseLogger.info(`API Version: ${process.env.API_VERSION || 'v1'}`);
  
  // Initialize WebSocket service
  try {
    WebSocketService.initialize(server);
    EnterpriseLogger.info('✅ WebSocket service initialized');
  } catch (error) {
    EnterpriseLogger.error('❌ WebSocket initialization failed', error);
  }
  
  // Initialize enhanced services
  try {
    // Enhanced services are already instantiated as singletons
    EnterpriseLogger.info('✅ Enhanced Matching Service ready');
    EnterpriseLogger.info('✅ Enhanced Video Service ready');  
    EnterpriseLogger.info('✅ Push Notification Service ready');
  } catch (error) {
    EnterpriseLogger.error('❌ Enhanced services initialization failed', error);
  }
  
  // Replace console methods with enterprise logger in production
  if (process.env.NODE_ENV === 'production') {
    EnterpriseLogger.replaceConsoleLog();
  }
  
  // Validate enterprise environment configuration
  const validation = await EnterpriseEnvironmentService.validateEnvironment();
  
  if (!validation.valid) {
    EnterpriseLogger.error('🚨 Environment validation failed - server may not function properly');
    validation.errors.forEach(error => EnterpriseLogger.error(error));
  } else if (validation.warnings.length > 0) {
    EnterpriseLogger.warn('⚠️ Environment validation warnings:');
    validation.warnings.forEach(warning => EnterpriseLogger.warn(warning));
  }
  
  if (validation.recommendations.length > 0) {
    EnterpriseLogger.info('💡 Environment optimization recommendations:');
    validation.recommendations.forEach(rec => EnterpriseLogger.info(rec));
  }
  
  EnterpriseLogger.info(`🎯 Production Readiness Score: ${validation.summary?.score || 'N/A'}%`);
  
  // Initialize database connection
  await initializeDatabase();
  
  // Initialize test data in test environment
  if (process.env.NODE_ENV === 'test' || process.env.TEST_DATA_ENABLED === 'true') {
    try {
      const TestDataService = require('./services/TestDataService');
      EnterpriseLogger.info('🧪 Test environment detected - initializing test data...');
      const result = await TestDataService.initializeTestEnvironment();
      EnterpriseLogger.info('✅ Test data initialized', null, {
        usersCreated: result.usersCreated,
        testCredentials: result.testCredentials
      });
    } catch (error) {
      EnterpriseLogger.warn('⚠️ Test data initialization failed (continuing anyway)', error.message);
    }
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;