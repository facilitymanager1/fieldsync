// Metrics Collector for SLA Engine
// Collects and stores SLA performance metrics
import { SlaTracker } from '../models/advancedSla';

export interface SlaMetrics {
  trackerId: string;
  eventType: 'created' | 'updated' | 'resolved' | 'breached' | 'escalated';
  timestamp: Date;
  entityType: string;
  responseTime?: number;
  resolutionTime?: number;
  isBreached: boolean;
  escalationLevel: number;
  clientId?: string;
  priority?: string;
}

export class MetricsCollector {
  private metrics: SlaMetrics[] = [];

  async recordSlaCreated(tracker: SlaTracker): Promise<void> {
    const metric: SlaMetrics = {
      trackerId: tracker.id,
      eventType: 'created',
      timestamp: new Date(),
      entityType: tracker.entityType,
      isBreached: tracker.isBreached,
      escalationLevel: tracker.escalationLevel,
    };

    this.metrics.push(metric);
    console.log(`SLA metrics recorded: Created tracker ${tracker.id}`);
  }

  async recordSlaUpdate(tracker: SlaTracker, updates: Partial<SlaTracker>): Promise<void> {
    const metric: SlaMetrics = {
      trackerId: tracker.id,
      eventType: 'updated',
      timestamp: new Date(),
      entityType: tracker.entityType,
      responseTime: tracker.actualResponseHours,
      resolutionTime: tracker.actualResolutionHours,
      isBreached: tracker.isBreached,
      escalationLevel: tracker.escalationLevel,
    };

    this.metrics.push(metric);
    console.log(`SLA metrics recorded: Updated tracker ${tracker.id}`);
  }

  async recordSlaResolved(tracker: SlaTracker): Promise<void> {
    const metric: SlaMetrics = {
      trackerId: tracker.id,
      eventType: 'resolved',
      timestamp: new Date(),
      entityType: tracker.entityType,
      responseTime: tracker.actualResponseHours,
      resolutionTime: tracker.actualResolutionHours,
      isBreached: tracker.isBreached,
      escalationLevel: tracker.escalationLevel,
    };

    this.metrics.push(metric);
    console.log(`SLA metrics recorded: Resolved tracker ${tracker.id}`);
  }

  async recordResponseSlaCompliance(tracker: SlaTracker, isCompliant: boolean): Promise<void> {
    const metric: SlaMetrics = {
      trackerId: tracker.id,
      eventType: isCompliant ? 'updated' : 'breached',
      timestamp: new Date(),
      entityType: tracker.entityType,
      responseTime: tracker.actualResponseHours,
      isBreached: !isCompliant,
      escalationLevel: tracker.escalationLevel,
    };

    this.metrics.push(metric);
    console.log(`SLA metrics recorded: Response compliance ${isCompliant} for tracker ${tracker.id}`);
  }

  async recordBreach(tracker: SlaTracker, breachType: 'response' | 'resolution'): Promise<void> {
    const metric: SlaMetrics = {
      trackerId: tracker.id,
      eventType: 'breached',
      timestamp: new Date(),
      entityType: tracker.entityType,
      responseTime: tracker.actualResponseHours,
      resolutionTime: tracker.actualResolutionHours,
      isBreached: true,
      escalationLevel: tracker.escalationLevel,
    };

    this.metrics.push(metric);
    console.log(`SLA metrics recorded: ${breachType} breach for tracker ${tracker.id}`);
  }

  async getMetricsSummary(timeRange?: { start: Date; end: Date }): Promise<{
    totalSlas: number;
    breachedSlas: number;
    complianceRate: number;
    averageResponseTime: number;
    averageResolutionTime: number;
  }> {
    let filteredMetrics = this.metrics;
    
    if (timeRange) {
      filteredMetrics = this.metrics.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    const resolvedMetrics = filteredMetrics.filter(m => m.eventType === 'resolved');
    const breachedCount = resolvedMetrics.filter(m => m.isBreached).length;
    const totalCount = resolvedMetrics.length;
    
    const avgResponseTime = resolvedMetrics.reduce((sum, m) => sum + (m.responseTime || 0), 0) / totalCount || 0;
    const avgResolutionTime = resolvedMetrics.reduce((sum, m) => sum + (m.resolutionTime || 0), 0) / totalCount || 0;

    return {
      totalSlas: totalCount,
      breachedSlas: breachedCount,
      complianceRate: totalCount > 0 ? ((totalCount - breachedCount) / totalCount) * 100 : 100,
      averageResponseTime: avgResponseTime,
      averageResolutionTime: avgResolutionTime,
    };
  }
}
