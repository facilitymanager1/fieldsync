// Kiosk Service for managing attendance capture operations
import { KioskLocation, KioskAttendance, GroupAttendanceSession, KioskHealthMonitor } from '../models/kiosk';
import { IKioskLocation, IKioskAttendance, IGroupAttendanceSession } from '../models/kiosk';

export interface KioskAttendanceRequest {
  employeeId: string;
  employeeName: string;
  type: 'check_in' | 'check_out';
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  confidence: number;
  faceData: {
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    confidence: number;
    livenessScore?: number;
    qualityScore?: number;
    embedding?: number[];
  };
  deviceInfo: {
    kioskId: string;
    ipAddress: string;
    userAgent: string;
  };
  processingTime?: number;
}

export interface GroupAttendanceRequest {
  kioskLocationId: string;
  attendanceRecords: KioskAttendanceRequest[];
  sessionMetadata: {
    totalFacesDetected: number;
    processingTime: number;
    frameQuality: number;
    environmentalConditions?: {
      lighting: string;
      crowdDensity: string;
      noiseLevel: string;
    };
  };
}

export interface LocationValidationResult {
  isValid: boolean;
  distance: number;
  kioskInfo: {
    name: string;
    geofenceRadius: number;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  } | null;
}

export class KioskService {
  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Validate if employee location is within kiosk geofence
   */
  async validateGeofence(kioskLocationId: string, employeeLocation: { latitude: number; longitude: number }): Promise<LocationValidationResult> {
    try {
      const kiosk = await KioskLocation.findById(kioskLocationId);
      
      if (!kiosk || !kiosk.isActive) {
        return {
          isValid: false,
          distance: 0,
          kioskInfo: null,
        };
      }

      const distance = this.calculateDistance(employeeLocation, kiosk.coordinates);
      const isValid = distance <= kiosk.geofenceRadius;

      return {
        isValid,
        distance,
        kioskInfo: {
          name: kiosk.name,
          geofenceRadius: kiosk.geofenceRadius,
          coordinates: kiosk.coordinates,
        },
      };
    } catch (error) {
      console.error('Geofence validation error:', error);
      throw new Error('Failed to validate geofence');
    }
  }

  /**
   * Check for duplicate attendance within specified time window
   */
  async checkDuplicateAttendance(
    employeeId: string, 
    type: 'check_in' | 'check_out', 
    timeWindowMs: number = 300000 // 5 minutes
  ): Promise<boolean> {
    try {
      const cutoffTime = new Date(Date.now() - timeWindowMs);
      
      const existingRecord = await KioskAttendance.findOne({
        employeeId,
        type,
        timestamp: { $gte: cutoffTime },
        reviewStatus: { $in: ['auto_approved', 'approved'] }
      });

      return !!existingRecord;
    } catch (error) {
      console.error('Duplicate attendance check error:', error);
      return false;
    }
  }

  /**
   * Validate attendance record and generate flags
   */
  async validateAttendanceRecord(
    request: KioskAttendanceRequest,
    kioskLocationId: string
  ): Promise<{ isValid: boolean; flags: string[]; reviewRequired: boolean }> {
    const flags: string[] = [];
    let reviewRequired = false;

    try {
      // 1. Validate geofence
      const locationValidation = await this.validateGeofence(kioskLocationId, request.location);
      if (!locationValidation.isValid) {
        flags.push('location_mismatch');
        reviewRequired = true;
      }

      // 2. Check confidence threshold
      if (request.confidence < 85) {
        flags.push('low_confidence');
        if (request.confidence < 70) {
          reviewRequired = true;
        }
      }

      // 3. Check liveness score
      if (request.faceData.livenessScore && request.faceData.livenessScore < 0.8) {
        flags.push('liveness_failed');
        reviewRequired = true;
      }

      // 4. Check for duplicate attendance
      const isDuplicate = await this.checkDuplicateAttendance(request.employeeId, request.type);
      if (isDuplicate) {
        flags.push('duplicate');
        reviewRequired = true;
      }

      // 5. Validate operating hours
      const kiosk = await KioskLocation.findById(kioskLocationId);
      if (kiosk) {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinute;

        const [startHour, startMinute] = kiosk.settings.operatingHours.start.split(':').map(Number);
        const [endHour, endMinute] = kiosk.settings.operatingHours.end.split(':').map(Number);
        const startTime = startHour * 60 + startMinute;
        const endTime = endHour * 60 + endMinute;

        if (currentTime < startTime || currentTime > endTime) {
          flags.push('outside_hours');
        }
      }

      // 6. Check face quality
      if (request.faceData.qualityScore && request.faceData.qualityScore < 0.7) {
        flags.push('quality_issues');
      }

      return {
        isValid: flags.length === 0 || !reviewRequired,
        flags,
        reviewRequired,
      };
    } catch (error) {
      console.error('Attendance validation error:', error);
      return {
        isValid: false,
        flags: ['validation_error'],
        reviewRequired: true,
      };
    }
  }

