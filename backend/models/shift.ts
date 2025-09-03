/**
 * Enhanced Shift Data Models with MongoDB Integration
 * Comprehensive shift state management with geofencing and time tracking
 */

import mongoose, { Schema, model } from 'mongoose';
import { ShiftDocument } from '../types/modelTypes';
import { createBaseAuditableEntitySchema } from './baseModel';
import { AdvancedSlaTemplateModel, SlaTrackerModel } from './advancedSla';

// Shift States Enum
export enum ShiftState {
  IDLE = 'idle',
  CHECKING_IN = 'checking_in',
  IN_SHIFT = 'in_shift',
  ON_BREAK = 'on_break',
  CHECKING_OUT = 'checking_out',
  POST_SHIFT = 'post_shift',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// Break Types
export enum BreakType {
  LUNCH = 'lunch',
  SHORT_BREAK = 'short_break',
  EMERGENCY = 'emergency',
  AUTHORIZED = 'authorized',
  UNAUTHORIZED = 'unauthorized'
}

// Site Visit Events
export enum SiteVisitEvent {
  ENTER = 'enter',
  EXIT = 'exit',
  EMERGENCY_EXIT = 'emergency_exit',
  TIMEOUT_EXIT = 'timeout_exit'
}

// Location Accuracy Levels
export enum LocationAccuracy {
  HIGH = 'high',      // < 10 meters
  MEDIUM = 'medium',  // 10-50 meters
  LOW = 'low',        // > 50 meters
  UNKNOWN = 'unknown'
}

// Core Interfaces
export interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
  source: 'gps' | 'network' | 'manual';
  accuracyLevel: LocationAccuracy;
}

export interface SiteVisit {
  id: string;
  siteId: mongoose.Types.ObjectId;
  siteName: string;
  enterTime: Date;
  exitTime?: Date;
  timeOnSite: number; // seconds
  event: SiteVisitEvent;
  location: Location;
  geofenceId?: string;
  isPlanned: boolean;
  notes?: string;
  tasks?: VisitTask[];
  approvedBy?: string;
  approvedAt?: Date;
}

export interface VisitTask {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  estimatedDuration: number; // minutes
  actualDuration?: number; // minutes
  notes?: string;
  photos?: string[];
  requiredTools?: string[];
  checklist?: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: Date;
  notes?: string;
  requiresPhoto: boolean;
  photoUrl?: string;
}

export interface BreakPeriod {
  id: string;
  type: BreakType;
  startTime: Date;
  endTime?: Date;
  duration: number; // minutes
  plannedDuration: number; // minutes
  location: Location;
  isAuthorized: boolean;
  authorizedBy?: string;
  reason?: string;
  notes?: string;
}

export interface StateTransition {
  id: string;
  fromState: ShiftState;
  toState: ShiftState;
  timestamp: Date;
  location?: Location;
  reason: string;
  triggeredBy: 'user' | 'system' | 'geofence' | 'admin';
  metadata?: Record<string, any>;
  isValid: boolean;
  validationErrors?: string[];
}

export interface ShiftMetrics {
  totalDuration: number; // minutes
  workingTime: number; // minutes (excluding breaks)
  breakTime: number; // minutes
  travelTime: number; // minutes
  siteTime: number; // minutes
  overtime: number; // minutes
  efficiency: number; // percentage
  tasksCompleted: number;
  tasksTotal: number;
  averageTaskDuration: number; // minutes
  distanceTraveled: number; // kilometers
}

export interface ShiftPlan {
  id: string;
  plannedStartTime: Date;
  plannedEndTime: Date;
  plannedSites: string[];
  plannedTasks: string[];
  estimatedDuration: number; // minutes
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requirements?: string[];
  specialInstructions?: string;
}

