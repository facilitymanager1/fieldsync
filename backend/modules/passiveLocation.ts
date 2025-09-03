// Advanced Passive Location & Sensor Gating Module for FieldSync Backend
// Handles passive GPS tracking, activity recognition, sensor gating, and location batching

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import * as crypto from 'crypto';

// Interfaces
export interface LocationPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy: number;
  timestamp: Date;
  speed?: number;
  bearing?: number;
  provider: 'gps' | 'network' | 'passive' | 'fused';
}

export interface ActivityData {
  type: 'still' | 'walking' | 'running' | 'in_vehicle' | 'on_bicycle' | 'unknown';
  confidence: number;
  timestamp: Date;
}

export interface SensorData {
  accelerometer?: { x: number; y: number; z: number };
  gyroscope?: { x: number; y: number; z: number };
  magnetometer?: { x: number; y: number; z: number };
  barometer?: { pressure: number };
  timestamp: Date;
}

export interface LocationBatch {
  id: string;
  userId: string;
  deviceId: string;
  startTime: Date;
  endTime: Date;
  locations: LocationPoint[];
  activities: ActivityData[];
  sensorData: SensorData[];
  metadata: {
    batteryLevel?: number;
    networkType?: string;
    dataUsage: number;
    processingTime: number;
    compressionRatio?: number;
  };
  analysis: {
    totalDistance: number;
    averageSpeed: number;
    maxSpeed: number;
    timeStationary: number;
    timeMoving: number;
    significantPlaces: Array<{
      location: LocationPoint;
      arrivalTime: Date;
      departureTime?: Date;
      duration: number;
      visits: number;
    }>;
  };
  status: 'pending' | 'processed' | 'error';
  processedAt?: Date;
}

export interface GeofenceEvent {
  id: string;
  userId: string;
  geofenceId: string;
  eventType: 'enter' | 'exit' | 'dwell';
  location: LocationPoint;
  timestamp: Date;
  confidence: number;
  dwellTime?: number;
}

export interface TrackingSettings {
  userId: string;
  isEnabled: boolean;
  batchInterval: number; // minutes
  accuracyThreshold: number; // meters
  distanceFilter: number; // meters
  activityRecognition: boolean;
  sensorGating: boolean;
  batteryOptimization: boolean;
  geofenceMonitoring: boolean;
  updatedAt: Date;
}

// Database Schemas
const LocationBatchSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  deviceId: { type: String, required: true },
  startTime: { type: Date, required: true, index: true },
  endTime: { type: Date, required: true },
  locations: [{
    latitude: Number,
    longitude: Number,
    altitude: Number,
    accuracy: Number,
    timestamp: Date,
    speed: Number,
    bearing: Number,
    provider: String,
  }],
  activities: [{
    type: String,
    confidence: Number,
    timestamp: Date,
  }],
  sensorData: [{
    accelerometer: { x: Number, y: Number, z: Number },
    gyroscope: { x: Number, y: Number, z: Number },
    magnetometer: { x: Number, y: Number, z: Number },
    barometer: { pressure: Number },
    timestamp: Date,
  }],
  metadata: {
    batteryLevel: Number,
    networkType: String,
    dataUsage: Number,
    processingTime: Number,
    compressionRatio: Number,
  },
  analysis: {
    totalDistance: Number,
    averageSpeed: Number,
    maxSpeed: Number,
    timeStationary: Number,
    timeMoving: Number,
    significantPlaces: [{
      location: {
        latitude: Number,
        longitude: Number,
        altitude: Number,
        accuracy: Number,
        timestamp: Date,
        speed: Number,
        bearing: Number,
        provider: String,
      },
      arrivalTime: Date,
      departureTime: Date,
      duration: Number,
      visits: Number,
    }],
  },
  status: { type: String, enum: ['pending', 'processed', 'error'], default: 'pending' },
  processedAt: Date,
});

const GeofenceEventSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  geofenceId: { type: String, required: true },
  eventType: { type: String, enum: ['enter', 'exit', 'dwell'], required: true },
  location: {
    latitude: Number,
    longitude: Number,
    altitude: Number,
    accuracy: Number,
    timestamp: Date,
    speed: Number,
    bearing: Number,
    provider: String,
  },
  timestamp: { type: Date, default: Date.now, index: true },
  confidence: Number,
  dwellTime: Number,
});

const TrackingSettingsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  isEnabled: { type: Boolean, default: true },
  batchInterval: { type: Number, default: 30 }, // 30 minutes
  accuracyThreshold: { type: Number, default: 50 }, // 50 meters
  distanceFilter: { type: Number, default: 10 }, // 10 meters
  activityRecognition: { type: Boolean, default: true },
  sensorGating: { type: Boolean, default: true },
  batteryOptimization: { type: Boolean, default: true },
  geofenceMonitoring: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now },
});

const LocationBatchModel = mongoose.model('LocationBatch', LocationBatchSchema);
const GeofenceEventModel = mongoose.model('GeofenceEvent', GeofenceEventSchema);
const TrackingSettingsModel = mongoose.model('TrackingSettings', TrackingSettingsSchema);

class PassiveLocationService {
  private readonly SIGNIFICANT_DISTANCE = 100; // meters
  private readonly STATIONARY_THRESHOLD = 5; // meters
  private readonly MIN_DWELL_TIME = 300; // 5 minutes in seconds
  private readonly MAX_BATCH_SIZE = 1000;

  // Calculate distance between two points using Haversine formula
  private calculateDistance(point1: LocationPoint, point2: LocationPoint): number {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = (point1.latitude * Math.PI) / 180;
    const lat2Rad = (point2.latitude * Math.PI) / 180;
    const deltaLatRad = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const deltaLngRad = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Calculate speed between two points
  private calculateSpeed(point1: LocationPoint, point2: LocationPoint): number {
    const distance = this.calculateDistance(point1, point2);
    const timeDiff = (point2.timestamp.getTime() - point1.timestamp.getTime()) / 1000; // seconds
    
    if (timeDiff <= 0) return 0;
    return distance / timeDiff; // meters per second
  }

  // Analyze activity from sensor data
  private analyzeActivity(sensorData: SensorData[]): ActivityData[] {
    const activities: ActivityData[] = [];
    
    for (let i = 0; i < sensorData.length; i++) {
      const sensor = sensorData[i];
      
      if (sensor.accelerometer) {
        const { x, y, z } = sensor.accelerometer;
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        
        let activityType: ActivityData['type'] = 'unknown';
        let confidence = 0.5;
        
        if (magnitude < 1.5) {
          activityType = 'still';
          confidence = 0.8;
        } else if (magnitude < 3.0) {
          activityType = 'walking';
          confidence = 0.7;
        } else if (magnitude < 6.0) {
          activityType = 'running';
          confidence = 0.6;
        } else {
          activityType = 'in_vehicle';
          confidence = 0.6;
        }
        
        activities.push({
          type: activityType,
          confidence,
          timestamp: sensor.timestamp,
        });
      }
    }
    
    return activities;
  }

  // Detect significant places
  private detectSignificantPlaces(locations: LocationPoint[]): Array<{
    location: LocationPoint;
    arrivalTime: Date;
    departureTime?: Date;
    duration: number;
    visits: number;
  }> {
    const places: Array<{
      location: LocationPoint;
      arrivalTime: Date;
      departureTime?: Date;
      duration: number;
      visits: number;
    }> = [];
    
    if (locations.length === 0) return places;
    
    let currentPlace: {
      location: LocationPoint;
      arrivalTime: Date;
      departureTime?: Date;
      duration: number;
      visits: number;
    } | null = null;
    
    for (const location of locations) {
      if (!currentPlace) {
        currentPlace = {
          location,
          arrivalTime: location.timestamp,
          duration: 0,
          visits: 1,
        };
        continue;
      }
      
      const distance = this.calculateDistance(currentPlace.location, location);
      
      if (distance <= this.STATIONARY_THRESHOLD) {
        // Still at the same place
        currentPlace.duration = (location.timestamp.getTime() - currentPlace.arrivalTime.getTime()) / 1000;
      } else {
        // Moved to a new place
        currentPlace.departureTime = location.timestamp;
        
        // Only add if stayed for minimum dwell time
        if (currentPlace.duration >= this.MIN_DWELL_TIME) {
          places.push({ ...currentPlace });
        }
        
        currentPlace = {
          location,
          arrivalTime: location.timestamp,
          duration: 0,
          visits: 1,
        };
      }
    }
    
    // Add the last place if significant
    if (currentPlace && currentPlace.duration >= this.MIN_DWELL_TIME) {
      places.push(currentPlace);
    }
    
    return places;
  }

  // Analyze location batch
  private analyzeBatch(locations: LocationPoint[], activities: ActivityData[]): LocationBatch['analysis'] {
    if (locations.length === 0) {
      return {
        totalDistance: 0,
        averageSpeed: 0,
        maxSpeed: 0,
        timeStationary: 0,
        timeMoving: 0,
        significantPlaces: [],
      };
    }

    let totalDistance = 0;
    let maxSpeed = 0;
    let timeMoving = 0;
    let timeStationary = 0;

    // Calculate distances and speeds
    for (let i = 1; i < locations.length; i++) {
      const distance = this.calculateDistance(locations[i - 1], locations[i]);
      const speed = this.calculateSpeed(locations[i - 1], locations[i]);
      
      totalDistance += distance;
      maxSpeed = Math.max(maxSpeed, speed);
      
      const timeDiff = (locations[i].timestamp.getTime() - locations[i - 1].timestamp.getTime()) / 1000;
      
      if (speed > 0.5) { // Moving if speed > 0.5 m/s
        timeMoving += timeDiff;
      } else {
        timeStationary += timeDiff;
      }
    }

    const totalTime = timeMoving + timeStationary;
    const averageSpeed = totalTime > 0 ? totalDistance / totalTime : 0;

    const significantPlaces = this.detectSignificantPlaces(locations);

    return {
      totalDistance,
      averageSpeed,
      maxSpeed,
      timeStationary,
      timeMoving,
      significantPlaces,
    };
  }

  // Process and store location batch
  async processBatch(batchData: {
    userId: string;
    deviceId: string;
    locations: LocationPoint[];
    activities?: ActivityData[];
    sensorData?: SensorData[];
    metadata?: any;
  }): Promise<ApiResponse> {
    try {
      const startTime = Date.now();

      // Validate and filter locations
      const validLocations = batchData.locations.filter(loc => 
        loc.latitude && loc.longitude && 
        Math.abs(loc.latitude) <= 90 && Math.abs(loc.longitude) <= 180 &&
        loc.accuracy <= 1000 // Filter out very inaccurate readings
      );

      if (validLocations.length === 0) {
        return {
          success: false,
          message: 'No valid locations in batch',
        };
      }

      // Sort locations by timestamp
      validLocations.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Analyze activities from sensor data if not provided
      let activities = batchData.activities || [];
      if (batchData.sensorData && batchData.sensorData.length > 0) {
        const analyzedActivities = this.analyzeActivity(batchData.sensorData);
        activities = [...activities, ...analyzedActivities];
      }

      // Perform batch analysis
      const analysis = this.analyzeBatch(validLocations, activities);

      // Calculate data usage and compression
      const originalSize = JSON.stringify(batchData).length;
      const compressedSize = JSON.stringify({
        locations: validLocations.slice(0, Math.min(validLocations.length, 100)), // Sample
        summary: analysis
      }).length;
      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

      // Create batch record
      const batch = new LocationBatchModel({
        userId: batchData.userId,
        deviceId: batchData.deviceId,
        startTime: validLocations[0].timestamp,
        endTime: validLocations[validLocations.length - 1].timestamp,
        locations: validLocations,
        activities,
        sensorData: batchData.sensorData || [],
        metadata: {
          ...batchData.metadata,
          dataUsage: originalSize,
          processingTime: Date.now() - startTime,
          compressionRatio,
        },
        analysis,
        status: 'processed',
        processedAt: new Date(),
      });

      await batch.save();

      // Trigger geofence monitoring
      await this.processGeofenceEvents(batchData.userId, validLocations);

      return {
        success: true,
        data: {
          batchId: batch._id,
          locationsProcessed: validLocations.length,
          analysis,
          compressionRatio,
          processingTime: Date.now() - startTime,
        },
        message: 'Location batch processed successfully',
      };

    } catch (error: any) {
      console.error('Batch processing error:', error);
      return {
        success: false,
        message: 'Failed to process location batch',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Process geofence events
  private async processGeofenceEvents(userId: string, locations: LocationPoint[]): Promise<void> {
    try {
      // This would integrate with the geofence module
      // For now, we'll simulate geofence detection
      for (const location of locations) {
        // Simulate geofence check
        const isInGeofence = Math.random() > 0.9; // 10% chance of geofence event
        
        if (isInGeofence) {
          const event = new GeofenceEventModel({
            userId,
            geofenceId: 'simulated-geofence-id',
            eventType: Math.random() > 0.5 ? 'enter' : 'exit',
            location,
            confidence: 0.8 + Math.random() * 0.2,
          });
          
          await event.save();
        }
      }
    } catch (error) {
      console.error('Geofence processing error:', error);
    }
  }

  // Get user tracking settings
  async getTrackingSettings(userId: string): Promise<ApiResponse> {
    try {
      let settings = await TrackingSettingsModel.findOne({ userId });
      
      if (!settings) {
        // Create default settings
        settings = new TrackingSettingsModel({ userId });
        await settings.save();
      }

      return {
        success: true,
        data: settings,
        message: 'Tracking settings retrieved successfully',
      };

    } catch (error: any) {
      console.error('Get tracking settings error:', error);
      return {
        success: false,
        message: 'Failed to retrieve tracking settings',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Update user tracking settings
  async updateTrackingSettings(userId: string, updates: Partial<TrackingSettings>): Promise<ApiResponse> {
    try {
      const settings = await TrackingSettingsModel.findOneAndUpdate(
        { userId },
        { ...updates, updatedAt: new Date() },
        { new: true, upsert: true }
      );

      return {
        success: true,
        data: settings,
        message: 'Tracking settings updated successfully',
      };

    } catch (error: any) {
      console.error('Update tracking settings error:', error);
      return {
        success: false,
        message: 'Failed to update tracking settings',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Get location history
  async getLocationHistory(userId: string, startDate?: Date, endDate?: Date, limit: number = 100): Promise<ApiResponse> {
    try {
      const query: any = { userId };
      
      if (startDate || endDate) {
        query.startTime = {};
        if (startDate) query.startTime.$gte = startDate;
        if (endDate) query.startTime.$lte = endDate;
      }

      const batches = await LocationBatchModel
        .find(query)
        .sort({ startTime: -1 })
        .limit(limit)
        .select('-locations -sensorData'); // Exclude large arrays for overview

      return {
        success: true,
        data: batches,
        message: 'Location history retrieved successfully',
      };

    } catch (error: any) {
      console.error('Get location history error:', error);
      return {
        success: false,
        message: 'Failed to retrieve location history',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Get detailed batch data
  async getBatchDetails(batchId: string): Promise<ApiResponse> {
    try {
      const batch = await LocationBatchModel.findById(batchId);
      
      if (!batch) {
        return {
          success: false,
          message: 'Batch not found',
        };
      }

      return {
        success: true,
        data: batch,
        message: 'Batch details retrieved successfully',
      };

    } catch (error: any) {
      console.error('Get batch details error:', error);
      return {
        success: false,
        message: 'Failed to retrieve batch details',
        error: error?.message || 'Unknown error',
      };
    }
  }

  // Get analytics
  async getTrackingAnalytics(userId: string, startDate?: Date, endDate?: Date): Promise<ApiResponse> {
    try {
      const matchStage: any = { userId };
      if (startDate || endDate) {
        matchStage.startTime = {};
        if (startDate) matchStage.startTime.$gte = startDate;
        if (endDate) matchStage.startTime.$lte = endDate;
      }

      const analytics = await LocationBatchModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalBatches: { $sum: 1 },
            totalDistance: { $sum: '$analysis.totalDistance' },
            totalTimeMoving: { $sum: '$analysis.timeMoving' },
            totalTimeStationary: { $sum: '$analysis.timeStationary' },
            averageSpeed: { $avg: '$analysis.averageSpeed' },
            maxSpeed: { $max: '$analysis.maxSpeed' },
            totalSignificantPlaces: { $sum: { $size: '$analysis.significantPlaces' } },
          }
        }
      ]);

      const geofenceEvents = await GeofenceEventModel.countDocuments(matchStage);

      return {
        success: true,
        data: {
          summary: analytics[0] || {},
          geofenceEvents,
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
const passiveLocationService = new PassiveLocationService();

// Exported route handlers
export async function batchLocationPoints(req: Request, res: Response) {
  try {
    const result = await passiveLocationService.processBatch(req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function getUserTrackingSettings(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const result = await passiveLocationService.getTrackingSettings(userId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function updateUserTrackingSettings(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const result = await passiveLocationService.updateTrackingSettings(userId, req.body);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function getUserLocationHistory(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { startDate, endDate, limit } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    const limitNum = limit ? parseInt(limit as string) : undefined;
    
    const result = await passiveLocationService.getLocationHistory(userId, start, end, limitNum);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function getLocationBatchDetails(req: Request, res: Response) {
  try {
    const { batchId } = req.params;
    const result = await passiveLocationService.getBatchDetails(batchId);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}

export async function getLocationTrackingAnalytics(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const result = await passiveLocationService.getTrackingAnalytics(userId, start, end);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error?.message || 'Unknown error',
    });
  }
}
