import { Request, Response, NextFunction } from 'express';
import rateLimitingService, { RateLimitResult } from '../services/rateLimitingService';
import loggingService from '../services/loggingService';
import metricsService from '../services/metricsService';

declare global {
  namespace Express {
    interface Request {
      rateLimitInfo?: RateLimitResult;
      rateLimitExempt?: boolean;
    }
  }
}

class RateLimitingMiddleware {
  /**
   * Main rate limiting middleware
   */
  rateLimit() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Skip if request is exempt
        if (req.rateLimitExempt) {
          return next();
        }

        // Check rate limits
        const rateLimitResult = await rateLimitingService.checkRateLimit(req);

        if (rateLimitResult) {
          req.rateLimitInfo = rateLimitResult;

          // Set standard rate limit headers
          this.setRateLimitHeaders(res, rateLimitResult);

          if (!rateLimitResult.allowed) {
            return this.handleRateLimitExceeded(req, res, rateLimitResult);
          }
        }

        // Always set basic rate limit headers even when limits pass
        this.setBasicHeaders(req, res);

        next();
      } catch (error) {
        loggingService.error('Rate limiting middleware error', error);
        // Fail open - continue processing request
        next();
      }
    };
  }

  /**
   * Global rate limiting by IP
   */
  globalIpRateLimit(options: {
    windowMs: number;
    maxRequests: number;
    message?: string;
  }) {
    const requestCounts = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip;
      const now = Date.now();
      const windowStart = now - options.windowMs;

      // Clean up old entries
      for (const [key, value] of requestCounts) {
        if (value.resetTime <= now) {
          requestCounts.delete(key);
        }
      }

      let entry = requestCounts.get(ip);
      
      if (!entry || entry.resetTime <= now) {
        entry = { count: 0, resetTime: now + options.windowMs };
        requestCounts.set(ip, entry);
      }

      entry.count++;

      // Set headers
      res.set({
        'X-RateLimit-Limit': options.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, options.maxRequests - entry.count).toString(),
        'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
      });

      if (entry.count > options.maxRequests) {
        // Record metrics
        metricsService.recordBusinessKPI('rate_limit_exceeded', 1, {
          type: 'global_ip',
          ip,
          endpoint: req.path,
          method: req.method
        });

        return res.status(429).json({
          success: false,
          error: options.message || 'Too many requests from this IP',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        });
      }

      next();
    };
  }

  /**
   * Authentication-specific rate limiting
   */
  authRateLimit() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only apply to auth endpoints
      if (!req.path.includes('/auth/')) {
        return next();
      }

      // Stricter limits for authentication
      const key = `auth:${req.ip}`;
      const windowMs = 15 * 60 * 1000; // 15 minutes
      const maxAttempts = req.path.includes('/login') ? 5 : 3;

      try {
        // This would use Redis or similar for distributed rate limiting
        // For now, implementing basic in-memory tracking
        const isBlocked = await this.checkAuthRateLimit(key, maxAttempts, windowMs);

        if (isBlocked) {
          // Log security event
          loggingService.warn('Authentication rate limit exceeded', null, {
            ip: req.ip,
            endpoint: req.path,
            userAgent: req.get('User-Agent')
          });

          // Record security metrics
          metricsService.recordBusinessKPI('auth_rate_limit_exceeded', 1, {
            ip: req.ip,
            endpoint: req.path,
            userAgent: req.get('User-Agent')?.substring(0, 100) || 'unknown'
          });

          return res.status(429).json({
            success: false,
            error: 'Too many authentication attempts. Please wait 15 minutes.',
            code: 'AUTH_RATE_LIMIT_EXCEEDED',
            retryAfter: 900 // 15 minutes
          });
        }

        next();
      } catch (error) {
        loggingService.error('Auth rate limit check failed', error);
        next(); // Fail open
      }
    };
  }

  /**
   * API endpoint-specific rate limiting
   */
  endpointRateLimit(endpoint: string, options: {
    windowMs: number;
    maxRequests: number;
    skipIf?: (req: Request) => boolean;
  }) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip if condition is met
      if (options.skipIf && options.skipIf(req)) {
        return next();
      }

      // Only apply to specified endpoint
      if (!req.path.includes(endpoint)) {
        return next();
      }

      // Generate key based on user or IP
      const userId = (req as any).user?.id;
      const key = `endpoint:${endpoint}:${userId || req.ip}`;

      // Check rate limit (implementation would use Redis)
      // For now, adding headers and continuing
      res.set({
        'X-RateLimit-Limit': options.maxRequests.toString(),
        'X-RateLimit-Window': options.windowMs.toString()
      });

      next();
    };
  }

  /**
   * User role-based rate limiting
   */
  roleBasedRateLimit() {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      
      if (!user) {
        // Anonymous users get strict limits
        req.rateLimitExempt = false;
        return next();
      }

      // Different limits based on role
      const roleLimits = {
        admin: { requests: 10000, windowMs: 60 * 60 * 1000 },
        supervisor: { requests: 5000, windowMs: 60 * 60 * 1000 },
        fieldtech: { requests: 2000, windowMs: 60 * 60 * 1000 },
        client: { requests: 1000, windowMs: 60 * 60 * 1000 }
      };

      const userLimit = roleLimits[user.role as keyof typeof roleLimits];
      
      if (userLimit) {
        // Set role-based headers
        res.set({
          'X-RateLimit-User-Role': user.role,
          'X-RateLimit-User-Limit': userLimit.requests.toString()
        });
      }

      next();
    };
  }

  /**
   * Adaptive rate limiting based on system load
   */
  adaptiveRateLimit() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Get system metrics (would integrate with monitoring system)
      const systemLoad = this.getSystemLoad();
      
      let multiplier = 1;

      // Adjust rate limits based on system load
      if (systemLoad > 0.8) {
        multiplier = 0.5; // Reduce limits by 50%
      } else if (systemLoad > 0.6) {
        multiplier = 0.7; // Reduce limits by 30%
      } else if (systemLoad < 0.3) {
        multiplier = 1.2; // Increase limits by 20%
      }

      // Set adaptive headers
      res.set({
        'X-RateLimit-Adaptive': 'true',
        'X-RateLimit-System-Load': systemLoad.toString(),
        'X-RateLimit-Multiplier': multiplier.toString()
      });

      // Store multiplier for other middleware
      (req as any).rateLimitMultiplier = multiplier;

      next();
    };
  }

  /**
   * Distributed rate limiting for microservices
   */
  distributedRateLimit(serviceName: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const key = `distributed:${serviceName}:${req.ip}`;
      
      // Set distributed service headers
      res.set({
        'X-RateLimit-Service': serviceName,
        'X-RateLimit-Distributed': 'true'
      });

      next();
    };
  }

  /**
   * Rate limiting bypass for trusted sources
   */
  trustedSourceBypass(trustedIPs: string[], trustedKeys: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip;
      const apiKey = req.get('X-API-Key');

      // Check if IP is trusted
      if (trustedIPs.includes(ip)) {
        req.rateLimitExempt = true;
        res.set('X-RateLimit-Exempt', 'trusted-ip');
        
        loggingService.debug('Rate limit bypassed for trusted IP', { ip });
        return next();
      }

      // Check if API key is trusted
      if (apiKey && trustedKeys.includes(apiKey)) {
        req.rateLimitExempt = true;
        res.set('X-RateLimit-Exempt', 'trusted-api-key');
        
        loggingService.debug('Rate limit bypassed for trusted API key', { 
          apiKey: apiKey.substring(0, 8) + '...' 
        });
        return next();
      }

      next();
    };
  }

  /**
   * Rate limiting with sliding window
   */
  slidingWindowRateLimit(options: {
    windowMs: number;
    maxRequests: number;
    keyGenerator?: (req: Request) => string;
  }) {
    const requests = new Map<string, number[]>();

    return (req: Request, res: Response, next: NextFunction) => {
      const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;
      const now = Date.now();
      const windowStart = now - options.windowMs;

      // Get existing requests for this key
      let keyRequests = requests.get(key) || [];
      
      // Remove requests outside the window
      keyRequests = keyRequests.filter(timestamp => timestamp > windowStart);
      
      // Add current request
      keyRequests.push(now);
      requests.set(key, keyRequests);

      const requestCount = keyRequests.length;
      const remaining = Math.max(0, options.maxRequests - requestCount);

      // Set sliding window headers
      res.set({
        'X-RateLimit-Limit': options.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Window': 'sliding',
        'X-RateLimit-Window-Ms': options.windowMs.toString()
      });

      if (requestCount > options.maxRequests) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded - sliding window',
          retryAfter: Math.ceil(options.windowMs / 1000)
        });
      }

      next();
    };
  }

  /**
   * Rate limiting with token bucket algorithm
   */
  tokenBucketRateLimit(options: {
    capacity: number;
    refillRate: number; // tokens per second
    keyGenerator?: (req: Request) => string;
  }) {
    const buckets = new Map<string, { tokens: number; lastRefill: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;
      const now = Date.now();

      let bucket = buckets.get(key);
      
      if (!bucket) {
        bucket = { tokens: options.capacity, lastRefill: now };
        buckets.set(key, bucket);
      }

      // Refill tokens based on elapsed time
      const elapsed = (now - bucket.lastRefill) / 1000;
      const tokensToAdd = elapsed * options.refillRate;
      bucket.tokens = Math.min(options.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;

      // Set token bucket headers
      res.set({
        'X-RateLimit-Bucket-Capacity': options.capacity.toString(),
        'X-RateLimit-Bucket-Tokens': Math.floor(bucket.tokens).toString(),
        'X-RateLimit-Bucket-Refill-Rate': options.refillRate.toString()
      });

      if (bucket.tokens < 1) {
        const waitTime = (1 - bucket.tokens) / options.refillRate;
        
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded - insufficient tokens',
          retryAfter: Math.ceil(waitTime)
        });
      }

      // Consume one token
      bucket.tokens -= 1;

      next();
    };
  }

  /**
   * Private helper methods
   */

  private setRateLimitHeaders(res: Response, result: RateLimitResult): void {
    res.set({
      'X-RateLimit-Limit': result.totalHitsPerWindow.toString(),
      'X-RateLimit-Remaining': result.remainingPoints.toString(),
      'X-RateLimit-Reset': new Date(Date.now() + result.msBeforeNext).toISOString(),
      'X-RateLimit-Rule': result.rule.id,
      'X-RateLimit-Rule-Name': result.rule.name
    });

    if (result.msBeforeNext > 0) {
      res.set('Retry-After', Math.ceil(result.msBeforeNext / 1000).toString());
    }
  }

  private setBasicHeaders(req: Request, res: Response): void {
    res.set({
      'X-RateLimit-Policy': 'comprehensive',
      'X-RateLimit-Service': 'fieldsync-api'
    });

    // Add user-specific headers if authenticated
    const user = (req as any).user;
    if (user) {
      res.set({
        'X-RateLimit-User': user.id,
        'X-RateLimit-User-Role': user.role
      });
    }
  }

  private async handleRateLimitExceeded(
    req: Request, 
    res: Response, 
    result: RateLimitResult
  ): Promise<void> {
    // Log rate limit exceeded
    loggingService.warn('Rate limit exceeded', null, {
      ruleId: result.rule.id,
      ruleName: result.rule.name,
      key: result.key,
      totalHits: result.totalHits,
      endpoint: req.path,
      method: req.method,
      userId: (req as any).user?.id,
      ip: req.ip
    });

    // Record metrics
    metricsService.recordBusinessKPI('rate_limit_exceeded', 1, {
      ruleId: result.rule.id,
      endpoint: req.path,
      method: req.method,
      userRole: (req as any).user?.role || 'anonymous'
    });

    // Apply delay if configured
    if (result.rule.actions.delay && result.rule.actions.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, result.rule.actions.delay));
    }

    // Send custom response or default
    if (result.rule.actions.customResponse) {
      const customResponse = result.rule.actions.customResponse;
      
      if (customResponse.headers) {
        for (const [key, value] of Object.entries(customResponse.headers)) {
          res.set(key, value);
        }
      }

      res.status(customResponse.statusCode).json({
        success: false,
        error: customResponse.message,
        code: 'RATE_LIMIT_EXCEEDED',
        rateLimit: {
          rule: result.rule.name,
          limit: result.totalHitsPerWindow,
          remaining: result.remainingPoints,
          retryAfter: Math.ceil(result.msBeforeNext / 1000)
        }
      });
    } else {
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        rateLimit: {
          rule: result.rule.name,
          limit: result.totalHitsPerWindow,
          remaining: result.remainingPoints,
          retryAfter: Math.ceil(result.msBeforeNext / 1000)
        }
      });
    }
  }

  private async checkAuthRateLimit(key: string, maxAttempts: number, windowMs: number): Promise<boolean> {
    // This would typically use Redis for distributed rate limiting
    // For now, implementing basic check
    return false; // Placeholder - not blocking
  }

  private getSystemLoad(): number {
    // This would integrate with system monitoring
    // For now, return a mock value
    return Math.random() * 0.8; // Random load between 0-80%
  }
}

export default new RateLimitingMiddleware();