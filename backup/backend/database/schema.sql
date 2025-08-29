-- ConnectGlobal Dating App Database Schema
-- PostgreSQL 15+ required

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_crypto";

-- Users table with comprehensive profile data
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Basic profile info
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    
    -- Location and cultural data
    country_code CHAR(2) NOT NULL,
    city VARCHAR(100),
    coordinates GEOMETRY(POINT, 4326),
    timezone VARCHAR(50),
    primary_language VARCHAR(10) NOT NULL,
    spoken_languages JSONB DEFAULT '[]',
    cultural_background JSONB DEFAULT '{}',
    
    -- Verification and security
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_video_verified BOOLEAN DEFAULT FALSE,
    verification_level INTEGER DEFAULT 1, -- 1=basic, 2=enhanced, 3=premium
    last_verification_date TIMESTAMP,
    
    -- Subscription and pricing
    subscription_tier VARCHAR(20) DEFAULT 'free', -- free, premium, elite
    gdp_pricing_tier INTEGER NOT NULL, -- 1-4 based on country GDP
    current_price_usd DECIMAL(10,2),
    subscription_expires_at TIMESTAMP,
    subscription_plan VARCHAR(20) DEFAULT 'free' CHECK (subscription_plan IN ('free', 'basic', 'premium', 'ultimate')),
    subscription_status VARCHAR(20) DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'cancelled', 'expired')),
    subscription_start TIMESTAMP,
    subscription_end TIMESTAMP,
    billing_cycle VARCHAR(10) CHECK (billing_cycle IN ('monthly', 'yearly')),
    stripe_payment_intent_id VARCHAR(255),
    
    -- Account status
    is_active BOOLEAN DEFAULT TRUE,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    last_active TIMESTAMP DEFAULT NOW(),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User profiles with detailed information
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Profile content
    bio TEXT,
    interests JSONB DEFAULT '[]',
    lifestyle_preferences JSONB DEFAULT '{}',
    relationship_goals VARCHAR(50),
    education_level VARCHAR(50),
    occupation VARCHAR(100),
    
    -- Physical attributes
    height_cm INTEGER,
    build_type VARCHAR(20),
    
    -- Cultural and social
    religion VARCHAR(50),
    politics VARCHAR(50),
    drinking VARCHAR(20),
    smoking VARCHAR(20),
    has_children BOOLEAN,
    wants_children VARCHAR(20),
    
    -- Economic compatibility
    income_range VARCHAR(30),
    financial_goals JSONB DEFAULT '{}',
    
    -- Matching preferences
    looking_for_gender VARCHAR(20),
    age_range_min INTEGER DEFAULT 18,
    age_range_max INTEGER DEFAULT 99,
    max_distance_km INTEGER DEFAULT 50,
    cultural_openness_score INTEGER DEFAULT 5, -- 1-10 scale
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Media files (photos, videos)
CREATE TABLE user_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    media_type VARCHAR(20) NOT NULL, -- photo, video, audio
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    
    -- Verification and security
    is_verified BOOLEAN DEFAULT FALSE,
    deepfake_score DECIMAL(5,4), -- 0.0000 to 1.0000
    moderation_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    moderation_reason TEXT,
    
    -- Metadata
    upload_date TIMESTAMP DEFAULT NOW(),
    is_profile_picture BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0
);

-- Matching system
CREATE TABLE user_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Match scoring
    compatibility_score DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000
    cultural_score DECIMAL(5,4),
    lifestyle_score DECIMAL(5,4),
    economic_score DECIMAL(5,4),
    timezone_score DECIMAL(5,4),
    
    -- Match status
    status VARCHAR(20) DEFAULT 'pending', -- pending, mutual, expired
    user1_decision VARCHAR(20), -- like, pass, super_like
    user2_decision VARCHAR(20),
    user1_decided_at TIMESTAMP,
    user2_decided_at TIMESTAMP,
    
    -- Metadata
    matched_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Messaging system
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES user_matches(id) ON DELETE CASCADE,
    
    -- Conversation status
    status VARCHAR(20) DEFAULT 'active', -- active, archived, blocked
    last_message_at TIMESTAMP DEFAULT NOW(),
    
    -- Security and moderation
    encryption_key_hash VARCHAR(255),
    is_monitored BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Message content
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, video, audio, gif
    content TEXT, -- Encrypted content
    media_url TEXT,
    
    -- Security and delivery
    is_encrypted BOOLEAN DEFAULT TRUE,
    delivery_status VARCHAR(20) DEFAULT 'sent', -- sent, delivered, read
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    
    -- Moderation
    is_flagged BOOLEAN DEFAULT FALSE,
    moderation_score DECIMAL(5,4),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Pricing and billing
CREATE TABLE pricing_tiers (
    id SERIAL PRIMARY KEY,
    tier_name VARCHAR(50) NOT NULL,
    countries TEXT[], -- Array of country codes
    base_premium_price DECIMAL(10,2),
    base_elite_price DECIMAL(10,2),
    currency_code CHAR(3),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pricing_modifiers (
    id SERIAL PRIMARY KEY,
    modifier_type VARCHAR(50) NOT NULL, -- promotion, disaster, seasonal, economic
    region_codes TEXT[], -- Country/region codes affected
    discount_percentage DECIMAL(5,2),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    auto_renew BOOLEAN DEFAULT FALSE,
    priority_level INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Security and verification
CREATE TABLE security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    event_type VARCHAR(50) NOT NULL,
    event_details JSONB,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    
    -- Risk assessment
    risk_score INTEGER DEFAULT 0, -- 0-100
    is_suspicious BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reported_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reported_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    report_type VARCHAR(50) NOT NULL,
    report_reason TEXT,
    evidence_urls TEXT[],
    
    status VARCHAR(20) DEFAULT 'pending', -- pending, investigating, resolved, dismissed
    moderator_notes TEXT,
    action_taken VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- TikTok integration
CREATE TABLE tiktok_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    submission_type VARCHAR(30) NOT NULL, -- profile_feature, success_story
    content_description TEXT,
    video_url TEXT,
    
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, featured, rejected
    featured_date TIMESTAMP,
    engagement_metrics JSONB,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_country_active ON users(country_code, is_active);
CREATE INDEX idx_users_subscription ON users(subscription_tier, subscription_expires_at);
CREATE INDEX idx_user_profiles_location ON user_profiles USING GIST(ST_Transform(coordinates, 3857)) WHERE coordinates IS NOT NULL;
CREATE INDEX idx_matches_users ON user_matches(user1_id, user2_id, status);
CREATE INDEX idx_messages_conversation_time ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_security_logs_user_time ON security_logs(user_id, created_at DESC);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();