/**
 * Real-Time Analytics Service for FieldSync
 * Provides live data processing, WebSocket broadcasting, and analytics aggregation
 * Phase 5: Real-time Analytics Dashboard Implementation
 */

import { EventEmitter } from 'events';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { monitoringService } from './monitoring';
import { auditLogger } from '../middleware/auditLogger';

export interface AnalyticsMetrics {
  // System Performance Metrics
  systemMetrics: {
    activeUsers: number;
    totalSessions: number;
    averageResponseTime: number;
    systemLoad: number;
    memoryUsage: number;
    diskUsage: number;
    networkThroughput: number;
    errorRate: number;
  };

  // Business Metrics
  businessMetrics: {
    activeTickets: number;
    ticketsCreatedToday: number;
    ticketsResolvedToday: number;
    averageResolutionTime: number;
    slaCompliance: number;
    activeShifts: number;
    staffUtilization: number;
    clientSatisfaction: number;
  };

  // Operational Metrics
  operationalMetrics: {
    totalSites: number;
    activeSites: number;
    totalStaff: number;
    activeStaff: number;
    upcomingSchedules: number;
    overdueTickets: number;
    criticalAlerts: number;
    maintenanceEvents: number;
  };

  // Financial Metrics
  financialMetrics: {
    revenueToday: number;
    revenueThisMonth: number;
    costSavings: number;
    efficiency: number;
    budgetUtilization: number;
    profitMargin: number;
  };
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    borderWidth?: number;
    type?: 'line' | 'bar' | 'pie' | 'doughnut' | 'scatter' | 'area';
  }[];
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'map' | 'gauge' | 'alert';
  title: string;
  description?: string;
  data: any;
  config: {
    refreshInterval: number; // milliseconds
    size: { width: number; height: number };
    position: { x: number; y: number };
    filters?: Record<string, any>;
    thresholds?: {
      warning: number;
      critical: number;
    };
  };
  lastUpdated: Date;
  isActive: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string; // JSON rules engine expression
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recipients: string[];
  cooldown: number; // minutes
  isActive: boolean;
  lastTriggered?: Date;
}

