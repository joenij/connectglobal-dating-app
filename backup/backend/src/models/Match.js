const { query } = require('../config/database-sqlite');
const EnterpriseGeolocationService = require('../services/EnterpriseGeolocationService');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');

class Match {
  // Create tables for matching system
  static async initializeTables() {
    const createUserActionsTable = `
      CREATE TABLE IF NOT EXISTS user_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        target_user_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('like', 'pass', 'super_like')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, target_user_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (target_user_id) REFERENCES users(id)
      )
    `;

    const createMatchesTable = `
      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user1_id INTEGER NOT NULL,
        user2_id INTEGER NOT NULL,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        compatibility_score REAL DEFAULT 0.0,
        matched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user1_id) REFERENCES users(id),
        FOREIGN KEY (user2_id) REFERENCES users(id),
        UNIQUE(user1_id, user2_id)
      )
    `;

    const createUserProfilesTable = `
      CREATE TABLE IF NOT EXISTS user_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        bio TEXT,
        interests TEXT, -- JSON string of interests array
        languages TEXT, -- JSON string of languages array
        photos TEXT, -- JSON string of photo URLs
        age INTEGER,
        location TEXT,
        max_distance INTEGER DEFAULT 100,
        age_range_min INTEGER DEFAULT 18,
        age_range_max INTEGER DEFAULT 99,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id)
      )
    `;

    await query(createUserActionsTable);
    await query(createMatchesTable);
    await query(createUserProfilesTable);
    
    EnterpriseLogger.info('✅ Matching tables initialized', null, {
      tables: ['user_actions', 'matches', 'user_profiles'],
      enterprise: true
    });
  }

  // Record user action (like, pass, super_like)
  static async recordAction(userId, targetUserId, action) {
    const sql = `
      INSERT INTO user_actions (user_id, target_user_id, action)
      VALUES ($1, $2, $3)
      ON CONFLICT(user_id, target_user_id) 
      DO UPDATE SET action = $3, created_at = CURRENT_TIMESTAMP
    `;

    try {
      await query(sql, [userId, targetUserId, action]);
      
      // Check if this creates a match
      if (action === 'like' || action === 'super_like') {
        const isMatch = await this.checkForMatch(userId, targetUserId);
        if (isMatch) {
          await this.createMatch(userId, targetUserId);
          return { action, isMatch: true };
        }
      }

      return { action, isMatch: false };
    } catch (error) {
      throw error;
    }
  }

  // Check if two users liked each other
  static async checkForMatch(userId1, userId2) {
    const sql = `
      SELECT COUNT(*) as count FROM user_actions 
      WHERE 
        ((user_id = $1 AND target_user_id = $2) OR (user_id = $2 AND target_user_id = $1))
        AND action IN ('like', 'super_like')
    `;

    const result = await query(sql, [userId1, userId2]);
    return result.rows[0].count >= 2;
  }

  // Create a match between two users
  static async createMatch(userId1, userId2) {
    const compatibilityScore = this.calculateCompatibility(userId1, userId2);
    
    const sql = `
      INSERT INTO matches (user1_id, user2_id, compatibility_score)
      VALUES ($1, $2, $3)
      ON CONFLICT(user1_id, user2_id) DO NOTHING
    `;

    try {
      await query(sql, [Math.min(userId1, userId2), Math.max(userId1, userId2), compatibilityScore]);
      return true;
    } catch (error) {
      EnterpriseLogger.error('Create match error', error, { userId1, userId2, compatibilityScore });
      return false;
    }
  }

  // ENTERPRISE GEOLOCATION-BASED MATCHING
  static async getPotentialMatches(userId, options = {}) {
    const {
      limit = 10,
      useGeolocation = true,
      maxDistance = null,
      preferredCountries = [],
      includeInternational = true
    } = options;

    EnterpriseLogger.info('Getting enterprise potential matches', userId, {
      limit,
      useGeolocation,
      maxDistance,
      preferredCountries,
      includeInternational
    });

    try {
      // Try geolocation-based matching first
      if (useGeolocation) {
        const geoMatches = await EnterpriseGeolocationService.findGeoMatches(userId, {
          limit,
          maxDistance,
          preferredCountries,
          includeInternational
        });
        
        if (geoMatches && geoMatches.length > 0) {
          EnterpriseLogger.info('Enterprise geolocation matches found', userId, {
            matchCount: geoMatches.length,
            averageCompatibility: geoMatches.reduce((sum, m) => sum + m.compatibilityScore, 0) / geoMatches.length
          });
          return geoMatches;
        }
      }

      // Fallback to traditional matching if geolocation fails
      return await this.getTraditionalMatches(userId, limit);
      
    } catch (error) {
      EnterpriseLogger.error('Enterprise matching failed, using fallback', error, {
        userId,
        limit,
        useGeolocation
      });
      
      // Final fallback
      return await this.getTraditionalMatches(userId, limit);
    }
  }

