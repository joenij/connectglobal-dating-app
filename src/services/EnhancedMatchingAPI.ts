import apiClient from './api/client';
import FrontendLogger from './FrontendLogger';

export interface CompatibilityScore {
  total: number;
  breakdown: {
    cultural: number;
    lifestyle: number;
    economic: number;
    timezone: number;
    interests: number;
    values: number;
  };
}

export interface EnhancedMatch {
  id: string;
  first_name: string;
  age: number;
  profile_picture: string;
  bio: string;
  location: string;
  distance_km?: number;
  compatibility_score: number;
  score_breakdown: CompatibilityScore['breakdown'];
  interests: string[];
  occupation: string;
  education_level: string;
  relationship_goals: string;
  country_code: string;
  timezone: string;
}

export interface MatchingOptions {
  limit?: number;
  maxDistance?: number;
  includeInternational?: boolean;
  minCompatibilityScore?: number;
  useEnhancedMatching?: boolean;
}

export interface MatchingResponse {
  profiles: EnhancedMatch[];
  totalCount: number;
  matchingType: string;
  searchCriteria: MatchingOptions;
  matchingFeatures: {
    aiCompatibilityScoring: boolean;
    culturalCompatibility: boolean;
    lifestyleMatching: boolean;
    timezoneBased: boolean;
    interestsAlignment: boolean;
  };
  statistics: {
    averageCompatibility: number;
    highCompatibilityMatches: number;
    culturalMatches: number;
    lifestyleMatches: number;
  };
  enterprise: boolean;
}

export interface MatchActionResult {
  action: 'like' | 'pass' | 'super_like';
  targetUserId: string;
  isMatch: boolean;
  message: string;
  matchId?: string;
  notificationSent: boolean;
}

class EnhancedMatchingAPI {
  /**
   * Discover potential matches using AI-powered compatibility scoring
   */
  async discoverMatches(options: MatchingOptions = {}): Promise<MatchingResponse> {
    try {
      const params = new URLSearchParams({
        limit: (options.limit || 10).toString(),
        maxDistance: (options.maxDistance || 50).toString(),
        includeInternational: (options.includeInternational ?? true).toString(),
        minCompatibilityScore: (options.minCompatibilityScore || 0.3).toString(),
        useEnhancedMatching: (options.useEnhancedMatching ?? true).toString()
      });

      const response = await apiClient.get(`/matching/discover?${params}`);
      FrontendLogger.api.requestCompleted('GET', '/matching/discover', response.status);
      return response.data;
    } catch (error) {
      FrontendLogger.api.requestFailed('GET', '/matching/discover', error);
      throw error;
    }
  }

  /**
   * Perform match action (like, pass, super_like) with push notifications
   */
  async performMatchAction(targetUserId: string, action: 'like' | 'pass' | 'super_like'): Promise<MatchActionResult> {
    try {
      const response = await apiClient.post('/matching/action', {
        targetUserId,
        action
      });
      FrontendLogger.api.requestCompleted('POST', '/matching/action', response.status);
      return response.data;
    } catch (error) {
      FrontendLogger.api.requestFailed('POST', '/matching/action', error);
      throw error;
    }
  }

  /**
   * Get user's existing matches
   */
  async getMatches(): Promise<{ matches: EnhancedMatch[]; totalCount: number }> {
    try {
      const response = await apiClient.get('/matching/matches');
      return response.data;
    } catch (error) {
      console.error('Get matches failed:', error);
      throw error;
    }
  }

  /**
   * Update user location for geolocation-based matching
   */
  async updateLocation(locationData: {
    latitude: number;
    longitude: number;
    country_code: string;
    country_name?: string;
    city?: string;
    privacy_level?: 'exact' | 'neighborhood' | 'city' | 'region' | 'country';
    search_radius_km?: number;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post('/matching/location', locationData);
      return response.data;
    } catch (error) {
      console.error('Location update failed:', error);
      throw error;
    }
  }

  /**
   * Update matching preferences
   */
  async updatePreferences(preferences: {
    preferred_countries?: string[];
    excluded_countries?: string[];
    max_distance_km?: number;
    cultural_affinity_groups?: string[];
    language_preferences?: string[];
    international_matching?: boolean;
    gdp_tier_preference?: number;
    travel_willingness_km?: number;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post('/matching/preferences', preferences);
      return response.data;
    } catch (error) {
      console.error('Preferences update failed:', error);
      throw error;
    }
  }

  /**
   * Get user's current matching preferences
   */
  async getPreferences(): Promise<any> {
    try {
      const response = await apiClient.get('/matching/preferences');
      return response.data;
    } catch (error) {
      console.error('Get preferences failed:', error);
      throw error;
    }
  }

  /**
   * Get intelligent preference suggestions
   */
  async getPreferenceSuggestions(country?: string): Promise<any> {
    try {
      const params = country ? `?country=${country}` : '';
      const response = await apiClient.get(`/matching/preferences/suggestions${params}`);
      return response.data;
    } catch (error) {
      console.error('Get preference suggestions failed:', error);
      throw error;
    }
  }

  /**
   * Calculate compatibility score between current user and target
   */
  calculateCompatibilityDisplay(score: number): {
    percentage: string;
    color: string;
    label: string;
    emoji: string;
  } {
    const percentage = Math.round(score * 100);
    
    if (percentage >= 90) {
      return {
        percentage: `${percentage}%`,
        color: '#00C851',
        label: 'Excellent Match',
        emoji: '💯'
      };
    } else if (percentage >= 80) {
      return {
        percentage: `${percentage}%`,
        color: '#4CAF50',
        label: 'Great Match',
        emoji: '🔥'
      };
    } else if (percentage >= 70) {
      return {
        percentage: `${percentage}%`,
        color: '#2196F3',
        label: 'Good Match',
        emoji: '⭐'
      };
    } else if (percentage >= 50) {
      return {
        percentage: `${percentage}%`,
        color: '#FF9800',
        label: 'Fair Match',
        emoji: '👍'
      };
    } else {
      return {
        percentage: `${percentage}%`,
        color: '#9E9E9E',
        label: 'Low Match',
        emoji: '🤔'
      };
    }
  }

  /**
   * Get compatibility factor explanations
   */
  getCompatibilityFactorInfo(factorName: keyof CompatibilityScore['breakdown']): {
    name: string;
    description: string;
    icon: string;
  } {
    const factorInfo = {
      cultural: {
        name: 'Cultural Compatibility',
        description: 'Shared cultural background, languages, and openness to different cultures',
        icon: '🌍'
      },
      lifestyle: {
        name: 'Lifestyle Match',
        description: 'Similar life goals, values, habits, and relationship expectations',
        icon: '🏡'
      },
      economic: {
        name: 'Economic Compatibility',
        description: 'Compatible income levels, financial goals, and economic circumstances',
        icon: '💰'
      },
      timezone: {
        name: 'Timezone Alignment',
        description: 'How well your schedules and time zones work for communication',
        icon: '⏰'
      },
      interests: {
        name: 'Common Interests',
        description: 'Shared hobbies, activities, and things you both enjoy',
        icon: '🎯'
      },
      values: {
        name: 'Core Values',
        description: 'Fundamental beliefs, priorities, and life philosophy alignment',
        icon: '💝'
      }
    };

    return factorInfo[factorName];
  }
}

export default new EnhancedMatchingAPI();