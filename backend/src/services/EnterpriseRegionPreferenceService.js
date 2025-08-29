const EnterpriseLogger = require('./EnterpriseLoggerService');
const { query } = require('../config/database');

/**
 * Enterprise Region Preference Service - ADVANCED GEOGRAPHIC MATCHING
 * ===================================================================
 * 
 * This service manages user preferences for countries, regions, and geographic matching with:
 * - Hierarchical preference system (country > region > city)
 * - Cultural compatibility scoring
 * - GDP-tier preference alignment
 * - Language-based regional matching
 * - Travel preference integration
 * - Real-time preference learning and adaptation
 */
class EnterpriseRegionPreferenceService {
  constructor() {
    this.countryData = this.initializeCountryData();
    this.regionMappings = this.initializeRegionMappings();
    this.culturalAffinities = this.initializeCulturalAffinities();
    this.isInitialized = false;
    this.initialize();
  }

  async initialize() {
    try {
      await this.createPreferenceTables();
      await this.seedCountryRegionData();
      this.isInitialized = true;
      
      EnterpriseLogger.info('✅ Enterprise Region Preference Service initialized', null, {
        service: 'EnterpriseRegionPreferenceService',
        countries: Object.keys(this.countryData).length,
        regions: Object.keys(this.regionMappings).length,
        culturalAffinities: Object.keys(this.culturalAffinities).length,
        enterprise: true
      });
    } catch (error) {
      EnterpriseLogger.error('❌ Enterprise Region Preference Service initialization failed', error);
      throw error;
    }
  }

