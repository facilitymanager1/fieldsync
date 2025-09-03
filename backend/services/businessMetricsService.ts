/**
 * Business Metrics Service
 * Comprehensive KPI monitoring, business intelligence, and performance dashboards
 */

import { EventEmitter } from 'events';
import mongoose from 'mongoose';
import { loggingService } from './loggingService';
import { monitoring } from './MonitoringService';

interface KPI {
  id: string;
  name: string;
  description: string;
  category: 'operational' | 'financial' | 'customer' | 'employee' | 'quality';
  calculation: KPICalculation;
  targets: KPITarget[];
  enabled: boolean;
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  tags: Record<string, string>;
}

interface KPICalculation {
  type: 'count' | 'sum' | 'avg' | 'percentage' | 'ratio' | 'custom';
  numerator?: MetricQuery;
  denominator?: MetricQuery;
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  filters?: QueryFilter[];
  customFormula?: string;
}

interface MetricQuery {
  collection: string;
  field?: string;
  filters?: QueryFilter[];
  groupBy?: string[];
  timeField?: string;
}

interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'exists' | 'regex';
  value: any;
}

interface KPITarget {
  name: string;
  type: 'minimum' | 'maximum' | 'range' | 'exact';
  value: number;
  upperBound?: number;
  severity: 'info' | 'warning' | 'critical';
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

interface MetricValue {
  kpiId: string;
  value: number;
  timestamp: Date;
  period: string;
  metadata: Record<string, any>;
  targets: {
    met: boolean;
    details: TargetResult[];
  };
}

interface TargetResult {
  targetName: string;
  expected: number;
  actual: number;
  met: boolean;
  variance: number;
  severity?: string;
}

interface Dashboard {
  id: string;
  name: string;
  description: string;
  category: string;
  widgets: DashboardWidget[];
  access: {
    roles: string[];
    users: string[];
  };
  refreshInterval: number; // in seconds
  enabled: boolean;
}

interface DashboardWidget {
  id: string;
  type: 'kpi' | 'chart' | 'table' | 'gauge' | 'trend' | 'heatmap';
  title: string;
  kpiIds: string[];
  position: { x: number; y: number; width: number; height: number };
  config: Record<string, any>;
}

interface BusinessReport {
  id: string;
  name: string;
  type: 'operational' | 'financial' | 'executive' | 'custom';
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  kpis: string[];
  recipients: string[];
  schedule: string; // cron expression
  template: string;
  enabled: boolean;
}

class BusinessMetricsService extends EventEmitter {
  private kpis: Map<string, KPI> = new Map();
  private metricValues: Map<string, MetricValue[]> = new Map();
  private dashboards: Map<string, Dashboard> = new Map();
  private reports: Map<string, BusinessReport> = new Map();
  private calculationTimer?: NodeJS.Timeout;
  private reportTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.initializeDefaultKPIs();
    this.initializeDefaultDashboards();
    this.startCalculationLoop();
    this.startReportLoop();
  }

