/**
 * Base Model Schema with Enhanced Entity Relationships
 * Provides foundational schemas and utilities for all FieldSync models
 * Comprehensive type-safe inheritance system with proper generic constraints
 */

import { Schema, model, Document, Types, CallbackWithoutResult, Model, HydratedDocument } from 'mongoose';
import { BaseEntity, BaseAuditableEntity, AuditEntry } from '../types/standardInterfaces';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';

// Advanced type system for proper inheritance
export interface BaseDocument extends Document {
  _id: Types.ObjectId;
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  version: number;
  isActive: boolean;
  metadata?: Record<string, any>;
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface BaseAuditableDocument extends BaseDocument {
  auditLog: Types.DocumentArray<AuditEntry>;
  lastAuditedAt?: Date;
  auditFrequency?: number;
  // Virtual properties
  auditLogCount: number;
}

// Generic type constraints for proper inheritance
export type BaseEntityType<T = {}> = BaseDocument & T;
export type BaseAuditableEntityType<T = {}> = BaseAuditableDocument & T;

// Enhanced Base Schema with comprehensive audit trails
export const BaseEntitySchema = new Schema<BaseDocument>({
  createdAt: { 
    type: Date, 
    default: Date.now,
    immutable: true,
    index: true
  },
  updatedAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  createdBy: { 
    type: String, 
    required: true,
    immutable: true,
    index: true,
    validate: {
      validator: function(v: string) {
        return v && v.trim().length > 0;
      },
      message: 'CreatedBy cannot be empty'
    }
  },
  updatedBy: { 
    type: String, 
    required: true,
    index: true,
    validate: {
      validator: function(v: string) {
        return v && v.trim().length > 0;
      },
      message: 'UpdatedBy cannot be empty'
    }
  },
  version: { 
    type: Number, 
    default: 1,
    min: [1, 'Version must be at least 1'],
    validate: {
      validator: Number.isInteger,
      message: 'Version must be an integer'
    }
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  metadata: { 
    type: Schema.Types.Mixed,
    default: () => ({}),
    validate: {
      validator: function(v: any) {
        return v === null || v === undefined || typeof v === 'object';
      },
      message: 'Metadata must be an object'
    }
  },
  tags: {
    type: [{ 
      type: String, 
      trim: true,
      maxlength: [50, 'Tag cannot exceed 50 characters'],
      validate: {
        validator: function(v: string) {
          return /^[a-zA-Z0-9-_]+$/.test(v);
        },
        message: 'Tags can only contain alphanumeric characters, hyphens, and underscores'
      }
    }],
    default: [],
    index: true,
    validate: {
      validator: function(arr: string[]) {
        return arr.length <= 20; // Maximum 20 tags
      },
      message: 'Cannot have more than 20 tags'
    }
  },
  customFields: {
    type: Schema.Types.Mixed,
    default: () => ({}),
    validate: {
      validator: function(v: any) {
        if (!v || typeof v !== 'object') return true;
        // Prevent deeply nested objects
        const checkDepth = (obj: any, depth = 0): boolean => {
          if (depth > 3) return false;
          for (const key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
              if (!checkDepth(obj[key], depth + 1)) return false;
            }
          }
          return true;
        };
        return checkDepth(v);
      },
      message: 'Custom fields cannot be nested more than 3 levels deep'
    }
  }
}, {
  timestamps: true,
  versionKey: false,
  strict: true,
  strictQuery: true,
  collection: 'baseEntities'
});

// Enhanced Audit Entry Schema with comprehensive validation
export const AuditEntrySchema = new Schema<AuditEntry>({
  id: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v: string) {
        return /^audit_\d+_[a-z0-9]{9}$/.test(v);
      },
      message: 'Invalid audit entry ID format'
    }
  },
  action: {
    type: String,
    enum: {
      values: ['create', 'update', 'delete', 'status_change', 'access', 'export', 'backup', 'restore'],
      message: 'Invalid action type'
    },
    required: [true, 'Action is required'],
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: [true, 'Timestamp is required'],
    index: true,
    validate: {
      validator: function(v: Date) {
        return v <= new Date(); // Cannot be in the future
      },
      message: 'Timestamp cannot be in the future'
    }
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        return v && v.length > 0;
      },
      message: 'User ID cannot be empty'
    }
  },
  userName: {
    type: String,
    required: [true, 'User name is required'],
    trim: true,
    maxlength: [100, 'User name cannot exceed 100 characters']
  },
  userRole: {
    type: String,
    required: [true, 'User role is required'],
    index: true,
    trim: true,
    enum: {
      values: ['Admin', 'Supervisor', 'FieldTech', 'Client', 'SiteStaff', 'System'],
      message: 'Invalid user role'
    }
  },
  ipAddress: {
    type: String,
    trim: true,
    validate: {
      validator: function(v: string) {
        if (!v) return true;
        // Enhanced IP validation (IPv4, IPv6, and local addresses)
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
        const localhostRegex = /^localhost$/i;
        return ipv4Regex.test(v) || ipv6Regex.test(v) || localhostRegex.test(v);
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
    type: Schema.Types.Mixed,
    required: [true, 'Changes are required'],
    validate: {
      validator: function(v: any) {
        if (!v || typeof v !== 'object') return false;
        // Ensure changes follow the expected format
        for (const key in v) {
          const change = v[key];
          if (!change || typeof change !== 'object' || 
              !change.hasOwnProperty('from') || !change.hasOwnProperty('to')) {
            return false;
          }
        }
        return true;
      },
      message: 'Changes must be an object with from/to structure for each field'
    }
  },
  reason: { 
    type: String,
    trim: true,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  severity: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high', 'critical'],
      message: 'Invalid severity level'
    },
    default: 'medium',
    index: true
  },
  category: {
    type: String,
    enum: {
      values: ['data', 'security', 'system', 'user', 'compliance'],
      message: 'Invalid category'
    },
    required: [true, 'Category is required'],
    index: true
  },
  correlationId: {
    type: String,
    index: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        if (!v) return true;
        return /^[a-zA-Z0-9-_]{8,64}$/.test(v);
      },
      message: 'Correlation ID must be 8-64 characters of alphanumeric, hyphens, or underscores'
    }
  }
}, {
  _id: false, // Embedded document, no separate _id
  strict: true
});

