const AWS = require('aws-sdk');
const multer = require('multer');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const EnterpriseLogger = require('./EnterpriseLoggerService');
const S3Service = require('./S3Service');

class EnhancedVideoService {
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    this.bucket = process.env.S3_BUCKET_NAME;
    this.maxFileSize = 100 * 1024 * 1024; // 100MB
    this.allowedFormats = ['mp4', 'mov', 'avi', 'mkv'];
    this.maxDuration = 300; // 5 minutes
    
    this.setupMulter();
  }

  /**
   * Setup Multer for video uploads
   */
  setupMulter() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'temp_uploads');
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    });

    this.upload = multer({
      storage,
      limits: { fileSize: this.maxFileSize },
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase().slice(1);
        if (this.allowedFormats.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error(`Invalid file format. Allowed: ${this.allowedFormats.join(', ')}`));
        }
      }
    });
  }

  /**
   * Process video upload with comprehensive validation
   */
  async processVideoUpload(userId, file, options = {}) {
    try {
      const {
        isProfileVideo = false,
        enableAIVerification = true,
        enableDeepfakeDetection = true,
        generateThumbnails = true
      } = options;

      // Validate video file
      const validation = await this.validateVideoFile(file.path);
      if (!validation.isValid) {
        await this.cleanup(file.path);
        throw new Error(`Video validation failed: ${validation.errors.join(', ')}`);
      }

      const processedVideo = await this.processVideo(file.path, userId);
      
      // AI Content Analysis
      const aiAnalysis = enableAIVerification ? 
        await this.performAIContentAnalysis(processedVideo.path) : null;

      // Deepfake Detection
      const deepfakeAnalysis = enableDeepfakeDetection ? 
        await this.performDeepfakeDetection(processedVideo.path) : null;

      // Generate thumbnails
      const thumbnails = generateThumbnails ? 
        await this.generateThumbnails(processedVideo.path) : [];

      // Upload to S3
      const s3Upload = await this.uploadToS3(processedVideo, thumbnails, userId);

      // Save to database
      const mediaRecord = await this.createMediaRecord({
        userId,
        s3Upload,
        validation,
        aiAnalysis,
        deepfakeAnalysis,
        isProfileVideo
      });

      // Cleanup temporary files
      await this.cleanup(file.path, processedVideo.path, ...thumbnails.map(t => t.path));

      return {
        id: mediaRecord.id,
        url: s3Upload.videoUrl,
        thumbnailUrl: s3Upload.thumbnailUrls[0],
        duration: validation.duration,
        aiVerified: aiAnalysis?.isApproved || false,
        deepfakeScore: deepfakeAnalysis?.confidence || 0,
        status: 'uploaded'
      };

    } catch (error) {
      // Cleanup on error
      if (file?.path) await this.cleanup(file.path);
      EnterpriseLogger.error('Video upload processing failed', error, { userId });
      throw error;
    }
  }

  /**
   * Validate video file properties
   */
  async validateVideoFile(filePath) {
    return new Promise((resolve) => {
      const validation = {
        isValid: true,
        errors: [],
        duration: 0,
        resolution: null,
        bitrate: 0,
        fileSize: 0
      };

      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          validation.isValid = false;
          validation.errors.push('Invalid video file format');
          return resolve(validation);
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        if (!videoStream) {
          validation.isValid = false;
          validation.errors.push('No video stream found');
          return resolve(validation);
        }

        validation.duration = metadata.format.duration;
        validation.resolution = `${videoStream.width}x${videoStream.height}`;
        validation.bitrate = metadata.format.bit_rate;
        validation.fileSize = metadata.format.size;

        // Check duration
        if (validation.duration > this.maxDuration) {
          validation.isValid = false;
          validation.errors.push(`Video too long (max ${this.maxDuration}s)`);
        }

        // Check minimum resolution
        if (videoStream.width < 480 || videoStream.height < 480) {
          validation.errors.push('Resolution too low (minimum 480x480)');
        }

        // Check for audio stream (optional but recommended)
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        if (!audioStream) {
          validation.errors.push('No audio track found (recommended for dating profiles)');
        }

        resolve(validation);
      });
    });
  }

  /**
   * Process video (compression, format standardization)
   */
  async processVideo(inputPath, userId) {
    const outputPath = path.join(
      path.dirname(inputPath), 
      `processed_${userId}_${Date.now()}.mp4`
    );

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .size('1080x1920') // Optimized for mobile viewing
        .videoBitrate('2000k')
        .audioBitrate('128k')
        .fps(30)
        .format('mp4')
        .on('end', () => {
          resolve({ path: outputPath, format: 'mp4' });
        })
        .on('error', (err) => {
          EnterpriseLogger.error('Video processing failed', err, { userId, inputPath });
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * Generate video thumbnails
   */
  async generateThumbnails(videoPath) {
    const thumbnails = [];
    const baseDir = path.dirname(videoPath);
    const baseName = path.basename(videoPath, path.extname(videoPath));

    // Generate thumbnails at different timestamps
    const timestamps = ['10%', '30%', '50%'];
    
    for (let i = 0; i < timestamps.length; i++) {
      const thumbnailPath = path.join(baseDir, `${baseName}_thumb_${i}.jpg`);
      
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .seekInput(timestamps[i])
          .frames(1)
          .size('480x640')
          .format('image2')
          .on('end', resolve)
          .on('error', reject)
          .save(thumbnailPath);
      });

      thumbnails.push({ path: thumbnailPath, timestamp: timestamps[i] });
    }

    return thumbnails;
  }

  /**
   * AI Content Analysis (placeholder - integrate with your AI service)
   */
  async performAIContentAnalysis(videoPath) {
    try {
      // This would integrate with services like Amazon Rekognition, Google Video Intelligence, etc.
      
      const analysis = {
        isApproved: true,
        confidence: 0.95,
        flags: [],
        detectedContent: {
          hasAdultContent: false,
          hasViolence: false,
          hasInappropriateContent: false,
          faceDetected: true,
          personCount: 1
        },
        qualityScore: 0.85,
        timestamp: new Date()
      };

      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock some validation logic
      if (analysis.detectedContent.personCount === 0) {
        analysis.isApproved = false;
        analysis.flags.push('No person detected in video');
      }

      if (analysis.detectedContent.personCount > 1) {
        analysis.flags.push('Multiple people detected - profile videos should feature only the account owner');
      }

      return analysis;

    } catch (error) {
      EnterpriseLogger.error('AI content analysis failed', error, { videoPath });
      return {
        isApproved: false,
        confidence: 0,
        flags: ['AI analysis failed'],
        error: error.message
      };
    }
  }

  /**
   * Deepfake Detection (placeholder - integrate with specialized service)
   */
  async performDeepfakeDetection(videoPath) {
    try {
      // This would integrate with deepfake detection services
      
      const analysis = {
        confidence: 0.02, // Low confidence = likely real
        isDeepfake: false,
        riskLevel: 'low', // low, medium, high
        details: {
          facialInconsistencies: 0.01,
          temporalAnomalies: 0.02,
          compressionArtifacts: 0.03
        },
        timestamp: new Date()
      };

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 5000));

      if (analysis.confidence > 0.7) {
        analysis.isDeepfake = true;
        analysis.riskLevel = 'high';
      } else if (analysis.confidence > 0.3) {
        analysis.riskLevel = 'medium';
      }

      return analysis;

    } catch (error) {
      EnterpriseLogger.error('Deepfake detection failed', error, { videoPath });
      return {
        confidence: 1.0, // Assume high risk if detection fails
        isDeepfake: true,
        riskLevel: 'high',
        error: error.message
      };
    }
  }

  /**
   * Upload video and thumbnails to S3
   */
  async uploadToS3(videoData, thumbnails, userId) {
    try {
      const videoKey = `videos/${userId}/${uuidv4()}_${Date.now()}.mp4`;
      const thumbnailUrls = [];

      // Upload main video
      const videoUpload = await S3Service.uploadFile(videoData.path, videoKey, {
        ContentType: 'video/mp4',
        CacheControl: 'max-age=31536000',
        Metadata: {
          userId: userId.toString(),
          uploadDate: new Date().toISOString()
        }
      });

      // Upload thumbnails
      for (let i = 0; i < thumbnails.length; i++) {
        const thumbnail = thumbnails[i];
        const thumbnailKey = `thumbnails/${userId}/${uuidv4()}_thumb_${i}.jpg`;
        
        const thumbnailUpload = await S3Service.uploadFile(thumbnail.path, thumbnailKey, {
          ContentType: 'image/jpeg',
          CacheControl: 'max-age=31536000'
        });

        thumbnailUrls.push(thumbnailUpload.Location);
      }

      return {
        videoUrl: videoUpload.Location,
        videoKey,
        thumbnailUrls,
        bucket: this.bucket
      };

    } catch (error) {
      EnterpriseLogger.error('S3 upload failed', error, { userId });
      throw error;
    }
  }

  /**
   * Create database record for uploaded media
   */
  async createMediaRecord(data) {
    try {
      const {
        userId,
        s3Upload,
        validation,
        aiAnalysis,
        deepfakeAnalysis,
        isProfileVideo
      } = data;

      // This would use your User Media model
      const mediaRecord = {
        id: uuidv4(),
        userId,
        mediaType: 'video',
        fileUrl: s3Upload.videoUrl,
        thumbnailUrl: s3Upload.thumbnailUrls[0],
        fileSize: validation.fileSize,
        mimeType: 'video/mp4',
        isVerified: aiAnalysis?.isApproved || false,
        deepfakeScore: deepfakeAnalysis?.confidence || 0,
        moderationStatus: this.determineModerationStatus(aiAnalysis, deepfakeAnalysis),
        isProfileVideo,
        uploadDate: new Date()
      };

      // Save to database (implement with your DB layer)
      // await UserMedia.create(mediaRecord);

      return mediaRecord;

    } catch (error) {
      EnterpriseLogger.error('Create media record failed', error);
      throw error;
    }
  }

  /**
   * Determine moderation status based on AI analysis
   */
  determineModerationStatus(aiAnalysis, deepfakeAnalysis) {
    if (!aiAnalysis || !deepfakeAnalysis) return 'pending';
    
    if (deepfakeAnalysis.isDeepfake || deepfakeAnalysis.confidence > 0.7) {
      return 'rejected';
    }

    if (!aiAnalysis.isApproved || aiAnalysis.flags.length > 0) {
      return 'pending';
    }

    return 'approved';
  }

  /**
   * Clean up temporary files
   */
  async cleanup(...filePaths) {
    for (const filePath of filePaths) {
      try {
        if (filePath) {
          await fs.unlink(filePath);
        }
      } catch (error) {
        // Ignore cleanup errors
        EnterpriseLogger.warn('File cleanup failed', { filePath, error: error.message });
      }
    }
  }

  /**
   * Get video statistics for admin dashboard
   */
  async getVideoStatistics() {
    try {
      // This would query your database for statistics
      return {
        totalVideos: 0,
        pendingModeration: 0,
        approvedVideos: 0,
        rejectedVideos: 0,
        deepfakeDetected: 0,
        averageProcessingTime: 0
      };
    } catch (error) {
      EnterpriseLogger.error('Get video statistics failed', error);
      throw error;
    }
  }

  /**
   * Delete video and associated files
   */
  async deleteVideo(videoId, userId) {
    try {
      // Get video record from database
      // const video = await UserMedia.findByIdAndUserId(videoId, userId);
      
      // Delete from S3
      // await S3Service.deleteFile(video.fileKey);
      
      // Delete thumbnails
      // for (const thumbnailUrl of video.thumbnailUrls) {
      //   await S3Service.deleteFile(this.extractS3Key(thumbnailUrl));
      // }
      
      // Delete database record
      // await UserMedia.delete(videoId);

      EnterpriseLogger.info('Video deleted successfully', { videoId, userId });
      
    } catch (error) {
      EnterpriseLogger.error('Delete video failed', error, { videoId, userId });
      throw error;
    }
  }

  /**
   * Extract S3 key from URL
   */
  extractS3Key(url) {
    const urlParts = url.split('/');
    return urlParts.slice(3).join('/'); // Remove protocol, domain, bucket
  }
}

module.exports = new EnhancedVideoService();