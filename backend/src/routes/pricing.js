const express = require('express');
const { authenticateToken } = require('../middleware/security');

const router = express.Router();

// Helper function to get GDP tier pricing
const getPricingByCountry = (countryCode) => {
  const pricingTiers = {
    1: { countries: ['US', 'UK', 'DE', 'FR', 'JP', 'AU', 'CA'], premium: 19.99, elite: 39.99 },
    2: { countries: ['BR', 'MX', 'CN', 'RU', 'KR', 'ES'], premium: 9.99, elite: 19.99 },
    3: { countries: ['IN', 'PH', 'TH', 'MY', 'VN', 'ID'], premium: 4.99, elite: 9.99 },
    4: { countries: ['NG', 'KE', 'BD', 'PK', 'EG', 'MA'], premium: 2.99, elite: 5.99 }
  };

  for (const [tier, data] of Object.entries(pricingTiers)) {
    if (data.countries.includes(countryCode)) {
      return { tier: parseInt(tier), ...data };
    }
  }
  
  return pricingTiers[3]; // Default to tier 3
};

// GET /api/v1/pricing - Get pricing for user's region
router.get('/', async (req, res) => {
  try {
    const countryCode = req.query.country || 'US';
    const pricing = getPricingByCountry(countryCode);
    
    // TODO: Apply dynamic modifiers (disasters, promotions, etc.)
    const modifiers = [];
    
    res.json({
      countryCode,
      tier: pricing.tier,
      pricing: {
        premium: {
          monthly: pricing.premium,
          yearly: pricing.premium * 10, // 2 months free
          currency: 'USD'
        },
        elite: {
          monthly: pricing.elite,
          yearly: pricing.elite * 10, // 2 months free
          currency: 'USD'
        }
      },
      modifiers,
      features: {
        beta: [
          'Unlimited likes',
          'Global matching',
          'Unlimited messaging',
          'See who liked you',
          'Early access features',
          'Direct feedback channel',
          'Beta tester badge',
          'Feature voting rights'
        ]
      }
    });
  } catch (error) {
    console.error('Get pricing error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

// POST /api/v1/pricing/join-beta - Join beta program
router.post('/join-beta', authenticateToken, async (req, res) => {
  try {
    const { tiktok_username, referral_source } = req.body;
    
    if (!tiktok_username) {
      return res.status(400).json({ error: 'TikTok username required for beta access' });
    }

    // Auto-approve beta access for TikTok followers
    console.log(`User ${req.user.id} joining beta program with TikTok: ${tiktok_username}`);

    const betaAccess = {
      id: `beta_${Date.now()}`,
      userId: req.user.id,
      plan: 'beta',
      status: 'active',
      tiktok_username,
      referral_source: referral_source || 'tiktok',
      joinDate: new Date().toISOString(),
      features_unlocked: true
    };

    res.json({
      betaAccess,
      message: 'Welcome to the beta program! All features unlocked!'
    });
  } catch (error) {
    console.error('Beta join error:', error);
    res.status(500).json({ error: 'Failed to join beta program' });
  }
});

// GET /api/v1/pricing/beta-status - Get user's beta status
router.get('/beta-status', authenticateToken, async (req, res) => {
  try {
    // Check if user has beta access (for now, grant to all for testing)
    const betaStatus = {
      id: 'beta_123',
      userId: req.user.id,
      plan: 'beta',
      status: 'active',
      hasAccess: true,
      features_unlocked: true,
      tester_badge: true
    };

    res.json(betaStatus);
  } catch (error) {
    console.error('Get beta status error:', error);
    res.status(500).json({ error: 'Failed to fetch beta status' });
  }
});

// POST /api/v1/pricing/cancel - Cancel subscription
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    // TODO: Cancel subscription with payment provider
    // TODO: Update subscription status in database
    
    console.log(`User ${req.user.id} cancelling subscription`);

    res.json({
      message: 'Subscription cancelled successfully',
      cancellationDate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// GET /api/v1/pricing/modifiers - Get active pricing modifiers
router.get('/modifiers', async (req, res) => {
  try {
    const countryCode = req.query.country || 'US';
    
    // TODO: Fetch active modifiers from database
    const activeModifiers = [
      {
        type: 'seasonal',
        name: 'Holiday Special',
        discountPercentage: 25,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        message: '25% off all plans - Limited time!'
      }
    ];

    res.json({
      countryCode,
      modifiers: activeModifiers,
      totalDiscount: activeModifiers.reduce((sum, mod) => sum + mod.discountPercentage, 0)
    });
  } catch (error) {
    console.error('Get modifiers error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing modifiers' });
  }
});

module.exports = router;