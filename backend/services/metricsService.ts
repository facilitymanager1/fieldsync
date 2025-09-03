import prometheus from 'prom-client';
import { Request, Response } from 'express';
import os from 'os';
import process from 'process';

export interface MetricConfig {
  enableDefaultMetrics: boolean;
  defaultInterval: number;
  prefix: string;
  enableGCMetrics: boolean;
  enableEventLoopMetrics: boolean;
  enableProcessMetrics: boolean;
}

class MetricsService {
  private register: prometheus.Registry;
  private config: MetricConfig;
  
  // Default metrics
  private httpRequestDuration: prometheus.Histogram;
  private httpRequestTotal: prometheus.Counter;
  private httpRequestSize: prometheus.Histogram;
  private httpResponseSize: prometheus.Histogram;
  private activeConnections: prometheus.Gauge;
  
  // Business metrics
  private userLoginTotal: prometheus.Counter;
  private ticketOperations: prometheus.Counter;
  private shiftOperations: prometheus.Counter;
  private databaseOperations: prometheus.Histogram;
  private cacheOperations: prometheus.Counter;
  private queueSize: prometheus.Gauge;
  
  // System metrics
  private memoryUsage: prometheus.Gauge;
  private cpuUsage: prometheus.Gauge;
  private diskUsage: prometheus.Gauge;
  private networkIO: prometheus.Gauge;
  
  // Error metrics
  private errorTotal: prometheus.Counter;
  private errorRate: prometheus.Gauge;
  
  // Performance metrics
  private gcDuration: prometheus.Histogram;
  private eventLoopLag: prometheus.Gauge;
  private heapUsed: prometheus.Gauge;
  
  // Custom business metrics
  private customMetrics: Map<string, prometheus.Metric>;

  constructor() {
    this.config = {
      enableDefaultMetrics: process.env.ENABLE_DEFAULT_METRICS !== 'false',
      defaultInterval: parseInt(process.env.METRICS_COLLECTION_INTERVAL || '10000'),
      prefix: process.env.METRICS_PREFIX || 'fieldsync_',
      enableGCMetrics: process.env.ENABLE_GC_METRICS !== 'false',
      enableEventLoopMetrics: process.env.ENABLE_EVENT_LOOP_METRICS !== 'false',
      enableProcessMetrics: process.env.ENABLE_PROCESS_METRICS !== 'false'
    };

    this.register = new prometheus.Registry();
    this.customMetrics = new Map();
    
    this.initializeMetrics();
    this.startSystemMetricsCollection();
  }

  private initializeMetrics() {
    // Enable default Node.js metrics
    if (this.config.enableDefaultMetrics) {
      prometheus.collectDefaultMetrics({
        register: this.register,
        prefix: this.config.prefix,
        gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        eventLoopMonitoringPrecision: 10
      });
    }

    // HTTP request metrics
    this.httpRequestDuration = new prometheus.Histogram({
      name: `${this.config.prefix}http_request_duration_seconds`,
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'user_role'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10, 15, 20, 30]
    });

