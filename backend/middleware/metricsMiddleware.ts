import { Request, Response, NextFunction } from 'express';
import metricsService from '../services/metricsService';
import { performance } from 'perf_hooks';

declare global {
  namespace Express {
    interface Request {
      startTime: number;
      performanceMarks: Map<string, number>;
    }
  }
}

class MetricsMiddleware {
  private activeConnections = 0;
  private requestsInProgress = new Map<string, number>();

  /**
   * HTTP metrics collection middleware
   */
  collectHttpMetrics() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      req.startTime = startTime;
      req.performanceMarks = new Map();

      // Track active connections
      this.activeConnections++;
      metricsService.updateActiveConnections(this.activeConnections);

      // Track requests in progress per endpoint
      const endpoint = `${req.method} ${req.route?.path || req.path}`;
      this.requestsInProgress.set(endpoint, (this.requestsInProgress.get(endpoint) || 0) + 1);

      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = (chunk?: any, encoding?: any) => {
        const duration = Date.now() - startTime;
        
        // Record HTTP metrics
        metricsService.recordHttpRequest(req, res, duration);
        
        // Update connection count
        this.activeConnections--;
        metricsService.updateActiveConnections(this.activeConnections);

        // Update requests in progress
        const currentCount = this.requestsInProgress.get(endpoint) || 1;
        if (currentCount <= 1) {
          this.requestsInProgress.delete(endpoint);
        } else {
          this.requestsInProgress.set(endpoint, currentCount - 1);
        }

        // Record errors if status code indicates error
        if (res.statusCode >= 400) {
          const errorType = this.getErrorType(res.statusCode);
          const severity = this.getErrorSeverity(res.statusCode);
          
          metricsService.recordError(
            errorType,
            severity,
            'api',
            endpoint
          );
        }

        originalEnd.call(res, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Performance monitoring middleware
   */
  performanceMonitoring() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Mark performance milestones
      req.performanceMarks.set('request_start', performance.now());

      // Override various methods to track performance
      const originalJson = res.json;
      res.json = function(body: any) {
        req.performanceMarks.set('json_serialization_start', performance.now());
        const result = originalJson.call(this, body);
        req.performanceMarks.set('json_serialization_end', performance.now());
        return result;
      };

      res.on('finish', () => {
        req.performanceMarks.set('request_end', performance.now());
        this.recordPerformanceMetrics(req, res);
      });

      next();
    };
  }

  /**
   * Business metrics middleware
   */
  businessMetrics() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalJson = res.json;

      res.json = function(body: any) {
        // Record business metrics based on successful operations
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.recordBusinessEvents(req, res, body);
        }

