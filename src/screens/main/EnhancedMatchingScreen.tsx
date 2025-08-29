import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import EnhancedMatchCard from '../../components/matching/EnhancedMatchCard';
import EnhancedMatchingAPI, { 
  EnhancedMatch, 
  MatchingOptions,
  MatchingResponse 
} from '../../services/EnhancedMatchingAPI';
import FrontendLogger from '../../services/FrontendLogger';

const EnhancedMatchingScreen: React.FC = () => {
  const [matches, setMatches] = useState<EnhancedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchingStats, setMatchingStats] = useState<MatchingResponse['statistics'] | null>(null);
  const [matchingOptions, setMatchingOptions] = useState<MatchingOptions>({
    limit: 10,
    maxDistance: 50,
    includeInternational: true,
    minCompatibilityScore: 0.3,
    useEnhancedMatching: true
  });

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      FrontendLogger.matching.discoveryRequest(matchingOptions);
      const response = await EnhancedMatchingAPI.discoverMatches(matchingOptions);
      
      setMatches(response.profiles);
      setMatchingStats(response.statistics);
      setCurrentIndex(0);

      FrontendLogger.matching.discoveryCompleted({
        count: response.profiles.length,
        avgCompatibility: response.statistics.averageCompatibility,
        matchingType: response.matchingType
      });

    } catch (error) {
      FrontendLogger.matching.discoveryFailed(error, matchingOptions);
      Alert.alert(
        'Loading Error',
        'Failed to load matches. Please try again.',
        [{ text: 'OK', onPress: () => {} }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMatchAction = async (
    targetUserId: string, 
    action: 'like' | 'pass' | 'super_like'
  ) => {
    try {
      FrontendLogger.info('Matching', `${action} action initiated`, { targetUserId });
      
      const result = await EnhancedMatchingAPI.performMatchAction(targetUserId, action);
      
      FrontendLogger.matching.actionPerformed(action, targetUserId, result.isMatch);
      
      if (result.isMatch) {
        Alert.alert(
          '🎉 It\'s a Match!',
          result.message,
          [
            { 
              text: 'Send Message', 
              onPress: () => {
                FrontendLogger.info('Navigation', 'Navigate to messages from match', { matchId: result.matchId });
              }
            },
            { 
              text: 'Continue Matching', 
              onPress: () => moveToNextProfile()
            }
          ]
        );
      } else {
        moveToNextProfile();
      }

      // Load more matches if running low
      if (currentIndex >= matches.length - 2) {
        loadMatches();
      }

    } catch (error) {
      FrontendLogger.matching.actionFailed(error, targetUserId, action);
      Alert.alert(
        'Action Failed',
        'Failed to process your action. Please try again.'
      );
    }
  };

  const moveToNextProfile = () => {
    if (currentIndex < matches.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Load more matches
      loadMatches();
    }
  };

  const handleLike = () => {
    const currentMatch = matches[currentIndex];
    if (currentMatch) {
      handleMatchAction(currentMatch.id, 'like');
    }
  };

  const handlePass = () => {
    const currentMatch = matches[currentIndex];
    if (currentMatch) {
      handleMatchAction(currentMatch.id, 'pass');
    }
  };

  const handleSuperLike = () => {
    const currentMatch = matches[currentIndex];
    if (currentMatch) {
      Alert.alert(
        '⭐ Super Like',
        'Are you sure you want to use a Super Like? This will notify the person immediately.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Super Like', 
            onPress: () => handleMatchAction(currentMatch.id, 'super_like')
          }
        ]
      );
    }
  };

  const handleViewProfile = () => {
    const currentMatch = matches[currentIndex];
    if (currentMatch) {
      FrontendLogger.info('Navigation', 'View full profile requested', { 
        userId: currentMatch.id,
        compatibilityScore: currentMatch.compatibility_score 
      });
      // Navigate to full profile screen
    }
  };

  const toggleMatchingSettings = () => {
    Alert.alert(
      'Matching Settings',
      'Adjust your matching preferences',
      [
        {
          text: 'Distance: ' + matchingOptions.maxDistance + 'km',
          onPress: () => {
            // Open distance picker
          }
        },
        {
          text: 'International: ' + (matchingOptions.includeInternational ? 'On' : 'Off'),
          onPress: () => {
            setMatchingOptions(prev => ({
              ...prev,
              includeInternational: !prev.includeInternational
            }));
            loadMatches();
          }
        },
        {
          text: 'Min Compatibility: ' + Math.round((matchingOptions.minCompatibilityScore || 0) * 100) + '%',
          onPress: () => {
            // Open compatibility threshold picker
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  if (loading && matches.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Finding your perfect matches...</Text>
        <Text style={styles.loadingSubtext}>Using AI compatibility analysis</Text>
      </View>
    );
  }

  if (matches.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.noMatchesTitle}>🔍 No More Matches</Text>
        <Text style={styles.noMatchesText}>
          We've run out of compatible profiles in your area.
        </Text>
        <Text style={styles.noMatchesSubtext}>
          Try adjusting your preferences or check back later!
        </Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => loadMatches(true)}>
          <Text style={styles.refreshButtonText}>🔄 Refresh Matches</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingsButton} onPress={toggleMatchingSettings}>
          <Text style={styles.settingsButtonText}>⚙️ Adjust Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentMatch = matches[currentIndex];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Enhanced Matching</Text>
        <TouchableOpacity onPress={toggleMatchingSettings}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Bar */}
      {matchingStats && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{Math.round(matchingStats.averageCompatibility * 100)}%</Text>
            <Text style={styles.statLabel}>Avg Compatibility</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{matchingStats.highCompatibilityMatches}</Text>
            <Text style={styles.statLabel}>High Matches</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{matchingStats.culturalMatches}</Text>
            <Text style={styles.statLabel}>Cultural Fits</Text>
          </View>
        </View>
      )}

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {currentIndex + 1} of {matches.length}
        </Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { width: `${((currentIndex + 1) / matches.length) * 100}%` }
            ]}
          />
        </View>
      </View>

      {/* Match Card */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadMatches(true)} />
        }
      >
        {currentMatch && (
          <EnhancedMatchCard
            match={currentMatch}
            onLike={handleLike}
            onPass={handlePass}
            onSuperLike={handleSuperLike}
            onViewProfile={handleViewProfile}
          />
        )}
      </ScrollView>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickPassButton} onPress={handlePass}>
          <Text style={styles.quickActionIcon}>❌</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickSuperButton} onPress={handleSuperLike}>
          <Text style={styles.quickActionIcon}>⭐</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickLikeButton} onPress={handleLike}>
          <Text style={styles.quickActionIcon}>💕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  settingsIcon: {
    fontSize: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  progressText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4A90E2',
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  loadingText: {
    fontSize: 18,
    color: '#333333',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
  },
  noMatchesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  noMatchesText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  noMatchesSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 32,
  },
  refreshButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    marginBottom: 16,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
  },
  settingsButtonText: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  quickPassButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFEBEE',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickSuperButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickLikeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickActionIcon: {
    fontSize: 24,
  },
});

export default EnhancedMatchingScreen;