  async createPreferenceTables() {
    // Enhanced user location preferences with detailed region preferences
    const createLocationPreferencesTable = `
      CREATE TABLE IF NOT EXISTS user_location_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        
        -- DISTANCE PREFERENCES
        min_distance_km INTEGER DEFAULT 0,
        max_distance_km INTEGER DEFAULT 100,
        
        -- COUNTRY PREFERENCES (with priority weighting)
        preferred_countries JSONB DEFAULT '[]',
        excluded_countries JSONB DEFAULT '[]',
        country_priority_weights JSONB DEFAULT '{}', -- {"DE": 1.0, "AT": 0.8, "CH": 0.9}
        
        -- REGION PREFERENCES (detailed regional preferences)
        preferred_regions JSONB DEFAULT '[]',
        excluded_regions JSONB DEFAULT '[]',
        region_priority_weights JSONB DEFAULT '{}',
        
        -- CITY PREFERENCES
        preferred_cities JSONB DEFAULT '[]',
        excluded_cities JSONB DEFAULT '[]',
        
        -- CULTURAL PREFERENCES
        cultural_affinity_groups JSONB DEFAULT '[]', -- ["Germanic", "Nordic", "Latin"]
        language_preferences JSONB DEFAULT '[]', -- ["en", "de", "fr"]
        cultural_openness_score DECIMAL(3,2) DEFAULT 0.75, -- 0.0 to 1.0
        
        -- MATCHING BEHAVIOR
        international_matching BOOLEAN DEFAULT true,
        same_country_priority BOOLEAN DEFAULT true,
        same_region_priority BOOLEAN DEFAULT false,
        same_city_priority BOOLEAN DEFAULT false,
        
        -- ADVANCED PREFERENCES
        gdp_tier_preference INTEGER, -- Prefer similar GDP tiers (1-4)
        gdp_tier_flexibility INTEGER DEFAULT 2, -- Allow ±2 tiers
        time_zone_preference VARCHAR(50), -- Preferred timezone for compatibility
        travel_willingness_km INTEGER DEFAULT 500, -- Willing to travel for dates
        
        -- LEARNING & ADAPTATION
        preference_confidence DECIMAL(3,2) DEFAULT 0.5, -- How confident we are in these preferences
        last_preference_update TIMESTAMP DEFAULT NOW(),
        preference_source VARCHAR(50) DEFAULT 'user_input', -- user_input, learned, imported
        
        -- METADATA
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;

    // Country and region master data
    const createCountriesTable = `
      CREATE TABLE IF NOT EXISTS countries (
        id SERIAL PRIMARY KEY,
        country_code CHAR(2) UNIQUE NOT NULL,
        country_name VARCHAR(100) NOT NULL,
        region_code VARCHAR(10),
        region_name VARCHAR(100),
        continent VARCHAR(50),
        
        -- CULTURAL DATA
        cultural_group VARCHAR(50), -- "Germanic", "Nordic", "Latin", etc.
        primary_language VARCHAR(10),
        common_languages JSONB DEFAULT '[]',
        
        -- ECONOMIC DATA
        gdp_tier INTEGER DEFAULT 3,
        gdp_per_capita_usd INTEGER,
        cost_of_living_index INTEGER DEFAULT 100,
        
        -- GEOGRAPHIC DATA
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        timezone VARCHAR(50),
        
        -- MATCHING DATA
        popular_for_dating BOOLEAN DEFAULT true,
        safety_rating INTEGER DEFAULT 7, -- 1-10 scale
        tourism_score INTEGER DEFAULT 5, -- 1-10 scale
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    // User preference history for learning and analytics
    const createPreferenceHistoryTable = `
      CREATE TABLE IF NOT EXISTS user_preference_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        
        -- PREFERENCE CHANGES
        preference_type VARCHAR(50) NOT NULL, -- 'country_added', 'region_excluded', etc.
        old_value JSONB,
        new_value JSONB,
        change_reason VARCHAR(100), -- 'user_action', 'auto_learned', 'match_feedback'
        
        -- LEARNING DATA
        triggered_by_match_id INTEGER,
        user_satisfaction_score DECIMAL(3,2), -- Feedback from user about matches
        
        -- METADATA
        created_at TIMESTAMP DEFAULT NOW(),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;

    await query(createLocationPreferencesTable);
    await query(createCountriesTable);
    await query(createPreferenceHistoryTable);

    EnterpriseLogger.info('✅ Enterprise region preference tables created', null, {
      tables: ['user_location_preferences', 'countries', 'user_preference_history'],
      enterprise: true
    });
  }

  /**
   * UPDATE USER REGION PREFERENCES
   * Comprehensive preference management with validation and learning
   */
  async updateUserPreferences(userId, preferences) {
    const {
      preferred_countries = [],
      excluded_countries = [],
      preferred_regions = [],
      excluded_regions = [],
      preferred_cities = [],
      max_distance_km = 100,
      cultural_affinity_groups = [],
      language_preferences = [],
      international_matching = true,
      gdp_tier_preference = null,
      travel_willingness_km = 500
    } = preferences;

    try {
      // Validate preferences
      const validationResult = await this.validatePreferences(preferences);
      if (!validationResult.valid) {
        throw new Error(`Invalid preferences: ${validationResult.errors.join(', ')}`);
      }

      // Calculate cultural openness score
      const culturalOpenness = this.calculateCulturalOpenness(
        preferred_countries, 
        cultural_affinity_groups, 
        international_matching
      );

      // Generate country priority weights
      const countryWeights = this.generateCountryPriorityWeights(
        preferred_countries, 
        excluded_countries,
        cultural_affinity_groups
      );

      const updateQuery = `
        INSERT INTO user_location_preferences (
          user_id, preferred_countries, excluded_countries, preferred_regions, excluded_regions,
          preferred_cities, max_distance_km, cultural_affinity_groups, language_preferences,
          international_matching, gdp_tier_preference, travel_willingness_km,
          cultural_openness_score, country_priority_weights, preference_confidence,
          last_preference_update, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0.8, NOW(), NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          preferred_countries = $2, excluded_countries = $3, preferred_regions = $4,
          excluded_regions = $5, preferred_cities = $6, max_distance_km = $7,
          cultural_affinity_groups = $8, language_preferences = $9,
          international_matching = $10, gdp_tier_preference = $11,
          travel_willingness_km = $12, cultural_openness_score = $13,
          country_priority_weights = $14, last_preference_update = NOW(), updated_at = NOW()
      `;

      await query(updateQuery, [
        userId,
        JSON.stringify(preferred_countries),
        JSON.stringify(excluded_countries),
        JSON.stringify(preferred_regions),
        JSON.stringify(excluded_regions),
        JSON.stringify(preferred_cities),
        max_distance_km,
        JSON.stringify(cultural_affinity_groups),
        JSON.stringify(language_preferences),
        international_matching,
        gdp_tier_preference,
        travel_willingness_km,
        culturalOpenness,
        JSON.stringify(countryWeights)
      ]);

      // Log preference change for learning
      await this.logPreferenceChange(userId, 'preferences_updated', null, preferences, 'user_action');

      EnterpriseLogger.info('User region preferences updated', userId, {
        preferredCountries: preferred_countries.length,
        excludedCountries: excluded_countries.length,
        preferredRegions: preferred_regions.length,
        maxDistance: max_distance_km,
        culturalGroups: cultural_affinity_groups.length,
        languages: language_preferences.length,
        internationalMatching: international_matching,
        culturalOpenness: culturalOpenness,
        travelWillingness: travel_willingness_km
      });

      return {
        success: true,
        preferences: await this.getUserPreferences(userId),
        culturalOpenness,
        countryWeights
      };

    } catch (error) {
      EnterpriseLogger.error('Failed to update user preferences', error, {
        userId,
        preferences
      });
      throw error;
    }
  }

  /**
   * GET USER PREFERENCES WITH INTELLIGENT DEFAULTS
   */
  async getUserPreferences(userId) {
    try {
      const preferencesQuery = `
        SELECT 
          ulp.*,
          u.country_code as user_country,
          u.gdp_pricing_tier as user_gdp_tier
        FROM user_location_preferences ulp
        RIGHT JOIN users u ON ulp.user_id = u.id
        WHERE u.id = $1
      `;

      const result = await query(preferencesQuery, [userId]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const userData = result.rows[0];
      
      // If no preferences set, generate intelligent defaults
      if (!userData.preferred_countries) {
        return this.generateIntelligentDefaults(userId, userData.user_country, userData.user_gdp_tier);
      }

      // Return existing preferences with enhancements
      return {
        userId,
        preferred_countries: this.parseJSON(userData.preferred_countries) || [],
        excluded_countries: this.parseJSON(userData.excluded_countries) || [],
        preferred_regions: this.parseJSON(userData.preferred_regions) || [],
        excluded_regions: this.parseJSON(userData.excluded_regions) || [],
        preferred_cities: this.parseJSON(userData.preferred_cities) || [],
        max_distance_km: userData.max_distance_km || 100,
        min_distance_km: userData.min_distance_km || 0,
        cultural_affinity_groups: this.parseJSON(userData.cultural_affinity_groups) || [],
        language_preferences: this.parseJSON(userData.language_preferences) || [],
        international_matching: userData.international_matching !== false,
        same_country_priority: userData.same_country_priority !== false,
        gdp_tier_preference: userData.gdp_tier_preference,
        gdp_tier_flexibility: userData.gdp_tier_flexibility || 2,
        travel_willingness_km: userData.travel_willingness_km || 500,
        cultural_openness_score: parseFloat(userData.cultural_openness_score) || 0.75,
        country_priority_weights: this.parseJSON(userData.country_priority_weights) || {},
        preference_confidence: parseFloat(userData.preference_confidence) || 0.5,
        last_updated: userData.last_preference_update,
        enterprise: true
      };

    } catch (error) {
      EnterpriseLogger.error('Failed to get user preferences', error, { userId });
      throw error;
    }
  }

  /**
   * GENERATE INTELLIGENT DEFAULT PREFERENCES
   * Based on user's country, GDP tier, and regional patterns
   */
  async generateIntelligentDefaults(userId, userCountry, userGdpTier) {
    try {
      const userCountryData = this.countryData[userCountry];
      if (!userCountryData) {
        return this.getBasicDefaults(userId, userCountry);
      }

      // Get culturally similar countries
      const culturalGroup = userCountryData.cultural_group;
      const similarCountries = Object.entries(this.countryData)
        .filter(([code, data]) => 
          data.cultural_group === culturalGroup || 
          Math.abs(data.gdp_tier - userGdpTier) <= 1
        )
        .map(([code]) => code)
        .slice(0, 8); // Top 8 similar countries

      // Get neighboring regions
      const neighboringRegions = this.getNeighboringRegions(userCountry);

      // Determine cultural affinity groups
      const affinityGroups = [culturalGroup];
      if (culturalGroup === 'Germanic') affinityGroups.push('Nordic', 'Western European');
      if (culturalGroup === 'Nordic') affinityGroups.push('Germanic', 'Western European');
      if (culturalGroup === 'Latin') affinityGroups.push('Southern European', 'Romance');

      const intelligentDefaults = {
        userId,
        preferred_countries: [userCountry, ...similarCountries].slice(0, 6),
        excluded_countries: [],
        preferred_regions: neighboringRegions,
        excluded_regions: [],
        preferred_cities: [],
        max_distance_km: this.getDefaultDistanceForCountry(userCountry),
        cultural_affinity_groups: affinityGroups,
        language_preferences: [userCountryData.primary_language, 'en'], // Always include English
        international_matching: true,
        same_country_priority: true,
        gdp_tier_preference: userGdpTier,
        gdp_tier_flexibility: 2,
        travel_willingness_km: this.getDefaultTravelWillingness(userCountry),
        generated_defaults: true,
        enterprise: true
      };

      EnterpriseLogger.info('Intelligent default preferences generated', userId, {
        userCountry,
        userGdpTier,
        culturalGroup,
        similarCountriesFound: similarCountries.length,
        neighboringRegions: neighboringRegions.length,
        affinityGroups: affinityGroups.length
      });

      return intelligentDefaults;

    } catch (error) {
      EnterpriseLogger.error('Failed to generate intelligent defaults', error, { userId, userCountry });
      return this.getBasicDefaults(userId, userCountry);
    }
  }

  /**
   * APPLY PREFERENCES TO MATCHING
   * Enhance geolocation matches with preference-based scoring
   */
  async applyPreferencesToMatches(userId, matches) {
    try {
      const userPrefs = await this.getUserPreferences(userId);
      
      const enhancedMatches = matches.map(match => {
        const preferenceScore = this.calculatePreferenceScore(match, userPrefs);
        const culturalCompatibility = this.calculateCulturalCompatibility(match, userPrefs);
        const distancePreference = this.calculateDistancePreference(match, userPrefs);

        return {
          ...match,
          preferenceScore,
          culturalCompatibility,
          distancePreference,
          // Enhanced compatibility score including preferences
          compatibilityScore: (
            (match.compatibilityScore || 0.6) * 0.4 + // Original score (40%)
            preferenceScore * 0.3 +                    // Preference score (30%)
            culturalCompatibility * 0.2 +              // Cultural compatibility (20%)
            distancePreference * 0.1                   // Distance preference (10%)
          ),
          preferenceMatch: {
            countryPreferred: userPrefs.preferred_countries.includes(match.countryCode),
            regionPreferred: userPrefs.preferred_regions.includes(match.region),
            culturallyCompatible: culturalCompatibility > 0.7,
            withinDistancePreference: match.distance_km <= userPrefs.max_distance_km
          },
          enterprise: true
        };
      });

      // Sort by enhanced compatibility score
      enhancedMatches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

      EnterpriseLogger.info('Preferences applied to matches', userId, {
        originalMatches: matches.length,
        enhancedMatches: enhancedMatches.length,
        averagePreferenceScore: enhancedMatches.reduce((sum, m) => sum + m.preferenceScore, 0) / enhancedMatches.length,
        averageCulturalCompatibility: enhancedMatches.reduce((sum, m) => sum + m.culturalCompatibility, 0) / enhancedMatches.length
      });

      return enhancedMatches;

    } catch (error) {
      EnterpriseLogger.error('Failed to apply preferences to matches', error, { userId });
      // Return original matches if preference application fails
      return matches;
    }
  }

  // SCORING ALGORITHMS

  calculatePreferenceScore(match, preferences) {
    let score = 0.5; // Base score

    // Country preference scoring
    if (preferences.preferred_countries.includes(match.countryCode)) {
      const weight = preferences.country_priority_weights[match.countryCode] || 1.0;
      score += 0.3 * weight;
    }

    // Excluded countries penalty
    if (preferences.excluded_countries.includes(match.countryCode)) {
      score -= 0.4;
    }

    // Region preference scoring
    if (preferences.preferred_regions.includes(match.region)) {
      score += 0.2;
    }

    // GDP tier compatibility
    if (preferences.gdp_tier_preference && match.gdpTier) {
      const tierDiff = Math.abs(preferences.gdp_tier_preference - match.gdpTier);
      if (tierDiff <= preferences.gdp_tier_flexibility) {
        score += 0.15 * (1 - tierDiff / preferences.gdp_tier_flexibility);
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  calculateCulturalCompatibility(match, preferences) {
    let compatibility = 0.5; // Base compatibility

    const matchCountryData = this.countryData[match.countryCode];
    if (!matchCountryData) return compatibility;

    // Cultural affinity group compatibility
    if (preferences.cultural_affinity_groups.includes(matchCountryData.cultural_group)) {
      compatibility += 0.3;
    }

    // Language compatibility
    if (preferences.language_preferences.includes(matchCountryData.primary_language)) {
      compatibility += 0.2;
    }

    // Apply user's cultural openness
    const opennessFactor = preferences.cultural_openness_score || 0.75;
    compatibility = compatibility * opennessFactor + (1 - opennessFactor) * 0.5;

    return Math.max(0, Math.min(1, compatibility));
  }

  calculateDistancePreference(match, preferences) {
    if (!match.distance_km) return 0.5;

    const distance = match.distance_km;
    const maxPreferred = preferences.max_distance_km;
    const travelWillingness = preferences.travel_willingness_km;

    if (distance <= maxPreferred) {
      return 1.0; // Perfect distance preference
    } else if (distance <= travelWillingness) {
      return 0.5 + 0.5 * (1 - (distance - maxPreferred) / (travelWillingness - maxPreferred));
    } else {
      return 0.2; // Outside travel willingness but still possible
    }
  }

  // UTILITY METHODS

  validatePreferences(preferences) {
    const errors = [];

    // Validate country codes
    if (preferences.preferred_countries) {
      const invalidCountries = preferences.preferred_countries.filter(
        code => !this.countryData[code]
      );
      if (invalidCountries.length > 0) {
        errors.push(`Invalid country codes: ${invalidCountries.join(', ')}`);
      }
    }

    // Validate distance ranges
    if (preferences.max_distance_km && (preferences.max_distance_km < 1 || preferences.max_distance_km > 50000)) {
      errors.push('Max distance must be between 1 and 50,000 km');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  calculateCulturalOpenness(preferredCountries, culturalGroups, internationalMatching) {
    let openness = 0.5; // Base openness

    // International matching preference
    if (internationalMatching) openness += 0.2;

    // Diversity of preferred countries
    const uniqueCulturalGroups = new Set();
    preferredCountries.forEach(country => {
      const data = this.countryData[country];
      if (data) uniqueCulturalGroups.add(data.cultural_group);
    });

    openness += Math.min(0.3, uniqueCulturalGroups.size * 0.1);

    return Math.max(0, Math.min(1, openness));
  }

  generateCountryPriorityWeights(preferred, excluded, culturalGroups) {
    const weights = {};

    // Preferred countries get high weights
    preferred.forEach(country => {
      weights[country] = 1.0;
    });

    // Culturally similar countries get medium weights
    Object.entries(this.countryData).forEach(([code, data]) => {
      if (culturalGroups.includes(data.cultural_group) && !weights[code]) {
        weights[code] = 0.8;
      }
    });

    // Excluded countries get zero weight
    excluded.forEach(country => {
      weights[country] = 0.0;
    });

    return weights;
  }

  async logPreferenceChange(userId, type, oldValue, newValue, reason) {
    try {
      await query(`
        INSERT INTO user_preference_history (user_id, preference_type, old_value, new_value, change_reason)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, type, JSON.stringify(oldValue), JSON.stringify(newValue), reason]);
    } catch (error) {
      EnterpriseLogger.warn('Failed to log preference change', { userId, type, reason });
    }
  }

  // DATA INITIALIZATION

  initializeCountryData() {
    return {
      // Western Europe - Germanic Cultural Group
      'DE': { cultural_group: 'Germanic', primary_language: 'de', gdp_tier: 1, region: 'Central Europe' },
      'AT': { cultural_group: 'Germanic', primary_language: 'de', gdp_tier: 1, region: 'Central Europe' },
      'CH': { cultural_group: 'Germanic', primary_language: 'de', gdp_tier: 1, region: 'Central Europe' },
      'NL': { cultural_group: 'Germanic', primary_language: 'nl', gdp_tier: 1, region: 'Western Europe' },
      'BE': { cultural_group: 'Germanic', primary_language: 'nl', gdp_tier: 1, region: 'Western Europe' },
      
      // Nordic Countries
      'SE': { cultural_group: 'Nordic', primary_language: 'sv', gdp_tier: 1, region: 'Northern Europe' },
      'NO': { cultural_group: 'Nordic', primary_language: 'no', gdp_tier: 1, region: 'Northern Europe' },
      'DK': { cultural_group: 'Nordic', primary_language: 'da', gdp_tier: 1, region: 'Northern Europe' },
      'FI': { cultural_group: 'Nordic', primary_language: 'fi', gdp_tier: 1, region: 'Northern Europe' },
      'IS': { cultural_group: 'Nordic', primary_language: 'is', gdp_tier: 1, region: 'Northern Europe' },
      
      // Romance/Latin Countries
      'FR': { cultural_group: 'Latin', primary_language: 'fr', gdp_tier: 1, region: 'Western Europe' },
      'IT': { cultural_group: 'Latin', primary_language: 'it', gdp_tier: 2, region: 'Southern Europe' },
      'ES': { cultural_group: 'Latin', primary_language: 'es', gdp_tier: 2, region: 'Southern Europe' },
      'PT': { cultural_group: 'Latin', primary_language: 'pt', gdp_tier: 2, region: 'Southern Europe' },
      
      // Anglo Countries
      'US': { cultural_group: 'Anglo', primary_language: 'en', gdp_tier: 1, region: 'North America' },
      'GB': { cultural_group: 'Anglo', primary_language: 'en', gdp_tier: 1, region: 'Western Europe' },
      'CA': { cultural_group: 'Anglo', primary_language: 'en', gdp_tier: 1, region: 'North America' },
      'AU': { cultural_group: 'Anglo', primary_language: 'en', gdp_tier: 1, region: 'Oceania' },
      'NZ': { cultural_group: 'Anglo', primary_language: 'en', gdp_tier: 1, region: 'Oceania' },
      'IE': { cultural_group: 'Anglo', primary_language: 'en', gdp_tier: 1, region: 'Western Europe' },
      
      // Eastern Europe - Slavic
      'PL': { cultural_group: 'Slavic', primary_language: 'pl', gdp_tier: 3, region: 'Eastern Europe' },
      'CZ': { cultural_group: 'Slavic', primary_language: 'cs', gdp_tier: 2, region: 'Central Europe' },
      'HU': { cultural_group: 'Central European', primary_language: 'hu', gdp_tier: 3, region: 'Central Europe' },
      'RO': { cultural_group: 'Latin', primary_language: 'ro', gdp_tier: 3, region: 'Eastern Europe' },
      'BG': { cultural_group: 'Slavic', primary_language: 'bg', gdp_tier: 3, region: 'Eastern Europe' },
      'RU': { cultural_group: 'Slavic', primary_language: 'ru', gdp_tier: 3, region: 'Eastern Europe' },
      
      // Asia
      'JP': { cultural_group: 'East Asian', primary_language: 'ja', gdp_tier: 1, region: 'East Asia' },
      'KR': { cultural_group: 'East Asian', primary_language: 'ko', gdp_tier: 2, region: 'East Asia' },
      'CN': { cultural_group: 'East Asian', primary_language: 'zh', gdp_tier: 3, region: 'East Asia' },
      'IN': { cultural_group: 'South Asian', primary_language: 'hi', gdp_tier: 4, region: 'South Asia' },
      'TH': { cultural_group: 'Southeast Asian', primary_language: 'th', gdp_tier: 3, region: 'Southeast Asia' },
      'VN': { cultural_group: 'Southeast Asian', primary_language: 'vi', gdp_tier: 4, region: 'Southeast Asia' },
      'MY': { cultural_group: 'Southeast Asian', primary_language: 'ms', gdp_tier: 3, region: 'Southeast Asia' },
      'SG': { cultural_group: 'Southeast Asian', primary_language: 'en', gdp_tier: 1, region: 'Southeast Asia' },
      
      // Latin America
      'BR': { cultural_group: 'Latin American', primary_language: 'pt', gdp_tier: 3, region: 'South America' },
      'AR': { cultural_group: 'Latin American', primary_language: 'es', gdp_tier: 3, region: 'South America' },
      'MX': { cultural_group: 'Latin American', primary_language: 'es', gdp_tier: 3, region: 'North America' },
      'CO': { cultural_group: 'Latin American', primary_language: 'es', gdp_tier: 4, region: 'South America' },
      'CL': { cultural_group: 'Latin American', primary_language: 'es', gdp_tier: 2, region: 'South America' },
      
      // Middle East & Africa
      'EG': { cultural_group: 'Arab', primary_language: 'ar', gdp_tier: 4, region: 'Middle East' },
      'MA': { cultural_group: 'Arab', primary_language: 'ar', gdp_tier: 4, region: 'North Africa' },
      'ZA': { cultural_group: 'African', primary_language: 'en', gdp_tier: 3, region: 'Southern Africa' },
      'NG': { cultural_group: 'African', primary_language: 'en', gdp_tier: 4, region: 'West Africa' },
      'KE': { cultural_group: 'African', primary_language: 'sw', gdp_tier: 4, region: 'East Africa' },
      'GH': { cultural_group: 'African', primary_language: 'en', gdp_tier: 4, region: 'West Africa' }
    };
  }

  initializeRegionMappings() {
    return {
      'Western Europe': ['DE', 'FR', 'NL', 'BE', 'GB', 'IE', 'LU'],
      'Central Europe': ['DE', 'AT', 'CH', 'CZ', 'HU', 'SK', 'SI'],
      'Northern Europe': ['SE', 'NO', 'DK', 'FI', 'IS', 'EE', 'LV', 'LT'],
      'Southern Europe': ['IT', 'ES', 'PT', 'GR', 'MT', 'CY'],
      'Eastern Europe': ['PL', 'RO', 'BG', 'RU', 'UA', 'BY'],
      'North America': ['US', 'CA', 'MX'],
      'South America': ['BR', 'AR', 'CO', 'CL', 'PE', 'UY'],
      'East Asia': ['JP', 'KR', 'CN', 'TW', 'HK', 'MO'],
      'Southeast Asia': ['TH', 'VN', 'MY', 'SG', 'ID', 'PH'],
      'South Asia': ['IN', 'PK', 'BD', 'LK', 'NP'],
      'Oceania': ['AU', 'NZ', 'FJ', 'PG'],
      'Middle East': ['EG', 'SA', 'AE', 'QA', 'KW', 'IL'],
      'Africa': ['ZA', 'NG', 'KE', 'GH', 'MA', 'ET']
    };
  }

  initializeCulturalAffinities() {
    return {
      'Germanic': ['Nordic', 'Western European'],
      'Nordic': ['Germanic', 'Western European'],
      'Latin': ['Southern European', 'Romance', 'Latin American'],
      'Anglo': ['Western European', 'Germanic'],
      'Slavic': ['Central European', 'Eastern European'],
      'East Asian': ['East Asian'],
      'Latin American': ['Latin', 'Romance'],
      'Arab': ['Middle Eastern'],
      'African': ['African']
    };
  }

  getNeighboringRegions(countryCode) {
    const userRegion = this.findRegionForCountry(countryCode);
    if (!userRegion) return [];

    // Define neighboring regions
    const neighbors = {
      'Western Europe': ['Central Europe', 'Northern Europe', 'Southern Europe'],
      'Central Europe': ['Western Europe', 'Eastern Europe', 'Northern Europe'],
      'Northern Europe': ['Western Europe', 'Central Europe', 'Eastern Europe'],
      'Southern Europe': ['Western Europe', 'Central Europe'],
      'Eastern Europe': ['Central Europe', 'Northern Europe'],
      'North America': ['South America'],
      'South America': ['North America'],
      'East Asia': ['Southeast Asia'],
      'Southeast Asia': ['East Asia', 'South Asia'],
      'South Asia': ['Southeast Asia', 'Middle East']
    };

    return neighbors[userRegion] || [];
  }

  findRegionForCountry(countryCode) {
    for (const [region, countries] of Object.entries(this.regionMappings)) {
      if (countries.includes(countryCode)) {
        return region;
      }
    }
    return null;
  }

  getDefaultDistanceForCountry(countryCode) {
    // Larger countries get larger default search radius
    const largeCountries = ['US', 'CA', 'BR', 'AU', 'RU', 'CN', 'IN'];
    const mediumCountries = ['DE', 'FR', 'IT', 'ES', 'PL', 'MX', 'AR'];
    
    if (largeCountries.includes(countryCode)) return 500;
    if (mediumCountries.includes(countryCode)) return 200;
    return 100; // Small countries
  }

  getDefaultTravelWillingness(countryCode) {
    // High GDP countries typically have higher travel willingness
    const countryData = this.countryData[countryCode];
    if (!countryData) return 500;
    
    switch (countryData.gdp_tier) {
      case 1: return 1000; // Tier 1 countries
      case 2: return 750;  // Tier 2 countries
      case 3: return 500;  // Tier 3 countries
      case 4: return 300;  // Tier 4 countries
      default: return 500;
    }
  }

  getBasicDefaults(userId, userCountry) {
    return {
      userId,
      preferred_countries: [userCountry],
      excluded_countries: [],
      preferred_regions: [],
      max_distance_km: 100,
      cultural_affinity_groups: [],
      language_preferences: ['en'],
      international_matching: true,
      basic_defaults: true,
      enterprise: true
    };
  }

  parseJSON(jsonString) {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }

  async seedCountryRegionData() {
    // This would seed the countries table with the data
    // For now, we'll skip the actual seeding to avoid database conflicts
    EnterpriseLogger.info('Country region data seeding skipped (data available in memory)', null, {
      countries: Object.keys(this.countryData).length,
      regions: Object.keys(this.regionMappings).length
    });
  }

  // HEALTH CHECK
  async healthCheck() {
    try {
      return {
        status: 'healthy',
        service: 'Enterprise Region Preference Service',
        initialized: this.isInitialized,
        countries: Object.keys(this.countryData).length,
        regions: Object.keys(this.regionMappings).length,
        culturalGroups: Object.keys(this.culturalAffinities).length,
        features: [
          'Hierarchical preferences',
          'Cultural compatibility scoring',
          'Intelligent defaults',
          'Learning & adaptation',
          'Multi-language support'
        ],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        service: 'Enterprise Region Preference Service',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new EnterpriseRegionPreferenceService();