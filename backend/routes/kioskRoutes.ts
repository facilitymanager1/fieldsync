// Kiosk-specific API routes for attendance capture
import { Router } from 'express';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { requireAuth, requireRole } from '../authentication';

const router = Router();

// Kiosk-specific interfaces
interface KioskLocation {
  id: string;
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  geofenceRadius: number;
  isActive: boolean;
  allowedDevices: string[];
}

interface KioskAttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  kioskLocationId: string;
  type: 'check_in' | 'check_out';
  timestamp: Date;
  confidence: number;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  verified: boolean;
  faceData?: {
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    confidence: number;
    livenessScore?: number;
  };
  deviceInfo: {
    kioskId: string;
    ipAddress: string;
    userAgent: string;
  };
}

interface GroupAttendanceSession {
  sessionId: string;
  kioskLocationId: string;
  timestamp: Date;
  attendanceRecords: KioskAttendanceRecord[];
  totalFacesDetected: number;
  successfulRecognitions: number;
  processingTime: number;
}

// MongoDB Schemas
const KioskLocationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  coordinates: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  geofenceRadius: { type: Number, default: 50 },
  isActive: { type: Boolean, default: true },
  allowedDevices: [String],
  settings: {
    requiredConfidence: { type: Number, default: 85 },
    enableLivenessDetection: { type: Boolean, default: true },
    enableGroupAttendance: { type: Boolean, default: true },
    maxFacesPerSession: { type: Number, default: 10 },
    autoProcessDelay: { type: Number, default: 2000 },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const KioskAttendanceSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, index: true },
  employeeName: { type: String, required: true },
  kioskLocationId: { type: String, required: true, index: true },
  type: { type: String, enum: ['check_in', 'check_out'], required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  confidence: { type: Number, required: true },
  location: {
    latitude: Number,
    longitude: Number,
    accuracy: Number,
  },
  verified: { type: Boolean, default: false },
  faceData: {
    boundingBox: {
      x: Number,
      y: Number,
      width: Number,
      height: Number,
    },
    confidence: Number,
    livenessScore: Number,
  },
  deviceInfo: {
    kioskId: String,
    ipAddress: String,
    userAgent: String,
  },
  sessionId: String,
  processingTime: Number,
  flags: [String], // ['duplicate', 'low_confidence', 'location_mismatch', etc.]
  reviewStatus: { type: String, enum: ['auto_approved', 'pending_review', 'approved', 'rejected'], default: 'auto_approved' },
  reviewedBy: String,
  reviewedAt: Date,
  reviewNotes: String,
});

const GroupAttendanceSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  kioskLocationId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  attendanceRecords: [{ type: mongoose.Schema.Types.ObjectId, ref: 'KioskAttendance' }],
  totalFacesDetected: Number,
  successfulRecognitions: Number,
  processingTime: Number,
  frameQuality: Number,
  environmentalConditions: {
    lighting: String,
    crowdDensity: String,
    noiseLevel: String,
  },
});

// Models
const KioskLocation = mongoose.model('KioskLocation', KioskLocationSchema);
const KioskAttendance = mongoose.model('KioskAttendance', KioskAttendanceSchema);
const GroupAttendanceSession = mongoose.model('GroupAttendanceSession', GroupAttendanceSessionSchema);

// Utility Functions
const calculateDistance = (point1: { latitude: number; longitude: number }, point2: { latitude: number; longitude: number }): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const validateGeofence = async (kioskLocationId: string, employeeLocation: { latitude: number; longitude: number }): Promise<boolean> => {
  try {
    const kiosk = await KioskLocation.findById(kioskLocationId);
    if (!kiosk || !kiosk.isActive) return false;
    
    const distance = calculateDistance(employeeLocation, kiosk.coordinates);
    return distance <= kiosk.geofenceRadius;
  } catch (error) {
    console.error('Geofence validation error:', error);
    return false;
  }
};

const detectDuplicateAttendance = async (employeeId: string, type: 'check_in' | 'check_out', timeWindow: number = 300000): Promise<boolean> => {
  try {
    const recentRecord = await KioskAttendance.findOne({
      employeeId,
      type,
      timestamp: { $gte: new Date(Date.now() - timeWindow) }
    });
    return !!recentRecord;
  } catch (error) {
    console.error('Duplicate detection error:', error);
    return false;
  }
};