  /**
   * Initialize default KPIs for FieldSync
   */
  private initializeDefaultKPIs(): void {
    const defaultKPIs: Omit<KPI, 'id'>[] = [
      // Operational KPIs
      {
        name: 'Average Response Time',
        description: 'Average time to respond to customer tickets',
        category: 'operational',
        calculation: {
          type: 'avg',
          numerator: {
            collection: 'tickets',
            field: 'responseTime',
            filters: [
              { field: 'status', operator: 'ne', value: 'draft' },
              { field: 'createdAt', operator: 'gte', value: 'TODAY' }
            ]
          }
        },
        targets: [
          { name: 'SLA Target', type: 'maximum', value: 240, severity: 'critical', period: 'daily' },
          { name: 'Performance Target', type: 'maximum', value: 120, severity: 'warning', period: 'daily' }
        ],
        enabled: true,
        frequency: 'hourly',
        tags: { department: 'operations', priority: 'high' }
      },
      {
        name: 'Ticket Resolution Rate',
        description: 'Percentage of tickets resolved within SLA',
        category: 'operational',
        calculation: {
          type: 'percentage',
          numerator: {
            collection: 'tickets',
            filters: [
              { field: 'status', operator: 'eq', value: 'resolved' },
              { field: 'slaCompliant', operator: 'eq', value: true },
              { field: 'createdAt', operator: 'gte', value: 'TODAY' }
            ]
          },
          denominator: {
            collection: 'tickets',
            filters: [
              { field: 'status', operator: 'in', value: ['resolved', 'closed'] },
              { field: 'createdAt', operator: 'gte', value: 'TODAY' }
            ]
          }
        },
        targets: [
          { name: 'SLA Compliance', type: 'minimum', value: 95, severity: 'critical', period: 'daily' },
          { name: 'Excellence Target', type: 'minimum', value: 98, severity: 'info', period: 'weekly' }
        ],
        enabled: true,
        frequency: 'hourly',
        tags: { department: 'operations', priority: 'high' }
      },
      {
        name: 'Field Staff Utilization',
        description: 'Percentage of time field staff are actively working',
        category: 'operational',
        calculation: {
          type: 'percentage',
          numerator: {
            collection: 'shifts',
            field: 'activeTime',
            filters: [
              { field: 'status', operator: 'in', value: ['in-progress', 'completed'] },
              { field: 'date', operator: 'gte', value: 'TODAY' }
            ]
          },
          denominator: {
            collection: 'shifts',
            field: 'totalTime',
            filters: [
              { field: 'date', operator: 'gte', value: 'TODAY' }
            ]
          }
        },
        targets: [
          { name: 'Efficiency Target', type: 'minimum', value: 75, severity: 'warning', period: 'daily' },
          { name: 'Optimal Target', type: 'range', value: 80, upperBound: 95, severity: 'info', period: 'weekly' }
        ],
        enabled: true,
        frequency: 'hourly',
        tags: { department: 'operations', priority: 'medium' }
      },
      
      // Customer KPIs
      {
        name: 'Customer Satisfaction Score',
        description: 'Average customer satisfaction rating',
        category: 'customer',
        calculation: {
          type: 'avg',
          numerator: {
            collection: 'feedback',
            field: 'rating',
            filters: [
              { field: 'type', operator: 'eq', value: 'satisfaction' },
              { field: 'createdAt', operator: 'gte', value: 'WEEK_START' }
            ]
          }
        },
        targets: [
          { name: 'Minimum Satisfaction', type: 'minimum', value: 4.0, severity: 'critical', period: 'weekly' },
          { name: 'Excellence Target', type: 'minimum', value: 4.5, severity: 'info', period: 'monthly' }
        ],
        enabled: true,
        frequency: 'daily',
        tags: { department: 'customer-success', priority: 'high' }
      },
      {
        name: 'First Call Resolution Rate',
        description: 'Percentage of issues resolved on first contact',
        category: 'customer',
        calculation: {
          type: 'percentage',
          numerator: {
            collection: 'tickets',
            filters: [
              { field: 'resolvedOnFirstContact', operator: 'eq', value: true },
              { field: 'createdAt', operator: 'gte', value: 'TODAY' }
            ]
          },
          denominator: {
            collection: 'tickets',
            filters: [
              { field: 'status', operator: 'in', value: ['resolved', 'closed'] },
              { field: 'createdAt', operator: 'gte', value: 'TODAY' }
            ]
          }
        },
        targets: [
          { name: 'Performance Target', type: 'minimum', value: 70, severity: 'warning', period: 'daily' },
          { name: 'Excellence Target', type: 'minimum', value: 85, severity: 'info', period: 'weekly' }
        ],
        enabled: true,
        frequency: 'daily',
        tags: { department: 'customer-success', priority: 'medium' }
      },

      // Financial KPIs
      {
        name: 'Revenue per Service',
        description: 'Average revenue generated per service ticket',
        category: 'financial',
        calculation: {
          type: 'avg',
          numerator: {
            collection: 'tickets',
            field: 'billingAmount',
            filters: [
              { field: 'status', operator: 'eq', value: 'completed' },
              { field: 'billingAmount', operator: 'gt', value: 0 },
              { field: 'completedAt', operator: 'gte', value: 'MONTH_START' }
            ]
          }
        },
        targets: [
          { name: 'Minimum Revenue', type: 'minimum', value: 150, severity: 'warning', period: 'monthly' },
          { name: 'Target Revenue', type: 'minimum', value: 200, severity: 'info', period: 'monthly' }
        ],
        enabled: true,
        frequency: 'daily',
        tags: { department: 'finance', priority: 'high' }
      },
      {
        name: 'Cost per Ticket',
        description: 'Average operational cost per resolved ticket',
        category: 'financial',
        calculation: {
          type: 'ratio',
          numerator: {
            collection: 'expenses',
            field: 'amount',
            filters: [
              { field: 'category', operator: 'eq', value: 'operational' },
              { field: 'date', operator: 'gte', value: 'MONTH_START' }
            ]
          },
          denominator: {
            collection: 'tickets',
            filters: [
              { field: 'status', operator: 'eq', value: 'resolved' },
              { field: 'resolvedAt', operator: 'gte', value: 'MONTH_START' }
            ]
          }
        },
        targets: [
          { name: 'Cost Control', type: 'maximum', value: 75, severity: 'warning', period: 'monthly' },
          { name: 'Efficiency Target', type: 'maximum', value: 50, severity: 'info', period: 'monthly' }
        ],
        enabled: true,
        frequency: 'daily',
        tags: { department: 'finance', priority: 'medium' }
      },

      // Employee KPIs
      {
        name: 'Employee Productivity Score',
        description: 'Average tickets completed per employee per day',
        category: 'employee',
        calculation: {
          type: 'avg',
          numerator: {
            collection: 'tickets',
            filters: [
              { field: 'status', operator: 'eq', value: 'completed' },
              { field: 'completedAt', operator: 'gte', value: 'TODAY' }
            ]
          },
          aggregation: 'count'
        },
        targets: [
          { name: 'Minimum Productivity', type: 'minimum', value: 8, severity: 'warning', period: 'daily' },
          { name: 'High Performance', type: 'minimum', value: 12, severity: 'info', period: 'daily' }
        ],
        enabled: true,
        frequency: 'daily',
        tags: { department: 'hr', priority: 'medium' }
      },

      // Quality KPIs
      {
        name: 'Service Quality Score',
        description: 'Composite score based on completion time, customer rating, and compliance',
        category: 'quality',
        calculation: {
          type: 'custom',
          customFormula: '(timeScore * 0.3) + (ratingScore * 0.4) + (complianceScore * 0.3)'
        },
        targets: [
          { name: 'Quality Threshold', type: 'minimum', value: 75, severity: 'warning', period: 'weekly' },
          { name: 'Excellence Target', type: 'minimum', value: 90, severity: 'info', period: 'monthly' }
        ],
        enabled: true,
        frequency: 'daily',
        tags: { department: 'quality', priority: 'high' }
      }
    ];

    defaultKPIs.forEach(kpi => this.createKPI(kpi));
  }

