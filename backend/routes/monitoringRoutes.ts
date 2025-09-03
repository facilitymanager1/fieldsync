/**
 * Monitoring Routes for FieldSync
 * Provides API endpoints for monitoring, metrics, health checks, and alerts
 */

import { Router, Request, Response } from 'express';
import { monitoring } from '../services/monitoringService';
import loggingService from '../services/loggingService';
import { auth, requirePermission } from '../middleware/auth';
import { healthCheckEndpoint, metricsEndpoint } from '../middleware/monitoringMiddleware';

const router = Router();

/**
 * Public health check endpoint (no auth required)
 */
router.get('/health', healthCheckEndpoint);

/**
 * Public metrics endpoint for Prometheus (no auth required)
 */
router.get('/metrics', metricsEndpoint);

/**
 * Protected monitoring endpoints (require authentication)
 */

/**
 * Get comprehensive system status
 */
router.get('/status', auth, requirePermission('monitoring:read'), async (req: Request, res: Response) => {
  try {
    const [health, metrics, alerts] = await Promise.all([
      monitoring.getHealthStatus(),
      monitoring.getMetrics(),
      monitoring.getActiveAlerts()
    ]);

    const uptime = monitoring.getUptime();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const status = {
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime / 1000),
      health: health.status,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      
      // System metrics
      system: {
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024), // MB
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memUsage.external / 1024 / 1024) // MB
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        process: {
          pid: process.pid,
          uptime: process.uptime(),
          version: process.version,
          platform: process.platform,
          arch: process.arch
        }
      },
      
      // Health checks
      healthChecks: health.details,
      
      // Alerts summary
      alerts: {
        active: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        error: alerts.filter(a => a.severity === 'error').length,
        warning: alerts.filter(a => a.severity === 'warning').length
      },
      
      // Key metrics
      metrics: {
        httpRequests: metrics['http_requests_total']?.latest || 0,
        httpErrors: metrics['http_errors_total']?.latest || 0,
        avgResponseTime: metrics['http_response_time']?.avg || 0,
        p95ResponseTime: metrics['http_response_time']?.p95 || 0
      }
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    loggingService.error('Failed to get system status', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system status'
    });
  }
});

/**
 * Get detailed metrics
 */
router.get('/metrics/detailed', auth, requirePermission('monitoring:read'), async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const metrics = await monitoring.getMetrics();
    
    let filteredMetrics = metrics;
    
    // Filter by category if specified
    if (category && typeof category === 'string') {
      filteredMetrics = {};
      const prefix = category.toLowerCase();
      
      for (const [key, value] of Object.entries(metrics)) {
        if (key.toLowerCase().startsWith(prefix)) {
          filteredMetrics[key] = value;
        }
      }
    }

    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        category: category || 'all',
        metrics: filteredMetrics
      }
    });
  } catch (error) {
    loggingService.error('Failed to get detailed metrics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });
  }
});

/**
 * Get health check results
 */
router.get('/health/detailed', auth, requirePermission('monitoring:read'), async (req: Request, res: Response) => {
  try {
    const health = await monitoring.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        overallStatus: health.status,
        checks: health.details
      }
    });
  } catch (error) {
    loggingService.error('Failed to get health check results', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve health status'
    });
  }
});

/**
 * Run health checks manually
 */
router.post('/health/check', auth, requirePermission('monitoring:write'), async (req: Request, res: Response) => {
  try {
    const results = await monitoring.runHealthChecks();
    
    loggingService.info('Manual health check triggered', {
      userId: (req as any).user?.id,
      results: results.map(r => ({ name: r.name, status: r.status }))
    });
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        results
      }
    });
  } catch (error) {
    loggingService.error('Failed to run health checks', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run health checks'
    });
  }
});

/**
 * Get alerts
 */
router.get('/alerts', auth, requirePermission('monitoring:read'), async (req: Request, res: Response) => {
  try {
    const { active = 'true', severity } = req.query;
    
    let alerts = active === 'true' ? 
      monitoring.getActiveAlerts() : 
      []; // Would need to implement getAllAlerts method
    
    // Filter by severity if specified
    if (severity && typeof severity === 'string') {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        count: alerts.length,
        alerts
      }
    });
  } catch (error) {
    loggingService.error('Failed to get alerts', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve alerts'
    });
  }
});

/**
 * Resolve an alert
 */
router.post('/alerts/:alertId/resolve', auth, requirePermission('monitoring:write'), async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { reason } = req.body;
    
    await monitoring.resolveAlert(alertId);
    
    loggingService.info('Alert resolved manually', {
      alertId,
      userId: (req as any).user?.id,
      reason
    });
    
    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    loggingService.error('Failed to resolve alert', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
});

/**
 * Get log statistics
 */
router.get('/logs/stats', auth, requirePermission('monitoring:read'), async (req: Request, res: Response) => {
  try {
    const stats = await loggingService.getLogStats();
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        logStats: stats
      }
    });
  } catch (error) {
    loggingService.error('Failed to get log statistics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve log statistics'
    });
  }
});

/**
 * Search logs
 */
router.post('/logs/search', auth, requirePermission('monitoring:read'), async (req: Request, res: Response) => {
  try {
    const {
      level,
      service,
      startDate,
      endDate,
      keyword,
      limit = 100
    } = req.body;
    
    const filters: any = { limit };
    
    if (level) filters.level = level;
    if (service) filters.service = service;
    if (keyword) filters.keyword = keyword;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    
    const logs = await loggingService.searchLogs(filters);
    
    loggingService.info('Log search performed', {
      userId: (req as any).user?.id,
      filters,
      resultCount: logs.length
    });
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        filters,
        count: logs.length,
        logs
      }
    });
  } catch (error) {
    loggingService.error('Failed to search logs', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search logs'
    });
  }
});

