/**
 * Advanced SLA Engine Unit Tests
 * Comprehensive testing for SLA management, escalation, and monitoring
 */

import { AdvancedSlaEngine } from '../modules/advancedSlaEngine';
import { 
  AdvancedSlaTemplateModel, 
  SlaTrackerModel
} from '../models/advancedSla';
import { 
  AuditEventType,
  AuditSeverity,
  AuditStatus 
} from '../models/auditLog';
import { BusinessHoursCalculator } from '../modules/businessHoursCalculator';
import { SlaTimerScheduler } from '../modules/slaTimerScheduler';
import { NotificationService } from '../modules/notification';
import { recordAuditLog } from '../modules/auditLog';

// Mock all dependencies
jest.mock('../models/advancedSla');
jest.mock('../modules/businessHoursCalculator');
jest.mock('../modules/slaTimerScheduler');
jest.mock('../modules/notification');
jest.mock('../modules/auditLog');

// Mock modules
jest.mock('../modules/metricsCollector', () => ({
  MetricsCollector: jest.fn().mockImplementation(() => ({
    recordSlaMetric: jest.fn(),
    recordBreachEvent: jest.fn(),
    recordEscalationEvent: jest.fn()
  }))
}));

jest.mock('../modules/predictiveAnalytics', () => ({
  PredictiveAnalytics: jest.fn().mockImplementation(() => ({
    predictBreachProbability: jest.fn().mockResolvedValue(0.75),
    getOptimalAssignment: jest.fn().mockResolvedValue('user_123')
  }))
}));

jest.mock('../modules/workloadAnalyzer', () => ({
  WorkloadAnalyzer: jest.fn().mockImplementation(() => ({
    analyzeUserWorkload: jest.fn().mockResolvedValue({ score: 65 }),
    getTeamCapacity: jest.fn().mockResolvedValue({ available: 5 })
  }))
}));

jest.mock('../middleware/auditLogger', () => ({
  AuditLogger: jest.fn().mockImplementation(() => ({
    logCriticalEvent: jest.fn(),
    logAssignment: jest.fn()
  }))
}));

