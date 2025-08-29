import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';

const MatchesScreen: React.FC = () => {
  const mockMatches = [
    {
      id: 1,
      name: 'Sofia',
      age: 26,
      location: 'Barcelona, Spain',
      photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3',
      matchedAt: '2 hours ago',
      hasUnread: true,
    },
    {
      id: 2,
      name: 'Emma',
      age: 24,
      location: 'Paris, France',
      photo: 'https://images.unsplash.com/photo-1494790108755-2616b64a0e4e?ixlib=rb-4.0.3',
      matchedAt: '1 day ago',
      hasUnread: false,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Matches</Text>
        <Text style={styles.subtitle}>{mockMatches.length} connections worldwide</Text>
      </View>

      <ScrollView style={styles.matchesList}>
        {mockMatches.map((match) => (
          <TouchableOpacity key={match.id} style={styles.matchCard}>
            <Image source={{ uri: match.photo }} style={styles.matchPhoto} />
            <View style={styles.matchInfo}>
              <Text style={styles.matchName}>{match.name}, {match.age}</Text>
              <Text style={styles.matchLocation}>{match.location}</Text>
              <Text style={styles.matchTime}>Matched {match.matchedAt}</Text>
            </View>
            {match.hasUnread && <View style={styles.unreadIndicator} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  matchesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  matchCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  matchPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  matchLocation: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  matchTime: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },
  unreadIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B6B',
  },
});

export default MatchesScreen;