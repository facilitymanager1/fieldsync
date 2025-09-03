/**
 * Enhanced Audit Service
 * Comprehensive audit trail service for all business entities
 */

import { Request } from 'express';
import { 
  AuditLogModel, 
  AuditEventType, 
  AuditSeverity, 
  AuditStatus,
  FieldChange,
  RequestMetadata,
  SystemContext,
  BusinessContext
} from '../models/auditLog';
import loggingService from './loggingService';
import { monitoring } from './monitoringService';
import { v4 as uuidv4 } from 'uuid';

// Audit Event Interface
export interface AuditEvent {
  eventType: AuditEventType;
  action: string;
  category: string;
  severity?: AuditSeverity;
  status?: AuditStatus;
  
  // Actor Information
  userId?: string;
  userEmail?: string;
  userRole?: string;
  sessionId?: string;
  
  // Target Entity
  entityType?: string;
  entityId?: string;
  entityName?: string;
  
  // Change Details
  changes?: FieldChange[];
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  
  // Event Details
  description: string;
  details?: Record<string, any>;
  metadata?: Record<string, any>;
  
  // Context
  business?: BusinessContext;
  
  // Error Information
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  
  // Additional
  tags?: string[];
  complianceFlags?: string[];
  sensitiveData?: boolean;
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
}

/**
 * Enhanced Audit Service Class
 */
export class AuditService {
  private correlationIdStore: Map<string, string> = new Map();
  
  /**
   * Create audit log entry
   */
  async createAuditLog(event: AuditEvent, req?: Request): Promise<void> {
    try {
      const timer = monitoring.startTimer('audit_log_creation_duration');
      
      // Generate correlation ID
      const correlationId = uuidv4();
      
      // Extract request metadata if available
      let requestMetadata: RequestMetadata | undefined;
      if (req) {
        requestMetadata = this.extractRequestMetadata(req);
      }
      
      // Get system context
      const systemContext = this.getSystemContext();
      
      // Create audit log entry
      const auditLog = new AuditLogModel({
        eventType: event.eventType,
        action: event.action,
        category: event.category,
        severity: event.severity || AuditSeverity.INFO,
        status: event.status || AuditStatus.SUCCESS,
        
        // Actor Information
        userId: event.userId,
        userEmail: event.userEmail,
        userRole: event.userRole,
        sessionId: event.sessionId || req?.sessionID,
        
        // Target Entity
        entityType: event.entityType,
        entityId: event.entityId,
        entityName: event.entityName,
        
        // Change Details
        changes: event.changes,
        oldValues: event.oldValues,
        newValues: event.newValues,
        
        // Context Information
        request: requestMetadata,
        system: systemContext,
        business: event.business,
        
        // Event Details
        description: event.description,
        details: event.details,
        metadata: event.metadata,
        
        // Error Information
        error: event.error,
        
        // Correlation
        correlationId,
        
        // Compliance and Security
        complianceFlags: event.complianceFlags || [],
        sensitiveData: event.sensitiveData || false,
        dataClassification: event.dataClassification || 'internal',
        
        // Additional Metadata
        tags: event.tags || [],
        source: req ? 'user' : 'system',
        
        // Geographic Information
        location: await this.extractLocation(req)
      });
      
      await auditLog.save();
      
      timer();
      monitoring.incrementCounter('audit_logs_created_total', 1, {
        eventType: event.eventType,
        category: event.category,
        severity: event.severity || 'info'
      });
      
      // Store correlation ID for potential follow-up events
      if (req?.sessionID) {
        this.correlationIdStore.set(req.sessionID, correlationId);
      }
      
      loggingService.debug('Audit log created', {
        correlationId,
        eventType: event.eventType,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId
      });
      
    } catch (error) {
      loggingService.error('Failed to create audit log', error, {
        event: {
          eventType: event.eventType,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId
        }
      });
      monitoring.incrementCounter('audit_log_creation_errors_total', 1);
      
      // Don't throw error to avoid breaking main functionality
    }
  }
  
  /**
   * Log user authentication events
   */
  async logAuthentication(
    action: 'login' | 'logout' | 'login_failed' | 'password_reset',
    userId: string,
    userEmail: string,
    req?: Request,
    details?: Record<string, any>
  ): Promise<void> {
    await this.createAuditLog({
      eventType: action === 'login' || action === 'logout' ? 
        (action === 'login' ? AuditEventType.LOGIN : AuditEventType.LOGOUT) :
        AuditEventType.SECURITY_EVENT,
      action,
      category: 'authentication',
      severity: action === 'login_failed' ? AuditSeverity.WARNING : AuditSeverity.INFO,
      status: action === 'login_failed' ? AuditStatus.FAILURE : AuditStatus.SUCCESS,
      userId,
      userEmail,
      description: `User ${action.replace('_', ' ')}`,
      details,
      tags: ['authentication', 'security'],
      complianceFlags: action === 'login_failed' ? ['failed_authentication'] : []
    }, req);
  }
  
