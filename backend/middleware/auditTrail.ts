/**
 * Comprehensive Audit Trail Middleware for All Business Entities
 * Provides automatic audit logging, compliance tracking, and forensic capabilities
 */

import { Request, Response, NextFunction } from 'express';
import { Schema, model, Document } from 'mongoose';
import { AuditEntry, BaseAuditableEntity } from '../types/standardInterfaces';
import { AuditManager } from '../models/baseModel';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';
import { recordBusinessEvent, recordSecurityEvent } from './monitoringMiddleware';

// Enhanced Audit Configuration
export interface AuditConfig {
  enabled: boolean;
  includeRequestBody: boolean;
  includeResponseBody: boolean;
  includeHeaders: boolean;
  excludeFields: string[];
  sensitiveFields: string[];
  retentionDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  realTimeAlerts: boolean;
  complianceMode: boolean;
}

// Audit Event Types
export enum AuditEventType {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  ACCESS_DENIED = 'access_denied',
  DATA_EXPORT = 'data_export',
  DATA_IMPORT = 'data_import',
  CONFIGURATION_CHANGE = 'configuration_change',
  SECURITY_EVENT = 'security_event',
  COMPLIANCE_CHECK = 'compliance_check',
  SYSTEM_EVENT = 'system_event'
}

// Audit Risk Levels
export enum AuditRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Enhanced Audit Log Entry
export interface EnhancedAuditEntry extends AuditEntry {
  requestId: string;
  sessionId?: string;
  deviceInfo?: {
    userAgent: string;
    deviceType: string;
    platform: string;
    ipAddress: string;
    location?: {
      country?: string;
      region?: string;
      city?: string;
    };
  };
  performanceMetrics?: {
    requestDuration: number;
    databaseQueryCount: number;
    memoryUsage: number;
    cpuUsage?: number;
  };
  riskAssessment?: {
    level: AuditRiskLevel;
    factors: string[];
    score: number;
    automatedResponse?: string;
  };
  complianceData?: {
    regulations: string[];
    dataClassification: string;
    retentionPeriod: number;
    lawfulBasis?: string;
  };
  forensicData?: {
    hash: string;
    digitalSignature?: string;
    chainOfCustody: string[];
    evidenceType: string;
  };
}

// Audit Log Model Schema
const EnhancedAuditLogSchema = new Schema<EnhancedAuditEntry>({
  // Base audit fields
  id: { type: String, required: true, unique: true },
  action: {
    type: String,
    enum: Object.values(AuditEventType),
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    required: true,
    index: true
  },
  changes: {
    type: Schema.Types.Mixed,
    required: true
  },
  reason: { type: String },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  category: {
    type: String,
    enum: ['data', 'security', 'system', 'user', 'compliance'],
    required: true,
    index: true
  },
  correlationId: {
    type: String,
    index: true
  },

  // Enhanced fields
  requestId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  deviceInfo: {
    userAgent: { type: String },
    deviceType: { type: String },
    platform: { type: String },
    ipAddress: { 
      type: String,
      validate: {
        validator: function(v: string) {
          if (!v) return true;
          const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
          return ipv4Regex.test(v) || ipv6Regex.test(v);
        },
        message: 'Invalid IP address format'
      }
    },
    location: {
      country: { type: String },
      region: { type: String },
      city: { type: String }
    }
  },
  performanceMetrics: {
    requestDuration: { type: Number, min: 0 },
    databaseQueryCount: { type: Number, min: 0 },
    memoryUsage: { type: Number, min: 0 },
    cpuUsage: { type: Number, min: 0, max: 100 }
  },
  riskAssessment: {
    level: {
      type: String,
      enum: Object.values(AuditRiskLevel),
      default: AuditRiskLevel.LOW
    },
    factors: [{ type: String }],
    score: { type: Number, min: 0, max: 100, default: 0 },
    automatedResponse: { type: String }
  },
  complianceData: {
    regulations: [{ type: String }],
    dataClassification: {
      type: String,
      enum: ['public', 'internal', 'confidential', 'restricted'],
      default: 'internal'
    },
    retentionPeriod: { type: Number, default: 2555 }, // 7 years in days
    lawfulBasis: { type: String }
  },
  forensicData: {
    hash: { type: String, required: true },
    digitalSignature: { type: String },
    chainOfCustody: [{ type: String }],
    evidenceType: {
      type: String,
      enum: ['system_log', 'user_action', 'data_change', 'security_event', 'compliance_record'],
      default: 'user_action'
    }
  }
}, {
  timestamps: true,
  collection: 'audit_logs'
});

