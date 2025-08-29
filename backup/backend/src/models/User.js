const { query, transaction } = require('../config/database-sqlite');
const bcrypt = require('bcryptjs');

class User {
  // Create a new user
  static async create(userData) {
    const {
      email,
      phoneNumber,
      passwordHash,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      countryCode,
      gdpPricingTier
    } = userData;

    const sql = `
      INSERT INTO users (
        email, phone_number, password_hash, first_name, last_name,
        date_of_birth, gender, country_code, gdp_pricing_tier
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, email, first_name, last_name, created_at
    `;

    const values = [
      email, phoneNumber, passwordHash, firstName, lastName,
      dateOfBirth, gender, countryCode, gdpPricingTier
    ];

    try {
      const result = await query(sql, values);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('User with this email or phone number already exists');
      }
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    const sql = `
      SELECT 
        id, email, phone_number, password_hash, first_name, last_name,
        subscription_tier, is_active, is_banned, is_phone_verified, created_at
      FROM users 
      WHERE email = $1
    `;

    const result = await query(sql, [email]);
    return result.rows[0] || null;
  }

  // Find user by phone number
  static async findByPhone(phoneNumber) {
    const sql = `
      SELECT 
        id, email, phone_number, password_hash, first_name, last_name,
        subscription_tier, is_active, is_banned, is_phone_verified, created_at
      FROM users 
      WHERE phone_number = $1
    `;

    const result = await query(sql, [phoneNumber]);
    return result.rows[0] || null;
  }

  // Find user by ID
  static async findById(id) {
    const sql = `
      SELECT 
        u.id, u.email, u.phone_number, u.first_name, u.last_name,
        u.subscription_tier, u.is_active, u.is_banned, u.created_at,
        up.bio, up.interests, up.relationship_goals
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE u.id = $1
    `;

    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Update user verification status
  static async updateVerification(userId, verificationType, status = true) {
    const columnMap = {
      phone: 'is_phone_verified',
      email: 'is_email_verified',
      video: 'is_video_verified'
    };

    const column = columnMap[verificationType];
    if (!column) {
      throw new Error('Invalid verification type');
    }

    const sql = `
      UPDATE users 
      SET ${column} = $1, last_verification_date = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, ${column}
    `;

    const result = await query(sql, [status, userId]);
    return result.rows[0];
  }

  // Update last active timestamp
  static async updateLastActive(userId) {
    const sql = `
      UPDATE users 
      SET last_active = CURRENT_TIMESTAMP
      WHERE id = $1
    `;

    await query(sql, [userId]);
  }

  // Get user subscription info
  static async getSubscription(userId) {
    const sql = `
      SELECT 
        subscription_tier, 
        subscription_expires_at,
        current_price_usd,
        gdp_pricing_tier
      FROM users 
      WHERE id = $1
    `;

    const result = await query(sql, [userId]);
    return result.rows[0] || null;
  }

  // Update subscription
  static async updateSubscription(userId, subscriptionData) {
    // Support both old format (tier, expiresAt, price) and new format (object)
    if (typeof subscriptionData === 'string') {
      // Old format: updateSubscription(userId, tier, expiresAt, price)
      const tier = subscriptionData;
      const expiresAt = arguments[2];
      const price = arguments[3];
      
      const sql = `
        UPDATE users 
        SET 
          subscription_tier = $1,
          subscription_expires_at = $2,
          current_price_usd = $3
        WHERE id = $4
        RETURNING subscription_tier, subscription_expires_at
      `;

      const result = await query(sql, [tier, expiresAt, price, userId]);
      return result.rows[0];
    } else {
      // New format: updateSubscription(userId, subscriptionObject)
      const {
        subscription_plan,
        subscription_status,
        subscription_start,
        subscription_end,
        billing_cycle,
        stripe_payment_intent_id
      } = subscriptionData;

      const sql = `
        UPDATE users 
        SET 
          subscription_plan = $1,
          subscription_status = $2,
          subscription_start = $3,
          subscription_end = $4,
          billing_cycle = $5,
          stripe_payment_intent_id = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING id, subscription_plan, subscription_status, subscription_start, subscription_end
      `;

      const values = [
        subscription_plan,
        subscription_status,
        subscription_start,
        subscription_end,
        billing_cycle,
        stripe_payment_intent_id,
        userId
      ];

      const result = await query(sql, values);
      return result.rows[0];
    }
  }

  // Ban/unban user
  static async updateBanStatus(userId, isBanned, reason = null) {
    const sql = `
      UPDATE users 
      SET 
        is_banned = $1,
        ban_reason = $2
      WHERE id = $3
      RETURNING id, is_banned, ban_reason
    `;

    const result = await query(sql, [isBanned, reason, userId]);
    return result.rows[0];
  }

  // Get users by country for analytics
  static async getUsersByCountry(limit = 10) {
    const sql = `
      SELECT 
        country_code,
        COUNT(*) as user_count,
        COUNT(CASE WHEN subscription_tier != 'free' THEN 1 END) as premium_users
      FROM users 
      WHERE is_active = true AND is_banned = false
      GROUP BY country_code
      ORDER BY user_count DESC
      LIMIT $1
    `;

    const result = await query(sql, [limit]);
    return result.rows;
  }

  // Search users (admin function)
  static async search(searchTerm, limit = 20, offset = 0) {
    const sql = `
      SELECT 
        id, email, first_name, last_name, country_code,
        subscription_tier, is_active, is_banned, created_at
      FROM users 
      WHERE 
        (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1)
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const searchPattern = `%${searchTerm}%`;
    const result = await query(sql, [searchPattern, limit, offset]);
    return result.rows;
  }
}

module.exports = User;