        return originalJson.call(this, body);
      }.bind(this);

      next();
    };
  }

  /**
   * Database operation metrics middleware
   */
  databaseMetrics() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Monkey patch common database operations
      if ((req as any).db) {
        const db = (req as any).db;
        
        // Wrap common operations
        const operations = ['find', 'findOne', 'insertOne', 'updateOne', 'deleteOne', 'aggregate'];
        
        operations.forEach(op => {
          if (db[op]) {
            const original = db[op];
            db[op] = function(...args: any[]) {
              const start = Date.now();
              const collection = this.collection?.collectionName || 'unknown';
              
              const result = original.apply(this, args);
              
              // Handle both promises and callbacks
              if (result && typeof result.then === 'function') {
                return result
                  .then((data: any) => {
                    metricsService.recordDatabaseOperation(op, collection, Date.now() - start, 'success');
                    return data;
                  })
                  .catch((error: any) => {
                    metricsService.recordDatabaseOperation(op, collection, Date.now() - start, 'failure');
                    throw error;
                  });
              }
              
              return result;
            };
          }
        });
      }

      next();
    };
  }

  /**
   * Cache metrics middleware
   */
  cacheMetrics() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add cache headers tracking
      res.on('finish', () => {
        const cacheStatus = res.get('X-Cache-Status');
        if (cacheStatus) {
          metricsService.recordCacheOperation(
            'get',
            cacheStatus.toLowerCase() as 'hit' | 'miss',
            'redis'
          );
        }
      });

      next();
    };
  }

  /**
   * Authentication metrics middleware
   */
  authMetrics() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Track authentication attempts
      if (req.path.includes('/auth/') || req.path.includes('/login')) {
        const originalJson = res.json;
        
        res.json = function(body: any) {
          const success = res.statusCode >= 200 && res.statusCode < 300;
          const role = body?.user?.role || 'unknown';
          const method = req.body?.method || 'password';
          
          metricsService.recordUserLogin(
            success ? 'success' : 'failure',
            role,
            method
          );

          return originalJson.call(this, body);
        };
      }

      next();
    };
  }

  /**
   * Error tracking middleware
   */
  errorTracking() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      // Record error metrics
      const errorType = error.name || 'UnknownError';
      const severity = this.getErrorSeverityFromError(error);
      const service = this.getServiceFromRequest(req);
      const endpoint = `${req.method} ${req.route?.path || req.path}`;

      metricsService.recordError(errorType, severity, service, endpoint);

      next(error);
    };
  }

  /**
   * Rate limiting metrics middleware
   */
  rateLimitMetrics() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check rate limit headers
      res.on('finish', () => {
        const rateLimitRemaining = res.get('X-RateLimit-Remaining');
        const rateLimitLimit = res.get('X-RateLimit-Limit');

        if (rateLimitRemaining && rateLimitLimit) {
          const remaining = parseInt(rateLimitRemaining);
          const limit = parseInt(rateLimitLimit);
          const utilization = ((limit - remaining) / limit) * 100;

          // Record rate limit utilization
          metricsService.recordBusinessKPI('rate_limit_utilization', utilization, {
            endpoint: req.path,
            ip: req.ip || 'unknown'
          });

          // Record if rate limit was hit
          if (remaining === 0) {
            metricsService.recordError(
              'RateLimitExceeded',
              'medium',
              'rate-limiter',
              req.path
            );
          }
        }
      });

      next();
    };
  }

  /**
   * Custom business event tracking
   */
  trackBusinessEvent(
    eventType: string,
    eventName: string,
    value: number = 1,
    labels: Record<string, string> = {}
  ) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add event tracking to request context
      if (!(req as any).businessEvents) {
        (req as any).businessEvents = [];
      }

      (req as any).businessEvents.push({
        type: eventType,
        name: eventName,
        value,
        labels: {
          ...labels,
          userId: (req as any).user?.id || 'anonymous',
          userRole: (req as any).user?.role || 'anonymous',
          endpoint: req.path
        }
      });

      next();
    };
  }

  /**
   * Flush business events middleware
   */
  flushBusinessEvents() {
    return (req: Request, res: Response, next: NextFunction) => {
      res.on('finish', () => {
        const events = (req as any).businessEvents;
        if (events && Array.isArray(events)) {
          events.forEach((event: any) => {
            metricsService.recordBusinessKPI(
              `${event.type}_${event.name}`,
              event.value,
              event.labels
            );
          });
        }
      });

      next();
    };
  }

  /**
   * Real-time metrics middleware
   */
  realTimeMetrics() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Track real-time metrics
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const endpoint = `${req.method} ${req.route?.path || req.path}`;

        // Update real-time performance metrics
        metricsService.recordBusinessKPI('realtime_response_time', duration, {
          endpoint,
          status: res.statusCode.toString()
        });

        // Track concurrent users
        const userId = (req as any).user?.id;
        if (userId) {
          metricsService.recordBusinessKPI('concurrent_users', 1, {
            timestamp: Math.floor(Date.now() / 60000).toString() // Group by minute
          });
        }
      });

      next();
    };
  }

  /**
   * Record performance metrics from request
   */
  private recordPerformanceMetrics(req: Request, res: Response) {
    const marks = req.performanceMarks;
    const endpoint = `${req.method} ${req.route?.path || req.path}`;

    // Calculate various performance metrics
    const totalDuration = marks.get('request_end')! - marks.get('request_start')!;
    
    if (marks.has('json_serialization_start') && marks.has('json_serialization_end')) {
      const serializationTime = marks.get('json_serialization_end')! - marks.get('json_serialization_start')!;
      
      metricsService.recordBusinessKPI('json_serialization_time', serializationTime, {
        endpoint,
        status: res.statusCode.toString()
      });
    }

    // Record total request processing time
    metricsService.recordBusinessKPI('request_processing_time', totalDuration, {
      endpoint,
      status: res.statusCode.toString()
    });

    // Alert on slow requests
    if (totalDuration > 5000) { // 5 seconds
      metricsService.recordError(
        'SlowRequest',
        'medium',
        'performance',
        endpoint
      );
    }
  }

  /**
   * Record business events based on API operations
   */
  private recordBusinessEvents(req: Request, res: Response, body: any) {
    const method = req.method;
    const path = req.path;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role || 'anonymous';

    // Ticket operations
    if (path.includes('/tickets')) {
      if (method === 'POST') {
        const priority = body?.priority || req.body?.priority || 'medium';
        const assignedToRole = body?.assignedTo?.role || 'unassigned';
        
        metricsService.recordTicketOperation('create', 'success', priority, assignedToRole);
        metricsService.recordBusinessKPI('tickets_created_total', 1, {
          priority,
          assignedToRole,
          createdBy: userRole
        });
      } else if (method === 'PUT' && req.params.id) {
        metricsService.recordTicketOperation('update', 'success', 'unknown', userRole);
      }
    }

    // Shift operations
    if (path.includes('/shifts')) {
      if (method === 'POST' && path.includes('/start')) {
        metricsService.recordShiftOperation('start', 'success', userRole);
        metricsService.recordBusinessKPI('shifts_started_total', 1, {
          userRole,
          userId: userId || 'unknown'
        });
      } else if (method === 'POST' && path.includes('/end')) {
        metricsService.recordShiftOperation('end', 'success', userRole);
        metricsService.recordBusinessKPI('shifts_ended_total', 1, {
          userRole,
          userId: userId || 'unknown'
        });
      }
    }

    // User operations
    if (path.includes('/users') && method === 'POST') {
      const newUserRole = body?.role || req.body?.role || 'unknown';
      metricsService.recordBusinessKPI('users_created_total', 1, {
        role: newUserRole,
        createdBy: userRole
      });
    }

    // Location tracking
    if (path.includes('/location') && method === 'POST') {
      metricsService.recordBusinessKPI('location_updates_total', 1, {
        userId: userId || 'unknown',
        userRole
      });
    }

    // Expense operations
    if (path.includes('/expenses')) {
      if (method === 'POST') {
        const amount = body?.amount || req.body?.amount || 0;
        const category = body?.category || req.body?.category || 'unknown';
        
        metricsService.recordBusinessKPI('expenses_submitted_total', 1, {
          category,
          userRole
        });
        
        metricsService.recordBusinessKPI('expenses_amount_total', amount, {
          category,
          userRole
        });
      }
    }
  }

  /**
   * Get error type from status code
   */
  private getErrorType(statusCode: number): string {
    if (statusCode === 400) return 'BadRequest';
    if (statusCode === 401) return 'Unauthorized';
    if (statusCode === 403) return 'Forbidden';
    if (statusCode === 404) return 'NotFound';
    if (statusCode === 429) return 'RateLimited';
    if (statusCode >= 500) return 'ServerError';
    return 'ClientError';
  }

  /**
   * Get error severity from status code
   */
  private getErrorSeverity(statusCode: number): 'low' | 'medium' | 'high' | 'critical' {
    if (statusCode === 401 || statusCode === 403) return 'high';
    if (statusCode === 429) return 'medium';
    if (statusCode >= 500) return 'critical';
    return 'low';
  }

  /**
   * Get error severity from error object
   */
  private getErrorSeverityFromError(error: any): 'low' | 'medium' | 'high' | 'critical' {
    if (error.name === 'ValidationError') return 'low';
    if (error.name === 'UnauthorizedError') return 'high';
    if (error.name === 'DatabaseError') return 'critical';
    if (error.status >= 500) return 'critical';
    if (error.status >= 400) return 'medium';
    return 'low';
  }

  /**
   * Get service name from request
   */
  private getServiceFromRequest(req: Request): string {
    if (req.path.startsWith('/api/auth')) return 'authentication';
    if (req.path.startsWith('/api/tickets')) return 'tickets';
    if (req.path.startsWith('/api/shifts')) return 'shifts';
    if (req.path.startsWith('/api/users')) return 'users';
    if (req.path.startsWith('/api/location')) return 'location';
    if (req.path.startsWith('/api/expenses')) return 'expenses';
    return 'api';
  }

  /**
   * Get current active connections
   */
  getActiveConnections(): number {
    return this.activeConnections;
  }

  /**
   * Get requests in progress
   */
  getRequestsInProgress(): Map<string, number> {
    return new Map(this.requestsInProgress);
  }
}

export default new MetricsMiddleware();