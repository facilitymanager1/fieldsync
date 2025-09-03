/**
 * Enhanced Analytics Model with Proper Inheritance
 * Comprehensive analytics and event tracking system
 */

import mongoose, { Schema, model } from 'mongoose';
import { AnalyticsDocument } from '../types/modelTypes';
import { createBaseEntitySchema } from './baseModel';

// Analytics Event Types
export enum AnalyticsEventType {
  USER_ACTION = 'user_action',
  SYSTEM_EVENT = 'system_event',
  PERFORMANCE_METRIC = 'performance_metric',
  BUSINESS_EVENT = 'business_event',
  ERROR_EVENT = 'error_event',
  SECURITY_EVENT = 'security_event',
  API_CALL = 'api_call',
  PAGE_VIEW = 'page_view',
  FEATURE_USAGE = 'feature_usage',
  CONVERSION_EVENT = 'conversion_event'
}

// Analytics Categories
export enum AnalyticsCategory {
  AUTHENTICATION = 'authentication',
  NAVIGATION = 'navigation',
  DATA_MANAGEMENT = 'data_management',
  COMMUNICATION = 'communication',
  REPORTING = 'reporting',
  SYSTEM_HEALTH = 'system_health',
  USER_ENGAGEMENT = 'user_engagement',
  BUSINESS_PROCESS = 'business_process'
}

// Session Information Interface
export interface SessionInfo {
  sessionId: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  pageViews: number;
  actions: number;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser: string;
  os: string;
}

// User Context Interface
export interface UserContext {
  userId?: string;
  userRole?: string;
  organizationId?: string;
  departmentId?: string;
  locationId?: string;
  timezone?: string;
  language?: string;
  isAuthenticated: boolean;
}

// Performance Metrics Interface
export interface PerformanceMetrics {
  loadTime?: number;
  responseTime?: number;
  renderTime?: number;
  networkLatency?: number;
  databaseLatency?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  errorRate?: number;
}

// Enhanced Analytics interface using proper inheritance
export interface Analytics extends AnalyticsDocument {
  eventType: 'user_action' | 'system_event' | 'performance_metric' | 'business_event' | 'error_event' | 'security_event' | 'api_call' | 'page_view' | 'feature_usage' | 'conversion_event';
  category: 'authentication' | 'navigation' | 'data_management' | 'communication' | 'reporting' | 'system_health' | 'user_engagement' | 'business_process';
  action: string;
  label?: string;
  value?: number;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  userContext: {
    userId?: string;
    userRole?: string;
    organizationId?: string;
    departmentId?: string;
    locationId?: string;
    timezone?: string;
    language?: string;
    isAuthenticated: boolean;
  };
  sessionInfo: {
    sessionId: string;
    userId?: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    pageViews: number;
    actions: number;
    deviceType: 'mobile' | 'tablet' | 'desktop';
    browser: string;
    os: string;
  };
  technicalDetails: {
    url?: string;
    referrer?: string;
    userAgent?: string;
    ipAddress?: string;
    method?: string;
    statusCode?: number;
    errorMessage?: string;
    stackTrace?: string;
    apiVersion?: string;
  };
  performanceMetrics?: {
    loadTime?: number;
    responseTime?: number;
    renderTime?: number;
    networkLatency?: number;
    databaseLatency?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    errorRate?: number;
  };
  businessContext?: {
    feature?: string;
    module?: string;
    workflow?: string;
    processId?: string;
    entityType?: string;
    entityId?: string;
    transactionId?: string;
    campaignId?: string;
  };
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    timezone?: string;
  };
  customProperties?: Record<string, any>;
  isProcessed: boolean;
  processingErrors?: string[];
  retentionDays: number;
}

