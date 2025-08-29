const express = require('express');
const { authenticateToken } = require('../middleware/security');
const S3Service = require('../services/S3Service');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Upload profile image
router.post('/profile-image', authenticateToken, (req, res) => {
  const upload = S3Service.getUploadMiddleware('images', { maxSize: 5 * 1024 * 1024 }); // 5MB limit
  
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Profile image upload error:', err);
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const imageUrl = S3Service.enabled ? req.file.location : S3Service.getPublicUrl(req.file.filename);
    
    res.json({
      success: true,
      imageUrl,
      filename: req.file.key || req.file.filename,
      size: req.file.size
    });
  });
});

// Upload video profile
router.post('/profile-video', authenticateToken, (req, res) => {
  const upload = S3Service.getUploadMiddleware('videos', { maxSize: 50 * 1024 * 1024 }); // 50MB limit
  
  upload.single('video')(req, res, (err) => {
    if (err) {
      console.error('Profile video upload error:', err);
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const videoUrl = S3Service.enabled ? req.file.location : S3Service.getPublicUrl(req.file.filename);
    
    res.json({
      success: true,
      videoUrl,
      filename: req.file.key || req.file.filename,
      size: req.file.size,
      duration: req.body.duration || null
    });
  });
});

// Delete uploaded file
router.delete('/file/:filename', authenticateToken, async (req, res) => {
  try {
    const { filename } = req.params;
    const userId = req.user.id;

    // Add security check - only allow users to delete their own files
    // This would require storing file ownership in database
    
    const success = await S3Service.deleteFile(filename);
    
    if (success) {
      res.json({ success: true, message: 'File deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete file' });
    }
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Get signed URL for temporary access
router.get('/signed-url/:filename', authenticateToken, async (req, res) => {
  try {
    const { filename } = req.params;
    const expiration = parseInt(req.query.expires) || 3600; // 1 hour default
    
    const signedUrl = await S3Service.getSignedUrl(filename, expiration);
    
    if (signedUrl) {
      res.json({ success: true, url: signedUrl, expiresIn: expiration });
    } else {
      res.status(500).json({ error: 'Failed to generate signed URL' });
    }
  } catch (error) {
    console.error('Signed URL error:', error);
    res.status(500).json({ error: 'Failed to generate signed URL' });
  }
});

// Health check for upload service
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    s3Enabled: S3Service.enabled,
    storageType: S3Service.enabled ? 'AWS S3' : 'Local Storage',
    maxImageSize: '5MB',
    maxVideoSize: '50MB'
  });
});

module.exports = router;