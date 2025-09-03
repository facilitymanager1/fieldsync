/**
 * Advanced Geofence & Location Trigger Module
 * Comprehensive geofencing with MongoDB integration and shift state transitions
 */

import { Request, Response } from 'express';
import { Schema, model, Document } from 'mongoose';
import { shiftStateMachine } from './shiftStateMachine';
import { ShiftState, SiteVisitEvent, Location, LocationAccuracy } from '../models/shift';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';
import { recordBusinessEvent } from '../middleware/monitoringMiddleware';

// Geofence Enums
export enum GeofenceType {
  WORKSITE = 'worksite',
  OFFICE = 'office',
  WAREHOUSE = 'warehouse',
  CLIENT_LOCATION = 'client_location',
  RESTRICTED_AREA = 'restricted_area',
  EMERGENCY_ZONE = 'emergency_zone'
}

export enum GeofenceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  ARCHIVED = 'archived'
}

export enum GeofenceEventType {
  ENTER = 'enter',
  EXIT = 'exit',
  DWELL = 'dwell',
  BREACH = 'breach'
}

export enum GeofenceTriggerAction {
  AUTOMATIC_CLOCK_IN = 'automatic_clock_in',
  AUTOMATIC_CLOCK_OUT = 'automatic_clock_out',
  SITE_VISIT_START = 'site_visit_start',
  SITE_VISIT_END = 'site_visit_end',
  RESTRICTED_AREA_ALERT = 'restricted_area_alert',
  EMERGENCY_ALERT = 'emergency_alert',
  NOTIFICATION_ONLY = 'notification_only'
}

// Interfaces
export interface GeofenceCoordinates {
  latitude: number;
  longitude: number;
}

export interface GeofenceArea {
  center: GeofenceCoordinates;
  radius: number; // meters
  polygon?: GeofenceCoordinates[]; // for complex shapes
}

export interface GeofenceTrigger {
  id: string;
  eventType: GeofenceEventType;
  action: GeofenceTriggerAction;
  enabled: boolean;
  conditions?: {
    timeOfDay?: { start: string; end: string };
    daysOfWeek?: number[]; // 0-6 (Sunday-Saturday)
    userRoles?: string[];
    minDwellTime?: number; // seconds
    maxFrequency?: number; // max triggers per hour
  };
  metadata?: Record<string, any>;
}

export interface GeofenceEvent {
  id: string;
  geofenceId: string;
  userId: string;
  eventType: GeofenceEventType;
  location: Location;
  timestamp: Date;
  triggeredActions: string[];
  metadata?: Record<string, any>;
  processed: boolean;
  processingErrors?: string[];
}

export interface Geofence {
  id: string;
  name: string;
  description?: string;
  type: GeofenceType;
  status: GeofenceStatus;
  area: GeofenceArea;
  triggers: GeofenceTrigger[];
  
  // Associations
  siteId?: string;
  clientId?: string;
  projectId?: string;
  
  // Access Control
  allowedRoles: string[];
  restrictedRoles?: string[];
  
  // Scheduling
  activeHours?: {
    start: string; // HH:mm format
    end: string;
  };
  activeDays?: number[]; // 0-6 (Sunday-Saturday)
  
  // Notifications
  notifications: {
    enter?: boolean;
    exit?: boolean;
    dwell?: boolean;
    breach?: boolean;
  };
  
  // Performance
  accuracy: number; // required accuracy in meters
  dwellTime: number; // minimum time in seconds to trigger dwell
  cooldownPeriod: number; // seconds between same event types
  
  // Metadata
  tags: string[];
  customFields: Record<string, any>;
  
  // Audit
  createdBy: string;
  createdAt: Date;
  updatedBy: string;
  updatedAt: Date;
  version: number;
}

// MongoDB Schemas
const GeofenceCoordinatesSchema = new Schema<GeofenceCoordinates>({
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 }
});

const GeofenceAreaSchema = new Schema<GeofenceArea>({
  center: { type: GeofenceCoordinatesSchema, required: true },
  radius: { type: Number, required: true, min: 1, max: 10000 }, // 1m to 10km
  polygon: [GeofenceCoordinatesSchema]
});

