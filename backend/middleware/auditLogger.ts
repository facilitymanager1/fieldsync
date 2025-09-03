// Middleware to record audit logs for sensitive routes
import { recordAuditLog } from '../modules/auditLog';
import { Request, Response, NextFunction } from 'express';

// AuditLogger class for advanced logging features
export class AuditLogger {
  static async logAction(userId: string, action: string, entityType?: string, entityId?: string, details?: any) {
    try {
      await recordAuditLog({
        userId,
        action,
        entityType,
        entityId,
        details,
      });
    } catch (error) {
      console.error('Failed to log audit action:', error);
    }
  }

  static async logSecurityEvent(userId: string, event: string, severity: 'low' | 'medium' | 'high' | 'critical', details?: any) {
    try {
      await recordAuditLog({
        userId,
        action: 'SECURITY_EVENT',
        entityType: 'security',
        entityId: undefined,
        details: {
          event,
          severity,
          ...details
        },
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  static async logDataAccess(userId: string, resource: string, operation: string, recordId?: string) {
    try {
      await recordAuditLog({
        userId,
        action: `DATA_${operation.toUpperCase()}`,
        entityType: resource,
        entityId: recordId,
        details: {
          operation,
          resource,
        },
      });
    } catch (error) {
      console.error('Failed to log data access:', error);
    }
  }

  async log(logData: {
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    details?: any;
  }): Promise<void> {
    try {
      await recordAuditLog(logData);
    } catch (error) {
      console.error('Failed to log audit entry:', error);
    }
  }
}

export function auditLogger(action: string, entityType?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    const entityId = req.params.id || undefined;
    recordAuditLog({
      userId,
      action,
      entityType,
      entityId,
      details: { method: req.method, path: req.path, body: req.body },
    });
    next();
  };
}
