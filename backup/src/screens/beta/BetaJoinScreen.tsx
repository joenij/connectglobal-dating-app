import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { useDispatch } from 'react-redux';

const BetaJoinScreen = ({ navigation }: any) => {
  const [tiktokUsername, setTiktokUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();

  const handleJoinBeta = async () => {
    if (!tiktokUsername.trim()) {
      Alert.alert('Error', 'Please enter your TikTok username');
      return;
    }

    setIsLoading(true);
    try {
      // Call beta join API
      const response = await fetch('/api/v1/pricing/join-beta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tiktok_username: tiktokUsername,
          referral_source: 'tiktok'
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        Alert.alert(
          'Welcome to Beta! 🎉',
          'All premium features are now unlocked for free during the beta period!',
          [
            {
              text: 'Start Dating',
              onPress: () => navigation.navigate('Home')
            }
          ]
        );
      } else {
        Alert.alert('Error', data.error || 'Failed to join beta program');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Join the Beta! 🚀</Text>
        <Text style={styles.subtitle}>
          Get all premium features for FREE during our beta testing phase
        </Text>

        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>Beta Tester Benefits:</Text>
          <Text style={styles.benefit}>✅ Unlimited likes & matches</Text>
          <Text style={styles.benefit}>✅ Global matching worldwide</Text>
          <Text style={styles.benefit}>✅ Unlimited messaging</Text>
          <Text style={styles.benefit}>✅ See who liked you</Text>
          <Text style={styles.benefit}>✅ Early access to new features</Text>
          <Text style={styles.benefit}>✅ Direct feedback channel</Text>
          <Text style={styles.benefit}>✅ Exclusive beta tester badge</Text>
          <Text style={styles.benefit}>✅ Vote on new features</Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Your TikTok Username</Text>
          <TextInput
            style={styles.textInput}
            placeholder="@yourusername"
            value={tiktokUsername}
            onChangeText={setTiktokUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.inputHint}>
            This helps us verify you're from our TikTok community
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.joinButton, isLoading && styles.joinButtonDisabled]}
          onPress={handleJoinBeta}
          disabled={isLoading}
        >
          <Text style={styles.joinButtonText}>
            {isLoading ? 'Joining...' : 'Join Beta Program'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By joining, you agree to provide feedback and help us improve the app.
          All features are completely free during the beta period.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#FF4458',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  benefitsContainer: {
    backgroundColor: '#F8F9FA',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  benefit: {
    fontSize: 14,
    marginBottom: 8,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  joinButton: {
    backgroundColor: '#FF4458',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  joinButtonDisabled: {
    backgroundColor: '#ccc',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default BetaJoinScreen;