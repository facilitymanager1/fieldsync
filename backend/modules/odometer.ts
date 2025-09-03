// Advanced Odometer & Photo Verification Module for FieldSync Backend
// Handles odometer reading verification, OCR, photo validation, and fraud detection

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Interfaces
export interface OdometerReading {
  id: string;
  userId: string;
  vehicleId: string;
  reading: number;
  previousReading?: number;
  timestamp: Date;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    address?: string;
  };
  photos: {
    odometerPhoto: string;
    vehiclePhoto?: string;
    dashboardPhoto?: string;
  };
  verification: {
    ocrConfidence: number;
    ocrText: string;
    readingConfidence: number;
    isValid: boolean;
    flags: string[];
  };
  metadata: {
    deviceInfo: any;
    processingTime: number;
    modelVersion: string;
  };
  status: 'pending' | 'verified' | 'rejected' | 'flagged';
  approvedBy?: string;
  approvedAt?: Date;
}

export interface OCRResult {
  success: boolean;
  text: string;
  confidence: number;
  boundingBoxes: Array<{
    text: string;
    confidence: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  processedImage?: string;
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  extractedReading?: number;
  flags: string[];
  reasoning: string;
}

export interface FraudDetectionResult {
  isSuspicious: boolean;
  riskScore: number;
  flags: string[];
  analysis: {
    imageQuality: number;
    textClarity: number;
    digitalManipulation: number;
    consistencyCheck: number;
  };
}

// Database Schema
const OdometerReadingSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  vehicleId: { type: String, required: true, index: true },
  reading: { type: Number, required: true },
  previousReading: { type: Number },
  timestamp: { type: Date, default: Date.now, index: true },
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    address: String,
  },
  photos: {
    odometerPhoto: String,
    vehiclePhoto: String,
    dashboardPhoto: String,
  },
  verification: {
    ocrConfidence: Number,
    ocrText: String,
    readingConfidence: Number,
    isValid: Boolean,
    flags: [String],
  },
  metadata: {
    deviceInfo: mongoose.Schema.Types.Mixed,
    processingTime: Number,
    modelVersion: String,
  },
  status: { 
    type: String, 
    enum: ['pending', 'verified', 'rejected', 'flagged'], 
    default: 'pending' 
  },
  approvedBy: String,
  approvedAt: Date,
});

const VehicleOdometerHistorySchema = new mongoose.Schema({
  vehicleId: { type: String, required: true, index: true },
  readings: [{
    reading: Number,
    timestamp: Date,
    userId: String,
    verified: Boolean,
  }],
  statistics: {
    averageDailyMileage: Number,
    totalMileage: Number,
    lastVerifiedReading: Number,
    lastReadingDate: Date,
  },
});

const OdometerReadingModel = mongoose.model('OdometerReading', OdometerReadingSchema);
const VehicleOdometerHistory = mongoose.model('VehicleOdometerHistory', VehicleOdometerHistorySchema);

class OdometerVerificationService {
  private readonly OCR_CONFIDENCE_THRESHOLD = 0.7;
  private readonly READING_CONFIDENCE_THRESHOLD = 0.8;
  private readonly MODEL_VERSION = '1.5.0';
  private readonly MAX_DAILY_MILEAGE = 500; // Maximum reasonable daily mileage

  // Simulate OCR processing - In production, integrate with Tesseract.js or cloud OCR
  private async performOCR(imageData: string): Promise<OCRResult> {
    try {
      const startTime = Date.now();
      
      // Simulate OCR processing
      // In production, this would use Tesseract.js, AWS Textract, or Google Vision API
      const mockOCRTexts = [
        '123456',
        '234567',
        '345678',
        'ODO 123456',
        'MILES 234567',
        '12345.6 KM'
      ];
      
      const randomText = mockOCRTexts[Math.floor(Math.random() * mockOCRTexts.length)];
      const confidence = 0.8 + Math.random() * 0.2;
      
      // Extract numeric values
      const numbers = randomText.match(/\d+\.?\d*/g) || [];
      const primaryNumber = numbers.length > 0 ? numbers[0] : randomText;
      
      const boundingBoxes = [{
        text: primaryNumber || '',
        confidence: confidence,
        x: 100 + Math.random() * 200,
        y: 50 + Math.random() * 100,
        width: 150 + Math.random() * 100,
        height: 40 + Math.random() * 20,
      }];

      console.log(`OCR Processing completed in ${Date.now() - startTime}ms`);

      return {
        success: true,
        text: randomText,
        confidence,
        boundingBoxes,
      };

    } catch (error) {
      console.error('OCR processing error:', error);
      return {
        success: false,
        text: '',
        confidence: 0,
        boundingBoxes: [],
      };
    }
  }

