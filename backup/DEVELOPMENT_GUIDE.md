# ConnectGlobal Development Guide

## 🚀 Getting Started

### Prerequisites Installation

1. **Node.js 18+**
   ```bash
   # Download from https://nodejs.org/
   node --version  # Should be 18+
   npm --version
   ```

2. **React Native Development Environment**
   ```bash
   npm install -g react-native-cli
   npm install -g @react-native-community/cli
   ```

3. **Database Setup**
   ```bash
   # Install PostgreSQL 15+
   # Windows: Download from https://www.postgresql.org/download/windows/
   # macOS: brew install postgresql
   # Ubuntu: sudo apt install postgresql postgresql-contrib
   
   # Install Redis
   # Windows: Download from https://github.com/tporadowski/redis/releases
   # macOS: brew install redis
   # Ubuntu: sudo apt install redis-server
   ```

4. **Mobile Development Tools**
   - **Android Studio** (for Android development)
   - **Xcode** (for iOS development, macOS only)

### Project Setup

1. **Clone and Install Dependencies**
   ```bash
   cd C:\Users\joerg\OneDrive\Dokumente\DatingApp
   npm install
   cd backend && npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env file with your configuration
   ```

3. **Database Setup**
   ```bash
   # Create database
   createdb connectglobal_dev
   
   # Run migrations
   psql -d connectglobal_dev -f backend/database/schema.sql
   ```

4. **Start Development Servers**
   ```bash
   # Terminal 1: Start backend
   npm run backend:dev
   
   # Terminal 2: Start React Native Metro
   npm start
   
   # Terminal 3: Start mobile app
   npm run android  # or npm run ios
   ```

## 📁 Project Architecture

### Frontend Structure (React Native)
```
src/
├── components/          # Reusable UI components
│   ├── common/         # Generic components (Button, Input, etc.)
│   ├── auth/           # Authentication components
│   ├── profile/        # Profile-related components
│   ├── matching/       # Matching interface components
│   └── messaging/      # Chat components
├── screens/            # App screens
│   ├── AuthScreens/    # Login, Register, Verification
│   ├── MainScreens/    # Home, Profile, Matches
│   └── SettingsScreens/# Settings, Preferences
├── navigation/         # Navigation configuration
├── redux/             # State management
│   └── slices/        # Redux Toolkit slices
├── services/          # API calls and external services
│   ├── api/           # REST API calls
│   ├── auth/          # Authentication service
│   ├── security/      # Security utilities
│   └── storage/       # Local storage utilities
└── utils/             # Helper functions
```

### Backend Structure (Node.js)
```
backend/
├── src/
│   ├── controllers/    # Request handlers
│   ├── models/        # Database models
│   ├── routes/        # API route definitions
│   ├── middleware/    # Custom middleware
│   ├── services/      # Business logic
│   └── utils/         # Helper functions
├── database/          # Database schemas and migrations
├── tests/            # Test files
└── scripts/          # Utility scripts
```

## 🔐 Security Implementation

### Key Security Features Implemented
1. **Input Sanitization**: All inputs are sanitized using DOMPurify
2. **Rate Limiting**: Different limits for different endpoint types
3. **JWT Authentication**: Secure token-based authentication
4. **Password Hashing**: bcrypt with 12 salt rounds
5. **Security Headers**: Helmet.js for security headers
6. **CORS Protection**: Configurable CORS policies

### Security Middleware Usage
```javascript
// In your routes
const { authenticateToken, uploadRateLimit } = require('../middleware/security');

router.post('/upload', authenticateToken, uploadRateLimit, (req, res) => {
  // Your upload logic here
});
```

## 🗄️ Database Operations

### Running Migrations
```bash
# Apply schema
psql -d connectglobal_dev -f backend/database/schema.sql

# For production
psql -d connectglobal_prod -f backend/database/schema.sql
```

### Key Tables
- `users`: Core user data and authentication
- `user_profiles`: Detailed profile information
- `user_matches`: Matching system data
- `messages`: Encrypted messaging
- `pricing_tiers`: Dynamic pricing configuration
- `security_logs`: Security event tracking

## 🧪 Testing Strategy

