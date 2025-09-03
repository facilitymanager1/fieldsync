// Advanced SLA Engine Facade - Simplified implementation for API compatibility
// This provides the core functionality needed by the API routes

import { SlaTracker, AdvancedSlaTemplate, SlaTrackerModel, AdvancedSlaTemplateModel } from '../models/advancedSla';

export interface SlaContext {
  [key: string]: any;
}

export class AdvancedSlaEngine {
  constructor() {
    // Initialize engine
  }

  /**
   * Create SLA tracker for an entity
   */
  async createSlaTracker(
    entityId: string,
    entityType: string,
    context: SlaContext = {}
  ): Promise<SlaTracker | null> {
    try {
      // Find matching template
      const template = await AdvancedSlaTemplateModel.findOne({
        entityType,
        isActive: true
      }).sort({ priority: -1, version: -1 });

      if (!template) {
        console.warn(`No SLA template found for entity type: ${entityType}`);
        return null;
      }

      // Calculate deadlines
      const startTime = new Date();
      const responseDeadline = new Date(startTime.getTime() + (template.responseTime.hours * 60 * 60 * 1000));
      const resolutionDeadline = new Date(startTime.getTime() + (template.resolutionTime.hours * 60 * 60 * 1000));

      // Create tracker
      const tracker: SlaTracker = {
        id: this.generateId(),
        entityId,
        entityType,
        slaTemplateId: template.id || template._id,
        status: 'active',
        currentStage: 'awaiting_response',
        createdAt: startTime,
        updatedAt: startTime,
        startTime,
        responseDeadline,
        resolutionDeadline,
        assignedTo: context.assignedTo || undefined,
        escalationLevel: 0,
        escalationHistory: [],
        assignmentHistory: [],
        pausedDuration: 0,
        isBreached: false,
        pauseReasons: []
      };

      const savedTracker = await SlaTrackerModel.create(tracker);
      return savedTracker.toObject();
    } catch (error) {
      console.error('Error creating SLA tracker:', error);
      throw error;
    }
  }

  /**
   * Update SLA tracker
   */
  async updateSlaTracker(
    entityId: string,
    entityType: string,
    updates: Partial<SlaTracker>
  ): Promise<SlaTracker | null> {
    try {
      const tracker = await SlaTrackerModel.findOne({ entityId, entityType });
      if (!tracker) {
        throw new Error(`SLA tracker not found for entity: ${entityId}`);
      }

      // Update tracker
      Object.assign(tracker, updates);
      tracker.updatedAt = new Date();

      await tracker.save();
      return tracker.toObject();
    } catch (error) {
      console.error('Error updating SLA tracker:', error);
      throw error;
    }
  }

  /**
   * Resolve SLA
   */
  async resolveSla(
    entityId: string,
    entityType: string,
    resolutionTime?: Date
  ): Promise<void> {
    try {
      const tracker = await SlaTrackerModel.findOne({ entityId, entityType });
      if (!tracker) return;

      const resolvedAt = resolutionTime || new Date();
      
      tracker.status = 'resolved';
      tracker.resolutionTime = resolvedAt;
      tracker.updatedAt = new Date();

      await tracker.save();
    } catch (error) {
      console.error('Error resolving SLA:', error);
      throw error;
    }
  }

  /**
   * Pause SLA
   */
  async pauseSla(
    entityId: string,
    entityType: string,
    reason: string,
    category: string,
    pausedBy: string
  ): Promise<void> {
    try {
      const tracker = await SlaTrackerModel.findOne({ entityId, entityType });
      if (!tracker || tracker.status !== 'active') return;

      tracker.status = 'paused';
      tracker.pauseReasons.push({
        reason,
        category: category as 'waiting_for_client' | 'waiting_for_approval' | 'technical_issue' | 'other',
        pausedAt: new Date(),
        pausedBy
      });
      tracker.updatedAt = new Date();

      await tracker.save();
    } catch (error) {
      console.error('Error pausing SLA:', error);
      throw error;
    }
  }

  /**
   * Resume SLA
   */
  async resumeSla(
    entityId: string,
    entityType: string,
    resumedBy: string
  ): Promise<void> {
    try {
      const tracker = await SlaTrackerModel.findOne({ entityId, entityType });
      if (!tracker || tracker.status !== 'paused') return;

      // Update last pause reason
      const lastPause = tracker.pauseReasons[tracker.pauseReasons.length - 1];
      if (lastPause && !lastPause.resumedAt) {
        lastPause.resumedAt = new Date();
        // Note: resumedBy is not in the PauseReason interface, but we can track it in the audit log
      }

      tracker.status = 'active';
      tracker.updatedAt = new Date();

      await tracker.save();
    } catch (error) {
      console.error('Error resuming SLA:', error);
      throw error;
    }
  }

  /**
   * Get SLA metrics
   */
  async getSlaMetrics(filters: any = {}): Promise<any> {
    try {
      const pipeline = [
        { $match: filters },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgResolutionTime: { $avg: '$actualResolutionHours' }
          }
        }
      ];

      const metrics = await SlaTrackerModel.aggregate(pipeline);
      
      return {
        total: await SlaTrackerModel.countDocuments(filters),
        byStatus: metrics,
        breachRate: await this.calculateBreachRate(filters)
      };
    } catch (error) {
      console.error('Error getting SLA metrics:', error);
      throw error;
    }
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(): Promise<any> {
    try {
      const [
        activeCount,
        breachedCount,
        resolvedToday,
        avgResolutionTime
      ] = await Promise.all([
        SlaTrackerModel.countDocuments({ status: 'active' }),
        SlaTrackerModel.countDocuments({ isBreached: true }),
        SlaTrackerModel.countDocuments({
          status: 'resolved',
          resolutionTime: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }),
        SlaTrackerModel.aggregate([
          { $match: { status: 'resolved', actualResolutionHours: { $exists: true } } },
          { $group: { _id: null, avg: { $avg: '$actualResolutionHours' } } }
        ])
      ]);

      return {
        active: activeCount,
        breached: breachedCount,
        resolvedToday: resolvedToday,
        avgResolutionTime: avgResolutionTime[0]?.avg || 0,
        breachRate: breachedCount > 0 ? (breachedCount / (activeCount + breachedCount)) * 100 : 0
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<any> {
    try {
      const dbConnected = await SlaTrackerModel.findOne().limit(1);
      
      return {
        status: 'healthy',
        timestamp: new Date(),
        database: dbConnected ? 'connected' : 'disconnected',
        version: '1.0.0'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        version: '1.0.0'
      };
    }
  }

  // Helper methods
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private async calculateBreachRate(filters: any): Promise<number> {
    try {
      const total = await SlaTrackerModel.countDocuments(filters);
      const breached = await SlaTrackerModel.countDocuments({ 
        ...filters, 
        isBreached: true 
      });
      
      return total > 0 ? (breached / total) * 100 : 0;
    } catch (error) {
      console.error('Error calculating breach rate:', error);
      return 0;
    }
  }
}

export default AdvancedSlaEngine;
