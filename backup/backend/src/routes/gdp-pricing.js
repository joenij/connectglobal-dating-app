const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/security');
const EnterpriseGDPAgentService = require('../services/EnterpriseGDPAgentService');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');

const router = express.Router();

// GET /api/v1/gdp-pricing/country/:countryCode - Get dynamic pricing for specific country
router.get('/country/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { basePrice = 9.99, plan = 'premium' } = req.query;

    // Validate country code
    if (!countryCode || countryCode.length !== 2) {
      return res.status(400).json({
        error: 'Valid 2-letter country code required',
        example: 'US, DE, BR, IN'
      });
    }

    // Get plan-specific base price
    const planPrices = {
      basic: 4.99,
      premium: 9.99,
      ultimate: 19.99
    };

    const actualBasePrice = planPrices[plan] || parseFloat(basePrice);
    const pricing = await EnterpriseGDPAgentService.getDynamicPricing(
      countryCode.toUpperCase(), 
      actualBasePrice
    );

    EnterpriseLogger.info('Dynamic pricing requested', null, {
      countryCode: countryCode.toUpperCase(),
      plan,
      basePrice: actualBasePrice,
      adjustedPrice: pricing.adjusted_price,
      gdpTier: pricing.gdp_tier,
      savings: actualBasePrice - pricing.adjusted_price,
      ip: req.ip
    });

    res.json({
      success: true,
      country_code: countryCode.toUpperCase(),
      plan,
      pricing,
      savings: {
        amount: Math.round((actualBasePrice - pricing.adjusted_price) * 100) / 100,
        percentage: Math.round((1 - pricing.final_multiplier) * 100)
      },
      enterprise: true,
      gdp_based_pricing: true
    });

  } catch (error) {
    EnterpriseLogger.error('Dynamic pricing request failed', error, {
      countryCode: req.params.countryCode,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to calculate dynamic pricing',
      fallback_available: true,
      enterprise: true
    });
  }
});

// GET /api/v1/gdp-pricing/plans/:countryCode - Get all plans with dynamic pricing
router.get('/plans/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;

    if (!countryCode || countryCode.length !== 2) {
      return res.status(400).json({
        error: 'Valid 2-letter country code required'
      });
    }

    const basePrices = {
      basic: { monthly: 4.99, yearly: 49.99 },
      premium: { monthly: 9.99, yearly: 99.99 },
      ultimate: { monthly: 19.99, yearly: 199.99 }
    };

    const dynamicPlans = {};
    
    // Calculate dynamic pricing for each plan
    for (const [planName, prices] of Object.entries(basePrices)) {
      const monthlyPricing = await EnterpriseGDPAgentService.getDynamicPricing(
        countryCode.toUpperCase(), 
        prices.monthly
      );
      
      const yearlyPricing = await EnterpriseGDPAgentService.getDynamicPricing(
        countryCode.toUpperCase(), 
        prices.yearly
      );

      dynamicPlans[planName] = {
        monthly: {
          base_price: prices.monthly,
          adjusted_price: monthlyPricing.adjusted_price,
          savings: prices.monthly - monthlyPricing.adjusted_price,
          savings_percentage: Math.round((1 - monthlyPricing.final_multiplier) * 100)
        },
        yearly: {
          base_price: prices.yearly,
          adjusted_price: yearlyPricing.adjusted_price,
          savings: prices.yearly - yearlyPricing.adjusted_price,
          savings_percentage: Math.round((1 - yearlyPricing.final_multiplier) * 100),
          yearly_discount: Math.round((1 - (yearlyPricing.adjusted_price / (monthlyPricing.adjusted_price * 12))) * 100)
        },
        gdp_tier: monthlyPricing.gdp_tier,
        features: getPlanFeatures(planName)
      };
    }

    // Get GDP data for context
    const gdpInfo = await EnterpriseGDPAgentService.getDynamicPricing(countryCode.toUpperCase(), 1);

    EnterpriseLogger.info('All plans pricing calculated', null, {
      countryCode: countryCode.toUpperCase(),
      gdpTier: gdpInfo.gdp_tier,
      gdpPerCapita: gdpInfo.gdp_per_capita,
      totalSavingsBasic: dynamicPlans.basic.monthly.savings,
      totalSavingsPremium: dynamicPlans.premium.monthly.savings,
      totalSavingsUltimate: dynamicPlans.ultimate.monthly.savings
    });

    res.json({
      success: true,
      country_code: countryCode.toUpperCase(),
      gdp_info: {
        gdp_per_capita: gdpInfo.gdp_per_capita,
        gdp_tier: gdpInfo.gdp_tier,
        data_source: gdpInfo.data_source,
        confidence: gdpInfo.confidence
      },
      plans: dynamicPlans,
      currency: 'USD',
      pricing_method: 'gdp_based_dynamic',
      last_updated: new Date().toISOString(),
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Plans pricing calculation failed', error, {
      countryCode: req.params.countryCode,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to calculate plans pricing',
      enterprise: true
    });
  }
});

