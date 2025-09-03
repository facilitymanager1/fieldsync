/**
 * API Cache Middleware
 * Intelligent caching middleware for API responses with cache invalidation strategies
 */

import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import businessCacheService from '../services/businessCacheService';
import sessionCacheService from '../services/sessionCacheService';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';

interface CacheOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
  tags?: string[];
  varyByUser?: boolean;
  varyByRole?: boolean;
  skipMethods?: string[];
  skipStatusCodes?: number[];
  invalidatePatterns?: string[];
}

interface CachedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
  ttl: number;
  tags?: string[];
}

/**
 * Create API response caching middleware
 */
export function apiCache(options: CacheOptions = {}) {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator,
    condition,
    tags = [],
    varyByUser = false,
    varyByRole = false,
    skipMethods = ['POST', 'PUT', 'PATCH', 'DELETE'],
    skipStatusCodes = [400, 401, 403, 404, 500, 502, 503, 504],
    invalidatePatterns = []
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip caching for excluded methods
    if (skipMethods.includes(req.method.toUpperCase())) {
      return next();
    }

    // Check condition if provided
    if (condition && !condition(req, res)) {
      return next();
    }

    const timer = monitoring.startTimer('api_cache_middleware_duration');
    const user = (req as any).user;

    try {
      // Generate cache key
      const cacheKey = generateCacheKey(req, {
        keyGenerator,
        varyByUser,
        varyByRole,
        user
      });

      // Try to get cached response
      const cachedResponse = await businessCacheService.getAPIResponse(cacheKey);
      
      if (cachedResponse) {
        // Cache hit
        timer();
        monitoring.incrementCounter('api_cache_operations_total', 1, {
          operation: 'hit',
          method: req.method,
          path: getPathPattern(req.route?.path || req.path)
        });

        loggingService.debug('API cache hit', {
          cacheKey,
          path: req.path,
          method: req.method,
          userId: user?.id
        });

        // Set cached headers
        if (cachedResponse.headers) {
          Object.entries(cachedResponse.headers).forEach(([key, value]) => {
            res.setHeader(key, String(value));
          });
        }

        // Add cache headers
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        res.setHeader('X-Cache-TTL', cachedResponse.ttl.toString());

        res.status(cachedResponse.statusCode).json(cachedResponse.body);
        return;
      }

      // Cache miss - intercept response
      const originalJson = res.json;
      const originalStatus = res.status;
      let responseBody: any;
      let statusCode = 200;

      // Override status method
      res.status = function(code: number) {
        statusCode = code;
        return originalStatus.call(this, code);
      };

      // Override json method to capture response
      res.json = function(body: any) {
        responseBody = body;
        return originalJson.call(this, body);
      };

      // Hook into response finish event
      res.on('finish', async () => {
        try {
          // Only cache successful responses
          if (!skipStatusCodes.includes(statusCode) && responseBody) {
            const responseToCache: CachedResponse = {
              statusCode,
              headers: extractCacheableHeaders(res),
              body: responseBody,
              timestamp: Date.now(),
              ttl,
              tags
            };

            await businessCacheService.setAPIResponse(cacheKey, responseToCache, { ttl });

            loggingService.debug('API response cached', {
              cacheKey,
              path: req.path,
              method: req.method,
              statusCode,
              userId: user?.id
            });

            monitoring.incrementCounter('api_cache_operations_total', 1, {
              operation: 'set',
              method: req.method,
              path: getPathPattern(req.route?.path || req.path)
            });
          }
        } catch (error) {
          loggingService.error('Failed to cache API response', error, {
            cacheKey,
            path: req.path,
            method: req.method
          });

          monitoring.incrementCounter('api_cache_operations_total', 1, {
            operation: 'error',
            method: req.method,
            path: getPathPattern(req.route?.path || req.path)
          });
        }
      });

      // Cache miss
      timer();
      monitoring.incrementCounter('api_cache_operations_total', 1, {
        operation: 'miss',
        method: req.method,
        path: getPathPattern(req.route?.path || req.path)
      });

      // Add cache headers
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);

      next();

    } catch (error) {
      timer();
      loggingService.error('API cache middleware error', error, {
        path: req.path,
        method: req.method,
        userId: user?.id
      });

      monitoring.incrementCounter('api_cache_operations_total', 1, {
        operation: 'error',
        method: req.method,
        path: getPathPattern(req.route?.path || req.path)
      });

      // Continue without caching on error
      next();
    }
  };
}

/**
 * Cache invalidation middleware for data modification endpoints
 */
export function cacheInvalidation(patterns: string | string[]) {
  const invalidationPatterns = Array.isArray(patterns) ? patterns : [patterns];

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json;
    const user = (req as any).user;

    // Override json method to trigger invalidation after successful response
    res.json = function(body: any) {
      const result = originalJson.call(this, body);

      // Only invalidate on successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setImmediate(async () => {
          try {
            for (const pattern of invalidationPatterns) {
              await businessCacheService.invalidateByPattern(pattern);
              
              loggingService.debug('Cache invalidated', {
                pattern,
                path: req.path,
                method: req.method,
                userId: user?.id
              });
            }

            monitoring.incrementCounter('api_cache_invalidations_total', 1, {
              patterns: invalidationPatterns.length.toString(),
              method: req.method
            });
          } catch (error) {
            loggingService.error('Cache invalidation failed', error, {
              patterns: invalidationPatterns,
              path: req.path,
              method: req.method
            });
          }
        });
      }

      return result;
    };

    next();
  };
}