  /**
   * Initialize default dashboards
   */
  private initializeDefaultDashboards(): void {
    const defaultDashboards: Omit<Dashboard, 'id'>[] = [
      {
        name: 'Executive Overview',
        description: 'High-level KPIs for executive leadership',
        category: 'executive',
        widgets: [
          {
            id: 'revenue-gauge',
            type: 'gauge',
            title: 'Monthly Revenue',
            kpiIds: ['revenue-per-service'],
            position: { x: 0, y: 0, width: 6, height: 4 },
            config: { minValue: 0, maxValue: 500000, unit: '$' }
          },
          {
            id: 'satisfaction-trend',
            type: 'trend',
            title: 'Customer Satisfaction Trend',
            kpiIds: ['customer-satisfaction-score'],
            position: { x: 6, y: 0, width: 6, height: 4 },
            config: { period: '30d', showTarget: true }
          },
          {
            id: 'operational-kpis',
            type: 'table',
            title: 'Key Operational Metrics',
            kpiIds: ['ticket-resolution-rate', 'average-response-time', 'field-staff-utilization'],
            position: { x: 0, y: 4, width: 12, height: 6 },
            config: { showTargets: true, highlightVariance: true }
          }
        ],
        access: { roles: ['admin', 'executive'], users: [] },
        refreshInterval: 300, // 5 minutes
        enabled: true
      },
      {
        name: 'Operations Dashboard',
        description: 'Detailed operational metrics and performance indicators',
        category: 'operations',
        widgets: [
          {
            id: 'response-time-chart',
            type: 'chart',
            title: 'Response Time Analysis',
            kpiIds: ['average-response-time'],
            position: { x: 0, y: 0, width: 8, height: 6 },
            config: { type: 'line', period: '7d', groupBy: 'hour' }
          },
          {
            id: 'resolution-rate-gauge',
            type: 'gauge',
            title: 'Resolution Rate',
            kpiIds: ['ticket-resolution-rate'],
            position: { x: 8, y: 0, width: 4, height: 6 },
            config: { minValue: 0, maxValue: 100, unit: '%', thresholds: [70, 85, 95] }
          },
          {
            id: 'staff-utilization-heatmap',
            type: 'heatmap',
            title: 'Staff Utilization by Hour',
            kpiIds: ['field-staff-utilization'],
            position: { x: 0, y: 6, width: 12, height: 6 },
            config: { xAxis: 'hour', yAxis: 'day', aggregation: 'avg' }
          }
        ],
        access: { roles: ['admin', 'operations_manager', 'supervisor'], users: [] },
        refreshInterval: 60, // 1 minute
        enabled: true
      },
      {
        name: 'Customer Success Dashboard',
        description: 'Customer-focused metrics and satisfaction tracking',
        category: 'customer',
        widgets: [
          {
            id: 'satisfaction-score',
            type: 'kpi',
            title: 'Current Satisfaction Score',
            kpiIds: ['customer-satisfaction-score'],
            position: { x: 0, y: 0, width: 4, height: 4 },
            config: { showTrend: true, trendPeriod: '7d' }
          },
          {
            id: 'fcr-rate',
            type: 'kpi',
            title: 'First Call Resolution',
            kpiIds: ['first-call-resolution-rate'],
            position: { x: 4, y: 0, width: 4, height: 4 },
            config: { showTrend: true, trendPeriod: '7d' }
          },
          {
            id: 'satisfaction-trend-detailed',
            type: 'chart',
            title: 'Satisfaction Trend (30 Days)',
            kpiIds: ['customer-satisfaction-score'],
            position: { x: 0, y: 4, width: 12, height: 8 },
            config: { type: 'area', period: '30d', groupBy: 'day', showAverage: true }
          }
        ],
        access: { roles: ['admin', 'customer_success', 'operations_manager'], users: [] },
        refreshInterval: 180, // 3 minutes
        enabled: true
      }
    ];

    defaultDashboards.forEach(dashboard => this.createDashboard(dashboard));
  }

