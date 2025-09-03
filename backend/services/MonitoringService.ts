/**
 * Comprehensive Monitoring Service for FieldSync
 * Provides metrics collection, health checks, alerting, and performance monitoring
 */

import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import loggingService from './loggingService';

// Metric types
export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface Alert {
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata?: Record<string, any>;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsRetentionDays: number;
  healthCheckInterval: number;
  alertingEnabled: boolean;
  exportMetrics: boolean;
  prometheusPort: number;
  webhookUrl?: string;
  emailConfig?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
    to: string[];
  };
  thresholds: {
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    diskUsagePercent: number;
    responseTimeMs: number;
    errorRatePercent: number;
  };
}

/**
 * Metrics Collector
 */
class MetricsCollector extends EventEmitter {
  private metrics: Map<string, Metric[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private timers: Map<string, { start: number; samples: number[] }> = new Map();

  // Counter operations
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    const currentValue = this.counters.get(key) || 0;
    this.counters.set(key, currentValue + value);
    
    this.recordMetric({
      name,
      value: currentValue + value,
      timestamp: Date.now(),
      tags,
      type: 'counter'
    });
  }

  decrement(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.increment(name, -value, tags);
  }

  // Gauge operations
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    this.gauges.set(key, value);
    
    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      tags,
      type: 'gauge'
    });
  }

  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.gauge(name, value, tags);
  }

  // Histogram operations
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
    
    this.recordMetric({
      name,
      value,
      timestamp: Date.now(),
      tags,
      type: 'histogram'
    });
  }

  // Timer operations
  timer(name: string): () => void {
    const key = this.getMetricKey(name);
    const start = Date.now();
    
    return () => {
      const duration = Date.now() - start;
      const timerData = this.timers.get(key) || { start: 0, samples: [] };
      timerData.samples.push(duration);
      this.timers.set(key, timerData);
      
      this.recordMetric({
        name,
        value: duration,
        timestamp: Date.now(),
        type: 'timer'
      });
    };
  }

  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;
    const tagString = Object.entries(tags)
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join(',');
    return `${name}{${tagString}}`;
  }

  private recordMetric(metric: Metric): void {
    const metricHistory = this.metrics.get(metric.name) || [];
    metricHistory.push(metric);
    
    // Keep only last 1000 samples per metric
    if (metricHistory.length > 1000) {
      metricHistory.splice(0, metricHistory.length - 1000);
    }
    
    this.metrics.set(metric.name, metricHistory);
    this.emit('metric', metric);
  }

  // Get metric statistics
  getMetricStats(name: string): any {
    const history = this.metrics.get(name) || [];
    if (history.length === 0) return null;

    const values = history.map(m => m.value);
    const sorted = [...values].sort((a, b) => a - b);
    
    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      latest: values[values.length - 1],
      timestamp: history[history.length - 1].timestamp
    };
  }

  // Get all metrics
  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name] of this.metrics) {
      result[name] = this.getMetricStats(name);
    }
    
    return result;
  }

  // Set gauge metric (single value)
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, 'gauge', tags);
  }

  // Clear old metrics
  clearOldMetrics(retentionMs: number): void {
    const cutoff = Date.now() - retentionMs;
    
    for (const [name, history] of this.metrics) {
      const filtered = history.filter(m => m.timestamp > cutoff);
      this.metrics.set(name, filtered);
    }
  }
}

/**
 * Health Check Manager
 */
class HealthCheckManager extends EventEmitter {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();
  private lastResults: Map<string, HealthCheck> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  registerCheck(name: string, checkFn: () => Promise<HealthCheck>, intervalMs: number = 30000): void {
    this.checks.set(name, checkFn);
    
    // Clear existing interval if any
    const existingInterval = this.intervals.get(name);
    if (existingInterval) {
      clearInterval(existingInterval);
    }
    
    // Set up new interval
    const interval = setInterval(async () => {
      try {
        const result = await checkFn();
        this.lastResults.set(name, result);
        this.emit('healthCheck', result);
        
        loggingService.logHealth(result.name, result.status, result.metadata);
      } catch (error) {
        const errorResult: HealthCheck = {
          name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Health check failed',
          timestamp: Date.now(),
          metadata: { error: error }
        };
        
        this.lastResults.set(name, errorResult);
        this.emit('healthCheck', errorResult);
        loggingService.logHealth(name, 'unhealthy', { error });
      }
    }, intervalMs);
    
    this.intervals.set(name, interval);
    
    // Run check immediately
    setTimeout(() => {
      this.runCheck(name);
    }, 100);
  }