const GeofenceTriggerSchema = new Schema<GeofenceTrigger>({
  eventType: {
    type: String,
    enum: Object.values(GeofenceEventType),
    required: true
  },
  action: {
    type: String,
    enum: Object.values(GeofenceTriggerAction),
    required: true
  },
  enabled: { type: Boolean, default: true },
  conditions: {
    timeOfDay: {
      start: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
      end: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }
    },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    userRoles: [{ type: String }],
    minDwellTime: { type: Number, min: 0 },
    maxFrequency: { type: Number, min: 1 }
  },
  metadata: { type: Schema.Types.Mixed }
});

const GeofenceEventSchema = new Schema<GeofenceEvent>({
  geofenceId: { type: String, required: true },
  userId: { type: String, required: true },
  eventType: {
    type: String,
    enum: Object.values(GeofenceEventType),
    required: true
  },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, required: true },
    timestamp: { type: Date, required: true },
    source: { type: String, enum: ['gps', 'network', 'manual'], required: true },
    accuracyLevel: { type: String, enum: Object.values(LocationAccuracy), required: true }
  },
  timestamp: { type: Date, default: Date.now },
  triggeredActions: [{ type: String }],
  metadata: { type: Schema.Types.Mixed },
  processed: { type: Boolean, default: false },
  processingErrors: [{ type: String }]
});

const GeofenceSchema = new Schema<Geofence>({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: {
    type: String,
    enum: Object.values(GeofenceType),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(GeofenceStatus),
    default: GeofenceStatus.ACTIVE
  },
  area: { type: GeofenceAreaSchema, required: true },
  triggers: [GeofenceTriggerSchema],
  
  // Associations
  siteId: { type: String },
  clientId: { type: String },
  projectId: { type: String },
  
  // Access Control
  allowedRoles: {
    type: [{ type: String }],
    default: ['FieldTech', 'SiteStaff', 'Supervisor', 'Admin']
  },
  restrictedRoles: [{ type: String }],
  
  // Scheduling
  activeHours: {
    start: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ },
    end: { type: String, match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ }
  },
  activeDays: [{ type: Number, min: 0, max: 6 }],
  
  // Notifications
  notifications: {
    enter: { type: Boolean, default: true },
    exit: { type: Boolean, default: true },
    dwell: { type: Boolean, default: false },
    breach: { type: Boolean, default: true }
  },
  
  // Performance
  accuracy: { type: Number, default: 50, min: 1, max: 1000 }, // meters
  dwellTime: { type: Number, default: 300, min: 0 }, // 5 minutes default
  cooldownPeriod: { type: Number, default: 60, min: 0 }, // 1 minute default
  
  // Metadata
  tags: [{ type: String }],
  customFields: { type: Schema.Types.Mixed },
  
  // Audit
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedBy: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 }
});

// Indexes for performance
GeofenceSchema.index({ status: 1, type: 1 });
GeofenceSchema.index({ 'area.center': '2dsphere' });
GeofenceSchema.index({ siteId: 1, status: 1 });
GeofenceSchema.index({ clientId: 1, status: 1 });
GeofenceSchema.index({ allowedRoles: 1 });
GeofenceSchema.index({ tags: 1 });

GeofenceEventSchema.index({ geofenceId: 1, timestamp: -1 });
GeofenceEventSchema.index({ userId: 1, timestamp: -1 });
GeofenceEventSchema.index({ processed: 1, timestamp: 1 });
GeofenceEventSchema.index({ 'location': '2dsphere' });

// Models
export const GeofenceModel = model<Geofence>('Geofence', GeofenceSchema);
export const GeofenceEventModel = model<GeofenceEvent>('GeofenceEvent', GeofenceEventSchema);

/**
 * Advanced Geofence Manager Class
 */
export class GeofenceManager {
  private eventCooldowns: Map<string, Map<GeofenceEventType, Date>> = new Map();
  private dwellTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Check if a location is within a geofence
   */
  public isLocationInGeofence(location: Location, geofence: Geofence): boolean {
    const distance = this.calculateDistance(
      location.latitude,
      location.longitude,
      geofence.area.center.latitude,
      geofence.area.center.longitude
    );
    
    return distance <= geofence.area.radius;
  }

