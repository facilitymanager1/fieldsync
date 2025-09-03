// Kiosk mode models for attendance capture
import mongoose, { Schema, Document } from 'mongoose';

// Kiosk Location Model
export interface IKioskLocation extends Document {
  name: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  geofenceRadius: number;
  isActive: boolean;
  allowedDevices: string[];
  settings: {
    requiredConfidence: number;
    enableLivenessDetection: boolean;
    enableGroupAttendance: boolean;
    maxFacesPerSession: number;
    autoProcessDelay: number;
    operatingHours: {
      start: string;
      end: string;
    };
    timezone: string;
  };
  deviceConfiguration: {
    cameraSettings: {
      resolution: string;
      frameRate: number;
      autoFocus: boolean;
    };
    displaySettings: {
      brightness: number;
      timeout: number;
      screensaver: boolean;
    };
    networkSettings: {
      wifiSSID?: string;
      staticIP?: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const KioskLocationSchema = new Schema<IKioskLocation>({
  name: { type: String, required: true, unique: true },
  coordinates: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  geofenceRadius: { type: Number, default: 50, min: 10, max: 500 },
  isActive: { type: Boolean, default: true },
  allowedDevices: [{ type: String }],
  settings: {
    requiredConfidence: { type: Number, default: 85, min: 70, max: 99 },
    enableLivenessDetection: { type: Boolean, default: true },
    enableGroupAttendance: { type: Boolean, default: true },
    maxFacesPerSession: { type: Number, default: 10, min: 1, max: 50 },
    autoProcessDelay: { type: Number, default: 2000, min: 1000, max: 10000 },
    operatingHours: {
      start: { type: String, default: '06:00' },
      end: { type: String, default: '22:00' },
    },
    timezone: { type: String, default: 'UTC' },
  },
  deviceConfiguration: {
    cameraSettings: {
      resolution: { type: String, default: '1280x720' },
      frameRate: { type: Number, default: 30 },
      autoFocus: { type: Boolean, default: true },
    },
    displaySettings: {
      brightness: { type: Number, default: 80 },
      timeout: { type: Number, default: 300000 }, // 5 minutes
      screensaver: { type: Boolean, default: true },
    },
    networkSettings: {
      wifiSSID: String,
      staticIP: String,
    },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Kiosk Attendance Model
export interface IKioskAttendance extends Document {
  employeeId: string;
  employeeName: string;
  kioskLocationId: string;
  type: 'check_in' | 'check_out' | 'break_start' | 'break_end';
  timestamp: Date;
  confidence: number;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  verified: boolean;
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
    deviceFingerprint?: string;
  };
  sessionId?: string;
  processingTime: number;
  flags: string[];
  reviewStatus: 'auto_approved' | 'pending_review' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  metadata: {
    temperature?: number;
    lighting?: string;
    crowdDensity?: string;
    audioLevel?: number;
  };
}

const KioskAttendanceSchema = new Schema<IKioskAttendance>({
  employeeId: { type: String, required: true, index: true },
  employeeName: { type: String, required: true },
  kioskLocationId: { type: String, required: true, index: true },
  type: { 
    type: String, 
    enum: ['check_in', 'check_out', 'break_start', 'break_end'], 
    required: true 
  },
  timestamp: { type: Date, default: Date.now, index: true },
  confidence: { type: Number, required: true, min: 0, max: 100 },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, required: true },
  },
  verified: { type: Boolean, default: false },
  faceData: {
    boundingBox: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },
    confidence: { type: Number, required: true },
    livenessScore: Number,
    qualityScore: Number,
    embedding: [Number],
  },
  deviceInfo: {
    kioskId: { type: String, required: true },
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    deviceFingerprint: String,
  },
  sessionId: String,
  processingTime: { type: Number, default: 0 },
  flags: [{ 
    type: String, 
    enum: [
      'duplicate', 
      'low_confidence', 
      'location_mismatch', 
      'outside_hours',
      'suspicious_timing',
      'quality_issues',
      'liveness_failed',
      'device_unauthorized'
    ]
  }],
  reviewStatus: { 
    type: String, 
    enum: ['auto_approved', 'pending_review', 'approved', 'rejected'], 
    default: 'auto_approved' 
  },
  reviewedBy: String,
  reviewedAt: Date,
  reviewNotes: String,
  metadata: {
    temperature: Number,
    lighting: { type: String, enum: ['low', 'medium', 'high', 'optimal'] },
    crowdDensity: { type: String, enum: ['empty', 'low', 'medium', 'high'] },
    audioLevel: Number,
  },
});

// Group Attendance Session Model
export interface IGroupAttendanceSession extends Document {
  sessionId: string;
  kioskLocationId: string;
  timestamp: Date;
  attendanceRecords: string[];
  totalFacesDetected: number;
  successfulRecognitions: number;
  processingTime: number;
  frameQuality: number;
  environmentalConditions: {
    lighting: string;
    crowdDensity: string;
    noiseLevel: string;
    cameraAngle?: number;
    distanceFromCamera?: number;
  };
  sessionMetadata: {
    triggerType: 'manual' | 'automatic' | 'scheduled';
    operatorId?: string;
    notes?: string;
  };
}

const GroupAttendanceSessionSchema = new Schema<IGroupAttendanceSession>({
  sessionId: { type: String, required: true, unique: true },
  kioskLocationId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  attendanceRecords: [{ type: Schema.Types.ObjectId, ref: 'KioskAttendance' }],
  totalFacesDetected: { type: Number, required: true },
  successfulRecognitions: { type: Number, required: true },
  processingTime: { type: Number, required: true },
  frameQuality: { type: Number, min: 0, max: 100 },
  environmentalConditions: {
    lighting: { type: String, enum: ['poor', 'fair', 'good', 'excellent'] },
    crowdDensity: { type: String, enum: ['empty', 'sparse', 'moderate', 'crowded'] },
    noiseLevel: { type: String, enum: ['quiet', 'moderate', 'loud', 'very_loud'] },
    cameraAngle: Number,
    distanceFromCamera: Number,
  },
  sessionMetadata: {
    triggerType: { type: String, enum: ['manual', 'automatic', 'scheduled'], default: 'manual' },
    operatorId: String,
    notes: String,
  },
});

// Kiosk Health Monitor Model
export interface IKioskHealthMonitor extends Document {
  kioskLocationId: string;
  timestamp: Date;
  systemHealth: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
    cameraStatus: 'online' | 'offline' | 'error';
    displayStatus: 'online' | 'offline' | 'error';
  };
  performance: {
    avgProcessingTime: number;
    successRate: number;
    errorRate: number;
    confidenceAverage: number;
  };
  systemErrors: Array<{
    type: string;
    message: string;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  uptime: number;
  lastMaintenance?: Date;
  nextMaintenanceScheduled?: Date;
}

const KioskHealthMonitorSchema = new Schema<IKioskHealthMonitor>({
  kioskLocationId: { type: String, required: true, index: true },
  timestamp: { type: Date, default: Date.now },
  systemHealth: {
    cpuUsage: { type: Number, min: 0, max: 100 },
    memoryUsage: { type: Number, min: 0, max: 100 },
    diskUsage: { type: Number, min: 0, max: 100 },
    networkLatency: Number,
    cameraStatus: { type: String, enum: ['online', 'offline', 'error'] },
    displayStatus: { type: String, enum: ['online', 'offline', 'error'] },
  },
  performance: {
    avgProcessingTime: Number,
    successRate: { type: Number, min: 0, max: 100 },
    errorRate: { type: Number, min: 0, max: 100 },
    confidenceAverage: { type: Number, min: 0, max: 100 },
  },
  systemErrors: [{
    type: String,
    message: String,
    timestamp: { type: Date, default: Date.now },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  }],
  uptime: { type: Number, default: 0 },
  lastMaintenance: Date,
  nextMaintenanceScheduled: Date,
});

// Kiosk Configuration Template Model
export interface IKioskTemplate extends Document {
  name: string;
  description: string;
  templateType: 'office' | 'factory' | 'retail' | 'outdoor' | 'custom';
  settings: {
    security: {
      requiredConfidence: number;
      enableLivenessDetection: boolean;
      antiSpoofingLevel: 'basic' | 'standard' | 'strict';
    };
    performance: {
      processingMode: 'fast' | 'balanced' | 'accurate';
      batchSize: number;
      frameSkip: number;
    };
    ui: {
      theme: 'light' | 'dark' | 'auto';
      language: string;
      fontSize: 'small' | 'medium' | 'large';
      timeout: number;
    };
    accessibility: {
      voiceGuidance: boolean;
      highContrast: boolean;
      largeButtons: boolean;
    };
  };
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const KioskTemplateSchema = new Schema<IKioskTemplate>({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  templateType: { 
    type: String, 
    enum: ['office', 'factory', 'retail', 'outdoor', 'custom'], 
    required: true 
  },
  settings: {
    security: {
      requiredConfidence: { type: Number, default: 85 },
      enableLivenessDetection: { type: Boolean, default: true },
      antiSpoofingLevel: { type: String, enum: ['basic', 'standard', 'strict'], default: 'standard' },
    },
    performance: {
      processingMode: { type: String, enum: ['fast', 'balanced', 'accurate'], default: 'balanced' },
      batchSize: { type: Number, default: 5 },
      frameSkip: { type: Number, default: 3 },
    },
    ui: {
      theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
      language: { type: String, default: 'en' },
      fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
      timeout: { type: Number, default: 30000 },
    },
    accessibility: {
      voiceGuidance: { type: Boolean, default: false },
      highContrast: { type: Boolean, default: false },
      largeButtons: { type: Boolean, default: false },
    },
  },
  isDefault: { type: Boolean, default: false },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes for performance
KioskLocationSchema.index({ coordinates: '2dsphere' });
KioskAttendanceSchema.index({ timestamp: -1, kioskLocationId: 1 });
KioskAttendanceSchema.index({ employeeId: 1, timestamp: -1 });
KioskAttendanceSchema.index({ reviewStatus: 1, timestamp: -1 });
GroupAttendanceSessionSchema.index({ timestamp: -1, kioskLocationId: 1 });
KioskHealthMonitorSchema.index({ kioskLocationId: 1, timestamp: -1 });

// Pre-save middleware
KioskLocationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

KioskAttendanceSchema.pre('save', function(next) {
  // Auto-generate flags based on data
  if (this.confidence < 80) {
    this.flags.push('low_confidence');
  }
  
  if (this.faceData.livenessScore && this.faceData.livenessScore < 0.8) {
    this.flags.push('liveness_failed');
  }
  
  next();
});

// Static methods
KioskLocationSchema.statics.findActiveKiosks = function() {
  return this.find({ isActive: true }).sort({ name: 1 });
};

KioskAttendanceSchema.statics.findPendingReview = function() {
  return this.find({ reviewStatus: 'pending_review' }).sort({ timestamp: -1 });
};

KioskAttendanceSchema.statics.getAttendanceStats = function(startDate: Date, endDate: Date) {
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$confidence' }
      }
    }
  ]);
};

// Export models
export const KioskLocation = mongoose.model<IKioskLocation>('KioskLocation', KioskLocationSchema);
export const KioskAttendance = mongoose.model<IKioskAttendance>('KioskAttendance', KioskAttendanceSchema);
export const GroupAttendanceSession = mongoose.model<IGroupAttendanceSession>('GroupAttendanceSession', GroupAttendanceSessionSchema);
export const KioskHealthMonitor = mongoose.model<IKioskHealthMonitor>('KioskHealthMonitor', KioskHealthMonitorSchema);
export const KioskTemplate = mongoose.model<IKioskTemplate>('KioskTemplate', KioskTemplateSchema);

export default {
  KioskLocation,
  KioskAttendance,
  GroupAttendanceSession,
  KioskHealthMonitor,
  KioskTemplate,
};