  /**
   * Log data access events
   */
  async logDataAccess(
    entityType: string,
    entityId: string,
    action: 'view' | 'list' | 'search' | 'export',
    userId: string,
    req?: Request,
    details?: Record<string, any>
  ): Promise<void> {
    await this.createAuditLog({
      eventType: AuditEventType.READ,
      action: `${entityType}_${action}`,
      category: 'data_access',
      severity: AuditSeverity.INFO,
      userId,
      entityType,
      entityId,
      description: `User accessed ${entityType} data`,
      details,
      tags: ['data_access', entityType.toLowerCase()],
      sensitiveData: this.isSensitiveEntity(entityType)
    }, req);
  }
  
  /**
   * Log data modification events
   */
  async logDataModification(
    entityType: string,
    entityId: string,
    action: 'create' | 'update' | 'delete',
    userId: string,
    changes?: FieldChange[],
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    req?: Request,
    details?: Record<string, any>
  ): Promise<void> {
    let eventType: AuditEventType;
    switch (action) {
      case 'create':
        eventType = AuditEventType.CREATE;
        break;
      case 'update':
        eventType = AuditEventType.UPDATE;
        break;
      case 'delete':
        eventType = AuditEventType.DELETE;
        break;
    }
    
    await this.createAuditLog({
      eventType,
      action: `${entityType}_${action}`,
      category: 'data_modification',
      severity: action === 'delete' ? AuditSeverity.WARNING : AuditSeverity.INFO,
      userId,
      entityType,
      entityId,
      changes,
      oldValues,
      newValues,
      description: `User ${action}d ${entityType}`,
      details,
      tags: ['data_modification', entityType.toLowerCase()],
      complianceFlags: action === 'delete' ? ['data_deletion'] : [],
      sensitiveData: this.isSensitiveEntity(entityType)
    }, req);
  }
  
  /**
   * Log business events
   */
  async logBusinessEvent(
    action: string,
    category: string,
    userId: string,
    business?: BusinessContext,
    req?: Request,
    details?: Record<string, any>
  ): Promise<void> {
    await this.createAuditLog({
      eventType: AuditEventType.BUSINESS_EVENT,
      action,
      category,
      severity: AuditSeverity.INFO,
      userId,
      business,
      description: `Business event: ${action}`,
      details,
      tags: ['business_event', category]
    }, req);
  }
  
  /**
   * Log system events
   */
  async logSystemEvent(
    action: string,
    severity: AuditSeverity = AuditSeverity.INFO,
    description: string,
    details?: Record<string, any>,
    error?: { message: string; stack?: string; code?: string }
  ): Promise<void> {
    await this.createAuditLog({
      eventType: AuditEventType.SYSTEM_EVENT,
      action,
      category: 'system',
      severity,
      status: error ? AuditStatus.FAILURE : AuditStatus.SUCCESS,
      description,
      details,
      error,
      tags: ['system_event'],
      source: 'system'
    });
  }
  
