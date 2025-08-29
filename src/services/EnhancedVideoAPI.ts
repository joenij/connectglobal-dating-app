import apiClient from './api/client';

export interface VideoUploadOptions {
  isProfileVideo?: boolean;
  enableAIVerification?: boolean;
  enableDeepfakeDetection?: boolean;
  generateThumbnails?: boolean;
}

export interface ProcessedVideo {
  id: string;
  url: string;
  thumbnailUrl: string;
  duration: number;
  aiVerified: boolean;
  deepfakeScore: number;
  status: 'uploaded' | 'processing' | 'approved' | 'rejected' | 'pending';
}

export interface VideoProcessingResult {
  success: boolean;
  video: ProcessedVideo;
  processing: {
    aiVerified: boolean;
    deepfakeScore: number;
    status: string;
  };
  message: string;
}

export interface VideoStatistics {
  totalVideos: number;
  pendingModeration: number;
  approvedVideos: number;
  rejectedVideos: number;
  deepfakeDetected: number;
  averageProcessingTime: number;
}

class EnhancedVideoAPI {
  /**
   * Upload and process video with AI verification
   */
  async uploadVideo(
    videoFile: any,
    options: VideoUploadOptions = {}
  ): Promise<VideoProcessingResult> {
    try {
      const formData = new FormData();
      formData.append('video', {
        uri: videoFile.uri,
        type: 'video/mp4',
        name: videoFile.fileName || 'video.mp4',
      } as any);

      // Add options as form fields
      formData.append('isProfileVideo', (options.isProfileVideo || false).toString());
      formData.append('enableAIVerification', (options.enableAIVerification !== false).toString());
      formData.append('enableDeepfakeDetection', (options.enableDeepfakeDetection !== false).toString());
      formData.append('generateThumbnails', (options.generateThumbnails !== false).toString());

      console.log('🎬 Uploading video with AI verification...');

      const response = await apiClient.post('/enhanced-videos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        // Longer timeout for video processing
        timeout: 300000, // 5 minutes
      });

      console.log('✅ Video processing completed:', response.data.video.status);
      return response.data;
    } catch (error) {
      console.error('❌ Video upload failed:', error);
      throw error;
    }
  }

  /**
   * Get user's videos
   */
  async getUserVideos(userId?: string): Promise<{
    success: boolean;
    videos: ProcessedVideo[];
    userId: number;
  }> {
    try {
      const endpoint = userId ? `/enhanced-videos/user/${userId}` : '/enhanced-videos/user/me';
      const response = await apiClient.get(endpoint);
      return response.data;
    } catch (error) {
      console.error('❌ Get user videos failed:', error);
      throw error;
    }
  }

  /**
   * Delete video
   */
  async deleteVideo(videoId: string): Promise<{
    success: boolean;
    message: string;
    videoId: string;
  }> {
    try {
      const response = await apiClient.delete(`/enhanced-videos/${videoId}`);
      
      console.log('🗑️ Video deleted:', videoId);
      return response.data;
    } catch (error) {
      console.error('❌ Video deletion failed:', error);
      throw error;
    }
  }

  /**
   * Report inappropriate video
   */
  async reportVideo(
    videoId: string,
    reason: 'inappropriate' | 'fake' | 'spam' | 'harassment' | 'other',
    details?: string
  ): Promise<{
    success: boolean;
    message: string;
    videoId: string;
    reason: string;
  }> {
    try {
      const response = await apiClient.post(`/enhanced-videos/${videoId}/report`, {
        reason,
        details
      });

      console.log('🚨 Video reported:', { videoId, reason });
      return response.data;
    } catch (error) {
      console.error('❌ Video report failed:', error);
      throw error;
    }
  }

  /**
   * Get video processing statistics (admin only)
   */
  async getVideoStatistics(): Promise<{
    success: boolean;
    statistics: VideoStatistics;
    timestamp: string;
  }> {
    try {
      const response = await apiClient.get('/enhanced-videos/statistics');
      return response.data;
    } catch (error) {
      console.error('❌ Get video statistics failed:', error);
      throw error;
    }
  }

  /**
   * Get video upload progress (if supported by the client)
   */
  uploadVideoWithProgress(
    videoFile: any,
    options: VideoUploadOptions = {},
    onProgress?: (progress: number) => void
  ): Promise<VideoProcessingResult> {
    return new Promise(async (resolve, reject) => {
      try {
        const formData = new FormData();
        formData.append('video', {
          uri: videoFile.uri,
          type: 'video/mp4',
          name: videoFile.fileName || 'video.mp4',
        } as any);

        // Add options as form fields
        formData.append('isProfileVideo', (options.isProfileVideo || false).toString());
        formData.append('enableAIVerification', (options.enableAIVerification !== false).toString());
        formData.append('enableDeepfakeDetection', (options.enableDeepfakeDetection !== false).toString());
        formData.append('generateThumbnails', (options.generateThumbnails !== false).toString());

        console.log('🎬 Uploading video with progress tracking...');

        // This would need to be implemented with a library that supports upload progress
        // For now, just simulate progress
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          onProgress?.(progress);
          if (progress >= 90) {
            clearInterval(interval);
          }
        }, 500);

        const response = await apiClient.post('/enhanced-videos/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 300000,
        });

        clearInterval(interval);
        onProgress?.(100);

        console.log('✅ Video processing completed with progress tracking');
        resolve(response.data);
      } catch (error) {
        console.error('❌ Video upload with progress failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Validate video before upload
   */
  validateVideo(videoFile: any): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size (100MB limit)
    const maxSize = 100 * 1024 * 1024;
    if (videoFile.fileSize && videoFile.fileSize > maxSize) {
      errors.push(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
    }

    // Check file type
    const allowedTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/mkv'];
    if (videoFile.type && !allowedTypes.includes(videoFile.type)) {
      errors.push(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Check duration if available (5 minutes max)
    if (videoFile.duration && videoFile.duration > 300) {
      errors.push('Video too long. Maximum duration is 5 minutes');
    }

    // Warnings
    if (videoFile.fileSize && videoFile.fileSize < 1024 * 1024) {
      warnings.push('Video file is very small. Consider using a higher quality recording');
    }

    if (videoFile.duration && videoFile.duration < 10) {
      warnings.push('Video is very short. Consider recording a longer introduction');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get video processing status display
   */
  getProcessingStatusDisplay(status: ProcessedVideo['status']): {
    label: string;
    color: string;
    icon: string;
    description: string;
  } {
    const statusMap = {
      uploaded: {
        label: 'Uploaded',
        color: '#2196F3',
        icon: '📤',
        description: 'Video has been uploaded successfully'
      },
      processing: {
        label: 'Processing',
        color: '#FF9800',
        icon: '⚡',
        description: 'AI verification and processing in progress'
      },
      approved: {
        label: 'Approved',
        color: '#4CAF50',
        icon: '✅',
        description: 'Video has been verified and approved'
      },
      rejected: {
        label: 'Rejected',
        color: '#F44336',
        icon: '❌',
        description: 'Video did not pass verification'
      },
      pending: {
        label: 'Pending Review',
        color: '#9C27B0',
        icon: '⏳',
        description: 'Video is awaiting manual review'
      }
    };

    return statusMap[status] || statusMap.uploaded;
  }

  /**
   * Get deepfake score interpretation
   */
  interpretDeepfakeScore(score: number): {
    risk: 'low' | 'medium' | 'high';
    color: string;
    description: string;
    trustLevel: string;
  } {
    if (score <= 0.3) {
      return {
        risk: 'low',
        color: '#4CAF50',
        description: 'Video appears authentic',
        trustLevel: 'High Trust'
      };
    } else if (score <= 0.7) {
      return {
        risk: 'medium',
        color: '#FF9800',
        description: 'Some artificial elements detected',
        trustLevel: 'Medium Trust'
      };
    } else {
      return {
        risk: 'high',
        color: '#F44336',
        description: 'High probability of artificial content',
        trustLevel: 'Low Trust'
      };
    }
  }
}

export default new EnhancedVideoAPI();