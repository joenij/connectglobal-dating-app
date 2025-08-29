const rateLimit = require('express-rate-limit');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');
const helmet = require('helmet');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const EnterpriseRedisService = require('../services/EnterpriseRedisService');

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      // Basic XSS prevention - remove script tags and potentially harmful content
      return value
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=\s*["\'][^"\']*["\']/gi, '')
        .trim();
    } else if (typeof value === 'object' && value !== null) {
      const sanitized = {};
      for (const key in value) {
        sanitized[key] = sanitizeValue(value[key]);
      }
      return sanitized;
    }
    return value;
  };

  if (req.body) {
    req.body = sanitizeValue(req.body);
  }
  if (req.query) {
    req.query = sanitizeValue(req.query);
  }
  if (req.params) {
    req.params = sanitizeValue(req.params);
  }

  next();
};

// Advanced rate limiting with different tiers
const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = true) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    // Custom key generator to handle different user types
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise IP
      return req.user?.id || req.ip;
    },
    // Skip rate limiting for premium users on certain endpoints
    skip: (req) => {
      if (req.user?.subscriptionTier === 'elite') {
        return true;
      }
      return false;
    }
  });
};

// Different rate limits for different endpoints
const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts per window
  'Too many authentication attempts, please try again later.',
  false
);

const apiRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window for free users
  'Too many requests, please try again later.'
);

const uploadRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  10, // 10 uploads per hour
  'Upload limit exceeded, please try again later.'
);

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
});

// JWT token validation middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ENTERPRISE SECURITY: Token-Blacklisting mit Enterprise Redis
    const isBlacklisted = await EnterpriseRedisService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      console.warn('🛡️ Enterprise security: Blocked blacklisted token for user:', decoded.id);
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    req.user = decoded;
    req.token = token; // Für Logout-Funktion verfügbar machen
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    return res.status(403).json({ error: 'Token validation failed' });
  }
};

// Device fingerprinting middleware
const deviceFingerprint = (req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  const acceptLanguage = req.get('Accept-Language') || '';
  const acceptEncoding = req.get('Accept-Encoding') || '';
  const ip = req.ip;

  // Create a simple device fingerprint
  const fingerprintData = `${userAgent}|${acceptLanguage}|${acceptEncoding}|${ip}`;
  const fingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex');
  
  req.deviceFingerprint = fingerprint;
  next();
};

// Suspicious activity detection
const detectSuspiciousActivity = async (req, res, next) => {
  const { user, ip, deviceFingerprint } = req;
  
  if (!user) {
    return next();
  }

  // Check for impossible travel (basic implementation)
  // In production, this would query the database for recent logins
  const riskScore = 0; // Calculate based on various factors
  
  if (riskScore > 80) {
    // Log suspicious activity
    console.warn(`Suspicious activity detected for user ${user.id} from IP ${ip}`);
    
    // Could trigger additional verification steps
    req.suspicious = true;
  }
  
  next();
};

// File upload security
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm'
  ];

  const maxFileSize = 100 * 1024 * 1024; // 100MB

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  if (req.file.size > maxFileSize) {
    return res.status(400).json({ error: 'File too large' });
  }

  // Additional security checks would go here
  // - Virus scanning
  // - Image/video analysis
  // - Content moderation

  next();
};

// Enterprise request logging middleware
const securityLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log all API requests with enterprise logging
    EnterpriseLogger.request(req, res, duration);
    
    // Log security-relevant events
    if (req.user) {
      EnterpriseLogger.auth(`User activity: ${req.method} ${req.originalUrl}`, req.user.id, {
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }
    
    // Log suspicious activity
    if (res.statusCode === 401 || res.statusCode === 403) {
      EnterpriseLogger.security(`Access denied: ${req.method} ${req.originalUrl}`, {
        statusCode: res.statusCode,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id
      });
    }
  });
  
  next();
};

module.exports = {
  sanitizeInput,
  authRateLimit,
  apiRateLimit,
  uploadRateLimit,
  securityHeaders,
  authenticateToken,
  deviceFingerprint,
  detectSuspiciousActivity,
  validateFileUpload,
  securityLogger
};