import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { EnhancedMatch } from '../../services/EnhancedMatchingAPI';
import EnhancedMatchingAPI from '../../services/EnhancedMatchingAPI';

interface Props {
  match: EnhancedMatch;
  onLike: () => void;
  onPass: () => void;
  onSuperLike: () => void;
  onViewProfile: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.9;

const EnhancedMatchCard: React.FC<Props> = ({
  match,
  onLike,
  onPass,
  onSuperLike,
  onViewProfile,
}) => {
  const compatibilityDisplay = EnhancedMatchingAPI.calculateCompatibilityDisplay(
    match.compatibility_score
  );

  const renderCompatibilityBreakdown = () => {
    const factors = Object.entries(match.score_breakdown);
    
    return (
      <View style={styles.breakdownContainer}>
        <Text style={styles.breakdownTitle}>Compatibility Factors</Text>
        {factors.map(([factor, score]) => {
          const factorInfo = EnhancedMatchingAPI.getCompatibilityFactorInfo(
            factor as keyof typeof match.score_breakdown
          );
          const percentage = Math.round(score * 100);
          
          return (
            <View key={factor} style={styles.factorRow}>
              <View style={styles.factorHeader}>
                <Text style={styles.factorIcon}>{factorInfo.icon}</Text>
                <Text style={styles.factorName}>{factorInfo.name}</Text>
                <Text style={styles.factorScore}>{percentage}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      width: `${percentage}%`,
                      backgroundColor: getScoreColor(score)
                    }
                  ]} 
                />
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return '#4CAF50';
    if (score >= 0.6) return '#2196F3';
    if (score >= 0.4) return '#FF9800';
    return '#9E9E9E';
  };

  return (
    <View style={styles.container}>
      {/* Profile Image */}
      <TouchableOpacity onPress={onViewProfile} style={styles.imageContainer}>
        <Image
          source={{ uri: match.profile_picture }}
          style={styles.profileImage}
          resizeMode="cover"
        />
        
        {/* Compatibility Score Overlay */}
        <View style={[styles.compatibilityBadge, { backgroundColor: compatibilityDisplay.color }]}>
          <Text style={styles.compatibilityEmoji}>{compatibilityDisplay.emoji}</Text>
          <Text style={styles.compatibilityText}>{compatibilityDisplay.percentage}</Text>
          <Text style={styles.compatibilityLabel}>{compatibilityDisplay.label}</Text>
        </View>

        {/* Distance Badge */}
        {match.distance_km && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>📍 {Math.round(match.distance_km)}km</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Profile Info */}
      <View style={styles.infoContainer}>
        <View style={styles.basicInfo}>
          <Text style={styles.name}>{match.first_name}, {match.age}</Text>
          <Text style={styles.location}>{match.location}</Text>
          {match.occupation && (
            <Text style={styles.occupation}>💼 {match.occupation}</Text>
          )}
        </View>

        {/* Bio */}
        {match.bio && (
          <Text style={styles.bio} numberOfLines={2}>
            {match.bio}
          </Text>
        )}

        {/* Interests */}
        {match.interests && match.interests.length > 0 && (
          <View style={styles.interestsContainer}>
            {match.interests.slice(0, 3).map((interest, index) => (
              <View key={index} style={styles.interestTag}>
                <Text style={styles.interestText}>{interest}</Text>
              </View>
            ))}
            {match.interests.length > 3 && (
              <Text style={styles.moreInterests}>+{match.interests.length - 3} more</Text>
            )}
          </View>
        )}

        {/* Compatibility Breakdown */}
        {renderCompatibilityBreakdown()}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.passButton} onPress={onPass}>
            <Text style={styles.buttonIcon}>❌</Text>
            <Text style={styles.buttonText}>Pass</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.superLikeButton} onPress={onSuperLike}>
            <Text style={styles.buttonIcon}>⭐</Text>
            <Text style={styles.buttonText}>Super</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.likeButton} onPress={onLike}>
            <Text style={styles.buttonIcon}>💕</Text>
            <Text style={styles.buttonText}>Like</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    marginVertical: 10,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: 400,
  },
  compatibilityBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 80,
  },
  compatibilityEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  compatibilityText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  compatibilityLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    opacity: 0.9,
  },
  distanceBadge: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
  },
  distanceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  infoContainer: {
    padding: 20,
  },
  basicInfo: {
    marginBottom: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  location: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 4,
  },
  occupation: {
    fontSize: 14,
    color: '#4A90E2',
  },
  bio: {
    fontSize: 15,
    color: '#555555',
    lineHeight: 20,
    marginBottom: 16,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  interestTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    color: '#2196F3',
    fontSize: 12,
    fontWeight: '500',
  },
  moreInterests: {
    color: '#999999',
    fontSize: 12,
    alignSelf: 'center',
    marginLeft: 8,
  },
  breakdownContainer: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  factorRow: {
    marginBottom: 12,
  },
  factorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  factorIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  factorName: {
    flex: 1,
    fontSize: 13,
    color: '#555555',
    fontWeight: '500',
  },
  factorScore: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333333',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
  },
  passButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#FFEBEE',
    borderRadius: 25,
    minWidth: 80,
  },
  superLikeButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#FFF3E0',
    borderRadius: 25,
    minWidth: 80,
  },
  likeButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#E8F5E8',
    borderRadius: 25,
    minWidth: 80,
  },
  buttonIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
  },
});

export default EnhancedMatchCard;