// Analytics-specific schema fields (excluding base entity fields)
const analyticsFields = {
  eventType: {
    type: String,
    required: [true, 'Event type is required'],
    enum: {
      values: Object.values(AnalyticsEventType),
      message: 'Invalid event type'
    },
    index: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: Object.values(AnalyticsCategory),
      message: 'Invalid category'
    },
    index: true
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    trim: true,
    maxlength: [200, 'Action cannot exceed 200 characters'],
    index: true
  },
  label: {
    type: String,
    trim: true,
    maxlength: [200, 'Label cannot exceed 200 characters']
  },
  value: {
    type: Number,
    min: [0, 'Value cannot be negative']
  },
  userId: {
    type: String,
    trim: true,
    maxlength: [100, 'User ID cannot exceed 100 characters'],
    index: true
  },
  sessionId: {
    type: String,
    required: [true, 'Session ID is required'],
    trim: true,
    maxlength: [100, 'Session ID cannot exceed 100 characters'],
    index: true
  },
  timestamp: {
    type: Date,
    required: [true, 'Timestamp is required'],
    default: Date.now,
    index: true
  },
  userContext: {
    userId: {
      type: String,
      trim: true,
      maxlength: [100, 'User ID cannot exceed 100 characters']
    },
    userRole: {
      type: String,
      trim: true,
      maxlength: [50, 'User role cannot exceed 50 characters']
    },
    organizationId: {
      type: String,
      trim: true,
      maxlength: [100, 'Organization ID cannot exceed 100 characters']
    },
    departmentId: {
      type: String,
      trim: true,
      maxlength: [100, 'Department ID cannot exceed 100 characters']
    },
    locationId: {
      type: String,
      trim: true,
      maxlength: [100, 'Location ID cannot exceed 100 characters']
    },
    timezone: {
      type: String,
      trim: true,
      validate: {
        validator: function(v: string) {
          if (!v) return true;
          try {
            Intl.DateTimeFormat(undefined, { timeZone: v });
            return true;
          } catch (e) {
            return false;
          }
        },
        message: 'Invalid timezone'
      }
    },
    language: {
      type: String,
      trim: true,
      maxlength: [10, 'Language code cannot exceed 10 characters']
    },
    isAuthenticated: {
      type: Boolean,
      required: [true, 'Authentication status is required'],
      default: false
    }
  },
  sessionInfo: {
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
      trim: true,
      maxlength: [100, 'Session ID cannot exceed 100 characters']
    },
    userId: {
      type: String,
      trim: true,
      maxlength: [100, 'User ID cannot exceed 100 characters']
    },
    startTime: {
      type: Date,
      required: [true, 'Session start time is required']
    },
    endTime: { type: Date },
    duration: {
      type: Number,
      min: [0, 'Duration cannot be negative']
    },
    pageViews: {
      type: Number,
      default: 0,
      min: [0, 'Page views cannot be negative']
    },
    actions: {
      type: Number,
      default: 0,
      min: [0, 'Actions count cannot be negative']
    },
    deviceType: {
      type: String,
      required: [true, 'Device type is required'],
      enum: {
        values: ['mobile', 'tablet', 'desktop'],
        message: 'Invalid device type'
      }
    },
    browser: {
      type: String,
      required: [true, 'Browser is required'],
      trim: true,
      maxlength: [100, 'Browser name cannot exceed 100 characters']
    },
    os: {
      type: String,
      required: [true, 'OS is required'],
      trim: true,
      maxlength: [100, 'OS name cannot exceed 100 characters']
    }
  },
  technicalDetails: {
    url: {
      type: String,
      trim: true,
      maxlength: [2000, 'URL cannot exceed 2000 characters']
    },
    referrer: {
      type: String,
      trim: true,
      maxlength: [2000, 'Referrer cannot exceed 2000 characters']
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, 'User agent cannot exceed 500 characters']
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: [45, 'IP address cannot exceed 45 characters'],
      validate: {
        validator: function(v: string) {
          if (!v) return true;
          return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v) || /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(v);
        },
        message: 'Invalid IP address format'
      }
    },
    method: {
      type: String,
      trim: true,
      enum: {
        values: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
        message: 'Invalid HTTP method'
      }
    },
    statusCode: {
      type: Number,
      min: [100, 'Status code must be at least 100'],
      max: [599, 'Status code cannot exceed 599']
    },
    errorMessage: {
      type: String,
      trim: true,
      maxlength: [1000, 'Error message cannot exceed 1000 characters']
    },
    stackTrace: {
      type: String,
      trim: true,
      maxlength: [5000, 'Stack trace cannot exceed 5000 characters']
    },
    apiVersion: {
      type: String,
      trim: true,
      maxlength: [20, 'API version cannot exceed 20 characters']
    }
  },
  performanceMetrics: {
    loadTime: {
      type: Number,
      min: [0, 'Load time cannot be negative']
    },
    responseTime: {
      type: Number,
      min: [0, 'Response time cannot be negative']
    },
    renderTime: {
      type: Number,
      min: [0, 'Render time cannot be negative']
    },
    networkLatency: {
      type: Number,
      min: [0, 'Network latency cannot be negative']
    },
    databaseLatency: {
      type: Number,
      min: [0, 'Database latency cannot be negative']
    },
    memoryUsage: {
      type: Number,
      min: [0, 'Memory usage cannot be negative']
    },
    cpuUsage: {
      type: Number,
      min: [0, 'CPU usage cannot be negative'],
      max: [100, 'CPU usage cannot exceed 100%']
    },
    errorRate: {
      type: Number,
      min: [0, 'Error rate cannot be negative'],
      max: [100, 'Error rate cannot exceed 100%']
    }
  },
  businessContext: {
    feature: {
      type: String,
      trim: true,
      maxlength: [100, 'Feature name cannot exceed 100 characters']
    },
    module: {
      type: String,
      trim: true,
      maxlength: [100, 'Module name cannot exceed 100 characters']
    },
    workflow: {
      type: String,
      trim: true,
      maxlength: [100, 'Workflow name cannot exceed 100 characters']
    },
    processId: {
      type: String,
      trim: true,
      maxlength: [100, 'Process ID cannot exceed 100 characters']
    },
    entityType: {
      type: String,
      trim: true,
      maxlength: [50, 'Entity type cannot exceed 50 characters']
    },
    entityId: {
      type: String,
      trim: true,
      maxlength: [100, 'Entity ID cannot exceed 100 characters']
    },
    transactionId: {
      type: String,
      trim: true,
      maxlength: [100, 'Transaction ID cannot exceed 100 characters']
    },
    campaignId: {
      type: String,
      trim: true,
      maxlength: [100, 'Campaign ID cannot exceed 100 characters']
    }
  },
  geolocation: {
    country: {
      type: String,
      trim: true,
      maxlength: [100, 'Country name cannot exceed 100 characters']
    },
    region: {
      type: String,
      trim: true,
      maxlength: [100, 'Region name cannot exceed 100 characters']
    },
    city: {
      type: String,
      trim: true,
      maxlength: [100, 'City name cannot exceed 100 characters']
    },
    coordinates: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude must be between -90 and 90'],
        max: [90, 'Latitude must be between -90 and 90']
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude must be between -180 and 180'],
        max: [180, 'Longitude must be between -180 and 180']
      }
    },
    timezone: {
      type: String,
      trim: true,
      validate: {
        validator: function(v: string) {
          if (!v) return true;
          try {
            Intl.DateTimeFormat(undefined, { timeZone: v });
            return true;
          } catch (e) {
            return false;
          }
        },
        message: 'Invalid timezone'
      }
    }
  },
  customProperties: {
    type: Schema.Types.Mixed,
    default: {},
    validate: {
      validator: function(props: any) {
        return typeof props === 'object' && props !== null;
      },
      message: 'Custom properties must be a valid object'
    }
  },
  isProcessed: {
    type: Boolean,
    default: false,
    index: true
  },
  processingErrors: {
    type: [String],
    default: [],
    validate: {
      validator: function(errors: string[]) {
        return errors.length <= 10;
      },
      message: 'Cannot have more than 10 processing errors'
    }
  },
  retentionDays: {
    type: Number,
    default: 90,
    min: [1, 'Retention period must be at least 1 day'],
    max: [3653, 'Retention period cannot exceed 10 years']
  }
};