  /**
   * Process geofence event and trigger actions
   */
  public async processGeofenceEvent(
    geofenceId: string,
    userId: string,
    eventType: GeofenceEventType,
    location: Location,
    userRole?: string,
    shiftId?: string
  ): Promise<GeofenceEvent> {
    try {
      const timer = monitoring.startTimer('geofence_event_processing_duration');
      
      const geofence = await GeofenceModel.findById(geofenceId).exec();
      if (!geofence) {
        throw new Error('Geofence not found');
      }

      // Validate access permissions
      if (!this.hasGeofenceAccess(geofence, userRole)) {
        throw new Error('Access denied to geofence');
      }

      // Check cooldown period
      if (this.isInCooldown(userId, geofenceId, eventType, geofence.cooldownPeriod)) {
        loggingService.debug('Geofence event in cooldown period', {
          userId,
          geofenceId,
          eventType
        });
        // Return null or handle silently
        return null as any;
      }

      // Create event record
      const eventId = `geoevent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const triggeredActions: string[] = [];
      const processingErrors: string[] = [];

      // Process triggers
      for (const trigger of geofence.triggers) {
        if (!trigger.enabled || trigger.eventType !== eventType) {
          continue;
        }

        // Check trigger conditions
        if (!this.evaluateTriggerConditions(trigger, userRole)) {
          continue;
        }

        try {
          await this.executeTriggerAction(
            trigger.action,
            userId,
            geofenceId,
            geofence,
            location,
            shiftId,
            trigger.metadata
          );
          triggeredActions.push(trigger.action);
        } catch (error) {
          const errorMsg = `Failed to execute ${trigger.action}: ${error.message}`;
          processingErrors.push(errorMsg);
          loggingService.error('Geofence trigger execution failed', error, {
            userId,
            geofenceId,
            triggerAction: trigger.action
          });
        }
      }

      // Create event record
      const geofenceEvent = new GeofenceEventModel({
        id: eventId,
        geofenceId,
        userId,
        eventType,
        location,
        timestamp: new Date(),
        triggeredActions,
        processed: true,
        processingErrors: processingErrors.length > 0 ? processingErrors : undefined
      });

      await geofenceEvent.save();

      // Update cooldown
      this.updateCooldown(userId, geofenceId, eventType);

      timer();
      monitoring.incrementCounter('geofence_events_processed_total', 1, {
        eventType,
        geofenceType: geofence.type,
        actionsTriggered: triggeredActions.length.toString()
      });

      recordBusinessEvent('geofence_event_processed', 'GeofenceEvent', eventId, {
        geofenceId,
        userId,
        eventType,
        triggeredActions,
        hasErrors: processingErrors.length > 0
      });

      loggingService.info('Geofence event processed', {
        eventId,
        geofenceId,
        userId,
        eventType,
        triggeredActions,
        errorCount: processingErrors.length
      });

      return geofenceEvent.toObject();
    } catch (error) {
      loggingService.error('Failed to process geofence event', error, {
        geofenceId,
        userId,
        eventType
      });
      monitoring.incrementCounter('geofence_event_processing_errors_total', 1);
      throw error;
    }
  }

  /**
   * Execute trigger action based on type
   */
  private async executeTriggerAction(
    action: GeofenceTriggerAction,
    userId: string,
    geofenceId: string,
    geofence: Geofence,
    location: Location,
    shiftId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    switch (action) {
      case GeofenceTriggerAction.AUTOMATIC_CLOCK_IN:
        if (!shiftId) {
          // Start new shift automatically
          await shiftStateMachine.startShift(
            userId,
            userId, // Assuming staffId same as userId for auto actions
            location
          );
        } else {
          // Transition existing shift to IN_SHIFT state
          await shiftStateMachine.transitionState(
            shiftId,
            ShiftState.IN_SHIFT,
            `Automatic clock-in via geofence: ${geofence.name}`,
            'geofence',
            location,
            { geofenceId, geofenceName: geofence.name }
          );
        }
        break;

      case GeofenceTriggerAction.AUTOMATIC_CLOCK_OUT:
        if (shiftId) {
          await shiftStateMachine.endShift(
            shiftId,
            userId,
            location,
            `Automatic clock-out via geofence: ${geofence.name}`
          );
        }
        break;

      case GeofenceTriggerAction.SITE_VISIT_START:
        if (shiftId && geofence.siteId) {
          await shiftStateMachine.recordSiteVisit(
            shiftId,
            geofence.siteId,
            geofence.name,
            SiteVisitEvent.ENTER,
            location,
            geofenceId
          );
        }
        break;

      case GeofenceTriggerAction.SITE_VISIT_END:
        if (shiftId && geofence.siteId) {
          await shiftStateMachine.recordSiteVisit(
            shiftId,
            geofence.siteId,
            geofence.name,
            SiteVisitEvent.EXIT,
            location,
            geofenceId
          );
        }
        break;

      case GeofenceTriggerAction.RESTRICTED_AREA_ALERT:
      case GeofenceTriggerAction.EMERGENCY_ALERT:
        // Send immediate notification
        recordBusinessEvent('security_alert', 'GeofenceAlert', geofenceId, {
          alertType: action,
          userId,
          geofenceName: geofence.name,
          location: this.anonymizeLocation(location),
          severity: action === GeofenceTriggerAction.EMERGENCY_ALERT ? 'critical' : 'high'
        });
        break;

      case GeofenceTriggerAction.NOTIFICATION_ONLY:
        // Just log the event, no automatic actions
        break;

      default:
        throw new Error(`Unknown trigger action: ${action}`);
    }
  }

  /**
   * Evaluate trigger conditions
   */
  private evaluateTriggerConditions(trigger: GeofenceTrigger, userRole?: string): boolean {
    if (!trigger.conditions) return true;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = now.getDay();

    // Check time of day
    if (trigger.conditions.timeOfDay) {
      const { start, end } = trigger.conditions.timeOfDay;
      if (currentTime < start || currentTime > end) {
        return false;
      }
    }

    // Check days of week
    if (trigger.conditions.daysOfWeek && !trigger.conditions.daysOfWeek.includes(currentDay)) {
      return false;
    }

    // Check user roles
    if (trigger.conditions.userRoles && userRole && !trigger.conditions.userRoles.includes(userRole)) {
      return false;
    }

    return true;
  }

  /**
   * Check if event is in cooldown period
   */
  private isInCooldown(userId: string, geofenceId: string, eventType: GeofenceEventType, cooldownSeconds: number): boolean {
    const key = `${userId}_${geofenceId}`;
    const userCooldowns = this.eventCooldowns.get(key);
    
    if (!userCooldowns) return false;
    
    const lastEventTime = userCooldowns.get(eventType);
    if (!lastEventTime) return false;
    
    const cooldownEnd = new Date(lastEventTime.getTime() + (cooldownSeconds * 1000));
    return new Date() < cooldownEnd;
  }

  /**
   * Update cooldown timestamp
   */
  private updateCooldown(userId: string, geofenceId: string, eventType: GeofenceEventType): void {
    const key = `${userId}_${geofenceId}`;
    
    if (!this.eventCooldowns.has(key)) {
      this.eventCooldowns.set(key, new Map());
    }
    
    this.eventCooldowns.get(key)!.set(eventType, new Date());
  }

  /**
   * Check if user has access to geofence
   */
  private hasGeofenceAccess(geofence: Geofence, userRole?: string): boolean {
    if (!userRole) return false;
    
    // Check restricted roles first
    if (geofence.restrictedRoles && geofence.restrictedRoles.includes(userRole)) {
      return false;
    }
    
    // Check allowed roles
    return geofence.allowedRoles.includes(userRole);
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLon = this.degreesToRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degreesToRadians(lat1)) * Math.cos(this.degreesToRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  private degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private anonymizeLocation(location: Location): Partial<Location> {
    return {
      accuracy: location.accuracy,
      timestamp: location.timestamp,
      source: location.source,
      accuracyLevel: location.accuracyLevel
    };
  }
}

// Export singleton instance
export const geofenceManager = new GeofenceManager();

// Legacy API functions for backward compatibility
export async function getGeofences(req: Request, res: Response): Promise<void> {
  try {
    const {
      status,
      type,
      siteId,
      clientId,
      page = '1',
      limit = '20'
    } = req.query;

    const query: any = {};
    
    if (status) query.status = status;
    if (type) query.type = type;
    if (siteId) query.siteId = siteId;
    if (clientId) query.clientId = clientId;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [geofences, total] = await Promise.all([
      GeofenceModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
        .exec(),
      GeofenceModel.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        geofences,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    loggingService.error('Failed to get geofences', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve geofences'
    });
  }
}

export async function processGeofenceEvent(
  geofenceId: string,
  userId: string,
  eventType: GeofenceEventType,
  location: Location,
  userRole?: string,
  shiftId?: string
): Promise<GeofenceEvent | null> {
  return await geofenceManager.processGeofenceEvent(
    geofenceId,
    userId,
    eventType,
    location,
    userRole,
    shiftId
  );
}
