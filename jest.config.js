module.exports = {
  preset: 'react-native',
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.{js,jsx,ts,tsx}',
    '**/?(*.)+(spec|test).{js,jsx,ts,tsx}',
    '**/tests/**/*.{js,jsx,ts,tsx}'
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Transform files
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },

  // Module name mapping for absolute imports and assets
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'identity-obj-proxy',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/tests/setup.ts',
    '@testing-library/jest-native/extend-expect'
  ],

  // Test environment
  testEnvironment: 'jsdom',

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/tests/**',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx,js,jsx}',
    '!src/**/*.spec.{ts,tsx,js,jsx}',
    '!src/index.{ts,tsx,js,jsx}',
    '!src/App.{ts,tsx,js,jsx}',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/services/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    './src/components/': {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Handle ES modules
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-google-mobile-ads|react-native-encrypted-storage|react-native-vector-icons|react-native-elements)/)',
  ],

  // Global setup
  globalSetup: '<rootDir>/src/tests/globalSetup.js',
  globalTeardown: '<rootDir>/src/tests/globalTeardown.js',

  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],

  // Max worker processes
  maxWorkers: '50%',

  // Cache directory
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',

  // Error handling
  errorOnDeprecated: true,

  // Test result processing
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'jest-results.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: true,
      },
    ],
    [
      'jest-html-reporters',
      {
        publicPath: './test-results',
        filename: 'jest-report.html',
        expand: true,
        hideIcon: false,
      },
    ],
  ],

  // Mock modules
  modulePathIgnorePatterns: [
    '<rootDir>/backend/',
    '<rootDir>/ios/',
    '<rootDir>/android/',
  ],

  // Additional Jest options for React Native
  globals: {
    __DEV__: true,
  },

  // Snapshot serializers
  snapshotSerializers: [
    '@testing-library/jest-native/serializer',
  ],
};