const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

class S3Service {
  constructor() {
    // Configure AWS only if credentials are available
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1'
      });

      this.s3 = new AWS.S3();
      this.bucketName = process.env.S3_BUCKET_NAME || 'connectglobal-media';
      this.cloudfrontUrl = process.env.CLOUDFRONT_URL;
      this.enabled = true;
    } else {
      console.warn('AWS S3 credentials not configured - using local storage');
      this.enabled = false;
    }
  }

  // Configure multer for file uploads
  getUploadMiddleware(fileType = 'images', options = {}) {
    const maxSize = options.maxSize || (fileType === 'videos' ? 50 * 1024 * 1024 : 5 * 1024 * 1024); // 50MB for videos, 5MB for images
    
    if (!this.enabled) {
      // Local storage fallback
      return multer({
        storage: multer.diskStorage({
          destination: (req, file, cb) => {
            const uploadPath = `backend/uploads/${fileType}`;
            require('fs').mkdirSync(uploadPath, { recursive: true });
            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
            cb(null, uniqueName);
          }
        }),
        limits: { fileSize: maxSize },
        fileFilter: this.getFileFilter(fileType)
      });
    }

    // S3 storage
    return multer({
      storage: multerS3({
        s3: this.s3,
        bucket: this.bucketName,
        key: (req, file, cb) => {
          const folder = fileType;
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
          cb(null, `${folder}/${uniqueName}`);
        },
        contentType: multerS3.AUTO_CONTENT_TYPE
      }),
      limits: { fileSize: maxSize },
      fileFilter: this.getFileFilter(fileType)
    });
  }

  getFileFilter(fileType) {
    return (req, file, cb) => {
      if (fileType === 'images') {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'), false);
        }
      } else if (fileType === 'videos') {
        if (file.mimetype.startsWith('video/')) {
          cb(null, true);
        } else {
          cb(new Error('Only video files are allowed'), false);
        }
      } else {
        cb(null, true); // Allow all files
      }
    };
  }

  // Get public URL for uploaded file
  getPublicUrl(key) {
    if (!this.enabled) {
      // Return local file URL
      return `${process.env.BACKEND_URL || 'http://localhost:8000'}/uploads/${key}`;
    }

    if (this.cloudfrontUrl) {
      return `${this.cloudfrontUrl}/${key}`;
    }

    return `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  }

  // Delete file from S3
  async deleteFile(key) {
    if (!this.enabled) {
      // Delete local file
      try {
        require('fs').unlinkSync(path.join('backend/uploads', key));
        return true;
      } catch (error) {
        console.error('Error deleting local file:', error);
        return false;
      }
    }

    try {
      await this.s3.deleteObject({
        Bucket: this.bucketName,
        Key: key
      }).promise();
      
      return true;
    } catch (error) {
      console.error('S3 delete error:', error);
      return false;
    }
  }

  // Generate signed URL for temporary access
  async getSignedUrl(key, expiration = 3600) {
    if (!this.enabled) {
      return this.getPublicUrl(key);
    }

    try {
      const url = await this.s3.getSignedUrlPromise('getObject', {
        Bucket: this.bucketName,
        Key: key,
        Expires: expiration
      });
      
      return url;
    } catch (error) {
      console.error('S3 signed URL error:', error);
      return null;
    }
  }

  // Upload buffer directly to S3
  async uploadBuffer(buffer, key, contentType = 'application/octet-stream') {
    if (!this.enabled) {
      // Save to local storage
      try {
        const uploadPath = path.join('backend/uploads', path.dirname(key));
        require('fs').mkdirSync(uploadPath, { recursive: true });
        require('fs').writeFileSync(path.join('backend/uploads', key), buffer);
        return this.getPublicUrl(key);
      } catch (error) {
        console.error('Error saving local file:', error);
        throw error;
      }
    }

    try {
      const result = await this.s3.upload({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType
      }).promise();

      return result.Location;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw error;
    }
  }
}

module.exports = new S3Service();