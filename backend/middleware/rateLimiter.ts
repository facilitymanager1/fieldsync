import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';

export interface RateLimiterConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum number of requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  message?: string; // Custom error message
  standardHeaders?: boolean; // Add standard headers
  legacyHeaders?: boolean; // Add legacy headers
}

export interface RateLimitInfo {
  totalHits: number;
  totalTime: number;
  resetTime: Date;
  remaining: number;
}

class RateLimiter {
  private redis: Redis | null = null;
  private memoryStore = new Map<string, { count: number; resetTime: number }>();

  constructor() {
    this.initializeRedis();
  }

  private initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL);
      } else {
        this.redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3
        });
      }
      
      this.redis.on('error', (error) => {
        console.error('Redis connection error for rate limiter:', error);
        this.redis = null;
      });
    } catch (error) {
      console.warn('Redis not available for rate limiting, using memory store');
      this.redis = null;
    }
  }

  /**
   * Create rate limiter middleware
   */
  createMiddleware(config: RateLimiterConfig) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = config.keyGenerator ? config.keyGenerator(req) : this.getDefaultKey(req);
        const rateLimitInfo = await this.checkRateLimit(key, config);

        // Add headers
        if (config.standardHeaders !== false) {
          res.set({
            'RateLimit-Limit': config.maxRequests.toString(),
            'RateLimit-Remaining': Math.max(0, rateLimitInfo.remaining).toString(),
            'RateLimit-Reset': rateLimitInfo.resetTime.toISOString(),
            'RateLimit-Policy': `${config.maxRequests};w=${Math.floor(config.windowMs / 1000)}`
          });
        }

        if (config.legacyHeaders !== false) {
          res.set({
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': Math.max(0, rateLimitInfo.remaining).toString(),
            'X-RateLimit-Reset': Math.floor(rateLimitInfo.resetTime.getTime() / 1000).toString()
          });
        }

        // Check if rate limit exceeded
        if (rateLimitInfo.totalHits > config.maxRequests) {
          res.set('Retry-After', Math.ceil((rateLimitInfo.resetTime.getTime() - Date.now()) / 1000).toString());
          
          return res.status(429).json({
            error: config.message || 'Too many requests, please try again later',
            rateLimitInfo: {
              limit: config.maxRequests,
              remaining: 0,
              resetTime: rateLimitInfo.resetTime,
              retryAfter: Math.ceil((rateLimitInfo.resetTime.getTime() - Date.now()) / 1000)
            }
          });
        }

        // Store rate limit info for potential cleanup after response
        (req as any).rateLimitInfo = rateLimitInfo;
        (req as any).rateLimitConfig = config;
        (req as any).rateLimitKey = key;

        next();
      } catch (error) {
        console.error('Rate limiter error:', error);
        // On error, allow the request to proceed
        next();
      }
    };
  }

  /**
   * Check rate limit for a key
   */
  private async checkRateLimit(key: string, config: RateLimiterConfig): Promise<RateLimitInfo> {
    if (this.redis) {
      return this.checkRateLimitRedis(key, config);
    } else {
      return this.checkRateLimitMemory(key, config);
    }
  }

  /**
   * Redis-based rate limiting
   */
  private async checkRateLimitRedis(key: string, config: RateLimiterConfig): Promise<RateLimitInfo> {
    const now = Date.now();
    const window = Math.floor(now / config.windowMs);
    const redisKey = `rate_limit:${key}:${window}`;

    const pipeline = this.redis!.pipeline();
    pipeline.incr(redisKey);
    pipeline.expire(redisKey, Math.ceil(config.windowMs / 1000));
    
    const results = await pipeline.exec();
    const totalHits = results![0][1] as number;
    
    const resetTime = new Date((window + 1) * config.windowMs);
    const remaining = Math.max(0, config.maxRequests - totalHits);

    return {
      totalHits,
      totalTime: config.windowMs,
      resetTime,
      remaining
    };
  }

  /**
   * Memory-based rate limiting (fallback)
   */
  private checkRateLimitMemory(key: string, config: RateLimiterConfig): RateLimitInfo {
    const now = Date.now();
    const window = Math.floor(now / config.windowMs);
    const memoryKey = `${key}:${window}`;

    let entry = this.memoryStore.get(memoryKey);
    if (!entry) {
      entry = { count: 0, resetTime: (window + 1) * config.windowMs };
      this.memoryStore.set(memoryKey, entry);
      
      // Clean up old entries
      setTimeout(() => {
        this.memoryStore.delete(memoryKey);
      }, config.windowMs);
    }

    entry.count++;
    
    const resetTime = new Date(entry.resetTime);
    const remaining = Math.max(0, config.maxRequests - entry.count);

    return {
      totalHits: entry.count,
      totalTime: config.windowMs,
      resetTime,
      remaining
    };
  }

  /**
   * Default key generator based on IP address
   */
  private getDefaultKey(req: Request): string {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  /**
   * User-based key generator
   */
  static userKeyGenerator(req: Request): string {
    const user = (req as any).user;
    return user ? `user:${user.id}` : req.ip || 'unknown';
  }

  /**
   * IP-based key generator
   */
  static ipKeyGenerator(req: Request): string {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  /**
   * Combined user and IP key generator
   */
  static combinedKeyGenerator(req: Request): string {
    const user = (req as any).user;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return user ? `user:${user.id}:${ip}` : ip;
  }

  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(key: string): Promise<void> {
    if (this.redis) {
      const keys = await this.redis.keys(`rate_limit:${key}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } else {
      // Clear memory store entries for this key
      for (const [k] of this.memoryStore) {
        if (k.startsWith(`${key}:`)) {
          this.memoryStore.delete(k);
        }
      }
    }
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(key: string, config: RateLimiterConfig): Promise<RateLimitInfo> {
    return this.checkRateLimit(key, config);
  }
}

// Pre-configured rate limiters for common use cases

export const generalLimiter = new RateLimiter().createMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

export const strictLimiter = new RateLimiter().createMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // 50 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

export const loginLimiter = new RateLimiter().createMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per window
  keyGenerator: RateLimiter.ipKeyGenerator,
  message: 'Too many login attempts from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

export const apiLimiter = new RateLimiter().createMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  keyGenerator: RateLimiter.userKeyGenerator,
  message: 'API rate limit exceeded, please slow down',
  standardHeaders: true,
  legacyHeaders: false
});

export const uploadLimiter = new RateLimiter().createMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 uploads per hour
  keyGenerator: RateLimiter.userKeyGenerator,
  message: 'Upload rate limit exceeded, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

export const passwordResetLimiter = new RateLimiter().createMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 password reset attempts per hour
  keyGenerator: RateLimiter.ipKeyGenerator,
  message: 'Too many password reset attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

export default RateLimiter;