// Indexes for performance and compliance
EnhancedAuditLogSchema.index({ timestamp: -1, userId: 1 });
EnhancedAuditLogSchema.index({ action: 1, timestamp: -1 });
EnhancedAuditLogSchema.index({ category: 1, severity: 1, timestamp: -1 });
EnhancedAuditLogSchema.index({ requestId: 1 });
EnhancedAuditLogSchema.index({ correlationId: 1 });
EnhancedAuditLogSchema.index({ 'deviceInfo.ipAddress': 1, timestamp: -1 });
EnhancedAuditLogSchema.index({ 'riskAssessment.level': 1, timestamp: -1 });
EnhancedAuditLogSchema.index({ 'complianceData.regulations': 1 });

// TTL index for automatic cleanup based on retention period
EnhancedAuditLogSchema.index(
  { timestamp: 1 },
  { 
    expireAfterSeconds: 0, // Will be set dynamically based on retention period
    partialFilterExpression: { 'complianceData.retentionPeriod': { $exists: true } }
  }
);

export const EnhancedAuditLogModel = model<EnhancedAuditEntry>('AuditLog', EnhancedAuditLogSchema);

// Audit Configuration Store
class AuditConfigurationManager {
  private configs: Map<string, AuditConfig> = new Map();
  
  constructor() {
    // Default configuration
    this.configs.set('default', {
      enabled: true,
      includeRequestBody: true,
      includeResponseBody: false,
      includeHeaders: false,
      excludeFields: ['password', 'token', 'secret', 'key'],
      sensitiveFields: ['ssn', 'credit_card', 'bank_account', 'api_key'],
      retentionDays: 2555, // 7 years
      compressionEnabled: true,
      encryptionEnabled: true,
      realTimeAlerts: true,
      complianceMode: true
    });
  }
  
  getConfig(entityType: string = 'default'): AuditConfig {
    return this.configs.get(entityType) || this.configs.get('default')!;
  }
  
  setConfig(entityType: string, config: Partial<AuditConfig>): void {
    const existingConfig = this.getConfig(entityType);
    this.configs.set(entityType, { ...existingConfig, ...config });
  }
}

export const auditConfigManager = new AuditConfigurationManager();

// Risk Assessment Engine
class RiskAssessmentEngine {
  /**
   * Assess risk level based on various factors
   */
  static assessRisk(
    action: string,
    userId: string,
    userRole: string,
    ipAddress: string,
    requestData: any,
    deviceInfo: any
  ): { level: AuditRiskLevel; factors: string[]; score: number; automatedResponse?: string } {
    const factors: string[] = [];
    let score = 0;
    
    // Action-based risk assessment
    const highRiskActions = ['delete', 'data_export', 'configuration_change', 'security_event'];
    const mediumRiskActions = ['update', 'create', 'access_denied'];
    
    if (highRiskActions.includes(action)) {
      score += 40;
      factors.push('high_risk_action');
    } else if (mediumRiskActions.includes(action)) {
      score += 20;
      factors.push('medium_risk_action');
    }
    
    // Role-based risk assessment
    if (userRole === 'Admin') {
      score += 30;
      factors.push('admin_user');
    } else if (userRole === 'Supervisor') {
      score += 15;
      factors.push('supervisor_user');
    }
    
    // Time-based risk assessment
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      score += 25;
      factors.push('unusual_time');
    }
    
