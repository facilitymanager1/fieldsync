// Advanced Facial Recognition Attendance Module for FieldSync Backend
// Handles face verification, liveness detection, attendance tracking, and security audit

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { 
  AppError, 
  ErrorCodes, 
  formatError, 
  formatSuccess, 
  createValidationError
} from '../utils/errorHandler';
import { AuthenticatedRequest } from '../types/standardInterfaces';
import { FaceDetectionResult } from '../types/standardInterfaces';

// Interfaces
export interface FaceTemplate {
  id: string;
  userId: string;
  encoding: number[];
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  timestamp: Date;
  type: 'check_in' | 'check_out';
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    address?: string;
  };
  confidence: number;
  livenessScore: number;
  photoPath: string;
  status: 'verified' | 'pending' | 'rejected' | 'flagged';
  deviceInfo: {
    deviceId: string;
    platform: string;
    version: string;
  };
  securityFlags: string[];
  processedAt?: Date;
  verifiedBy?: string;
}

export interface FaceVerificationResult {
  success: boolean;
  confidence: number;
  userId?: string;
  livenessScore: number;
  securityFlags: string[];
  processedAt: Date;
  metadata: {
    processingTime: number;
    modelVersion: string;
    quality: number;
  };
}

export interface FaceEnrollmentRequest {
  userId: string;
  images: string[]; // Base64 encoded images
  deviceInfo: {
    deviceId: string;
    platform: string;
    version: string;
  };
}

export interface LivenessDetectionResult {
  isLive: boolean;
  confidence: number;
  challenges: {
    type: string;
    passed: boolean;
    score: number;
  }[];
  metadata: {
    duration: number;
    framesAnalyzed: number;
  };
}

// Database Models
const FaceTemplateSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  encoding: { type: [Number], required: true },
  confidence: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  quality: { type: Number, required: true },
  deviceInfo: {
    deviceId: String,
    platform: String,
    version: String,
  },
});

const AttendanceRecordSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  type: { type: String, enum: ['check_in', 'check_out'], required: true },
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    address: String,
  },
  confidence: { type: Number, required: true },
  livenessScore: { type: Number, required: true },
  photoPath: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['verified', 'pending', 'rejected', 'flagged'], 
    default: 'pending' 
  },
  deviceInfo: {
    deviceId: String,
    platform: String,
    version: String,
  },
  securityFlags: [String],
  processedAt: Date,
  verifiedBy: String,
  metadata: {
    processingTime: Number,
    modelVersion: String,
    quality: Number,
  },
});

const FaceTemplate = mongoose.model('FaceTemplate', FaceTemplateSchema);
const AttendanceRecord = mongoose.model('AttendanceRecord', AttendanceRecordSchema);

class FacialRecognitionService {
  private readonly CONFIDENCE_THRESHOLD = 0.85;
  private readonly LIVENESS_THRESHOLD = 0.8;
  private readonly MAX_TEMPLATES_PER_USER = 5;
  private readonly MODEL_VERSION = '2.1.0';

  // Face encoding simulation - In production, integrate with actual ML service
  private calculateFaceEncoding(imageData: string): number[] {
    // Simulate face encoding - replace with actual ML model
    const hash = crypto.createHash('sha256').update(imageData).digest();
    return Array.from(hash.slice(0, 128)).map(byte => (byte - 128) / 128);
  }

  private calculateSimilarity(encoding1: number[], encoding2: number[]): number {
    // Cosine similarity calculation
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < encoding1.length; i++) {
      dotProduct += encoding1[i] * encoding2[i];
      norm1 += encoding1[i] * encoding1[i];
      norm2 += encoding2[i] * encoding2[i];
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return Math.max(0, Math.min(1, (similarity + 1) / 2)); // Normalize to 0-1
  }

  private calculateImageQuality(imageData: string): number {
    // Simulate image quality assessment
    const size = imageData.length;
    const hasGoodResolution = size > 50000; // Base64 size check
    const hasGoodLighting = true; // Placeholder for actual lighting analysis
    
    return hasGoodResolution && hasGoodLighting ? 0.9 : 0.6;
  }

  private async performLivenessDetection(imageData: string): Promise<LivenessDetectionResult> {
    // Simulate liveness detection - replace with actual implementation
    const startTime = Date.now();
    
    // Simulate various liveness checks
    const challenges = [
      { type: 'texture_analysis', passed: true, score: 0.92 },
      { type: 'depth_estimation', passed: true, score: 0.88 },
      { type: 'motion_analysis', passed: true, score: 0.85 },
    ];

    const overallConfidence = challenges.reduce((sum, c) => sum + c.score, 0) / challenges.length;
    
    return {
      isLive: overallConfidence > this.LIVENESS_THRESHOLD,
      confidence: overallConfidence,
      challenges,
      metadata: {
        duration: Date.now() - startTime,
        framesAnalyzed: 30,
      },
    };
  }