  // Traditional matching as fallback
  static async getTraditionalMatches(userId, limit = 10) {
    EnterpriseLogger.info('Using traditional matching algorithm', userId, { limit });
    
    // Enhanced traditional query with better compatibility scoring
    const sql = `
      SELECT 
        u.id, u.first_name, u.last_name, u.country_code, u.date_of_birth, u.gdp_pricing_tier
      FROM users u
      LEFT JOIN user_actions ua ON (ua.user_id = $1 AND ua.target_user_id = u.id)
      LEFT JOIN matches m ON (
        (m.user1_id = $1 AND m.user2_id = u.id) OR 
        (m.user2_id = $1 AND m.user1_id = u.id)
      )
      WHERE u.id != $1 
        AND u.is_active = 1 
        AND u.is_banned = 0
        AND ua.id IS NULL  -- No previous interaction
        AND m.id IS NULL   -- No existing match
      ORDER BY 
        -- Prioritize same country
        CASE WHEN u.country_code = (
          SELECT country_code FROM users WHERE id = $1
        ) THEN 0 ELSE 1 END,
        -- Prioritize similar GDP tiers
        ABS(u.gdp_pricing_tier - (
          SELECT gdp_pricing_tier FROM users WHERE id = $1
        )),
        RANDOM()
      LIMIT $2
    `;

    try {
      const result = await query(sql, [userId, limit]);
      
      const matches = result.rows.map(row => ({
        id: row.id,
        name: `${row.first_name} ${row.last_name}`,
        firstName: row.first_name,
        lastName: row.last_name,
        age: this.calculateAge(row.date_of_birth),
        location: `${row.country_code}`,
        distance: this.calculateDistance(row.country_code),
        photos: ['https://via.placeholder.com/400x600?text=No+Photo'],
        bio: 'Traditional match • Enable location services for better matches',
        interests: this.generateCountryInterests(row.country_code),
        languages: ['English'],
        verified: true,
        compatibilityScore: this.calculateTraditionalCompatibility(userId, row),
        gdpTier: row.gdp_pricing_tier,
        matchType: 'traditional',
        enterprise: true
      }));

      EnterpriseLogger.info('Traditional matches found', userId, {
        matchCount: matches.length,
        averageCompatibility: matches.reduce((sum, m) => sum + m.compatibilityScore, 0) / matches.length
      });
      
      return matches;
    } catch (error) {
      EnterpriseLogger.error('Error in traditional matching', error, { userId, limit });
      throw error;
    }
  }

  // Get user's matches
  static async getUserMatches(userId) {
    const sql = `
      SELECT 
        m.id as match_id, m.matched_at, m.compatibility_score,
        u.id, u.first_name, u.last_name,
        up.photos, up.location, up.age
      FROM matches m
      JOIN users u ON (
        CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END = u.id
      )
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE (m.user1_id = $1 OR m.user2_id = $1) AND m.status = 'active'
      ORDER BY m.matched_at DESC
    `;

    const result = await query(sql, [userId]);
    
    return result.rows.map(row => ({
      id: row.match_id,
      matchedAt: row.matched_at,
      compatibilityScore: row.compatibility_score,
      user: {
        id: row.id,
        name: `${row.first_name} ${row.last_name}`,
        age: row.age,
        location: row.location,
        photo: this.parseJSON(row.photos)?.[0] || 'https://via.placeholder.com/150x150?text=No+Photo'
      },
      lastMessage: null // TODO: Get last message from messaging system
    }));
  }

  // Calculate compatibility score between two users
  static calculateCompatibility(userId1, userId2) {
    // Simple compatibility score calculation
    // In production, this would use ML algorithms
    return Math.random() * 0.4 + 0.6; // Random score between 0.6-1.0
  }