  /**
   * Create a new KPI
   */
  public createKPI(kpi: Omit<KPI, 'id'>): KPI {
    const id = this.generateId();
    const newKPI: KPI = { ...kpi, id };
    
    this.kpis.set(id, newKPI);
    
    loggingService.audit('kpi_created', 'kpi', undefined, {
      kpiId: id,
      name: kpi.name,
      category: kpi.category,
      frequency: kpi.frequency
    });

    this.emit('kpiCreated', newKPI);
    return newKPI;
  }

  /**
   * Update an existing KPI
   */
  public updateKPI(id: string, updates: Partial<KPI>): KPI | null {
    const kpi = this.kpis.get(id);
    if (!kpi) return null;

    const updatedKPI = { ...kpi, ...updates };
    this.kpis.set(id, updatedKPI);

    loggingService.audit('kpi_updated', 'kpi', undefined, {
      kpiId: id,
      updates: Object.keys(updates)
    });

    this.emit('kpiUpdated', updatedKPI);
    return updatedKPI;
  }

  /**
   * Calculate KPI value
   */
  public async calculateKPI(kpiId: string, period?: string): Promise<MetricValue | null> {
    const kpi = this.kpis.get(kpiId);
    if (!kpi || !kpi.enabled) return null;

    try {
      const startTime = Date.now();
      let value: number;

      switch (kpi.calculation.type) {
        case 'count':
          value = await this.calculateCount(kpi.calculation, period);
          break;
        case 'sum':
          value = await this.calculateSum(kpi.calculation, period);
          break;
        case 'avg':
          value = await this.calculateAverage(kpi.calculation, period);
          break;
        case 'percentage':
          value = await this.calculatePercentage(kpi.calculation, period);
          break;
        case 'ratio':
          value = await this.calculateRatio(kpi.calculation, period);
          break;
        case 'custom':
          value = await this.calculateCustom(kpi.calculation, period);
          break;
        default:
          throw new Error(`Unsupported calculation type: ${kpi.calculation.type}`);
      }

      const metricValue: MetricValue = {
        kpiId,
        value,
        timestamp: new Date(),
        period: period || 'current',
        metadata: {
          calculationTime: Date.now() - startTime,
          kpiName: kpi.name,
          category: kpi.category
        },
        targets: this.evaluateTargets(kpi, value)
      };

      // Store the metric value
      if (!this.metricValues.has(kpiId)) {
        this.metricValues.set(kpiId, []);
      }
      this.metricValues.get(kpiId)!.push(metricValue);

      // Keep only last 1000 values per KPI
      const values = this.metricValues.get(kpiId)!;
      if (values.length > 1000) {
        values.splice(0, values.length - 1000);
      }

      // Record to monitoring service
      monitoring.recordMetric(`kpi.${kpi.name.toLowerCase().replace(/\s+/g, '_')}`, value, {
        kpiId,
        category: kpi.category,
        targetsMet: metricValue.targets.met.toString()
      });

      loggingService.performance(`KPI calculated: ${kpi.name}`, Date.now() - startTime, undefined, {
        kpiId,
        value,
        targetsMet: metricValue.targets.met
      });

      this.emit('kpiCalculated', metricValue);
      return metricValue;

    } catch (error) {
      loggingService.error(`Failed to calculate KPI: ${kpi.name}`, error, undefined, {
        kpiId,
        calculation: kpi.calculation
      });
      return null;
    }
  }

