/**
 * Advanced Cache Middleware for HTTP Responses and API Optimization
 * Provides intelligent caching strategies for different types of API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { redisService, CachePattern, CacheStrategy } from '../services/redisService';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';
import crypto from 'crypto';

// Cache configuration for different endpoint types
interface CacheMiddlewareOptions {
  pattern: CachePattern;
  strategy: CacheStrategy;
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  shouldCache?: (req: Request, res: Response) => boolean;
  varyBy?: string[]; // Headers to vary cache by
  tags?: string[] | ((req: Request) => string[]);
  dependencies?: string[] | ((req: Request) => string[]);
  skipMethods?: string[];
  skipStatuses?: number[];
  compression?: boolean;
  staleWhileRevalidate?: number; // Seconds to serve stale content while revalidating
  maxAge?: number;
  private?: boolean;
  mustRevalidate?: boolean;
}

// Default cache configurations for different API patterns
const DEFAULT_CACHE_CONFIGS: Record<string, CacheMiddlewareOptions> = {
  // Static reference data (longer TTL)
  reference: {
    pattern: CachePattern.QUERY_RESULT,
    strategy: CacheStrategy.CACHE_ASIDE,
    ttl: 3600, // 1 hour
    shouldCache: (req, res) => req.method === 'GET' && res.statusCode === 200,
    skipMethods: ['POST', 'PUT', 'DELETE', 'PATCH'],
    compression: true,
    maxAge: 3600,
    staleWhileRevalidate: 86400 // 24 hours
  },
  
  // User-specific data (medium TTL)
  user: {
    pattern: CachePattern.USER_PREFERENCES,
    strategy: CacheStrategy.CACHE_ASIDE,
    ttl: 900, // 15 minutes
    shouldCache: (req, res) => req.method === 'GET' && res.statusCode === 200,
    varyBy: ['authorization'],
    skipMethods: ['POST', 'PUT', 'DELETE', 'PATCH'],
    maxAge: 900,
    private: true
  },
  
  // Computed/aggregated data (short TTL)
  computed: {
    pattern: CachePattern.COMPUTED_DATA,
    strategy: CacheStrategy.REFRESH_AHEAD,
    ttl: 300, // 5 minutes
    shouldCache: (req, res) => req.method === 'GET' && res.statusCode === 200,
    skipMethods: ['POST', 'PUT', 'DELETE', 'PATCH'],
    compression: true,
    maxAge: 300,
    staleWhileRevalidate: 1800 // 30 minutes
  },
  
  // Real-time data (very short TTL)
  realtime: {
    pattern: CachePattern.REAL_TIME,
    strategy: CacheStrategy.CACHE_ASIDE,
    ttl: 60, // 1 minute
    shouldCache: (req, res) => req.method === 'GET' && res.statusCode === 200,
    skipMethods: ['POST', 'PUT', 'DELETE', 'PATCH'],
    maxAge: 60,
    mustRevalidate: true
  }
};

/**
 * HTTP Response Cache Middleware
 */