  /**
   * Log security events
   */
  async logSecurityEvent(
    action: string,
    severity: AuditSeverity,
    userId?: string,
    req?: Request,
    details?: Record<string, any>
  ): Promise<void> {
    await this.createAuditLog({
      eventType: AuditEventType.SECURITY_EVENT,
      action,
      category: 'security',
      severity,
      status: severity === AuditSeverity.ERROR || severity === AuditSeverity.CRITICAL ? 
        AuditStatus.FAILURE : AuditStatus.SUCCESS,
      userId,
      description: `Security event: ${action}`,
      details,
      tags: ['security_event'],
      complianceFlags: ['security_incident'],
      dataClassification: 'confidential'
    }, req);
  }
  
  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(filters: {
    userId?: string;
    eventType?: AuditEventType;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    severity?: AuditSeverity;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    logs: any[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    try {
      const timer = monitoring.startTimer('audit_logs_query_duration');
      
      const query: any = {};
      
      if (filters.userId) query.userId = filters.userId;
      if (filters.eventType) query.eventType = filters.eventType;
      if (filters.entityType) query.entityType = filters.entityType;
      if (filters.entityId) query.entityId = filters.entityId;
      if (filters.severity) query.severity = filters.severity;
      if (filters.category) query.category = filters.category;
      
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = filters.startDate;
        if (filters.endDate) query.timestamp.$lte = filters.endDate;
      }
      
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 50, 100); // Max 100 per page
      const skip = (page - 1) * limit;
      
      const [logs, total] = await Promise.all([
        AuditLogModel
          .find(query)
          .populate('userId', 'email profile.firstName profile.lastName')
          .populate('impersonatedBy', 'email profile.firstName profile.lastName')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLogModel.countDocuments(query)
      ]);
      
      timer();
      monitoring.incrementCounter('audit_logs_queries_total', 1, {
        resultsCount: logs.length.toString()
      });
      
      return {
        logs,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      loggingService.error('Failed to query audit logs', error, { filters });
      monitoring.incrementCounter('audit_logs_query_errors_total', 1);
      throw error;
    }
  }
  
  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    complianceFlags?: string[]
  ): Promise<{
    summary: {
      totalEvents: number;
      complianceEvents: number;
      securityEvents: number;
      dataModifications: number;
      failedEvents: number;
    };
    flagBreakdown: Record<string, number>;
    severityBreakdown: Record<string, number>;
    userActivity: Array<{
      userId: string;
      userEmail: string;
      eventCount: number;
      lastActivity: Date;
    }>;
  }> {
    try {
      const query: any = {
        timestamp: { $gte: startDate, $lte: endDate }
      };
      
      if (complianceFlags && complianceFlags.length > 0) {
        query.complianceFlags = { $in: complianceFlags };
      }
      
      const [
        totalEvents,
        complianceEvents,
        securityEvents,
        dataModifications,
        failedEvents,
        flagBreakdown,
        severityBreakdown,
        userActivity
      ] = await Promise.all([
        AuditLogModel.countDocuments({ timestamp: { $gte: startDate, $lte: endDate } }),
        AuditLogModel.countDocuments({
          ...query,
          complianceFlags: { $exists: true, $ne: [] }
        }),
        AuditLogModel.countDocuments({
          timestamp: { $gte: startDate, $lte: endDate },
          eventType: AuditEventType.SECURITY_EVENT
        }),
        AuditLogModel.countDocuments({
          timestamp: { $gte: startDate, $lte: endDate },
          eventType: { $in: [AuditEventType.CREATE, AuditEventType.UPDATE, AuditEventType.DELETE] }
        }),
        AuditLogModel.countDocuments({
          timestamp: { $gte: startDate, $lte: endDate },
          status: AuditStatus.FAILURE
        }),
        
        // Flag breakdown aggregation
        AuditLogModel.aggregate([
          { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
          { $unwind: '$complianceFlags' },
          { $group: { _id: '$complianceFlags', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        
        // Severity breakdown aggregation
        AuditLogModel.aggregate([
          { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
          { $group: { _id: '$severity', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        
        // User activity aggregation
        AuditLogModel.aggregate([
          { 
            $match: { 
              timestamp: { $gte: startDate, $lte: endDate },
              userId: { $exists: true }
            }
          },
          {
            $group: {
              _id: '$userId',
              userEmail: { $first: '$userEmail' },
              eventCount: { $sum: 1 },
              lastActivity: { $max: '$timestamp' }
            }
          },
          { $sort: { eventCount: -1 } },
          { $limit: 50 }
        ])
      ]);
      
      return {
        summary: {
          totalEvents,
          complianceEvents,
          securityEvents,
          dataModifications,
          failedEvents
        },
        flagBreakdown: flagBreakdown.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        severityBreakdown: severityBreakdown.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        userActivity: userActivity.map((item: any) => ({
          userId: item._id,
          userEmail: item.userEmail,
          eventCount: item.eventCount,
          lastActivity: item.lastActivity
        }))
      };
    } catch (error) {
      loggingService.error('Failed to generate compliance report', error);
      throw error;
    }
  }
  
  // Private helper methods
  private extractRequestMetadata(req: Request): RequestMetadata {
    return {
      method: req.method,
      url: req.originalUrl || req.url,
      userAgent: req.get('User-Agent'),
      ipAddress: this.getClientIP(req),
      queryParams: Object.keys(req.query).length > 0 ? req.query : undefined
    };
  }
  
  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           '127.0.0.1';
  }
  
  private getSystemContext(): SystemContext {
    return {
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      serverId: process.env.SERVER_ID || 'unknown',
      processId: process.pid
    };
  }
  
  private async extractLocation(req?: Request): Promise<any> {
    // Basic geolocation based on IP (in production, use a proper service)
    return undefined; // Placeholder
  }
  
  private isSensitiveEntity(entityType: string): boolean {
    const sensitiveEntities = [
      'User', 'Staff', 'PayrollInfo', 'BankAccount', 
      'HealthRecord', 'PersonalInfo', 'AuthToken'
    ];
    return sensitiveEntities.includes(entityType);
  }
}

// Export singleton instance
export const auditService = new AuditService();
export default auditService;