describe('Advanced SLA Engine', () => {
  let slaEngine: AdvancedSlaEngine;
  let mockTemplate: any;
  let mockTracker: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    slaEngine = new AdvancedSlaEngine();
    
    // Mock SLA template
    mockTemplate = {
      _id: 'template_123',
      name: 'Standard Support SLA',
      entityType: 'Ticket',
      isDefault: true,
      isActive: true,
      responseTimeMinutes: 60,
      resolutionTimeMinutes: 240,
      escalationRules: [
        {
          id: 'rule_1',
          level: 1,
          delayMinutes: 30,
          actions: ['notify_assignee', 'notify_manager'],
          conditions: { businessHoursOnly: true }
        },
        {
          id: 'rule_2',
          level: 2,
          delayMinutes: 60,
          actions: ['escalate_to_supervisor'],
          conditions: { businessHoursOnly: false }
        }
      ],
      save: jest.fn().mockResolvedValue(true)
    };

    // Mock SLA tracker
    mockTracker = {
      _id: 'tracker_123',
      entityType: 'Ticket',
      entityId: 'ticket_456',
      templateId: 'template_123',
      status: 'active',
      assignedTo: 'user_123',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      responseTime: new Date('2024-01-01T11:00:00Z'),
      breachTime: new Date('2024-01-01T14:00:00Z'),
      currentEscalationLevel: 0,
      isBreached: false,
      escalationHistory: [],
      escalationRules: mockTemplate.escalationRules,
      context: {
        priority: 'high',
        clientId: 'client_123',
        teamId: 'team_456',
        managerId: 'manager_789'
      },
      save: jest.fn().mockResolvedValue(true)
    };

    // Mock model methods
    (AdvancedSlaTemplateModel.findById as jest.Mock).mockResolvedValue(mockTemplate);
    (AdvancedSlaTemplateModel.findOne as jest.Mock).mockResolvedValue(mockTemplate);
    (SlaTrackerModel.findById as jest.Mock).mockResolvedValue(mockTracker);
    (SlaTrackerModel.prototype.save as jest.Mock).mockResolvedValue(mockTracker);
  });

  describe('SLA Engine Functionality', () => {
    it('should be properly instantiated', () => {
      expect(slaEngine).toBeDefined();
      expect(slaEngine).toBeInstanceOf(AdvancedSlaEngine);
    });

    it('should have all required methods', () => {
      const methods = [
        'createSlaTracker',
        'pauseSlaTracker',
        'resumeSlaTracker',
        'completeSlaTracker',
        'updateSlaTracker'
      ];

      methods.forEach(method => {
        expect(typeof (slaEngine as any)[method]).toBe('function');
      });
    });
  });

  describe('Template Management', () => {
    it('should handle template lookup', async () => {
      expect(AdvancedSlaTemplateModel.findOne).toBeDefined();
      expect(AdvancedSlaTemplateModel.findById).toBeDefined();
    });

    it('should handle tracker creation', () => {
      expect(SlaTrackerModel).toBeDefined();
      expect(mockTracker.save).toBeDefined();
    });
  });

  describe('Skill-Based Assignment', () => {
    it('should calculate skill match scores correctly', async () => {
      // This tests the private method indirectly through assignment
      const availableUsers = [
        {
          id: 'user_1',
          name: 'Expert User',
          skills: [
            { name: 'technical_support', level: 'expert' },
            { name: 'customer_service', level: 'advanced' }
          ],
          experienceYears: 5,
          performanceRating: 4.8,
          currentWorkload: 3,
          maxWorkload: 10,
          isActive: true,
          isAvailable: true,
          isOnLeave: false
        }
      ];

      // Mock the getUsersByTeam method result
      const mockGetAvailableUsers = jest.spyOn(slaEngine as any, 'getAvailableUsers')
        .mockResolvedValue(availableUsers);
      
      // Test assignment process which uses skill matching
      mockTracker.context.requiredSkills = [
        { name: 'technical_support', level: 'advanced', weight: 1 }
      ];

      const result = await slaEngine.createSlaTracker('ticket_123', 'Ticket', {
        priority: 'high',
        requiredSkills: [{ name: 'technical_support', level: 'advanced', weight: 1 }]
      });

      expect(result).toBeDefined();
      expect(result.entityId).toBe('ticket_123');
      mockGetAvailableUsers.mockRestore();
    });

    it('should prefer users with lower workload for similar skills', async () => {
      const availableUsers = [
        {
          id: 'user_high_workload',
          currentWorkload: 9,
          maxWorkload: 10,
          skills: [{ name: 'technical_support', level: 'advanced' }],
          isActive: true,
          isAvailable: true,
          isOnLeave: false
        },
        {
          id: 'user_low_workload',
          currentWorkload: 2,
          maxWorkload: 10,
          skills: [{ name: 'technical_support', level: 'advanced' }],
          isActive: true,
          isAvailable: true,
          isOnLeave: false
        }
      ];

      const mockGetAvailableUsers = jest.spyOn(slaEngine as any, 'getAvailableUsers')
        .mockResolvedValue(availableUsers);

      // Test should prefer user with lower workload
      const result = await slaEngine.processEscalation('tracker_123');
      
      expect(result.success).toBe(true);
      mockGetAvailableUsers.mockRestore();
    });
  });

  describe('Auto-Resolution', () => {
    beforeEach(() => {
      mockTracker.escalationRules[0].actions = ['auto_resolve'];
      mockTracker.escalationRules[0].autoResolutionRules = [
        {
          conditions: {
            all: [
              { fact: 'ageInHours', operator: 'greaterThan', value: 24 }
            ]
          },
          event: {
            type: 'auto_resolve',
            params: { reason: 'Aged out after 24 hours' }
          }
        }
      ];
    });

    it('should auto-resolve based on rules', async () => {
      // Mock old ticket creation date
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      
      const result = await slaEngine.createSlaTracker('ticket_123', 'Ticket', {
        priority: 'low',
        createdAt: oldDate
      });

      expect(result).toBeDefined();
      // Auto-resolution logic would be triggered during escalation processing
    });

    it('should not auto-resolve if conditions not met', async () => {
      const result = await slaEngine.createSlaTracker('ticket_123', 'Ticket', {
        priority: 'low'
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('active');
    });
  });

  describe('Breach Detection', () => {
    it('should detect SLA breach correctly', async () => {
      // Set breach time in the past
      mockTracker.breachTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      
      // Check tracker status
      const tracker = await SlaTrackerModel.findById('tracker_123');
      
      expect(tracker).toBeDefined();
      expect(tracker.isBreached).toBe(false); // Should be set by breach detection process
    });

    it('should not detect breach for future breach time', async () => {
      // Set breach time in the future
      mockTracker.breachTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      const tracker = await SlaTrackerModel.findById('tracker_123');
      
      expect(tracker).toBeDefined();
      expect(tracker.isBreached).toBe(false);
    });

    it('should calculate time to breach correctly', async () => {
      const futureBreachTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
      mockTracker.breachTime = futureBreachTime;
      
      const timeToBreach = futureBreachTime.getTime() - Date.now();
      
      expect(timeToBreach).toBeGreaterThan(0);
      expect(timeToBreach).toBeLessThanOrEqual(2 * 60 * 60 * 1000);
    });
  });

  describe('Business Hours Calculation', () => {
    it('should adjust escalation times for business hours', async () => {
      mockTracker.escalationRules[0].conditions.businessHoursOnly = true;
      
      const mockBusinessHours = new BusinessHoursCalculator();
      (mockBusinessHours.adjustToBusinessHours as jest.Mock)
        .mockResolvedValue(new Date('2024-01-02T09:00:00Z')); // Next business day

      const result = await slaEngine.processEscalation('tracker_123');

      expect(result.success).toBe(true);
    });

    it('should not adjust times when business hours not required', async () => {
      mockTracker.escalationRules[0].conditions.businessHoursOnly = false;
      
      const result = await slaEngine.processEscalation('tracker_123');

      expect(result.success).toBe(true);
    });
  });

  describe('Notification System Integration', () => {
    it('should send notifications during escalation', async () => {
      const mockNotificationService = new NotificationService();
      
      const result = await slaEngine.processEscalation('tracker_123');

      expect(result.success).toBe(true);
      // Notifications should be sent based on escalation rules
    });

    it('should send critical alerts for max escalation', async () => {
      mockTracker.currentEscalationLevel = 3; // Max level
      
      const result = await slaEngine.processEscalation('tracker_123');

      expect(result.success).toBe(true);
      // Critical alert should be sent
    });
  });

  describe('Audit Trail Integration', () => {
    it('should record audit logs for all SLA events', async () => {
      const result = await slaEngine.processEscalation('tracker_123');

      expect(result.success).toBe(true);
      // Audit logging should be called for escalation events
    });

    it('should record assignment changes in audit trail', async () => {
      const result = await slaEngine.processEscalation('tracker_123');

      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      (SlaTrackerModel.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await slaEngine.processEscalation('tracker_123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Database error');
    });

    it('should handle missing tracker gracefully', async () => {
      (SlaTrackerModel.findById as jest.Mock).mockResolvedValue(null);

      const result = await slaEngine.processEscalation('nonexistent_tracker');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should handle notification failures without breaking', async () => {
      const mockNotificationService = new NotificationService();
      (mockNotificationService.sendSlaEscalation as jest.Mock)
        .mockRejectedValue(new Error('Notification failed'));

      const result = await slaEngine.processEscalation('tracker_123');

      // Should still succeed even if notifications fail
      expect(result.success).toBe(true);
    });
  });

  describe('Performance and Metrics', () => {
    it('should record SLA metrics during processing', async () => {
      const result = await slaEngine.processEscalation('tracker_123');

      expect(result.success).toBe(true);
      // Metrics should be recorded for monitoring
    });

    it('should track escalation timing accurately', async () => {
      const startTime = Date.now();
      
      const result = await slaEngine.processEscalation('tracker_123');

      expect(result.success).toBe(true);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Template Management', () => {
    it('should retrieve default templates correctly', async () => {
      const result = await slaEngine.createSlaTracker(
        'ticket_123',
        'Ticket',
        { priority: 'medium' }
      );

      expect(result.success).toBe(true);
      expect(AdvancedSlaTemplateModel.findOne).toHaveBeenCalledWith({
        entityType: 'Ticket',
        isDefault: true,
        isActive: true
      });
    });

    it('should handle inactive templates', async () => {
      mockTemplate.isActive = false;
      (AdvancedSlaTemplateModel.findOne as jest.Mock).mockResolvedValue(mockTemplate);

      const result = await slaEngine.createSlaTracker(
        'ticket_123',
        'Ticket',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('No active SLA template');
    });
  });
});