export function httpCache(configName?: string, customOptions?: Partial<CacheMiddlewareOptions>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const config = {
      ...DEFAULT_CACHE_CONFIGS[configName || 'reference'],
      ...customOptions
    };
    
    // Skip caching for certain methods
    if (config.skipMethods?.includes(req.method)) {
      return next();
    }
    
    const timer = monitoring.startTimer('cache_middleware_duration');
    
    try {
      // Generate cache key
      const cacheKey = generateCacheKey(req, config);
      
      // Try to get cached response
      if (req.method === 'GET') {
        const cached = await getCachedResponse(cacheKey, config);
        
        if (cached) {
          // Set cache headers
          setCacheHeaders(res, config, true);
          
          timer();
          monitoring.incrementCounter('http_cache_hits_total', 1, {
            endpoint: req.route?.path || req.path,
            method: req.method
          });
          
          return res.json(cached.data);
        }
      }
      
      // Cache miss - continue with request processing
      const originalSend = res.send;
      const originalJson = res.json;
      let responseData: any = null;
      let responseStatus = 200;
      
      // Override response methods to capture data
      res.send = function(data: any) {
        responseData = data;
        responseStatus = res.statusCode;
        return originalSend.call(this, data);
      };
      
      res.json = function(data: any) {
        responseData = data;
        responseStatus = res.statusCode;
        return originalJson.call(this, data);
      };
      
      // Continue processing
      next();
      
      // Cache response after it's sent
      res.on('finish', async () => {
        try {
          if (shouldCacheResponse(req, res, config, responseStatus, responseData)) {
            await cacheResponse(cacheKey, responseData, config, req);
            
            monitoring.incrementCounter('http_cache_sets_total', 1, {
              endpoint: req.route?.path || req.path,
              method: req.method
            });
          }
          
          // Set cache headers
          setCacheHeaders(res, config, false);
          
          timer();
          
        } catch (error) {
          loggingService.error('Failed to cache response', error, {
            path: req.path,
            method: req.method,
            cacheKey
          });
        }
      });
      
    } catch (error) {
      timer();
      loggingService.error('Cache middleware error', error, {
        path: req.path,
        method: req.method
      });
      
      monitoring.incrementCounter('cache_middleware_errors_total', 1);
      next();
    }
  };
}

/**
 * Query Result Cache Middleware for Database Operations
 */
export function queryCache(options?: Partial<CacheMiddlewareOptions>) {
  const config = {
    pattern: CachePattern.QUERY_RESULT,
    strategy: CacheStrategy.CACHE_ASIDE,
    ttl: 600, // 10 minutes
    ...options
  };
  
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const timer = monitoring.startTimer('query_cache_duration');
      
      try {
        // Generate cache key based on method name and arguments
        const cacheKey = generateQueryCacheKey(propertyName, args);
        
        // Try to get from cache
        const cached = await redisService.get(config.pattern, cacheKey);
        
        if (cached !== null) {
          timer();
          monitoring.incrementCounter('query_cache_hits_total', 1, {
            method: propertyName
          });
          
          return cached;
        }
        
        // Execute original method
        const result = await method.apply(this, args);
        
        // Cache the result
        if (result !== null && result !== undefined) {
          const tags = typeof config.tags === 'function' ? config.tags({ body: args[0] } as Request) : config.tags;
          const dependencies = typeof config.dependencies === 'function' ? config.dependencies({ body: args[0] } as Request) : config.dependencies;
          
          await redisService.set(config.pattern, cacheKey, result, {
            ttl: config.ttl,
            tags,
            dependencies,
            strategy: config.strategy
          });
          
          monitoring.incrementCounter('query_cache_sets_total', 1, {
            method: propertyName
          });
        }
        
        timer();
        return result;
        
      } catch (error) {
        timer();
        loggingService.error('Query cache error', error, {
          method: propertyName
        });
        
        monitoring.incrementCounter('query_cache_errors_total', 1);
        
        // Fallback to original method
        return await method.apply(this, args);
      }
    };
    
    return descriptor;
  };
}

/**
 * Session Cache Middleware
 */
