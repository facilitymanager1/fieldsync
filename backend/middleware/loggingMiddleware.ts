import { Request, Response, NextFunction } from 'express';
import loggingService from '../services/loggingService';
import { v4 as uuidv4 } from 'uuid';

export interface RequestContext {
  requestId: string;
  traceId: string;
  startTime: number;
  userId?: string;
  userRole?: string;
  userAgent?: string;
  ip?: string;
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      traceId: string;
      startTime: number;
      context: RequestContext;
      log: typeof loggingService;
    }
  }
}

class LoggingMiddleware {
  /**
   * Request ID and trace ID middleware
   */
  requestContext() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Generate unique identifiers
      const requestId = uuidv4();
      const traceId = req.headers['x-trace-id'] as string || loggingService.generateTraceId();
      const startTime = Date.now();

      // Attach to request
      req.id = requestId;
      req.traceId = traceId;
      req.startTime = startTime;

      // Create request context
      req.context = {
        requestId,
        traceId,
        startTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress || 'unknown'
      };

      // Create child logger with context
      req.log = loggingService.child({
        requestId,
        traceId,
        service: 'api'
      });

      // Add trace ID to response headers
      res.setHeader('X-Trace-Id', traceId);
      res.setHeader('X-Request-Id', requestId);

      next();
    };
  }

  /**
   * User context middleware (should be used after authentication)
   */
  userContext() {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      
      if (user) {
        req.context.userId = user.id;
        req.context.userRole = user.role;
        
        // Update child logger with user context
        req.log = loggingService.child({
          ...req.context,
          userId: user.id,
          userRole: user.role
        });
      }

      next();
    };
  }

  /**
   * Request logging middleware
   */
  requestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Log incoming request
      req.log.info('Incoming request', {
        method: req.method,
        url: req.originalUrl || req.url,
        query: req.query,
        params: req.params,
        headers: {
          'user-agent': req.get('User-Agent'),
          'content-type': req.get('Content-Type'),
          'accept': req.get('Accept'),
          'origin': req.get('Origin'),
          'referer': req.get('Referer')
        },
        body: this.sanitizeRequestBody(req.body),
        ip: req.context.ip
      });

      // Override res.end to capture response
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        const responseTime = Date.now() - startTime;
        
        // Log the response
        loggingService.logRequest(req, res, responseTime);
        
        // Log performance if slow
        if (responseTime > 1000) {
          req.log.warn('Slow request detected', {
            responseTime,
            threshold: 1000,
            method: req.method,
            url: req.originalUrl || req.url
          });
        }

        originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Error logging middleware
   */
  errorLogger() {
    return (error: any, req: Request, res: Response, next: NextFunction) => {
      const responseTime = Date.now() - req.startTime;

      // Log the error with full context
      req.log.error('Request error', error, {
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        responseTime,
        query: req.query,
        params: req.params,
        body: this.sanitizeRequestBody(req.body),
        headers: req.headers,
        stack: error.stack,
        errorCode: error.code,
        errorType: error.name
      });

      // Log security-related errors separately
      if (this.isSecurityError(error, req)) {
        loggingService.logSecurity('Request security error', 'high', {
          error: error.message,
          method: req.method,
          url: req.originalUrl || req.url,
          ip: req.context.ip,
          userAgent: req.context.userAgent,
          userId: req.context.userId
        });
      }

      next(error);
    };
  }

  /**
   * Authentication logging middleware
   */
  authLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalJson = res.json;

      res.json = function(body) {
        // Log authentication attempts
        if (req.path.includes('/auth/') || req.path.includes('/login')) {
          const success = res.statusCode >= 200 && res.statusCode < 300;
          
          loggingService.logAuth(
            `${req.method} ${req.path}`,
            body?.user?.id,
            success,
            {
              statusCode: res.statusCode,
              ip: req.context.ip,
              userAgent: req.context.userAgent,
              method: req.method,
              path: req.path
            }
          );

          // Log failed authentication as security event
          if (!success) {
            loggingService.logSecurity('Failed authentication attempt', 'medium', {
              ip: req.context.ip,
              userAgent: req.context.userAgent,
              path: req.path,
              statusCode: res.statusCode,
              email: req.body?.email // Only log email on failed attempts
            });
          }
        }

        return originalJson.call(this, body);
      };

      next();
    };
  }

  /**
   * Performance monitoring middleware
   */
  performanceMonitor() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = process.hrtime.bigint();
      
      // Monitor memory usage
      const memoryBefore = process.memoryUsage();

      res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        const memoryAfter = process.memoryUsage();

        // Log performance metrics
        loggingService.logPerformance(
          `${req.method} ${req.route?.path || req.path}`,
          durationMs,
          {
            statusCode: res.statusCode,
            memoryUsage: {
              heapUsedDelta: memoryAfter.heapUsed - memoryBefore.heapUsed,
              heapTotalDelta: memoryAfter.heapTotal - memoryBefore.heapTotal,
              externalDelta: memoryAfter.external - memoryBefore.external
            },
            headers: {
              contentLength: res.get('Content-Length'),
              contentType: res.get('Content-Type')
            }
          }
        );

        // Alert on performance issues
        if (durationMs > 5000) {
          req.log.warn('Performance alert: Very slow request', {
            duration: durationMs,
            threshold: 5000,
            url: req.originalUrl || req.url
          });
        }

        if (memoryAfter.heapUsed - memoryBefore.heapUsed > 50 * 1024 * 1024) { // 50MB
          req.log.warn('Performance alert: High memory usage', {
            memoryDelta: memoryAfter.heapUsed - memoryBefore.heapUsed,
            threshold: 50 * 1024 * 1024,
            url: req.originalUrl || req.url
          });
        }
      });

      next();
    };
  }

  /**
   * Business event logging middleware
   */
  businessEventLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalJson = res.json;

      res.json = function(body) {
        // Log business events based on successful operations
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const event = this.determineBusinessEvent(req, body);
          
          if (event) {
            loggingService.logBusiness(
              event.action,
              event.entity,
              event.entityId,
              {
                userId: req.context.userId,
                userRole: req.context.userRole,
                method: req.method,
                path: req.path,
                data: event.data
              }
            );
          }
        }

        return originalJson.call(this, body);
      }.bind(this);

      next();
    };
  }

  /**
   * Rate limiting logging middleware
   */
  rateLimitLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check if request is rate limited
      const rateLimitRemaining = res.get('X-RateLimit-Remaining');
      const rateLimitLimit = res.get('X-RateLimit-Limit');

      if (rateLimitRemaining && rateLimitLimit) {
        const remaining = parseInt(rateLimitRemaining);
        const limit = parseInt(rateLimitLimit);

        // Log when approaching rate limit
        if (remaining < limit * 0.1) { // Less than 10% remaining
          req.log.warn('Rate limit warning', {
            remaining,
            limit,
            percentage: (remaining / limit) * 100,
            ip: req.context.ip,
            endpoint: req.path
          });
        }

        // Log rate limit exceeded
        if (remaining === 0) {
          loggingService.logSecurity('Rate limit exceeded', 'medium', {
            ip: req.context.ip,
            userAgent: req.context.userAgent,
            endpoint: req.path,
            limit,
            userId: req.context.userId
          });
        }
      }

      next();
    };
  }

  /**
   * Sanitize request body for logging
   */
  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = ['password', 'token', 'authorization', 'ssn', 'creditCard', 'bankAccount'];
    const sanitized = { ...body };

    for (const key in sanitized) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Determine if error is security-related
   */
  private isSecurityError(error: any, req: Request): boolean {
    const securityIndicators = [
      'unauthorized',
      'forbidden',
      'authentication',
      'permission',
      'access denied',
      'invalid token',
      'csrf',
      'injection',
      'xss',
      'brute force'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';
    const path = req.path?.toLowerCase() || '';

    return securityIndicators.some(indicator => 
      errorMessage.includes(indicator) || 
      errorName.includes(indicator) ||
      (path.includes('auth') && res.statusCode >= 400)
    );
  }

  /**
   * Determine business event from request and response
   */
  private determineBusinessEvent(req: Request, body: any): any {
    const method = req.method;
    const path = req.path;
    
    // Define business event patterns
    const patterns = [
      {
        pattern: /\/api\/tickets$/,
        method: 'POST',
        action: 'ticket_created',
        entity: 'ticket',
        entityId: body?.id || body?.data?.id
      },
      {
        pattern: /\/api\/tickets\/(\w+)$/,
        method: 'PUT',
        action: 'ticket_updated',
        entity: 'ticket',
        entityId: req.params.id
      },
      {
        pattern: /\/api\/users$/,
        method: 'POST',
        action: 'user_created',
        entity: 'user',
        entityId: body?.id || body?.data?.id
      },
      {
        pattern: /\/api\/shifts$/,
        method: 'POST',
        action: 'shift_started',
        entity: 'shift',
        entityId: body?.id || body?.data?.id
      },
      {
        pattern: /\/api\/shifts\/(\w+)\/end$/,
        method: 'POST',
        action: 'shift_ended',
        entity: 'shift',
        entityId: req.params.id
      }
    ];

    for (const pattern of patterns) {
      if (pattern.pattern.test(path) && pattern.method === method) {
        return {
          action: pattern.action,
          entity: pattern.entity,
          entityId: pattern.entityId,
          data: this.sanitizeRequestBody(body)
        };
      }
    }

    return null;
  }

  /**
   * Health check logging middleware
   */
  healthCheckLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip logging for health check endpoints to reduce noise
      if (req.path === '/health' || req.path === '/healthz' || req.path === '/ping') {
        return next();
      }

      // Use the regular request logger for other endpoints
      return this.requestLogger()(req, res, next);
    };
  }

  /**
   * Structured logging for API responses
   */
  responseLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;

      res.send = function(body) {
        // Log API response structure for debugging
        if (req.path.startsWith('/api/') && res.statusCode !== 200) {
          req.log.debug('API Response', {
            statusCode: res.statusCode,
            responseBody: typeof body === 'string' ? body.substring(0, 1000) : body,
            responseHeaders: res.getHeaders(),
            contentType: res.get('Content-Type'),
            contentLength: res.get('Content-Length')
          });
        }

        return originalSend.call(this, body);
      };

      next();
    };
  }
}

export default new LoggingMiddleware();