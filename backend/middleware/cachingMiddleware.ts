/**
 * Advanced Caching Middleware for Performance Optimization
 * Implements strategic caching patterns for API responses, database queries, and computed data
 */

import { Request, Response, NextFunction } from 'express';
import { redisService, CachePattern, CacheStrategy } from '../services/redisService';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';

// Cache Key Generation Strategy
export interface CacheKeyStrategy {
  includeUser?: boolean;
  includeQuery?: boolean;
  includeBody?: boolean;
  excludeFields?: string[];
  customKey?: (req: Request) => string;
}

// Cache Configuration for Different Endpoints
export interface EndpointCacheConfig {
  pattern: CachePattern;
  strategy: CacheStrategy;
  ttl: number;
  keyStrategy: CacheKeyStrategy;
  tags?: string[];
  dependencies?: string[];
  conditions?: (req: Request) => boolean;
  varyBy?: string[]; // Headers to vary cache by
  refreshThreshold?: number;
}

/**
 * Strategic Cache Configuration Map
 */
export const CACHE_CONFIGURATIONS: Record<string, EndpointCacheConfig> = {
  // User profile and authentication data
  'GET:/api/users/:id': {
    pattern: CachePattern.USER_PREFERENCES,
    strategy: CacheStrategy.CACHE_ASIDE,
    ttl: 1800, // 30 minutes
    keyStrategy: {
      includeUser: true,
      customKey: (req) => `user:${req.params.id}`
    },
    tags: ['user_data'],
    refreshThreshold: 70
  },

  // Ticket queries and lists
  'GET:/api/tickets': {
    pattern: CachePattern.QUERY_RESULT,
    strategy: CacheStrategy.CACHE_ASIDE,
    ttl: 300, // 5 minutes
    keyStrategy: {
      includeUser: true,
      includeQuery: true,
      excludeFields: ['page', 'timestamp']
    },
    tags: ['tickets', 'query_results'],
    conditions: (req) => {
      // Only cache if specific filters are used
      return !!(req.query.status || req.query.assignedTo || req.query.priority);
    }
  },

  'GET:/api/tickets/:id': {
    pattern: CachePattern.QUERY_RESULT,
    strategy: CacheStrategy.REFRESH_AHEAD,
    ttl: 900, // 15 minutes
    keyStrategy: {
      includeUser: false,
      customKey: (req) => `ticket:${req.params.id}`
    },
    tags: ['tickets', 'single_ticket'],
    refreshThreshold: 60
  },

  // Site and location data
  'GET:/api/sites': {
    pattern: CachePattern.QUERY_RESULT,
    strategy: CacheStrategy.CACHE_ASIDE,
    ttl: 3600, // 1 hour
    keyStrategy: {
      includeUser: false,
      includeQuery: true
    },
    tags: ['sites', 'location_data']
  },

  'GET:/api/sites/:id': {
    pattern: CachePattern.QUERY_RESULT,
    strategy: CacheStrategy.REFRESH_AHEAD,
    ttl: 1800, // 30 minutes
    keyStrategy: {
      includeUser: false,
      customKey: (req) => `site:${req.params.id}`
    },
    tags: ['sites', 'single_site'],
    refreshThreshold: 70
  },

  // Analytics and reporting data (expensive computations)
  'GET:/api/analytics/dashboard': {
    pattern: CachePattern.COMPUTED_DATA,
    strategy: CacheStrategy.CACHE_ASIDE,
    ttl: 600, // 10 minutes
    keyStrategy: {
      includeUser: true,
      includeQuery: true,
      excludeFields: ['_t'] // Exclude cache-busting timestamp
    },
    tags: ['analytics', 'dashboard', 'computed'],
    varyBy: ['Accept-Language', 'X-Timezone']
  },

  'GET:/api/analytics/reports/:type': {
    pattern: CachePattern.COMPUTED_DATA,
    strategy: CacheStrategy.WRITE_THROUGH,
    ttl: 1800, // 30 minutes
    keyStrategy: {
      includeUser: true,
      includeQuery: true,
      customKey: (req) => `report:${req.params.type}:${req.user?.id}`
    },
    tags: ['analytics', 'reports', 'computed'],
    refreshThreshold: 80
  },

  // SLA and monitoring data
  'GET:/api/sla/metrics': {
    pattern: CachePattern.COMPUTED_DATA,
    strategy: CacheStrategy.CACHE_ASIDE,
    ttl: 300, // 5 minutes
    keyStrategy: {
      includeUser: false,
      includeQuery: true
    },
    tags: ['sla', 'metrics', 'monitoring']
  },

  // Shift and workforce data
  'GET:/api/shifts/active': {
    pattern: CachePattern.REAL_TIME,
    strategy: CacheStrategy.CACHE_ASIDE,
    ttl: 60, // 1 minute for real-time data
    keyStrategy: {
      includeUser: false,
      includeQuery: true
    },
    tags: ['shifts', 'real_time']
  },

  // Client and staff directory
  'GET:/api/staff': {
    pattern: CachePattern.QUERY_RESULT,
    strategy: CacheStrategy.CACHE_ASIDE,
    ttl: 1800, // 30 minutes
    keyStrategy: {
      includeUser: false,
      includeQuery: true
    },
    tags: ['staff', 'directory']
  },

  'GET:/api/clients': {
    pattern: CachePattern.QUERY_RESULT,
    strategy: CacheStrategy.CACHE_ASIDE,
    ttl: 1800, // 30 minutes
    keyStrategy: {
      includeUser: false,
      includeQuery: true
    },
    tags: ['clients', 'directory']
  }
};