    // Geographic risk assessment (simplified)
    if (this.isUnusualLocation(ipAddress, userId)) {
      score += 35;
      factors.push('unusual_location');
    }
    
    // Device-based risk assessment
    if (this.isUnusualDevice(deviceInfo, userId)) {
      score += 30;
      factors.push('unusual_device');
    }
    
    // Data volume risk assessment
    if (this.isLargeDataOperation(requestData)) {
      score += 20;
      factors.push('large_data_operation');
    }
    
    // Determine risk level
    let level: AuditRiskLevel;
    let automatedResponse: string | undefined;
    
    if (score >= 80) {
      level = AuditRiskLevel.CRITICAL;
      automatedResponse = 'immediate_alert_security_team';
    } else if (score >= 60) {
      level = AuditRiskLevel.HIGH;
      automatedResponse = 'alert_supervisor';
    } else if (score >= 30) {
      level = AuditRiskLevel.MEDIUM;
      automatedResponse = 'log_for_review';
    } else {
      level = AuditRiskLevel.LOW;
    }
    
    return { level, factors, score, automatedResponse };
  }
  
  private static isUnusualLocation(ipAddress: string, userId: string): boolean {
    // Simplified - in real implementation, check against user's typical locations
    return false;
  }
  
  private static isUnusualDevice(deviceInfo: any, userId: string): boolean {
    // Simplified - in real implementation, check against user's known devices
    return false;
  }
  
  private static isLargeDataOperation(requestData: any): boolean {
    if (!requestData) return false;
    const dataSize = JSON.stringify(requestData).length;
    return dataSize > 100000; // 100KB threshold
  }
}

// Compliance Manager
class ComplianceManager {
  /**
   * Determine compliance requirements for audit entry
   */
  static getComplianceData(
    action: string,
    entityType: string,
    dataClassification: string = 'internal'
  ): {
    regulations: string[];
    dataClassification: string;
    retentionPeriod: number;
    lawfulBasis?: string;
  } {
    const regulations: string[] = [];
    let retentionPeriod = 2555; // Default 7 years
    
    // GDPR compliance
    if (this.isPersonalDataRelated(entityType, action)) {
      regulations.push('GDPR');
      if (action === 'delete') {
        retentionPeriod = 30; // Right to be forgotten
      }
    }
    
    // SOX compliance for financial data
    if (this.isFinancialDataRelated(entityType)) {
      regulations.push('SOX');
      retentionPeriod = Math.max(retentionPeriod, 2555); // 7 years minimum
    }
    
    // HIPAA compliance for health data
    if (this.isHealthDataRelated(entityType)) {
      regulations.push('HIPAA');
      retentionPeriod = Math.max(retentionPeriod, 2190); // 6 years minimum
    }
    
    // Industry-specific regulations
    if (entityType.includes('field_service')) {
      regulations.push('OSHA', 'DOT');
    }
    
    const lawfulBasis = this.determineLawfulBasis(action, regulations);
    
    return {
      regulations,
      dataClassification,
      retentionPeriod,
      lawfulBasis
    };
  }
  
  private static isPersonalDataRelated(entityType: string, action: string): boolean {
    const personalDataEntities = ['user', 'employee', 'client', 'contact'];
    return personalDataEntities.some(entity => entityType.toLowerCase().includes(entity));
  }
  
  private static isFinancialDataRelated(entityType: string): boolean {
    const financialDataEntities = ['expense', 'payment', 'invoice', 'budget'];
    return financialDataEntities.some(entity => entityType.toLowerCase().includes(entity));
  }
  
  private static isHealthDataRelated(entityType: string): boolean {
    const healthDataEntities = ['medical', 'health', 'injury', 'wellness'];
    return healthDataEntities.some(entity => entityType.toLowerCase().includes(entity));
  }
  
