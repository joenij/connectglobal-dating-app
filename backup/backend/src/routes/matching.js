const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/security');
const Match = require('../models/Match');
const User = require('../models/User');
const EnterpriseGeolocationService = require('../services/EnterpriseGeolocationService');
const EnterpriseRegionPreferenceService = require('../services/EnterpriseRegionPreferenceService');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');

const router = express.Router();

// GET /api/v1/matching/discover - Get potential matches with geolocation
router.get('/discover', authenticateToken, async (req, res) => {
  try {
    const {
      limit = 10,
      maxDistance,
      preferredCountries,
      includeInternational = 'true',
      useGeolocation = 'true'
    } = req.query;

    const options = {
      limit: parseInt(limit),
      useGeolocation: useGeolocation === 'true',
      maxDistance: maxDistance ? parseInt(maxDistance) : null,
      preferredCountries: preferredCountries ? preferredCountries.split(',') : [],
      includeInternational: includeInternational === 'true'
    };

    EnterpriseLogger.info('Enterprise matching discovery request', req.user.id, {
      ...options,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Get initial matches
    let profiles = await Match.getPotentialMatches(req.user.id, options);
    
    // Apply region/country preferences for enhanced scoring
    if (profiles.length > 0) {
      profiles = await EnterpriseRegionPreferenceService.applyPreferencesToMatches(req.user.id, profiles);
    }
    
    EnterpriseLogger.info('Enterprise matching with preferences completed', req.user.id, {
      matchCount: profiles.length,
      hasGeolocationMatches: profiles.some(p => p.distance_km !== null),
      hasPreferenceScoring: profiles.some(p => p.preferenceScore !== undefined),
      averageCompatibility: profiles.reduce((sum, p) => sum + p.compatibilityScore, 0) / profiles.length,
      averagePreferenceScore: profiles.reduce((sum, p) => sum + (p.preferenceScore || 0.5), 0) / profiles.length,
      uniqueCountries: [...new Set(profiles.map(p => p.countryCode))].length,
      preferredCountryMatches: profiles.filter(p => p.preferenceMatch?.countryPreferred).length,
      culturallyCompatibleMatches: profiles.filter(p => p.preferenceMatch?.culturallyCompatible).length
    });

    res.json({
      profiles,
      totalCount: profiles.length,
      matchingType: profiles[0]?.matchType || 'enterprise-geolocation',
      searchCriteria: options,
      matchingFeatures: {
        geolocationEnabled: options.useGeolocation && profiles.some(p => p.distance_km !== null),
        preferenceScoring: true,
        culturalCompatibility: true,
        distancePreferences: true
      },
      statistics: {
        averageCompatibility: profiles.reduce((sum, p) => sum + p.compatibilityScore, 0) / profiles.length,
        preferredCountryMatches: profiles.filter(p => p.preferenceMatch?.countryPreferred).length,
        culturalMatches: profiles.filter(p => p.preferenceMatch?.culturallyCompatible).length,
        withinDistancePreference: profiles.filter(p => p.preferenceMatch?.withinDistancePreference).length
      },
      enterprise: true
    });
  } catch (error) {
    EnterpriseLogger.error('Enterprise matching discovery failed', error, { 
      userId: req.user.id, 
      ip: req.ip,
      query: req.query 
    });
    
    res.status(500).json({ 
      error: 'Failed to fetch potential matches',
      enterprise: true,
      fallbackAvailable: true
    });
  }
});

// POST /api/v1/matching/action - Like/pass on a profile
router.post('/action', authenticateToken, async (req, res) => {
  try {
    const { targetUserId, action } = req.body; // action: 'like', 'pass', 'super_like'
    
    if (!targetUserId || !action) {
      return res.status(400).json({ error: 'Target user ID and action required' });
    }

    if (!['like', 'pass', 'super_like'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be like, pass, or super_like' });
    }

    const result = await Match.recordAction(req.user.id, targetUserId, action);

    res.json({
      action: result.action,
      targetUserId: targetUserId,
      isMatch: result.isMatch,
      message: result.isMatch ? "It's a match! 🎉" : 'Action recorded'
    });
  } catch (error) {
    EnterpriseLogger.error('Match action error', error, { userId: req.user.id, targetUserId: req.params.userId, action: req.body.action, ip: req.ip });
    res.status(500).json({ error: 'Failed to process action' });
  }
});

// GET /api/v1/matching/matches - Get user's matches
router.get('/matches', authenticateToken, async (req, res) => {
  try {
    const matches = await Match.getUserMatches(req.user.id);

    res.json({
      matches: matches,
      totalCount: matches.length
    });
  } catch (error) {
    EnterpriseLogger.error('Get matches error', error, { userId: req.user.id, ip: req.ip });
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// POST /api/v1/matching/location - Update user location for geolocation matching
router.post('/location', [
  authenticateToken,
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  body('country_code').isLength({ min: 2, max: 2 }).withMessage('Valid country code required'),
  body('privacy_level').optional().isIn(['exact', 'neighborhood', 'city', 'region', 'country']),
  body('search_radius_km').optional().isInt({ min: 1, max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const locationData = {
      latitude: parseFloat(req.body.latitude),
      longitude: parseFloat(req.body.longitude),
      country_code: req.body.country_code.toUpperCase(),
      country_name: req.body.country_name || null,
      region_code: req.body.region_code || null,
      region_name: req.body.region_name || null,
      city: req.body.city || null,
      postal_code: req.body.postal_code || null,
      privacy_level: req.body.privacy_level || 'city',
      search_radius_km: parseInt(req.body.search_radius_km) || 100,
      location_source: 'user_input'
    };

    const success = await EnterpriseGeolocationService.updateUserLocation(req.user.id, locationData);

    if (success) {
      EnterpriseLogger.info('User location updated for geolocation matching', req.user.id, {
        country: locationData.country_code,
        city: locationData.city,
        privacyLevel: locationData.privacy_level,
        searchRadius: locationData.search_radius_km,
        coordinatesProvided: true
      });

      res.json({
        success: true,
        message: 'Location updated successfully',
        privacy: {
          level: locationData.privacy_level,
          coordinates_fuzzed: locationData.privacy_level !== 'exact',
          search_radius: locationData.search_radius_km
        },
        enterprise: true
      });
    } else {
      res.status(500).json({
        error: 'Failed to update location',
        enterprise: true
      });
    }

  } catch (error) {
    EnterpriseLogger.error('Location update failed', error, { 
      userId: req.user.id, 
      ip: req.ip,
      locationData: req.body 
    });
    res.status(500).json({ 
      error: 'Failed to update location',
      enterprise: true 
    });
  }
});

// POST /api/v1/matching/preferences - Update comprehensive region/country preferences
router.post('/preferences', [
  authenticateToken,
  body('preferred_countries').optional().isArray(),
  body('excluded_countries').optional().isArray(),
  body('preferred_regions').optional().isArray(),
  body('excluded_regions').optional().isArray(),
  body('preferred_cities').optional().isArray(),
  body('max_distance_km').optional().isInt({ min: 1, max: 50000 }),
  body('cultural_affinity_groups').optional().isArray(),
  body('language_preferences').optional().isArray(),
  body('international_matching').optional().isBoolean(),
  body('gdp_tier_preference').optional().isInt({ min: 1, max: 4 }),
  body('travel_willingness_km').optional().isInt({ min: 50, max: 5000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const preferences = {
      preferred_countries: req.body.preferred_countries || [],
      excluded_countries: req.body.excluded_countries || [],
      preferred_regions: req.body.preferred_regions || [],
      excluded_regions: req.body.excluded_regions || [],
      preferred_cities: req.body.preferred_cities || [],
      max_distance_km: parseInt(req.body.max_distance_km) || 100,
      cultural_affinity_groups: req.body.cultural_affinity_groups || [],
      language_preferences: req.body.language_preferences || [],
      international_matching: req.body.international_matching !== false,
      gdp_tier_preference: req.body.gdp_tier_preference ? parseInt(req.body.gdp_tier_preference) : null,
      travel_willingness_km: parseInt(req.body.travel_willingness_km) || 500
    };

    const result = await EnterpriseRegionPreferenceService.updateUserPreferences(req.user.id, preferences);

    if (result.success) {
      EnterpriseLogger.info('Enterprise region preferences updated successfully', req.user.id, {
        preferredCountries: preferences.preferred_countries.length,
        excludedCountries: preferences.excluded_countries.length,
        culturalGroups: preferences.cultural_affinity_groups.length,
        languages: preferences.language_preferences.length,
        maxDistance: preferences.max_distance_km,
        internationalMatching: preferences.international_matching,
        culturalOpenness: result.culturalOpenness
      });

      res.json({
        success: true,
        message: 'Region preferences updated successfully',
        preferences: result.preferences,
        analytics: {
          culturalOpenness: result.culturalOpenness,
          countryWeights: Object.keys(result.countryWeights || {}).length,
          preferencesConfigured: true
        },
        enterprise: true
      });
    } else {
      res.status(500).json({
        error: 'Failed to update preferences',
        enterprise: true
      });
    }

  } catch (error) {
    EnterpriseLogger.error('Enterprise preferences update failed', error, { 
      userId: req.user.id, 
      ip: req.ip,
      preferences: req.body
    });
    res.status(500).json({ 
      error: 'Failed to update region preferences',
      enterprise: true 
    });
  }
});

// GET /api/v1/matching/preferences - Get user's current preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const preferences = await EnterpriseRegionPreferenceService.getUserPreferences(req.user.id);
    
    EnterpriseLogger.info('User preferences retrieved', req.user.id, {
      hasPreferences: !preferences.generated_defaults,
      preferredCountries: preferences.preferred_countries.length,
      culturalOpenness: preferences.cultural_openness_score,
      lastUpdated: preferences.last_updated
    });

    res.json({
      success: true,
      preferences,
      metadata: {
        hasCustomPreferences: !preferences.generated_defaults && !preferences.basic_defaults,
        intelligentDefaults: preferences.generated_defaults || false,
        preferencesConfigured: preferences.preferred_countries.length > 1,
        culturalOpenness: preferences.cultural_openness_score,
        confidenceScore: preferences.preference_confidence
      },
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to retrieve user preferences', error, { 
      userId: req.user.id, 
      ip: req.ip 
    });
    res.status(500).json({ 
      error: 'Failed to retrieve preferences',
      enterprise: true 
    });
  }
});

// GET /api/v1/matching/preferences/suggestions - Get intelligent preference suggestions
router.get('/preferences/suggestions', authenticateToken, async (req, res) => {
  try {
    // Get user's current location/country for suggestions
    const userCountry = req.query.country || 'US'; // Fallback to US if not provided
    
    // Generate intelligent suggestions
    const suggestions = await EnterpriseRegionPreferenceService.generateIntelligentDefaults(
      req.user.id, 
      userCountry, 
      3 // Default GDP tier
    );

    EnterpriseLogger.info('Preference suggestions generated', req.user.id, {
      userCountry,
      suggestedCountries: suggestions.preferred_countries.length,
      culturalGroups: suggestions.cultural_affinity_groups.length
    });

    res.json({
      success: true,
      suggestions: {
        recommended_countries: suggestions.preferred_countries,
        cultural_affinity_groups: suggestions.cultural_affinity_groups,
        language_preferences: suggestions.language_preferences,
        max_distance_suggestion: suggestions.travel_willingness_km,
        regions: suggestions.preferred_regions
      },
      reasoning: {
        based_on_country: userCountry,
        cultural_analysis: true,
        gdp_compatibility: true,
        geographic_proximity: true
      },
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to generate preference suggestions', error, { 
      userId: req.user.id, 
      ip: req.ip 
    });
    res.status(500).json({ 
      error: 'Failed to generate suggestions',
      enterprise: true 
    });
  }
});

// GET /api/v1/matching/preferences/countries - Get available countries with cultural data
router.get('/preferences/countries', authenticateToken, async (req, res) => {
  try {
    // This would ideally come from the database, but for now use the service's data
    const countryData = EnterpriseRegionPreferenceService.countryData;
    
    const countries = Object.entries(countryData).map(([code, data]) => ({
      code,
      name: this.getCountryName(code), // Would be implemented
      region: data.region,
      cultural_group: data.cultural_group,
      primary_language: data.primary_language,
      gdp_tier: data.gdp_tier
    }));

    res.json({
      success: true,
      countries: countries.slice(0, 50), // Limit to avoid too much data
      total_countries: countries.length,
      cultural_groups: [...new Set(countries.map(c => c.cultural_group))],
      regions: [...new Set(countries.map(c => c.region))],
      gdp_tiers: [1, 2, 3, 4],
      enterprise: true
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to retrieve country data', error, { 
      userId: req.user.id, 
      ip: req.ip 
    });
    res.status(500).json({ 
      error: 'Failed to retrieve country data',
      enterprise: true 
    });
  }
});

// GET /api/v1/matching/preferences/health - Region preference service health
router.get('/preferences/health', authenticateToken, async (req, res) => {
  try {
    const health = await EnterpriseRegionPreferenceService.healthCheck();
    
    res.json({
      ...health,
      timestamp: new Date().toISOString(),
      endpoint: 'matching/preferences/health'
    });

  } catch (error) {
    EnterpriseLogger.error('Region preference health check failed', error, { 
      userId: req.user.id, 
      ip: req.ip 
    });
    
    res.status(500).json({
      status: 'error',
      service: 'Enterprise Region Preference Service',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/matching/geolocation/health - Geolocation service health check
router.get('/geolocation/health', authenticateToken, async (req, res) => {
  try {
    const health = await EnterpriseGeolocationService.healthCheck();
    
    res.json({
      ...health,
      timestamp: new Date().toISOString(),
      endpoint: 'matching/geolocation/health'
    });

  } catch (error) {
    EnterpriseLogger.error('Geolocation health check failed', error, { 
      userId: req.user.id, 
      ip: req.ip 
    });
    
    res.status(500).json({
      status: 'error',
      service: 'Enterprise Geolocation Service',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;