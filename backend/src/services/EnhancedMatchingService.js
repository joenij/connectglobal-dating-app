const User = require('../models/User');
const Match = require('../models/Match');
const EnterpriseGeolocationService = require('./EnterpriseGeolocationService');
const EnterpriseLogger = require('./EnterpriseLoggerService');

class EnhancedMatchingService {
  constructor() {
    this.COMPATIBILITY_WEIGHTS = {
      cultural: 0.25,
      lifestyle: 0.20,
      economic: 0.15,
      timezone: 0.10,
      interests: 0.15,
      values: 0.15
    };

    this.CULTURAL_FACTORS = {
      same_country: 0.8,
      same_language: 0.7,
      similar_background: 0.6,
      openness_match: 0.5
    };
  }

  /**
   * Advanced matching algorithm with AI-powered compatibility scoring
   */
  async findMatches(userId, options = {}) {
    try {
      const {
        limit = 10,
        maxDistance = 50,
        includeInternational = true,
        minCompatibilityScore = 0.3
      } = options;

      // Get current user profile
      const currentUser = await User.getFullProfile(userId);
      if (!currentUser) {
        throw new Error('User not found');
      }

      // Get potential matches with advanced filtering
      const potentialMatches = await this.getPotentialMatches(
        currentUser, 
        { maxDistance, includeInternational }
      );

      // Calculate compatibility scores for each potential match
      const scoredMatches = await Promise.all(
        potentialMatches.map(async (candidate) => {
          const score = await this.calculateCompatibilityScore(currentUser, candidate);
          return {
            ...candidate,
            compatibility_score: score.total,
            score_breakdown: score.breakdown
          };
        })
      );

      // Filter and sort by compatibility
      return scoredMatches
        .filter(match => match.compatibility_score >= minCompatibilityScore)
        .sort((a, b) => b.compatibility_score - a.compatibility_score)
        .slice(0, limit);

    } catch (error) {
      EnterpriseLogger.error('Enhanced matching failed', error, { userId });
      throw error;
    }
  }

  /**
   * AI-powered compatibility scoring system
   */
  async calculateCompatibilityScore(user1, user2) {
    const scores = {
      cultural: await this.calculateCulturalScore(user1, user2),
      lifestyle: await this.calculateLifestyleScore(user1, user2),
      economic: await this.calculateEconomicScore(user1, user2),
      timezone: await this.calculateTimezoneScore(user1, user2),
      interests: await this.calculateInterestsScore(user1, user2),
      values: await this.calculateValuesScore(user1, user2)
    };

    // Calculate weighted total score
    const totalScore = Object.keys(scores).reduce((total, factor) => {
      return total + (scores[factor] * this.COMPATIBILITY_WEIGHTS[factor]);
    }, 0);

    return {
      total: Math.round(totalScore * 10000) / 10000, // Round to 4 decimal places
      breakdown: scores
    };
  }