/**
 * Advanced HTTP Cache Middleware
 */
export class CachingMiddleware {
  private hitRates: Map<string, { hits: number; misses: number }> = new Map();

  /**
   * Generate cache key based on request and strategy
   */
  private generateCacheKey(req: Request, config: EndpointCacheConfig): string {
    const { keyStrategy } = config;
    
    if (keyStrategy.customKey) {
      return keyStrategy.customKey(req);
    }

    let keyParts: string[] = [req.method, req.path];

    if (keyStrategy.includeUser && req.user?.id) {
      keyParts.push(`user:${req.user.id}`);
    }

    if (keyStrategy.includeQuery) {
      const queryParams = { ...req.query };
      
      // Remove excluded fields
      if (keyStrategy.excludeFields) {
        keyStrategy.excludeFields.forEach(field => {
          delete queryParams[field];
        });
      }

      // Sort query parameters for consistent keys
      const sortedQuery = Object.keys(queryParams)
        .sort()
        .map(key => `${key}:${queryParams[key]}`)
        .join('&');
      
      if (sortedQuery) {
        keyParts.push(`query:${sortedQuery}`);
      }
    }

    if (keyStrategy.includeBody && req.body) {
      const bodyHash = this.hashObject(req.body);
      keyParts.push(`body:${bodyHash}`);
    }

    // Add vary headers if specified
    if (config.varyBy) {
      const varyParts = config.varyBy
        .map(header => `${header}:${req.headers[header.toLowerCase()]}`)
        .filter(part => !part.endsWith(':undefined'));
      
      if (varyParts.length > 0) {
        keyParts.push(`vary:${varyParts.join(',')}`);
      }
    }

    return keyParts.join(':');
  }

  /**
   * Hash object for consistent cache keys
   */
  private hashObject(obj: any): string {
    const crypto = require('crypto');
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
  }

  /**
   * Get cache configuration for request
   */
  private getCacheConfig(req: Request): EndpointCacheConfig | null {
    const routeKey = `${req.method}:${req.route?.path || req.path}`;
    const config = CACHE_CONFIGURATIONS[routeKey];
    
    if (!config) return null;
    
    // Check conditions if specified
    if (config.conditions && !config.conditions(req)) {
      return null;
    }

    return config;
  }

