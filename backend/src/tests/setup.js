const { jest } = require('@jest/globals');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.DATABASE_URL = ':memory:';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.API_VERSION = 'v1';

// Mock console methods for cleaner test output
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  // Suppress specific log messages during tests
  console.error = (...args) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('deprecated') ||
       message.includes('Warning:') ||
       message.includes('ExperimentalWarning'))
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  console.warn = (...args) => {
    const message = args[0];
    if (
      typeof message === 'string' &&
      (message.includes('deprecated') ||
       message.includes('ExperimentalWarning'))
    ) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  // Optionally suppress info logs in tests
  if (process.env.SUPPRESS_TEST_LOGS === 'true') {
    console.log = () => {};
  }
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Mock external dependencies
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn(),
    },
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    hGet: jest.fn(),
    hSet: jest.fn(),
    hDel: jest.fn(),
    hExists: jest.fn(),
    lPush: jest.fn(),
    lPop: jest.fn(),
    lRange: jest.fn(),
    sAdd: jest.fn(),
    sMembers: jest.fn(),
    sRem: jest.fn(),
    flushAll: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  })),
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: jest.fn().mockResolvedValue(true),
  })),
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue('test-salt'),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('test-jwt-token'),
  verify: jest.fn().mockReturnValue({ 
    userId: 'test-user-id', 
    email: 'test@example.com' 
  }),
  decode: jest.fn().mockReturnValue({ 
    userId: 'test-user-id', 
    email: 'test@example.com' 
  }),
}));

// Mock file upload dependencies
jest.mock('multer', () => {
  const multer = jest.fn(() => ({
    single: jest.fn(() => (req, res, next) => {
      req.file = {
        filename: 'test-file.jpg',
        originalname: 'test-file.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        path: '/tmp/test-file.jpg',
      };
      next();
    }),
    array: jest.fn(() => (req, res, next) => {
      req.files = [{
        filename: 'test-file.jpg',
        originalname: 'test-file.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        path: '/tmp/test-file.jpg',
      }];
      next();
    }),
  }));
  
  multer.diskStorage = jest.fn(() => ({}));
  multer.memoryStorage = jest.fn(() => ({}));
  
  return multer;
});

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    upload: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Location: 'https://test-bucket.s3.amazonaws.com/test-file.jpg',
        Key: 'test-file.jpg',
        Bucket: 'test-bucket',
      }),
    }),
    deleteObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({}),
    }),
    getSignedUrl: jest.fn().mockReturnValue('https://signed-url.com'),
  })),
  config: {
    update: jest.fn(),
  },
}));

// Global test utilities
global.testUtils = {
  // Create mock request object
  mockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      subscription_tier: 'free',
    },
    ...overrides,
  }),

  // Create mock response object
  mockResponse: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
  },

  // Mock next function
  mockNext: jest.fn(),

  // Create mock database query result
  mockQueryResult: (rows = [], rowCount = null) => ({
    rows,
    rowCount: rowCount !== null ? rowCount : rows.length,
    command: 'SELECT',
    fields: [],
  }),

  // Wait for async operations
  waitFor: async (conditionFn, timeout = 5000) => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const result = await conditionFn();
        if (result) return result;
      } catch (error) {
        // Continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  // Generate mock ad engagement data
  mockAdEngagement: (overrides = {}) => ({
    user_id: 'test-user-id',
    ad_network: 'admob',
    ad_type: 'banner',
    ad_unit_id: 'ca-app-pub-test',
    placement_location: 'home_screen',
    action: 'impression',
    reward_type: null,
    reward_amount: 0,
    revenue_usd: 0.01,
    session_id: 'test-session-id',
    user_subscription_tier: 'free',
    user_country_code: 'US',
    device_type: 'mobile',
    timestamp: new Date().toISOString(),
    ...overrides,
  }),

  // Generate mock user data
  mockUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    subscription_tier: 'free',
    country_code: 'US',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),

  // Generate mock video data
  mockVideo: (overrides = {}) => ({
    id: 'test-video-id',
    user_id: 'test-user-id',
    filename: 'test-video.mp4',
    duration: 30,
    size: 1024000,
    status: 'approved',
    created_at: new Date().toISOString(),
    ...overrides,
  }),
};

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase timeout for longer running tests
jest.setTimeout(15000);