import Redis from 'ioredis';
import { Request, Response } from 'express';
import loggingService from './loggingService';
import metricsService from './metricsService';

export interface RateLimitRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: {
    endpoints?: string[];
    methods?: string[];
    userRoles?: string[];
    userIds?: string[];
    ips?: string[];
    userAgents?: string[];
    headers?: Record<string, string>;
  };
  limits: {
    requests: number;
    windowMs: number;
    burst?: number; // Allow burst requests
  };
  actions: {
    block: boolean;
    delay?: number; // Delay in ms
    customResponse?: {
      statusCode: number;
      message: string;
      headers?: Record<string, string>;
    };
  };
  skipIf?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  totalHits: number;
  totalHitsPerWindow: number;
  remainingPoints: number;
  msBeforeNext: number;
  rule: RateLimitRule;
  key: string;
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  statusCode?: number;
  headers?: boolean;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

class RateLimitingService {
  private redis: Redis;
  private fallbackStorage: Map<string, { count: number; resetTime: number }> = new Map();
  private rules: Map<string, RateLimitRule> = new Map();
  private globalLimits: Map<string, RateLimitOptions> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.initializeRedis();
    this.initializeDefaultRules();
    this.initializeGlobalLimits();
    this.setupCleanupInterval();
  }

  /**
   * Initialize Redis connection
   */
  private initializeRedis(): void {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_RATE_LIMIT_DB || '2'),
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3
      });

      this.redis.on('connect', () => {
        loggingService.info('Rate limiting Redis connected');
      });

      this.redis.on('error', (error) => {
        loggingService.error('Rate limiting Redis error', error);
      });
    } catch (error) {
      loggingService.error('Failed to initialize rate limiting Redis', error);
    }
  }

  /**
   * Initialize default rate limiting rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: RateLimitRule[] = [
      {
        id: 'global-api-limit',
        name: 'Global API Rate Limit',
        enabled: true,
        priority: 1,
        conditions: {},
        limits: {
          requests: 1000,
          windowMs: 60 * 60 * 1000 // 1 hour
        },
        actions: {
          block: true,
          customResponse: {
            statusCode: 429,
            message: 'Too many requests, please try again later'
          }
        }
      },
      {
        id: 'auth-endpoint-limit',
        name: 'Authentication Endpoint Limit',
        enabled: true,
        priority: 2,
        conditions: {
          endpoints: ['/auth/login', '/auth/register'],
          methods: ['POST']
        },
        limits: {
          requests: 5,
          windowMs: 15 * 60 * 1000, // 15 minutes
          burst: 2
        },
        actions: {
          block: true,
          delay: 1000,
          customResponse: {
            statusCode: 429,
            message: 'Too many authentication attempts. Please wait before trying again.',
            headers: {
              'Retry-After': '900'
            }
          }
        }
      },
      {
        id: 'anonymous-user-limit',
        name: 'Anonymous User Limit',
        enabled: true,
        priority: 3,
        conditions: {},
        limits: {
          requests: 100,
          windowMs: 60 * 60 * 1000 // 1 hour
        },
        actions: {
          block: true
        },
        skipIf: (req: Request) => !!(req as any).user
      },
      {
        id: 'admin-elevated-limit',
        name: 'Admin Elevated Limit',
        enabled: true,
        priority: 4,
        conditions: {
          userRoles: ['admin']
        },
        limits: {
          requests: 10000,
          windowMs: 60 * 60 * 1000 // 1 hour
        },
        actions: {
          block: false // Admins get higher limits but still tracked
        }
      },
      {
        id: 'api-write-operations',
        name: 'API Write Operations Limit',
        enabled: true,
        priority: 5,
        conditions: {
          methods: ['POST', 'PUT', 'DELETE', 'PATCH']
        },
        limits: {
          requests: 200,
          windowMs: 60 * 60 * 1000, // 1 hour
          burst: 10
        },
        actions: {
          block: true,
          customResponse: {
            statusCode: 429,
            message: 'Too many write operations. Please slow down.'
          }
        }
      },
      {
        id: 'search-endpoint-limit',
        name: 'Search Endpoint Rate Limit',
        enabled: true,
        priority: 6,
        conditions: {
          endpoints: ['/search', '/tickets/search', '/users/search']
        },
        limits: {
          requests: 60,
          windowMs: 60 * 1000 // 1 minute
        },
        actions: {
          block: true,
          customResponse: {
            statusCode: 429,
            message: 'Search rate limit exceeded. Please wait before searching again.'
          }
        }
      },
      {
        id: 'suspicious-activity-limit',
        name: 'Suspicious Activity Limit',
        enabled: true,
        priority: 10,
        conditions: {},
        limits: {
          requests: 20,
          windowMs: 60 * 1000 // 1 minute
        },
        actions: {
          block: true,
          customResponse: {
            statusCode: 429,
            message: 'Suspicious activity detected. Access temporarily restricted.'
          }
        },
        skipIf: (req: Request) => {
          // Check for suspicious patterns
          const userAgent = req.get('User-Agent') || '';
          const isSuspicious = 
            !userAgent || 
            userAgent.includes('bot') ||
            userAgent.includes('crawler') ||
            req.path.includes('..') ||
            req.path.includes('<script>');
          
          return !isSuspicious;
        }
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });

    loggingService.info('Default rate limiting rules initialized', {
      rulesCount: defaultRules.length
    });
  }

  /**
   * Initialize global rate limits for different tiers
   */
  private initializeGlobalLimits(): void {
    this.globalLimits.set('free', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 1000,
      message: 'Free tier rate limit exceeded'
    });

    this.globalLimits.set('premium', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10000,
      message: 'Premium tier rate limit exceeded'
    });

    this.globalLimits.set('enterprise', {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 100000,
      message: 'Enterprise tier rate limit exceeded'
    });
  }

  /**
   * Setup cleanup interval for fallback storage
   */
  private setupCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupFallbackStorage();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Check rate limits for a request
   */
  async checkRateLimit(req: Request): Promise<RateLimitResult | null> {
    try {
      // Get applicable rules sorted by priority
      const applicableRules = this.getApplicableRules(req)
        .sort((a, b) => b.priority - a.priority);

      // Check each rule
      for (const rule of applicableRules) {
        const result = await this.checkRule(req, rule);
        
        if (!result.allowed && rule.actions.block) {
          return result;
        }

        // Record metrics for all checks
        metricsService.recordBusinessKPI('rate_limit_check', 1, {
          ruleId: rule.id,
          allowed: result.allowed.toString(),
          endpoint: req.path,
          method: req.method
        });
      }

      return null; // All rules passed
    } catch (error) {
      loggingService.error('Rate limit check failed', error);
      return null; // Fail open
    }
  }

  /**
   * Check a specific rule
   */
  private async checkRule(req: Request, rule: RateLimitRule): Promise<RateLimitResult> {
    const key = this.generateKey(req, rule);
    const windowMs = rule.limits.windowMs;
    const maxRequests = rule.limits.requests;

    try {
      const current = await this.getCurrentCount(key, windowMs);
      const remaining = Math.max(0, maxRequests - current.count);
      const allowed = current.count < maxRequests;

      // Handle burst requests
      if (!allowed && rule.limits.burst) {
        const burstKey = `${key}:burst`;
        const burstCurrent = await this.getCurrentCount(burstKey, 60 * 1000); // 1 minute burst window
        const burstAllowed = burstCurrent.count < rule.limits.burst;
        
        if (burstAllowed) {
          await this.incrementCount(burstKey, 60 * 1000);
          return {
            allowed: true,
            totalHits: current.count,
            totalHitsPerWindow: maxRequests,
            remainingPoints: 0,
            msBeforeNext: current.resetTime - Date.now(),
            rule,
            key
          };
        }
      }

      // Increment count if request is being processed
      if (allowed) {
        await this.incrementCount(key, windowMs);
      }

      return {
        allowed,
        totalHits: current.count,
        totalHitsPerWindow: maxRequests,
        remainingPoints: remaining,
        msBeforeNext: current.resetTime - Date.now(),
        rule,
        key
      };
    } catch (error) {
      loggingService.error('Rule check failed', error, { ruleId: rule.id, key });
      // Fail open - allow the request
      return {
        allowed: true,
        totalHits: 0,
        totalHitsPerWindow: maxRequests,
        remainingPoints: maxRequests,
        msBeforeNext: 0,
        rule,
        key
      };
    }
  }

  /**
   * Get current count for a key
   */
  private async getCurrentCount(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    try {
      if (this.redis.status === 'ready') {
        const pipeline = this.redis.pipeline();
        const now = Date.now();
        const windowStart = now - windowMs;

        // Use sorted sets for sliding window
        pipeline.zremrangebyscore(key, '-inf', windowStart);
        pipeline.zcard(key);
        pipeline.expire(key, Math.ceil(windowMs / 1000));

        const results = await pipeline.exec();
        const count = (results?.[1]?.[1] as number) || 0;

        return {
          count,
          resetTime: now + windowMs
        };
      } else {
        // Fallback to in-memory storage
        return this.getFallbackCount(key, windowMs);
      }
    } catch (error) {
      loggingService.error('Failed to get current count', error);
      return this.getFallbackCount(key, windowMs);
    }
  }

  /**
   * Increment count for a key
   */
  private async incrementCount(key: string, windowMs: number): Promise<void> {
    try {
      if (this.redis.status === 'ready') {
        const now = Date.now();
        const pipeline = this.redis.pipeline();

        // Add current timestamp to sorted set
        pipeline.zadd(key, now, now);
        pipeline.expire(key, Math.ceil(windowMs / 1000));

        await pipeline.exec();
      } else {
        // Fallback to in-memory storage
        this.incrementFallbackCount(key, windowMs);
      }
    } catch (error) {
      loggingService.error('Failed to increment count', error);
      this.incrementFallbackCount(key, windowMs);
    }
  }

  /**
   * Get applicable rules for a request
   */
  private getApplicableRules(req: Request): RateLimitRule[] {
    const applicableRules: RateLimitRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check skip condition
      if (rule.skipIf && rule.skipIf(req)) continue;

      // Check conditions
      if (this.matchesConditions(req, rule.conditions)) {
        applicableRules.push(rule);
      }
    }

    return applicableRules;
  }

  /**
   * Check if request matches rule conditions
   */
  private matchesConditions(req: Request, conditions: RateLimitRule['conditions']): boolean {
    // Check endpoints
    if (conditions.endpoints && conditions.endpoints.length > 0) {
      const matches = conditions.endpoints.some(endpoint => 
        req.path.includes(endpoint) || new RegExp(endpoint).test(req.path)
      );
      if (!matches) return false;
    }

    // Check methods
    if (conditions.methods && conditions.methods.length > 0) {
      if (!conditions.methods.includes(req.method)) return false;
    }

    // Check user roles
    if (conditions.userRoles && conditions.userRoles.length > 0) {
      const userRole = (req as any).user?.role;
      if (!userRole || !conditions.userRoles.includes(userRole)) return false;
    }

    // Check user IDs
    if (conditions.userIds && conditions.userIds.length > 0) {
      const userId = (req as any).user?.id;
      if (!userId || !conditions.userIds.includes(userId)) return false;
    }

    // Check IPs
    if (conditions.ips && conditions.ips.length > 0) {
      if (!conditions.ips.includes(req.ip)) return false;
    }

    // Check user agents
    if (conditions.userAgents && conditions.userAgents.length > 0) {
      const userAgent = req.get('User-Agent') || '';
      const matches = conditions.userAgents.some(pattern => 
        new RegExp(pattern, 'i').test(userAgent)
      );
      if (!matches) return false;
    }

    // Check headers
    if (conditions.headers) {
      for (const [headerName, expectedValue] of Object.entries(conditions.headers)) {
        const actualValue = req.get(headerName);
        if (actualValue !== expectedValue) return false;
      }
    }

    return true;
  }

  /**
   * Generate rate limit key
   */
  private generateKey(req: Request, rule: RateLimitRule): string {
    if (rule.keyGenerator) {
      return `rate_limit:${rule.id}:${rule.keyGenerator(req)}`;
    }

    // Default key generation strategy
    const user = (req as any).user;
    const keyParts = ['rate_limit', rule.id];

    if (user) {
      keyParts.push(`user:${user.id}`);
    } else {
      keyParts.push(`ip:${req.ip}`);
    }

    // Add additional context based on rule conditions
    if (rule.conditions.endpoints) {
      keyParts.push(`endpoint:${req.path}`);
    }

    if (rule.conditions.methods) {
      keyParts.push(`method:${req.method}`);
    }

    return keyParts.join(':');
  }

  /**
   * Fallback storage methods (when Redis is unavailable)
   */
  private getFallbackCount(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const entry = this.fallbackStorage.get(key);

    if (!entry || entry.resetTime <= now) {
      return { count: 0, resetTime: now + windowMs };
    }

    return { count: entry.count, resetTime: entry.resetTime };
  }

  private incrementFallbackCount(key: string, windowMs: number): void {
    const now = Date.now();
    const entry = this.fallbackStorage.get(key);

    if (!entry || entry.resetTime <= now) {
      this.fallbackStorage.set(key, { count: 1, resetTime: now + windowMs });
    } else {
      entry.count++;
    }
  }

  private cleanupFallbackStorage(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.fallbackStorage) {
      if (entry.resetTime <= now) {
        this.fallbackStorage.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      loggingService.debug('Cleaned up fallback storage', { cleanedCount });
    }
  }

  /**
   * Public methods for rule management
   */

  /**
   * Add or update rate limiting rule
   */
  addRule(rule: RateLimitRule): void {
    this.rules.set(rule.id, rule);
    loggingService.info('Rate limiting rule added/updated', { ruleId: rule.id });
  }

  /**
   * Remove rate limiting rule
   */
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      loggingService.info('Rate limiting rule removed', { ruleId });
    }
    return removed;
  }

  /**
   * Get all rules
   */
  getRules(): RateLimitRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): RateLimitRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Enable/disable rule
   */
  toggleRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      loggingService.info('Rate limiting rule toggled', { ruleId, enabled });
      return true;
    }
    return false;
  }

  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(key: string): Promise<boolean> {
    try {
      if (this.redis.status === 'ready') {
        await this.redis.del(key);
      }
      this.fallbackStorage.delete(key);
      return true;
    } catch (error) {
      loggingService.error('Failed to reset rate limit', error, { key });
      return false;
    }
  }

  /**
   * Get rate limit statistics
   */
  async getRateLimitStats(timeWindow: number = 60): Promise<any> {
    try {
      const stats = {
        timestamp: new Date().toISOString(),
        timeWindow: `${timeWindow} minutes`,
        rules: {} as Record<string, any>,
        summary: {
          totalRules: this.rules.size,
          activeRules: 0,
          totalBlocks: 0,
          totalRequests: 0
        }
      };

      for (const rule of this.rules.values()) {
        if (rule.enabled) {
          stats.summary.activeRules++;
        }

        // This would typically query metrics or Redis for actual stats
        // For now, providing structure for implementation
        stats.rules[rule.id] = {
          name: rule.name,
          enabled: rule.enabled,
          requests: 0,
          blocks: 0,
          topClients: []
        };
      }

      return stats;
    } catch (error) {
      loggingService.error('Failed to get rate limit stats', error);
      return null;
    }
  }

  /**
   * Whitelist IP or user
   */
  addWhitelist(type: 'ip' | 'user', value: string): void {
    const whitelistRule: RateLimitRule = {
      id: `whitelist-${type}-${value}`,
      name: `Whitelist ${type}: ${value}`,
      enabled: true,
      priority: 1000, // High priority
      conditions: type === 'ip' ? { ips: [value] } : { userIds: [value] },
      limits: {
        requests: Number.MAX_SAFE_INTEGER,
        windowMs: 60 * 60 * 1000
      },
      actions: {
        block: false
      }
    };

    this.addRule(whitelistRule);
  }

  /**
   * Blacklist IP or user
   */
  addBlacklist(type: 'ip' | 'user', value: string): void {
    const blacklistRule: RateLimitRule = {
      id: `blacklist-${type}-${value}`,
      name: `Blacklist ${type}: ${value}`,
      enabled: true,
      priority: 1000, // High priority
      conditions: type === 'ip' ? { ips: [value] } : { userIds: [value] },
      limits: {
        requests: 0,
        windowMs: 60 * 60 * 1000
      },
      actions: {
        block: true,
        customResponse: {
          statusCode: 403,
          message: 'Access denied'
        }
      }
    };

    this.addRule(blacklistRule);
  }

  /**
   * Cleanup on shutdown
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.redis) {
      this.redis.disconnect();
    }
  }
}

export default new RateLimitingService();