  /**
   * Calculate count-based KPIs
   */
  private async calculateCount(calculation: KPICalculation, period?: string): Promise<number> {
    if (!calculation.numerator) throw new Error('Numerator required for count calculation');

    const query = this.buildMongoQuery(calculation.numerator, period);
    const result = await mongoose.connection.db.collection(calculation.numerator.collection).countDocuments(query);
    return result;
  }

  /**
   * Calculate sum-based KPIs
   */
  private async calculateSum(calculation: KPICalculation, period?: string): Promise<number> {
    if (!calculation.numerator) throw new Error('Numerator required for sum calculation');

    const pipeline = this.buildAggregationPipeline(calculation.numerator, period, 'sum');
    const result = await mongoose.connection.db.collection(calculation.numerator.collection).aggregate(pipeline).toArray();
    return result[0]?.total || 0;
  }

  /**
   * Calculate average-based KPIs
   */
  private async calculateAverage(calculation: KPICalculation, period?: string): Promise<number> {
    if (!calculation.numerator) throw new Error('Numerator required for average calculation');

    const pipeline = this.buildAggregationPipeline(calculation.numerator, period, 'avg');
    const result = await mongoose.connection.db.collection(calculation.numerator.collection).aggregate(pipeline).toArray();
    return result[0]?.average || 0;
  }