// Base Auditable Schema with enhanced inheritance
export const BaseAuditableEntitySchema = new Schema<BaseAuditableDocument>({
  // Inherit all base entity fields
  createdAt: { 
    type: Date, 
    default: Date.now,
    immutable: true,
    index: true
  },
  updatedAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  createdBy: { 
    type: String, 
    required: true,
    immutable: true,
    index: true
  },
  updatedBy: { 
    type: String, 
    required: true,
    index: true
  },
  version: { 
    type: Number, 
    default: 1,
    min: 1
  },
  isActive: { 
    type: Boolean, 
    default: true,
    index: true
  },
  metadata: { 
    type: Schema.Types.Mixed,
    default: () => ({})
  },
  tags: {
    type: [{ type: String, trim: true }],
    default: [],
    index: true
  },
  customFields: {
    type: Schema.Types.Mixed,
    default: () => ({})
  },
  // Auditable-specific fields
  auditLog: {
    type: [AuditEntrySchema],
    default: [],
    validate: {
      validator: function(arr: AuditEntry[]) {
        return arr.length <= 1000; // Prevent unbounded growth
      },
      message: 'Audit log cannot exceed 1000 entries'
    }
  },
  lastAuditedAt: {
    type: Date,
    index: true,
    validate: {
      validator: function(v: Date) {
        if (!v) return true;
        return v <= new Date(); // Cannot be in the future
      },
      message: 'Last audited date cannot be in the future'
    }
  },
  auditFrequency: {
    type: Number,
    default: 30, // days
    min: [1, 'Audit frequency must be at least 1 day'],
    max: [365, 'Audit frequency cannot exceed 365 days'],
    validate: {
      validator: Number.isInteger,
      message: 'Audit frequency must be an integer'
    }
  }
}, {
  timestamps: true,
  versionKey: false,
  strict: true,
  strictQuery: true,
  collection: 'baseAuditableEntities'
});

