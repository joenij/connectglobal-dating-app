import { supabase, supabaseHelpers } from '../supabase/supabaseClient';
import { AuthError, User, Session } from '@supabase/supabase-js';

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'non-binary' | 'other';
  phoneNumber: string;
  countryCode: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export class SupabaseAuthService {
  
  // Register new user
  static async register(userData: RegisterData) {
    try {
      // Determine GDP pricing tier based on country
      const gdpPricingTier = this.getGDPTier(userData.countryCode);
      
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            date_of_birth: userData.dateOfBirth,
            gender: userData.gender,
            phone_number: userData.phoneNumber,
            country_code: userData.countryCode,
            gdp_pricing_tier: gdpPricingTier,
          }
        }
      });

      if (error) throw error;

      return {
        success: true,
        user: data.user,
        message: 'Registration successful! Please check your email for verification.',
        needsVerification: !data.user?.email_confirmed_at
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }

  // Login user
  static async login(loginData: LoginData) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) throw error;

      // Get user profile
      const profile = await supabaseHelpers.getUserProfile(data.user.id);

      return {
        success: true,
        user: data.user,
        session: data.session,
        profile: profile.data,
        message: 'Login successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  // Logout user
  static async logout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      return {
        success: true,
        message: 'Logout successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed'
      };
    }
  }

  // Get current user
  static async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) throw error;
      
      if (!user) {
        return { success: false, user: null };
      }

      // Get full profile
      const profile = await supabaseHelpers.getUserProfile(user.id);
      
      return {
        success: true,
        user,
        profile: profile.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get current user'
      };
    }
  }

  // Refresh session
  static async refreshSession() {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      
      return {
        success: true,
        session: data.session
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh session'
      };
    }
  }

  // Reset password
  static async resetPassword(email: string) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'connectglobal://reset-password'
      });
      
      if (error) throw error;
      
      return {
        success: true,
        message: 'Password reset email sent'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send reset email'
      };
    }
  }

  // Update password
  static async updatePassword(newPassword: string) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
      
      return {
        success: true,
        message: 'Password updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update password'
      };
    }
  }

  // Update email
  static async updateEmail(newEmail: string) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        email: newEmail
      });
      
      if (error) throw error;
      
      return {
        success: true,
        message: 'Email update initiated. Please check your new email for confirmation.'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update email'
      };
    }
  }

  // Verify phone number
  static async verifyPhone(phone: string, token: string) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms'
      });
      
      if (error) throw error;
      
      return {
        success: true,
        message: 'Phone verified successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Phone verification failed'
      };
    }
  }

  // Send phone verification
  static async sendPhoneVerification(phone: string) {
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        phone
      });
      
      if (error) throw error;
      
      return {
        success: true,
        message: 'Verification code sent to your phone'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send verification code'
      };
    }
  }

  // Listen to auth state changes
  static onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  // Social login (Google)
  static async loginWithGoogle() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'connectglobal://auth/callback'
        }
      });
      
      if (error) throw error;
      
      return {
        success: true,
        url: data.url
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google login failed'
      };
    }
  }

  // Social login (Facebook)
  static async loginWithFacebook() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: 'connectglobal://auth/callback'
        }
      });
      
      if (error) throw error;
      
      return {
        success: true,
        url: data.url
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Facebook login failed'
      };
    }
  }

  // Helper function to determine GDP tier based on country
  private static getGDPTier(countryCode: string): number {
    const gdpTiers = {
      1: ['US', 'UK', 'DE', 'FR', 'JP', 'AU', 'CA', 'CH', 'NO', 'DK'],
      2: ['BR', 'MX', 'CN', 'RU', 'KR', 'ES', 'IT', 'NL', 'BE', 'AT'],
      3: ['IN', 'PH', 'TH', 'MY', 'VN', 'ID', 'PL', 'CZ', 'HU', 'RO'],
      4: ['NG', 'KE', 'BD', 'PK', 'EG', 'MA', 'GH', 'TZ', 'UG', 'ZM']
    };

    for (const [tier, countries] of Object.entries(gdpTiers)) {
      if (countries.includes(countryCode)) {
        return parseInt(tier);
      }
    }
    
    return 3; // Default to tier 3 if country not found
  }

  // Get session
  static async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  }

  // Check if user is authenticated
  static async isAuthenticated(): Promise<boolean> {
    const { session } = await this.getSession();
    return !!session;
  }
}

export default SupabaseAuthService;