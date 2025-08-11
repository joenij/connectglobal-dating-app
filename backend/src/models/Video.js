const { query } = require('../config/database-sqlite');

class Video {
  // Create video tables
  static async initializeTables() {
    const createUserVideosTable = `
      CREATE TABLE IF NOT EXISTS user_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mimetype TEXT NOT NULL,
        url TEXT NOT NULL,
        duration REAL, -- in seconds
        thumbnail_url TEXT, -- generated thumbnail
        is_profile_video BOOLEAN DEFAULT 1,
        is_verified BOOLEAN DEFAULT 0,
        verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        verified_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;

    const createVideoVerificationsTable = `
      CREATE TABLE IF NOT EXISTS video_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        verification_id TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME,
        reviewer_id INTEGER, -- admin who reviewed
        feedback TEXT,
        auto_review BOOLEAN DEFAULT 0, -- was it reviewed by AI?
        confidence_score REAL, -- AI confidence if auto-reviewed
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (video_id) REFERENCES user_videos(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;

    await query(createUserVideosTable);
    await query(createVideoVerificationsTable);
    
    console.log('✅ Video tables initialized');
  }

  // Save video metadata
  static async saveVideo(videoData) {
    const sql = `
      INSERT INTO user_videos (
        user_id, filename, original_name, file_size, mimetype, url, duration, thumbnail_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, url, filename, created_at
    `;

    const values = [
      videoData.userId,
      videoData.filename,
      videoData.originalName,
      videoData.size,
      videoData.mimetype,
      videoData.url,
      videoData.duration || null,
      videoData.thumbnailUrl || null
    ];

    const result = await query(sql, values);
    return result.rows[0];
  }

  // Get user's profile video
  static async getUserVideo(userId) {
    const sql = `
      SELECT 
        id, filename, url, duration, thumbnail_url, is_verified,
        verification_status, uploaded_at, verified_at
      FROM user_videos 
      WHERE user_id = $1 AND is_profile_video = 1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await query(sql, [userId]);
    return result.rows[0] || null;
  }

  // Delete user video
  static async deleteVideo(userId, videoId) {
    const sql = `
      DELETE FROM user_videos 
      WHERE id = $1 AND user_id = $2
    `;

    await query(sql, [videoId, userId]);
    return true;
  }

  // Submit video for verification
  static async submitForVerification(userId, videoId) {
    const verificationId = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const sql = `
      INSERT INTO video_verifications (
        video_id, user_id, verification_id, status
      ) VALUES ($1, $2, $3, 'pending')
      RETURNING verification_id, submitted_at
    `;

    const result = await query(sql, [videoId, userId, verificationId]);
    return result.rows[0];
  }

  // Get verification status
  static async getVerificationStatus(verificationId) {
    const sql = `
      SELECT 
        vv.verification_id, vv.status, vv.submitted_at, vv.reviewed_at,
        vv.feedback, vv.auto_review, vv.confidence_score,
        uv.filename, uv.url
      FROM video_verifications vv
      JOIN user_videos uv ON vv.video_id = uv.id
      WHERE vv.verification_id = $1
    `;

    const result = await query(sql, [verificationId]);
    return result.rows[0] || null;
  }

  // Update verification status (admin function)
  static async updateVerificationStatus(verificationId, status, feedback = null, reviewerId = null) {
    const sql = `
      UPDATE video_verifications 
      SET 
        status = $1,
        reviewed_at = CURRENT_TIMESTAMP,
        feedback = $2,
        reviewer_id = $3
      WHERE verification_id = $4
      RETURNING verification_id, status, reviewed_at
    `;

    const result = await query(sql, [status, feedback, reviewerId, verificationId]);
    
    // Also update the video verification status
    if (result.rows[0]) {
      await this.updateVideoVerificationStatus(verificationId, status);
    }
    
    return result.rows[0];
  }

  // Update video verification status
  static async updateVideoVerificationStatus(verificationId, status) {
    const sql = `
      UPDATE user_videos 
      SET 
        is_verified = $1,
        verification_status = $2,
        verified_at = CASE WHEN $2 = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE id = (
        SELECT video_id FROM video_verifications 
        WHERE verification_id = $3
      )
    `;

    const isVerified = status === 'approved' ? 1 : 0;
    await query(sql, [isVerified, status, verificationId]);
  }

  // Get pending verifications (admin function)
  static async getPendingVerifications(limit = 20) {
    const sql = `
      SELECT 
        vv.verification_id, vv.submitted_at, vv.status,
        uv.filename, uv.url, uv.duration,
        u.first_name, u.last_name, u.email
      FROM video_verifications vv
      JOIN user_videos uv ON vv.video_id = uv.id
      JOIN users u ON vv.user_id = u.id
      WHERE vv.status = 'pending'
      ORDER BY vv.submitted_at ASC
      LIMIT $1
    `;

    const result = await query(sql, [limit]);
    return result.rows;
  }

  // Auto-verify video with AI (placeholder for AI integration)
  static async autoVerifyVideo(videoId, userId) {
    // This would integrate with AI services for deepfake detection
    // For now, we'll simulate the process
    
    const mockAIResult = {
      isAuthentic: Math.random() > 0.1, // 90% pass rate for demo
      confidenceScore: Math.random() * 0.3 + 0.7, // 0.7-1.0 confidence
      detectedIssues: []
    };

    if (mockAIResult.isAuthentic && mockAIResult.confidenceScore > 0.8) {
      // Auto-approve high-confidence authentic videos
      const verificationId = `auto_verify_${Date.now()}`;
      
      const sql = `
        INSERT INTO video_verifications (
          video_id, user_id, verification_id, status, auto_review, confidence_score
        ) VALUES ($1, $2, $3, 'approved', 1, $4)
        RETURNING verification_id
      `;

      await query(sql, [videoId, userId, verificationId, mockAIResult.confidenceScore]);
      await this.updateVideoVerificationStatus(verificationId, 'approved');
      
      return { verified: true, verificationId };
    } else {
      // Send for manual review
      return { verified: false, requiresManualReview: true };
    }
  }

  // Get video statistics
  static async getVideoStats() {
    const sql = `
      SELECT 
        COUNT(*) as total_videos,
        SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verified_videos,
        SUM(CASE WHEN verification_status = 'pending' THEN 1 ELSE 0 END) as pending_videos,
        AVG(file_size) as avg_file_size
      FROM user_videos
    `;

    const result = await query(sql);
    return result.rows[0];
  }
}

module.exports = Video;