// Entity Relationship Schema with enhanced validation
export const EntityRelationshipSchema = new Schema({
  fromEntity: {
    type: { 
      id: { 
        type: String, 
        required: [true, 'From entity ID is required'],
        trim: true
      },
      type: { 
        type: String, 
        required: [true, 'From entity type is required'],
        trim: true,
        enum: {
          values: ['User', 'Ticket', 'Shift', 'Asset', 'Location', 'Team', 'Project'],
          message: 'Invalid from entity type'
        }
      }
    },
    required: [true, 'From entity is required'],
    index: true
  },
  toEntity: {
    type: {
      id: { 
        type: String, 
        required: [true, 'To entity ID is required'],
        trim: true
      },
      type: { 
        type: String, 
        required: [true, 'To entity type is required'],
        trim: true,
        enum: {
          values: ['User', 'Ticket', 'Shift', 'Asset', 'Location', 'Team', 'Project'],
          message: 'Invalid to entity type'
        }
      }
    },
    required: [true, 'To entity is required'],
    index: true
  },
  relationshipType: {
    type: String,
    enum: {
      values: [
        'parent_child',
        'one_to_one',
        'one_to_many',
        'many_to_many',
        'depends_on',
        'blocks',
        'related_to',
        'assigned_to',
        'belongs_to',
        'references',
        'linked_to'
      ],
      message: 'Invalid relationship type'
    },
    required: [true, 'Relationship type is required'],
    index: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: () => ({}),
    validate: {
      validator: function(v: any) {
        return v === null || v === undefined || typeof v === 'object';
      },
      message: 'Metadata must be an object'
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  strength: {
    type: Number,
    min: [0, 'Strength cannot be negative'],
    max: [1, 'Strength cannot exceed 1'],
    default: 0.5,
    validate: {
      validator: function(v: number) {
        return !isNaN(v) && isFinite(v);
      },
      message: 'Strength must be a valid number'
    }
  },
  createdBy: {
    type: String,
    required: [true, 'Created by is required'],
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
  strict: true
});

// Cross-Reference Schema for entity lookups with enhanced validation
export const CrossReferenceSchema = new Schema({
  entityId: {
    type: String,
    required: [true, 'Entity ID is required'],
    index: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        return v && v.length > 0;
      },
      message: 'Entity ID cannot be empty'
    }
  },
  entityType: {
    type: String,
    required: [true, 'Entity type is required'],
    index: true,
    trim: true,
    enum: {
      values: ['User', 'Ticket', 'Shift', 'Asset', 'Location', 'Team', 'Project'],
      message: 'Invalid entity type'
    }
  },
  externalId: {
    type: String,
    required: [true, 'External ID is required'],
    trim: true,
    validate: {
      validator: function(v: string) {
        return v && v.length > 0;
      },
      message: 'External ID cannot be empty'
    }
  },
  externalSystem: {
    type: String,
    required: [true, 'External system is required'],
    index: true,
    trim: true,
    enum: {
      values: ['salesforce', 'jira', 'sap', 'oracle', 'microsoft', 'google', 'slack', 'teams'],
      message: 'Invalid external system'
    }
  },
  syncStatus: {
    type: String,
    enum: {
      values: ['pending', 'synced', 'failed', 'conflict'],
      message: 'Invalid sync status'
    },
    default: 'pending',
    index: true
  },
  lastSync: {
    type: Date,
    index: true,
    validate: {
      validator: function(v: Date) {
        if (!v) return true;
        return v <= new Date(); // Cannot be in the future
      },
      message: 'Last sync date cannot be in the future'
    }
  },
  syncMetadata: {
    type: Schema.Types.Mixed,
    default: () => ({}),
    validate: {
      validator: function(v: any) {
        return v === null || v === undefined || typeof v === 'object';
      },
      message: 'Sync metadata must be an object'
    }
  }
}, {
  timestamps: true,
  versionKey: false,
  strict: true
});

// Add compound indexes for performance
EntityRelationshipSchema.index({ 'fromEntity.id': 1, 'fromEntity.type': 1 });
EntityRelationshipSchema.index({ 'toEntity.id': 1, 'toEntity.type': 1 });
EntityRelationshipSchema.index({ relationshipType: 1, isActive: 1 });

CrossReferenceSchema.index({ entityId: 1, entityType: 1 });
CrossReferenceSchema.index({ externalId: 1, externalSystem: 1 }, { unique: true });
CrossReferenceSchema.index({ syncStatus: 1, lastSync: -1 });

// Enhanced middleware for automatic audit trail creation
BaseAuditableEntitySchema.pre<BaseAuditableDocument>('save', function(next: CallbackWithoutResult) {
  const now = new Date();
  
  try {
    // Update timestamps
    this.updatedAt = now;
    
    // Increment version on updates
    if (!this.isNew) {
      this.version = (this.version || 1) + 1;
    }
    
    // Create audit entry for new documents
    if (this.isNew) {
      const auditEntry: AuditEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        action: 'create',
        timestamp: now,
        userId: this.createdBy || 'system',
        userName: 'System', // This should be populated from context
        userRole: 'System',
        changes: { entity: { from: null, to: 'created' } },
        severity: 'medium',
        category: 'data'
      };
      
      this.auditLog = this.auditLog || [];
      this.auditLog.push(auditEntry);
      this.lastAuditedAt = now;
    }
    
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Enhanced middleware for update audit trails with change detection
BaseAuditableEntitySchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function() {
  const update = this.getUpdate() as any;
  const now = new Date();
  
  try {
    // Ensure updatedAt is set
    if (!update.$set) update.$set = {};
    update.$set.updatedAt = now;
    update.$set.lastAuditedAt = now;
    
    // Increment version
    if (!update.$inc) update.$inc = {};
    update.$inc.version = 1;
    
    // Add audit entry for updates
    if (update.$set && Object.keys(update.$set).length > 2) { // More than just updatedAt and lastAuditedAt
      const auditEntry: AuditEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        action: 'update',
        timestamp: now,
        userId: update.$set.updatedBy || 'system',
        userName: 'System',
        userRole: 'System',
        changes: this.extractChanges(update),
        severity: 'low',
        category: 'data'
      };
      
      if (!update.$push) update.$push = {};
      update.$push.auditLog = {
        $each: [auditEntry],
        $slice: -1000 // Keep only last 1000 entries
      };
    }
  } catch (error) {
    console.error('Error in update middleware:', error);
  }
});

// Helper method to extract changes from update query
BaseAuditableEntitySchema.methods.extractChanges = function(update: any): Record<string, { from: any; to: any }> {
  const changes: Record<string, { from: any; to: any }> = {};
  
  if (update.$set) {
    for (const [key, value] of Object.entries(update.$set)) {
      if (key !== 'updatedAt' && key !== 'lastAuditedAt') {
        changes[key] = { from: null, to: value }; // We don't have the old value in this context
      }
    }
  }
  
  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) {
      changes[key] = { from: 'existed', to: null };
    }
  }
  
  return changes;
};