export interface ComplianceCheck {
  id: string;
  type: 'safety' | 'time' | 'location' | 'task' | 'equipment';
  status: 'passed' | 'failed' | 'warning';
  timestamp: Date;
  details: string;
  evidence?: string[];
  actionRequired?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// Enhanced Shift interface using proper inheritance
export interface AdvancedShift extends ShiftDocument {
  userId: string;
  assignedStaff: mongoose.Types.ObjectId;
  state: 'idle' | 'checking_in' | 'in_shift' | 'on_break' | 'checking_out' | 'post_shift' | 'completed' | 'cancelled';
  previousState?: string;
  stateHistory: Array<{
    fromState: string;
    toState: string;
    timestamp: Date;
    triggeredBy: 'user' | 'system' | 'geofence' | 'timer';
    reason?: string;
    location?: {
      latitude: number;
      longitude: number;
      accuracy: number;
      timestamp: Date;
    };
  }>;
  scheduledStartTime: Date;
  scheduledEndTime: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: Date;
  };
  geofence?: {
    id: string;
    name: string;
    radius: number;
    center: {
      latitude: number;
      longitude: number;
    };
  };
  breaks: Array<{
    type: 'lunch' | 'short_break' | 'emergency' | 'authorized' | 'unauthorized';
    startTime: Date;
    endTime?: Date;
    duration?: number;
    reason?: string;
    location?: {
      latitude: number;
      longitude: number;
      accuracy: number;
    };
  }>;
  metrics?: {
    totalDuration: number;
    workingTime: number;
    breakTime: number;
    travelTime: number;
    efficiency: number;
    productivityScore: number;
  };
  notes?: string;
}

// MongoDB Schemas
const LocationSchema = new Schema<Location>({
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  accuracy: { type: Number, required: true, min: 0 },
  timestamp: { type: Date, required: true },
  source: { 
    type: String, 
    enum: ['gps', 'network', 'manual'],
    required: true 
  },
  accuracyLevel: {
    type: String,
    enum: Object.values(LocationAccuracy),
    required: true
  }
});

const ChecklistItemSchema = new Schema<ChecklistItem>({
  description: { type: String, required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  notes: { type: String },
  requiresPhoto: { type: Boolean, default: false },
  photoUrl: { type: String }
});

const VisitTaskSchema = new Schema<VisitTask>({
  name: { type: String, required: true },
  description: { type: String },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'skipped'],
    default: 'pending'
  },
  startTime: { type: Date },
  endTime: { type: Date },
  estimatedDuration: { type: Number, required: true },
  actualDuration: { type: Number },
  notes: { type: String },
  photos: [{ type: String }],
  requiredTools: [{ type: String }],
  checklist: [ChecklistItemSchema]
});

const SiteVisitSchema = new Schema<SiteVisit>({
  siteId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Site',
    required: true,
    index: true
  },
  siteName: { type: String, required: true },
  enterTime: { type: Date, required: true },
  exitTime: { type: Date },
  timeOnSite: { type: Number, default: 0 },
  event: {
    type: String,
    enum: Object.values(SiteVisitEvent),
    required: true
  },
  location: { type: LocationSchema, required: true },
  geofenceId: { type: String },
  isPlanned: { type: Boolean, default: false },
  notes: { type: String },
  tasks: [VisitTaskSchema],
  approvedBy: { type: String },
  approvedAt: { type: Date }
});

const BreakPeriodSchema = new Schema<BreakPeriod>({
  type: {
    type: String,
    enum: Object.values(BreakType),
    required: true
  },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  duration: { type: Number, default: 0 },
  plannedDuration: { type: Number, required: true },
  location: { type: LocationSchema, required: true },
  isAuthorized: { type: Boolean, default: false },
  authorizedBy: { type: String },
  reason: { type: String },
  notes: { type: String }
});

const StateTransitionSchema = new Schema<StateTransition>({
  fromState: {
    type: String,
    enum: Object.values(ShiftState),
    required: true
  },
  toState: {
    type: String,
    enum: Object.values(ShiftState),
    required: true
  },
  timestamp: { type: Date, required: true },
  location: LocationSchema,
  reason: { type: String, required: true },
  triggeredBy: {
    type: String,
    enum: ['user', 'system', 'geofence', 'admin'],
    required: true
  },
  metadata: { type: Schema.Types.Mixed },
  isValid: { type: Boolean, default: true },
  validationErrors: [{ type: String }]
});

