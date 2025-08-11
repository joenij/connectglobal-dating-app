const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { authRateLimit, authenticateToken } = require('../middleware/security');
const User = require('../models/User');
const TwilioService = require('../services/TwilioService');

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

    // Determine GDP pricing tier based on country
    const gdpPricingTier = getGDPTier(countryCode);

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

    // TODO: Send phone verification SMS
    // await sendPhoneVerification(phoneNumber);

    // TODO: Send email verification
    // await sendEmailVerification(email);

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
    console.error('Registration error:', error);
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

    // TODO: Store refresh token in database/Redis
    // await storeRefreshToken(user.id, refreshToken);

    // TODO: Log security event
    // await logSecurityEvent(user.id, 'login', req.ip, req.get('User-Agent'));

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
    console.error('Login error:', error);
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

    // TODO: Check if refresh token exists in database
    // const storedToken = await getRefreshToken(decoded.id);
    // if (!storedToken || storedToken !== refreshToken) {
    //   return res.status(401).json({ error: 'Invalid refresh token' });
    // }

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
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // TODO: Invalidate refresh token
    // await revokeRefreshToken(req.user.id, refreshToken);

    // TODO: Add access token to blacklist (Redis)
    // await blacklistToken(req.headers.authorization.split(' ')[1]);

    res.json({ message: 'Logout successful' });

  } catch (error) {
    console.error('Logout error:', error);
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

    // TODO: Verify SMS code
    // const isValidCode = await verifySMSCode(phoneNumber, code);
    // if (!isValidCode) {
    //   return res.status(400).json({ error: 'Invalid verification code' });
    // }

    // TODO: Update user verification status
    // await markPhoneVerified(phoneNumber);

    res.json({
      message: 'Phone verification successful',
      nextStep: 'email_verification'
    });

  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(500).json({ error: 'Phone verification failed' });
  }
});

// Helper function to determine GDP tier based on country
function getGDPTier(countryCode) {
  const gdpTiers = {
    1: ['US', 'UK', 'DE', 'FR', 'JP', 'AU', 'CA', 'CH', 'NO', 'DK'],
    2: ['BR', 'MX', 'CN', 'RU', 'KR', 'ES', 'IT', 'NL', 'BE', 'AT'],
    3: ['IN', 'PH', 'TH', 'MY', 'VN', 'ID', 'PL', 'CZ', 'HU', 'RO'],
    4: ['NG', 'KE', 'BD', 'PK', 'EG', 'MA', 'GH', 'TZ', 'UG', 'ZM']
  };

  for (const [tier, countries] of Object.entries(gdpTiers)) {
    if (countries.includes(countryCode)) {
      return parseInt(tier);
    }
  }
  
  return 3; // Default to tier 3 if country not found
}

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
    const result = await TwilioService.sendVerificationCode(phoneNumber);
    
    // Store verification code temporarily (in production, use Redis or database)
    global.verificationCodes = global.verificationCodes || {};
    global.verificationCodes[phoneNumber] = {
      code: result.verificationCode,
      expiresAt: result.expiresAt,
      attempts: 0
    };

    res.json({
      success: true,
      message: 'Verification code sent',
      expiresAt: result.expiresAt
    });

  } catch (error) {
    console.error('Send verification error:', error);
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

    // Check stored verification code
    global.verificationCodes = global.verificationCodes || {};
    const storedData = global.verificationCodes[phoneNumber];

    if (!storedData) {
      return res.status(400).json({ error: 'No verification code sent for this number' });
    }

    // Check expiration
    if (new Date() > storedData.expiresAt) {
      delete global.verificationCodes[phoneNumber];
      return res.status(400).json({ error: 'Verification code expired' });
    }

    // Check attempts
    if (storedData.attempts >= 3) {
      delete global.verificationCodes[phoneNumber];
      return res.status(400).json({ error: 'Too many failed attempts' });
    }

    // Verify code
    if (storedData.code.toString() !== code.toString()) {
      storedData.attempts++;
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Mark phone as verified
    const user = await User.findByPhone(phoneNumber);
    if (user) {
      await User.updateProfile(user.id, { is_phone_verified: true });
    }

    // Clean up verification code
    delete global.verificationCodes[phoneNumber];

    res.json({
      success: true,
      message: 'Phone number verified successfully'
    });

  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(500).json({ error: 'Failed to verify phone number' });
  }
});

module.exports = router;