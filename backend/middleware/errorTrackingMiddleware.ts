import { Request, Response, NextFunction } from 'express';
import errorTrackingService from '../services/errorTrackingService';
import loggingService from '../services/loggingService';

declare global {
  namespace Express {
    interface Request {
      errorContext?: {
        breadcrumbs: Array<{
          message: string;
          category: string;
          level?: string;
          data?: Record<string, any>;
        }>;
        tags: string[];
        extra: Record<string, any>;
      };
      addBreadcrumb?: (breadcrumb: {
        message: string;
        category: string;
        level?: string;
        data?: Record<string, any>;
      }) => void;
      captureError?: (error: Error, context?: {
        severity?: 'low' | 'medium' | 'high' | 'critical';
        tags?: string[];
        extra?: Record<string, any>;
      }) => string;
    }
  }
}

class ErrorTrackingMiddleware {
  /**
   * Initialize error tracking context for request
   */
  initializeContext() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Initialize error context
      req.errorContext = {
        breadcrumbs: [],
        tags: [],
        extra: {}
      };

      // Add breadcrumb helper function
      req.addBreadcrumb = (breadcrumb) => {
        const sessionId = req.sessionID || req.ip || 'unknown';
        errorTrackingService.addBreadcrumb(sessionId, breadcrumb);
        
        if (req.errorContext) {
          req.errorContext.breadcrumbs.push({
            timestamp: new Date().toISOString(),
            ...breadcrumb
          });
        }
      };

      // Add error capture helper function
      req.captureError = (error, context = {}) => {
        return this.captureRequestError(req, error, context);
      };

      // Add initial request breadcrumb
      req.addBreadcrumb({
        message: `${req.method} ${req.url}`,
        category: 'http',
        level: 'info',
        data: {
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        }
      });