  /**
   * Check if response is cacheable
   */
  private isCacheable(res: Response): boolean {
    // Don't cache error responses
    if (res.statusCode >= 400) return false;
    
    // Don't cache if cache-control header prohibits it
    const cacheControl = res.get('Cache-Control');
    if (cacheControl && (cacheControl.includes('no-cache') || cacheControl.includes('no-store'))) {
      return false;
    }

    return true;
  }

  /**
   * Set appropriate HTTP cache headers
   */
  private setCacheHeaders(res: Response, config: EndpointCacheConfig, hit: boolean): void {
    const maxAge = hit ? config.ttl : Math.floor(config.ttl * 0.1); // Shorter max-age for cache misses
    
    res.set({
      'Cache-Control': `public, max-age=${maxAge}`,
      'X-Cache': hit ? 'HIT' : 'MISS',
      'X-Cache-Pattern': config.pattern,
      'X-Cache-Strategy': config.strategy,
      'X-Cache-TTL': config.ttl.toString(),
      'Vary': config.varyBy?.join(', ') || 'Accept-Encoding'
    });
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(cacheKey: string, hit: boolean): void {
    const stats = this.hitRates.get(cacheKey) || { hits: 0, misses: 0 };
    
    if (hit) {
      stats.hits++;
    } else {
      stats.misses++;
    }
    
    this.hitRates.set(cacheKey, stats);
    
    // Report to monitoring
    monitoring.incrementCounter('cache_requests_total', 1, { 
      result: hit ? 'hit' : 'miss',
      cache_key: cacheKey.substring(0, 50) // Truncate for metrics
    });
  }

  /**
   * Main caching middleware
   */
  cache() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const timer = monitoring.startTimer('cache_middleware_duration');
      
      try {
        const config = this.getCacheConfig(req);
        
        if (!config) {
          timer();
          return next();
        }

        const cacheKey = this.generateCacheKey(req, config);
        
        // Try to get from cache
        const cachedData = await redisService.get<any>(config.pattern, cacheKey, config.tags);
        
        if (cachedData) {
          // Cache hit
          this.updateHitRate(cacheKey, true);
          this.setCacheHeaders(res, config, true);
          
          loggingService.debug('Cache hit', {
            method: req.method,
            path: req.path,
            cacheKey,
            pattern: config.pattern
          });
          
          timer();
          return res.json(cachedData);
        }

        // Cache miss - proceed with original handler
        this.updateHitRate(cacheKey, false);
        
        // Intercept the response to cache it
        const originalJson = res.json.bind(res);
        const originalSend = res.send.bind(res);
        
        res.json = (data: any) => {
          // Cache the response if it's successful
          if (this.isCacheable(res)) {
            setImmediate(async () => {
              try {
                await redisService.set(
                  config.pattern,
                  cacheKey,
                  data,
                  {
                    ttl: config.ttl,
                    tags: config.tags,
                    dependencies: config.dependencies,
                    strategy: config.strategy
                  }
                );
                
                loggingService.debug('Response cached', {
                  method: req.method,
                  path: req.path,
                  cacheKey,
                  ttl: config.ttl
                });
              } catch (error) {
                loggingService.error('Failed to cache response', error, {
                  method: req.method,
                  path: req.path,
                  cacheKey
                });
              }
            });
          }
          
          this.setCacheHeaders(res, config, false);
          return originalJson(data);
        };

        res.send = (data: any) => {
          // For non-JSON responses
          if (this.isCacheable(res) && typeof data === 'string') {
            setImmediate(async () => {
              try {
                await redisService.set(
                  config.pattern,
                  cacheKey,
                  data,
                  {
                    ttl: config.ttl,
                    tags: config.tags,
                    dependencies: config.dependencies,
                    strategy: config.strategy
                  }
                );
              } catch (error) {
                loggingService.error('Failed to cache response', error);
              }
            });
          }
          
          this.setCacheHeaders(res, config, false);
          return originalSend(data);
        };

        timer();
        next();

      } catch (error) {
        timer();
        loggingService.error('Cache middleware error', error, {
          method: req.method,
          path: req.path
        });
        next();
      }
    };
  }

  /**
   * Cache invalidation middleware for write operations
   */
  invalidateCache() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Proceed with the original operation first
        next();

        // Schedule cache invalidation after response
        res.on('finish', async () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            await this.invalidateRelatedCaches(req);
          }
        });

      } catch (error) {
        loggingService.error('Cache invalidation middleware error', error);
        next();
      }
    };
  }

  /**
   * Invalidate related caches based on the operation
   */
  private async invalidateRelatedCaches(req: Request): Promise<void> {
    try {
      const invalidationMap: Record<string, string[]> = {
        // Ticket operations
        'POST:/api/tickets': ['tickets', 'query_results', 'dashboard'],
        'PUT:/api/tickets/:id': ['tickets', 'single_ticket', 'dashboard'],
        'DELETE:/api/tickets/:id': ['tickets', 'single_ticket', 'dashboard'],
        
        // User operations
        'PUT:/api/users/:id': ['user_data'],
        'DELETE:/api/users/:id': ['user_data', 'directory'],
        
        // Site operations
        'POST:/api/sites': ['sites', 'location_data'],
        'PUT:/api/sites/:id': ['sites', 'single_site', 'location_data'],
        'DELETE:/api/sites/:id': ['sites', 'single_site', 'location_data'],
        
        // Shift operations
        'POST:/api/shifts': ['shifts', 'real_time', 'dashboard'],
        'PUT:/api/shifts/:id': ['shifts', 'real_time', 'dashboard'],
        'DELETE:/api/shifts/:id': ['shifts', 'real_time', 'dashboard'],
        
        // Staff operations
        'POST:/api/staff': ['staff', 'directory'],
        'PUT:/api/staff/:id': ['staff', 'directory'],
        'DELETE:/api/staff/:id': ['staff', 'directory'],
        
        // Client operations
        'POST:/api/clients': ['clients', 'directory'],
        'PUT:/api/clients/:id': ['clients', 'directory'],
        'DELETE:/api/clients/:id': ['clients', 'directory']
      };

      const routeKey = `${req.method}:${req.route?.path || req.path}`;
      const tagsToInvalidate = invalidationMap[routeKey];

      if (tagsToInvalidate) {
        const invalidated = await redisService.invalidate({ tags: tagsToInvalidate });
        
        loggingService.info('Cache invalidated', {
          method: req.method,
          path: req.path,
          tags: tagsToInvalidate,
          keysInvalidated: invalidated
        });

        monitoring.incrementCounter('cache_invalidations_total', 1, {
          method: req.method,
          path: req.path.substring(0, 50)
        });
      }

    } catch (error) {
      loggingService.error('Failed to invalidate cache', error, {
        method: req.method,
        path: req.path
      });
    }
  }

  /**
   * Get hit rate statistics
   */
  getHitRateStats(): Record<string, { hitRate: number; requests: number }> {
    const stats: Record<string, { hitRate: number; requests: number }> = {};
    
    this.hitRates.forEach((value, key) => {
      const total = value.hits + value.misses;
      stats[key] = {
        hitRate: total > 0 ? (value.hits / total) * 100 : 0,
        requests: total
      };
    });

    return stats;
  }

  /**
   * Clear hit rate statistics
   */
  clearStats(): void {
    this.hitRates.clear();
  }
}

// Export singleton instance
export const cachingMiddleware = new CachingMiddleware();

// Export utility functions
export function setCacheConfig(route: string, config: EndpointCacheConfig): void {
  CACHE_CONFIGURATIONS[route] = config;
}

export function getCacheConfig(route: string): EndpointCacheConfig | undefined {
  return CACHE_CONFIGURATIONS[route];
}

export function invalidateByTags(tags: string[]): Promise<number> {
  return redisService.invalidate({ tags });
}

export function invalidateByPattern(pattern: CachePattern): Promise<number> {
  return redisService.invalidate({ pattern });
}

export default cachingMiddleware;