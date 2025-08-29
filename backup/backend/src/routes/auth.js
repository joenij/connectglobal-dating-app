const express = require('express');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { authRateLimit, authenticateToken } = require('../middleware/security');
const User = require('../models/User');
const EnterpriseSMSService = require('../services/EnterpriseSMSService');
const EnterpriseRedisService = require('../services/EnterpriseRedisService');
const EnterpriseSecureSMTPService = require('../services/EnterpriseSecureSMTPService');
const EnterpriseGDPAgentService = require('../services/EnterpriseGDPAgentService');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('phoneNumber').matches(/^\+?[\d\s\-\(\)]+$/).isLength({ min: 10, max: 15 }),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  body('firstName').isLength({ min: 1, max: 100 }).trim(),
  body('lastName').isLength({ min: 1, max: 100 }).trim(),
  body('dateOfBirth').isISO8601(),
  body('gender').isIn(['male', 'female', 'non-binary', 'other']),
  body('countryCode').isLength({ min: 2, max: 2 })
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// POST /api/v1/auth/register
router.post('/register', authRateLimit, registerValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      email,
      phoneNumber,
      password,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      countryCode
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Determine GDP pricing tier based on country using real-time GDP agent
    let gdpPricingTier = 3; // Default fallback
    try {
      const gdpData = await EnterpriseGDPAgentService.fetchGDPDataForCountry(countryCode);
      if (gdpData && gdpData.calculated_tier) {
        gdpPricingTier = gdpData.calculated_tier;
      }
    } catch (error) {
      EnterpriseLogger.warn('GDP pricing tier determination failed, using default', { countryCode, error: error.message });
    }

    // Create user in database
    const newUser = await User.create({
      email,
      phoneNumber,
      passwordHash,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      countryCode,
      gdpPricingTier,
    });

    // Send phone verification SMS
    const smsResult = await EnterpriseSMSService.sendVerificationCode(phoneNumber);
    
    // Store verification code in Redis
    if (smsResult.success) {
      await EnterpriseRedisService.storeVerificationCode(
        phoneNumber, 
        smsResult.verificationCode, 
        600 // 10 minutes
      );
    }

    // Send email verification
    const crypto = require('crypto');
    const emailToken = crypto.randomBytes(32).toString('hex');
    await EnterpriseRedisService.storeVerificationCode(
      `email:${email}`,
      emailToken,
      86400 // 24 hours
    );
    
    await EnterpriseSecureSMTPService.sendVerificationEmail(email, emailToken, firstName);

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        isPhoneVerified: false,
        isEmailVerified: false,
        verificationStep: 'phone'
      }
    });

  } catch (error) {
    EnterpriseLogger.error('Registration failed', error, { email, ip: req.ip });
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/v1/auth/login
router.post('/login', authRateLimit, loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isPasswordValid = await User.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is active/not banned
    if (!user.is_active || user.is_banned) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Update last active timestamp
    await User.updateLastActive(user.id);

    // Generate JWT tokens
    const payload = {
      id: user.id,
      email: user.email,
      subscriptionTier: user.subscription_tier
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    });

    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    });

    // Store refresh token in Redis with expiry
    await EnterpriseRedisService.storeRefreshToken(
      user.id, 
      refreshToken, 
      7 * 24 * 60 * 60 // 7 days in seconds
    );

    // Log security event
    EnterpriseLogger.security('User login successful', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        subscriptionTier: user.subscription_tier,
        isVerified: true
      },
      tokens: {
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    EnterpriseLogger.error('Login failed', error, { email, ip: req.ip });
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Check if refresh token exists in Redis
    const storedToken = await EnterpriseRedisService.getRefreshToken(decoded.id);
    if (!storedToken || storedToken !== refreshToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { id: decoded.id, email: decoded.email, subscriptionTier: decoded.subscriptionTier },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    res.json({
      accessToken: newAccessToken
    });

  } catch (error) {
    EnterpriseLogger.error('Token refresh failed', error, { ip: req.ip });
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Invalidate refresh token
    await EnterpriseRedisService.revokeRefreshToken(req.user.id);

    // Add access token to blacklist (Redis)
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.decode(token);
      const remainingSeconds = decoded.exp - Math.floor(Date.now() / 1000);
      if (remainingSeconds > 0) {
        await EnterpriseRedisService.blacklistToken(token, remainingSeconds);
      }
    }

    res.json({ message: 'Logout successful' });

  } catch (error) {
    EnterpriseLogger.error('Logout error', error, { userId: req.user?.id, ip: req.ip });
    res.status(500).json({ error: 'Logout failed' });
  }
});