      next();
    };
  }

  /**
   * Automatic error tracking middleware
   */
  trackErrors() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Track request start
      const startTime = Date.now();
      
      // Override res.end to capture completion
      const originalEnd = res.end;
      res.end = (chunk?: any, encoding?: any) => {
        const duration = Date.now() - startTime;
        
        // Add response breadcrumb
        if (req.addBreadcrumb) {
          req.addBreadcrumb({
            message: `Response ${res.statusCode}`,
            category: 'http',
            level: res.statusCode >= 400 ? 'error' : 'info',
            data: {
              statusCode: res.statusCode,
              duration,
              contentLength: res.get('content-length')
            }
          });
        }

        // Track HTTP errors automatically
        if (res.statusCode >= 400) {
          const error = new Error(`HTTP ${res.statusCode}: ${req.method} ${req.url}`);
          error.name = 'HTTPError';

          this.captureRequestError(req, error, {
            severity: this.getHttpErrorSeverity(res.statusCode),
            tags: ['http-error', `status-${res.statusCode}`],
            extra: {
              statusCode: res.statusCode,
              duration,
              responseBody: chunk?.toString().substring(0, 1000) // First 1000 chars
            }
          });
        }

        originalEnd.call(res, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Global error handler with tracking
   */
  errorHandler() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      // Capture the error
      const errorId = this.captureRequestError(req, error, {
        severity: this.getErrorSeverity(error),
        tags: ['unhandled-error'],
        extra: {
          route: req.route?.path,
          params: req.params,
          query: req.query,
          body: this.sanitizeRequestBody(req.body)
        }
      });

      // Add error ID to response headers for debugging
      res.set('X-Error-ID', errorId);

      // Log the error with tracking info
      loggingService.error('Unhandled error captured', error, {
        errorId,
        method: req.method,
        url: req.url,
        userId: (req as any).user?.id,
        sessionId: req.sessionID
      });

      // Send error response
      if (!res.headersSent) {
        const statusCode = error.statusCode || error.status || 500;
        const message = process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message;

        res.status(statusCode).json({
          success: false,
          error: message,
          ...(process.env.NODE_ENV !== 'production' && { 
            errorId,
            stack: error.stack 
          })
        });
      }

      next();
    };
  }

  /**
   * Database error tracking middleware
   */
  trackDatabaseErrors() {
    return (req: Request, res: Response, next: NextFunction) => {
      // This middleware can be used to wrap database operations
      const originalQuery = req.query;
      
      if (req.addBreadcrumb) {
        req.addBreadcrumb({
          message: 'Database query initiated',
          category: 'database',
          level: 'debug',
          data: {
            query: originalQuery
          }
        });
      }

      next();
    };
  }

  /**
   * Authentication error tracking
   */
  trackAuthenticationErrors() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Track authentication attempts
      if (req.path.includes('/auth') || req.path.includes('/login')) {
        if (req.addBreadcrumb) {
          req.addBreadcrumb({
            message: 'Authentication attempt',
            category: 'auth',
            level: 'info',
            data: {
              path: req.path,
              method: req.method,
              userAgent: req.get('User-Agent')
            }
          });
        }

        // Track failed authentication on response
        const originalJson = res.json;
        res.json = function(body: any) {
          if (res.statusCode === 401 || res.statusCode === 403) {
            const error = new Error('Authentication failed');
            error.name = 'AuthenticationError';

            if (req.captureError) {
              req.captureError(error, {
                severity: 'high',
                tags: ['auth-failure', 'security'],
                extra: {
                  attemptedPath: req.path,
                  userAgent: req.get('User-Agent'),
                  ip: req.ip
                }
              });
            }
          }

          return originalJson.call(this, body);
        };
      }

      next();
    };
  }

  /**
   * Business logic error tracking
   */
  trackBusinessErrors() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Add context tags based on request path
      if (req.errorContext) {
        if (req.path.includes('/tickets')) {
          req.errorContext.tags.push('tickets');
        }
        if (req.path.includes('/shifts')) {
          req.errorContext.tags.push('shifts');
        }
        if (req.path.includes('/users')) {
          req.errorContext.tags.push('users');
        }
        if (req.path.includes('/expenses')) {
          req.errorContext.tags.push('expenses');
        }
      }

      next();
    };
  }

  /**
   * Rate limiting error tracking
   */
  trackRateLimitingErrors() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check for rate limit headers
      res.on('finish', () => {
        if (res.statusCode === 429) {
          const error = new Error('Rate limit exceeded');
          error.name = 'RateLimitError';

          if (req.captureError) {
            req.captureError(error, {
              severity: 'medium',
              tags: ['rate-limit', 'security'],
              extra: {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                rateLimitRemaining: res.get('X-RateLimit-Remaining'),
                rateLimitLimit: res.get('X-RateLimit-Limit')
              }
            });
          }
        }
      });

      next();
    };
  }

  /**
   * Custom error tracking for specific services
   */
  trackServiceErrors(serviceName: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.errorContext) {
        req.errorContext.tags.push(serviceName);
        req.errorContext.extra.service = serviceName;
      }

      // Add service breadcrumb
      if (req.addBreadcrumb) {
        req.addBreadcrumb({
          message: `${serviceName} service accessed`,
          category: 'service',
          level: 'debug',
          data: {
            service: serviceName,
            endpoint: req.path
          }
        });
      }

      next();
    };
  }

  /**
   * User context tracking
   */
  trackUserContext() {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      
      if (user && req.errorContext) {
        req.errorContext.extra.userId = user.id;
        req.errorContext.extra.userRole = user.role;
        req.errorContext.tags.push(`user-${user.role}`);
      }

      next();
    };
  }

  /**
   * Performance tracking with error correlation
   */
  trackPerformanceErrors() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const startMemory = process.memoryUsage();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const endMemory = process.memoryUsage();
        
        // Track slow requests as potential errors
        if (duration > 10000) { // 10 seconds
          const error = new Error(`Slow request: ${duration}ms`);
          error.name = 'PerformanceError';

          if (req.captureError) {
            req.captureError(error, {
              severity: 'medium',
              tags: ['performance', 'slow-request'],
              extra: {
                duration,
                memoryDelta: {
                  heapUsed: endMemory.heapUsed - startMemory.heapUsed,
                  heapTotal: endMemory.heapTotal - startMemory.heapTotal
                }
              }
            });
          }
        }

        // Track memory spikes
        const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
        if (memoryIncrease > 50 * 1024 * 1024) { // 50MB increase
          const error = new Error(`Memory spike: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
          error.name = 'MemoryError';

          if (req.captureError) {
            req.captureError(error, {
              severity: 'high',
              tags: ['performance', 'memory'],
              extra: {
                memoryIncrease,
                duration,
                endpoint: req.path
              }
            });
          }
        }
      });

      next();
    };
  }

  /**
   * Capture error with request context
   */
  private captureRequestError(
    req: Request, 
    error: Error, 
    context: {
      severity?: 'low' | 'medium' | 'high' | 'critical';
      tags?: string[];
      extra?: Record<string, any>;
    } = {}
  ): string {
    const user = (req as any).user;
    const sessionId = req.sessionID || req.ip || 'unknown';

    return errorTrackingService.captureError(error, {
      service: this.getServiceFromPath(req.path),
      endpoint: `${req.method} ${req.route?.path || req.path}`,
      userId: user?.id,
      sessionId,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      severity: context.severity,
      tags: [
        ...(req.errorContext?.tags || []),
        ...(context.tags || [])
      ],
      extra: {
        ...req.errorContext?.extra,
        ...context.extra,
        method: req.method,
        url: req.url,
        headers: this.sanitizeHeaders(req.headers),
        params: req.params,
        query: req.query
      }
    });
  }

  /**
   * Get service name from request path
   */
  private getServiceFromPath(path: string): string {
    if (path.includes('/auth')) return 'authentication';
    if (path.includes('/tickets')) return 'tickets';
    if (path.includes('/shifts')) return 'shifts';
    if (path.includes('/users')) return 'users';
    if (path.includes('/expenses')) return 'expenses';
    if (path.includes('/locations')) return 'location';
    if (path.includes('/metrics')) return 'monitoring';
    if (path.includes('/logs')) return 'logging';
    return 'api';
  }

  /**
   * Get error severity based on error properties
   */
  private getErrorSeverity(error: any): 'low' | 'medium' | 'high' | 'critical' {
    if (error.name === 'DatabaseError' || error.code === 'ECONNREFUSED') {
      return 'critical';
    }
    if (error.name === 'ValidationError' || error.name === 'AuthenticationError') {
      return 'high';
    }
    if (error.name === 'BusinessRuleError' || error.name === 'PermissionError') {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get HTTP error severity based on status code
   */
  private getHttpErrorSeverity(statusCode: number): 'low' | 'medium' | 'high' | 'critical' {
    if (statusCode >= 500) return 'critical';
    if (statusCode === 429 || statusCode === 401 || statusCode === 403) return 'high';
    if (statusCode >= 400) return 'medium';
    return 'low';
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'credential'];

    const sanitizeObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;

      const result = Array.isArray(obj) ? [] : {};
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }

      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

export default new ErrorTrackingMiddleware();