export function sessionCache(req: Request, res: Response, next: NextFunction) {
  const originalSession = (req as any).session;
  
  if (!originalSession) {
    return next();
  }
  
  // Enhance session with Redis caching
  const sessionId = originalSession.id;
  const userId = originalSession.userId || 'anonymous';
  
  // Override session save method
  const originalSave = originalSession.save;
  originalSession.save = async function(callback?: (err?: any) => void) {
    try {
      // Save to Redis with user-specific pattern
      await redisService.set(
        CachePattern.SESSION,
        sessionId,
        this,
        {
          ttl: 3600, // 1 hour
          tags: [`user:${userId}`, 'session'],
          strategy: CacheStrategy.WRITE_THROUGH
        }
      );
      
      monitoring.incrementCounter('session_cache_saves_total', 1);
      
      if (originalSave) {
        originalSave.call(this, callback);
      } else if (callback) {
        callback();
      }
      
    } catch (error) {
      loggingService.error('Failed to cache session', error, { sessionId });
      monitoring.incrementCounter('session_cache_errors_total', 1);
      
      if (callback) callback(error);
    }
  };
  
  // Override session destroy method
  const originalDestroy = originalSession.destroy;
  originalSession.destroy = async function(callback?: (err?: any) => void) {
    try {
      // Remove from Redis
      await redisService.delete(CachePattern.SESSION, sessionId);
      
      monitoring.incrementCounter('session_cache_destroys_total', 1);
      
      if (originalDestroy) {
        originalDestroy.call(this, callback);
      } else if (callback) {
        callback();
      }
      
    } catch (error) {
      loggingService.error('Failed to destroy cached session', error, { sessionId });
      
      if (callback) callback(error);
    }
  };
  
  next();
}

/**
 * Cache Invalidation Middleware for write operations
 */
export function cacheInvalidation(options: {
  patterns?: CachePattern[];
  tags?: string[] | ((req: Request) => string[]);
  dependencies?: string[] | ((req: Request) => string[]);
  onMethods?: string[];
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { patterns = [], tags, dependencies, onMethods = ['POST', 'PUT', 'PATCH', 'DELETE'] } = options;
    
    if (!onMethods.includes(req.method)) {
      return next();
    }
    
    // Continue with request processing
    next();
    
    // Invalidate cache after successful response
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const timer = monitoring.startTimer('cache_invalidation_duration');
          
          let invalidationTags: string[] = [];
          let invalidationDeps: string[] = [];
          
          if (typeof tags === 'function') {
            invalidationTags = tags(req);
          } else if (tags) {
            invalidationTags = tags;
          }
          
          if (typeof dependencies === 'function') {
            invalidationDeps = dependencies(req);
          } else if (dependencies) {
            invalidationDeps = dependencies;
          }
          
          // Invalidate by patterns
          for (const pattern of patterns) {
            await redisService.invalidate({ pattern });
          }
          
          // Invalidate by tags and dependencies
          if (invalidationTags.length > 0 || invalidationDeps.length > 0) {
            await redisService.invalidate({
              tags: invalidationTags.length > 0 ? invalidationTags : undefined,
              dependencies: invalidationDeps.length > 0 ? invalidationDeps : undefined
            });
          }
          
          timer();
          monitoring.incrementCounter('cache_invalidations_total', 1, {
            method: req.method,
            path: req.route?.path || req.path
          });
          
          loggingService.debug('Cache invalidated', {
            method: req.method,
            path: req.path,
            patterns,
            tags: invalidationTags,
            dependencies: invalidationDeps
          });
          
        } catch (error) {
          loggingService.error('Cache invalidation failed', error, {
            method: req.method,
            path: req.path
          });
          
          monitoring.incrementCounter('cache_invalidation_errors_total', 1);
        }
      }
    });
  };
}

/**
 * Rate Limiting with Redis
 */
export function redisRateLimit(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { windowMs, max, keyGenerator, skipSuccessfulRequests, skipFailedRequests } = options;
    
    try {
      const key = keyGenerator ? keyGenerator(req) : getDefaultRateLimitKey(req);
      const cacheKey = `rate_limit:${key}`;
      
      // Get current count
      const current = await redisService.get<number>(CachePattern.RATE_LIMIT, cacheKey) || 0;
      
      if (current >= max) {
        res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
        
        monitoring.incrementCounter('rate_limit_exceeded_total', 1, {
          key: key.substring(0, 20) // Truncate for privacy
        });
        
        return;
      }
      
      // Continue with request
      next();
      
      // Update rate limit counter after response
      res.on('finish', async () => {
        const shouldCount = !skipSuccessfulRequests || res.statusCode >= 400;
        const shouldCountFailed = !skipFailedRequests || res.statusCode < 400;
        
        if (shouldCount && shouldCountFailed) {
          await redisService.set(
            CachePattern.RATE_LIMIT,
            cacheKey,
            current + 1,
            {
              ttl: Math.ceil(windowMs / 1000),
              strategy: CacheStrategy.WRITE_THROUGH
            }
          );
        }
      });
      
    } catch (error) {
      loggingService.error('Rate limiting error', error);
      monitoring.incrementCounter('rate_limit_errors_total', 1);
      
      // Continue on error to avoid blocking requests
      next();
    }
  };
}

