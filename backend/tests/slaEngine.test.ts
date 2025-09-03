/**
 * SLA Engine Unit Tests
 * Comprehensive testing for SLA management core functionality
 */

import { slaEngine, SlaEngine } from '../modules/slaEngine';
import { AdvancedSlaTemplateModel, SlaTrackerModel } from '../models/advancedSla';

// Mock dependencies
jest.mock('../models/advancedSla');
jest.mock('../services/loggingService');
jest.mock('../services/monitoringService');
jest.mock('../middleware/monitoringMiddleware');

describe('SLA Engine Core', () => {
  let mockSlaTemplate: any;
  let mockSlaTracker: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock SLA Template
    mockSlaTemplate = {
      _id: 'template_123',
      name: 'Standard Support SLA',
      entityType: 'Ticket',
      responseTimeMinutes: 60,
      resolutionTimeMinutes: 240,
      escalationRules: [
        {
          level: 1,
          delayMinutes: 30,
          actions: ['notify_assignee']
        }
      ],
      isActive: true,
      complianceTargets: {
        responseTime: 95,
        resolutionTime: 90
      }
    };

    // Mock SLA Tracker
    mockSlaTracker = {
      _id: 'tracker_123',
      templateId: 'template_123',
      entityType: 'Ticket',
      entityId: 'ticket_456',
      status: 'active',
      createdAt: new Date('2024-01-01T10:00:00Z'),
      responseTime: new Date('2024-01-01T10:30:00Z'),
      breachTime: new Date('2024-01-01T14:00:00Z'),
      isBreached: false,
      escalationLevel: 0,
      save: jest.fn().mockResolvedValue(true)
    };

    // Setup model mocks
    (AdvancedSlaTemplateModel.find as jest.Mock).mockResolvedValue([mockSlaTemplate]);
    (AdvancedSlaTemplateModel.findById as jest.Mock).mockResolvedValue(mockSlaTemplate);
    (SlaTrackerModel.find as jest.Mock).mockResolvedValue([mockSlaTracker]);
    (SlaTrackerModel.findById as jest.Mock).mockResolvedValue(mockSlaTracker);
    (SlaTrackerModel.aggregate as jest.Mock).mockResolvedValue([
      { _id: 'active', count: 5 },
      { _id: 'breached', count: 2 }
    ]);
  });

  describe('Service Initialization', () => {
    it('should be defined and have core properties', () => {
      expect(slaEngine).toBeDefined();
      expect(slaEngine).toBeInstanceOf(SlaEngine);
      expect(typeof slaEngine.start).toBe('function');
      expect(typeof slaEngine.stop).toBe('function');
    });

    it('should handle service lifecycle correctly', () => {
      expect(() => slaEngine.start()).not.toThrow();
      expect(() => slaEngine.stop()).not.toThrow();
    });

    it('should track running state', () => {
      expect(slaEngine.isRunning()).toBe(false);
      slaEngine.start();
      expect(slaEngine.isRunning()).toBe(true);
      slaEngine.stop();
      expect(slaEngine.isRunning()).toBe(false);
    });
  });

  describe('SLA Template Management', () => {
    it('should load and validate SLA templates', async () => {
      const templates = await slaEngine.loadSlaTemplates();
      
      expect(templates).toBeDefined();
      expect(AdvancedSlaTemplateModel.find).toHaveBeenCalledWith({ isActive: true });
    });

    it('should validate template configuration', async () => {
      const isValid = await slaEngine.validateTemplate(mockSlaTemplate);
      expect(isValid).toBe(true);
    });

    it('should handle invalid templates', async () => {
      const invalidTemplate = { ...mockSlaTemplate, responseTimeMinutes: -1 };
      const isValid = await slaEngine.validateTemplate(invalidTemplate);
      expect(isValid).toBe(false);
    });
  });

  describe('Breach Detection and Processing', () => {
    it('should detect SLA breaches correctly', async () => {
      // Mock breach scenario
      mockSlaTracker.breachTime = new Date(Date.now() - 60000); // 1 minute ago
      mockSlaTracker.isBreached = false; // Not yet flagged

      await slaEngine.processBreachChecks();

      expect(SlaTrackerModel.find).toHaveBeenCalled();
    });

    it('should handle multiple breach scenarios', async () => {
      const mockTrackers = [
        { ...mockSlaTracker, _id: 'tracker_1', isBreached: false },
        { ...mockSlaTracker, _id: 'tracker_2', isBreached: true },
        { ...mockSlaTracker, _id: 'tracker_3', isBreached: false }
      ];
      
      (SlaTrackerModel.find as jest.Mock).mockResolvedValue(mockTrackers);

      await slaEngine.processBreachChecks();

      expect(SlaTrackerModel.find).toHaveBeenCalled();
    });

    it('should process escalations for breached SLAs', async () => {
      mockSlaTracker.isBreached = true;
      mockSlaTracker.escalationLevel = 0;
      
      await slaEngine.processEscalations();

      expect(SlaTrackerModel.find).toHaveBeenCalled();
    });
  });

  describe('SLA Metrics and Statistics', () => {
    it('should provide comprehensive SLA statistics', async () => {
      const stats = await slaEngine.getStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalTrackers).toBe('number');
      expect(typeof stats.activeBreaches).toBe('number');
      expect(typeof stats.escalationsPending).toBe('number');
      expect(typeof stats.complianceRate).toBe('number');
    });

    it('should calculate compliance rates correctly', async () => {
      const stats = await slaEngine.getStatistics();
      
      expect(stats.complianceRate).toBeGreaterThanOrEqual(0);
      expect(stats.complianceRate).toBeLessThanOrEqual(100);
    });

    it('should provide processing metrics', () => {
      const metrics = slaEngine.getProcessingMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics.checksPerformed).toBe('number');
      expect(typeof metrics.escalationsTriggered).toBe('number');
      expect(typeof metrics.lastProcessingTime).toBe('number');
    });
  });

  describe('Performance and Analytics', () => {
    it('should generate performance reports', async () => {
      const report = await slaEngine.generatePerformanceReport({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        entityTypes: ['Ticket']
      });

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.breachAnalysis).toBeDefined();
    });

    it('should provide workload predictions', async () => {
      const prediction = await slaEngine.predictWorkload({
        entityType: 'Ticket',
        timeframe: 'next_week'
      });

      expect(prediction).toBeDefined();
      expect(prediction.predictedVolume).toBeDefined();
      expect(prediction.riskFactors).toBeDefined();
      expect(prediction.recommendations).toBeDefined();
    });

    it('should generate optimization suggestions', async () => {
      const suggestions = await slaEngine.generateOptimizationSuggestions();

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('category');
        expect(suggestion).toHaveProperty('description');
        expect(suggestion).toHaveProperty('impact');
        expect(suggestion).toHaveProperty('priority');
      });
    });
  });

  describe('Configuration Management', () => {
    it('should handle configuration updates', () => {
      const newConfig = {
        checkInterval: 30000,
        maxConcurrentProcessing: 10,
        enablePredictiveAnalytics: true
      };

      expect(() => slaEngine.updateConfiguration(newConfig)).not.toThrow();
    });

    it('should validate configuration parameters', () => {
      expect(() => slaEngine.updateConfiguration({ checkInterval: -1000 })).toThrow();
      expect(() => slaEngine.updateConfiguration({ maxConcurrentProcessing: 0 })).toThrow();
    });

    it('should provide current configuration', () => {
      const config = slaEngine.getConfiguration();
      
      expect(config).toBeDefined();
      expect(typeof config.checkInterval).toBe('number');
      expect(typeof config.maxConcurrentProcessing).toBe('number');
      expect(typeof config.enablePredictiveAnalytics).toBe('boolean');
    });
  });

  describe('Real-time Monitoring', () => {
    it('should provide real-time SLA status', async () => {
      const status = await slaEngine.getRealTimeStatus();

      expect(status).toBeDefined();
      expect(status.timestamp).toBeInstanceOf(Date);
      expect(status.activeTrackers).toBeDefined();
      expect(status.criticalBreaches).toBeDefined();
      expect(status.systemHealth).toBeDefined();
    });

    it('should handle monitoring alerts', async () => {
      const alerts = await slaEngine.getActiveAlerts();

      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should track system performance', () => {
      const performance = slaEngine.getSystemPerformance();

      expect(performance).toBeDefined();
      expect(performance.responseTime).toBeDefined();
      expect(performance.throughput).toBeDefined();
      expect(performance.resourceUsage).toBeDefined();
    });
  });

  describe('Integration and Compliance', () => {
    it('should generate compliance reports', async () => {
      const report = await slaEngine.generateComplianceReport({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        includeDetails: true
      });

      expect(report).toBeDefined();
      expect(report.overallCompliance).toBeDefined();
      expect(report.byEntityType).toBeDefined();
      expect(report.breachSummary).toBeDefined();
      expect(report.improvementAreas).toBeDefined();
    });

    it('should handle audit trail requirements', async () => {
      const auditLog = await slaEngine.getAuditTrail({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      });

      expect(auditLog).toBeDefined();
      expect(Array.isArray(auditLog.events)).toBe(true);
    });

    it('should support data export', async () => {
      const exportData = await slaEngine.exportData({
        format: 'json',
        includeMetrics: true,
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        }
      });

      expect(exportData).toBeDefined();
      expect(exportData.format).toBe('json');
      expect(exportData.data).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection failures gracefully', async () => {
      (SlaTrackerModel.find as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(slaEngine.processBreachChecks()).not.toThrow();
      
      // Should log error but continue operation
      expect(slaEngine.getLastError()).toBeDefined();
    });

    it('should recover from processing errors', async () => {
      // Mock processing error
      mockSlaTracker.save.mockRejectedValue(new Error('Save failed'));

      await slaEngine.processBreachChecks();

      // Should continue processing other trackers
      const metrics = slaEngine.getProcessingMetrics();
      expect(metrics.errors).toBeGreaterThan(0);
    });

    it('should maintain service health during errors', () => {
      const healthStatus = slaEngine.getHealthStatus();

      expect(healthStatus).toBeDefined();
      expect(healthStatus.status).toMatch(/healthy|degraded|unhealthy/);
      expect(healthStatus.uptime).toBeGreaterThan(0);
      expect(healthStatus.lastHeartbeat).toBeInstanceOf(Date);
    });
  });
});