const redis = require('redis');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.initialize();
  }

  async initialize() {
    try {
      // Redis configuration with fallback
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3,
      };

      this.client = redis.createClient({
        socket: {
          host: redisConfig.host,
          port: redisConfig.port,
        },
        password: redisConfig.password,
        database: redisConfig.db,
      });

      this.client.on('error', (err) => {
        console.warn('Redis connection error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      this.client.on('end', () => {
        console.log('Redis connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.warn('Redis initialization failed - using in-memory fallback:', error.message);
      this.client = null;
      this.isConnected = false;
    }
  }

  // TOKEN BLACKLISTING - Kritische Sicherheitsfunktion
  async blacklistToken(token, expiresInSeconds) {
    if (!this.isConnected) {
      // Fallback: in-memory storage (nicht ideal für Produktion)
      global.tokenBlacklist = global.tokenBlacklist || new Map();
      global.tokenBlacklist.set(token, Date.now() + (expiresInSeconds * 1000));
      return true;
    }

    try {
      const key = `blacklist:token:${token}`;
      await this.client.setEx(key, expiresInSeconds, 'blacklisted');
      return true;
    } catch (error) {
      console.error('Redis blacklist token error:', error);
      return false;
    }
  }

  async isTokenBlacklisted(token) {
    if (!this.isConnected) {
      // Fallback: check in-memory storage
      global.tokenBlacklist = global.tokenBlacklist || new Map();
      const expiry = global.tokenBlacklist.get(token);
      if (expiry && Date.now() < expiry) {
        return true;
      }
      if (expiry && Date.now() >= expiry) {
        global.tokenBlacklist.delete(token);
      }
      return false;
    }

    try {
      const key = `blacklist:token:${token}`;
      const result = await this.client.get(key);
      return result === 'blacklisted';
    } catch (error) {
      console.error('Redis check blacklist error:', error);
      return false;
    }
  }

  // PHONE VERIFICATION - Sicher mit Redis
  async storeVerificationCode(phoneNumber, code, expiresInSeconds = 600) {
    if (!this.isConnected) {
      // Fallback: in-memory (nicht empfohlen für Produktion)
      global.verificationCodes = global.verificationCodes || {};
      global.verificationCodes[phoneNumber] = {
        code,
        expiresAt: new Date(Date.now() + (expiresInSeconds * 1000)),
        attempts: 0
      };
      return true;
    }

    try {
      const key = `verification:phone:${phoneNumber}`;
      const data = JSON.stringify({
        code,
        attempts: 0,
        createdAt: Date.now()
      });
      await this.client.setEx(key, expiresInSeconds, data);
      return true;
    } catch (error) {
      console.error('Redis store verification error:', error);
      return false;
    }
  }

  async getVerificationCode(phoneNumber) {
    if (!this.isConnected) {
      // Fallback: in-memory
      global.verificationCodes = global.verificationCodes || {};
      return global.verificationCodes[phoneNumber] || null;
    }

    try {
      const key = `verification:phone:${phoneNumber}`;
      const result = await this.client.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('Redis get verification error:', error);
      return null;
    }
  }

  async incrementVerificationAttempts(phoneNumber) {
    if (!this.isConnected) {
      // Fallback: in-memory
      global.verificationCodes = global.verificationCodes || {};
      if (global.verificationCodes[phoneNumber]) {
        global.verificationCodes[phoneNumber].attempts++;
      }
      return true;
    }

    try {
      const key = `verification:phone:${phoneNumber}`;
      const data = await this.client.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        parsed.attempts = (parsed.attempts || 0) + 1;
        const ttl = await this.client.ttl(key);
        await this.client.setEx(key, ttl, JSON.stringify(parsed));
      }
      return true;
    } catch (error) {
      console.error('Redis increment attempts error:', error);
      return false;
    }
  }

  async deleteVerificationCode(phoneNumber) {
    if (!this.isConnected) {
      // Fallback: in-memory
      global.verificationCodes = global.verificationCodes || {};
      delete global.verificationCodes[phoneNumber];
      return true;
    }

    try {
      const key = `verification:phone:${phoneNumber}`;
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis delete verification error:', error);
      return false;
    }
  }

  // RATE LIMITING Support
  async incrementRateLimit(key, windowSeconds, maxRequests) {
    if (!this.isConnected) {
      return { count: 1, remaining: maxRequests - 1 }; // Erlauben ohne Redis
    }

    try {
      const pipeline = this.client.multi();
      pipeline.incr(key);
      pipeline.expire(key, windowSeconds);
      const results = await pipeline.exec();
      
      const count = results[0][1];
      const remaining = Math.max(0, maxRequests - count);
      
      return { count, remaining, blocked: count > maxRequests };
    } catch (error) {
      console.error('Redis rate limit error:', error);
      return { count: 1, remaining: maxRequests - 1 };
    }
  }

  // HEALTH CHECK
  async ping() {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  // Cleanup für graceful shutdown
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

module.exports = new RedisService();