  /**
   * Process single attendance record
   */
  async processSingleAttendance(
    request: KioskAttendanceRequest,
    kioskLocationId: string,
    deviceInfo?: any
  ): Promise<IKioskAttendance> {
    try {
      // Validate the attendance record
      const validation = await this.validateAttendanceRecord(request, kioskLocationId);

      // Create attendance record
      const attendanceRecord = new KioskAttendance({
        employeeId: request.employeeId,
        employeeName: request.employeeName,
        kioskLocationId,
        type: request.type,
        timestamp: new Date(),
        confidence: request.confidence,
        location: request.location,
        verified: validation.isValid,
        faceData: request.faceData,
        deviceInfo: {
          kioskId: request.deviceInfo.kioskId,
          ipAddress: request.deviceInfo.ipAddress,
          userAgent: request.deviceInfo.userAgent,
          ...deviceInfo,
        },
        processingTime: request.processingTime || 0,
        flags: validation.flags,
        reviewStatus: validation.reviewRequired ? 'pending_review' : 'auto_approved',
      });

      await attendanceRecord.save();
      return attendanceRecord;
    } catch (error) {
      console.error('Single attendance processing error:', error);
      throw new Error('Failed to process attendance record');
    }
  }

  /**
   * Process group attendance session
   */
  async processGroupAttendance(
    request: GroupAttendanceRequest,
    deviceInfo?: any
  ): Promise<{ session: IGroupAttendanceSession; processedRecords: IKioskAttendance[] }> {
    try {
      const sessionId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const processedRecords: IKioskAttendance[] = [];

      // Process each attendance record
      for (const attendanceRequest of request.attendanceRecords) {
        try {
          const record = await this.processSingleAttendance(
            { ...attendanceRequest, deviceInfo: { ...attendanceRequest.deviceInfo, ...deviceInfo } },
            request.kioskLocationId,
            deviceInfo
          );
          
          // Add session ID to record
          record.sessionId = sessionId;
          await record.save();
          
          processedRecords.push(record);
        } catch (error) {
          console.error(`Failed to process attendance for employee ${attendanceRequest.employeeId}:`, error);
          // Continue processing other records
        }
      }

      // Create group session
      const groupSession = new GroupAttendanceSession({
        sessionId,
        kioskLocationId: request.kioskLocationId,
        timestamp: new Date(),
        attendanceRecords: processedRecords.map(record => record._id),
        totalFacesDetected: request.sessionMetadata.totalFacesDetected,
        successfulRecognitions: processedRecords.length,
        processingTime: request.sessionMetadata.processingTime,
        frameQuality: request.sessionMetadata.frameQuality,
        environmentalConditions: {
          lighting: request.sessionMetadata.environmentalConditions?.lighting || 'unknown',
          crowdDensity: request.sessionMetadata.environmentalConditions?.crowdDensity || 'unknown',
          noiseLevel: request.sessionMetadata.environmentalConditions?.noiseLevel || 'unknown',
        },
        sessionMetadata: {
          triggerType: 'automatic',
        },
      });

      await groupSession.save();

      return {
        session: groupSession,
        processedRecords,
      };
    } catch (error) {
      console.error('Group attendance processing error:', error);
      throw new Error('Failed to process group attendance');
    }
  }

