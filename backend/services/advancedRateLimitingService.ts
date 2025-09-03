import Redis from 'ioredis';
import { Request } from 'express';
import loggingService from './loggingService';
import metricsService from './metricsService';

export interface AdvancedRateLimitConfig {
  algorithm: 'sliding_window' | 'token_bucket' | 'leaky_bucket' | 'fixed_window';
  capacity: number;
  refillRate?: number; // tokens per second for token bucket
  leakRate?: number; // requests per second for leaky bucket
  windowSize: number; // in milliseconds
  burstCapacity?: number;
  warmupPeriod?: number; // in milliseconds
  backoffMultiplier?: number;
  maxBackoffTime?: number;
}

export interface RateLimitContext {
  key: string;
  algorithm: string;
  capacity: number;
  current: number;
  remaining: number;
  resetTime: number;
  backoffTime?: number;
  warmupActive?: boolean;
}

export interface GeographicRateLimit {
  enabled: boolean;
  regions: Record<string, {
    maxRequests: number;
    windowMs: number;
    priority: number;
  }>;
  fallbackLimit: {
    maxRequests: number;
    windowMs: number;
  };
}

export interface BehavioralRateLimit {
  enabled: boolean;
  suspiciousPatterns: {
    rapidRequests: { threshold: number; timeWindow: number };
    repeatedErrors: { threshold: number; timeWindow: number };
    unusualPaths: { patterns: string[]; penalty: number };
  };
  adaptiveLimits: {
    goodBehavior: { multiplier: number; threshold: number };
    badBehavior: { multiplier: number; threshold: number };
  };
}

class AdvancedRateLimitingService {
  private redis: Redis;
  private algorithms: Map<string, any> = new Map();
  private geographicLimits: GeographicRateLimit;
  private behavioralLimits: BehavioralRateLimit;
  private circuitBreakers: Map<string, any> = new Map();

  constructor() {
    this.initializeRedis();
    this.initializeAlgorithms();
    this.initializeGeographicLimits();
    this.initializeBehavioralLimits();
    this.setupCircuitBreakers();
  }

