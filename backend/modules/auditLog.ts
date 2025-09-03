/**
 * Audit Log Module - MongoDB Integration
 * Functions to record and query audit logs with comprehensive tracking
 */

import { 
  AuditLogModel, 
  AuditLog, 
  LegacyAuditLog,
  AuditEventType,
  AuditSeverity,
  AuditStatus 
} from '../models/auditLog';
import mongoose from 'mongoose';

/**
 * Record an audit log entry with comprehensive metadata
 */
export async function recordAuditLog(
  logData: Omit<LegacyAuditLog, 'id' | 'timestamp'> & {
    eventType?: AuditEventType;
    severity?: AuditSeverity;
    status?: AuditStatus;
    category?: string;
    description?: string;
    correlationId?: string;
    sessionId?: string;
    userAgent?: string;
    ipAddress?: string;
    changes?: Array<{
      field: string;
      oldValue: any;
      newValue: any;
      dataType: string;
    }>;
  }
): Promise<AuditLog> {
  try {
    const auditEntry = new AuditLogModel({
      eventType: logData.eventType || AuditEventType.BUSINESS_EVENT,
      action: logData.action,
      category: logData.category || 'general',
      severity: logData.severity || AuditSeverity.INFO,
      status: logData.status || AuditStatus.SUCCESS,
      description: logData.description || `${logData.action} performed on ${logData.entityType || 'entity'}`,
      
      // Actor information
      userId: logData.userId ? new mongoose.Types.ObjectId(logData.userId) : undefined,
      sessionId: logData.sessionId,
      
      // Target entity
      entityType: logData.entityType,
      entityId: logData.entityId,
      
      // Change tracking
      changes: logData.changes,
      details: logData.details,
      
      // Request context
      request: {
        method: 'POST',
        url: '/api/audit',
        userAgent: logData.userAgent,
        ipAddress: logData.ipAddress
      },
      
      // System context
      system: {
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        processId: process.pid
      },
      
      // Metadata
      correlationId: logData.correlationId,
      timestamp: new Date(),
      complianceFlags: [],
      sensitiveData: false,
      dataClassification: 'internal' as const,
      retentionPeriod: 2555, // 7 years
      tags: [logData.entityType || 'general'],
      source: 'system' as const
    });

    const savedEntry = await auditEntry.save();
    console.log(`✅ Audit log recorded: ${savedEntry.action} on ${savedEntry.entityType}`);
    
    return savedEntry;
  } catch (error) {
    console.error('❌ Failed to record audit log:', error);
    throw new Error(`Failed to record audit log: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieve audit logs with filtering and pagination
 */
export async function getAuditLogs(filter?: {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: AuditSeverity;
  status?: AuditStatus;
  limit?: number;
  offset?: number;
}): Promise<{
  logs: AuditLog[];
  total: number;
  hasMore: boolean;
}> {
  try {
    const query: any = {};

    // Build MongoDB query from filters
    if (filter?.userId) {
      query.userId = new mongoose.Types.ObjectId(filter.userId);
    }
    if (filter?.action) {
      query.action = { $regex: filter.action, $options: 'i' };
    }
    if (filter?.entityType) {
      query.entityType = filter.entityType;
    }
    if (filter?.entityId) {
      query.entityId = filter.entityId;
    }
    if (filter?.severity) {
      query.severity = filter.severity;
    }
    if (filter?.status) {
      query.status = filter.status;
    }
    if (filter?.startDate || filter?.endDate) {
      query.timestamp = {};
      if (filter.startDate) {
        query.timestamp.$gte = filter.startDate;
      }
      if (filter.endDate) {
        query.timestamp.$lte = filter.endDate;
      }
    }

    const limit = filter?.limit || 50;
    const offset = filter?.offset || 0;

    // Execute query with pagination
    const [logs, total] = await Promise.all([
      AuditLogModel
        .find(query)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit)
        .populate('userId', 'email firstName lastName role')
        .exec(),
      AuditLogModel.countDocuments(query)
    ]);

    return {
      logs,
      total,
      hasMore: offset + logs.length < total
    };
  } catch (error) {
    console.error('❌ Failed to retrieve audit logs:', error);
    throw new Error(`Failed to retrieve audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get audit statistics for reporting
 */
export async function getAuditStatistics(filter?: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  totalLogs: number;
  logsByEventType: Array<{ eventType: string; count: number }>;
  logsBySeverity: Array<{ severity: string; count: number }>;
  logsByStatus: Array<{ status: string; count: number }>;
  recentActivity: AuditLog[];
}> {
  try {
    const query: any = {};
    
    if (filter?.userId) {
      query.userId = new mongoose.Types.ObjectId(filter.userId);
    }
    if (filter?.startDate || filter?.endDate) {
      query.timestamp = {};
      if (filter.startDate) {
        query.timestamp.$gte = filter.startDate;
      }
      if (filter.endDate) {
        query.timestamp.$lte = filter.endDate;
      }
    }

    const [
      totalLogs,
      logsByEventType,
      logsBySeverity,
      logsByStatus,
      recentActivity
    ] = await Promise.all([
      AuditLogModel.countDocuments(query),
      AuditLogModel.aggregate([
        { $match: query },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
        { $project: { eventType: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } }
      ]),
      AuditLogModel.aggregate([
        { $match: query },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $project: { severity: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } }
      ]),
      AuditLogModel.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { status: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } }
      ]),
      AuditLogModel
        .find(query)
        .sort({ timestamp: -1 })
        .limit(10)
        .populate('userId', 'email firstName lastName')
        .exec()
    ]);

    return {
      totalLogs,
      logsByEventType,
      logsBySeverity,
      logsByStatus,
      recentActivity
    };
  } catch (error) {
    console.error('❌ Failed to get audit statistics:', error);
    throw new Error(`Failed to get audit statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clean up expired audit logs (based on retention policy)
 */
export async function cleanupExpiredLogs(): Promise<{
  deletedCount: number;
  message: string;
}> {
  try {
    // MongoDB TTL index should handle this automatically, but we can also do manual cleanup
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 2555); // 7 years ago

    const result = await AuditLogModel.deleteMany({
      timestamp: { $lt: cutoffDate },
      retentionPeriod: { $lte: 2555 }
    });

    const message = `Cleaned up ${result.deletedCount} expired audit logs older than 7 years`;
    console.log(`🧹 ${message}`);

    return {
      deletedCount: result.deletedCount || 0,
      message
    };
  } catch (error) {
    console.error('❌ Failed to cleanup expired logs:', error);
    throw new Error(`Failed to cleanup expired logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Legacy compatibility function for backward compatibility
export function recordAuditLogLegacy(log: Omit<LegacyAuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
  return recordAuditLog({
    ...log,
    description: `Legacy audit log: ${log.action}`
  });
}

export default {
  recordAuditLog,
  getAuditLogs,
  getAuditStatistics,
  cleanupExpiredLogs,
  recordAuditLogLegacy
};