const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// API Routes

/**
 * @route GET /api/kiosk/locations
 * @desc Get all active kiosk locations
 * @access Private (Admin, Supervisor)
 */
router.get('/locations', requireAuth, requireRole(['Admin', 'Supervisor']), async (req: Request, res: Response) => {
  try {
    const locations = await KioskLocation.find({ isActive: true }).sort({ name: 1 });
    res.json({
      success: true,
      data: locations,
      count: locations.length,
    });
  } catch (error) {
    console.error('Get kiosk locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve kiosk locations',
      error: error.message,
    });
  }
});

/**
 * @route POST /api/kiosk/locations
 * @desc Create new kiosk location
 * @access Private (Admin)
 */
router.post('/locations', requireAuth, requireRole(['Admin']), async (req: Request, res: Response) => {
  try {
    const kioskLocation = new KioskLocation(req.body);
    await kioskLocation.save();
    
    res.status(201).json({
      success: true,
      data: kioskLocation,
      message: 'Kiosk location created successfully',
    });
  } catch (error) {
    console.error('Create kiosk location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create kiosk location',
      error: error.message,
    });
  }
});

/**
 * @route POST /api/kiosk/attendance
 * @desc Record attendance from kiosk (single or group)
 * @access Public (Kiosk devices)
 */
router.post('/attendance', async (req: Request, res: Response) => {
  try {
    const { records, kioskLocationId, sessionType = 'individual' } = req.body;
    const attendanceRecords: KioskAttendanceRecord[] = Array.isArray(records) ? records : [records];
    
    // Generate session ID for group attendance
    const sessionId = sessionType === 'group' ? generateSessionId() : null;
    
    const processedRecords = [];
    const flags = [];
    
    for (const record of attendanceRecords) {
      // Validate geofence
      const isWithinGeofence = await validateGeofence(kioskLocationId, record.location);
      if (!isWithinGeofence) {
        flags.push('location_mismatch');
      }
      
      // Check for duplicates
      const isDuplicate = await detectDuplicateAttendance(record.employeeId, record.type);
      if (isDuplicate) {
        flags.push('duplicate_attendance');
      }
      
      // Validate confidence threshold
      if (record.confidence < 85) {
        flags.push('low_confidence');
      }
      
      // Create attendance record
      const attendanceRecord = new KioskAttendance({
        ...record,
        kioskLocationId,
        sessionId,
        timestamp: new Date(),
        flags,
        reviewStatus: flags.length > 0 ? 'pending_review' : 'auto_approved',
        deviceInfo: {
          kioskId: kioskLocationId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        },
      });
      
      await attendanceRecord.save();
      processedRecords.push(attendanceRecord);
    }
    
    // Create group session if applicable
    if (sessionType === 'group' && sessionId) {
      const groupSession = new GroupAttendanceSession({
        sessionId,
        kioskLocationId,
        attendanceRecords: processedRecords.map(record => record._id),
        totalFacesDetected: attendanceRecords.length,
        successfulRecognitions: processedRecords.filter(r => r.reviewStatus === 'auto_approved').length,
        processingTime: req.body.processingTime || 0,
        frameQuality: req.body.frameQuality || 0,
      });
      
      await groupSession.save();
    }
    
    res.json({
      success: true,
      data: {
        processedRecords: processedRecords.length,
        autoApproved: processedRecords.filter(r => r.reviewStatus === 'auto_approved').length,
        pendingReview: processedRecords.filter(r => r.reviewStatus === 'pending_review').length,
        sessionId,
      },
      message: 'Attendance records processed successfully',
    });
    
  } catch (error) {
    console.error('Kiosk attendance recording error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record attendance',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/kiosk/attendance
 * @desc Get kiosk attendance records with filtering
 * @access Private (Admin, Supervisor, SiteStaff)
 */
router.get('/attendance', requireAuth, requireRole(['Admin', 'Supervisor', 'SiteStaff']), async (req: Request, res: Response) => {
  try {
    const {
      kioskLocationId,
      employeeId,
      startDate,
      endDate,
      reviewStatus,
      page = 1,
      limit = 50,
    } = req.query;
    
    const filter: any = {};
    
    if (kioskLocationId) filter.kioskLocationId = kioskLocationId;
    if (employeeId) filter.employeeId = employeeId;
    if (reviewStatus) filter.reviewStatus = reviewStatus;
    
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate as string);
      if (endDate) filter.timestamp.$lte = new Date(endDate as string);
    }
    
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const [records, total] = await Promise.all([
      KioskAttendance.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit as string))
        .populate('kioskLocationId', 'name'),
      KioskAttendance.countDocuments(filter),
    ]);
    
    res.json({
      success: true,
      data: records,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
    
  } catch (error) {
    console.error('Get kiosk attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve attendance records',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/kiosk/attendance/pending
 * @desc Get attendance records pending review
 * @access Private (Admin, Supervisor)
 */
router.get('/attendance/pending', requireAuth, requireRole(['Admin', 'Supervisor']), async (req: Request, res: Response) => {
  try {
    const pendingRecords = await KioskAttendance.find({
      reviewStatus: 'pending_review'
    })
      .sort({ timestamp: -1 })
      .populate('kioskLocationId', 'name')
      .limit(100);
    
    res.json({
      success: true,
      data: pendingRecords,
      count: pendingRecords.length,
    });
  } catch (error) {
    console.error('Get pending attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending records',
      error: error.message,
    });
  }
});

/**
 * @route PUT /api/kiosk/attendance/:id/review
 * @desc Review and approve/reject attendance record
 * @access Private (Admin, Supervisor)
 */
router.put('/attendance/:id/review', requireAuth, requireRole(['Admin', 'Supervisor']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewStatus, reviewNotes } = req.body;
    const reviewerId = req.user?.id;
    
    const record = await KioskAttendance.findByIdAndUpdate(
      id,
      {
        reviewStatus,
        reviewNotes,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      },
      { new: true }
    );
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found',
      });
    }
    
    res.json({
      success: true,
      data: record,
      message: 'Attendance record reviewed successfully',
    });
    
  } catch (error) {
    console.error('Review attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to review attendance record',
      error: error.message,
    });
  }
});