class RealTimeAnalyticsService extends EventEmitter {
  private io: SocketIOServer | null = null;
  private redis: Redis;
  private widgets: Map<string, DashboardWidget> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private metrics: AnalyticsMetrics;
  private timeSeriesBuffer: Map<string, TimeSeriesData[]> = new Map();
  private activeConnections: Set<string> = new Set();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.metrics = this.initializeMetrics();
    this.initializeService();
  }

  private initializeMetrics(): AnalyticsMetrics {
    return {
      systemMetrics: {
        activeUsers: 0,
        totalSessions: 0,
        averageResponseTime: 0,
        systemLoad: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkThroughput: 0,
        errorRate: 0
      },
      businessMetrics: {
        activeTickets: 0,
        ticketsCreatedToday: 0,
        ticketsResolvedToday: 0,
        averageResolutionTime: 0,
        slaCompliance: 0,
        activeShifts: 0,
        staffUtilization: 0,
        clientSatisfaction: 0
      },
      operationalMetrics: {
        totalSites: 0,
        activeSites: 0,
        totalStaff: 0,
        activeStaff: 0,
        upcomingSchedules: 0,
        overdueTickets: 0,
        criticalAlerts: 0,
        maintenanceEvents: 0
      },
      financialMetrics: {
        revenueToday: 0,
        revenueThisMonth: 0,
        costSavings: 0,
        efficiency: 0,
        budgetUtilization: 0,
        profitMargin: 0
      }
    };
  }

  private async initializeService(): Promise<void> {
    try {
      // Load persisted widgets and alert rules
      await this.loadWidgetsFromRedis();
      await this.loadAlertRulesFromRedis();
      
      // Start data collection and processing
      this.startDataCollection();
      this.startAlertProcessing();
      
      console.log('Real-time Analytics Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Real-time Analytics Service:', error);
    }
  }

  /**
   * Initialize Socket.IO server for real-time communication
   */
  initializeSocketIO(io: SocketIOServer): void {
    this.io = io;

    io.on('connection', (socket) => {
      this.activeConnections.add(socket.id);
      console.log(`Analytics client connected: ${socket.id}`);

      // Send initial data
      socket.emit('analytics:initial', {
        metrics: this.metrics,
        widgets: Array.from(this.widgets.values()),
        timestamp: new Date()
      });

      // Handle widget subscription
      socket.on('analytics:subscribe', (widgetIds: string[]) => {
        widgetIds.forEach(widgetId => {
          socket.join(`widget:${widgetId}`);
        });
      });

      // Handle widget unsubscription
      socket.on('analytics:unsubscribe', (widgetIds: string[]) => {
        widgetIds.forEach(widgetId => {
          socket.leave(`widget:${widgetId}`);
        });
      });

      // Handle custom queries
      socket.on('analytics:query', async (query, callback) => {
        try {
          const result = await this.executeCustomQuery(query);
          callback({ success: true, data: result });
        } catch (error) {
          callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      });

      socket.on('disconnect', () => {
        this.activeConnections.delete(socket.id);
        console.log(`Analytics client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Start continuous data collection from various sources
   */
  private startDataCollection(): void {
    // System metrics collection (every 30 seconds)
    setInterval(async () => {
      await this.collectSystemMetrics();
    }, 30000);

    // Business metrics collection (every 60 seconds)
    setInterval(async () => {
      await this.collectBusinessMetrics();
    }, 60000);

    // Operational metrics collection (every 120 seconds)
    setInterval(async () => {
      await this.collectOperationalMetrics();
    }, 120000);

    // Financial metrics collection (every 300 seconds)
    setInterval(async () => {
      await this.collectFinancialMetrics();
    }, 300000);

    // Broadcast updates to connected clients
    setInterval(() => {
      this.broadcastMetricsUpdate();
    }, 15000);
  }

  /**
   * Collect system performance metrics
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      const systemHealth = monitoringService.getSystemHealth();
      const performanceMetrics = monitoringService.getPerformanceMetrics();

      this.metrics.systemMetrics = {
        activeUsers: this.activeConnections.size,
        totalSessions: await this.getActiveSessions(),
        averageResponseTime: performanceMetrics.averageResponseTime || 0,
        systemLoad: systemHealth.system.cpu,
        memoryUsage: systemHealth.system.memory,
        diskUsage: systemHealth.system.disk,
        networkThroughput: performanceMetrics.networkThroughput || 0,
        errorRate: performanceMetrics.errorRate || 0
      };

      // Store time series data
      this.addTimeSeriesData('system.activeUsers', this.metrics.systemMetrics.activeUsers);
      this.addTimeSeriesData('system.responseTime', this.metrics.systemMetrics.averageResponseTime);
      this.addTimeSeriesData('system.cpuUsage', this.metrics.systemMetrics.systemLoad);

      this.emit('systemMetricsUpdated', this.metrics.systemMetrics);
    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }
  }

  /**
   * Collect business-related metrics
   */
  private async collectBusinessMetrics(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Tickets metrics
      const ticketStats = await this.aggregateTicketMetrics(today);
      const slaStats = await this.aggregateSLAMetrics();
      const shiftStats = await this.aggregateShiftMetrics();

      this.metrics.businessMetrics = {
        activeTickets: ticketStats.active,
        ticketsCreatedToday: ticketStats.createdToday,
        ticketsResolvedToday: ticketStats.resolvedToday,
        averageResolutionTime: ticketStats.avgResolutionTime,
        slaCompliance: slaStats.complianceRate,
        activeShifts: shiftStats.activeShifts,
        staffUtilization: shiftStats.utilization,
        clientSatisfaction: await this.calculateClientSatisfaction()
      };

      // Store time series data
      this.addTimeSeriesData('business.activeTickets', this.metrics.businessMetrics.activeTickets);
      this.addTimeSeriesData('business.slaCompliance', this.metrics.businessMetrics.slaCompliance);
      this.addTimeSeriesData('business.staffUtilization', this.metrics.businessMetrics.staffUtilization);

      this.emit('businessMetricsUpdated', this.metrics.businessMetrics);
    } catch (error) {
      console.error('Error collecting business metrics:', error);
    }
  }

  /**
   * Collect operational metrics
   */
  private async collectOperationalMetrics(): Promise<void> {
    try {
      const operationalData = await this.aggregateOperationalData();

      this.metrics.operationalMetrics = {
        totalSites: operationalData.totalSites,
        activeSites: operationalData.activeSites,
        totalStaff: operationalData.totalStaff,
        activeStaff: operationalData.activeStaff,
        upcomingSchedules: operationalData.upcomingSchedules,
        overdueTickets: operationalData.overdueTickets,
        criticalAlerts: operationalData.criticalAlerts,
        maintenanceEvents: operationalData.maintenanceEvents
      };

      this.emit('operationalMetricsUpdated', this.metrics.operationalMetrics);
    } catch (error) {
      console.error('Error collecting operational metrics:', error);
    }
  }

  /**
   * Collect financial metrics
   */
  private async collectFinancialMetrics(): Promise<void> {
    try {
      const financialData = await this.aggregateFinancialData();

      this.metrics.financialMetrics = {
        revenueToday: financialData.revenueToday,
        revenueThisMonth: financialData.revenueThisMonth,
        costSavings: financialData.costSavings,
        efficiency: financialData.efficiency,
        budgetUtilization: financialData.budgetUtilization,
        profitMargin: financialData.profitMargin
      };

      this.emit('financialMetricsUpdated', this.metrics.financialMetrics);
    } catch (error) {
      console.error('Error collecting financial metrics:', error);
    }
  }

  /**
   * Aggregate ticket-related metrics
   */
  private async aggregateTicketMetrics(since: Date): Promise<{
    active: number;
    createdToday: number;
    resolvedToday: number;
    avgResolutionTime: number;
  }> {
    const TicketModel = mongoose.model('Ticket');

    const [activeTickets, createdToday, resolvedToday, avgResolution] = await Promise.all([
      TicketModel.countDocuments({ status: { $in: ['open', 'in_progress', 'assigned'] } }),
      TicketModel.countDocuments({ createdAt: { $gte: since } }),
      TicketModel.countDocuments({ 
        status: 'resolved',
        updatedAt: { $gte: since }
      }),
      TicketModel.aggregate([
        {
          $match: {
            status: 'resolved',
            resolvedAt: { $exists: true }
          }
        },
        {
          $group: {
            _id: null,
            avgTime: {
              $avg: {
                $subtract: ['$resolvedAt', '$createdAt']
              }
            }
          }
        }
      ])
    ]);

    return {
      active: activeTickets,
      createdToday: createdToday,
      resolvedToday: resolvedToday,
      avgResolutionTime: avgResolution[0]?.avgTime || 0
    };
  }

  /**
   * Aggregate SLA compliance metrics
   */
  private async aggregateSLAMetrics(): Promise<{ complianceRate: number }> {
    const SLATrackerModel = mongoose.model('SLATracker');

    const complianceStats = await SLATrackerModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          compliant: {
            $sum: {
              $cond: [{ $eq: ['$status', 'met'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const stats = complianceStats[0] || { total: 0, compliant: 0 };
    return {
      complianceRate: stats.total > 0 ? (stats.compliant / stats.total) * 100 : 0
    };
  }

  /**
   * Aggregate shift-related metrics
   */
  private async aggregateShiftMetrics(): Promise<{
    activeShifts: number;
    utilization: number;
  }> {
    const ShiftModel = mongoose.model('Shift');
    const StaffModel = mongoose.model('Staff');

    const [activeShifts, totalStaff, activeStaff] = await Promise.all([
      ShiftModel.countDocuments({ status: 'active' }),
      StaffModel.countDocuments({ isActive: true }),
      ShiftModel.countDocuments({ 
        status: 'active',
        startTime: { $lte: new Date() },
        endTime: { $gte: new Date() }
      })
    ]);

    return {
      activeShifts,
      utilization: totalStaff > 0 ? (activeStaff / totalStaff) * 100 : 0
    };
  }

  /**
   * Calculate client satisfaction score
   */
  private async calculateClientSatisfaction(): Promise<number> {
    // This would typically aggregate from feedback/rating systems
    // For now, return a calculated score based on SLA compliance and ticket resolution
    const slaCompliance = this.metrics.businessMetrics.slaCompliance;
    const ticketResolutionRate = this.metrics.businessMetrics.ticketsResolvedToday > 0 ? 
      (this.metrics.businessMetrics.ticketsResolvedToday / 
       (this.metrics.businessMetrics.ticketsCreatedToday + this.metrics.businessMetrics.ticketsResolvedToday)) * 100 : 0;

    return Math.min(100, (slaCompliance * 0.6 + ticketResolutionRate * 0.4));
  }

  /**
   * Aggregate operational data
   */
  private async aggregateOperationalData(): Promise<{
    totalSites: number;
    activeSites: number;
    totalStaff: number;
    activeStaff: number;
    upcomingSchedules: number;
    overdueTickets: number;
    criticalAlerts: number;
    maintenanceEvents: number;
  }> {
    const SiteModel = mongoose.model('Site');
    const StaffModel = mongoose.model('Staff');
    const TicketModel = mongoose.model('Ticket');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const [
      totalSites,
      activeSites,
      totalStaff,
      activeStaff,
      overdueTickets,
      upcomingSchedules
    ] = await Promise.all([
      SiteModel.countDocuments({}),
      SiteModel.countDocuments({ isActive: true }),
      StaffModel.countDocuments({}),
      StaffModel.countDocuments({ isActive: true }),
      TicketModel.countDocuments({
        dueDate: { $lt: new Date() },
        status: { $nin: ['resolved', 'closed'] }
      }),
      mongoose.model('Schedule').countDocuments({
        scheduledDate: {
          $gte: new Date(),
          $lt: tomorrow
        }
      }).catch(() => 0) // Handle if Schedule model doesn't exist
    ]);

    return {
      totalSites,
      activeSites,
      totalStaff,
      activeStaff,
      upcomingSchedules,
      overdueTickets,
      criticalAlerts: 0, // Would be populated from alert system
      maintenanceEvents: 0 // Would be populated from maintenance system
    };
  }

  /**
   * Aggregate financial data
   */
  private async aggregateFinancialData(): Promise<{
    revenueToday: number;
    revenueThisMonth: number;
    costSavings: number;
    efficiency: number;
    budgetUtilization: number;
    profitMargin: number;
  }> {
    // This would typically integrate with financial/billing systems
    // For now, return calculated estimates based on operational metrics
    const ticketsResolved = this.metrics.businessMetrics.ticketsResolvedToday;
    const avgTicketValue = 150; // Estimated average ticket value

    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
      revenueToday: ticketsResolved * avgTicketValue,
      revenueThisMonth: await this.calculateMonthlyRevenue(monthStart),
      costSavings: await this.calculateCostSavings(),
      efficiency: this.metrics.businessMetrics.staffUtilization,
      budgetUtilization: 75, // Would come from budget tracking system
      profitMargin: 25 // Would come from financial system
    };
  }

  private async calculateMonthlyRevenue(since: Date): Promise<number> {
    const TicketModel = mongoose.model('Ticket');
    
    const resolvedThisMonth = await TicketModel.countDocuments({
      status: 'resolved',
      updatedAt: { $gte: since }
    });

    return resolvedThisMonth * 150; // Estimated average ticket value
  }

  private async calculateCostSavings(): Promise<number> {
    // Calculate cost savings from automation, efficiency improvements, etc.
    const efficiency = this.metrics.businessMetrics.staffUtilization;
    const baseCost = 1000; // Base daily operational cost
    
    return baseCost * (efficiency / 100) * 0.2; // 20% savings from efficiency
  }

  /**
   * Get number of active sessions
   */
  private async getActiveSessions(): Promise<number> {
    try {
      const keys = await this.redis.keys('session:*');
      return keys.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Add time series data point
   */
  private addTimeSeriesData(metric: string, value: number): void {
    if (!this.timeSeriesBuffer.has(metric)) {
      this.timeSeriesBuffer.set(metric, []);
    }

    const data = this.timeSeriesBuffer.get(metric)!;
    data.push({
      timestamp: new Date(),
      value
    });

    // Keep only last 1000 data points
    if (data.length > 1000) {
      data.shift();
    }

    // Store in Redis for persistence
    this.redis.lpush(`timeseries:${metric}`, JSON.stringify({
      timestamp: new Date().toISOString(),
      value
    }));

    // Keep only last 1000 entries in Redis
    this.redis.ltrim(`timeseries:${metric}`, 0, 999);
  }

  /**
   * Broadcast metrics update to all connected clients
   */
  private broadcastMetricsUpdate(): void {
    if (!this.io) return;

    this.io.emit('analytics:metrics', {
      metrics: this.metrics,
      timestamp: new Date()
    });

    // Update specific widget data
    this.widgets.forEach((widget) => {
      if (widget.isActive) {
        this.io!.to(`widget:${widget.id}`).emit('analytics:widget:update', {
          widgetId: widget.id,
          data: widget.data,
          timestamp: new Date()
        });
      }
    });
  }

  /**
   * Execute custom analytics query
   */
  private async executeCustomQuery(query: {
    collection: string;
    aggregation?: any[];
    filters?: any;
    timeRange?: { start: Date; end: Date };
  }): Promise<any> {
    try {
      const Model = mongoose.model(query.collection);
      
      let pipeline: any[] = [];

      // Add time range filter if provided
      if (query.timeRange) {
        pipeline.push({
          $match: {
            createdAt: {
              $gte: query.timeRange.start,
              $lte: query.timeRange.end
            }
          }
        });
      }

      // Add custom filters
      if (query.filters) {
        pipeline.push({ $match: query.filters });
      }

      // Add custom aggregation pipeline
      if (query.aggregation) {
        pipeline.push(...query.aggregation);
      }

      const result = await Model.aggregate(pipeline);
      return result;

    } catch (error) {
      console.error('Custom query execution error:', error);
      throw error;
    }
  }

  /**
   * Create or update dashboard widget
   */
  async createWidget(widget: Omit<DashboardWidget, 'id' | 'lastUpdated'>): Promise<string> {
    const widgetId = `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newWidget: DashboardWidget = {
      id: widgetId,
      ...widget,
      lastUpdated: new Date(),
      isActive: true
    };

    this.widgets.set(widgetId, newWidget);
    await this.saveWidgetToRedis(newWidget);

    // Start update interval if needed
    if (newWidget.config.refreshInterval > 0) {
      this.startWidgetUpdates(widgetId);
    }

    this.emit('widgetCreated', newWidget);
    return widgetId;
  }

  /**
   * Update existing widget
   */
  async updateWidget(widgetId: string, updates: Partial<DashboardWidget>): Promise<boolean> {
    const widget = this.widgets.get(widgetId);
    if (!widget) return false;

    const updatedWidget = {
      ...widget,
      ...updates,
      lastUpdated: new Date()
    };

    this.widgets.set(widgetId, updatedWidget);
    await this.saveWidgetToRedis(updatedWidget);

    // Restart update interval if refresh rate changed
    if (updates.config?.refreshInterval !== undefined) {
      this.stopWidgetUpdates(widgetId);
      this.startWidgetUpdates(widgetId);
    }

    this.emit('widgetUpdated', updatedWidget);
    return true;
  }

  /**
   * Delete widget
   */
  async deleteWidget(widgetId: string): Promise<boolean> {
    const widget = this.widgets.get(widgetId);
    if (!widget) return false;

    this.widgets.delete(widgetId);
    this.stopWidgetUpdates(widgetId);
    await this.redis.hdel('analytics:widgets', widgetId);

    this.emit('widgetDeleted', widgetId);
    return true;
  }

  /**
   * Get all widgets
   */
  getWidgets(userId?: string): DashboardWidget[] {
    // In a real implementation, you'd filter by user permissions
    return Array.from(this.widgets.values());
  }

  /**
   * Get widget by ID
   */
  getWidget(widgetId: string): DashboardWidget | null {
    return this.widgets.get(widgetId) || null;
  }

  /**
   * Start widget update interval
   */
  private startWidgetUpdates(widgetId: string): void {
    const widget = this.widgets.get(widgetId);
    if (!widget || widget.config.refreshInterval <= 0) return;

    const interval = setInterval(async () => {
      try {
        await this.updateWidgetData(widgetId);
      } catch (error) {
        console.error(`Error updating widget ${widgetId}:`, error);
      }
    }, widget.config.refreshInterval);

    this.updateIntervals.set(widgetId, interval);
  }

  /**
   * Stop widget update interval
   */
  private stopWidgetUpdates(widgetId: string): void {
    const interval = this.updateIntervals.get(widgetId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(widgetId);
    }
  }

  /**
   * Update widget data based on its type and configuration
   */
  private async updateWidgetData(widgetId: string): Promise<void> {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;

    let updatedData;

    switch (widget.type) {
      case 'metric':
        updatedData = await this.generateMetricData(widget);
        break;
      case 'chart':
        updatedData = await this.generateChartData(widget);
        break;
      case 'table':
        updatedData = await this.generateTableData(widget);
        break;
      case 'map':
        updatedData = await this.generateMapData(widget);
        break;
      case 'gauge':
        updatedData = await this.generateGaugeData(widget);
        break;
      case 'alert':
        updatedData = await this.generateAlertData(widget);
        break;
      default:
        return;
    }

    widget.data = updatedData;
    widget.lastUpdated = new Date();

    // Broadcast update to subscribers
    if (this.io) {
      this.io.to(`widget:${widgetId}`).emit('analytics:widget:update', {
        widgetId,
        data: updatedData,
        timestamp: widget.lastUpdated
      });
    }
  }

  private async generateMetricData(widget: DashboardWidget): Promise<any> {
    // Generate metric data based on widget configuration
    return {
      value: Math.floor(Math.random() * 1000), // Placeholder
      change: Math.floor(Math.random() * 20) - 10,
      trend: Math.random() > 0.5 ? 'up' : 'down'
    };
  }

  private async generateChartData(widget: DashboardWidget): Promise<ChartData> {
    // Generate chart data based on widget configuration
    const timeSeriesKey = widget.config.filters?.metric || 'system.activeUsers';
    const data = this.timeSeriesBuffer.get(timeSeriesKey) || [];
    
    const last24Hours = data.filter(d => 
      d.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000
    );

    return {
      labels: last24Hours.map(d => d.timestamp.toLocaleTimeString()),
      datasets: [{
        label: widget.title,
        data: last24Hours.map(d => d.value),
        borderColor: '#3498db',
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        type: 'line'
      }]
    };
  }

  private async generateTableData(widget: DashboardWidget): Promise<any> {
    // Generate table data based on widget configuration
    return {
      headers: ['Name', 'Status', 'Value', 'Updated'],
      rows: [
        ['System Load', 'Normal', '65%', new Date().toLocaleTimeString()],
        ['Active Users', 'Normal', '127', new Date().toLocaleTimeString()],
        ['Error Rate', 'Warning', '2.3%', new Date().toLocaleTimeString()]
      ]
    };
  }

  private async generateMapData(widget: DashboardWidget): Promise<any> {
    // Generate map data for site/staff locations
    return {
      markers: [
        { lat: 40.7128, lng: -74.0060, label: 'Site A', status: 'active' },
        { lat: 34.0522, lng: -118.2437, label: 'Site B', status: 'inactive' }
      ]
    };
  }

  private async generateGaugeData(widget: DashboardWidget): Promise<any> {
    // Generate gauge data
    return {
      value: Math.floor(Math.random() * 100),
      min: 0,
      max: 100,
      thresholds: widget.config.thresholds || { warning: 70, critical: 90 }
    };
  }

  private async generateAlertData(widget: DashboardWidget): Promise<any> {
    // Generate alert/notification data
    return {
      alerts: [
        { id: '1', type: 'warning', message: 'High CPU usage detected', timestamp: new Date() },
        { id: '2', type: 'info', message: 'System backup completed', timestamp: new Date() }
      ]
    };
  }

  /**
   * Start alert processing
   */
  private startAlertProcessing(): void {
    setInterval(async () => {
      await this.processAlertRules();
    }, 60000); // Check every minute
  }

  /**
   * Process alert rules and trigger notifications
   */
  private async processAlertRules(): Promise<void> {
    for (const [ruleId, rule] of this.alertRules.entries()) {
      if (!rule.isActive) continue;

      try {
        const shouldTrigger = await this.evaluateAlertRule(rule);
        
        if (shouldTrigger) {
          const now = new Date();
          const cooldownPassed = !rule.lastTriggered || 
            (now.getTime() - rule.lastTriggered.getTime()) > (rule.cooldown * 60 * 1000);

          if (cooldownPassed) {
            await this.triggerAlert(rule);
            rule.lastTriggered = now;
            await this.saveAlertRuleToRedis(rule);
          }
        }
      } catch (error) {
        console.error(`Error processing alert rule ${ruleId}:`, error);
      }
    }
  }

  private async evaluateAlertRule(rule: AlertRule): Promise<boolean> {
    // Simple threshold-based evaluation
    // In a real implementation, this would use a rules engine
    const metricValue = this.getMetricValueByPath(rule.condition);
    return metricValue !== null && metricValue >= rule.threshold;
  }

  private getMetricValueByPath(path: string): number | null {
    const parts = path.split('.');
    let current: any = this.metrics;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }
    
    return typeof current === 'number' ? current : null;
  }

  private async triggerAlert(rule: AlertRule): Promise<void> {
    const alert = {
      id: `alert_${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `Alert triggered: ${rule.name}`,
      timestamp: new Date(),
      recipients: rule.recipients
    };

    // Broadcast to connected clients
    if (this.io) {
      this.io.emit('analytics:alert', alert);
    }

    // Log the alert
    await auditLogger.log('alert_triggered', null, alert);

    console.log(`Alert triggered: ${rule.name} (${rule.severity})`);
  }

  /**
   * Persistence methods
   */
  private async saveWidgetToRedis(widget: DashboardWidget): Promise<void> {
    await this.redis.hset('analytics:widgets', widget.id, JSON.stringify(widget));
  }

  private async loadWidgetsFromRedis(): Promise<void> {
    const widgets = await this.redis.hgetall('analytics:widgets');
    
    for (const [widgetId, widgetData] of Object.entries(widgets)) {
      try {
        const widget = JSON.parse(widgetData);
        this.widgets.set(widgetId, widget);
        
        if (widget.config.refreshInterval > 0) {
          this.startWidgetUpdates(widgetId);
        }
      } catch (error) {
        console.error(`Error loading widget ${widgetId}:`, error);
      }
    }
  }

  private async saveAlertRuleToRedis(rule: AlertRule): Promise<void> {
    await this.redis.hset('analytics:alertRules', rule.id, JSON.stringify(rule));
  }

  private async loadAlertRulesFromRedis(): Promise<void> {
    const rules = await this.redis.hgetall('analytics:alertRules');
    
    for (const [ruleId, ruleData] of Object.entries(rules)) {
      try {
        const rule = JSON.parse(ruleData);
        this.alertRules.set(ruleId, rule);
      } catch (error) {
        console.error(`Error loading alert rule ${ruleId}:`, error);
      }
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): AnalyticsMetrics {
    return { ...this.metrics };
  }

  /**
   * Get time series data for a metric
   */
  getTimeSeriesData(metric: string, limit: number = 100): TimeSeriesData[] {
    const data = this.timeSeriesBuffer.get(metric) || [];
    return data.slice(-limit);
  }

  /**
   * Health check
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    activeConnections: number;
    activeWidgets: number;
    alertRules: number;
    uptime: number;
  } {
    return {
      status: 'healthy',
      activeConnections: this.activeConnections.size,
      activeWidgets: this.widgets.size,
      alertRules: this.alertRules.size,
      uptime: process.uptime()
    };
  }
}

// Export singleton instance
export const realTimeAnalyticsService = new RealTimeAnalyticsService();
export default realTimeAnalyticsService;