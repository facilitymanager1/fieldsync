/**
 * Audit Log Module Tests
 * Comprehensive testing for audit logging functionality
 */

import { recordAuditLog, getAuditLogs, getAuditStatistics } from '../modules/auditLog';
import { AuditLogModel, AuditEventType, AuditSeverity, AuditStatus } from '../models/auditLog';
import mongoose from 'mongoose';

// Mock MongoDB for testing
jest.mock('../models/auditLog');

describe('Audit Log Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordAuditLog', () => {
    it('should record a basic audit log entry', async () => {
      const mockSave = jest.fn().mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        action: 'test_action',
        entityType: 'Ticket',
        entityId: 't1',
        severity: AuditSeverity.INFO,
        status: AuditStatus.SUCCESS
      });

      (AuditLogModel as any).mockImplementation(() => ({
        save: mockSave
      }));

      const logData = {
        userId: '507f1f77bcf86cd799439011',
        action: 'test_action',
        entityType: 'Ticket',
        entityId: 't1',
        details: { foo: 'bar' }
      };

      const result = await recordAuditLog(logData);

      expect(mockSave).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.action).toBe('test_action');
    });

    it('should handle audit log recording with full metadata', async () => {
      const mockSave = jest.fn().mockResolvedValue({
        _id: new mongoose.Types.ObjectId(),
        action: 'create_ticket',
        entityType: 'Ticket',
        eventType: AuditEventType.CREATE,
        severity: AuditSeverity.INFO,
        correlationId: 'test-correlation-123'
      });

      (AuditLogModel as any).mockImplementation(() => ({
        save: mockSave
      }));

      const logData = {
        userId: '507f1f77bcf86cd799439011',
        action: 'create_ticket',
        entityType: 'Ticket',
        entityId: 't1',
        eventType: AuditEventType.CREATE,
        severity: AuditSeverity.INFO,
        correlationId: 'test-correlation-123',
        userAgent: 'Mozilla/5.0 Test Browser',
        ipAddress: '127.0.0.1',
        changes: [{
          field: 'status',
          oldValue: null,
          newValue: 'open',
          dataType: 'string'
        }]
      };

      await recordAuditLog(logData);

      expect(mockSave).toHaveBeenCalled();
    });

    it('should handle errors during audit log recording', async () => {
      const mockSave = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      (AuditLogModel as any).mockImplementation(() => ({
        save: mockSave
      }));

      const logData = {
        userId: '507f1f77bcf86cd799439011',
        action: 'test_action',
        entityType: 'Ticket',
        entityId: 't1'
      };

      await expect(recordAuditLog(logData)).rejects.toThrow('Failed to record audit log');
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with basic filtering', async () => {
      const mockLogs = [
        {
          _id: new mongoose.Types.ObjectId(),
          action: 'test_action',
          entityType: 'Ticket',
          userId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
          timestamp: new Date()
        }
      ];

      const mockFind = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockPopulate = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue(mockLogs);
      const mockCountDocuments = jest.fn().mockResolvedValue(1);

      (AuditLogModel.find as jest.Mock) = mockFind;
      (AuditLogModel.countDocuments as jest.Mock) = mockCountDocuments;
      
      mockFind.mockReturnValue({
        sort: mockSort.mockReturnValue({
          skip: mockSkip.mockReturnValue({
            limit: mockLimit.mockReturnValue({
              populate: mockPopulate.mockReturnValue({
                exec: mockExec
              })
            })
          })
        })
      });

      const result = await getAuditLogs({
        userId: '507f1f77bcf86cd799439011'
      });

      expect(result).toBeDefined();
      expect(result.logs).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should handle pagination correctly', async () => {
      const mockLogs = Array(25).fill(null).map((_, index) => ({
        _id: new mongoose.Types.ObjectId(),
        action: `action_${index}`,
        entityType: 'Ticket',
        timestamp: new Date()
      }));

      const mockFind = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockPopulate = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue(mockLogs.slice(0, 25));
      const mockCountDocuments = jest.fn().mockResolvedValue(100);

      (AuditLogModel.find as jest.Mock) = mockFind;
      (AuditLogModel.countDocuments as jest.Mock) = mockCountDocuments;
      
      mockFind.mockReturnValue({
        sort: mockSort.mockReturnValue({
          skip: mockSkip.mockReturnValue({
            limit: mockLimit.mockReturnValue({
              populate: mockPopulate.mockReturnValue({
                exec: mockExec
              })
            })
          })
        })
      });

      const result = await getAuditLogs({
        limit: 25,
        offset: 0
      });

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(100);
      expect(result.logs).toHaveLength(25);
    });
  });

  describe('getAuditStatistics', () => {
    it('should return comprehensive audit statistics', async () => {
      const mockStats = {
        totalLogs: 100,
        eventTypes: [
          { eventType: 'CREATE', count: 40 },
          { eventType: 'UPDATE', count: 35 }
        ],
        severities: [
          { severity: 'INFO', count: 80 },
          { severity: 'WARNING', count: 20 }
        ]
      };

      const mockCountDocuments = jest.fn().mockResolvedValue(100);
      const mockAggregate = jest.fn()
        .mockResolvedValueOnce(mockStats.eventTypes)
        .mockResolvedValueOnce(mockStats.severities)
        .mockResolvedValueOnce([]);

      const mockFind = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockReturnThis();
      const mockPopulate = jest.fn().mockReturnThis();
      const mockExec = jest.fn().mockResolvedValue([]);

      (AuditLogModel.countDocuments as jest.Mock) = mockCountDocuments;
      (AuditLogModel.aggregate as jest.Mock) = mockAggregate;
      (AuditLogModel.find as jest.Mock) = mockFind;
      
      mockFind.mockReturnValue({
        sort: mockSort.mockReturnValue({
          limit: mockLimit.mockReturnValue({
            populate: mockPopulate.mockReturnValue({
              exec: mockExec
            })
          })
        })
      });

      const result = await getAuditStatistics();

      expect(result).toBeDefined();
      expect(result.totalLogs).toBe(100);
      expect(mockCountDocuments).toHaveBeenCalled();
      expect(mockAggregate).toHaveBeenCalledTimes(3);
    });
  });
});