/**
 * Archive old logs
 */
router.post('/logs/archive', auth, requirePermission('monitoring:admin'), async (req: Request, res: Response) => {
  try {
    const { olderThanDays = 30 } = req.body;
    
    await loggingService.archiveLogs(olderThanDays);
    
    loggingService.info('Log archival triggered', {
      userId: (req as any).user?.id,
      olderThanDays
    });
    
    res.json({
      success: true,
      message: `Logs older than ${olderThanDays} days have been archived`
    });
  } catch (error) {
    loggingService.error('Failed to archive logs', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive logs'
    });
  }
});

/**
 * Get monitoring configuration
 */
router.get('/config', auth, requirePermission('monitoring:read'), async (req: Request, res: Response) => {
  try {
    const monitoringConfig = monitoring.getConfig();
    const loggingConfig = loggingService.getConfig();
    
    res.json({
      success: true,
      data: {
        monitoring: monitoringConfig,
        logging: loggingConfig
      }
    });
  } catch (error) {
    loggingService.error('Failed to get monitoring configuration', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve configuration'
    });
  }
});

/**
 * Update monitoring configuration
 */
router.put('/config', auth, requirePermission('monitoring:admin'), async (req: Request, res: Response) => {
  try {
    const { monitoring: monitoringUpdates, logging: loggingUpdates } = req.body;
    
    if (monitoringUpdates) {
      monitoring.updateConfig(monitoringUpdates);
    }
    
    if (loggingUpdates) {
      loggingService.updateConfig(loggingUpdates);
    }
    
    loggingService.info('Monitoring configuration updated', {
      userId: (req as any).user?.id,
      monitoringUpdates,
      loggingUpdates
    });
    
    res.json({
      success: true,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    loggingService.error('Failed to update monitoring configuration', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

/**
 * Performance analytics endpoint
 */
router.get('/analytics/performance', auth, requirePermission('monitoring:read'), async (req: Request, res: Response) => {
  try {
    const metrics = await monitoring.getMetrics();
    
    // Calculate performance insights
    const responseTime = metrics['http_response_time'];
    const errorRate = calculateErrorRate(metrics);
    const throughput = calculateThroughput(metrics);
    
    const analytics = {
      timestamp: new Date().toISOString(),
      responseTime: {
        avg: responseTime?.avg || 0,
        p50: responseTime?.p50 || 0,
        p95: responseTime?.p95 || 0,
        p99: responseTime?.p99 || 0
      },
      errorRate: {
        percentage: errorRate.percentage,
        total: errorRate.total,
        byType: errorRate.byType
      },
      throughput: {
        requestsPerSecond: throughput.rps,
        requestsPerMinute: throughput.rpm
      },
      trends: {
        // This would typically come from time-series data
        responseTimeTrend: 'stable',
        errorRateTrend: 'decreasing',
        throughputTrend: 'increasing'
      }
    };
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    loggingService.error('Failed to get performance analytics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance analytics'
    });
  }
});

/**
 * System resources endpoint
 */
router.get('/system/resources', auth, requirePermission('monitoring:read'), async (req: Request, res: Response) => {
  try {
    const metrics = await monitoring.getMetrics();
    
    const resources = {
      timestamp: new Date().toISOString(),
      memory: {
        used: metrics['memory_usage_heap_used']?.latest || 0,
        total: metrics['memory_usage_heap_total']?.latest || 0,
        percentage: calculateMemoryPercentage(metrics)
      },
      cpu: {
        usage: calculateCpuUsage(metrics),
        loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
      },
      eventLoop: {
        lag: metrics['event_loop_lag_ms']?.latest || 0
      },
      handles: {
        active: metrics['active_handles']?.latest || 0,
        requests: metrics['active_requests']?.latest || 0
      }
    };
    
    res.json({
      success: true,
      data: resources
    });
  } catch (error) {
    loggingService.error('Failed to get system resources', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system resources'
    });
  }
});

// Helper functions
function calculateErrorRate(metrics: Record<string, any>): { percentage: number; total: number; byType: any } {
  const totalRequests = metrics['http_requests_total']?.latest || 1;
  const totalErrors = metrics['http_errors_total']?.latest || 0;
  
  return {
    percentage: (totalErrors / totalRequests) * 100,
    total: totalErrors,
    byType: {
      clientErrors: metrics['http_errors_client']?.latest || 0,
      serverErrors: metrics['http_errors_server']?.latest || 0
    }
  };
}

function calculateThroughput(metrics: Record<string, any>): { rps: number; rpm: number } {
  const totalRequests = metrics['http_requests_total']?.latest || 0;
  const uptime = process.uptime();
  
  const rps = uptime > 0 ? totalRequests / uptime : 0;
  const rpm = rps * 60;
  
  return { rps, rpm };
}

function calculateMemoryPercentage(metrics: Record<string, any>): number {
  const used = metrics['memory_usage_heap_used']?.latest || 0;
  const total = metrics['memory_usage_heap_total']?.latest || 1;
  
  return (used / total) * 100;
}

function calculateCpuUsage(metrics: Record<string, any>): number {
  // This would need more sophisticated CPU monitoring
  // For now, return a placeholder
  return 0;
}

export default router;