  /**
   * Calculate percentage-based KPIs
   */
  private async calculatePercentage(calculation: KPICalculation, period?: string): Promise<number> {
    if (!calculation.numerator || !calculation.denominator) {
      throw new Error('Both numerator and denominator required for percentage calculation');
    }

    const numeratorValue = await this.calculateCount(
      { type: 'count', numerator: calculation.numerator }, 
      period
    );
    const denominatorValue = await this.calculateCount(
      { type: 'count', numerator: calculation.denominator }, 
      period
    );

    return denominatorValue > 0 ? (numeratorValue / denominatorValue) * 100 : 0;
  }

  /**
   * Calculate ratio-based KPIs
   */
  private async calculateRatio(calculation: KPICalculation, period?: string): Promise<number> {
    if (!calculation.numerator || !calculation.denominator) {
      throw new Error('Both numerator and denominator required for ratio calculation');
    }

    const numeratorValue = await this.calculateSum(
      { type: 'sum', numerator: calculation.numerator }, 
      period
    );
    const denominatorValue = await this.calculateCount(
      { type: 'count', numerator: calculation.denominator }, 
      period
    );

    return denominatorValue > 0 ? numeratorValue / denominatorValue : 0;
  }

  /**
   * Calculate custom formula KPIs
   */
  private async calculateCustom(calculation: KPICalculation, period?: string): Promise<number> {
    // Placeholder for custom formula evaluation
    // In production, this would use a safe formula evaluator
    return Math.random() * 100; // Temporary implementation
  }

  /**
   * Build MongoDB query from filters
   */
  private buildMongoQuery(metricQuery: MetricQuery, period?: string): any {
    const query: any = {};

    // Apply filters
    if (metricQuery.filters) {
      for (const filter of metricQuery.filters) {
        let value = filter.value;

        // Handle special date values
        if (typeof value === 'string' && value.startsWith('TODAY')) {
          value = new Date();
          value.setHours(0, 0, 0, 0);
        } else if (typeof value === 'string' && value.startsWith('WEEK_START')) {
          value = new Date();
          value.setDate(value.getDate() - value.getDay());
          value.setHours(0, 0, 0, 0);
        } else if (typeof value === 'string' && value.startsWith('MONTH_START')) {
          value = new Date();
          value.setDate(1);
          value.setHours(0, 0, 0, 0);
        }

        switch (filter.operator) {
          case 'eq':
            query[filter.field] = value;
            break;
          case 'ne':
            query[filter.field] = { $ne: value };
            break;
          case 'gt':
            query[filter.field] = { $gt: value };
            break;
          case 'gte':
            query[filter.field] = { $gte: value };
            break;
          case 'lt':
            query[filter.field] = { $lt: value };
            break;
          case 'lte':
            query[filter.field] = { $lte: value };
            break;
          case 'in':
            query[filter.field] = { $in: value };
            break;
          case 'nin':
            query[filter.field] = { $nin: value };
            break;
          case 'exists':
            query[filter.field] = { $exists: value };
            break;
          case 'regex':
            query[filter.field] = { $regex: value, $options: 'i' };
            break;
        }
      }
    }

    return query;
  }

