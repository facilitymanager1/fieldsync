/**
 * Express Middleware for Monitoring and Metrics Collection
 * Integrates with the monitoring service to track HTTP requests, performance, and errors
 */

import { Request, Response, NextFunction } from 'express';
import { monitoring } from '../services/monitoringService';
import loggingService from '../services/loggingService';

// Extend Request interface to include monitoring data
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
      requestId?: string;
      traceId?: string;
    }
  }
}

/**
 * Request tracking middleware
 * Adds timing and tracking information to requests
 */
export function requestTracking(req: Request, res: Response, next: NextFunction): void {
  // Generate unique request ID if not exists
  if (!req.requestId) {
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate trace ID for distributed tracing
  if (!req.traceId) {
    req.traceId = loggingService.generateTraceId();
  }

  // Record request start time
  req.startTime = Date.now();

  // Increment request counter
  monitoring.incrementCounter('http_requests_total', 1, {
    method: req.method,
    route: req.route?.path || req.path,
    user_agent: req.get('User-Agent') || 'unknown'
  });

  next();
}

/**
 * Response monitoring middleware
 * Records response metrics and logs
 */
export function responseMonitoring(req: Request, res: Response, next: NextFunction): void {
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;

  // Override res.send
  res.send = function(body: any) {
    recordResponseMetrics(req, res, body);
    return originalSend.call(this, body);
  };

  // Override res.json
  res.json = function(obj: any) {
    recordResponseMetrics(req, res, obj);
    return originalJson.call(this, obj);
  };

  // Override res.end
  res.end = function(chunk?: any, encoding?: any) {
    recordResponseMetrics(req, res, chunk);
    return originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * Record response metrics
 */
function recordResponseMetrics(req: Request, res: Response, body?: any): void {
  if (!req.startTime) return;

  const duration = Date.now() - req.startTime;
  const statusCode = res.statusCode;
  const method = req.method;
  const route = req.route?.path || req.path;

  // Record response time
  monitoring.recordHistogram('http_response_time', duration, {
    method,
    route,
    status_code: statusCode.toString()
  });

  // Record response status
  monitoring.incrementCounter('http_responses_total', 1, {
    method,
    route,
    status_code: statusCode.toString()
  });

  // Record errors
  if (statusCode >= 400) {
    monitoring.incrementCounter('http_errors_total', 1, {
      method,
      route,
      status_code: statusCode.toString(),
      error_type: statusCode >= 500 ? 'server_error' : 'client_error'
    });
  }

  // Record response size if available
  const contentLength = res.get('Content-Length');
  if (contentLength) {
    monitoring.recordHistogram('http_response_size_bytes', parseInt(contentLength), {
      method,
      route
    });
  } else if (body) {
    const size = Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body));
    monitoring.recordHistogram('http_response_size_bytes', size, {
      method,
      route
    });
  }

  // Log request
  loggingService.logRequest(req, res, duration);

  // Log slow requests
  if (duration > 1000) {
    loggingService.logPerformance(`Slow HTTP request: ${method} ${route}`, duration, {
      requestId: req.requestId,
      traceId: req.traceId,
      statusCode,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  }
}

/**
 * Error monitoring middleware
 * Captures and records application errors
 */
export function errorMonitoring(error: Error, req: Request, res: Response, next: NextFunction): void {
  const errorType = error.name || 'UnknownError';
  const route = req.route?.path || req.path;

  // Record error metrics
  monitoring.incrementCounter('application_errors_total', 1, {
    error_type: errorType,
    method: req.method,
    route
  });

  // Log error with context
  loggingService.error(`Application error: ${error.message}`, error, {
    requestId: req.requestId,
    traceId: req.traceId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.id,
    errorType,
    stack: error.stack
  });

  next(error);
}

/**
 * Database operation monitoring
 */
export function recordDatabaseOperation(operation: string, collection: string, duration: number, success: boolean): void {
  // Record database operation metrics
  monitoring.recordHistogram('database_operation_duration', duration, {
    operation,
    collection,
    success: success.toString()
  });

  monitoring.incrementCounter('database_operations_total', 1, {
    operation,
    collection,
    success: success.toString()
  });

  // Log slow database operations
  if (duration > 100) {
    loggingService.logDatabase(operation, collection, duration, {
      slow: true,
      threshold: 100
    });
  }

  // Record database errors
  if (!success) {
    monitoring.incrementCounter('database_errors_total', 1, {
      operation,
      collection
    });
  }
}

/**
 * Authentication monitoring
 */
export function recordAuthEvent(event: string, userId?: string, success: boolean = true, metadata?: any): void {
  // Record auth metrics
  monitoring.incrementCounter('auth_events_total', 1, {
    event,
    success: success.toString()
  });

  if (!success) {
    monitoring.incrementCounter('auth_failures_total', 1, {
      event
    });
  }

  // Log auth event
  loggingService.logAuth(event, userId, success, metadata);
}

/**
 * Business operation monitoring
 */
export function recordBusinessEvent(event: string, entity: string, entityId: string, metadata?: any): void {
  // Record business metrics
  monitoring.incrementCounter('business_events_total', 1, {
    event,
    entity
  });

  // Log business event
  loggingService.logBusiness(event, entity, entityId, metadata);
}

/**
 * Security event monitoring
 */
export function recordSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: any): void {
  // Record security metrics
  monitoring.incrementCounter('security_events_total', 1, {
    event,
    severity
  });

  // Log security event
  loggingService.logSecurity(event, severity, metadata);
}

/**
 * Rate limiting monitoring
 */
export function recordRateLimitEvent(identifier: string, limit: number, current: number, blocked: boolean): void {
  // Record rate limit metrics
  monitoring.recordHistogram('rate_limit_usage', current, {
    identifier,
    limit: limit.toString()
  });

  if (blocked) {
    monitoring.incrementCounter('rate_limit_blocks_total', 1, {
      identifier
    });

    loggingService.logSecurity('Rate limit exceeded', 'medium', {
      identifier,
      limit,
      current,
      blocked
    });
  }
}

/**
 * Cache operation monitoring
 */
export function recordCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, duration?: number): void {
  // Record cache metrics
  monitoring.incrementCounter('cache_operations_total', 1, {
    operation,
    key_prefix: key.split(':')[0] || 'unknown'
  });

  if (duration !== undefined) {
    monitoring.recordHistogram('cache_operation_duration', duration, {
      operation
    });
  }

  // Calculate cache hit rate
  if (operation === 'hit' || operation === 'miss') {
    monitoring.incrementCounter(`cache_${operation}s_total`, 1);
  }
}

/**
 * Memory usage monitoring
 */
export function recordMemoryUsage(): void {
  const memUsage = process.memoryUsage();
  
  monitoring.recordMetric('memory_usage_rss', memUsage.rss);
  monitoring.recordMetric('memory_usage_heap_used', memUsage.heapUsed);
  monitoring.recordMetric('memory_usage_heap_total', memUsage.heapTotal);
  monitoring.recordMetric('memory_usage_external', memUsage.external);
  
  if (memUsage.arrayBuffers) {
    monitoring.recordMetric('memory_usage_array_buffers', memUsage.arrayBuffers);
  }
}

/**
 * Event loop lag monitoring
 */
export function monitorEventLoopLag(): void {
  const start = process.hrtime.bigint();
  
  setImmediate(() => {
    const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
    monitoring.recordMetric('event_loop_lag_ms', lag);
    
    if (lag > 100) {
      loggingService.warn('High event loop lag detected', {
        lag: `${lag.toFixed(2)}ms`,
        threshold: '100ms'
      });
    }
  });
}

/**
 * Setup periodic monitoring
 */
export function setupPeriodicMonitoring(): void {
  // Monitor memory usage every 30 seconds
  setInterval(() => {
    recordMemoryUsage();
  }, 30000);

  // Monitor event loop lag every 5 seconds
  setInterval(() => {
    monitorEventLoopLag();
  }, 5000);

  // Record process uptime every minute
  setInterval(() => {
    monitoring.recordMetric('process_uptime_seconds', process.uptime());
  }, 60000);

  // Record active handles and requests
  setInterval(() => {
    const handles = (process as any)._getActiveHandles?.()?.length || 0;
    const requests = (process as any)._getActiveRequests?.()?.length || 0;
    
    monitoring.recordMetric('active_handles', handles);
    monitoring.recordMetric('active_requests', requests);
  }, 30000);
}

/**
 * Metrics endpoint middleware
 * Provides Prometheus-compatible metrics endpoint
 */
export function metricsEndpoint(req: Request, res: Response): void {
  try {
    const metrics = monitoring.getMetrics();
    const healthStatus = monitoring.getHealthStatus();
    const activeAlerts = monitoring.getActiveAlerts();
    
    const prometheusMetrics = convertToPrometheusFormat(metrics);
    
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(prometheusMetrics);
  } catch (error) {
    loggingService.error('Failed to generate metrics', error);
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
}

/**
 * Health check endpoint middleware
 */
export async function healthCheckEndpoint(req: Request, res: Response): Promise<void> {
  try {
    const health = await monitoring.getHealthStatus();
    const uptime = monitoring.getUptime();
    const version = process.env.npm_package_version || '1.0.0';
    
    const response = {
      status: health.status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime / 1000),
      version,
      checks: health.details,
      alerts: monitoring.getActiveAlerts().length
    };
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(response);
  } catch (error) {
    loggingService.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Convert metrics to Prometheus format
 */
function convertToPrometheusFormat(metrics: Record<string, any>): string {
  const lines: string[] = [];
  
  for (const [name, stats] of Object.entries(metrics)) {
    if (!stats || typeof stats !== 'object') continue;
    
    // Add metric help and type
    lines.push(`# HELP ${name} ${name} metric`);
    lines.push(`# TYPE ${name} gauge`);
    
    // Add metric value
    if (typeof stats.latest === 'number') {
      lines.push(`${name} ${stats.latest} ${stats.timestamp || Date.now()}`);
    }
    
    // Add additional stats
    if (typeof stats.avg === 'number') {
      lines.push(`${name}_avg ${stats.avg} ${stats.timestamp || Date.now()}`);
    }
    
    if (typeof stats.p95 === 'number') {
      lines.push(`${name}_p95 ${stats.p95} ${stats.timestamp || Date.now()}`);
    }
  }
  
  return lines.join('\n') + '\n';
}

// Export all monitoring functions
export {
  monitoring,
  recordDatabaseOperation,
  recordAuthEvent,
  recordBusinessEvent,
  recordSecurityEvent,
  recordRateLimitEvent,
  recordCacheOperation,
  setupPeriodicMonitoring
};