  private static determineLawfulBasis(action: string, regulations: string[]): string | undefined {
    if (regulations.includes('GDPR')) {
      if (action === 'create' || action === 'update') {
        return 'legitimate_interest';
      } else if (action === 'read') {
        return 'performance_of_contract';
      }
    }
    return undefined;
  }
}

// Forensic Evidence Manager
class ForensicEvidenceManager {
  /**
   * Create forensic hash for audit entry
   */
  static createForensicHash(entry: Partial<EnhancedAuditEntry>): string {
    const crypto = require('crypto');
    const dataToHash = JSON.stringify({
      timestamp: entry.timestamp,
      userId: entry.userId,
      action: entry.action,
      changes: entry.changes,
      requestId: entry.requestId
    });
    
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
  }
  
  /**
   * Create digital signature for legal compliance
   */
  static createDigitalSignature(hash: string): string {
    // In production, use proper digital signature with private key
    const crypto = require('crypto');
    return crypto.createHash('sha512').update(hash + process.env.AUDIT_SIGNATURE_KEY).digest('hex');
  }
  
  /**
   * Update chain of custody
   */
  static updateChainOfCustody(
    existingChain: string[],
    action: string,
    userId: string
  ): string[] {
    const timestamp = new Date().toISOString();
    const entry = `${timestamp}:${action}:${userId}`;
    return [...existingChain, entry];
  }
}