  /**
   * Cultural compatibility scoring
   */
  async calculateCulturalScore(user1, user2) {
    let score = 0;
    let factors = 0;

    // Same country bonus
    if (user1.country_code === user2.country_code) {
      score += this.CULTURAL_FACTORS.same_country;
      factors++;
    }

    // Language compatibility
    const user1Languages = new Set([user1.primary_language, ...(user1.spoken_languages || [])]);
    const user2Languages = new Set([user2.primary_language, ...(user2.spoken_languages || [])]);
    const commonLanguages = new Set([...user1Languages].filter(x => user2Languages.has(x)));
    
    if (commonLanguages.size > 0) {
      score += this.CULTURAL_FACTORS.same_language * (commonLanguages.size / Math.max(user1Languages.size, user2Languages.size));
      factors++;
    }

    // Cultural background similarity
    if (user1.cultural_background && user2.cultural_background) {
      const similarity = this.calculateObjectSimilarity(user1.cultural_background, user2.cultural_background);
      score += this.CULTURAL_FACTORS.similar_background * similarity;
      factors++;
    }

    // Cultural openness compatibility
    const opennessDiff = Math.abs((user1.cultural_openness_score || 5) - (user2.cultural_openness_score || 5));
    const opennessScore = Math.max(0, 1 - (opennessDiff / 10));
    score += this.CULTURAL_FACTORS.openness_match * opennessScore;
    factors++;

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Lifestyle compatibility scoring
   */
  async calculateLifestyleScore(user1, user2) {
    const factors = [
      'relationship_goals',
      'education_level',
      'drinking',
      'smoking',
      'religion',
      'politics'
    ];

    let matches = 0;
    let total = 0;

    factors.forEach(factor => {
      if (user1[factor] && user2[factor]) {
        total++;
        if (user1[factor] === user2[factor]) {
          matches++;
        } else if (this.isCompatibleValue(factor, user1[factor], user2[factor])) {
          matches += 0.5; // Partial compatibility
        }
      }
    });

    // Children compatibility
    if (user1.has_children !== undefined && user2.has_children !== undefined) {
      total++;
      if (user1.has_children === user2.has_children) {
        matches++;
      }
    }

    if (user1.wants_children && user2.wants_children) {
      total++;
      if (user1.wants_children === user2.wants_children) {
        matches++;
      }
    }

    return total > 0 ? matches / total : 0;
  }

  /**
   * Economic compatibility scoring
   */
  async calculateEconomicScore(user1, user2) {
    let score = 0;
    let factors = 0;

    // GDP tier compatibility
    if (user1.gdp_pricing_tier && user2.gdp_pricing_tier) {
      const tierDiff = Math.abs(user1.gdp_pricing_tier - user2.gdp_pricing_tier);
      score += Math.max(0, 1 - (tierDiff / 3)); // Max difference is 3 tiers
      factors++;
    }

    // Income range compatibility
    if (user1.income_range && user2.income_range) {
      const compatibility = this.calculateIncomeCompatibility(user1.income_range, user2.income_range);
      score += compatibility;
      factors++;
    }

    // Financial goals alignment
    if (user1.financial_goals && user2.financial_goals) {
      const similarity = this.calculateObjectSimilarity(user1.financial_goals, user2.financial_goals);
      score += similarity;
      factors++;
    }

    return factors > 0 ? score / factors : 0.5; // Default to neutral if no data
  }

  /**
   * Timezone compatibility scoring
   */
  async calculateTimezoneScore(user1, user2) {
    if (!user1.timezone || !user2.timezone) return 0.5;

    try {
      const tz1 = new Date().toLocaleString("en-US", { timeZone: user1.timezone });
      const tz2 = new Date().toLocaleString("en-US", { timeZone: user2.timezone });
      
      const hoursDiff = Math.abs(new Date(tz1).getHours() - new Date(tz2).getHours());
      const adjustedDiff = Math.min(hoursDiff, 24 - hoursDiff);
      
      // Score decreases with timezone difference
      return Math.max(0, 1 - (adjustedDiff / 12));
    } catch (error) {
      return 0.5;
    }
  }

  /**
   * Interests compatibility scoring
   */
  async calculateInterestsScore(user1, user2) {
    const interests1 = new Set(user1.interests || []);
    const interests2 = new Set(user2.interests || []);
    
    if (interests1.size === 0 && interests2.size === 0) return 0.5;
    if (interests1.size === 0 || interests2.size === 0) return 0.3;

    const commonInterests = new Set([...interests1].filter(x => interests2.has(x)));
    const totalInterests = new Set([...interests1, ...interests2]);
    
    return commonInterests.size / totalInterests.size;
  }

  /**
   * Values compatibility scoring
   */
  async calculateValuesScore(user1, user2) {
    // This would integrate with a values assessment system
    // For now, use lifestyle preferences as a proxy
    
    if (!user1.lifestyle_preferences || !user2.lifestyle_preferences) return 0.5;
    
    return this.calculateObjectSimilarity(user1.lifestyle_preferences, user2.lifestyle_preferences);
  }

  /**
   * Get potential matches based on basic criteria
   */
  async getPotentialMatches(user, options) {
    const { maxDistance, includeInternational } = options;

    let query = `
      SELECT DISTINCT u.*, up.*
      FROM users u
      JOIN user_profiles up ON u.id = up.user_id
      WHERE u.id != ? 
        AND u.is_active = true 
        AND u.is_banned = false
        AND up.looking_for_gender = ?
        AND u.date_of_birth BETWEEN ? AND ?
    `;

    const params = [
      user.id,
      user.gender,
      new Date(new Date().getFullYear() - user.age_range_max, 0, 1),
      new Date(new Date().getFullYear() - user.age_range_min, 11, 31)
    ];

    // Add location filtering if coordinates available
    if (user.coordinates && maxDistance) {
      if (includeInternational) {
        query += ` AND (ST_DWithin(u.coordinates, ?, ?) OR u.country_code != ?)`;
        params.push(user.coordinates, maxDistance * 1000, user.country_code);
      } else {
        query += ` AND ST_DWithin(u.coordinates, ?, ?)`;
        params.push(user.coordinates, maxDistance * 1000);
      }
    }

    // Exclude already matched users
    query += ` AND u.id NOT IN (
      SELECT CASE 
        WHEN user1_id = ? THEN user2_id 
        ELSE user1_id 
      END
      FROM user_matches 
      WHERE (user1_id = ? OR user2_id = ?) 
        AND status IN ('pending', 'mutual')
    )`;

    params.push(user.id, user.id, user.id);

    return await User.query(query, params);
  }

  /**
   * Helper: Calculate similarity between two objects
   */
  calculateObjectSimilarity(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    const allKeys = new Set([...keys1, ...keys2]);
    
    if (allKeys.size === 0) return 0;
    
    let matches = 0;
    allKeys.forEach(key => {
      if (obj1[key] === obj2[key]) {
        matches++;
      }
    });
    
    return matches / allKeys.size;
  }

  /**
   * Helper: Check if two values are compatible for a given factor
   */
  isCompatibleValue(factor, value1, value2) {
    const compatibilityMap = {
      drinking: {
        'never': ['never', 'rarely'],
        'rarely': ['never', 'rarely', 'socially'],
        'socially': ['rarely', 'socially', 'regularly'],
        'regularly': ['socially', 'regularly']
      },
      smoking: {
        'never': ['never'],
        'socially': ['never', 'socially'],
        'regularly': ['socially', 'regularly']
      },
      politics: {
        'liberal': ['liberal', 'moderate'],
        'moderate': ['liberal', 'conservative', 'moderate'],
        'conservative': ['conservative', 'moderate']
      }
    };

    if (compatibilityMap[factor] && compatibilityMap[factor][value1]) {
      return compatibilityMap[factor][value1].includes(value2);
    }

    return false;
  }

  /**
   * Helper: Calculate income range compatibility
   */
  calculateIncomeCompatibility(range1, range2) {
    const ranges = [
      'under_25k', '25k_50k', '50k_75k', '75k_100k', 
      '100k_150k', '150k_200k', '200k_plus'
    ];

    const index1 = ranges.indexOf(range1);
    const index2 = ranges.indexOf(range2);
    
    if (index1 === -1 || index2 === -1) return 0.5;
    
    const diff = Math.abs(index1 - index2);
    return Math.max(0, 1 - (diff / (ranges.length - 1)));
  }
}

module.exports = new EnhancedMatchingService();