  /**
   * Get attendance records with filtering and pagination
   */
  async getAttendanceRecords(
    filters: {
      kioskLocationId?: string;
      employeeId?: string;
      startDate?: Date;
      endDate?: Date;
      reviewStatus?: string;
      type?: string;
    },
    pagination: {
      page: number;
      limit: number;
    }
  ): Promise<{ records: IKioskAttendance[]; total: number; pagination: any }> {
    try {
      const query: any = {};

      // Apply filters
      if (filters.kioskLocationId) query.kioskLocationId = filters.kioskLocationId;
      if (filters.employeeId) query.employeeId = filters.employeeId;
      if (filters.reviewStatus) query.reviewStatus = filters.reviewStatus;
      if (filters.type) query.type = filters.type;
      
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = filters.startDate;
        if (filters.endDate) query.timestamp.$lte = filters.endDate;
      }

      const skip = (pagination.page - 1) * pagination.limit;

      const [records, total] = await Promise.all([
        KioskAttendance.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(pagination.limit)
          .populate('kioskLocationId', 'name coordinates'),
        KioskAttendance.countDocuments(query),
      ]);

      return {
        records,
        total,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages: Math.ceil(total / pagination.limit),
        },
      };
    } catch (error) {
      console.error('Get attendance records error:', error);
      throw new Error('Failed to retrieve attendance records');
    }
  }

  /**
   * Get attendance analytics
   */
  async getAttendanceAnalytics(
    kioskLocationId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    try {
      const matchFilter: any = {};
      
      if (kioskLocationId) matchFilter.kioskLocationId = kioskLocationId;
      if (startDate || endDate) {
        matchFilter.timestamp = {};
        if (startDate) matchFilter.timestamp.$gte = startDate;
        if (endDate) matchFilter.timestamp.$lte = endDate;
      }

      const analytics = await KioskAttendance.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            checkIns: { $sum: { $cond: [{ $eq: ['$type', 'check_in'] }, 1, 0] } },
            checkOuts: { $sum: { $cond: [{ $eq: ['$type', 'check_out'] }, 1, 0] } },
            autoApproved: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'auto_approved'] }, 1, 0] } },
            pendingReview: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'pending_review'] }, 1, 0] } },
            avgConfidence: { $avg: '$confidence' },
            uniqueEmployees: { $addToSet: '$employeeId' },
            avgProcessingTime: { $avg: '$processingTime' },
          }
        },
        {
          $project: {
            _id: 0,
            totalRecords: 1,
            checkIns: 1,
            checkOuts: 1,
            autoApproved: 1,
            pendingReview: 1,
            avgConfidence: { $round: ['$avgConfidence', 2] },
            uniqueEmployees: { $size: '$uniqueEmployees' },
            avgProcessingTime: { $round: ['$avgProcessingTime', 0] },
            approvalRate: { 
              $round: [
                { $multiply: [{ $divide: ['$autoApproved', '$totalRecords'] }, 100] }, 
                2
              ] 
            },
          }
        }
      ]);

      // Get hourly distribution
      const hourlyDistribution = await KioskAttendance.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: { $hour: '$timestamp' },
            checkIns: { $sum: { $cond: [{ $eq: ['$type', 'check_in'] }, 1, 0] } },
            checkOuts: { $sum: { $cond: [{ $eq: ['$type', 'check_out'] }, 1, 0] } },
            total: { $sum: 1 },
          }
        },
        { $sort: { '_id': 1 } }
      ]);

      return {
        summary: analytics[0] || {
          totalRecords: 0,
          checkIns: 0,
          checkOuts: 0,
          autoApproved: 0,
          pendingReview: 0,
          avgConfidence: 0,
          uniqueEmployees: 0,
          avgProcessingTime: 0,
          approvalRate: 0,
        },
        hourlyDistribution,
      };
    } catch (error) {
      console.error('Get attendance analytics error:', error);
      throw new Error('Failed to retrieve attendance analytics');
    }
  }

  /**
   * Review attendance record
   */
  async reviewAttendanceRecord(
    recordId: string,
    reviewStatus: 'approved' | 'rejected',
    reviewedBy: string,
    reviewNotes?: string
  ): Promise<IKioskAttendance> {
    try {
      const record = await KioskAttendance.findByIdAndUpdate(
        recordId,
        {
          reviewStatus,
          reviewedBy,
          reviewedAt: new Date(),
          reviewNotes,
        },
        { new: true }
      );

      if (!record) {
        throw new Error('Attendance record not found');
      }

      return record;
    } catch (error) {
      console.error('Review attendance record error:', error);
      throw new Error('Failed to review attendance record');
    }
  }

  /**
   * Get kiosk health status
   */
  async getKioskHealth(kioskLocationId: string): Promise<any> {
    try {
      const latestHealth = await KioskHealthMonitor.findOne({ kioskLocationId })
        .sort({ timestamp: -1 });

      if (!latestHealth) {
        return {
          status: 'unknown',
          message: 'No health data available',
        };
      }

      // Determine overall health status
      const healthScore = this.calculateHealthScore(latestHealth);
      let status = 'healthy';
      
      if (healthScore < 50) status = 'critical';
      else if (healthScore < 70) status = 'warning';
      else if (healthScore < 90) status = 'ok';

      return {
        status,
        healthScore,
        lastUpdate: latestHealth.timestamp,
        systemHealth: latestHealth.systemHealth,
        performance: latestHealth.performance,
        uptime: latestHealth.uptime,
        criticalErrors: latestHealth.systemErrors.filter(e => e.severity === 'critical').length,
      };
    } catch (error) {
      console.error('Get kiosk health error:', error);
      throw new Error('Failed to retrieve kiosk health');
    }
  }

  /**
   * Calculate health score based on system metrics
   */
  private calculateHealthScore(healthData: any): number {
    let score = 100;

    // CPU usage penalty
    if (healthData.systemHealth.cpuUsage > 80) score -= 20;
    else if (healthData.systemHealth.cpuUsage > 60) score -= 10;

    // Memory usage penalty
    if (healthData.systemHealth.memoryUsage > 85) score -= 20;
    else if (healthData.systemHealth.memoryUsage > 70) score -= 10;

    // Camera/display status penalty
    if (healthData.systemHealth.cameraStatus !== 'online') score -= 30;
    if (healthData.systemHealth.displayStatus !== 'online') score -= 20;

    // Performance penalties
    if (healthData.performance.successRate < 90) score -= 15;
    if (healthData.performance.errorRate > 10) score -= 15;

    // Error penalties
    const criticalErrors = healthData.systemErrors.filter((e: any) => e.severity === 'critical').length;
    score -= criticalErrors * 10;

    return Math.max(0, score);
  }
}

export default new KioskService();