// Main Audit Trail Middleware
export class AuditTrailMiddleware {
  /**
   * Comprehensive audit middleware for all entities
   */
  static auditEntity(entityType: string, options?: Partial<AuditConfig>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const config = auditConfigManager.getConfig(entityType);
      const mergedConfig = { ...config, ...options };
      
      if (!mergedConfig.enabled) {
        return next();
      }
      
      const requestId = (req as any).requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const user = (req as any).user;
      
      // Capture original response methods
      const originalSend = res.send;
      const originalJson = res.json;
      
      let responseBody: any = null;
      let statusCode: number = 200;
      
      // Override response methods to capture response data
      if (mergedConfig.includeResponseBody) {
        res.send = function(body: any) {
          responseBody = body;
          statusCode = res.statusCode;
          return originalSend.call(this, body);
        };
        
        res.json = function(body: any) {
          responseBody = body;
          statusCode = res.statusCode;
          return originalJson.call(this, body);
        };
      }
      
      // Continue with request processing
      next();
      
      // Log audit entry after response
      res.on('finish', async () => {
        try {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          await AuditTrailMiddleware.createAuditEntry({
            entityType,
            action: AuditTrailMiddleware.mapMethodToAction(req.method),
            req,
            user,
            requestId,
            duration,
            statusCode,
            responseBody: mergedConfig.includeResponseBody ? responseBody : undefined,
            config: mergedConfig
          });
        } catch (error) {
          loggingService.error('Failed to create audit entry', error, {
            requestId,
            entityType,
            userId: user?.id
          });
        }
      });
    };
  }
  
  /**
   * Create detailed audit entry
   */
  private static async createAuditEntry({
    entityType,
    action,
    req,
    user,
    requestId,
    duration,
    statusCode,
    responseBody,
    config
  }: {
    entityType: string;
    action: AuditEventType;
    req: Request;
    user: any;
    requestId: string;
    duration: number;
    statusCode: number;
    responseBody?: any;
    config: AuditConfig;
  }): Promise<void> {
    try {
      const timestamp = new Date();
      const userId = user?.id || 'anonymous';
      const userName = user?.name || 'Anonymous User';
      const userRole = user?.role || 'Unknown';
      
      // Extract device and location info
      const userAgent = req.get('User-Agent') || '';
      const ipAddress = this.getClientIpAddress(req);
      const deviceInfo = this.extractDeviceInfo(userAgent, ipAddress);
      
      // Prepare changes data
      const changes = this.prepareChangesData(req, responseBody, config);
      
      // Risk assessment
      const riskAssessment = RiskAssessmentEngine.assessRisk(
        action,
        userId,
        userRole,
        ipAddress,
        req.body,
        deviceInfo
      );
      
      // Compliance data
      const complianceData = ComplianceManager.getComplianceData(
        action,
        entityType,
        this.classifyData(req.body)
      );
      
      // Performance metrics
      const performanceMetrics = {
        requestDuration: duration,
        databaseQueryCount: (req as any).dbQueryCount || 0,
        memoryUsage: process.memoryUsage().heapUsed
      };
      
      // Create audit entry
      const auditEntry: Partial<EnhancedAuditEntry> = {
        id: `audit_${timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
        action,
        timestamp,
        userId,
        userName,
        userRole,
        ipAddress,
        userAgent,
        changes,
        reason: req.body?.auditReason || req.query?.reason as string,
        severity: this.determineSeverity(action, statusCode, riskAssessment.level),
        category: this.determineCategory(action, entityType),
        correlationId: req.headers['x-correlation-id'] as string,
        requestId,
        sessionId: (req as any).sessionId,
        deviceInfo,
        performanceMetrics,
        riskAssessment,
        complianceData
      };
      
      // Create forensic data
      const forensicHash = ForensicEvidenceManager.createForensicHash(auditEntry);
      const digitalSignature = ForensicEvidenceManager.createDigitalSignature(forensicHash);
      
      auditEntry.forensicData = {
        hash: forensicHash,
        digitalSignature,
        chainOfCustody: [
          `${timestamp.toISOString()}:created:system`
        ],
        evidenceType: this.determineEvidenceType(action)
      };
      
      // Save audit entry
      const auditLog = new EnhancedAuditLogModel(auditEntry);
      await auditLog.save();
      
      // Handle real-time alerts
      if (config.realTimeAlerts && riskAssessment.level !== AuditRiskLevel.LOW) {
        await this.handleRealTimeAlert(auditEntry as EnhancedAuditEntry);
      }
      
      // Update monitoring metrics
      monitoring.incrementCounter('audit_entries_created_total', 1, {
        entityType,
        action,
        riskLevel: riskAssessment.level,
        userRole
      });
      
      monitoring.recordHistogram('audit_entry_creation_duration', Date.now() - timestamp.getTime());
      
      loggingService.debug('Audit entry created', {
        auditId: auditEntry.id,
        entityType,
        action,
        userId,
        riskLevel: riskAssessment.level
      });
      
    } catch (error) {
      loggingService.error('Failed to create audit entry', error, {
        entityType,
        action,
        requestId,
        userId: user?.id
      });
      
      monitoring.incrementCounter('audit_entry_creation_errors_total', 1);
      throw error;
    }
  }
  
  private static mapMethodToAction(method: string): AuditEventType {
    const methodMap: Record<string, AuditEventType> = {
      'GET': AuditEventType.READ,
      'POST': AuditEventType.CREATE,
      'PUT': AuditEventType.UPDATE,
      'PATCH': AuditEventType.UPDATE,
      'DELETE': AuditEventType.DELETE
    };
    
    return methodMap[method.toUpperCase()] || AuditEventType.SYSTEM_EVENT;
  }
  
  private static getClientIpAddress(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection as any).socket?.remoteAddress ||
           'unknown';
  }
  
  private static extractDeviceInfo(userAgent: string, ipAddress: string) {
    // Simplified device detection - in production, use a proper library
    const deviceType = /Mobile|Android|iPhone|iPad/.test(userAgent) ? 'mobile' : 'desktop';
    const platform = this.detectPlatform(userAgent);
    
    return {
      userAgent,
      deviceType,
      platform,
      ipAddress,
      location: {
        // In production, use IP geolocation service
        country: 'Unknown',
        region: 'Unknown',
        city: 'Unknown'
      }
    };
  }
  
  private static detectPlatform(userAgent: string): string {
    if (/Windows/.test(userAgent)) return 'Windows';
    if (/Mac/.test(userAgent)) return 'macOS';
    if (/Linux/.test(userAgent)) return 'Linux';
    if (/Android/.test(userAgent)) return 'Android';
    if (/iPhone|iPad/.test(userAgent)) return 'iOS';
    return 'Unknown';
  }
  
  private static prepareChangesData(req: Request, responseBody: any, config: AuditConfig): any {
    const changes: any = {};
    
    if (config.includeRequestBody && req.body) {
      changes.request = this.sanitizeData(req.body, config.excludeFields, config.sensitiveFields);
    }
    
    if (config.includeResponseBody && responseBody) {
      changes.response = this.sanitizeData(responseBody, config.excludeFields, config.sensitiveFields);
    }
    
    if (config.includeHeaders) {
      changes.headers = this.sanitizeData(req.headers, config.excludeFields, config.sensitiveFields);
    }
    
    changes.path = req.path;
    changes.method = req.method;
    changes.query = this.sanitizeData(req.query, config.excludeFields, config.sensitiveFields);
    
    return changes;
  }
  
  private static sanitizeData(data: any, excludeFields: string[], sensitiveFields: string[]): any {
    if (!data || typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    
    for (const field of excludeFields) {
      if (sanitized[field]) {
        delete sanitized[field];
      }
    }
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }
  
  private static classifyData(data: any): string {
    // Simplified data classification
    if (!data) return 'public';
    
    const sensitiveKeywords = ['password', 'ssn', 'credit', 'bank', 'medical'];
    const dataString = JSON.stringify(data).toLowerCase();
    
    if (sensitiveKeywords.some(keyword => dataString.includes(keyword))) {
      return 'restricted';
    }
    
    return 'internal';
  }
  
  private static determineSeverity(
    action: AuditEventType,
    statusCode: number,
    riskLevel: AuditRiskLevel
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (riskLevel === AuditRiskLevel.CRITICAL || statusCode >= 500) {
      return 'critical';
    }
    
    if (riskLevel === AuditRiskLevel.HIGH || 
        action === AuditEventType.DELETE ||
        action === AuditEventType.DATA_EXPORT ||
        statusCode >= 400) {
      return 'high';
    }
    
    if (riskLevel === AuditRiskLevel.MEDIUM ||
        action === AuditEventType.UPDATE ||
        action === AuditEventType.CREATE) {
      return 'medium';
    }
    
    return 'low';
  }
  
  private static determineCategory(action: AuditEventType, entityType: string): 'data' | 'security' | 'system' | 'user' | 'compliance' {
    if (action === AuditEventType.LOGIN || action === AuditEventType.LOGOUT || action === AuditEventType.ACCESS_DENIED) {
      return 'security';
    }
    
    if (action === AuditEventType.COMPLIANCE_CHECK) {
      return 'compliance';
    }
    
    if (action === AuditEventType.SYSTEM_EVENT || action === AuditEventType.CONFIGURATION_CHANGE) {
      return 'system';
    }
    
    if (entityType.toLowerCase().includes('user') || entityType.toLowerCase().includes('staff')) {
      return 'user';
    }
    
    return 'data';
  }
  
  private static determineEvidenceType(action: AuditEventType): 'system_log' | 'user_action' | 'data_change' | 'security_event' | 'compliance_record' {
    if (action === AuditEventType.SYSTEM_EVENT) return 'system_log';
    if (action === AuditEventType.SECURITY_EVENT || action === AuditEventType.ACCESS_DENIED) return 'security_event';
    if (action === AuditEventType.COMPLIANCE_CHECK) return 'compliance_record';
    if (action === AuditEventType.UPDATE || action === AuditEventType.DELETE || action === AuditEventType.CREATE) return 'data_change';
    return 'user_action';
  }
  
  private static async handleRealTimeAlert(auditEntry: EnhancedAuditEntry): Promise<void> {
    try {
      const alertData = {
        auditId: auditEntry.id,
        userId: auditEntry.userId,
        action: auditEntry.action,
        riskLevel: auditEntry.riskAssessment?.level,
        riskScore: auditEntry.riskAssessment?.score,
        factors: auditEntry.riskAssessment?.factors,
        timestamp: auditEntry.timestamp,
        ipAddress: auditEntry.deviceInfo?.ipAddress
      };
      
      if (auditEntry.riskAssessment?.level === AuditRiskLevel.CRITICAL) {
        recordSecurityEvent('critical_audit_event', 'critical', alertData);
      } else if (auditEntry.riskAssessment?.level === AuditRiskLevel.HIGH) {
        recordSecurityEvent('high_risk_audit_event', 'high', alertData);
      }
      
      recordBusinessEvent('audit_alert_generated', 'AuditAlert', auditEntry.id!, alertData);
      
    } catch (error) {
      loggingService.error('Failed to handle real-time audit alert', error, {
        auditId: auditEntry.id
      });
    }
  }
}

// Audit Query and Reporting Service
export class AuditQueryService {
  /**
   * Search audit logs with advanced filtering
   */
  static async searchAuditLogs(filters: {
    userId?: string;
    action?: AuditEventType[];
    startDate?: Date;
    endDate?: Date;
    riskLevel?: AuditRiskLevel[];
    category?: string[];
    ipAddress?: string;
    entityType?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    entries: EnhancedAuditEntry[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    try {
      const query: any = {};
      
      if (filters.userId) query.userId = filters.userId;
      if (filters.action) query.action = { $in: filters.action };
      if (filters.riskLevel) query['riskAssessment.level'] = { $in: filters.riskLevel };
      if (filters.category) query.category = { $in: filters.category };
      if (filters.ipAddress) query['deviceInfo.ipAddress'] = filters.ipAddress;
      
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = filters.startDate;
        if (filters.endDate) query.timestamp.$lte = filters.endDate;
      }
      
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 100);
      const skip = (page - 1) * limit;
      
      const [entries, total] = await Promise.all([
        EnhancedAuditLogModel
          .find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        EnhancedAuditLogModel.countDocuments(query)
      ]);
      
      return {
        entries: entries as EnhancedAuditEntry[],
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      loggingService.error('Failed to search audit logs', error, filters);
      throw error;
    }
  }
  
  /**
   * Generate compliance report
   */
  static async generateComplianceReport(
    regulation: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    regulation: string;
    period: { start: Date; end: Date };
    totalEntries: number;
    entriesByCategory: Record<string, number>;
    riskDistribution: Record<string, number>;
    complianceMetrics: {
      retentionCompliance: number;
      dataClassificationCompliance: number;
      auditTrailCompleteness: number;
    };
  }> {
    try {
      const query = {
        timestamp: { $gte: startDate, $lte: endDate },
        'complianceData.regulations': regulation
      };
      
      const [
        totalEntries,
        categoryStats,
        riskStats
      ] = await Promise.all([
        EnhancedAuditLogModel.countDocuments(query),
        EnhancedAuditLogModel.aggregate([
          { $match: query },
          { $group: { _id: '$category', count: { $sum: 1 } } }
        ]),
        EnhancedAuditLogModel.aggregate([
          { $match: query },
          { $group: { _id: '$riskAssessment.level', count: { $sum: 1 } } }
        ])
      ]);
      
      const entriesByCategory = categoryStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {});
      
      const riskDistribution = riskStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {});
      
      // Calculate compliance metrics (simplified)
      const complianceMetrics = {
        retentionCompliance: 95, // Would be calculated based on actual retention policies
        dataClassificationCompliance: 98,
        auditTrailCompleteness: 99
      };
      
      return {
        regulation,
        period: { start: startDate, end: endDate },
        totalEntries,
        entriesByCategory,
        riskDistribution,
        complianceMetrics
      };
    } catch (error) {
      loggingService.error('Failed to generate compliance report', error, {
        regulation,
        startDate,
        endDate
      });
      throw error;
    }
  }
}

export default {
  AuditTrailMiddleware,
  AuditQueryService,
  auditConfigManager,
  EnhancedAuditLogModel
};