  async runCheck(name: string): Promise<HealthCheck | null> {
    const checkFn = this.checks.get(name);
    if (!checkFn) return null;
    
    try {
      const result = await checkFn();
      this.lastResults.set(name, result);
      this.emit('healthCheck', result);
      return result;
    } catch (error) {
      const errorResult: HealthCheck = {
        name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Health check failed',
        timestamp: Date.now()
      };
      
      this.lastResults.set(name, errorResult);
      this.emit('healthCheck', errorResult);
      return errorResult;
    }
  }

  async runAllChecks(): Promise<HealthCheck[]> {
    const results: HealthCheck[] = [];
    
    for (const name of this.checks.keys()) {
      const result = await this.runCheck(name);
      if (result) results.push(result);
    }
    
    return results;
  }

  getLastResult(name: string): HealthCheck | null {
    return this.lastResults.get(name) || null;
  }

  getAllResults(): Record<string, HealthCheck> {
    const results: Record<string, HealthCheck> = {};
    for (const [name, result] of this.lastResults) {
      results[name] = result;
    }
    return results;
  }

  getOverallHealth(): { status: 'healthy' | 'degraded' | 'unhealthy'; details: Record<string, HealthCheck> } {
    const results = this.getAllResults();
    const statuses = Object.values(results).map(r => r.status);
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (statuses.some(s => s === 'unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.some(s => s === 'degraded')) {
      overallStatus = 'degraded';
    }
    
    return { status: overallStatus, details: results };
  }

  unregisterCheck(name: string): void {
    this.checks.delete(name);
    this.lastResults.delete(name);
    
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
  }

  shutdown(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
  }
}

/**
 * Alert Manager
 */
class AlertManager extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, (metrics: Record<string, any>) => Alert | null> = new Map();
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    super();
    this.config = config;
  }

  addRule(name: string, ruleFn: (metrics: Record<string, any>) => Alert | null): void {
    this.rules.set(name, ruleFn);
  }

  async evaluateRules(metrics: Record<string, any>): Promise<void> {
    for (const [name, rule] of this.rules) {
      try {
        const alert = rule(metrics);
        
        if (alert) {
          await this.triggerAlert(alert);
        }
      } catch (error) {
        loggingService.error(`Failed to evaluate alert rule ${name}`, error);
      }
    }
  }

  async triggerAlert(alert: Alert): Promise<void> {
    // Check if alert already exists and is not resolved
    const existingAlert = this.alerts.get(alert.id);
    if (existingAlert && !existingAlert.resolved) {
      return; // Don't spam the same alert
    }
    
    this.alerts.set(alert.id, alert);
    this.emit('alert', alert);
    
    loggingService.logSecurity(`Alert triggered: ${alert.name}`, 
      alert.severity === 'critical' ? 'critical' : alert.severity === 'error' ? 'high' : 'medium',
      alert.metadata);
    
    if (this.config.alertingEnabled) {
      await this.sendAlert(alert);
    }
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.emit('alertResolved', alert);
      
      loggingService.info(`Alert resolved: ${alert.name}`, { alertId });
    }
  }

  private async sendAlert(alert: Alert): Promise<void> {
    try {
      // Send webhook notification
      if (this.config.webhookUrl) {
        await this.sendWebhookAlert(alert);
      }
      
      // Send email notification
      if (this.config.emailConfig) {
        await this.sendEmailAlert(alert);
      }
    } catch (error) {
      loggingService.error('Failed to send alert notification', error);
    }
  }

  private async sendWebhookAlert(alert: Alert): Promise<void> {
    if (!this.config.webhookUrl) return;
    
    const payload = {
      type: 'alert',
      alert: {
        id: alert.id,
        name: alert.name,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
        metadata: alert.metadata
      }
    };
    
    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }
  }

  private async sendEmailAlert(alert: Alert): Promise<void> {
    // Email implementation would go here
    // For now, just log that we would send an email
    loggingService.info('Email alert would be sent', {
      to: this.config.emailConfig?.to,
      subject: `[${alert.severity.toUpperCase()}] ${alert.name}`,
      alert
    });
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }
}

/**
 * Main Monitoring Service
 */
