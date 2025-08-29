import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';

const { width, height } = Dimensions.get('window');
const CARD_HEIGHT = height * 0.7;

// Mock data - in real app, this would come from API
const mockProfiles = [
  {
    id: 1,
    name: 'Maria',
    age: 25,
    location: 'São Paulo, Brazil',
    distance: '5,432 km away',
    photos: ['https://images.unsplash.com/photo-1494790108755-2616b64a0e4e?ixlib=rb-4.0.3'],
    bio: 'Love traveling and learning about different cultures! Looking for someone to explore the world with 🌍',
    interests: ['Travel', 'Photography', 'Languages'],
    languages: ['Portuguese', 'English', 'Spanish'],
    verified: true,
  },
  {
    id: 2,
    name: 'Akiko',
    age: 28,
    location: 'Tokyo, Japan',
    distance: '6,789 km away',
    photos: ['https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?ixlib=rb-4.0.3'],
    bio: 'Artist and cultural enthusiast. I enjoy traditional tea ceremonies and modern art galleries ✨',
    interests: ['Art', 'Culture', 'Tea', 'Museums'],
    languages: ['Japanese', 'English'],
    verified: true,
  },
];

const HomeScreen: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [profiles, setProfiles] = useState(mockProfiles);

  const currentProfile = profiles[currentProfileIndex];

  const handleLike = () => {
    console.log('Liked:', currentProfile?.name);
    nextProfile();
  };

  const handlePass = () => {
    console.log('Passed:', currentProfile?.name);
    nextProfile();
  };

  const handleSuperLike = () => {
    console.log('Super liked:', currentProfile?.name);
    nextProfile();
  };

  const nextProfile = () => {
    if (currentProfileIndex < profiles.length - 1) {
      setCurrentProfileIndex(currentProfileIndex + 1);
    } else {
      // No more profiles - in real app, would fetch more
      setCurrentProfileIndex(0);
    }
  };

  if (!currentProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>ConnectGlobal</Text>
          <Text style={styles.headerSubtitle}>Discover • Connect • Explore</Text>
        </View>
        <View style={styles.noProfilesContainer}>
          <Text style={styles.noProfilesText}>🌍</Text>
          <Text style={styles.noProfilesTitle}>No more profiles</Text>
          <Text style={styles.noProfilesSubtitle}>
            Check back later for more amazing people to meet!
          </Text>
          <TouchableOpacity style={styles.refreshButton}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ConnectGlobal</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.filterButton}>
            <Text style={styles.filterIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Card */}
      <View style={styles.cardContainer}>
        <View style={styles.card}>
          <Image
            source={{ uri: currentProfile.photos[0] }}
            style={styles.profileImage}
            resizeMode="cover"
          />
          
          {/* Profile Info Overlay */}
          <View style={styles.profileInfo}>
            <View style={styles.nameSection}>
              <Text style={styles.name}>
                {currentProfile.name}, {currentProfile.age}
                {currentProfile.verified && <Text style={styles.verifiedIcon}> ✓</Text>}
              </Text>
              <Text style={styles.location}>{currentProfile.location}</Text>
              <Text style={styles.distance}>{currentProfile.distance}</Text>
            </View>

            <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.bio}>{currentProfile.bio}</Text>
              
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Interests</Text>
                <View style={styles.tagsContainer}>
                  {currentProfile.interests.map((interest, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Languages</Text>
                <View style={styles.tagsContainer}>
                  {currentProfile.languages.map((language, index) => (
                    <View key={index} style={[styles.tag, styles.languageTag]}>
                      <Text style={styles.tagText}>{language}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.passButton} onPress={handlePass}>
          <Text style={styles.actionIcon}>❌</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.superLikeButton} onPress={handleSuperLike}>
          <Text style={styles.actionIcon}>⭐</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.likeButton} onPress={handleLike}>
          <Text style={styles.actionIcon}>❤️</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Info */}
      <View style={styles.bottomInfo}>
        <Text style={styles.remainingText}>
          {profiles.length - currentProfileIndex - 1} more profiles to explore
        </Text>
      </View>
    </View>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
  },
  filterButton: {
    padding: 8,
  },
  filterIcon: {
    fontSize: 20,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: width - 40,
    height: CARD_HEIGHT,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  profileImage: {
    width: '100%',
    height: '60%',
  },
  profileInfo: {
    flex: 1,
    padding: 20,
  },
  nameSection: {
    marginBottom: 15,
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
  distance: {
    fontSize: 14,
    color: '#999999',
    marginTop: 2,
  },
  detailsScroll: {
    flex: 1,
  },
  bio: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 22,
    marginBottom: 15,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
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
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 20,
  },
  passButton: {
    width: 60,
    height: 60,
    backgroundColor: '#ffffff',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  superLikeButton: {
    width: 50,
    height: 50,
    backgroundColor: '#ffffff',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  likeButton: {
    width: 60,
    height: 60,
    backgroundColor: '#ffffff',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionIcon: {
    fontSize: 24,
  },
  bottomInfo: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  remainingText: {
    fontSize: 14,
    color: '#666666',
  },
  noProfilesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noProfilesText: {
    fontSize: 60,
    marginBottom: 20,
  },
  noProfilesTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
    textAlign: 'center',
  },
  noProfilesSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  refreshButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomeScreen;