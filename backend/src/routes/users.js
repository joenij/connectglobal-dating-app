const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, validateFileUpload } = require('../middleware/security');
const User = require('../models/User');
const Video = require('../models/Video');

const router = express.Router();

// Configure multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/videos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `video-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const videoUpload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only video files are allowed (MP4, WebM, MOV)'));
  }
});

// GET /api/v1/users/profile - Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // TODO: Fetch user profile from database
    const userProfile = {
      id: req.user.id,
      email: req.user.email,
      firstName: 'John',
      lastName: 'Doe',
      age: 25,
      location: 'New York, US',
      bio: 'Hello world!',
      interests: ['Travel', 'Technology', 'Music'],
      photos: [],
      verified: false
    };

    res.json(userProfile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/v1/users/profile - Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const updates = req.body;
    
    // TODO: Validate and update user profile in database
    console.log('Profile update:', updates);

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/v1/users/:id - Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // TODO: Fetch user by ID from database
    const user = {
      id: id,
      firstName: 'Jane',
      lastName: 'Smith',
      age: 28,
      location: 'London, UK',
      photos: ['https://example.com/photo.jpg'],
      verified: true
    };

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'User not found' });
  }
});

// POST /api/v1/users/video - Upload profile video
router.post('/video', authenticateToken, videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const videoUrl = `/uploads/videos/${req.file.filename}`;
    const videoData = {
      userId: req.user.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: videoUrl
    };

    // Save video metadata to database
    const savedVideo = await Video.saveVideo(videoData);

    // Attempt auto-verification
    const autoVerifyResult = await Video.autoVerifyVideo(savedVideo.id, req.user.id);

    res.json({
      message: 'Video uploaded successfully',
      video: {
        id: savedVideo.id,
        url: videoUrl,
        filename: req.file.filename,
        size: req.file.size,
        autoVerified: autoVerifyResult.verified,
        requiresManualReview: autoVerifyResult.requiresManualReview
      }
    });
  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// GET /api/v1/users/video/:userId - Get user's profile video
router.get('/video/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const video = await Video.getUserVideo(userId);
    
    if (!video) {
      return res.status(404).json({ error: 'No video found for this user' });
    }

    res.json({
      id: video.id,
      url: video.url,
      filename: video.filename,
      duration: video.duration,
      thumbnailUrl: video.thumbnail_url,
      isVerified: video.is_verified,
      verificationStatus: video.verification_status,
      uploadedAt: video.uploaded_at,
      verifiedAt: video.verified_at
    });
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// DELETE /api/v1/users/video - Delete profile video
router.delete('/video', authenticateToken, async (req, res) => {
  try {
    // TODO: Delete video file and database record
    console.log(`Deleting video for user ${req.user.id}`);

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// POST /api/v1/users/video/verify - Submit video for verification
router.post('/video/verify', authenticateToken, async (req, res) => {
  try {
    const { videoId } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID required' });
    }

    const verification = await Video.submitForVerification(req.user.id, videoId);

    res.json({
      message: 'Video submitted for verification',
      verificationId: verification.verification_id,
      submittedAt: verification.submitted_at,
      estimatedReviewTime: '24-48 hours'
    });
  } catch (error) {
    console.error('Video verification error:', error);
    res.status(500).json({ error: 'Failed to submit video for verification' });
  }
});

// GET /api/v1/users/video/verification/:verificationId - Check verification status
router.get('/video/verification/:verificationId', authenticateToken, async (req, res) => {
  try {
    const { verificationId } = req.params;
    
    const status = await Video.getVerificationStatus(verificationId);
    
    if (!status) {
      return res.status(404).json({ error: 'Verification not found' });
    }

    res.json({
      id: status.verification_id,
      status: status.status,
      submittedAt: status.submitted_at,
      reviewedAt: status.reviewed_at,
      feedback: status.feedback,
      autoReview: status.auto_review,
      confidenceScore: status.confidence_score,
      videoFilename: status.filename,
      videoUrl: status.url
    });
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

module.exports = router;