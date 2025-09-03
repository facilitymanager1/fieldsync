/**
 * Biometric Enrollment Service - Face Recognition and Fingerprint Management
 * 
 * Features:
 * - Face recognition enrollment with liveness detection
 * - Multiple photo capture and quality validation
 * - Integration with attendance system
 * - Biometric template management
 * - Anti-spoofing measures
 * - Enrollment retry mechanisms
 */

import mongoose from 'mongoose';
import { OnboardingRecord } from '../../models/onboarding/onboardingRecord';
import { AuditLog } from '../../models/auditLog';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

interface BiometricEnrollmentResult {
  success: boolean;
  enrollmentId?: string;
  templateId?: string;
  qualityScore?: number;
  livenessScore?: number;
  errors?: string[];
  warnings?: string[];
}

interface FaceEnrollmentData {
  photos: {
    photoId: string;
    filePath: string;
    qualityScore: number;
    faceDetected: boolean;
    livenessScore: number;
    timestamp: Date;
  }[];
  template?: {
    templateId: string;
    encodedTemplate: string;
    algorithm: string;
    version: string;
  };
  enrollmentStatus: 'pending' | 'enrolled' | 'failed' | 'retry_required';
  enrollmentAttempts: number;
  lastEnrollmentAt?: Date;
}

interface BiometricConfig {
  minPhotos: number;
  maxPhotos: number;
  minQualityScore: number;
  minLivenessScore: number;
  maxEnrollmentAttempts: number;
  supportedFormats: string[];
  maxFileSize: number;
}

export class BiometricEnrollmentService {
  private readonly config: BiometricConfig = {
    minPhotos: 3,
    maxPhotos: 5,
    minQualityScore: 0.7,
    minLivenessScore: 0.8,
    maxEnrollmentAttempts: 3,
    supportedFormats: ['jpg', 'jpeg', 'png'],
    maxFileSize: 5 * 1024 * 1024 // 5MB
  };

  private readonly biometricStoragePath = process.env.BIOMETRIC_STORAGE_PATH || './storage/biometrics';

  /**
   * Initialize face recognition enrollment
   */
  async initiateFaceEnrollment(
    onboardingId: string,
    employeeId: string
  ): Promise<{ enrollmentId: string; requirements: BiometricConfig }> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      // Get onboarding record
      const onboarding = await OnboardingRecord.findOne({ onboardingId }).session(session);
      if (!onboarding) {
        throw new Error('Onboarding record not found');
      }

      // Find biometric enrollment step
      const biometricStep = onboarding.workflowSteps.find(
        step => step.stepKey === 'biometric_enrollment'
      );
      
      if (!biometricStep) {
        throw new Error('Biometric enrollment step not found');
      }

      // Generate enrollment ID
      const enrollmentId = crypto.randomUUID();

      // Initialize face enrollment data
      biometricStep.faceEnrollment = {
        enrollmentId,
        photos: [],
        enrollmentStatus: 'pending',
        enrollmentAttempts: (biometricStep.faceEnrollment?.enrollmentAttempts || 0) + 1,
        initiatedAt: new Date()
      };

      // Update step status
      biometricStep.stepStatus = 'in_progress';
      biometricStep.startedAt = new Date();
      onboarding.lastActivity = new Date();

      await onboarding.save({ session });
      await session.commitTransaction();

      // Log audit event
      await this.logAuditEvent(onboardingId, 'face_enrollment_initiated', {
        enrollmentId,
        employeeId,
        attempt: biometricStep.faceEnrollment.enrollmentAttempts
      });