  /**
   * Initialize Redis connection with advanced configuration
   */
  private initializeRedis(): void {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_ADVANCED_RATE_LIMIT_DB || '3'),
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      // Connection pooling for high performance
      family: 4,
      connectTimeout: 5000,
      commandTimeout: 3000
    });

    // Load Lua scripts for atomic operations
    this.loadLuaScripts();
  }

  /**
   * Load Lua scripts for atomic rate limiting operations
   */
  private loadLuaScripts(): void {
    // Sliding window rate limit script
    const slidingWindowScript = `
      local key = KEYS[1]
      local window = tonumber(ARGV[1])
      local limit = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      
      local window_start = now - window
      
      -- Remove old entries
      redis.call('zremrangebyscore', key, '-inf', window_start)
      
      local current = redis.call('zcard', key)
      
      if current < limit then
        redis.call('zadd', key, now, now)
        redis.call('expire', key, math.ceil(window / 1000))
        return {1, limit - current - 1, window}
      else
        local oldest = redis.call('zrange', key, 0, 0, 'withscores')[2]
        local reset_time = (oldest and (oldest + window)) or (now + window)
        return {0, 0, reset_time - now}
      end
    `;

    // Token bucket rate limit script
    const tokenBucketScript = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refill_rate = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local cost = tonumber(ARGV[4]) or 1
      
      local bucket = redis.call('hmget', key, 'tokens', 'last_refill')
      local tokens = tonumber(bucket[1]) or capacity
      local last_refill = tonumber(bucket[2]) or now
      
      -- Calculate tokens to add
      local elapsed = (now - last_refill) / 1000
      local tokens_to_add = elapsed * refill_rate
      tokens = math.min(capacity, tokens + tokens_to_add)
      
      if tokens >= cost then
        tokens = tokens - cost
        redis.call('hmset', key, 'tokens', tokens, 'last_refill', now)
        redis.call('expire', key, 3600)
        return {1, math.floor(tokens)}
      else
        redis.call('hmset', key, 'tokens', tokens, 'last_refill', now)
        redis.call('expire', key, 3600)
        local wait_time = (cost - tokens) / refill_rate
        return {0, math.floor(tokens), math.ceil(wait_time * 1000)}
      end
    `;

    // Leaky bucket rate limit script
    const leakyBucketScript = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local leak_rate = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      
      local bucket = redis.call('hmget', key, 'volume', 'last_leak')
      local volume = tonumber(bucket[1]) or 0
      local last_leak = tonumber(bucket[2]) or now
      
      -- Calculate leaked volume
      local elapsed = (now - last_leak) / 1000
      local leaked = elapsed * leak_rate
      volume = math.max(0, volume - leaked)
      
      if volume < capacity then
        volume = volume + 1
        redis.call('hmset', key, 'volume', volume, 'last_leak', now)
        redis.call('expire', key, 3600)
        return {1, capacity - volume}
      else
        redis.call('hmset', key, 'volume', volume, 'last_leak', now)
        redis.call('expire', key, 3600)
        local wait_time = 1 / leak_rate
        return {0, 0, math.ceil(wait_time * 1000)}
      end
    `;

    this.redis.defineCommand('slidingWindow', {
      numberOfKeys: 1,
      lua: slidingWindowScript
    });

    this.redis.defineCommand('tokenBucket', {
      numberOfKeys: 1,
      lua: tokenBucketScript
    });

    this.redis.defineCommand('leakyBucket', {
      numberOfKeys: 1,
      lua: leakyBucketScript
    });
  }

  /**
   * Initialize rate limiting algorithms
   */
  private initializeAlgorithms(): void {
    this.algorithms.set('sliding_window', this.slidingWindowRateLimit.bind(this));
    this.algorithms.set('token_bucket', this.tokenBucketRateLimit.bind(this));
    this.algorithms.set('leaky_bucket', this.leakyBucketRateLimit.bind(this));
    this.algorithms.set('fixed_window', this.fixedWindowRateLimit.bind(this));
  }

  /**
   * Initialize geographic-based rate limiting
   */
  private initializeGeographicLimits(): void {
    this.geographicLimits = {
      enabled: true,
      regions: {
        'US': { maxRequests: 10000, windowMs: 3600000, priority: 1 },
        'EU': { maxRequests: 8000, windowMs: 3600000, priority: 2 },
        'AS': { maxRequests: 6000, windowMs: 3600000, priority: 3 },
        'CN': { maxRequests: 2000, windowMs: 3600000, priority: 5 }, // Stricter limits
        'RU': { maxRequests: 3000, windowMs: 3600000, priority: 4 }
      },
      fallbackLimit: { maxRequests: 5000, windowMs: 3600000 }
    };
  }

  /**
   * Initialize behavioral pattern-based rate limiting
   */
  private initializeBehavioralLimits(): void {
    this.behavioralLimits = {
      enabled: true,
      suspiciousPatterns: {
        rapidRequests: { threshold: 100, timeWindow: 60000 }, // 100 requests per minute
        repeatedErrors: { threshold: 50, timeWindow: 300000 }, // 50 errors per 5 minutes
        unusualPaths: {
          patterns: [
            '/\\.\\.',  // Path traversal
            '/<script', // XSS attempts
            '/union.*select', // SQL injection
            '/cmd\\.exe', // Command injection
            '/%[0-9a-f]{2}.*%[0-9a-f]{2}' // Encoded suspicious content
          ],
          penalty: 10 // Multiply rate limit by this factor
        }
      },
      adaptiveLimits: {
        goodBehavior: { multiplier: 1.5, threshold: 1000 }, // 50% more requests for good actors
        badBehavior: { multiplier: 0.1, threshold: 10 } // 90% fewer requests for bad actors
      }
    };
  }

  /**
   * Setup circuit breakers for system protection
   */
  private setupCircuitBreakers(): void {
    // Circuit breaker for Redis operations
    this.circuitBreakers.set('redis', {
      state: 'closed', // closed, open, half-open
      failureCount: 0,
      failureThreshold: 5,
      timeout: 30000, // 30 seconds
      lastFailure: null,
      successThreshold: 2 // for half-open state
    });

    // Circuit breaker for system overload
    this.circuitBreakers.set('system', {
      state: 'closed',
      failureCount: 0,
      failureThreshold: 100, // 100 failures per minute
      timeout: 60000, // 1 minute
      lastFailure: null,
      successThreshold: 10
    });
  }

  /**
   * Advanced rate limit check with multiple algorithms
   */
  async checkAdvancedRateLimit(
    req: Request, 
    config: AdvancedRateLimitConfig, 
    key?: string
  ): Promise<RateLimitContext | null> {
    try {
      // Generate key if not provided
      const rateLimitKey = key || this.generateAdvancedKey(req, config);
      
      // Check circuit breaker
      if (!this.isCircuitBreakerClosed('redis')) {
        return this.getFallbackRateLimit(rateLimitKey, config);
      }

      // Apply geographic limits if enabled
      const geoConfig = await this.applyGeographicLimits(req, config);
      
      // Apply behavioral limits if enabled
      const behavioralConfig = await this.applyBehavioralLimits(req, geoConfig);

      // Check warmup period
      const warmupConfig = this.applyWarmupPeriod(behavioralConfig);

      // Execute algorithm-specific rate limiting
      const algorithm = this.algorithms.get(warmupConfig.algorithm);
      if (!algorithm) {
        throw new Error(`Unknown algorithm: ${warmupConfig.algorithm}`);
      }

      const result = await algorithm(rateLimitKey, warmupConfig);

      // Apply backoff if needed
      if (!result.allowed && warmupConfig.backoffMultiplier) {
        result.backoffTime = this.calculateBackoff(rateLimitKey, warmupConfig);
      }

      // Record metrics
      this.recordAdvancedMetrics(req, result, warmupConfig);

      return result;
    } catch (error) {
      loggingService.error('Advanced rate limiting failed', error);
      this.handleCircuitBreakerFailure('redis');
      return null; // Fail open
    }
  }

  /**
   * Sliding window rate limiting implementation
   */
  private async slidingWindowRateLimit(
    key: string, 
    config: AdvancedRateLimitConfig
  ): Promise<RateLimitContext> {
    const now = Date.now();
    
    try {
      const result = await (this.redis as any).slidingWindow(
        key,
        config.windowSize,
        config.capacity,
        now
      );

      const [allowed, remaining, resetTime] = result;

      return {
        key,
        algorithm: 'sliding_window',
        capacity: config.capacity,
        current: config.capacity - remaining,
        remaining,
        resetTime: now + resetTime,
        warmupActive: false
      };
    } catch (error) {
      throw new Error(`Sliding window rate limit failed: ${error.message}`);
    }
  }

  /**
   * Token bucket rate limiting implementation
   */
  private async tokenBucketRateLimit(
    key: string, 
    config: AdvancedRateLimitConfig
  ): Promise<RateLimitContext> {
    const now = Date.now();
    const refillRate = config.refillRate || (config.capacity / (config.windowSize / 1000));
    
    try {
      const result = await (this.redis as any).tokenBucket(
        key,
        config.capacity,
        refillRate,
        now,
        1 // cost per request
      );

      const [allowed, tokens, waitTime] = result;

      return {
        key,
        algorithm: 'token_bucket',
        capacity: config.capacity,
        current: config.capacity - tokens,
        remaining: tokens,
        resetTime: waitTime ? now + waitTime : now,
        warmupActive: false
      };
    } catch (error) {
      throw new Error(`Token bucket rate limit failed: ${error.message}`);
    }
  }

  /**
   * Leaky bucket rate limiting implementation
   */
  private async leakyBucketRateLimit(
    key: string, 
    config: AdvancedRateLimitConfig
  ): Promise<RateLimitContext> {
    const now = Date.now();
    const leakRate = config.leakRate || (config.capacity / (config.windowSize / 1000));
    
    try {
      const result = await (this.redis as any).leakyBucket(
        key,
        config.capacity,
        leakRate,
        now
      );

      const [allowed, remaining, waitTime] = result;

      return {
        key,
        algorithm: 'leaky_bucket',
        capacity: config.capacity,
        current: config.capacity - remaining,
        remaining,
        resetTime: waitTime ? now + waitTime : now,
        warmupActive: false
      };
    } catch (error) {
      throw new Error(`Leaky bucket rate limit failed: ${error.message}`);
    }
  }

  /**
   * Fixed window rate limiting implementation
   */
  private async fixedWindowRateLimit(
    key: string, 
    config: AdvancedRateLimitConfig
  ): Promise<RateLimitContext> {
    const now = Date.now();
    const windowStart = Math.floor(now / config.windowSize) * config.windowSize;
    const windowKey = `${key}:${windowStart}`;
    
    try {
      const pipeline = this.redis.pipeline();
      pipeline.incr(windowKey);
      pipeline.expire(windowKey, Math.ceil(config.windowSize / 1000));
      
      const results = await pipeline.exec();
      const current = results?.[0]?.[1] as number || 0;
      const remaining = Math.max(0, config.capacity - current);
      const allowed = current <= config.capacity;

      return {
        key,
        algorithm: 'fixed_window',
        capacity: config.capacity,
        current,
        remaining,
        resetTime: windowStart + config.windowSize,
        warmupActive: false
      };
    } catch (error) {
      throw new Error(`Fixed window rate limit failed: ${error.message}`);
    }
  }

  /**
   * Apply geographic-based rate limiting
   */
  private async applyGeographicLimits(
    req: Request, 
    config: AdvancedRateLimitConfig
  ): Promise<AdvancedRateLimitConfig> {
    if (!this.geographicLimits.enabled) {
      return config;
    }

    try {
      // Get client's geographic location (would use GeoIP service)
      const country = this.getCountryFromIP(req.ip);
      const regionLimit = this.geographicLimits.regions[country];

      if (regionLimit) {
        return {
          ...config,
          capacity: Math.min(config.capacity, regionLimit.maxRequests),
          windowSize: regionLimit.windowMs
        };
      }

      // Apply fallback limit
      return {
        ...config,
        capacity: Math.min(config.capacity, this.geographicLimits.fallbackLimit.maxRequests),
        windowSize: this.geographicLimits.fallbackLimit.windowMs
      };
    } catch (error) {
      loggingService.error('Geographic rate limiting failed', error);
      return config;
    }
  }

  /**
   * Apply behavioral pattern-based rate limiting
   */
  private async applyBehavioralLimits(
    req: Request, 
    config: AdvancedRateLimitConfig
  ): Promise<AdvancedRateLimitConfig> {
    if (!this.behavioralLimits.enabled) {
      return config;
    }

    try {
      const behaviorScore = await this.calculateBehaviorScore(req);
      let multiplier = 1;

      // Apply good behavior bonus
      if (behaviorScore > this.behavioralLimits.adaptiveLimits.goodBehavior.threshold) {
        multiplier = this.behavioralLimits.adaptiveLimits.goodBehavior.multiplier;
      }
      // Apply bad behavior penalty
      else if (behaviorScore < this.behavioralLimits.adaptiveLimits.badBehavior.threshold) {
        multiplier = this.behavioralLimits.adaptiveLimits.badBehavior.multiplier;
      }

      // Check for suspicious patterns
      const suspiciousMultiplier = await this.checkSuspiciousPatterns(req);
      multiplier *= suspiciousMultiplier;

      return {
        ...config,
        capacity: Math.floor(config.capacity * multiplier),
        refillRate: config.refillRate ? config.refillRate * multiplier : undefined,
        leakRate: config.leakRate ? config.leakRate * multiplier : undefined
      };
    } catch (error) {
      loggingService.error('Behavioral rate limiting failed', error);
      return config;
    }
  }

  /**
   * Apply warmup period for new clients
   */
  private applyWarmupPeriod(config: AdvancedRateLimitConfig): AdvancedRateLimitConfig {
    if (!config.warmupPeriod) {
      return config;
    }

    // Warmup logic would be implemented here
    // For now, returning unchanged config
    return config;
  }

  /**
   * Calculate backoff time for rate limited requests
   */
  private calculateBackoff(key: string, config: AdvancedRateLimitConfig): number {
    if (!config.backoffMultiplier) {
      return 0;
    }

    // Exponential backoff implementation
    // Would track consecutive failures and calculate backoff time
    const baseBackoff = 1000; // 1 second
    const maxBackoff = config.maxBackoffTime || 300000; // 5 minutes

    return Math.min(baseBackoff * config.backoffMultiplier, maxBackoff);
  }

  /**
   * Generate advanced rate limiting key
   */
  private generateAdvancedKey(req: Request, config: AdvancedRateLimitConfig): string {
    const user = (req as any).user;
    const keyParts = ['advanced_rate_limit', config.algorithm];

    if (user) {
      keyParts.push(`user:${user.id}`);
    } else {
      keyParts.push(`ip:${req.ip}`);
    }

    keyParts.push(`endpoint:${req.method}:${req.route?.path || req.path}`);

    return keyParts.join(':');
  }

  /**
   * Get country from IP address (mock implementation)
   */
  private getCountryFromIP(ip: string): string {
    // This would use a GeoIP service or database
    // Mock implementation for demonstration
    const mockCountries = ['US', 'EU', 'AS', 'CN', 'RU'];
    return mockCountries[Math.floor(Math.random() * mockCountries.length)];
  }

  /**
   * Calculate behavior score for a request
   */
  private async calculateBehaviorScore(req: Request): Promise<number> {
    const userId = (req as any).user?.id;
    const ip = req.ip;
    const key = `behavior:${userId || ip}`;

    try {
      // Get behavior metrics from Redis
      const metrics = await this.redis.hmget(
        key,
        'total_requests',
        'error_count',
        'last_activity',
        'reputation_score'
      );

      const totalRequests = parseInt(metrics[0] || '0');
      const errorCount = parseInt(metrics[1] || '0');
      const reputationScore = parseFloat(metrics[3] || '50'); // Default neutral score

      // Calculate behavior score (0-100)
      const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
      const behaviorScore = Math.max(0, reputationScore - (errorRate * 2));

      return behaviorScore;
    } catch (error) {
      loggingService.error('Failed to calculate behavior score', error);
      return 50; // Neutral score
    }
  }

  /**
   * Check for suspicious patterns in request
   */
  private async checkSuspiciousPatterns(req: Request): Promise<number> {
    let multiplier = 1;

    try {
      const patterns = this.behavioralLimits.suspiciousPatterns;

      // Check for unusual paths
      const path = req.path.toLowerCase();
      for (const pattern of patterns.unusualPaths.patterns) {
        if (new RegExp(pattern, 'i').test(path)) {
          multiplier *= (1 / patterns.unusualPaths.penalty);
          
          loggingService.warn('Suspicious path pattern detected', null, {
            path: req.path,
            pattern,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          break;
        }
      }

      // Check for rapid requests
      const rapidKey = `rapid:${req.ip}`;
      const rapidCount = await this.redis.incr(rapidKey);
      
      if (rapidCount === 1) {
        await this.redis.expire(rapidKey, patterns.rapidRequests.timeWindow / 1000);
      }
      
      if (rapidCount > patterns.rapidRequests.threshold) {
        multiplier *= 0.1; // Severely limit rapid requests
      }

      return multiplier;
    } catch (error) {
      loggingService.error('Failed to check suspicious patterns', error);
      return 1;
    }
  }

  /**
   * Circuit breaker methods
   */
  private isCircuitBreakerClosed(name: string): boolean {
    const breaker = this.circuitBreakers.get(name);
    if (!breaker) return true;

    const now = Date.now();

    switch (breaker.state) {
      case 'closed':
        return true;
      case 'open':
        if (now - breaker.lastFailure > breaker.timeout) {
          breaker.state = 'half-open';
          breaker.failureCount = 0;
        }
        return false;
      case 'half-open':
        return true;
      default:
        return true;
    }
  }

  private handleCircuitBreakerFailure(name: string): void {
    const breaker = this.circuitBreakers.get(name);
    if (!breaker) return;

    breaker.failureCount++;
    breaker.lastFailure = Date.now();

    if (breaker.failureCount >= breaker.failureThreshold) {
      breaker.state = 'open';
      loggingService.error(`Circuit breaker ${name} opened`, null, {
        failureCount: breaker.failureCount,
        threshold: breaker.failureThreshold
      });
    }
  }

  private handleCircuitBreakerSuccess(name: string): void {
    const breaker = this.circuitBreakers.get(name);
    if (!breaker) return;

    if (breaker.state === 'half-open') {
      breaker.failureCount = 0;
      if (breaker.successCount++ >= breaker.successThreshold) {
        breaker.state = 'closed';
        breaker.successCount = 0;
        loggingService.info(`Circuit breaker ${name} closed`);
      }
    }
  }

  /**
   * Fallback rate limiting when Redis is unavailable
   */
  private getFallbackRateLimit(
    key: string, 
    config: AdvancedRateLimitConfig
  ): RateLimitContext {
    return {
      key,
      algorithm: 'fallback',
      capacity: config.capacity,
      current: 0,
      remaining: config.capacity,
      resetTime: Date.now() + config.windowSize,
      warmupActive: false
    };
  }

  /**
   * Record advanced metrics
   */
  private recordAdvancedMetrics(
    req: Request, 
    result: RateLimitContext, 
    config: AdvancedRateLimitConfig
  ): void {
    metricsService.recordBusinessKPI('advanced_rate_limit', 1, {
      algorithm: result.algorithm,
      allowed: (result.current <= result.capacity).toString(),
      endpoint: req.path,
      method: req.method,
      userRole: (req as any).user?.role || 'anonymous'
    });

    if (result.backoffTime) {
      metricsService.recordBusinessKPI('rate_limit_backoff', result.backoffTime, {
        algorithm: result.algorithm,
        key: result.key
      });
    }
  }

  /**
   * Cleanup method
   */
  cleanup(): void {
    if (this.redis) {
      this.redis.disconnect();
    }
  }
}

export default new AdvancedRateLimitingService();