  /**
   * Build aggregation pipeline
   */
  private buildAggregationPipeline(metricQuery: MetricQuery, period: string | undefined, operation: 'sum' | 'avg'): any[] {
    const pipeline: any[] = [];

    // Match stage
    const matchQuery = this.buildMongoQuery(metricQuery, period);
    if (Object.keys(matchQuery).length > 0) {
      pipeline.push({ $match: matchQuery });
    }

    // Group stage
    const groupStage: any = { _id: null };
    
    if (operation === 'sum' && metricQuery.field) {
      groupStage.total = { $sum: `$${metricQuery.field}` };
    } else if (operation === 'avg' && metricQuery.field) {
      groupStage.average = { $avg: `$${metricQuery.field}` };
    }

    pipeline.push({ $group: groupStage });

    return pipeline;
  }

  /**
   * Evaluate KPI targets
   */
  private evaluateTargets(kpi: KPI, value: number): { met: boolean; details: TargetResult[] } {
    const results: TargetResult[] = [];
    let overallMet = true;

    for (const target of kpi.targets) {
      let met = false;
      const variance = ((value - target.value) / target.value) * 100;

      switch (target.type) {
        case 'minimum':
          met = value >= target.value;
          break;
        case 'maximum':
          met = value <= target.value;
          break;
        case 'range':
          met = value >= target.value && (!target.upperBound || value <= target.upperBound);
          break;
        case 'exact':
          met = Math.abs(value - target.value) < 0.01; // Allow small floating point differences
          break;
      }

      if (!met) overallMet = false;

      results.push({
        targetName: target.name,
        expected: target.value,
        actual: value,
        met,
        variance,
        severity: target.severity
      });
    }

    return { met: overallMet, details: results };
  }

  /**
   * Create a dashboard
   */
  public createDashboard(dashboard: Omit<Dashboard, 'id'>): Dashboard {
    const id = this.generateId();
    const newDashboard: Dashboard = { ...dashboard, id };
    
    this.dashboards.set(id, newDashboard);
    
    loggingService.audit('dashboard_created', 'dashboard', undefined, {
      dashboardId: id,
      name: dashboard.name,
      category: dashboard.category,
      widgetCount: dashboard.widgets.length
    });

    return newDashboard;
  }

  /**
   * Get dashboard data
   */
  public async getDashboardData(dashboardId: string): Promise<any> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return null;

    const data: any = {
      dashboard,
      widgets: {},
      lastUpdated: new Date()
    };

    // Get data for each widget
    for (const widget of dashboard.widgets) {
      const widgetData: any = {
        type: widget.type,
        title: widget.title,
        config: widget.config,
        data: []
      };

      // Get KPI data for widget
      for (const kpiId of widget.kpiIds) {
        const kpi = this.kpis.get(kpiId);
        if (!kpi) continue;

        const latestValue = await this.getLatestKPIValue(kpiId);
        const historicalData = this.getKPIHistory(kpiId, widget.config.period || '24h');

        widgetData.data.push({
          kpiId,
          kpiName: kpi.name,
          currentValue: latestValue,
          historical: historicalData,
          targets: kpi.targets
        });
      }

      data.widgets[widget.id] = widgetData;
    }