// POST /api/v1/auth/verify-phone
router.post('/verify-phone', async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({ error: 'Phone number and code required' });
    }

    // Verify SMS code using Redis
    const storedData = await EnterpriseRedisService.getVerificationCode(phoneNumber);
    if (!storedData || storedData.code.toString() !== code.toString()) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Update user verification status
    const user = await User.findByPhone(phoneNumber);
    if (user) {
      await User.updateProfile(user.id, { is_phone_verified: true });
    }
    
    // Clean up verification code
    await EnterpriseRedisService.deleteVerificationCode(phoneNumber);

    res.json({
      message: 'Phone verification successful',
      nextStep: 'email_verification'
    });

  } catch (error) {
    EnterpriseLogger.error('Phone verification error', error, { phoneNumber, ip: req.ip });
    res.status(500).json({ error: 'Phone verification failed' });
  }
});


// Send phone verification code
router.post('/send-verification', [
  authRateLimit,
  body('phoneNumber').isMobilePhone().withMessage('Valid phone number required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phoneNumber } = req.body;

    // Check if phone number is already verified
    const existingUser = await User.findByPhone(phoneNumber);
    if (existingUser && existingUser.is_phone_verified) {
      return res.status(400).json({ error: 'Phone number already verified' });
    }

    // Send verification code
    const result = await EnterpriseSMSService.sendVerificationCode(phoneNumber);
    
    // ENTERPRISE SECURITY: Redis-basierte Speicherung mit Enterprise Service
    const stored = await EnterpriseRedisService.storeVerificationCode(
      phoneNumber, 
      result.verificationCode, 
      600 // 10 minutes
    );

    if (!stored) {
      return res.status(500).json({ error: 'Failed to store verification code' });
    }

    res.json({
      success: true,
      message: 'Verification code sent',
      expiresAt: result.expiresAt
    });

  } catch (error) {
    EnterpriseLogger.error('Verification code sending failed', error, { phoneNumber, ip: req.ip });
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Verify phone number
router.post('/verify-phone', [
  authRateLimit,
  body('phoneNumber').isMobilePhone().withMessage('Valid phone number required'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('6-digit code required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { phoneNumber, code } = req.body;

    // ENTERPRISE SECURITY: Redis-basierte Verification mit Enterprise Service
    const storedData = await EnterpriseRedisService.getVerificationCode(phoneNumber);

    if (!storedData) {
      return res.status(400).json({ error: 'No verification code sent for this number' });
    }

    // Check expiration (Redis TTL handles this, but double-check)
    const codeAge = Date.now() - storedData.createdAt;
    if (codeAge > 600000) { // 10 minutes
      await EnterpriseRedisService.deleteVerificationCode(phoneNumber);
      return res.status(400).json({ error: 'Verification code expired' });
    }

    // Check attempts
    if (storedData.attempts >= 3) {
      await EnterpriseRedisService.deleteVerificationCode(phoneNumber);
      return res.status(400).json({ error: 'Too many failed attempts' });
    }

    // Verify code
    if (storedData.code.toString() !== code.toString()) {
      await EnterpriseRedisService.incrementVerificationAttempts(phoneNumber);
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Mark phone as verified
    const user = await User.findByPhone(phoneNumber);
    if (user) {
      await User.updateProfile(user.id, { is_phone_verified: true });
    }

    // Clean up verification code
    await EnterpriseRedisService.deleteVerificationCode(phoneNumber);

    res.json({
      success: true,
      message: 'Phone number verified successfully'
    });

  } catch (error) {
    EnterpriseLogger.error('Phone verification failed', error, { phoneNumber, ip: req.ip });
    res.status(500).json({ error: 'Failed to verify phone number' });
  }
});

// SICHERHEITSVERBESSERUNG: Sichere Logout-Funktion mit Token-Blacklisting
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.token;
    const decoded = req.user;

    // Token auf Blacklist setzen für die verbleibende Zeit
    const tokenExp = decoded.exp;
    const currentTime = Math.floor(Date.now() / 1000);
    const remainingSeconds = tokenExp - currentTime;

    if (remainingSeconds > 0) {
      const blacklisted = await EnterpriseRedisService.blacklistToken(token, remainingSeconds);
      if (!blacklisted) {
        EnterpriseLogger.error('Failed to blacklist token on logout', null, {
          userId: req.user?.id,
          ip: req.ip
        });
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    EnterpriseLogger.error('Logout failed', error, { userId: req.user?.id, ip: req.ip });
    res.status(500).json({ error: 'Logout failed' });
  }
});

// ENTERPRISE EMAIL VERIFICATION ENDPOINTS

// Send email verification
router.post('/send-email-verification', [
  authRateLimit,
  body('email').isEmail().normalizeEmail().withMessage('Valid email required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Check if email exists and is not already verified
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.is_email_verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate email verification token
    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Store verification token in Redis (24-hour expiry)
    const stored = await EnterpriseRedisService.storeVerificationCode(
      `email:${email}`,
      verificationToken,
      86400 // 24 hours
    );

    if (!stored) {
      return res.status(500).json({ error: 'Failed to generate verification token' });
    }

    // Send verification email with enterprise security
    const result = await EnterpriseSecureSMTPService.sendVerificationEmail(email, verificationToken, user.first_name || 'User');

    if (result.success) {
      EnterpriseLogger.info('Email verification sent', null, {
        email: email.replace(/(.{3}).*(@.*)/, '$1***$2'),
        provider: result.provider,
        messageId: result.messageId
      });

      res.json({
        success: true,
        message: 'Email verification sent',
        expiresIn: '24 hours'
      });
    } else {
      res.status(500).json({ error: 'Failed to send verification email' });
    }

  } catch (error) {
    EnterpriseLogger.error('Email verification sending failed', error, {
      email: req.body.email,
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to send email verification' });
  }
});

// Verify email address
router.post('/verify-email', [
  authRateLimit,
  body('token').isLength({ min: 64, max: 64 }).withMessage('Valid verification token required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token } = req.body;

    // Find the email associated with this token in Redis
    // Note: This is a simplified approach - in production, you'd store the mapping
    const storedData = await EnterpriseRedisService.getVerificationCode(`email:token:${token}`);

    if (!storedData) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    const email = storedData.email;
    
    // Mark email as verified
    const user = await User.findByEmail(email);
    if (user) {
      await User.updateProfile(user.id, { is_email_verified: true });
      
      // Clean up verification token
      await EnterpriseRedisService.deleteVerificationCode(`email:${email}`);
      
      // Send welcome email with enterprise security
      await EnterpriseSecureSMTPService.sendWelcomeEmail(email, user.first_name);
      
      EnterpriseLogger.auth('Email verified successfully', user.id, {
        email: email.replace(/(.{3}).*(@.*)/, '$1***$2'),
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Email verified successfully'
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }

  } catch (error) {
    EnterpriseLogger.error('Email verification failed', error, {
      token: req.body.token?.substring(0, 8) + '...',
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// Password reset request
router.post('/forgot-password', [
  authRateLimit,
  body('email').isEmail().normalizeEmail().withMessage('Valid email required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Find user (but don't reveal if email exists for security)
    const user = await User.findByEmail(email);
    
    if (user) {
      // Generate reset token
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');

      // Store reset token in Redis (1-hour expiry)
      const stored = await EnterpriseRedisService.storeVerificationCode(
        `reset:${email}`,
        resetToken,
        3600 // 1 hour
      );

      if (stored) {
        // Send password reset email with enterprise security
        const result = await EnterpriseSecureSMTPService.sendPasswordResetEmail(
          email,
          resetToken,
          user.first_name
        );

        if (result.success) {
          EnterpriseLogger.security('Password reset requested', {
            email: email.replace(/(.{3}).*(@.*)/, '$1***$2'),
            userId: user.id,
            ip: req.ip
          });
        }
      }
    }

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });

  } catch (error) {
    EnterpriseLogger.error('Password reset request failed', error, {
      email: req.body.email,
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// Reset password with token
router.post('/reset-password', [
  authRateLimit,
  body('token').isLength({ min: 64, max: 64 }).withMessage('Valid reset token required'),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).withMessage('Password must meet security requirements')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    // Find the email associated with this reset token
    // Note: This is simplified - you'd need better token-to-email mapping
    const storedData = await EnterpriseRedisService.getVerificationCode(`reset:token:${token}`);

    if (!storedData) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const email = storedData.email;
    const user = await User.findByEmail(email);

    if (user) {
      // Hash new password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Update password
      await User.updateProfile(user.id, { password_hash: passwordHash });

      // Clean up reset token
      await EnterpriseRedisService.deleteVerificationCode(`reset:${email}`);

      // Send security notification with enterprise security
      await EnterpriseSecureSMTPService.sendSecurityAlert(
        email,
        'password_changed',
        { timestamp: new Date().toISOString() },
        user.first_name
      );

      EnterpriseLogger.security('Password reset completed', {
        userId: user.id,
        email: email.replace(/(.{3}).*(@.*)/, '$1***$2'),
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }

  } catch (error) {
    EnterpriseLogger.error('Password reset failed', error, {
      token: req.body.token?.substring(0, 8) + '...',
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;