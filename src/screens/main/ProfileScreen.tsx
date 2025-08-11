import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';

const ProfileScreen: React.FC = ({ navigation }: any) => {
  const userProfile = {
    name: 'John Doe',
    age: 25,
    location: 'New York, US',
    bio: 'Love exploring different cultures and meeting new people! Currently learning Spanish and planning my next adventure.',
    photos: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-4.0.3',
    ],
    interests: ['Travel', 'Photography', 'Languages', 'Cooking'],
    languages: ['English', 'Spanish (Learning)'],
    verified: true,
    subscriptionTier: 'premium',
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Profile</Text>
        <TouchableOpacity style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Photos */}
      <View style={styles.photosSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {userProfile.photos.map((photo, index) => (
            <Image key={index} source={{ uri: photo }} style={styles.photo} />
          ))}
          <TouchableOpacity style={styles.addPhotoButton}>
            <Text style={styles.addPhotoText}>+</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Video Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Video Profile</Text>
        <Text style={styles.videoDescription}>
          Stand out with a video introduction! Show your personality and get more matches.
        </Text>
        <TouchableOpacity 
          style={styles.videoButton}
          onPress={() => navigation.navigate('VideoRecording')}
        >
          <Text style={styles.videoButtonIcon}>🎥</Text>
          <Text style={styles.videoButtonText}>Record Video Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Basic Info */}
      <View style={styles.section}>
        <View style={styles.nameSection}>
          <Text style={styles.name}>
            {userProfile.name}, {userProfile.age}
            {userProfile.verified && <Text style={styles.verifiedIcon}> ✓</Text>}
          </Text>
          <Text style={styles.location}>{userProfile.location}</Text>
        </View>
      </View>

      {/* Subscription Status */}
      <View style={styles.section}>
        <View style={styles.subscriptionCard}>
          <Text style={styles.subscriptionTitle}>
            {userProfile.subscriptionTier === 'premium' ? '⭐ Premium Member' : 'Free Member'}
          </Text>
          <Text style={styles.subscriptionSubtitle}>
            {userProfile.subscriptionTier === 'premium' 
              ? 'Enjoying unlimited features worldwide'
              : 'Upgrade to connect globally'
            }
          </Text>
          {userProfile.subscriptionTier === 'free' && (
            <TouchableOpacity style={styles.upgradeButton}>
              <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bio */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About Me</Text>
        <Text style={styles.bio}>{userProfile.bio}</Text>
      </View>

      {/* Interests */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interests</Text>
        <View style={styles.tagsContainer}>
          {userProfile.interests.map((interest, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{interest}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Languages */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Languages</Text>
        <View style={styles.tagsContainer}>
          {userProfile.languages.map((language, index) => (
            <View key={index} style={[styles.tag, styles.languageTag]}>
              <Text style={styles.tagText}>{language}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Profile Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Stats</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>156</Text>
            <Text style={styles.statLabel}>Profile Views</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>24</Text>
            <Text style={styles.statLabel}>Matches</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>89%</Text>
            <Text style={styles.statLabel}>Match Rate</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
  },
  editButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  photosSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  photo: {
    width: 100,
    height: 120,
    borderRadius: 12,
    marginRight: 12,
  },
  addPhotoButton: {
    width: 100,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#cccccc',
    borderStyle: 'dashed',
  },
  addPhotoText: {
    fontSize: 30,
    color: '#999999',
  },
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
  },
  nameSection: {
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  verifiedIcon: {
    color: '#4CAF50',
    fontSize: 20,
  },
  location: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  subscriptionCard: {
    alignItems: 'center',
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  subscriptionSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  upgradeButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  bio: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 22,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  languageTag: {
    backgroundColor: '#4CAF50',
  },
  tagText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  videoDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
    textAlign: 'center',
  },
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  videoButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  videoButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;