  // Extract and validate odometer reading from OCR text
  private validateOdometerReading(ocrResult: OCRResult, expectedRange?: { min: number; max: number }): ValidationResult {
    try {
      const flags: string[] = [];
      let confidence = ocrResult.confidence;

      // Extract numeric reading from OCR text
      const numbers = ocrResult.text.match(/\d+\.?\d*/g);
      if (!numbers || numbers.length === 0) {
        return {
          isValid: false,
          confidence: 0,
          flags: ['no_numeric_reading'],
          reasoning: 'No numeric reading found in OCR text',
        };
      }

      // Find the most likely odometer reading
      let extractedReading: number | undefined;
      
      // Look for the largest reasonable number (odometer readings are typically 5-7 digits)
      const candidates = numbers
        .map(n => parseFloat(n))
        .filter(n => n >= 0 && n <= 999999999) // Reasonable odometer range
        .sort((a, b) => b - a); // Sort descending

      if (candidates.length > 0) {
        extractedReading = candidates[0];
      }

      if (!extractedReading) {
        return {
          isValid: false,
          confidence: 0,
          flags: ['invalid_reading_format'],
          reasoning: 'Could not extract valid odometer reading',
        };
      }

      // Validate reading format
      if (extractedReading < 0) {
        flags.push('negative_reading');
        confidence *= 0.5;
      }

      if (extractedReading > 999999) {
        flags.push('extremely_high_reading');
        confidence *= 0.7;
      }

      // Check against expected range if provided
      if (expectedRange) {
        if (extractedReading < expectedRange.min) {
          flags.push('reading_below_expected');
          confidence *= 0.6;
        }
        if (extractedReading > expectedRange.max) {
          flags.push('reading_above_expected');
          confidence *= 0.6;
        }
      }

      // Check OCR confidence
      if (ocrResult.confidence < this.OCR_CONFIDENCE_THRESHOLD) {
        flags.push('low_ocr_confidence');
        confidence *= 0.8;
      }

      const isValid = confidence >= this.READING_CONFIDENCE_THRESHOLD && flags.length === 0;

      return {
        isValid,
        confidence,
        extractedReading,
        flags,
        reasoning: isValid ? 'Reading validated successfully' : `Validation failed: ${flags.join(', ')}`,
      };

    } catch (error) {
      console.error('Reading validation error:', error);
      return {
        isValid: false,
        confidence: 0,
        flags: ['validation_error'],
        reasoning: 'Error during reading validation',
      };
    }
  }

  // Detect potential fraud or manipulation
  private async detectFraud(imageData: string, reading: number, previousReading?: number): Promise<FraudDetectionResult> {
    try {
      const analysis = {
        imageQuality: 0.8 + Math.random() * 0.2,
        textClarity: 0.7 + Math.random() * 0.3,
        digitalManipulation: Math.random() * 0.3,
        consistencyCheck: 0.8 + Math.random() * 0.2,
      };

      const flags: string[] = [];
      let riskScore = 0;

      // Image quality checks
      if (analysis.imageQuality < 0.7) {
        flags.push('poor_image_quality');
        riskScore += 0.3;
      }

      if (analysis.textClarity < 0.6) {
        flags.push('unclear_text');
        riskScore += 0.2;
      }

      // Digital manipulation detection
      if (analysis.digitalManipulation > 0.7) {
        flags.push('possible_digital_manipulation');
        riskScore += 0.5;
      }

      // Consistency checks
      if (previousReading && reading < previousReading) {
        flags.push('reading_rollback');
        riskScore += 0.4;
      }

      if (previousReading && (reading - previousReading) > this.MAX_DAILY_MILEAGE) {
        flags.push('excessive_mileage_increase');
        riskScore += 0.3;
      }

      // Pixel-level analysis simulation
      const hasUnusualPatterns = Math.random() < 0.1;
      if (hasUnusualPatterns) {
        flags.push('unusual_pixel_patterns');
        riskScore += 0.2;
      }

      const isSuspicious = riskScore > 0.5 || flags.some(flag => 
        ['possible_digital_manipulation', 'reading_rollback'].includes(flag)
      );

      return {
        isSuspicious,
        riskScore: Math.min(riskScore, 1.0),
        flags,
        analysis,
      };

    } catch (error) {
      console.error('Fraud detection error:', error);
      return {
        isSuspicious: true,
        riskScore: 1.0,
        flags: ['analysis_error'],
        analysis: {
          imageQuality: 0,
          textClarity: 0,
          digitalManipulation: 1.0,
          consistencyCheck: 0,
        },
      };
    }
  }

