import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database types (these would be generated from Supabase)
export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  age?: number;
  bio?: string;
  location?: string;
  interests?: string[];
  languages?: string[];
  photos?: string[];
  verified: boolean;
  subscription_tier: 'free' | 'premium' | 'elite';
  country_code: string;
  gdp_pricing_tier: number;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  status: 'pending' | 'mutual' | 'expired';
  compatibility_score: number;
  matched_at: string;
  user1_decision?: 'like' | 'pass' | 'super_like';
  user2_decision?: 'like' | 'pass' | 'super_like';
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video';
  created_at: string;
  is_read: boolean;
}

// Helper functions for common operations
export const supabaseHelpers = {
  // Get current user
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  // Get user profile
  getUserProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  // Update user profile
  updateUserProfile: async (userId: string, updates: Partial<UserProfile>) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId);
    return { data, error };
  },

  // Get potential matches
  getPotentialMatches: async (userId: string, limit = 10) => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .neq('id', userId)
      .limit(limit);
    return { data, error };
  },

  // Create a match action
  createMatchAction: async (userId: string, targetUserId: string, action: 'like' | 'pass' | 'super_like') => {
    const { data, error } = await supabase
      .from('user_matches')
      .insert({
        user1_id: userId,
        user2_id: targetUserId,
        user1_decision: action,
        status: 'pending'
      });
    return { data, error };
  },

  // Get user matches
  getUserMatches: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_matches')
      .select(`
        *,
        user1:user_profiles!user1_id(*),
        user2:user_profiles!user2_id(*)
      `)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq('status', 'mutual');
    return { data, error };
  },

  // Send message
  sendMessage: async (conversationId: string, senderId: string, content: string) => {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: content,
        message_type: 'text'
      });
    return { data, error };
  },

  // Get conversation messages
  getMessages: async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    return { data, error };
  },

  // Subscribe to real-time messages
  subscribeToMessages: (conversationId: string, callback: (message: Message) => void) => {
    return supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        callback(payload.new as Message);
      })
      .subscribe();
  }
};

export default supabase;