    return data;
  }

  /**
   * Get latest KPI value
   */
  public async getLatestKPIValue(kpiId: string): Promise<MetricValue | null> {
    const values = this.metricValues.get(kpiId);
    if (!values || values.length === 0) {
      // Calculate fresh value if none exists
      return await this.calculateKPI(kpiId);
    }

    return values[values.length - 1];
  }

  /**
   * Get KPI history
   */
  public getKPIHistory(kpiId: string, period: string = '24h'): MetricValue[] {
    const values = this.metricValues.get(kpiId) || [];
    const now = new Date();
    
    // Parse period (e.g., "24h", "7d", "30d")
    const match = period.match(/^(\d+)([hdwm])$/);
    if (!match) return values;

    const amount = parseInt(match[1]);
    const unit = match[2];
    
    let cutoffTime: Date;
    switch (unit) {
      case 'h':
        cutoffTime = new Date(now.getTime() - amount * 60 * 60 * 1000);
        break;
      case 'd':
        cutoffTime = new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
        break;
      case 'w':
        cutoffTime = new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
        break;
      case 'm':
        cutoffTime = new Date(now.getTime() - amount * 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return values;
    }

    return values.filter(value => value.timestamp >= cutoffTime);
  }

  /**
   * Start calculation loop
   */
  private startCalculationLoop(): void {
    this.calculationTimer = setInterval(async () => {
      await this.calculateAllKPIs();
    }, 60000); // Calculate every minute
  }

  /**
   * Calculate all enabled KPIs
   */
  private async calculateAllKPIs(): Promise<void> {
    const kpisToCalculate = Array.from(this.kpis.values()).filter(kpi => kpi.enabled);
    
    for (const kpi of kpisToCalculate) {
      try {
        await this.calculateKPI(kpi.id);
      } catch (error) {
        loggingService.error(`Failed to calculate KPI in loop: ${kpi.name}`, error);
      }
    }
  }

  /**
   * Start report generation loop
   */
  private startReportLoop(): void {
    this.reportTimer = setInterval(() => {
      this.processScheduledReports();
    }, 60000); // Check every minute
  }

  /**
   * Process scheduled reports
   */
  private processScheduledReports(): void {
    // Implementation for scheduled report generation
    // This would check cron schedules and generate reports
  }

  /**
   * Get business insights
   */
  public async getBusinessInsights(): Promise<any> {
    const insights = {
      summary: {
        totalKPIs: this.kpis.size,
        activeKPIs: Array.from(this.kpis.values()).filter(k => k.enabled).length,
        criticalAlerts: 0,
        overallHealthScore: 0
      },
      trends: [],
      alerts: [],
      recommendations: []
    };

    // Calculate health score and generate insights
    let totalScore = 0;
    let scoredKPIs = 0;

    for (const kpi of this.kpis.values()) {
      if (!kpi.enabled) continue;

      const latestValue = await this.getLatestKPIValue(kpi.id);
      if (!latestValue) continue;

      scoredKPIs++;
      
      // Simple scoring: 100 if all targets met, proportional otherwise
      const score = latestValue.targets.met ? 100 : 
        latestValue.targets.details.reduce((sum, target) => sum + (target.met ? 100 : 0), 0) / latestValue.targets.details.length;
      
      totalScore += score;

      // Check for critical alerts
      if (!latestValue.targets.met) {
        const criticalTargets = latestValue.targets.details.filter(t => !t.met && t.severity === 'critical');
        insights.summary.criticalAlerts += criticalTargets.length;
        
        criticalTargets.forEach(target => {
          insights.alerts.push({
            kpiId: kpi.id,
            kpiName: kpi.name,
            targetName: target.targetName,
            expected: target.expected,
            actual: target.actual,
            variance: target.variance,
            severity: target.severity
          });
        });
      }
    }

    insights.summary.overallHealthScore = scoredKPIs > 0 ? Math.round(totalScore / scoredKPIs) : 0;

    return insights;
  }

  /**
   * Utility methods
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Public API methods
   */
  public getKPIs(): KPI[] {
    return Array.from(this.kpis.values());
  }

  public getKPI(id: string): KPI | undefined {
    return this.kpis.get(id);
  }

  public getDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  public getDashboard(id: string): Dashboard | undefined {
    return this.dashboards.get(id);
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.calculationTimer) {
      clearInterval(this.calculationTimer);
    }
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
    }

    loggingService.info('Business Metrics service shut down gracefully');
  }
}

// Export singleton instance
export const businessMetricsService = new BusinessMetricsService();

// Export types and classes
export { 
  BusinessMetricsService, 
  KPI, 
  MetricValue, 
  Dashboard, 
  DashboardWidget, 
  BusinessReport 
};