  // Get previous reading for validation
  private async getPreviousReading(vehicleId: string): Promise<number | undefined> {
    try {
      const history = await VehicleOdometerHistory.findOne({ vehicleId });
      return history?.statistics?.lastVerifiedReading || undefined;
    } catch (error) {
      console.error('Error getting previous reading:', error);
      return undefined;
    }
  }

  // Update vehicle history
  private async updateVehicleHistory(vehicleId: string, reading: number, userId: string, verified: boolean): Promise<void> {
    try {
      await VehicleOdometerHistory.findOneAndUpdate(
        { vehicleId },
        {
          $push: {
            readings: {
              reading,
              timestamp: new Date(),
              userId,
              verified,
            }
          },
          $set: {
            'statistics.lastReadingDate': new Date(),
            ...(verified && {
              'statistics.lastVerifiedReading': reading,
            })
          }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating vehicle history:', error);
    }
  }

  // Main verification function
  async verifyOdometerReading(request: {
    userId: string;
    vehicleId: string;
    odometerPhoto: string;
    vehiclePhoto?: string;
    location: any;
    deviceInfo: any;
  }): Promise<ApiResponse> {
    try {
      const startTime = Date.now();

      // Get previous reading for validation
      const previousReading = await this.getPreviousReading(request.vehicleId);

      // Perform OCR on odometer photo
      const ocrResult = await this.performOCR(request.odometerPhoto);
      if (!ocrResult.success) {
        return {
          success: false,
          message: 'Failed to process odometer image',
          data: { ocrResult },
        };
      }

      // Validate the reading
      const expectedRange = previousReading ? {
        min: previousReading,
        max: previousReading + this.MAX_DAILY_MILEAGE
      } : undefined;

      const validation = this.validateOdometerReading(ocrResult, expectedRange);
      if (!validation.extractedReading) {
        return {
          success: false,
          message: 'Could not extract valid odometer reading',
          data: { validation, ocrResult },
        };
      }

      // Perform fraud detection
      const fraudDetection = await this.detectFraud(
        request.odometerPhoto,
        validation.extractedReading,
        previousReading
      );

      // Determine status based on validation and fraud detection
      let status: 'pending' | 'verified' | 'rejected' | 'flagged' = 'pending';
      
      if (validation.isValid && !fraudDetection.isSuspicious) {
        status = 'verified';
      } else if (!validation.isValid) {
        status = 'rejected';
      } else if (fraudDetection.isSuspicious) {
        status = 'flagged';
      }

      // Save odometer reading
      const odometerReading = new OdometerReadingModel({
        userId: request.userId,
        vehicleId: request.vehicleId,
        reading: validation.extractedReading,
        previousReading,
        location: request.location,
        photos: {
          odometerPhoto: request.odometerPhoto,
          vehiclePhoto: request.vehiclePhoto,
        },
        verification: {
          ocrConfidence: ocrResult.confidence,
          ocrText: ocrResult.text,
          readingConfidence: validation.confidence,
          isValid: validation.isValid,
          flags: [...validation.flags, ...fraudDetection.flags],
        },
        metadata: {
          deviceInfo: request.deviceInfo,
          processingTime: Date.now() - startTime,
          modelVersion: this.MODEL_VERSION,
        },
        status,
      });

      await odometerReading.save();

      // Update vehicle history
      await this.updateVehicleHistory(
        request.vehicleId,
        validation.extractedReading,
        request.userId,
        status === 'verified'
      );

      return {
        success: true,
        data: {
          id: odometerReading._id,
          reading: validation.extractedReading,
          confidence: validation.confidence,
          status,
          ocrText: ocrResult.text,
          flags: [...validation.flags, ...fraudDetection.flags],
          fraudRisk: fraudDetection.riskScore,
        },
        message: `Odometer reading ${status}`,
      };

    } catch (error: any) {
      console.error('Odometer verification error:', error);
      return {
        success: false,
        message: 'Odometer verification failed',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Get odometer history for a vehicle
  async getOdometerHistory(vehicleId: string, limit: number = 50): Promise<ApiResponse> {
    try {
      const readings = await OdometerReadingModel
        .find({ vehicleId })
        .sort({ timestamp: -1 })
        .limit(limit);

      const history = await VehicleOdometerHistory.findOne({ vehicleId });

      return {
        success: true,
        data: {
          readings,
          statistics: history?.statistics || {},
        },
        message: 'Odometer history retrieved successfully',
      };

    } catch (error: any) {
      console.error('Get odometer history error:', error);
      return {
        success: false,
        message: 'Failed to retrieve odometer history',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Get flagged readings for review
  async getFlaggedReadings(): Promise<ApiResponse> {
    try {
      const flaggedReadings = await OdometerReadingModel
        .find({
          $or: [
            { status: 'flagged' },
            { status: 'rejected' },
            { 'verification.flags.0': { $exists: true } }
          ]
        })
        .sort({ timestamp: -1 })
        .limit(100);

      return {
        success: true,
        data: flaggedReadings,
        message: 'Flagged readings retrieved successfully',
      };

    } catch (error: any) {
      console.error('Get flagged readings error:', error);
      return {
        success: false,
        message: 'Failed to retrieve flagged readings',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Approve or reject a reading
  async updateReadingStatus(
    readingId: string, 
    status: 'verified' | 'rejected', 
    approvedBy: string
  ): Promise<ApiResponse> {
    try {
      const updated = await OdometerReadingModel.findByIdAndUpdate(
        readingId,
        {
          status,
          approvedBy,
          approvedAt: new Date(),
        },
        { new: true }
      );

      if (!updated) {
        return {
          success: false,
          message: 'Reading not found',
        };
      }

      // Update vehicle history if approved
      if (status === 'verified') {
        await this.updateVehicleHistory(
          updated.vehicleId,
          updated.reading,
          updated.userId,
          true
        );
      }

      return {
        success: true,
        data: updated,
        message: `Reading ${status} successfully`,
      };

    } catch (error: any) {
      console.error('Update reading status error:', error);
      return {
        success: false,
        message: 'Failed to update reading status',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Get analytics
  async getOdometerAnalytics(startDate?: Date, endDate?: Date): Promise<ApiResponse> {
    try {
      const matchStage: any = {};
      if (startDate || endDate) {
        matchStage.timestamp = {};
        if (startDate) matchStage.timestamp.$gte = startDate;
        if (endDate) matchStage.timestamp.$lte = endDate;
      }

      const analytics = await OdometerReadingModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalReadings: { $sum: 1 },
            verifiedReadings: {
              $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] }
            },
            flaggedReadings: {
              $sum: { $cond: [{ $eq: ['$status', 'flagged'] }, 1, 0] }
            },
            rejectedReadings: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            },
            averageConfidence: { $avg: '$verification.readingConfidence' },
            averageOCRConfidence: { $avg: '$verification.ocrConfidence' },
          }
        }
      ]);

      const flagStats = await OdometerReadingModel.aggregate([
        { $match: matchStage },
        { $unwind: '$verification.flags' },
        {
          $group: {
            _id: '$verification.flags',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]);

      return {
        success: true,
        data: {
          summary: analytics[0] || {},
          flagStatistics: flagStats,
        },
        message: 'Analytics retrieved successfully',
      };

    } catch (error: any) {
      console.error('Get analytics error:', error);
      return {
        success: false,
        message: 'Failed to retrieve analytics',
        error: error?.message || 'Unknown error',
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

// Export service instance
const odometerService = new OdometerVerificationService();

// Exported route handlers
export async function verifyOdometer(req: Request, res: Response) {
  try {
    const result = await odometerService.verifyOdometerReading(req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function getVehicleOdometerHistory(req: Request, res: Response) {
  try {
    const { vehicleId } = req.params;
    const { limit } = req.query;
    
    const result = await odometerService.getOdometerHistory(
      vehicleId, 
      limit ? parseInt(limit as string) : undefined
    );
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function getFlaggedOdometerReadings(req: Request, res: Response) {
  try {
    const result = await odometerService.getFlaggedReadings();
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function updateOdometerReadingStatus(req: Request, res: Response) {
  try {
    const { readingId } = req.params;
    const { status, approvedBy } = req.body;
    
    const result = await odometerService.updateReadingStatus(readingId, status, approvedBy);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function getOdometerAnalytics(req: Request, res: Response) {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const result = await odometerService.getOdometerAnalytics(start, end);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}