/**
 * @route GET /api/kiosk/analytics
 * @desc Get kiosk attendance analytics
 * @access Private (Admin, Supervisor)
 */
router.get('/analytics', requireAuth, requireRole(['Admin', 'Supervisor']), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, kioskLocationId } = req.query;
    
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate as string);
    if (endDate) dateFilter.$lte = new Date(endDate as string);
    
    const matchFilter: any = {};
    if (Object.keys(dateFilter).length > 0) matchFilter.timestamp = dateFilter;
    if (kioskLocationId) matchFilter.kioskLocationId = kioskLocationId;
    
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
          count: { $sum: 1 },
        }
      },
      { $sort: { '_id': 1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        summary: analytics[0] || {
          totalRecords: 0,
          checkIns: 0,
          checkOuts: 0,
          autoApproved: 0,
          pendingReview: 0,
          avgConfidence: 0,
          uniqueEmployees: 0,
          approvalRate: 0,
        },
        hourlyDistribution,
      },
    });
    
  } catch (error) {
    console.error('Get kiosk analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve analytics',
      error: error.message,
    });
  }
});

/**
 * @route POST /api/kiosk/verify-location
 * @desc Verify if current location is within kiosk geofence
 * @access Public (Kiosk devices)
 */
router.post('/verify-location', async (req: Request, res: Response) => {
  try {
    const { kioskLocationId, currentLocation } = req.body;
    
    const isValid = await validateGeofence(kioskLocationId, currentLocation);
    const kiosk = await KioskLocation.findById(kioskLocationId);
    
    res.json({
      success: true,
      data: {
        isValid,
        kioskLocation: kiosk ? {
          name: kiosk.name,
          coordinates: kiosk.coordinates,
          geofenceRadius: kiosk.geofenceRadius,
        } : null,
      },
    });
  } catch (error) {
    console.error('Location verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify location',
      error: error.message,
    });
  }
});

export default router;
