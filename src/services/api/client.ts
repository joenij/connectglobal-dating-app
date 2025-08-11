// API Client for ConnectGlobal Backend
import { getApiUrl } from './config';

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = getApiUrl(endpoint);
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (this.token) {
        headers.Authorization = `Bearer ${this.token}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          error: result.error || `HTTP ${response.status}`,
        };
      }

      return result;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Authentication
  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    phoneNumber: string;
    countryCode: string;
  }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(credentials: { email: string; password: string }) {
    const result = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (result.tokens?.accessToken) {
      this.setToken(result.tokens.accessToken);
    }

    return result;
  }

  async logout() {
    const result = await this.request('/auth/logout', {
      method: 'POST',
    });
    this.clearToken();
    return result;
  }

  // Pricing
  async getPricing(countryCode = 'US') {
    return this.request(`/pricing?country=${countryCode}`);
  }

  async joinBeta(data: { tiktok_username: string; referral_source?: string }) {
    return this.request('/pricing/join-beta', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBetaStatus() {
    return this.request('/pricing/beta-status');
  }

  // User Profile
  async getProfile() {
    return this.request('/users/profile');
  }

  async updateProfile(profileData: any) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // Matching
  async getDiscoverProfiles() {
    return this.request('/matching/discover');
  }

  async submitMatchAction(data: {
    targetUserId: string;
    action: 'like' | 'pass' | 'super_like';
  }) {
    return this.request('/matching/action', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMatches() {
    return this.request('/matching/matches');
  }

  // Messaging
  async getConversations() {
    return this.request('/messaging/conversations');
  }

  async getMessages(conversationId: string) {
    return this.request(`/messaging/messages/${conversationId}`);
  }

  async sendMessage(data: {
    conversationId: string;
    content: string;
    messageType?: 'text' | 'image';
  }) {
    return this.request('/messaging/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Video Profile
  async uploadVideo(videoFile: FormData) {
    const url = getApiUrl('/users/video');
    const headers: HeadersInit = {};

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: videoFile,
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          error: result.error || `HTTP ${response.status}`,
        };
      }

      return result;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  async getUserVideo(userId: string) {
    return this.request(`/users/video/${userId}`);
  }

  async deleteVideo() {
    return this.request('/users/video', {
      method: 'DELETE',
    });
  }

  async submitVideoForVerification(videoId: string) {
    return this.request('/users/video/verify', {
      method: 'POST',
      body: JSON.stringify({ videoId }),
    });
  }

  async getVerificationStatus(verificationId: string) {
    return this.request(`/users/video/verification/${verificationId}`);
  }
}

export const apiClient = new ApiClient();
export default apiClient;