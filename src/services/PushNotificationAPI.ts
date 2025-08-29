import apiClient from './api/client';
import { Platform } from 'react-native';

export interface NotificationPreferences {
  matches: boolean;
  messages: boolean;
  profile_views: boolean;
  system: boolean;
  marketing: boolean;
}

export interface PushTokenRegistration {
  token: string;
  platform: 'firebase' | 'expo' | 'apns';
}

export interface TestNotification {
  type: 'new_match' | 'new_message' | 'profile_viewed' | 'daily_matches';
  title?: string;
  body?: string;
}

class PushNotificationAPI {
  /**
   * Register push notification token with backend
   */
  async registerPushToken(token: string, platform: 'firebase' | 'expo' | 'apns' = 'expo'): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post('/notifications/register-token', {
        token,
        platform
      });
      
      console.log('✅ Push token registered:', { platform, tokenPrefix: token.substring(0, 20) });
      return response.data;
    } catch (error) {
      console.error('❌ Push token registration failed:', error);
      throw error;
    }
  }

  /**
   * Unregister push notification token
   */
  async unregisterPushToken(token: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.delete('/notifications/unregister-token', {
        data: { token }
      });
      
      console.log('✅ Push token unregistered');
      return response.data;
    } catch (error) {
      console.error('❌ Push token unregistration failed:', error);
      throw error;
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<{ 
    success: boolean; 
    message: string; 
    preferences: NotificationPreferences 
  }> {
    try {
      const response = await apiClient.put('/notifications/preferences', preferences);
      
      console.log('✅ Notification preferences updated:', preferences);
      return response.data;
    } catch (error) {
      console.error('❌ Notification preferences update failed:', error);
      throw error;
    }
  }

  /**
   * Get user's notification preferences
   */
  async getPreferences(): Promise<{
    success: boolean;
    preferences: NotificationPreferences;
    pushTokens: {
      firebase: number;
      expo: number;
    };
  }> {
    try {
      const response = await apiClient.get('/notifications/preferences');
      return response.data;
    } catch (error) {
      console.error('❌ Get notification preferences failed:', error);
      throw error;
    }
  }

  /**
   * Send test notification (development only)
   */
  async sendTestNotification(testData: TestNotification): Promise<{ 
    success: boolean; 
    message: string; 
    result: any 
  }> {
    try {
      if (__DEV__) {
        const response = await apiClient.post('/notifications/test', testData);
        
        console.log('🧪 Test notification sent:', testData.type);
        return response.data;
      } else {
        throw new Error('Test notifications only available in development mode');
      }
    } catch (error) {
      console.error('❌ Test notification failed:', error);
      throw error;
    }
  }

  /**
   * Trigger daily matches notification manually
   */
  async sendDailyMatchesNotification(matchCount?: number): Promise<{ 
    success: boolean; 
    message: string; 
    matchCount: number 
  }> {
    try {
      const response = await apiClient.post('/notifications/send-daily-matches', 
        matchCount ? { matchCount } : {}
      );
      
      console.log('📬 Daily matches notification triggered');
      return response.data;
    } catch (error) {
      console.error('❌ Daily matches notification failed:', error);
      throw error;
    }
  }

  /**
   * Initialize push notifications for the app
   */
  async initializePushNotifications(): Promise<void> {
    try {
      // This would integrate with Expo Notifications or Firebase Messaging
      console.log('🔔 Initializing push notifications...');
      
      // For now, just log that we're ready
      console.log('✅ Push notification service ready');
      
    } catch (error) {
      console.error('❌ Push notification initialization failed:', error);
      throw error;
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      // This would integrate with the actual notification permission system
      console.log('📱 Requesting notification permissions...');
      
      // Mock permission granted for now
      const granted = true;
      
      if (granted) {
        console.log('✅ Notification permissions granted');
        return true;
      } else {
        console.log('❌ Notification permissions denied');
        return false;
      }
    } catch (error) {
      console.error('❌ Permission request failed:', error);
      return false;
    }
  }

  /**
   * Handle notification received while app is active
   */
  handleForegroundNotification(notification: any): void {
    console.log('📨 Foreground notification received:', notification);
    
    // This would show an in-app notification or update UI
    // For now, just log it
  }

  /**
   * Handle notification tap/open
   */
  handleNotificationResponse(response: any): void {
    console.log('👆 Notification tapped:', response);
    
    // This would navigate to the appropriate screen based on notification type
    const { type, data } = response.notification.request.content;
    
    switch (type) {
      case 'new_match':
        console.log('Navigate to matches screen');
        // NavigationService.navigate('Matches');
        break;
      case 'new_message':
        console.log('Navigate to conversation:', data?.conversationId);
        // NavigationService.navigate('Messages', { conversationId: data.conversationId });
        break;
      case 'profile_viewed':
        console.log('Navigate to profile views');
        // NavigationService.navigate('ProfileViews');
        break;
      default:
        console.log('Navigate to home screen');
        // NavigationService.navigate('Home');
    }
  }

  /**
   * Get notification settings UI data
   */
  getNotificationSettingsData(): Array<{
    key: keyof NotificationPreferences;
    title: string;
    description: string;
    icon: string;
    defaultValue: boolean;
  }> {
    return [
      {
        key: 'matches',
        title: 'New Matches',
        description: 'Get notified when someone likes you back',
        icon: '💕',
        defaultValue: true
      },
      {
        key: 'messages',
        title: 'Messages',
        description: 'Receive notifications for new messages',
        icon: '💬',
        defaultValue: true
      },
      {
        key: 'profile_views',
        title: 'Profile Views',
        description: 'Know when someone views your profile',
        icon: '👀',
        defaultValue: true
      },
      {
        key: 'system',
        title: 'System Updates',
        description: 'Important app updates and security notifications',
        icon: '🔔',
        defaultValue: true
      },
      {
        key: 'marketing',
        title: 'Promotional',
        description: 'Tips, features, and special offers',
        icon: '🎁',
        defaultValue: false
      }
    ];
  }
}

export default new PushNotificationAPI();