const ShiftMetricsSchema = new Schema<ShiftMetrics>({
  totalDuration: { type: Number, default: 0 },
  workingTime: { type: Number, default: 0 },
  breakTime: { type: Number, default: 0 },
  travelTime: { type: Number, default: 0 },
  siteTime: { type: Number, default: 0 },
  overtime: { type: Number, default: 0 },
  efficiency: { type: Number, default: 0, min: 0, max: 100 },
  tasksCompleted: { type: Number, default: 0 },
  tasksTotal: { type: Number, default: 0 },
  averageTaskDuration: { type: Number, default: 0 },
  distanceTraveled: { type: Number, default: 0 }
});

const ShiftPlanSchema = new Schema<ShiftPlan>({
  plannedStartTime: { type: Date, required: true },
  plannedEndTime: { type: Date, required: true },
  plannedSites: [{ type: String }],
  plannedTasks: [{ type: String }],
  estimatedDuration: { type: Number, required: true },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  requirements: [{ type: String }],
  specialInstructions: { type: String }
});

const ComplianceCheckSchema = new Schema<ComplianceCheck>({
  type: {
    type: String,
    enum: ['safety', 'time', 'location', 'task', 'equipment'],
    required: true
  },
  status: {
    type: String,
    enum: ['passed', 'failed', 'warning'],
    required: true
  },
  timestamp: { type: Date, required: true },
  details: { type: String, required: true },
  evidence: [{ type: String }],
  actionRequired: { type: String },
  resolvedAt: { type: Date },
  resolvedBy: { type: String }
});

// Shift-specific schema fields (excluding base entity fields)
const advancedShiftFields = {
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true,
    index: true
  },
  staffId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Staff',
    required: true,
    index: true
  },
  
  // State Management
  state: {
    type: String,
    enum: Object.values(ShiftState),
    default: ShiftState.IDLE
  },
  previousState: {
    type: String,
    enum: Object.values(ShiftState)
  },
  stateHistory: [StateTransitionSchema],
  
  // Time Management
  plannedStartTime: { type: Date },
  actualStartTime: { type: Date },
  plannedEndTime: { type: Date },
  actualEndTime: { type: Date },
  lastActivityTime: { type: Date, default: Date.now },
  
  // Location and Movement
  startLocation: LocationSchema,
  endLocation: LocationSchema,
  currentLocation: LocationSchema,
  siteVisits: [SiteVisitSchema],
  locationHistory: [LocationSchema],
  
  // Break Management
  breaks: [BreakPeriodSchema],
  totalBreakTime: { type: Number, default: 0 },
  authorizedBreakTime: { type: Number, default: 0 },
  
  // Planning and Tasks
  shiftPlan: ShiftPlanSchema,
  completedTasks: { type: Number, default: 0 },
  totalTasks: { type: Number, default: 0 },
  
  // Performance and Metrics
  metrics: { type: ShiftMetricsSchema, default: () => ({}) },
  
  // Compliance and Validation
  complianceChecks: [ComplianceCheckSchema],
  isCompliant: { type: Boolean, default: true },
  complianceScore: { type: Number, default: 100, min: 0, max: 100 },
  
  // SLA Integration
  slaTrackerId: { type: String },
  slaBreaches: [{ type: String }],
  
  // Approval and Sign-off
  requiresApproval: { type: Boolean, default: false },
  approvedBy: { type: String },
  approvedAt: { type: Date },
  rejectedBy: { type: String },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },
  
  // Emergency and Safety
  emergencyContacts: [{ type: String }],
  safetyIncidents: [{ type: String }],
  hasEmergency: { type: Boolean, default: false },
  
  // Integration Data
  externalShiftId: { type: String },
  syncStatus: {
    type: String,
    enum: ['pending', 'synced', 'failed'],
    default: 'pending'
  },
  lastSyncAt: { type: Date },
  
  // Metadata
  notes: { type: String },
  tags: [{ type: String }],
  customFields: { type: Schema.Types.Mixed },
  
};

