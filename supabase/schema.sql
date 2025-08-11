-- ConnectGlobal Supabase Schema
-- Run this in your Supabase SQL editor

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create custom types
CREATE TYPE subscription_tier AS ENUM ('free', 'premium', 'elite');
CREATE TYPE gender_type AS ENUM ('male', 'female', 'non-binary', 'other');
CREATE TYPE match_status AS ENUM ('pending', 'mutual', 'expired');
CREATE TYPE match_decision AS ENUM ('like', 'pass', 'super_like');
CREATE TYPE message_type AS ENUM ('text', 'image', 'video', 'audio');

-- User profiles table (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender gender_type NOT NULL,
  
  -- Location and cultural data
  country_code CHAR(2) NOT NULL,
  city TEXT,
  coordinates POINT,
  timezone TEXT,
  primary_language TEXT NOT NULL DEFAULT 'en',
  spoken_languages TEXT[] DEFAULT '{}',
  cultural_background JSONB DEFAULT '{}',
  
  -- Profile content
  bio TEXT,
  interests TEXT[] DEFAULT '{}',
  lifestyle_preferences JSONB DEFAULT '{}',
  relationship_goals TEXT,
  education_level TEXT,
  occupation TEXT,
  
  -- Physical attributes
  height_cm INTEGER,
  build_type TEXT,
  
  -- Social attributes
  religion TEXT,
  politics TEXT,
  drinking TEXT,
  smoking TEXT,
  has_children BOOLEAN,
  wants_children TEXT,
  
  -- Economic compatibility
  income_range TEXT,
  financial_goals JSONB DEFAULT '{}',
  
  -- Subscription and pricing
  subscription_tier subscription_tier DEFAULT 'free',
  gdp_pricing_tier INTEGER NOT NULL DEFAULT 1,
  current_price_usd DECIMAL(10,2),
  subscription_expires_at TIMESTAMPTZ,
  
  -- Verification status
  is_phone_verified BOOLEAN DEFAULT FALSE,
  is_email_verified BOOLEAN DEFAULT FALSE,
  is_video_verified BOOLEAN DEFAULT FALSE,
  verification_level INTEGER DEFAULT 1,
  last_verification_date TIMESTAMPTZ,
  
  -- Account status
  is_active BOOLEAN DEFAULT TRUE,
  is_banned BOOLEAN DEFAULT FALSE,
  ban_reason TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  
  -- Matching preferences
  looking_for_gender gender_type,
  age_range_min INTEGER DEFAULT 18,
  age_range_max INTEGER DEFAULT 99,
  max_distance_km INTEGER DEFAULT 50,
  cultural_openness_score INTEGER DEFAULT 5 CHECK (cultural_openness_score >= 1 AND cultural_openness_score <= 10),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User media (photos, videos)
CREATE TABLE user_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video', 'audio')),
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size_bytes BIGINT,
  mime_type TEXT,
  
  -- Verification and security
  is_verified BOOLEAN DEFAULT FALSE,
  deepfake_score DECIMAL(5,4) CHECK (deepfake_score >= 0 AND deepfake_score <= 1),
  moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_reason TEXT,
  
  -- Display settings
  is_profile_picture BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  
  upload_date TIMESTAMPTZ DEFAULT NOW()
);

-- Matching system
CREATE TABLE user_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  user2_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- Match scoring
  compatibility_score DECIMAL(5,4) NOT NULL CHECK (compatibility_score >= 0 AND compatibility_score <= 1),
  cultural_score DECIMAL(5,4),
  lifestyle_score DECIMAL(5,4),
  economic_score DECIMAL(5,4),
  timezone_score DECIMAL(5,4),
  
  -- Match status and decisions
  status match_status DEFAULT 'pending',
  user1_decision match_decision,
  user2_decision match_decision,
  user1_decided_at TIMESTAMPTZ,
  user2_decided_at TIMESTAMPTZ,
  
  -- Metadata
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Ensure users can't match with themselves
  CHECK (user1_id != user2_id),
  -- Ensure unique match pairs (regardless of order)
  UNIQUE (LEAST(user1_id, user2_id), GREATEST(user1_id, user2_id))
);

-- Conversations
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES user_matches(id) ON DELETE CASCADE,
  
  -- Conversation status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Security
  encryption_key_hash TEXT,
  is_monitored BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  -- Message content
  message_type message_type DEFAULT 'text',
  content TEXT NOT NULL,
  media_url TEXT,
  
  -- Security and delivery
  is_encrypted BOOLEAN DEFAULT TRUE,
  delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read')),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  -- Moderation
  is_flagged BOOLEAN DEFAULT FALSE,
  moderation_score DECIMAL(5,4),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pricing and billing
