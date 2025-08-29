// Authentication Service for ConnectGlobal Backend
import { apiClient } from '../api/client';

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionTier: string;
  isVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

class AuthService {
  // Register new user
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
    const result = await apiClient.register(userData);
    return result;
  }

  // Login user
  async login(credentials: { email: string; password: string }) {
    const result = await apiClient.login(credentials);
    
    if (result.user && result.tokens) {
      // Store tokens securely (in production, use encrypted storage)
      this.storeTokens(result.tokens);
      return {
        user: result.user,
        tokens: result.tokens,
        error: null,
      };
    }

    return {
      user: null,
      tokens: null,
      error: result.error || 'Login failed',
    };
  }

  // Logout user
  async logout() {
    await apiClient.logout();
    this.clearTokens();
  }

  // Get current user from stored token
  async getCurrentUser(): Promise<User | null> {
    const tokens = this.getStoredTokens();
    if (!tokens) return null;

    apiClient.setToken(tokens.accessToken);
    // In a real app, you'd verify the token with the backend
    // For now, we'll decode the JWT payload (insecure, for demo only)
    try {
      const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
      return {
        id: payload.id,
        email: payload.email,
        firstName: '',
        lastName: '',
        subscriptionTier: payload.subscriptionTier,
        isVerified: true,
      };
    } catch {
      this.clearTokens();
      return null;
    }
  }

  // Store tokens (in production, use encrypted storage)
  private storeTokens(tokens: AuthTokens) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_tokens', JSON.stringify(tokens));
    }
  }

  // Get stored tokens
  private getStoredTokens(): AuthTokens | null {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('auth_tokens');
      return stored ? JSON.parse(stored) : null;
    }
    return null;
  }

  // Clear stored tokens
  private clearTokens() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('auth_tokens');
    }
    apiClient.clearToken();
  }

  // Refresh access token
  async refreshToken(): Promise<boolean> {
    const tokens = this.getStoredTokens();
    if (!tokens?.refreshToken) return false;

    try {
      // Implement refresh logic with backend
      // For now, return false to force re-login
      return false;
    } catch {
      this.clearTokens();
      return false;
    }
  }
}

export const authService = new AuthService();
export default authService;