// Helper functions
function generateCacheKey(req: Request, config: CacheMiddlewareOptions): string {
  if (config.keyGenerator) {
    return config.keyGenerator(req);
  }
  
  // Default key generation
  const baseKey = `${req.method}:${req.path}`;
  const queryString = Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : '';
  const varyHeaders = config.varyBy?.map(header => req.get(header) || '').join(':') || '';
  
  const keyData = `${baseKey}:${queryString}:${varyHeaders}`;
  return crypto.createHash('md5').update(keyData).digest('hex');
}

function generateQueryCacheKey(methodName: string, args: any[]): string {
  const argsString = JSON.stringify(args);
  const keyData = `${methodName}:${argsString}`;
  return crypto.createHash('md5').update(keyData).digest('hex');
}

async function getCachedResponse(cacheKey: string, config: CacheMiddlewareOptions): Promise<{ data: any; headers?: Record<string, string> } | null> {
  try {
    return await redisService.get(config.pattern, cacheKey);
  } catch (error) {
    loggingService.error('Failed to get cached response', error, { cacheKey });
    return null;
  }
}

async function cacheResponse(
  cacheKey: string,
  data: any,
  config: CacheMiddlewareOptions,
  req: Request
): Promise<void> {
  try {
    const tags = typeof config.tags === 'function' ? config.tags(req) : config.tags;
    const dependencies = typeof config.dependencies === 'function' ? config.dependencies(req) : config.dependencies;
    
    await redisService.set(
      config.pattern,
      cacheKey,
      { data },
      {
        ttl: config.ttl,
        tags,
        dependencies,
        strategy: config.strategy
      }
    );
  } catch (error) {
    loggingService.error('Failed to cache response', error, { cacheKey });
  }
}

function shouldCacheResponse(
  req: Request,
  res: Response,
  config: CacheMiddlewareOptions,
  status: number,
  data: any
): boolean {
  // Check status codes
  if (config.skipStatuses?.includes(status)) {
    return false;
  }
  
  // Check custom condition
  if (config.shouldCache && !config.shouldCache(req, res)) {
    return false;
  }
  
  // Default: cache successful GET requests
  return req.method === 'GET' && status >= 200 && status < 300 && data !== null;
}

function setCacheHeaders(res: Response, config: CacheMiddlewareOptions, isFromCache: boolean): void {
  if (config.maxAge) {
    res.set('Cache-Control', buildCacheControlHeader(config));
  }
  
  if (isFromCache) {
    res.set('X-Cache', 'HIT');
  } else {
    res.set('X-Cache', 'MISS');
  }
  
  if (config.staleWhileRevalidate) {
    res.set('X-Cache-Stale-While-Revalidate', config.staleWhileRevalidate.toString());
  }
}

function buildCacheControlHeader(config: CacheMiddlewareOptions): string {
  const directives: string[] = [];
  
  if (config.private) {
    directives.push('private');
  } else {
    directives.push('public');
  }
  
  if (config.maxAge) {
    directives.push(`max-age=${config.maxAge}`);
  }
  
  if (config.staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }
  
  if (config.mustRevalidate) {
    directives.push('must-revalidate');
  }
  
  return directives.join(', ');
}

function getDefaultRateLimitKey(req: Request): string {
  const user = (req as any).user;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  if (user?.id) {
    return `user:${user.id}`;
  }
  
  return `ip:${ip}`;
}

export default {
  httpCache,
  queryCache,
  sessionCache,
  cacheInvalidation,
  redisRateLimit
};