      return {
        enrollmentId,
        requirements: this.config
      };

    } catch (error) {
      await session.abortTransaction();
      console.error('Face enrollment initiation error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Upload and process face photo
   */
  async uploadFacePhoto(
    onboardingId: string,
    enrollmentId: string,
    photoBuffer: Buffer,
    originalFilename: string
  ): Promise<BiometricEnrollmentResult> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      // Get onboarding record
      const onboarding = await OnboardingRecord.findOne({ onboardingId }).session(session);
      if (!onboarding) {
        throw new Error('Onboarding record not found');
      }

      const biometricStep = onboarding.workflowSteps.find(
        step => step.stepKey === 'biometric_enrollment'
      );
      
      if (!biometricStep?.faceEnrollment || biometricStep.faceEnrollment.enrollmentId !== enrollmentId) {
        throw new Error('Invalid enrollment session');
      }

      // Validate file
      const validation = await this.validatePhotoFile(photoBuffer, originalFilename);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // Check if max photos reached
      if (biometricStep.faceEnrollment.photos.length >= this.config.maxPhotos) {
        return {
          success: false,
          errors: [`Maximum ${this.config.maxPhotos} photos allowed`]
        };
      }

      // Generate photo ID and save file
      const photoId = crypto.randomUUID();
      const fileExtension = path.extname(originalFilename).toLowerCase();
      const filename = `${onboardingId}_${enrollmentId}_${photoId}${fileExtension}`;
      const filePath = path.join(this.biometricStoragePath, 'faces', filename);

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, photoBuffer);

      // Process photo for face detection and quality analysis
      const photoAnalysis = await this.analyzeFacePhoto(filePath);

      // Add photo to enrollment
      biometricStep.faceEnrollment.photos.push({
        photoId,
        filePath,
        qualityScore: photoAnalysis.qualityScore,
        faceDetected: photoAnalysis.faceDetected,
        livenessScore: photoAnalysis.livenessScore,
        timestamp: new Date()
      });

      onboarding.lastActivity = new Date();
      await onboarding.save({ session });

      // Check if we have enough photos for enrollment
      const validPhotos = biometricStep.faceEnrollment.photos.filter(
        photo => photo.faceDetected && 
                 photo.qualityScore >= this.config.minQualityScore &&
                 photo.livenessScore >= this.config.minLivenessScore
      );

      let result: BiometricEnrollmentResult = {
        success: true,
        qualityScore: photoAnalysis.qualityScore,
        livenessScore: photoAnalysis.livenessScore
      };

      if (validPhotos.length >= this.config.minPhotos) {
        // Proceed with template generation
        const enrollmentResult = await this.generateFaceTemplate(onboarding, biometricStep);
        result = { ...result, ...enrollmentResult };
      } else {
        result.warnings = [
          `Need ${this.config.minPhotos - validPhotos.length} more valid photos for enrollment`
        ];
      }

      await session.commitTransaction();

      // Log audit event
      await this.logAuditEvent(onboardingId, 'face_photo_uploaded', {
        enrollmentId,
        photoId,
        qualityScore: photoAnalysis.qualityScore,
        livenessScore: photoAnalysis.livenessScore,
        faceDetected: photoAnalysis.faceDetected,
        validPhotosCount: validPhotos.length
      });

      return result;

    } catch (error) {
      await session.abortTransaction();
      console.error('Face photo upload error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Photo upload failed']
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Generate face recognition template
   */
  private async generateFaceTemplate(
    onboarding: any,
    biometricStep: any
  ): Promise<BiometricEnrollmentResult> {
    try {
      const validPhotos = biometricStep.faceEnrollment.photos.filter(
        (photo: any) => photo.faceDetected && 
                       photo.qualityScore >= this.config.minQualityScore &&
                       photo.livenessScore >= this.config.minLivenessScore
      );

      if (validPhotos.length < this.config.minPhotos) {
        return {
          success: false,
          errors: [`Insufficient valid photos. Need at least ${this.config.minPhotos}`]
        };
      }

      // Simulate face template generation
      // In production, integrate with actual face recognition SDK
      const templateData = await this.createFaceTemplate(validPhotos);

      // Update enrollment data
      const templateId = crypto.randomUUID();
      biometricStep.faceEnrollment.template = {
        templateId,
        encodedTemplate: templateData.template,
        algorithm: templateData.algorithm,
        version: templateData.version
      };

      biometricStep.faceEnrollment.enrollmentStatus = 'enrolled';
      biometricStep.faceEnrollment.lastEnrollmentAt = new Date();
      biometricStep.stepStatus = 'verified';
      biometricStep.completedAt = new Date();

      // Update overall biometric enrollment status
      biometricStep.biometricData = biometricStep.biometricData || {};
      biometricStep.biometricData.faceEnrolled = true;
      biometricStep.biometricData.faceTemplateId = templateId;

      await onboarding.save();

      // Register with attendance system
      await this.registerWithAttendanceSystem(onboarding.onboardingId, templateId, templateData.template);

      return {
        success: true,
        enrollmentId: biometricStep.faceEnrollment.enrollmentId,
        templateId,
        qualityScore: Math.max(...validPhotos.map((p: any) => p.qualityScore)),
        livenessScore: Math.max(...validPhotos.map((p: any) => p.livenessScore))
      };

    } catch (error) {
      console.error('Face template generation error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Template generation failed']
      };
    }
  }

  /**
   * Validate uploaded photo file
   */
  private async validatePhotoFile(
    photoBuffer: Buffer,
    originalFilename: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check file size
    if (photoBuffer.length > this.config.maxFileSize) {
      errors.push(`File size exceeds ${this.config.maxFileSize / (1024 * 1024)}MB limit`);
    }

    // Check file format
    const extension = path.extname(originalFilename).toLowerCase().substring(1);
    if (!this.config.supportedFormats.includes(extension)) {
      errors.push(`Unsupported format. Allowed: ${this.config.supportedFormats.join(', ')}`);
    }

    // Basic image validation (check magic bytes)
    const magicBytes = photoBuffer.subarray(0, 4);
    const isValidImage = this.isValidImageBuffer(magicBytes, extension);
    if (!isValidImage) {
      errors.push('Invalid image file');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if buffer contains valid image data
   */
  private isValidImageBuffer(magicBytes: Buffer, extension: string): boolean {
    const hex = magicBytes.toString('hex').toUpperCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return hex.startsWith('FFD8');
      case 'png':
        return hex.startsWith('89504E47');
      default:
        return false;
    }
  }

  /**
   * Analyze face photo for quality and liveness
   */
  private async analyzeFacePhoto(filePath: string): Promise<{
    faceDetected: boolean;
    qualityScore: number;
    livenessScore: number;
    faceCount: number;
  }> {
    try {
      // Simulate face analysis - integrate with actual face recognition SDK
      // This would typically use libraries like OpenCV, dlib, or commercial SDKs
      
      // Placeholder analysis
      const analysisResult = {
        faceDetected: Math.random() > 0.1, // 90% chance of face detection
        qualityScore: 0.6 + Math.random() * 0.4, // Random score between 0.6-1.0
        livenessScore: 0.7 + Math.random() * 0.3, // Random score between 0.7-1.0
        faceCount: Math.random() > 0.8 ? 2 : 1 // 20% chance of multiple faces
      };

      // Ensure single face detection
      if (analysisResult.faceCount > 1) {
        analysisResult.faceDetected = false;
        analysisResult.qualityScore = 0;
      }

      return analysisResult;

    } catch (error) {
      console.error('Face analysis error:', error);
      return {
        faceDetected: false,
        qualityScore: 0,
        livenessScore: 0,
        faceCount: 0
      };
    }
  }

  /**
   * Create face recognition template
   */
  private async createFaceTemplate(validPhotos: any[]): Promise<{
    template: string;
    algorithm: string;
    version: string;
  }> {
    try {
      // Simulate template creation - integrate with actual face recognition SDK
      // This would typically extract facial features and create a biometric template
      
      const templateData = {
        template: Buffer.from(JSON.stringify({
          photos: validPhotos.map(p => p.photoId),
          features: Array.from({ length: 128 }, () => Math.random()), // Simulated feature vector
          timestamp: new Date().toISOString()
        })).toString('base64'),
        algorithm: 'FaceNet',
        version: '1.0.0'
      };

      return templateData;

    } catch (error) {
      console.error('Template creation error:', error);
      throw error;
    }
  }

  /**
   * Register biometric template with attendance system
   */
  private async registerWithAttendanceSystem(
    onboardingId: string,
    templateId: string,
    template: string
  ): Promise<void> {
    try {
      // Simulate attendance system registration
      // In production, this would integrate with the actual attendance system API
      
      console.log(`Registering template ${templateId} for onboarding ${onboardingId} with attendance system`);
      
      // This would typically make an API call to the attendance system
      // await attendanceSystemAPI.registerTemplate({
      //   onboardingId,
      //   templateId,
      //   template,
      //   type: 'face'
      // });

    } catch (error) {
      console.error('Attendance system registration error:', error);
      // Don't throw error - enrollment should still succeed even if attendance registration fails
    }
  }

  /**
   * Reset biometric enrollment
   */
  async resetBiometricEnrollment(onboardingId: string): Promise<void> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      const onboarding = await OnboardingRecord.findOne({ onboardingId }).session(session);
      if (!onboarding) {
        throw new Error('Onboarding record not found');
      }

      const biometricStep = onboarding.workflowSteps.find(
        step => step.stepKey === 'biometric_enrollment'
      );
      
      if (biometricStep) {
        // Clean up existing photos
        if (biometricStep.faceEnrollment?.photos) {
          for (const photo of biometricStep.faceEnrollment.photos) {
            try {
              await fs.unlink(photo.filePath);
            } catch (error) {
              console.warn(`Failed to delete photo file: ${photo.filePath}`);
            }
          }
        }

        // Reset enrollment data
        biometricStep.faceEnrollment = undefined;
        biometricStep.biometricData = {
          faceEnrolled: false,
          fingerprintEnrolled: false
        };
        biometricStep.stepStatus = 'pending';
        biometricStep.startedAt = undefined;
        biometricStep.completedAt = undefined;

        onboarding.lastActivity = new Date();
        await onboarding.save({ session });
      }

      await session.commitTransaction();

      // Log audit event
      await this.logAuditEvent(onboardingId, 'biometric_enrollment_reset', {});

    } catch (error) {
      await session.abortTransaction();
      console.error('Biometric reset error:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get enrollment status
   */
  async getEnrollmentStatus(onboardingId: string): Promise<{
    status: string;
    faceEnrollment?: FaceEnrollmentData;
    requirements: BiometricConfig;
  }> {
    const onboarding = await OnboardingRecord.findOne({ onboardingId });
    if (!onboarding) {
      throw new Error('Onboarding record not found');
    }

    const biometricStep = onboarding.workflowSteps.find(
      step => step.stepKey === 'biometric_enrollment'
    );

    return {
      status: biometricStep?.stepStatus || 'pending',
      faceEnrollment: biometricStep?.faceEnrollment,
      requirements: this.config
    };
  }

  /**
   * Verify biometric data
   */
  async verifyBiometric(
    templateId: string,
    verificationData: Buffer
  ): Promise<{ verified: boolean; confidence: number }> {
    try {
      // Simulate biometric verification
      // In production, this would compare against stored templates
      
      const confidence = 0.8 + Math.random() * 0.2; // Random confidence 0.8-1.0
      const verified = confidence > 0.85;

      return { verified, confidence };

    } catch (error) {
      console.error('Biometric verification error:', error);
      return { verified: false, confidence: 0 };
    }
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(
    onboardingId: string,
    action: string,
    details: any
  ): Promise<void> {
    try {
      await AuditLog.create({
        userId: 'system',
        action,
        resourceType: 'biometric_enrollment',
        resourceId: onboardingId,
        details,
        ipAddress: '127.0.0.1',
        userAgent: 'BiometricEnrollmentService',
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  /**
   * Get biometric enrollment analytics
   */
  async getEnrollmentAnalytics(): Promise<{
    totalEnrollments: number;
    successfulEnrollments: number;
    averagePhotosPerEnrollment: number;
    averageQualityScore: number;
    failureReasons: { [reason: string]: number };
  }> {
    const onboardings = await OnboardingRecord.find({
      'workflowSteps.stepKey': 'biometric_enrollment'
    });

    let totalEnrollments = 0;
    let successfulEnrollments = 0;
    let totalPhotos = 0;
    let totalQualityScore = 0;
    let photoCount = 0;
    const failureReasons: { [reason: string]: number } = {};

    for (const onboarding of onboardings) {
      const biometricStep = onboarding.workflowSteps.find(
        step => step.stepKey === 'biometric_enrollment'
      );

      if (biometricStep?.faceEnrollment) {
        totalEnrollments++;
        
        if (biometricStep.faceEnrollment.enrollmentStatus === 'enrolled') {
          successfulEnrollments++;
        } else if (biometricStep.faceEnrollment.enrollmentStatus === 'failed') {
          failureReasons['enrollment_failed'] = (failureReasons['enrollment_failed'] || 0) + 1;
        }

        totalPhotos += biometricStep.faceEnrollment.photos.length;
        
        for (const photo of biometricStep.faceEnrollment.photos) {
          totalQualityScore += photo.qualityScore;
          photoCount++;
        }
      }
    }

    return {
      totalEnrollments,
      successfulEnrollments,
      averagePhotosPerEnrollment: totalEnrollments > 0 ? totalPhotos / totalEnrollments : 0,
      averageQualityScore: photoCount > 0 ? totalQualityScore / photoCount : 0,
      failureReasons
    };
  }
}