### Unit Testing
```bash
# Frontend tests
npm test

# Backend tests
cd backend && npm test

# Watch mode
npm run test:watch
```

### Integration Testing
```bash
# API integration tests
cd backend && npm run test:integration
```

### End-to-End Testing
```bash
# Full app testing
npm run test:e2e
```

## 📱 Mobile Development

### Running on Devices

**Android:**
```bash
# List connected devices
adb devices

# Run on specific device
npx react-native run-android --deviceId=<device-id>
```

**iOS:**
```bash
# List simulators
xcrun simctl list devices

# Run on specific simulator
npx react-native run-ios --simulator="iPhone 14 Pro"
```

### Building for Production

**Android:**
```bash
# Generate signed APK
cd android
./gradlew assembleRelease

# Generate AAB for Play Store
./gradlew bundleRelease
```

**iOS:**
```bash
# Build for App Store
cd ios
xcodebuild -workspace ConnectGlobal.xcworkspace -scheme ConnectGlobal -configuration Release archive
```

## 🌐 API Development

### Adding New Endpoints
1. Create controller in `backend/src/controllers/`
2. Add route in `backend/src/routes/`
3. Update validation middleware
4. Add tests
5. Update API documentation

### Example API Endpoint
```javascript
// backend/src/routes/example.js
const express = require('express');
const { authenticateToken } = require('../middleware/security');
const router = express.Router();

router.get('/protected-endpoint', authenticateToken, async (req, res) => {
  try {
    // Your logic here
    res.json({ message: 'Success', user: req.user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

## 🔧 Configuration Management

### Environment Variables
- Copy `.env.example` to `.env`
- Never commit `.env` files
- Use different `.env` files for different environments
- Validate required environment variables on startup

### Feature Flags
```javascript
// Enable/disable features via environment variables
const FEATURES = {
  VIDEO_VERIFICATION: process.env.ENABLE_VIDEO_VERIFICATION === 'true',
  DEEPFAKE_DETECTION: process.env.ENABLE_DEEPFAKE_DETECTION === 'true',
  DISASTER_PRICING: process.env.ENABLE_DISASTER_PRICING === 'true'
};
```

## 📊 Monitoring and Logging

### Logging Strategy
- Use structured logging (JSON format)
- Different log levels (error, warn, info, debug)
- Separate logs for security events
- Centralized logging for production

### Performance Monitoring
```javascript
// Add performance monitoring to critical functions
const start = Date.now();
// Your function logic
const duration = Date.now() - start;
console.log(`Function executed in ${duration}ms`);
```

## 🚀 Deployment

### Development Environment
```bash
# Start all services locally
docker-compose -f docker-compose.dev.yml up
```

### Production Deployment
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## 📝 Code Style and Standards

### ESLint Configuration
- Follow Airbnb style guide
- Custom rules for React Native
- Automatic formatting with Prettier

### Git Workflow
1. Create feature branch from `develop`
2. Make changes with descriptive commits
3. Run tests and linting
4. Create pull request
5. Code review and merge

### Commit Message Format
```
type(scope): description

Examples:
feat(auth): add phone verification
fix(security): resolve XSS vulnerability
docs(api): update authentication endpoints
```

## 🐛 Troubleshooting

### Common Issues

**Metro bundler issues:**
```bash
npx react-native start --reset-cache
```

**Database connection issues:**
- Check PostgreSQL is running
- Verify connection string in `.env`
- Check firewall settings

**Build failures:**
- Clean build folders: `npm run clean`
- Clear node_modules: `rm -rf node_modules && npm install`
- Reset React Native cache: `npx react-native start --reset-cache`

### Debug Tools
- React Native Debugger
- Flipper for mobile debugging
- PostgreSQL logs for database issues
- Browser network tab for API debugging

## 📚 Additional Resources

- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redux Toolkit Guide](https://redux-toolkit.js.org/introduction/getting-started)

## 🤝 Contributing

1. Read the contributing guidelines
2. Set up development environment
3. Run tests to ensure everything works
4. Make changes following code standards
5. Submit pull request with detailed description

For questions or issues, create a GitHub issue or contact the development team.