// GET /api/v1/gdp-pricing/gdp/:countryCode - Get detailed GDP information for country
router.get('/gdp/:countryCode', authenticateToken, async (req, res) => {
  try {
    const { countryCode } = req.params;

    if (!countryCode || countryCode.length !== 2) {
      return res.status(400).json({
        error: 'Valid 2-letter country code required'
      });
    }

    // Get comprehensive GDP data
    const gdpData = await EnterpriseGDPAgentService.fetchGDPDataForCountry(countryCode.toUpperCase());
    
    if (gdpData) {
      const tierInfo = getTierInformation(gdpData.calculated_tier);
      const comparisonCountries = getComparisonCountries(gdpData.calculated_tier);

      EnterpriseLogger.info('GDP information requested', req.user?.id, {
        countryCode: countryCode.toUpperCase(),
        gdpTier: gdpData.calculated_tier,
        gdpPerCapita: gdpData.gdp_per_capita_usd,
        dataSource: gdpData.primary_source
      });

      res.json({
        success: true,
        country_code: countryCode.toUpperCase(),
        country_name: gdpData.country_name,
        gdp_data: {
          gdp_per_capita_usd: gdpData.gdp_per_capita_usd,
          data_year: gdpData.data_year,
          calculated_tier: gdpData.calculated_tier,
          pricing_multiplier: gdpData.pricing_multiplier
        },
        tier_info: tierInfo,
        comparison: {
          similar_tier_countries: comparisonCountries,
          global_rank: getGlobalRankEstimate(gdpData.gdp_per_capita_usd),
          purchasing_power: getPurchasingPowerDescription(gdpData.calculated_tier)
        },
        data_quality: {
          primary_source: gdpData.primary_source,
          confidence: gdpData.data_confidence,
          last_updated: gdpData.collection_date
        },
        enterprise: true
      });

    } else {
      res.status(404).json({
        error: 'GDP data not available for this country',
        country_code: countryCode.toUpperCase(),
        fallback_available: true
      });
    }

  } catch (error) {
    EnterpriseLogger.error('GDP information request failed', error, {
      countryCode: req.params.countryCode,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to retrieve GDP information',
      enterprise: true
    });
  }
});