// Create AdvancedShift schema using base auditable entity pattern
const AdvancedShiftSchema = createBaseAuditableEntitySchema<AdvancedShift>(advancedShiftFields, {
  collection: 'shifts',
  toJSON: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for optimal performance
AdvancedShiftSchema.index({ userId: 1, state: 1 });
AdvancedShiftSchema.index({ staffId: 1, createdAt: -1 });
AdvancedShiftSchema.index({ state: 1, actualStartTime: 1 });
AdvancedShiftSchema.index({ 'siteVisits.siteId': 1 });
AdvancedShiftSchema.index({ slaTrackerId: 1 });
AdvancedShiftSchema.index({ actualStartTime: 1, actualEndTime: 1 });
AdvancedShiftSchema.index({ syncStatus: 1, lastSyncAt: 1 });
AdvancedShiftSchema.index({ isCompliant: 1, complianceScore: 1 });

// Virtual for shift duration
AdvancedShiftSchema.virtual('duration').get(function(this: AdvancedShift) {
  if (!this.actualStartTime || !this.actualEndTime) return 0;
  return Math.floor((this.actualEndTime.getTime() - this.actualStartTime.getTime()) / (1000 * 60)); // minutes
});

// Virtual for current state display
AdvancedShiftSchema.virtual('stateDisplay').get(function(this: AdvancedShift) {
  const stateMap: Record<string, string> = {
    'idle': 'Idle',
    'checking_in': 'Checking In',
    'in_shift': 'In Shift',
    'on_break': 'On Break',
    'checking_out': 'Checking Out',
    'post_shift': 'Post Shift',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  };
  return stateMap[this.state] || this.state;
});

// Method to add state transition
AdvancedShiftSchema.methods.addStateTransition = function(fromState: string, toState: string, triggeredBy: string, reason?: string, location?: any): void {
  this.previousState = fromState;
  this.state = toState;
  this.stateHistory.push({
    fromState,
    toState,
    timestamp: new Date(),
    triggeredBy,
    reason,
    location
  });
};

// Method to start break
AdvancedShiftSchema.methods.startBreak = function(type: string, reason?: string, location?: any): void {
  this.breaks.push({
    type,
    startTime: new Date(),
    reason,
    location
  });
};

// Method to end break
AdvancedShiftSchema.methods.endBreak = function(): void {
  const currentBreak = this.breaks[this.breaks.length - 1];
  if (currentBreak && !currentBreak.endTime) {
    currentBreak.endTime = new Date();
    currentBreak.duration = Math.floor((currentBreak.endTime.getTime() - currentBreak.startTime.getTime()) / (1000 * 60)); // minutes
  }
};

// Method to calculate metrics
AdvancedShiftSchema.methods.calculateMetrics = function(): void {
  if (!this.actualStartTime || !this.actualEndTime) return;
  
  const totalDuration = Math.floor((this.actualEndTime.getTime() - this.actualStartTime.getTime()) / (1000 * 60));
  const breakTime = this.breaks.reduce((total, breakPeriod) => total + (breakPeriod.duration || 0), 0);
  const workingTime = totalDuration - breakTime;
  
  this.metrics = {
    totalDuration,
    workingTime,
    breakTime,
    travelTime: 0, // Would be calculated based on location history
    efficiency: workingTime > 0 ? Math.round((workingTime / totalDuration) * 100) : 0,
    productivityScore: 85 // Would be calculated based on tasks completed, etc.
  };
};

// Static method to find active shifts
AdvancedShiftSchema.statics.findActive = function() {
  return this.find({
    state: { $in: ['checking_in', 'in_shift', 'on_break'] },
    isActive: true
  });
};

// Static method to find shifts by user
AdvancedShiftSchema.statics.findByUser = function(userId: string) {
  return this.find({
    userId,
    isActive: true
  }).sort({ createdAt: -1 });
};

// Create and export the model
export const AdvancedShiftModel = model<AdvancedShift>('AdvancedShift', AdvancedShiftSchema);

// Legacy interface for backward compatibility
export interface Shift {
  id: string;
  userId: string;
  state: 'Idle' | 'In-Shift' | 'Post-Shift';
  startTime: Date | null;
  endTime: Date | null;
  siteVisits: Array<{
    siteId: string;
    enterTime: Date;
    exitTime: Date;
    timeOnSite: number; // seconds
  }>;
  createdAt: Date;
  updatedAt: Date;
}