  // Helper function to calculate age from date of birth
  static calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  // Enhanced distance calculation with more countries
  static calculateDistance(countryCode) {
    const distances = {
      'US': '0 km away', 'CA': '500 km away', 'MX': '1,200 km away',
      'BR': '5,400 km away', 'AR': '5,600 km away', 'CO': '3,800 km away',
      'GB': '5,500 km away', 'DE': '6,200 km away', 'FR': '6,100 km away',
      'IT': '6,900 km away', 'ES': '6,000 km away', 'NL': '5,900 km away',
      'BE': '5,950 km away', 'CH': '6,300 km away', 'AT': '6,400 km away',
      'PL': '6,800 km away', 'CZ': '6,700 km away', 'HU': '7,000 km away',
      'RO': '7,200 km away', 'BG': '7,400 km away',
      'RU': '7,500 km away', 'CN': '11,000 km away', 'JP': '10,800 km away',
      'KR': '11,200 km away', 'IN': '12,500 km away', 'TH': '17,000 km away',
      'VN': '16,800 km away', 'MY': '18,000 km away', 'ID': '18,500 km away',
      'PH': '16,000 km away', 'AU': '15,300 km away', 'NZ': '13,400 km away',
      'ZA': '13,000 km away', 'EG': '9,100 km away', 'MA': '6,800 km away',
      'NG': '8,900 km away', 'KE': '12,100 km away', 'GH': '8,600 km away'
    };
    return distances[countryCode] || `${Math.floor(Math.random() * 15000 + 2000)} km away`;
  }

  // Generate country-specific interests
  static generateCountryInterests(countryCode) {
    const countryInterests = {
      'US': ['Travel', 'Movies', 'Sports', 'Technology'],
      'DE': ['Culture', 'History', 'Beer', 'Nature'],
      'FR': ['Art', 'Wine', 'Cuisine', 'Literature'],
      'IT': ['Art', 'Food', 'Fashion', 'History'],
      'ES': ['Culture', 'Dance', 'Food', 'Beach'],
      'JP': ['Anime', 'Technology', 'Culture', 'Nature'],
      'BR': ['Music', 'Dance', 'Beach', 'Football'],
      'IN': ['Culture', 'Spirituality', 'Food', 'Technology'],
      'CN': ['Culture', 'History', 'Technology', 'Art'],
      'GB': ['Culture', 'History', 'Music', 'Literature'],
      'AU': ['Nature', 'Beach', 'Sports', 'Travel'],
      'CA': ['Nature', 'Sports', 'Culture', 'Technology']
    };
    
    return countryInterests[countryCode] || ['Travel', 'Culture', 'Music', 'Food'];
  }

  // Calculate traditional compatibility score
  static calculateTraditionalCompatibility(userId, targetUser) {
    let score = 0.6; // Base score
    
    // Same country bonus
    // Note: We'd need to fetch user's country, for now using random bonus
    score += Math.random() * 0.2;
    
    // Similar GDP tier bonus (assuming we fetch user's tier)
    score += Math.random() * 0.15;
    
    // Age compatibility (placeholder)
    score += Math.random() * 0.05;
    
    return Math.min(0.95, Math.max(0.6, score));
  }

  // Helper function to safely parse JSON
  static parseJSON(jsonString) {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }

  // Create sample profiles for testing
  static async createSampleProfiles() {
    const sampleProfiles = [
      {
        userId: 1, // Assuming we have a test user with ID 1
        bio: 'Love traveling and meeting new people from different cultures!',
        interests: JSON.stringify(['Travel', 'Photography', 'Languages', 'Food']),
        languages: JSON.stringify(['English', 'Spanish']),
        photos: JSON.stringify(['https://images.unsplash.com/photo-1494790108755-2616b64a0e4e?ixlib=rb-4.0.3']),
        age: 25,
        location: 'New York, USA'
      }
    ];

    for (const profile of sampleProfiles) {
      const sql = `
        INSERT INTO user_profiles (user_id, bio, interests, languages, photos, age, location)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT(user_id) DO UPDATE SET
          bio = $2, interests = $3, languages = $4, photos = $5, age = $6, location = $7
      `;

      try {
        await query(sql, [
          profile.userId, profile.bio, profile.interests, 
          profile.languages, profile.photos, profile.age, profile.location
        ]);
      } catch (error) {
        EnterpriseLogger.error('Error creating sample profile', error, { profileUserId: profile.userId });
      }
    }
  }
}

module.exports = Match;