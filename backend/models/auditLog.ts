/**
 * Enhanced Audit Log Model with MongoDB Integration
 * Comprehensive audit trail for all business entities and system activities
 */

import mongoose, { Schema, model } from 'mongoose';
import { AuditLogDocument } from '../types/modelTypes';
import { createBaseEntitySchema } from './baseModel';

// Audit Event Types
export enum AuditEventType {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  ACCESS_GRANTED = 'access_granted',
  ACCESS_DENIED = 'access_denied',
  SECURITY_EVENT = 'security_event',
  SYSTEM_EVENT = 'system_event',
  BUSINESS_EVENT = 'business_event',
  DATA_EXPORT = 'data_export',
  DATA_IMPORT = 'data_import',
  CONFIGURATION_CHANGE = 'configuration_change',
  WORKFLOW_TRANSITION = 'workflow_transition'
}

// Audit Event Severity
export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// Audit Event Status
export enum AuditStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  PENDING = 'pending'
}

// Changed Field Interface
export interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  dataType: string;
}

// Request Metadata Interface
export interface RequestMetadata {
  method: string;
  url: string;
  userAgent?: string;
  ipAddress?: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, any>;
  responseTime?: number;
  statusCode?: number;
}

// System Context Interface
export interface SystemContext {
  version: string;
  environment: string;
  serverId?: string;
  processId?: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

// Business Context Interface
export interface BusinessContext {
  workflowId?: string;
  processId?: string;
  shiftId?: mongoose.Types.ObjectId;
  ticketId?: mongoose.Types.ObjectId;
  siteId?: mongoose.Types.ObjectId;
  clientId?: mongoose.Types.ObjectId;
  contractId?: string;
  campaignId?: string;
}

// Enhanced AuditLog interface using proper inheritance
export interface AuditLog extends AuditLogDocument {
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'access' | 'export' | 'backup' | 'restore';
  userId: string;
  userName: string;
  userRole: string;
  ipAddress?: string;
  userAgent?: string;
  changes: Record<string, { from: any; to: any }>;
  reason?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'data' | 'security' | 'system' | 'user' | 'compliance';
  correlationId?: string;
  timestamp: Date;
  sessionId?: string;
  requestId?: string;
  geolocation?: {
    country: string;
    region: string;
    city: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  deviceInfo?: {
    type: 'mobile' | 'tablet' | 'desktop';
    os: string;
    browser: string;
    version: string;
  };
  compliance?: {
    regulation: string;
    requiresNotification: boolean;
    retentionPeriod: number;
    classification: 'public' | 'internal' | 'confidential' | 'restricted';
  };
}

// MongoDB Schema
const FieldChangeSchema = new Schema<FieldChange>({
  field: { type: String, required: true },
  oldValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  dataType: { type: String, required: true }
});

const RequestMetadataSchema = new Schema<RequestMetadata>({
  method: { type: String, required: true },
  url: { type: String, required: true },
  userAgent: { type: String },
  ipAddress: { type: String },
  headers: { type: Schema.Types.Mixed },
  queryParams: { type: Schema.Types.Mixed },
  responseTime: { type: Number },
  statusCode: { type: Number }
});

const SystemContextSchema = new Schema<SystemContext>({
  version: { type: String, required: true },
  environment: { type: String, required: true },
  serverId: { type: String },
  processId: { type: Number },
  memoryUsage: { type: Number },
  cpuUsage: { type: Number }
});

const BusinessContextSchema = new Schema<BusinessContext>({
  workflowId: { type: String },
  processId: { type: String },
  shiftId: { type: Schema.Types.ObjectId, ref: 'AdvancedShift' },
  ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket' },
  siteId: { type: Schema.Types.ObjectId, ref: 'Site' },
  clientId: { type: Schema.Types.ObjectId, ref: 'Client' },
  contractId: { type: String },
  campaignId: { type: String }
});

// AuditLog-specific schema fields (excluding base entity fields)
const auditLogFields = {
  entityType: {
    type: String,
    required: [true, 'Entity type is required'],
    trim: true,
    maxlength: [100, 'Entity type cannot exceed 100 characters'],
    index: true
  },
  entityId: {
    type: String,
    required: [true, 'Entity ID is required'],
    trim: true,
    maxlength: [100, 'Entity ID cannot exceed 100 characters'],
    index: true
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    enum: {
      values: ['create', 'update', 'delete', 'status_change', 'access', 'export', 'backup', 'restore'],
      message: 'Invalid action type'
    },
    index: true
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    trim: true,
    maxlength: [100, 'User ID cannot exceed 100 characters'],
    index: true
  },
  userName: {
    type: String,
    required: [true, 'User name is required'],
    trim: true,
    maxlength: [200, 'User name cannot exceed 200 characters'],
    index: true
  },
  userRole: {
    type: String,
    required: [true, 'User role is required'],
    trim: true,
    maxlength: [50, 'User role cannot exceed 50 characters'],
    index: true
  },
  ipAddress: {
    type: String,
    trim: true,
    maxlength: [45, 'IP address cannot exceed 45 characters'], // IPv6 max length
    validate: {
      validator: function(v: string) {
        if (!v) return true;
        // Basic IPv4 and IPv6 validation
        return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(v) || /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(v);
      },
      message: 'Invalid IP address format'
    }
  },
  userAgent: {
    type: String,
    trim: true,
    maxlength: [500, 'User agent cannot exceed 500 characters']
  },
  changes: {
    type: Map,
    of: {
      from: { type: Schema.Types.Mixed },
      to: { type: Schema.Types.Mixed }
    },
    default: new Map()
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [1000, 'Reason cannot exceed 1000 characters']
  },
  severity: {
    type: String,
    required: [true, 'Severity is required'],
    enum: {
      values: ['low', 'medium', 'high', 'critical'],
      message: 'Invalid severity level'
    },
    default: 'low',
    index: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['data', 'security', 'system', 'user', 'compliance'],
      message: 'Invalid category'
    },
    index: true
  },
  correlationId: {
    type: String,
    trim: true,
    maxlength: [100, 'Correlation ID cannot exceed 100 characters'],
    index: true
  },
  timestamp: {
    type: Date,
    required: [true, 'Timestamp is required'],
    default: Date.now,
    index: true
  },
  sessionId: {
    type: String,
    trim: true,
    maxlength: [100, 'Session ID cannot exceed 100 characters'],
    index: true
  },
  requestId: {
    type: String,
    trim: true,
    maxlength: [100, 'Request ID cannot exceed 100 characters']
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
    }
  },
  deviceInfo: {
    type: {
      type: String,
      enum: {
        values: ['mobile', 'tablet', 'desktop'],
        message: 'Invalid device type'
      }
    },
    os: {
      type: String,
      trim: true,
      maxlength: [100, 'OS name cannot exceed 100 characters']
    },
    browser: {
      type: String,
      trim: true,
      maxlength: [100, 'Browser name cannot exceed 100 characters']
    },
    version: {
      type: String,
      trim: true,
      maxlength: [50, 'Version cannot exceed 50 characters']
    }
  },
  compliance: {
    regulation: {
      type: String,
      trim: true,
      maxlength: [100, 'Regulation name cannot exceed 100 characters']
    },
    requiresNotification: {
      type: Boolean,
      default: false
    },
    retentionPeriod: {
      type: Number,
      min: [1, 'Retention period must be at least 1 day'],
      max: [3653, 'Retention period cannot exceed 10 years'],
      default: 2555 // 7 years
    },
    classification: {
      type: String,
      enum: {
        values: ['public', 'internal', 'confidential', 'restricted'],
        message: 'Invalid classification level'
      },
      default: 'internal'
    }
  }
};