CREATE TABLE pricing_tiers (
  id SERIAL PRIMARY KEY,
  tier_name TEXT NOT NULL,
  countries TEXT[] NOT NULL,
  base_premium_price DECIMAL(10,2),
  base_elite_price DECIMAL(10,2),
  currency_code CHAR(3),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pricing_modifiers (
  id SERIAL PRIMARY KEY,
  modifier_type TEXT NOT NULL CHECK (modifier_type IN ('promotion', 'disaster', 'seasonal', 'economic')),
  region_codes TEXT[],
  discount_percentage DECIMAL(5,2) CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT FALSE,
  priority_level INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security and audit logs
CREATE TABLE security_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL,
  event_details JSONB,
  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT,
  
  -- Risk assessment
  risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  is_suspicious BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User reports
CREATE TABLE reported_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  report_type TEXT NOT NULL,
  report_reason TEXT,
  evidence_urls TEXT[],
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
  moderator_notes TEXT,
  action_taken TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  
  -- Prevent self-reporting
  CHECK (reporter_id != reported_id)
);

-- TikTok integration
CREATE TABLE tiktok_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  
  submission_type TEXT NOT NULL CHECK (submission_type IN ('profile_feature', 'success_story')),
  content_description TEXT,
  video_url TEXT,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'featured', 'rejected')),
  featured_date TIMESTAMPTZ,
  engagement_metrics JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_location ON user_profiles USING GIST(coordinates) WHERE coordinates IS NOT NULL;
CREATE INDEX idx_user_profiles_active ON user_profiles(country_code, is_active, subscription_tier);
CREATE INDEX idx_user_matches_users ON user_matches(user1_id, user2_id, status);
CREATE INDEX idx_user_matches_status ON user_matches(status, matched_at);
CREATE INDEX idx_messages_conversation_time ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_security_logs_user_time ON security_logs(user_id, created_at DESC);
CREATE INDEX idx_user_media_user ON user_media(user_id, is_profile_picture, display_order);

-- Row Level Security (RLS) Policies

-- User profiles: Users can only see active, non-banned profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active profiles" ON user_profiles
  FOR SELECT USING (is_active = true AND is_banned = false);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- User media: Users can manage their own media
ALTER TABLE user_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own media" ON user_media
  FOR ALL USING (auth.uid() = user_id);

-- Matches: Users can see matches they're involved in
ALTER TABLE user_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own matches" ON user_matches
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create matches" ON user_matches
  FOR INSERT WITH CHECK (auth.uid() = user1_id);

-- Messages: Users can see messages in their conversations
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      JOIN user_matches m ON c.match_id = m.id
      WHERE c.id = conversation_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Functions for automatic updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check for mutual matches
CREATE OR REPLACE FUNCTION check_mutual_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if there's a reciprocal like
  IF NEW.user1_decision = 'like' OR NEW.user1_decision = 'super_like' THEN
    UPDATE user_matches 
    SET status = 'mutual'
    WHERE id = NEW.id
    AND EXISTS (
      SELECT 1 FROM user_matches reverse_match
      WHERE reverse_match.user1_id = NEW.user2_id
      AND reverse_match.user2_id = NEW.user1_id
      AND (reverse_match.user1_decision = 'like' OR reverse_match.user1_decision = 'super_like')
    );
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for mutual match detection
CREATE TRIGGER check_mutual_match_trigger
  AFTER UPDATE ON user_matches
  FOR EACH ROW EXECUTE FUNCTION check_mutual_match();

-- Insert default pricing tiers
INSERT INTO pricing_tiers (tier_name, countries, base_premium_price, base_elite_price, currency_code) VALUES
('Tier 1', ARRAY['US', 'UK', 'DE', 'FR', 'JP', 'AU', 'CA', 'CH', 'NO', 'DK'], 19.99, 39.99, 'USD'),
('Tier 2', ARRAY['BR', 'MX', 'CN', 'RU', 'KR', 'ES', 'IT', 'NL', 'BE', 'AT'], 9.99, 19.99, 'USD'),
('Tier 3', ARRAY['IN', 'PH', 'TH', 'MY', 'VN', 'ID', 'PL', 'CZ', 'HU', 'RO'], 4.99, 9.99, 'USD'),
('Tier 4', ARRAY['NG', 'KE', 'BD', 'PK', 'EG', 'MA', 'GH', 'TZ', 'UG', 'ZM'], 2.99, 5.99, 'USD');

-- Create a function to handle user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, first_name, last_name, date_of_birth, gender, country_code, gdp_pricing_tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'date_of_birth', '1990-01-01')::DATE,
    COALESCE(NEW.raw_user_meta_data->>'gender', 'other')::gender_type,
    COALESCE(NEW.raw_user_meta_data->>'country_code', 'US'),
    COALESCE((NEW.raw_user_meta_data->>'gdp_pricing_tier')::INTEGER, 1)
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();