  async enrollFace(request: FaceEnrollmentRequest): Promise<ApiResponse> {
    try {
      const startTime = Date.now();

      // Delete existing templates for user
      await FaceTemplate.deleteMany({ userId: request.userId });

      const templates: any[] = [];

      for (const imageData of request.images) {
        // Calculate face encoding
        const encoding = this.calculateFaceEncoding(imageData);
        const quality = this.calculateImageQuality(imageData);

        if (quality < 0.7) {
          return {
            success: false,
            message: 'Image quality too low. Please capture a clearer photo.',
          };
        }

        // Perform liveness detection
        const livenessResult = await this.performLivenessDetection(imageData);
        if (!livenessResult.isLive) {
          return {
            success: false,
            message: 'Liveness verification failed. Please ensure you are present during capture.',
          };
        }

        const template = new FaceTemplate({
          userId: request.userId,
          encoding,
          confidence: livenessResult.confidence,
          quality,
          deviceInfo: request.deviceInfo,
        });

        templates.push(template);
      }

      // Save all templates
      await FaceTemplate.insertMany(templates);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          templatesCreated: templates.length,
          averageQuality: templates.reduce((sum, t) => sum + t.quality, 0) / templates.length,
          processingTime,
        },
        message: 'Face enrollment completed successfully',
      };

    } catch (error) {
      console.error('Face enrollment error:', error);
      return {
        success: false,
        message: 'Face enrollment failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async verifyFace(imageData: string, deviceInfo: any): Promise<FaceVerificationResult> {
    try {
      const startTime = Date.now();
      const securityFlags: string[] = [];

      // Perform liveness detection
      const livenessResult = await this.performLivenessDetection(imageData);
      if (!livenessResult.isLive) {
        securityFlags.push('liveness_failed');
      }

      // Calculate face encoding for verification
      const queryEncoding = this.calculateFaceEncoding(imageData);
      
      // Get all active templates
      const templates = await FaceTemplate.find({ isActive: true });
      
      let bestMatch: { userId: string; confidence: number } | null = null;

      // Compare with all templates
      for (const template of templates) {
        const similarity = this.calculateSimilarity(queryEncoding, template.encoding);
        
        if (similarity > this.CONFIDENCE_THRESHOLD && 
            (!bestMatch || similarity > bestMatch.confidence)) {
          bestMatch = { userId: template.userId, confidence: similarity };
        }
      }

      // Additional security checks
      if (bestMatch && livenessResult.confidence < 0.9) {
        securityFlags.push('low_liveness_score');
      }

      const processingTime = Date.now() - startTime;

      return {
        success: !!bestMatch,
        confidence: bestMatch?.confidence || 0,
        userId: bestMatch?.userId,
        livenessScore: livenessResult.confidence,
        securityFlags,
        processedAt: new Date(),
        metadata: {
          processingTime,
          modelVersion: this.MODEL_VERSION,
          quality: this.calculateImageQuality(imageData),
        },
      };

    } catch (error) {
      console.error('Face verification error:', error);
      return {
        success: false,
        confidence: 0,
        livenessScore: 0,
        securityFlags: ['processing_error'],
        processedAt: new Date(),
        metadata: {
          processingTime: 0,
          modelVersion: this.MODEL_VERSION,
          quality: 0,
        },
      };
    }
  }

  async recordAttendance(attendanceData: Partial<AttendanceRecord>): Promise<ApiResponse> {
    try {
      // Verify face first
      const verificationResult = await this.verifyFace(
        attendanceData.photoPath || '', 
        attendanceData.deviceInfo
      );

      if (!verificationResult.success) {
        return {
          success: false,
          message: 'Face verification failed',
          data: verificationResult,
        };
      }

      // Save attendance record
      const attendance = new AttendanceRecord({
        ...attendanceData,
        userId: verificationResult.userId,
        confidence: verificationResult.confidence,
        livenessScore: verificationResult.livenessScore,
        securityFlags: verificationResult.securityFlags,
        processedAt: verificationResult.processedAt,
        metadata: verificationResult.metadata,
        status: verificationResult.securityFlags.length > 0 ? 'flagged' : 'verified',
      });

      await attendance.save();

      return {
        success: true,
        data: {
          attendanceId: attendance._id,
          userId: verificationResult.userId,
          confidence: verificationResult.confidence,
          status: attendance.status,
        },
        message: 'Attendance recorded successfully',
      };

    } catch (error) {
      console.error('Attendance recording error:', error);
      return {
        success: false,
        message: 'Failed to record attendance',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getAttendanceHistory(userId: string, startDate?: Date, endDate?: Date): Promise<ApiResponse> {
    try {
      const query: any = { userId };
      
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = startDate;
        if (endDate) query.timestamp.$lte = endDate;
      }

      const records = await AttendanceRecord.find(query)
        .sort({ timestamp: -1 })
        .limit(100);

      return {
        success: true,
        data: records,
        message: 'Attendance history retrieved successfully',
      };

    } catch (error) {
      console.error('Get attendance history error:', error);
      return {
        success: false,
        message: 'Failed to retrieve attendance history',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getFlaggedAttendance(): Promise<ApiResponse> {
    try {
      const flaggedRecords = await AttendanceRecord.find({
        $or: [
          { status: 'flagged' },
          { securityFlags: { $ne: [] } },
          { confidence: { $lt: 0.9 } },
          { livenessScore: { $lt: 0.8 } }
        ]
      }).sort({ timestamp: -1 });

      return {
        success: true,
        data: flaggedRecords,
        message: 'Flagged attendance records retrieved successfully',
      };

    } catch (error) {
      console.error('Get flagged attendance error:', error);
      return {
        success: false,
        message: 'Failed to retrieve flagged attendance',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async updateAttendanceStatus(attendanceId: string, status: string, verifiedBy: string): Promise<ApiResponse> {
    try {
      const updated = await AttendanceRecord.findByIdAndUpdate(
        attendanceId,
        { status, verifiedBy, processedAt: new Date() },
        { new: true }
      );

      if (!updated) {
        return {
          success: false,
          message: 'Attendance record not found',
        };
      }

      return {
        success: true,
        data: updated,
        message: 'Attendance status updated successfully',
      };

    } catch (error) {
      console.error('Update attendance status error:', error);
      return {
        success: false,
        message: 'Failed to update attendance status',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getSystemStats(): Promise<ApiResponse> {
    try {
      const stats = await Promise.all([
        FaceTemplate.countDocuments({ isActive: true }),
        AttendanceRecord.countDocuments({}),
        AttendanceRecord.countDocuments({ status: 'verified' }),
        AttendanceRecord.countDocuments({ status: 'flagged' }),
        AttendanceRecord.aggregate([
          { $group: { _id: null, avgConfidence: { $avg: '$confidence' } } }
        ])
      ]);

      return {
        success: true,
        data: {
          totalTemplates: stats[0],
          totalAttendanceRecords: stats[1],
          verifiedRecords: stats[2],
          flaggedRecords: stats[3],
          averageConfidence: stats[4][0]?.avgConfidence || 0,
        },
        message: 'System statistics retrieved successfully',
      };

    } catch (error) {
      console.error('Get system stats error:', error);
      return {
        success: false,
        message: 'Failed to retrieve system statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

// Authentication helper
function ensureAuthenticated(req: AuthenticatedRequest): asserts req is AuthenticatedRequest & { user: NonNullable<AuthenticatedRequest['user']> } {
  if (!req.user) {
    throw new AppError('Authentication required', ErrorCodes.UNAUTHORIZED);
  }
}

// Export service instance
const facialRecognitionService = new FacialRecognitionService();

// Main exported functions
export async function enrollUserFace(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);
    const { imageData, deviceInfo } = req.body;
    
    if (!imageData) {
      throw createValidationError('imageData', 'Face image data is required');
    }

    const result = await facialRecognitionService.enrollFace({
      ...req.body,
      userId: req.user.id
    });
    
    res.json(formatSuccess(result.data, result.message || 'Face enrolled successfully'));
  } catch (error) {
    console.error('Error enrolling face:', error);
    res.status(error instanceof AppError ? error.statusCode : 500)
       .json(formatError(error));
  }
}

export async function verifyUserFace(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);

    const { imageData, deviceInfo } = req.body;

    // Validate required fields
    if (!imageData) {
      return res.status(400).json(formatError(
        createValidationError('imageData', 'Image data is required')
      ));
    }

    const result = await facialRecognitionService.verifyFace(imageData, deviceInfo);
    
    res.status(200).json(formatSuccess(result, 'Face verification completed'));
  } catch (error) {
    console.error('Face verification error:', error);
    res.status(500).json(formatError(error));
  }
}

export async function recordFaceAttendance(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);

    // Validate required fields
    if (!req.body) {
      return res.status(400).json(formatError(
        createValidationError('body', 'Request body is required')
      ));
    }

    const result = await facialRecognitionService.recordAttendance(req.body);
    
    if (result.success) {
      res.status(200).json(formatSuccess(result, 'Attendance recorded successfully'));
    } else {
      res.status(400).json(formatError(new AppError(result.message || 'Attendance recording failed', ErrorCodes.BUSINESS_RULE_VIOLATION)));
    }
  } catch (error) {
    console.error('Record attendance error:', error);
    res.status(500).json(formatError(error));
  }
}

export async function getAttendanceHistory(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);

    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Validate required parameters
    if (!userId) {
      return res.status(400).json(formatError(
        createValidationError('userId', 'User ID is required')
      ));
    }
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const result = await facialRecognitionService.getAttendanceHistory(userId, start, end);
    
    if (result.success) {
      res.status(200).json(formatSuccess(result, 'Attendance history retrieved successfully'));
    } else {
      res.status(400).json(formatError(new AppError(result.message || 'Attendance history not found', ErrorCodes.RESOURCE_NOT_FOUND)));
    }
  } catch (error) {
    console.error('Get attendance history error:', error);
    res.status(500).json(formatError(error));
  }
}

export async function getFlaggedAttendance(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);

    const result = await facialRecognitionService.getFlaggedAttendance();
    
    if (result.success) {
      res.status(200).json(formatSuccess(result, 'Flagged attendance retrieved successfully'));
    } else {
      res.status(400).json(formatError(new AppError(result.message || 'Failed to retrieve flagged attendance', ErrorCodes.RESOURCE_NOT_FOUND)));
    }
  } catch (error) {
    console.error('Get flagged attendance error:', error);
    res.status(500).json(formatError(error));
  }
}

export async function updateAttendanceStatus(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);

    const { attendanceId } = req.params;
    const { status, verifiedBy } = req.body;
    
    // Validate required parameters
    if (!attendanceId) {
      return res.status(400).json(formatError(
        createValidationError('attendanceId', 'Attendance ID is required')
      ));
    }

    if (!status) {
      return res.status(400).json(formatError(
        createValidationError('status', 'Status is required')
      ));
    }
    
    const result = await facialRecognitionService.updateAttendanceStatus(attendanceId, status, verifiedBy);
    
    if (result.success) {
      res.status(200).json(formatSuccess(result, 'Attendance status updated successfully'));
    } else {
      res.status(400).json(formatError(new AppError(result.message || 'Failed to update attendance status', ErrorCodes.BUSINESS_RULE_VIOLATION)));
    }
  } catch (error) {
    console.error('Update attendance status error:', error);
    res.status(500).json(formatError(error));
  }
}

export async function getSystemStats(req: AuthenticatedRequest, res: Response) {
  try {
    ensureAuthenticated(req);

    const result = await facialRecognitionService.getSystemStats();
    
    if (result.success) {
      res.status(200).json(formatSuccess(result, 'System stats retrieved successfully'));
    } else {
      res.status(400).json(formatError(new AppError(result.message || 'Failed to retrieve system stats', ErrorCodes.INTERNAL_SERVER_ERROR)));
    }
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json(formatError(error));
  }
}

// Additional exports for route compatibility
export async function enrollFace(req: AuthenticatedRequest, res: Response) {
  return enrollUserFace(req, res);
}

export async function verifyFaceAttendance(req: AuthenticatedRequest, res: Response) {
  return recordFaceAttendance(req, res);
}

export async function getAttendanceRecords(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    
    const query: any = {};
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    const records = await AttendanceRecord.find(query)
      .sort({ timestamp: -1 })
      .limit(100);

    res.json({
      success: true,
      data: records,
      message: 'Attendance records retrieved successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance records',
      error: error.message,
    });
  }
}

export async function getSecurityAnalytics(req: Request, res: Response) {
  try {
    const analytics = await Promise.all([
      AttendanceRecord.countDocuments({ securityFlags: { $ne: [] } }),
      AttendanceRecord.countDocuments({ status: 'flagged' }),
      AttendanceRecord.aggregate([
        { $group: { _id: null, avgLiveness: { $avg: '$livenessScore' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        flaggedRecords: analytics[0],
        totalFlagged: analytics[1],
        averageLivenessScore: analytics[2][0]?.avgLiveness || 0,
      },
      message: 'Security analytics retrieved successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve security analytics',
      error: error.message,
    });
  }
}

// Export the service instance and models
export { facialRecognitionService, FaceTemplate, AttendanceRecord };