    this.httpRequestTotal = new prometheus.Counter({
      name: `${this.config.prefix}http_requests_total`,
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'user_role']
    });

    this.httpRequestSize = new prometheus.Histogram({
      name: `${this.config.prefix}http_request_size_bytes`,
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000, 10000000]
    });

    this.httpResponseSize = new prometheus.Histogram({
      name: `${this.config.prefix}http_response_size_bytes`,
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000, 10000000]
    });

    this.activeConnections = new prometheus.Gauge({
      name: `${this.config.prefix}active_connections`,
      help: 'Number of active connections'
    });

    // Business metrics
    this.userLoginTotal = new prometheus.Counter({
      name: `${this.config.prefix}user_logins_total`,
      help: 'Total number of user logins',
      labelNames: ['status', 'role', 'method']
    });

    this.ticketOperations = new prometheus.Counter({
      name: `${this.config.prefix}ticket_operations_total`,
      help: 'Total number of ticket operations',
      labelNames: ['operation', 'status', 'priority', 'assigned_to_role']
    });

    this.shiftOperations = new prometheus.Counter({
      name: `${this.config.prefix}shift_operations_total`,
      help: 'Total number of shift operations',
      labelNames: ['operation', 'status', 'user_role']
    });

    this.databaseOperations = new prometheus.Histogram({
      name: `${this.config.prefix}database_operation_duration_seconds`,
      help: 'Duration of database operations',
      labelNames: ['operation', 'collection', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });

    this.cacheOperations = new prometheus.Counter({
      name: `${this.config.prefix}cache_operations_total`,
      help: 'Total number of cache operations',
      labelNames: ['operation', 'status', 'cache_type']
    });

    this.queueSize = new prometheus.Gauge({
      name: `${this.config.prefix}queue_size`,
      help: 'Current queue size',
      labelNames: ['queue_name', 'priority']
    });

    // System metrics
    this.memoryUsage = new prometheus.Gauge({
      name: `${this.config.prefix}memory_usage_bytes`,
      help: 'Memory usage in bytes',
      labelNames: ['type']
    });

    this.cpuUsage = new prometheus.Gauge({
      name: `${this.config.prefix}cpu_usage_percent`,
      help: 'CPU usage percentage'
    });

    this.diskUsage = new prometheus.Gauge({
      name: `${this.config.prefix}disk_usage_bytes`,
      help: 'Disk usage in bytes',
      labelNames: ['mount_point', 'type']
    });

    this.networkIO = new prometheus.Gauge({
      name: `${this.config.prefix}network_io_bytes`,
      help: 'Network I/O in bytes',
      labelNames: ['direction', 'interface']
    });

    // Error metrics
    this.errorTotal = new prometheus.Counter({
      name: `${this.config.prefix}errors_total`,
      help: 'Total number of errors',
      labelNames: ['type', 'severity', 'service', 'endpoint']
    });

    this.errorRate = new prometheus.Gauge({
      name: `${this.config.prefix}error_rate`,
      help: 'Current error rate percentage',
      labelNames: ['service', 'time_window']
    });

    // Performance metrics
    if (this.config.enableGCMetrics) {
      this.gcDuration = new prometheus.Histogram({
        name: `${this.config.prefix}gc_duration_seconds`,
        help: 'Time spent in garbage collection',
        labelNames: ['gc_type'],
        buckets: [0.001, 0.01, 0.1, 1, 2, 5]
      });
    }

    if (this.config.enableEventLoopMetrics) {
      this.eventLoopLag = new prometheus.Gauge({
        name: `${this.config.prefix}event_loop_lag_seconds`,
        help: 'Event loop lag in seconds'
      });
    }

    this.heapUsed = new prometheus.Gauge({
      name: `${this.config.prefix}heap_used_bytes`,
      help: 'Heap memory used in bytes'
    });

    // Register all metrics
    this.register.registerMetric(this.httpRequestDuration);
    this.register.registerMetric(this.httpRequestTotal);
    this.register.registerMetric(this.httpRequestSize);
    this.register.registerMetric(this.httpResponseSize);
    this.register.registerMetric(this.activeConnections);
    this.register.registerMetric(this.userLoginTotal);
    this.register.registerMetric(this.ticketOperations);
    this.register.registerMetric(this.shiftOperations);
    this.register.registerMetric(this.databaseOperations);
    this.register.registerMetric(this.cacheOperations);
    this.register.registerMetric(this.queueSize);
    this.register.registerMetric(this.memoryUsage);
    this.register.registerMetric(this.cpuUsage);
    this.register.registerMetric(this.diskUsage);
    this.register.registerMetric(this.networkIO);
    this.register.registerMetric(this.errorTotal);
    this.register.registerMetric(this.errorRate);
    this.register.registerMetric(this.heapUsed);

    if (this.config.enableGCMetrics) {
      this.register.registerMetric(this.gcDuration);
    }

    if (this.config.enableEventLoopMetrics) {
      this.register.registerMetric(this.eventLoopLag);
    }
  }

  private startSystemMetricsCollection() {
    // Collect system metrics every interval
    setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.defaultInterval);

    // Collect memory metrics
    setInterval(() => {
      this.collectMemoryMetrics();
    }, 5000);

    // Monitor event loop lag
    if (this.config.enableEventLoopMetrics) {
      this.monitorEventLoopLag();
    }
  }

  private collectSystemMetrics() {
    try {
      // CPU usage
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;

      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });

      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      const usage = 100 - ~~(100 * idle / total);
      
      this.cpuUsage.set(usage);

      // Memory usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      this.memoryUsage.set({ type: 'total' }, totalMem);
      this.memoryUsage.set({ type: 'used' }, usedMem);
      this.memoryUsage.set({ type: 'free' }, freeMem);

    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }

  private collectMemoryMetrics() {
    try {
      const memUsage = process.memoryUsage();
      
      this.heapUsed.set(memUsage.heapUsed);
      this.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'external' }, memUsage.external);
      this.memoryUsage.set({ type: 'rss' }, memUsage.rss);

    } catch (error) {
      console.error('Failed to collect memory metrics:', error);
    }
  }

  private monitorEventLoopLag() {
    let start = process.hrtime.bigint();
    
    setImmediate(() => {
      const delta = process.hrtime.bigint() - start;
      const lag = Number(delta) / 1e9; // Convert to seconds
      this.eventLoopLag.set(lag);
      
      // Schedule next measurement
      setTimeout(() => {
        start = process.hrtime.bigint();
        this.monitorEventLoopLag();
      }, 1000);
    });
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(req: Request, res: Response, duration: number) {
    const method = req.method;
    const route = req.route?.path || req.path;
    const statusCode = res.statusCode.toString();
    const userRole = (req as any).user?.role || 'anonymous';

    this.httpRequestDuration
      .labels(method, route, statusCode, userRole)
      .observe(duration / 1000); // Convert to seconds

    this.httpRequestTotal
      .labels(method, route, statusCode, userRole)
      .inc();

    // Record request/response sizes if available
    const contentLength = req.get('content-length');
    if (contentLength) {
      this.httpRequestSize
        .labels(method, route)
        .observe(parseInt(contentLength));
    }

    const responseLength = res.get('content-length');
    if (responseLength) {
      this.httpResponseSize
        .labels(method, route)
        .observe(parseInt(responseLength));
    }
  }

  /**
   * Record user login metrics
   */
  recordUserLogin(status: 'success' | 'failure', role: string, method: string = 'password') {
    this.userLoginTotal
      .labels(status, role, method)
      .inc();
  }

  /**
   * Record ticket operation metrics
   */
  recordTicketOperation(
    operation: 'create' | 'update' | 'assign' | 'close' | 'delete',
    status: 'success' | 'failure',
    priority: string,
    assignedToRole: string = 'unassigned'
  ) {
    this.ticketOperations
      .labels(operation, status, priority, assignedToRole)
      .inc();
  }

  /**
   * Record shift operation metrics
   */
  recordShiftOperation(
    operation: 'start' | 'end' | 'break' | 'resume',
    status: 'success' | 'failure',
    userRole: string
  ) {
    this.shiftOperations
      .labels(operation, status, userRole)
      .inc();
  }

  /**
   * Record database operation metrics
   */
  recordDatabaseOperation(
    operation: 'find' | 'insert' | 'update' | 'delete' | 'aggregate',
    collection: string,
    duration: number,
    status: 'success' | 'failure' = 'success'
  ) {
    this.databaseOperations
      .labels(operation, collection, status)
      .observe(duration / 1000); // Convert to seconds
  }

  /**
   * Record cache operation metrics
   */
  recordCacheOperation(
    operation: 'get' | 'set' | 'delete' | 'clear',
    status: 'hit' | 'miss' | 'success' | 'failure',
    cacheType: 'redis' | 'memory' = 'redis'
  ) {
    this.cacheOperations
      .labels(operation, status, cacheType)
      .inc();
  }

  /**
   * Update queue size metrics
   */
  updateQueueSize(queueName: string, size: number, priority: string = 'normal') {
    this.queueSize
      .labels(queueName, priority)
      .set(size);
  }

  /**
   * Record error metrics
   */
  recordError(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    service: string,
    endpoint?: string
  ) {
    this.errorTotal
      .labels(type, severity, service, endpoint || 'unknown')
      .inc();
  }

  /**
   * Update error rate metrics
   */
  updateErrorRate(service: string, rate: number, timeWindow: string = '5m') {
    this.errorRate
      .labels(service, timeWindow)
      .set(rate);
  }

  /**
   * Update active connections
   */
  updateActiveConnections(count: number) {
    this.activeConnections.set(count);
  }

  /**
   * Create custom counter metric
   */
  createCounter(
    name: string,
    help: string,
    labelNames: string[] = []
  ): prometheus.Counter {
    const counter = new prometheus.Counter({
      name: `${this.config.prefix}${name}`,
      help,
      labelNames
    });

    this.register.registerMetric(counter);
    this.customMetrics.set(name, counter);
    
    return counter;
  }

  /**
   * Create custom gauge metric
   */
  createGauge(
    name: string,
    help: string,
    labelNames: string[] = []
  ): prometheus.Gauge {
    const gauge = new prometheus.Gauge({
      name: `${this.config.prefix}${name}`,
      help,
      labelNames
    });

    this.register.registerMetric(gauge);
    this.customMetrics.set(name, gauge);
    
    return gauge;
  }

  /**
   * Create custom histogram metric
   */
  createHistogram(
    name: string,
    help: string,
    labelNames: string[] = [],
    buckets?: number[]
  ): prometheus.Histogram {
    const histogram = new prometheus.Histogram({
      name: `${this.config.prefix}${name}`,
      help,
      labelNames,
      buckets
    });

    this.register.registerMetric(histogram);
    this.customMetrics.set(name, histogram);
    
    return histogram;
  }

  /**
   * Get custom metric
   */
  getCustomMetric(name: string): prometheus.Metric | undefined {
    return this.customMetrics.get(name);
  }

  /**
   * Record business KPI metrics
   */
  recordBusinessKPI(metric: string, value: number, labels: Record<string, string> = {}) {
    const metricName = `business_${metric}`;
    let gauge = this.customMetrics.get(metricName) as prometheus.Gauge;

    if (!gauge) {
      gauge = this.createGauge(
        metricName,
        `Business KPI: ${metric}`,
        Object.keys(labels)
      );
    }

    gauge.set(labels, value);
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring(operation: string): () => void {
    const start = process.hrtime.bigint();
    
    return () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e9; // Convert to seconds
      
      // Record in a generic performance histogram
      let histogram = this.customMetrics.get('performance_operations') as prometheus.Histogram;
      
      if (!histogram) {
        histogram = this.createHistogram(
          'performance_operations',
          'Duration of various operations',
          ['operation'],
          [0.001, 0.01, 0.1, 1, 2, 5, 10]
        );
      }

      histogram.labels(operation).observe(duration);
    };
  }

  /**
   * Get metrics for Prometheus scraping
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsJSON(): Promise<any> {
    const metrics = await this.register.getMetricsAsJSON();
    return {
      timestamp: new Date().toISOString(),
      metrics,
      system: {
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        nodeEnv: process.env.NODE_ENV
      }
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.register.clear();
    this.customMetrics.clear();
    this.initializeMetrics();
  }

  /**
   * Get registry
   */
  getRegistry(): prometheus.Registry {
    return this.register;
  }

  /**
   * Health check for metrics service
   */
  healthCheck(): { status: string; metrics: any } {
    try {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      return {
        status: 'healthy',
        metrics: {
          uptime,
          memoryUsage: memUsage,
          customMetricsCount: this.customMetrics.size,
          registryMetricsCount: this.register.getSingleMetricAsString('').split('\n').length
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        metrics: { error: error.message }
      };
    }
  }

  /**
   * Generate metrics summary report
   */
  async generateSummaryReport(): Promise<any> {
    try {
      const metrics = await this.register.getMetricsAsJSON();
      const summary: any = {
        timestamp: new Date().toISOString(),
        totalMetrics: metrics.length,
        categories: {},
        topMetrics: [],
        systemStatus: this.healthCheck()
      };

      // Categorize metrics
      metrics.forEach(metric => {
        const category = metric.name.split('_')[1] || 'other';
        if (!summary.categories[category]) {
          summary.categories[category] = 0;
        }
        summary.categories[category]++;
      });

      // Get top metrics by value (for counters and gauges)
      const valueMetrics = metrics
        .filter(m => m.type === 'counter' || m.type === 'gauge')
        .map(m => ({
          name: m.name,
          value: m.values.reduce((sum, v) => sum + (v.value || 0), 0),
          type: m.type
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      summary.topMetrics = valueMetrics;

      return summary;
    } catch (error) {
      throw new Error(`Failed to generate metrics summary: ${error.message}`);
    }
  }
}

export default new MetricsService();