export class MonitoringService extends EventEmitter {
  private config: MonitoringConfig;
  private metrics: MetricsCollector;
  private healthChecks: HealthCheckManager;
  private alerts: AlertManager;
  private startTime: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config?: Partial<MonitoringConfig>) {
    super();
    
    this.config = {
      enabled: true,
      metricsRetentionDays: 7,
      healthCheckInterval: 30000,
      alertingEnabled: true,
      exportMetrics: false,
      prometheusPort: 9090,
      thresholds: {
        cpuUsagePercent: 80,
        memoryUsagePercent: 85,
        diskUsagePercent: 90,
        responseTimeMs: 5000,
        errorRatePercent: 5
      },
      ...config
    };
    
    this.startTime = Date.now();
    this.metrics = new MetricsCollector();
    this.healthChecks = new HealthCheckManager();
    this.alerts = new AlertManager(this.config);
    
    this.setupDefaultHealthChecks();
    this.setupDefaultAlertRules();
    this.setupCleanup();
    
    if (this.config.enabled) {
      this.start();
    }
  }

  private setupDefaultHealthChecks(): void {
    // Database health check
    this.healthChecks.registerCheck('database', async () => {
      const start = Date.now();
      try {
        // This would check database connectivity
        // For now, simulate a check
        await new Promise(resolve => setTimeout(resolve, 10));
        
        return {
          name: 'database',
          status: 'healthy',
          message: 'Database is responding',
          timestamp: Date.now(),
          duration: Date.now() - start
        };
      } catch (error) {
        return {
          name: 'database',
          status: 'unhealthy',
          message: 'Database connection failed',
          timestamp: Date.now(),
          duration: Date.now() - start,
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
      }
    });

    // Redis health check
    this.healthChecks.registerCheck('redis', async () => {
      const start = Date.now();
      try {
        // This would check Redis connectivity
        await new Promise(resolve => setTimeout(resolve, 5));
        
        return {
          name: 'redis',
          status: 'healthy',
          message: 'Redis is responding',
          timestamp: Date.now(),
          duration: Date.now() - start
        };
      } catch (error) {
        return {
          name: 'redis',
          status: 'unhealthy',
          message: 'Redis connection failed',
          timestamp: Date.now(),
          duration: Date.now() - start,
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
        };
      }
    });

    // System health check
    this.healthChecks.registerCheck('system', async () => {
      const start = Date.now();
      const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
      const memUsage = (1 - (os.freemem() / os.totalmem())) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      const issues: string[] = [];
      
      if (cpuUsage > this.config.thresholds.cpuUsagePercent) {
        status = cpuUsage > 95 ? 'unhealthy' : 'degraded';
        issues.push(`High CPU usage: ${cpuUsage.toFixed(1)}%`);
      }
      
      if (memUsage > this.config.thresholds.memoryUsagePercent) {
        status = memUsage > 95 ? 'unhealthy' : 'degraded';
        issues.push(`High memory usage: ${memUsage.toFixed(1)}%`);
      }
      
      return {
        name: 'system',
        status,
        message: issues.length > 0 ? issues.join(', ') : 'System resources are healthy',
        timestamp: Date.now(),
        duration: Date.now() - start,
        metadata: {
          cpuUsage: cpuUsage.toFixed(1),
          memoryUsage: memUsage.toFixed(1),
          uptime: process.uptime(),
          nodeVersion: process.version
        }
      };
    });
  }

  private setupDefaultAlertRules(): void {
    // High error rate alert
    this.alerts.addRule('high_error_rate', (metrics) => {
      const errorRate = metrics['http_errors_total']?.latest || 0;
      const requestRate = metrics['http_requests_total']?.latest || 1;
      const errorPercent = (errorRate / requestRate) * 100;
      
      if (errorPercent > this.config.thresholds.errorRatePercent) {
        return {
          id: 'high_error_rate',
          name: 'High Error Rate',
          severity: errorPercent > 10 ? 'critical' : 'error',
          message: `Error rate is ${errorPercent.toFixed(1)}% (threshold: ${this.config.thresholds.errorRatePercent}%)`,
          timestamp: Date.now(),
          resolved: false,
          metadata: { errorPercent, errorRate, requestRate }
        };
      }
      
      return null;
    });

    // High response time alert
    this.alerts.addRule('high_response_time', (metrics) => {
      const responseTime = metrics['http_response_time']?.p95 || 0;
      
      if (responseTime > this.config.thresholds.responseTimeMs) {
        return {
          id: 'high_response_time',
          name: 'High Response Time',
          severity: responseTime > this.config.thresholds.responseTimeMs * 2 ? 'critical' : 'warning',
          message: `95th percentile response time is ${responseTime}ms (threshold: ${this.config.thresholds.responseTimeMs}ms)`,
          timestamp: Date.now(),
          resolved: false,
          metadata: { responseTime, threshold: this.config.thresholds.responseTimeMs }
        };
      }
      
      return null;
    });
  }

  private setupCleanup(): void {
    // Clean up old metrics every hour
    this.cleanupInterval = setInterval(() => {
      const retentionMs = this.config.metricsRetentionDays * 24 * 60 * 60 * 1000;
      this.metrics.clearOldMetrics(retentionMs);
    }, 60 * 60 * 1000);
  }

  private start(): void {
    loggingService.info('Monitoring service started', {
      config: this.config,
      startTime: this.startTime
    });

    // Set up metric evaluation for alerts
    this.metrics.on('metric', () => {
      // Evaluate alerts every 10 metrics (throttling)
      if (Math.random() < 0.1) {
        const allMetrics = this.metrics.getAllMetrics();
        this.alerts.evaluateRules(allMetrics);
      }
    });

    // Log health check results
    this.healthChecks.on('healthCheck', (result) => {
      loggingService.logHealth(result.name, result.status, result.metadata);
    });

    // Log alerts
    this.alerts.on('alert', (alert) => {
      loggingService.logSecurity(`Alert: ${alert.name}`, 
        alert.severity === 'critical' ? 'critical' : 'high', 
        alert.metadata);
    });
  }

  // Public API methods
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.config.enabled) return;
    this.metrics.gauge(name, value, tags);
  }

  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.config.enabled) return;
    this.metrics.setGauge(name, value, tags);
  }

  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    if (!this.config.enabled) return;
    this.metrics.increment(name, value, tags);
  }

  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.config.enabled) return;
    this.metrics.histogram(name, value, tags);
  }

  startTimer(name: string): () => void {
    if (!this.config.enabled) return () => {};
    return this.metrics.timer(name);
  }

  async getMetrics(): Promise<Record<string, any>> {
    return this.metrics.getAllMetrics();
  }

  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: Record<string, HealthCheck> }> {
    return this.healthChecks.getOverallHealth();
  }

  async runHealthChecks(): Promise<HealthCheck[]> {
    return this.healthChecks.runAllChecks();
  }

  getActiveAlerts(): Alert[] {
    return this.alerts.getActiveAlerts();
  }

  async resolveAlert(alertId: string): Promise<void> {
    await this.alerts.resolveAlert(alertId);
  }

  registerHealthCheck(name: string, checkFn: () => Promise<HealthCheck>, intervalMs: number = 30000): void {
    this.healthChecks.registerCheck(name, checkFn, intervalMs);
  }

  addAlertRule(name: string, ruleFn: (metrics: Record<string, any>) => Alert | null): void {
    this.alerts.addRule(name, ruleFn);
  }

  updateConfig(updates: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...updates };
    loggingService.info('Monitoring configuration updated', { config: this.config });
  }

  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.healthChecks.shutdown();
    loggingService.info('Monitoring service shut down');
  }
}

// Export singleton instance
const monitoringConfig: Partial<MonitoringConfig> = {
  enabled: process.env.MONITORING_ENABLED !== 'false',
  metricsRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '7'),
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
  alertingEnabled: process.env.ALERTING_ENABLED !== 'false',
  exportMetrics: process.env.EXPORT_METRICS === 'true',
  prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090'),
  webhookUrl: process.env.ALERT_WEBHOOK_URL,
  thresholds: {
    cpuUsagePercent: parseInt(process.env.CPU_THRESHOLD || '80'),
    memoryUsagePercent: parseInt(process.env.MEMORY_THRESHOLD || '85'),
    diskUsagePercent: parseInt(process.env.DISK_THRESHOLD || '90'),
    responseTimeMs: parseInt(process.env.RESPONSE_TIME_THRESHOLD || '5000'),
    errorRatePercent: parseInt(process.env.ERROR_RATE_THRESHOLD || '5')
  }
};

export const monitoring = new MonitoringService(monitoringConfig);

export default MonitoringService;