// Virtual for audit log count
BaseAuditableEntitySchema.virtual('auditLogCount').get(function(this: BaseAuditableDocument) {
  return this.auditLog ? this.auditLog.length : 0;
});

// Virtual for latest audit entry
BaseAuditableEntitySchema.virtual('latestAuditEntry').get(function(this: BaseAuditableDocument) {
  if (!this.auditLog || this.auditLog.length === 0) return null;
  return this.auditLog[this.auditLog.length - 1];
});

// Virtual for audit summary
BaseAuditableEntitySchema.virtual('auditSummary').get(function(this: BaseAuditableDocument) {
  if (!this.auditLog || this.auditLog.length === 0) {
    return { totalEntries: 0, actions: {}, lastAction: null };
  }
  
  const actions: Record<string, number> = {};
  for (const entry of this.auditLog) {
    actions[entry.action] = (actions[entry.action] || 0) + 1;
  }
  
  return {
    totalEntries: this.auditLog.length,
    actions,
    lastAction: this.auditLog[this.auditLog.length - 1]?.action || null
  };
});

// Ensure virtuals are included in JSON output
BaseEntitySchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc: any, ret: any) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

BaseEntitySchema.set('toObject', { 
  virtuals: true,
  transform: function(doc: any, ret: any) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

BaseAuditableEntitySchema.set('toJSON', { 
  virtuals: true,
  transform: function(doc: any, ret: any) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

BaseAuditableEntitySchema.set('toObject', { 
  virtuals: true,
  transform: function(doc: any, ret: any) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Models with proper typing
export const EntityRelationshipModel = model('EntityRelationship', EntityRelationshipSchema);
export const CrossReferenceModel = model('CrossReference', CrossReferenceSchema);

// Enhanced utility functions for entity relationships
export class EntityRelationshipManager {
  /**
   * Create a relationship between two entities with comprehensive validation
   */
  static async createRelationship(
    fromEntityId: string,
    fromEntityType: string,
    toEntityId: string,
    toEntityType: string,
    relationshipType: string,
    createdBy: string,
    metadata?: Record<string, any>,
    strength: number = 0.5
  ): Promise<Document> {
    try {
      // Validate input parameters
      if (!fromEntityId || !fromEntityType || !toEntityId || !toEntityType || !relationshipType || !createdBy) {
        throw new Error('Missing required parameters for relationship creation');
      }
      
      // Prevent self-referencing relationships of certain types
      if (fromEntityId === toEntityId && fromEntityType === toEntityType && 
          ['parent_child', 'depends_on', 'blocks'].includes(relationshipType)) {
        throw new Error('Self-referencing relationships not allowed for this type');
      }
      
      const relationship = new EntityRelationshipModel({
        fromEntity: { id: fromEntityId, type: fromEntityType },
        toEntity: { id: toEntityId, type: toEntityType },
        relationshipType,
        metadata: metadata || {},
        strength,
        createdBy
      });
      
      const saved = await relationship.save();
      
      monitoring.incrementCounter('entity_relationships_created_total', 1, {
        fromType: fromEntityType,
        toType: toEntityType,
        relationshipType
      });
      
      loggingService.info('Entity relationship created', {
        relationshipId: saved._id,
        fromEntity: `${fromEntityType}:${fromEntityId}`,
        toEntity: `${toEntityType}:${toEntityId}`,
        relationshipType
      });
      
      return saved;
    } catch (error) {
      loggingService.error('Failed to create entity relationship', error, {
        fromEntity: `${fromEntityType}:${fromEntityId}`,
        toEntity: `${toEntityType}:${toEntityId}`,
        relationshipType
      });
      throw error;
    }
  }
  
  /**
   * Get all relationships for an entity with filtering and pagination
   */
  static async getEntityRelationships(
    entityId: string,
    entityType: string,
    options?: {
      relationshipType?: string;
      direction?: 'from' | 'to' | 'both';
      isActive?: boolean;
      limit?: number;
      skip?: number;
    }
  ): Promise<Document[]> {
    try {
      if (!entityId || !entityType) {
        throw new Error('Entity ID and type are required');
      }
      
      const direction = options?.direction || 'both';
      let query: any = { isActive: options?.isActive !== false };
      
      // Build directional query
      if (direction === 'from') {
        query['fromEntity.id'] = entityId;
        query['fromEntity.type'] = entityType;
      } else if (direction === 'to') {
        query['toEntity.id'] = entityId;
        query['toEntity.type'] = entityType;
      } else {
        query.$or = [
          { 'fromEntity.id': entityId, 'fromEntity.type': entityType },
          { 'toEntity.id': entityId, 'toEntity.type': entityType }
        ];
      }
      
      if (options?.relationshipType) {
        query.relationshipType = options.relationshipType;
      }
      
      let queryBuilder = EntityRelationshipModel.find(query).lean();
      
      if (options?.skip) {
        queryBuilder = queryBuilder.skip(options.skip);
      }
      
      if (options?.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
      }
      
      return await queryBuilder.exec();
    } catch (error) {
      loggingService.error('Failed to get entity relationships', error, {
        entityId,
        entityType,
        options
      });
      throw error;
    }
  }
  
  /**
   * Remove a relationship (soft delete)
   */
  static async removeRelationship(relationshipId: string, removedBy?: string): Promise<boolean> {
    try {
      if (!relationshipId) {
        throw new Error('Relationship ID is required');
      }
      
      const result = await EntityRelationshipModel.findByIdAndUpdate(
        relationshipId,
        { 
          isActive: false,
          updatedAt: new Date(),
          ...(removedBy && { updatedBy: removedBy })
        },
        { new: true }
      ).exec();
      
      if (result) {
        monitoring.incrementCounter('entity_relationships_removed_total', 1);
        loggingService.info('Entity relationship removed', { relationshipId });
      }
      
      return !!result;
    } catch (error) {
      loggingService.error('Failed to remove entity relationship', error, {
        relationshipId
      });
      throw error;
    }
  }
  
  /**
   * Get relationship statistics for an entity
   */
  static async getRelationshipStats(entityId: string, entityType: string): Promise<Record<string, number>> {
    try {
      const pipeline = [
        {
          $match: {
            $or: [
              { 'fromEntity.id': entityId, 'fromEntity.type': entityType },
              { 'toEntity.id': entityId, 'toEntity.type': entityType }
            ],
            isActive: true
          }
        },
        {
          $group: {
            _id: '$relationshipType',
            count: { $sum: 1 }
          }
        }
      ];
      
      const results = await EntityRelationshipModel.aggregate(pipeline);
      const stats: Record<string, number> = {};
      
      for (const result of results) {
        stats[result._id] = result.count;
      }
      
      return stats;
    } catch (error) {
      loggingService.error('Failed to get relationship stats', error, {
        entityId,
        entityType
      });
      throw error;
    }
  }
}

// Enhanced utility functions for cross-references
export class CrossReferenceManager {
  /**
   * Create cross-reference for external system integration with validation
   */
  static async createCrossReference(
    entityId: string,
    entityType: string,
    externalId: string,
    externalSystem: string,
    syncMetadata?: Record<string, any>
  ): Promise<Document> {
    try {
      if (!entityId || !entityType || !externalId || !externalSystem) {
        throw new Error('All parameters are required for cross-reference creation');
      }
      
      // Check for existing cross-reference
      const existing = await CrossReferenceModel.findOne({
        externalId,
        externalSystem
      });
      
      if (existing) {
        throw new Error(`Cross-reference already exists for ${externalSystem}:${externalId}`);
      }
      
      const crossRef = new CrossReferenceModel({
        entityId,
        entityType,
        externalId,
        externalSystem,
        syncMetadata: syncMetadata || {}
      });
      
      const saved = await crossRef.save();
      
      loggingService.info('Cross-reference created', {
        crossRefId: saved._id,
        entityId,
        entityType,
        externalId,
        externalSystem
      });
      
      return saved;
    } catch (error) {
      loggingService.error('Failed to create cross-reference', error, {
        entityId,
        entityType,
        externalId,
        externalSystem
      });
      throw error;
    }
  }
  
  /**
   * Find entity by external reference with caching
   */
  static async findByExternalReference(
    externalId: string,
    externalSystem: string
  ): Promise<Document | null> {
    try {
      if (!externalId || !externalSystem) {
        throw new Error('External ID and system are required');
      }
      
      return await CrossReferenceModel.findOne({
        externalId,
        externalSystem
      }).lean().exec();
    } catch (error) {
      loggingService.error('Failed to find by external reference', error, {
        externalId,
        externalSystem
      });
      throw error;
    }
  }
  
  /**
   * Update sync status for a cross-reference
   */
  static async updateSyncStatus(
    externalId: string,
    externalSystem: string,
    status: 'pending' | 'synced' | 'failed' | 'conflict',
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const update: any = {
        syncStatus: status,
        lastSync: new Date()
      };
      
      if (metadata) {
        update.syncMetadata = metadata;
      }
      
      const result = await CrossReferenceModel.updateOne(
        { externalId, externalSystem },
        update
      ).exec();
      
      return result.modifiedCount > 0;
    } catch (error) {
      loggingService.error('Failed to update sync status', error, {
        externalId,
        externalSystem,
        status
      });
      throw error;
    }
  }
}

// Enhanced audit utilities with advanced features
export class AuditManager {
  /**
   * Add audit entry to entity with enhanced validation and monitoring
   */
  static async addAuditEntry(
    entityId: string,
    modelName: string,
    auditEntry: Omit<AuditEntry, 'id'>,
    options?: { skipValidation?: boolean }
  ): Promise<void> {
    try {
      if (!entityId || !modelName || !auditEntry) {
        throw new Error('Entity ID, model name, and audit entry are required');
      }
      
      const Model = model(modelName);
      const entry: AuditEntry = {
        ...auditEntry,
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      // Validate audit entry if not skipped
      if (!options?.skipValidation) {
        const validation = AuditEntrySchema.validate(entry);
        if (validation.error) {
          throw new Error(`Invalid audit entry: ${validation.error.message}`);
        }
      }
      
      await Model.findByIdAndUpdate(
        entityId,
        {
          $push: { 
            auditLog: {
              $each: [entry],
              $slice: -1000 // Keep only last 1000 entries
            }
          },
          $set: { lastAuditedAt: new Date() }
        },
        { new: true }
      ).exec();
      
      monitoring.incrementCounter('audit_entries_created_total', 1, {
        action: auditEntry.action,
        category: auditEntry.category,
        severity: auditEntry.severity,
        modelName
      });
      
      loggingService.debug('Audit entry added', {
        entityId,
        modelName,
        action: auditEntry.action,
        entryId: entry.id
      });
    } catch (error) {
      loggingService.error('Failed to add audit entry', error, {
        entityId,
        modelName,
        action: auditEntry.action
      });
      throw error;
    }
  }
  
  /**
   * Get audit trail for entity with advanced filtering and aggregation
   */
  static async getAuditTrail(
    entityId: string,
    modelName: string,
    options?: {
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      action?: string;
      category?: string;
      severity?: string;
      userId?: string;
      includeStats?: boolean;
    }
  ): Promise<{ entries: AuditEntry[]; stats?: any }> {
    try {
      if (!entityId || !modelName) {
        throw new Error('Entity ID and model name are required');
      }
      
      const Model = model(modelName);
      const entity = await Model.findById(entityId).select('auditLog').lean().exec();
      
      if (!entity || !entity.auditLog) {
        return { entries: [] };
      }
      
      let auditLog = entity.auditLog as AuditEntry[];
      
      // Apply filters
      if (options?.startDate || options?.endDate) {
        auditLog = auditLog.filter(entry => {
          const entryDate = new Date(entry.timestamp);
          if (options.startDate && entryDate < options.startDate) return false;
          if (options.endDate && entryDate > options.endDate) return false;
          return true;
        });
      }
      
      if (options?.action) {
        auditLog = auditLog.filter(entry => entry.action === options.action);
      }
      
      if (options?.category) {
        auditLog = auditLog.filter(entry => entry.category === options.category);
      }
      
      if (options?.severity) {
        auditLog = auditLog.filter(entry => entry.severity === options.severity);
      }
      
      if (options?.userId) {
        auditLog = auditLog.filter(entry => entry.userId === options.userId);
      }
      
      // Sort by timestamp (newest first)
      auditLog.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Generate statistics if requested
      let stats: any = undefined;
      if (options?.includeStats) {
        stats = this.generateAuditStats(auditLog);
      }
      
      // Apply limit
      if (options?.limit) {
        auditLog = auditLog.slice(0, options.limit);
      }
      
      return { entries: auditLog, stats };
    } catch (error) {
      loggingService.error('Failed to get audit trail', error, {
        entityId,
        modelName,
        options
      });
      throw error;
    }
  }
  
  /**
   * Generate audit statistics
   */
  private static generateAuditStats(auditLog: AuditEntry[]): any {
    const stats = {
      totalEntries: auditLog.length,
      actionCounts: {} as Record<string, number>,
      categoryCounts: {} as Record<string, number>,
      severityCounts: {} as Record<string, number>,
      userCounts: {} as Record<string, number>,
      timeRange: {
        earliest: null as Date | null,
        latest: null as Date | null
      }
    };
    
    for (const entry of auditLog) {
      // Count actions
      stats.actionCounts[entry.action] = (stats.actionCounts[entry.action] || 0) + 1;
      
      // Count categories
      stats.categoryCounts[entry.category] = (stats.categoryCounts[entry.category] || 0) + 1;
      
      // Count severities
      stats.severityCounts[entry.severity] = (stats.severityCounts[entry.severity] || 0) + 1;
      
      // Count users
      stats.userCounts[entry.userId] = (stats.userCounts[entry.userId] || 0) + 1;
      
      // Track time range
      const entryDate = new Date(entry.timestamp);
      if (!stats.timeRange.earliest || entryDate < stats.timeRange.earliest) {
        stats.timeRange.earliest = entryDate;
      }
      if (!stats.timeRange.latest || entryDate > stats.timeRange.latest) {
        stats.timeRange.latest = entryDate;
      }
    }
    
    return stats;
  }
  
  /**
   * Clean up old audit entries based on retention policy
   */
  static async cleanupOldAuditEntries(
    modelName: string,
    retentionDays: number = 365,
    batchSize: number = 100
  ): Promise<{ processedEntities: number; removedEntries: number }> {
    try {
      const Model = model(modelName);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      let processedEntities = 0;
      let removedEntries = 0;
      let hasMore = true;
      
      while (hasMore) {
        const entities = await Model.find({
          'auditLog.timestamp': { $lt: cutoffDate }
        })
        .select('auditLog')
        .limit(batchSize)
        .exec();
        
        if (entities.length === 0) {
          hasMore = false;
          break;
        }
        
        for (const entity of entities) {
          const originalCount = entity.auditLog.length;
          entity.auditLog = entity.auditLog.filter((entry: any) => 
            new Date(entry.timestamp) >= cutoffDate
          );
          
          const removedCount = originalCount - entity.auditLog.length;
          if (removedCount > 0) {
            await entity.save();
            removedEntries += removedCount;
          }
          
          processedEntities++;
        }
      }
      
      loggingService.info('Audit cleanup completed', {
        modelName,
        processedEntities,
        removedEntries,
        retentionDays
      });
      
      return { processedEntities, removedEntries };
    } catch (error) {
      loggingService.error('Failed to cleanup audit entries', error, {
        modelName,
        retentionDays
      });
      throw error;
    }
  }
}

// Factory functions for creating properly typed schemas
export function createBaseEntitySchema<T = {}>(
  additionalFields: Record<string, any> = {},
  options: Record<string, any> = {}
): Schema<BaseEntityType<T>> {
  const schema = new Schema<BaseEntityType<T>>({
    ...BaseEntitySchema.obj,
    ...additionalFields
  }, {
    timestamps: true,
    versionKey: false,
    strict: true,
    ...options
  });
  
  // Apply base middleware
  schema.pre('save', BaseEntitySchema.pre('save'));
  
  return schema;
}

export function createBaseAuditableEntitySchema<T = {}>(
  additionalFields: Record<string, any> = {},
  options: Record<string, any> = {}
): Schema<BaseAuditableEntityType<T>> {
  const schema = new Schema<BaseAuditableEntityType<T>>({
    ...BaseAuditableEntitySchema.obj,
    ...additionalFields
  }, {
    timestamps: true,
    versionKey: false,
    strict: true,
    ...options
  });
  
  // Apply base middleware
  schema.pre('save', BaseAuditableEntitySchema.pre('save'));
  schema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], BaseAuditableEntitySchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany']));
  
  // Apply virtuals
  schema.virtual('auditLogCount', BaseAuditableEntitySchema.virtual('auditLogCount'));
  schema.virtual('latestAuditEntry', BaseAuditableEntitySchema.virtual('latestAuditEntry'));
  schema.virtual('auditSummary', BaseAuditableEntitySchema.virtual('auditSummary'));
  
  return schema;
}

export default {
  BaseEntitySchema,
  BaseAuditableEntitySchema,
  AuditEntrySchema,
  EntityRelationshipSchema,
  CrossReferenceSchema,
  EntityRelationshipManager,
  CrossReferenceManager,
  AuditManager,
  createBaseEntitySchema,
  createBaseAuditableEntitySchema
};