// POST /api/v1/gdp-pricing/update-gdp - Trigger manual GDP data update (Admin only)
router.post('/update-gdp', [
  authenticateToken,
  body('countries').optional().isArray(),
  body('force_update').optional().isBoolean()
], async (req, res) => {
  try {
    // Check if user is admin (this would be implemented based on your auth system)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required for GDP data updates'
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { countries, force_update = false } = req.body;

    EnterpriseLogger.info('Manual GDP update triggered', req.user.id, {
      countries: countries || 'all_priority',
      forceUpdate: force_update,
      adminUser: req.user.email,
      ip: req.ip
    });

    // Start the update process
    const updateResults = await EnterpriseGDPAgentService.updateAllCountriesGDP(countries);

    res.json({
      success: true,
      message: 'GDP data update completed',
      results: updateResults,
      updated_countries: updateResults.updated.length,
      failed_countries: updateResults.failed,
      success_rate: Math.round((updateResults.success / (updateResults.success + updateResults.failed)) * 100),
      enterprise: true,
      triggered_by: req.user.email,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    EnterpriseLogger.error('Manual GDP update failed', error, {
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to update GDP data',
      enterprise: true
    });
  }
});

// GET /api/v1/gdp-pricing/tiers - Get information about all GDP tiers
router.get('/tiers', async (req, res) => {
  try {
    const tierInformation = {
      tier_1: {
        name: 'High Income',
        gdp_threshold: 45000,
        pricing_multiplier: 1.0,
        discount_percentage: 0,
        description: 'Developed countries with high GDP per capita',
        example_countries: ['US', 'DE', 'CH', 'NO', 'AU', 'CA'],
        purchasing_power: 'Very High'
      },
      tier_2: {
        name: 'Upper Middle Income',
        gdp_threshold: 12000,
        pricing_multiplier: 0.7,
        discount_percentage: 30,
        description: 'Upper middle income countries',
        example_countries: ['ES', 'CZ', 'PL', 'CL', 'AR', 'RU'],
        purchasing_power: 'High'
      },
      tier_3: {
        name: 'Lower Middle Income',
        gdp_threshold: 4000,
        pricing_multiplier: 0.5,
        discount_percentage: 50,
        description: 'Lower middle income countries',
        example_countries: ['BR', 'CO', 'TH', 'ID', 'IN', 'EG'],
        purchasing_power: 'Moderate'
      },
      tier_4: {
        name: 'Low Income',
        gdp_threshold: 0,
        pricing_multiplier: 0.3,
        discount_percentage: 70,
        description: 'Low income developing countries',
        example_countries: ['NG', 'KE', 'BD', 'PK', 'ET', 'TZ'],
        purchasing_power: 'Low'
      }
    };

    res.json({
      success: true,
      pricing_model: 'GDP-based Dynamic Pricing',
      base_currency: 'USD',
      tiers: tierInformation,
      methodology: {
        data_sources: ['World Bank', 'Wikipedia', 'IMF', 'Fallback Estimates'],
        update_frequency: '24 hours',
        confidence_scoring: true,
        regional_adjustments: true
      },
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Tiers information request failed', error, { ip: req.ip });
    res.status(500).json({
      error: 'Failed to retrieve tier information',
      enterprise: true
    });
  }
});

// GET /api/v1/gdp-pricing/health - GDP Agent health check
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const health = await EnterpriseGDPAgentService.healthCheck();
    
    res.json({
      ...health,
      endpoint: 'gdp-pricing/health',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    EnterpriseLogger.error('GDP Agent health check failed', error, {
      userId: req.user?.id,
      ip: req.ip
    });
    
    res.status(500).json({
      status: 'error',
      service: 'Enterprise GDP Agent Service',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// UTILITY METHODS
function getPlanFeatures(planName) {
  const features = {
    basic: [
      'Basic matching algorithm',
      'Limited likes per day (10)',
      'Basic chat functionality',
      'Profile verification'
    ],
    premium: [
      'Advanced matching algorithm',
      'Unlimited likes',
      'Enhanced chat features',
      'Priority profile display',
      'Read receipts',
      'Profile boost (2x per month)'
    ],
    ultimate: [
      'AI-powered matching',
      'Unlimited everything',
      'Video chat capability',
      'Premium profile badges',
      'Advanced filters',
      'Weekly profile boost',
      'Travel mode',
      'Priority customer support'
    ]
  };
  
  return features[planName] || [];
}

function getTierInformation(tier) {
  const tierInfo = {
    1: {
      name: 'High Income',
      description: 'Developed countries with strong economies',
      discount: '0% (Full Price)',
      purchasing_power: 'Very High'
    },
    2: {
      name: 'Upper Middle Income',
      description: 'Upper middle income countries',
      discount: '30% Discount',
      purchasing_power: 'High'
    },
    3: {
      name: 'Lower Middle Income',
      description: 'Emerging economies with growing middle class',
      discount: '50% Discount',
      purchasing_power: 'Moderate'
    },
    4: {
      name: 'Low Income',
      description: 'Developing countries with limited purchasing power',
      discount: '70% Discount',
      purchasing_power: 'Low'
    }
  };
  
  return tierInfo[tier] || tierInfo[3];
}

function getComparisonCountries(tier) {
  const comparisonCountries = {
    1: ['US', 'DE', 'CH', 'NO', 'AU'],
    2: ['ES', 'CZ', 'PL', 'CL', 'KR'],
    3: ['BR', 'TH', 'CO', 'IN', 'EG'],
    4: ['NG', 'BD', 'KE', 'PK', 'ET']
  };
  
  return comparisonCountries[tier] || comparisonCountries[3];
}

function getGlobalRankEstimate(gdpPerCapita) {
  // Rough estimation based on World Bank data
  if (gdpPerCapita > 70000) return 'Top 10';
  if (gdpPerCapita > 45000) return 'Top 20';
  if (gdpPerCapita > 25000) return 'Top 50';
  if (gdpPerCapita > 12000) return 'Top 100';
  if (gdpPerCapita > 4000) return 'Top 150';
  return 'Below Top 150';
}

function getPurchasingPowerDescription(tier) {
  const descriptions = {
    1: 'Very high purchasing power - full pricing appropriate',
    2: 'High purchasing power - moderate discount applied',
    3: 'Moderate purchasing power - significant discount applied',
    4: 'Limited purchasing power - maximum discount applied'
  };
  
  return descriptions[tier] || descriptions[3];
}

module.exports = router;