/**
 * User-specific cache invalidation middleware
 */
export function userCacheInvalidation(cacheTypes: ('session' | 'profile' | 'permissions' | 'preferences' | 'shifts' | 'sites')[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json;
    const user = (req as any).user;

    res.json = function(body: any) {
      const result = originalJson.call(this, body);

      // Only invalidate on successful responses
      if (res.statusCode >= 200 && res.statusCode < 300 && user?.id) {
        setImmediate(async () => {
          try {
            const promises: Promise<boolean>[] = [];

            for (const cacheType of cacheTypes) {
              switch (cacheType) {
                case 'session':
                  promises.push(sessionCacheService.removeUserSession(user.id));
                  break;
                case 'profile':
                  promises.push(businessCacheService.invalidateByPattern(`profile:user:${user.id}`));
                  break;
                case 'permissions':
                  promises.push(businessCacheService.invalidateByPattern(`permissions:user:${user.id}`));
                  break;
                case 'preferences':
                  promises.push(businessCacheService.invalidateByPattern(`preferences:user:${user.id}`));
                  break;
                case 'shifts':
                  promises.push(businessCacheService.invalidateByPattern(`shifts:*:user:${user.id}`));
                  break;
                case 'sites':
                  promises.push(businessCacheService.invalidateByPattern(`sites:user:${user.id}`));
                  break;
              }
            }

            await Promise.allSettled(promises);

            loggingService.debug('User cache invalidated', {
              userId: user.id,
              cacheTypes,
              path: req.path,
              method: req.method
            });

            monitoring.incrementCounter('user_cache_invalidations_total', 1, {
              cache_types: cacheTypes.length.toString(),
              user_id: user.id
            });
          } catch (error) {
            loggingService.error('User cache invalidation failed', error, {
              userId: user.id,
              cacheTypes,
              path: req.path,
              method: req.method
            });
          }
        });
      }

      return result;
    };

    next();
  };
}

/**
 * Cache warming middleware for frequently accessed data
 */
export function cacheWarming(warmupFunction: (req: Request) => Promise<void>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Execute warming function in background
    setImmediate(async () => {
      try {
        await warmupFunction(req);
      } catch (error) {
        loggingService.error('Cache warming failed', error, {
          path: req.path,
          method: req.method
        });
      }
    });

    next();
  };
}

// Helper functions

function generateCacheKey(req: Request, options: {
  keyGenerator?: (req: Request) => string;
  varyByUser?: boolean;
  varyByRole?: boolean;
  user?: any;
}): string {
  const { keyGenerator, varyByUser, varyByRole, user } = options;

  if (keyGenerator) {
    return keyGenerator(req);
  }

  // Base key components
  const components = [
    req.method.toUpperCase(),
    req.path,
    normalizeQuery(req.query)
  ];

  // Add user-specific components
  if (varyByUser && user?.id) {
    components.push(`user:${user.id}`);
  } else if (varyByRole && user?.role) {
    components.push(`role:${user.role}`);
  }

  // Create hash from components
  const keyString = components.filter(Boolean).join('|');
  return crypto.createHash('md5').update(keyString).digest('hex');
}

function normalizeQuery(query: any): string {
  if (!query || typeof query !== 'object') {
    return '';
  }

  // Sort keys and stringify for consistent hashing
  const sortedKeys = Object.keys(query).sort();
  const normalizedQuery = sortedKeys.map(key => `${key}=${query[key]}`).join('&');
  return normalizedQuery;
}

function extractCacheableHeaders(res: Response): Record<string, string> {
  const cacheableHeaders: Record<string, string> = {};
  const allowedHeaders = [
    'content-type',
    'content-encoding',
    'content-language',
    'cache-control',
    'etag',
    'last-modified'
  ];

  allowedHeaders.forEach(header => {
    const value = res.getHeader(header);
    if (value && typeof value === 'string') {
      cacheableHeaders[header] = value;
    }
  });

  return cacheableHeaders;
}

function getPathPattern(path: string): string {
  // Normalize path for metrics (replace IDs with placeholders)
  return path
    .replace(/\/[0-9a-fA-F]{24}/g, '/:id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid');
}

// Pre-configured cache middleware for common use cases

export const shortCache = apiCache({ ttl: 60 }); // 1 minute
export const mediumCache = apiCache({ ttl: 300 }); // 5 minutes  
export const longCache = apiCache({ ttl: 1800 }); // 30 minutes

export const userSpecificCache = apiCache({ 
  ttl: 300, 
  varyByUser: true 
});

export const roleSpecificCache = apiCache({ 
  ttl: 600, 
  varyByRole: true 
});

export const conditionalCache = (condition: (req: Request, res: Response) => boolean, ttl: number = 300) =>
  apiCache({ ttl, condition });

export default {
  apiCache,
  cacheInvalidation,
  userCacheInvalidation,
  cacheWarming,
  shortCache,
  mediumCache,
  longCache,
  userSpecificCache,
  roleSpecificCache,
  conditionalCache
};