// Create AuditLog schema using base entity pattern
const AuditLogSchema = createBaseEntitySchema<AuditLog>(auditLogFields, {
  collection: 'auditlogs',
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

// Additional indexes for performance and compliance queries
AuditLogSchema.index({ timestamp: -1, action: 1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
AuditLogSchema.index({ severity: 1, timestamp: -1 });
AuditLogSchema.index({ category: 1, timestamp: -1 });
AuditLogSchema.index({ correlationId: 1 });
AuditLogSchema.index({ sessionId: 1, timestamp: -1 });
AuditLogSchema.index({ 'compliance.regulation': 1 });
AuditLogSchema.index({ 'compliance.classification': 1 });
AuditLogSchema.index({ userName: 1, timestamp: -1 });
AuditLogSchema.index({ userRole: 1, timestamp: -1 });
AuditLogSchema.index({ ipAddress: 1, timestamp: -1 });

// Compound indexes for common queries
AuditLogSchema.index({ entityType: 1, action: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, category: 1, timestamp: -1 });
AuditLogSchema.index({ severity: 1, category: 1, timestamp: -1 });
AuditLogSchema.index({ isActive: 1, timestamp: -1, severity: 1 });

// TTL index for automatic data retention based on compliance requirements
AuditLogSchema.index(
  { timestamp: 1 },
  { 
    expireAfterSeconds: 2555 * 24 * 60 * 60, // 7 years in seconds (default)
    partialFilterExpression: { 'compliance.retentionPeriod': { $lte: 2555 } }
  }
);

// Virtual for age in days
AuditLogSchema.virtual('ageInDays').get(function(this: AuditLog) {
  return Math.floor((Date.now() - this.timestamp.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for retention status
AuditLogSchema.virtual('retentionStatus').get(function(this: AuditLog) {
  const ageInDays = this.ageInDays;
  const retentionPeriod = this.compliance?.retentionPeriod || 2555;
  
  if (ageInDays >= retentionPeriod) {
    return 'expired';
  } else if (ageInDays >= retentionPeriod * 0.9) {
    return 'expiring_soon';
  }
  return 'active';
});

// Virtual for severity display
AuditLogSchema.virtual('severityDisplay').get(function(this: AuditLog) {
  const severityMap: Record<string, string> = {
    'low': 'Low',
    'medium': 'Medium', 
    'high': 'High',
    'critical': 'Critical'
  };
  return severityMap[this.severity] || this.severity;
});

// Method to check if requires notification
AuditLogSchema.methods.requiresNotification = function(): boolean {
  return this.compliance?.requiresNotification || this.severity === 'critical';
};

// Method to get compliance summary
AuditLogSchema.methods.getComplianceSummary = function(): any {
  return {
    regulation: this.compliance?.regulation || 'General',
    classification: this.compliance?.classification || 'internal',
    retentionPeriod: this.compliance?.retentionPeriod || 2555,
    ageInDays: this.ageInDays,
    retentionStatus: this.retentionStatus,
    requiresNotification: this.requiresNotification()
  };
};

// Static method to find by entity
AuditLogSchema.statics.findByEntity = function(entityType: string, entityId: string) {
  return this.find({
    entityType,
    entityId,
    isActive: true
  }).sort({ timestamp: -1 });
};

// Static method to find critical events
AuditLogSchema.statics.findCriticalEvents = function(days: number = 7) {
  const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
  return this.find({
    severity: 'critical',
    timestamp: { $gte: since },
    isActive: true
  }).sort({ timestamp: -1 });
};

// Static method to find by user
AuditLogSchema.statics.findByUser = function(userId: string, limit: number = 100) {
  return this.find({
    userId,
    isActive: true
  }).sort({ timestamp: -1 }).limit(limit);
};

// Export the model with proper typing
export const AuditLogModel = model<AuditLog>('AuditLog', AuditLogSchema);

// Legacy interface for backward compatibility
export interface LegacyAuditLog {
  id: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  timestamp: Date;
  details?: any;
}

export default AuditLogModel;
