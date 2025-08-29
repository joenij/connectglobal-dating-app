const redis = require('redis');
const EnterpriseLogger = require('./EnterpriseLoggerService');

class EnterpriseRedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.fallbackMode = false;
    this.initialize();
  }

  async initialize() {
    try {
      // Enterprise Redis Configuration with Free Tier Support
      const redisConfig = {
        // Redis Labs Free Tier Configuration
        url: process.env.REDIS_URL, // redis://user:password@host:port
        // Alternative configuration
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
        },
        password: process.env.REDIS_PASSWORD,
        database: process.env.REDIS_DB || 0,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true
      };

      // Create Redis client based on available configuration
      if (process.env.REDIS_URL) {
        this.client = redis.createClient({ url: process.env.REDIS_URL });
      } else if (process.env.REDIS_HOST) {
        this.client = redis.createClient(redisConfig);
      } else {
        console.warn('⚠️ ENTERPRISE WARNING: No Redis configuration found. Using Redis Labs Free Tier setup.');
        this.setupRedisLabsFree();
        return;
      }

      this.client.on('error', (err) => {
        console.error('❌ Redis Enterprise connection error:', err.message);
        this.isConnected = false;
        this.enableFallbackMode();
      });

      this.client.on('connect', () => {
        console.log('✅ Enterprise Redis connected successfully');
        this.isConnected = true;
        this.fallbackMode = false;
      });

      this.client.on('ready', () => {
        console.log('🚀 Enterprise Redis ready for production');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        console.log('⚠️ Enterprise Redis connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error('❌ Enterprise Redis initialization failed:', error.message);
      this.enableFallbackMode();
    }
  }

  setupRedisLabsFree() {
    console.log(`
🎯 ENTERPRISE REDIS SETUP GUIDE:
=================================

Option 1: Redis Labs Free Tier (RECOMMENDED)
1. Visit: https://redis.com/try-free/
2. Create free account (30MB RAM, perfect for tokens)
3. Get connection details:
   - Host: redis-xxxxx.redislabs.com
   - Port: 17389
   - Password: your-password

Environment Variables:
REDIS_URL=redis://default:YOUR_PASSWORD@redis-xxxxx.redislabs.com:17389

Option 2: Upstash Redis (Alternative)
1. Visit: https://upstash.com/
2. Create free account (10k commands/day)
3. Set REDIS_URL from dashboard

Option 3: Local Docker (Development)
1. Ensure docker-compose.yml Redis service is running
2. Set: REDIS_HOST=localhost REDIS_PORT=6379

🚨 CRITICAL: Token blacklisting requires persistent Redis!
    `);
    
    this.enableFallbackMode();
  }

  enableFallbackMode() {
    this.fallbackMode = true;
    console.warn(`
⚠️ ENTERPRISE FALLBACK MODE ACTIVATED
=====================================
Redis unavailable - using secure fallback storage.
🔴 WARNING: This is NOT recommended for production!
🔧 Setup enterprise Redis to resolve this warning.
    `);
  }

  // ENTERPRISE TOKEN BLACKLISTING - Critical Security Feature
  async blacklistToken(token, expiresInSeconds) {
    if (!this.isConnected) {
      console.warn('🔴 SECURITY WARNING: Token blacklisting using fallback storage');
      return this.fallbackBlacklistToken(token, expiresInSeconds);
    }

    try {
      const key = `enterprise:blacklist:${token}`;
      await this.client.setEx(key, expiresInSeconds, JSON.stringify({
        timestamp: Date.now(),
        reason: 'logout',
        enterprise: true
      }));
      console.log(`✅ Enterprise token blacklisted: ${token.substring(0, 20)}...`);
      return true;
    } catch (error) {
      console.error('❌ Enterprise token blacklist error:', error);
      return this.fallbackBlacklistToken(token, expiresInSeconds);
    }
  }

  async isTokenBlacklisted(token) {
    if (!this.isConnected) {
      return this.fallbackCheckBlacklist(token);
    }

    try {
      const key = `enterprise:blacklist:${token}`;
      const result = await this.client.get(key);
      const isBlacklisted = result !== null;
      
      if (isBlacklisted) {
        console.log(`🛡️ Enterprise security: Blocked blacklisted token`);
      }
      
      return isBlacklisted;
    } catch (error) {
      console.error('❌ Enterprise blacklist check error:', error);
      return this.fallbackCheckBlacklist(token);
    }
  }

  // ENTERPRISE PHONE VERIFICATION - Secure with Redis
  async storeVerificationCode(phoneNumber, code, expiresInSeconds = 600) {
    if (!this.isConnected) {
      console.warn('🔴 SECURITY WARNING: Verification codes using fallback storage');
      return this.fallbackStoreVerification(phoneNumber, code, expiresInSeconds);
    }

    try {
      const key = `enterprise:verification:${phoneNumber}`;
      const data = JSON.stringify({
        code: code,
        attempts: 0,
        createdAt: Date.now(),
        enterprise: true,
        securityLevel: 'high'
      });
      
      await this.client.setEx(key, expiresInSeconds, data);
      console.log(`✅ Enterprise verification stored for: ${phoneNumber.substring(0, 5)}***`);
      return true;
    } catch (error) {
      console.error('❌ Enterprise verification storage error:', error);
      return this.fallbackStoreVerification(phoneNumber, code, expiresInSeconds);
    }
  }

  async getVerificationCode(phoneNumber) {
    if (!this.isConnected) {
      return this.fallbackGetVerification(phoneNumber);
    }

    try {
      const key = `enterprise:verification:${phoneNumber}`;
      const result = await this.client.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('❌ Enterprise verification get error:', error);
      return this.fallbackGetVerification(phoneNumber);
    }
  }

  async incrementVerificationAttempts(phoneNumber) {
    if (!this.isConnected) {
      return this.fallbackIncrementAttempts(phoneNumber);
    }

    try {
      const key = `enterprise:verification:${phoneNumber}`;
      const data = await this.client.get(key);
      
      if (data) {
        const parsed = JSON.parse(data);
        parsed.attempts = (parsed.attempts || 0) + 1;
        parsed.lastAttempt = Date.now();
        
        const ttl = await this.client.ttl(key);
        if (ttl > 0) {
          await this.client.setEx(key, ttl, JSON.stringify(parsed));
        }
        
        console.log(`⚠️ Enterprise security: Verification attempt ${parsed.attempts} for ${phoneNumber.substring(0, 5)}***`);
      }
      return true;
    } catch (error) {
      console.error('❌ Enterprise verification increment error:', error);
      return this.fallbackIncrementAttempts(phoneNumber);
    }
  }

  async deleteVerificationCode(phoneNumber) {
    if (!this.isConnected) {
      return this.fallbackDeleteVerification(phoneNumber);
    }

    try {
      const key = `enterprise:verification:${phoneNumber}`;
      await this.client.del(key);
      console.log(`✅ Enterprise verification cleaned for: ${phoneNumber.substring(0, 5)}***`);
      return true;
    } catch (error) {
      console.error('❌ Enterprise verification delete error:', error);
      return this.fallbackDeleteVerification(phoneNumber);
    }
  }

  // ENTERPRISE SESSION MANAGEMENT
  async storeUserSession(userId, sessionData, expiresInSeconds = 86400) {
    if (!this.isConnected) {
      console.warn('🔴 WARNING: Session storage using fallback');
      return false;
    }

    try {
      const key = `enterprise:session:${userId}`;
      const data = JSON.stringify({
        ...sessionData,
        createdAt: Date.now(),
        enterprise: true
      });
      
      await this.client.setEx(key, expiresInSeconds, data);
      return true;
    } catch (error) {
      console.error('❌ Enterprise session storage error:', error);
      return false;
    }
  }

  async getUserSession(userId) {
    if (!this.isConnected) return null;

    try {
      const key = `enterprise:session:${userId}`;
      const result = await this.client.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('❌ Enterprise session get error:', error);
      return null;
    }
  }

  // ENTERPRISE RATE LIMITING
  async incrementRateLimit(identifier, windowSeconds, maxRequests) {
    if (!this.isConnected) {
      console.warn('🔴 WARNING: Rate limiting using basic fallback');
      return { count: 1, remaining: maxRequests - 1, blocked: false };
    }

    try {
      const key = `enterprise:ratelimit:${identifier}`;
      const pipeline = this.client.multi();
      
      pipeline.incr(key);
      pipeline.expire(key, windowSeconds);
      
      const results = await pipeline.exec();
      const count = results[0][1];
      const remaining = Math.max(0, maxRequests - count);
      const blocked = count > maxRequests;
      
      if (blocked) {
        console.warn(`🛡️ Enterprise rate limit exceeded for: ${identifier}`);
      }
      
      return { count, remaining, blocked };
    } catch (error) {
      console.error('❌ Enterprise rate limit error:', error);
      return { count: 1, remaining: maxRequests - 1, blocked: false };
    }
  }

  // ENTERPRISE REFRESH TOKEN MANAGEMENT
  async storeRefreshToken(userId, refreshToken, expiresInSeconds) {
    if (!this.isConnected) {
      console.warn('🔴 SECURITY WARNING: Refresh token storage using fallback storage');
      return this.fallbackStoreRefreshToken(userId, refreshToken, expiresInSeconds);
    }

    try {
      const key = `enterprise:refresh:${userId}`;
      await this.client.setEx(key, expiresInSeconds, JSON.stringify({
        token: refreshToken,
        timestamp: Date.now(),
        enterprise: true,
        userId
      }));
      EnterpriseLogger.info('Enterprise refresh token stored', userId, {
        tokenLength: refreshToken.length,
        expiresIn: expiresInSeconds
      });
      return true;
    } catch (error) {
      EnterpriseLogger.error('Enterprise refresh token storage error', error);
      return this.fallbackStoreRefreshToken(userId, refreshToken, expiresInSeconds);
    }
  }

  async getRefreshToken(userId) {
    if (!this.isConnected) {
      return this.fallbackGetRefreshToken(userId);
    }

    try {
      const key = `enterprise:refresh:${userId}`;
      const result = await this.client.get(key);
      
      if (result) {
        const data = JSON.parse(result);
        return data.token;
      }
      
      return null;
    } catch (error) {
      EnterpriseLogger.error('Enterprise refresh token retrieval error', error);
      return this.fallbackGetRefreshToken(userId);
    }
  }

  async revokeRefreshToken(userId) {
    if (!this.isConnected) {
      return this.fallbackRevokeRefreshToken(userId);
    }

    try {
      const key = `enterprise:refresh:${userId}`;
      const deleted = await this.client.del(key);
      
      EnterpriseLogger.security('Enterprise refresh token revoked', {
        userId,
        deleted: deleted > 0
      });
      
      return deleted > 0;
    } catch (error) {
      EnterpriseLogger.error('Enterprise refresh token revocation error', error);
      return this.fallbackRevokeRefreshToken(userId);
    }
  }

  // SECURE FALLBACK IMPLEMENTATIONS (In-Memory with Warnings)
  fallbackBlacklistToken(token, expiresInSeconds) {
    global.enterpriseTokenBlacklist = global.enterpriseTokenBlacklist || new Map();
    const expiry = Date.now() + (expiresInSeconds * 1000);
    global.enterpriseTokenBlacklist.set(token, expiry);
    
    // Cleanup expired tokens periodically
    this.cleanupExpiredFallbackTokens();
    return true;
  }

  fallbackCheckBlacklist(token) {
    global.enterpriseTokenBlacklist = global.enterpriseTokenBlacklist || new Map();
    const expiry = global.enterpriseTokenBlacklist.get(token);
    
    if (expiry && Date.now() < expiry) {
      return true;
    }
    
    if (expiry && Date.now() >= expiry) {
      global.enterpriseTokenBlacklist.delete(token);
    }
    
    return false;
  }

  fallbackStoreVerification(phoneNumber, code, expiresInSeconds) {
    global.enterpriseVerificationCodes = global.enterpriseVerificationCodes || {};
    global.enterpriseVerificationCodes[phoneNumber] = {
      code,
      attempts: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + (expiresInSeconds * 1000),
      enterprise: true
    };
    return true;
  }

  fallbackGetVerification(phoneNumber) {
    global.enterpriseVerificationCodes = global.enterpriseVerificationCodes || {};
    const data = global.enterpriseVerificationCodes[phoneNumber];
    
    if (data && Date.now() > data.expiresAt) {
      delete global.enterpriseVerificationCodes[phoneNumber];
      return null;
    }
    
    return data || null;
  }

  fallbackIncrementAttempts(phoneNumber) {
    global.enterpriseVerificationCodes = global.enterpriseVerificationCodes || {};
    if (global.enterpriseVerificationCodes[phoneNumber]) {
      global.enterpriseVerificationCodes[phoneNumber].attempts++;
    }
    return true;
  }

  fallbackDeleteVerification(phoneNumber) {
    global.enterpriseVerificationCodes = global.enterpriseVerificationCodes || {};
    delete global.enterpriseVerificationCodes[phoneNumber];
    return true;
  }

  cleanupExpiredFallbackTokens() {
    if (!global.enterpriseTokenBlacklist) return;
    
    const now = Date.now();
    for (const [token, expiry] of global.enterpriseTokenBlacklist.entries()) {
      if (now >= expiry) {
        global.enterpriseTokenBlacklist.delete(token);
      }
    }
  }

  fallbackStoreRefreshToken(userId, refreshToken, expiresInSeconds) {
    global.enterpriseRefreshTokens = global.enterpriseRefreshTokens || new Map();
    const expiry = Date.now() + (expiresInSeconds * 1000);
    global.enterpriseRefreshTokens.set(userId.toString(), {
      token: refreshToken,
      expiry,
      timestamp: Date.now()
    });
    return true;
  }

  fallbackGetRefreshToken(userId) {
    global.enterpriseRefreshTokens = global.enterpriseRefreshTokens || new Map();
    const data = global.enterpriseRefreshTokens.get(userId.toString());
    
    if (data && Date.now() < data.expiry) {
      return data.token;
    }
    
    if (data && Date.now() >= data.expiry) {
      global.enterpriseRefreshTokens.delete(userId.toString());
    }
    
    return null;
  }

  fallbackRevokeRefreshToken(userId) {
    global.enterpriseRefreshTokens = global.enterpriseRefreshTokens || new Map();
    const deleted = global.enterpriseRefreshTokens.delete(userId.toString());
    return deleted;
  }

  // HEALTH CHECK
  async ping() {
    if (!this.isConnected) {
      return { status: 'fallback', enterprise: false };
    }

    try {
      await this.client.ping();
      return { status: 'connected', enterprise: true };
    } catch (error) {
      return { status: 'error', enterprise: false, error: error.message };
    }
  }

  // GRACEFUL SHUTDOWN
  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        console.log('✅ Enterprise Redis disconnected gracefully');
      } catch (error) {
        console.error('❌ Enterprise Redis disconnect error:', error);
      }
    }
    this.isConnected = false;
  }

  // ENTERPRISE ANALYTICS CACHE
  async cacheAnalyticsData(key, data, expiresInSeconds = 3600) {
    if (!this.isConnected) return false;

    try {
      const cacheKey = `enterprise:analytics:${key}`;
      await this.client.setEx(cacheKey, expiresInSeconds, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('❌ Enterprise analytics cache error:', error);
      return false;
    }
  }

  async getCachedAnalyticsData(key) {
    if (!this.isConnected) return null;

    try {
      const cacheKey = `enterprise:analytics:${key}`;
      const result = await this.client.get(cacheKey);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('❌ Enterprise analytics get error:', error);
      return null;
    }
  }
}

module.exports = new EnterpriseRedisService();