// Create Analytics schema using base entity pattern
const AnalyticsSchema = createBaseEntitySchema<Analytics>(analyticsFields, {
  collection: 'analytics',
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

// Additional indexes for performance
AnalyticsSchema.index({ timestamp: -1, eventType: 1 });
AnalyticsSchema.index({ userId: 1, timestamp: -1 });
AnalyticsSchema.index({ sessionId: 1, timestamp: 1 });
AnalyticsSchema.index({ category: 1, action: 1 });
AnalyticsSchema.index({ 'userContext.organizationId': 1, timestamp: -1 });
AnalyticsSchema.index({ 'businessContext.feature': 1, timestamp: -1 });
AnalyticsSchema.index({ 'geolocation.country': 1, timestamp: -1 });
AnalyticsSchema.index({ isProcessed: 1, timestamp: 1 });

// Compound indexes for common queries
AnalyticsSchema.index({ eventType: 1, category: 1, timestamp: -1 });
AnalyticsSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
AnalyticsSchema.index({ isActive: 1, isProcessed: 1, timestamp: -1 });

// TTL index for automatic data retention
AnalyticsSchema.index(
  { timestamp: 1 },
  {
    expireAfterSeconds: 90 * 24 * 60 * 60, // 90 days in seconds (default)
    partialFilterExpression: { retentionDays: { $lte: 90 } }
  }
);

// Virtual for age in days
AnalyticsSchema.virtual('ageInDays').get(function(this: Analytics) {
  return Math.floor((Date.now() - this.timestamp.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for session duration
AnalyticsSchema.virtual('sessionDuration').get(function(this: Analytics) {
  if (!this.sessionInfo.endTime) return null;
  return Math.floor((this.sessionInfo.endTime.getTime() - this.sessionInfo.startTime.getTime()) / (1000 * 60)); // minutes
});

// Method to mark as processed
AnalyticsSchema.methods.markAsProcessed = function(): void {
  this.isProcessed = true;
};

// Method to add processing error
AnalyticsSchema.methods.addProcessingError = function(error: string): void {
  if (!this.processingErrors) this.processingErrors = [];
  if (this.processingErrors.length < 10) {
    this.processingErrors.push(error);
  }
};

// Static method to find unprocessed events
AnalyticsSchema.statics.findUnprocessed = function(limit: number = 1000) {
  return this.find({
    isProcessed: false,
    isActive: true
  }).sort({ timestamp: 1 }).limit(limit);
};

// Static method to find by user and date range
AnalyticsSchema.statics.findByUserAndDateRange = function(userId: string, startDate: Date, endDate: Date) {
  return this.find({
    userId,
    timestamp: { $gte: startDate, $lte: endDate },
    isActive: true
  }).sort({ timestamp: -1 });
};

// Static method to find performance issues
AnalyticsSchema.statics.findPerformanceIssues = function(days: number = 7) {
  const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
  return this.find({
    eventType: 'performance_metric',
    timestamp: { $gte: since },
    $or: [
      { 'performanceMetrics.loadTime': { $gt: 3000 } },
      { 'performanceMetrics.responseTime': { $gt: 1000 } },
      { 'performanceMetrics.errorRate': { $gt: 5 } }
    ],
    isActive: true
  }).sort({ timestamp: -1 });
};

// Export the model with proper typing
export const AnalyticsModel = model<Analytics>('Analytics', AnalyticsSchema);

// Legacy interface for backward compatibility
export interface LegacyAnalyticsEvent {
  id: string;
  userId: string;
  eventType: string;
  payload: any;
  timestamp: Date;
}

export default AnalyticsModel;
