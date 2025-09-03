import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

export interface CacheConfig {
  ttl: number; // Default TTL in seconds
  keyPrefix: string;
  maxRetries: number;
  retryDelayOnFailover: number;
  enableCompression: boolean;
  enableMetrics: boolean;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  totalOperations: number;
  averageLatency: number;
}

class CacheService extends EventEmitter {
  private redis: Redis | null = null;
  private fallbackCache = new Map<string, { value: any; expires: number }>();
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private isConnected = false;

  constructor() {
    super();
    
    this.config = {
      ttl: parseInt(process.env.CACHE_TTL || '3600'), // 1 hour default
      keyPrefix: process.env.CACHE_KEY_PREFIX || 'fieldsync:',
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
      enableCompression: process.env.ENABLE_CACHE_COMPRESSION === 'true',
      enableMetrics: process.env.ENABLE_CACHE_METRICS !== 'false'
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalOperations: 0,
      averageLatency: 0
    };

    this.initializeRedis();
  }

  private initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: this.config.maxRetries,
          retryDelayOnFailover: this.config.retryDelayOnFailover,
          enableAutoPipelining: true,
          lazyConnect: true
        });
      } else {
        this.redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
          maxRetriesPerRequest: this.config.maxRetries,
          retryDelayOnFailover: this.config.retryDelayOnFailover,
          enableAutoPipelining: true,
          lazyConnect: true
        });
      }

      this.redis.on('connect', () => {
        this.isConnected = true;
        console.log('✅ Redis cache connected');
        this.emit('connected');
      });

      this.redis.on('error', (error) => {
        this.isConnected = false;
        console.error('Redis cache error:', error);
        this.emit('error', error);
      });

      this.redis.on('close', () => {
        this.isConnected = false;
        console.warn('⚠️ Redis cache connection closed');
        this.emit('disconnected');
      });

      // Attempt to connect
      this.redis.connect().catch(error => {
        console.warn('Failed to connect to Redis, using fallback cache:', error);
      });

    } catch (error) {
      console.warn('Redis initialization failed, using fallback cache:', error);
    }
  }

  private getKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  private async recordMetrics(operation: 'hit' | 'miss' | 'error', latency: number = 0) {
    if (!this.config.enableMetrics) return;

    this.metrics.totalOperations++;
    this.metrics[operation === 'hit' ? 'hits' : operation === 'miss' ? 'misses' : 'errors']++;
    
    if (latency > 0) {
      this.metrics.averageLatency = 
        (this.metrics.averageLatency * (this.metrics.totalOperations - 1) + latency) / 
        this.metrics.totalOperations;
    }
  }

  private compressData(data: any): string {
    if (!this.config.enableCompression) {
      return JSON.stringify(data);
    }
    
    try {
      const zlib = require('zlib');
      const jsonString = JSON.stringify(data);
      return zlib.deflateSync(jsonString).toString('base64');
    } catch (error) {
      console.error('Compression error:', error);
      return JSON.stringify(data);
    }
  }

  private decompressData(compressedData: string): any {
    if (!this.config.enableCompression) {
      return JSON.parse(compressedData);
    }

    try {
      const zlib = require('zlib');
      const buffer = Buffer.from(compressedData, 'base64');
      const decompressed = zlib.inflateSync(buffer).toString();
      return JSON.parse(decompressed);
    } catch (error) {
      console.error('Decompression error:', error);
      return JSON.parse(compressedData);
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.getKey(key);

      if (this.redis && this.isConnected) {
        const value = await this.redis.get(cacheKey);
        const latency = Date.now() - startTime;

        if (value !== null) {
          await this.recordMetrics('hit', latency);
          return this.decompressData(value);
        } else {
          await this.recordMetrics('miss', latency);
          return null;
        }
      }

      // Fallback to memory cache
      const fallbackItem = this.fallbackCache.get(cacheKey);
      if (fallbackItem && fallbackItem.expires > Date.now()) {
        await this.recordMetrics('hit', Date.now() - startTime);
        return fallbackItem.value;
      }

      await this.recordMetrics('miss', Date.now() - startTime);
      return null;

    } catch (error) {
      await this.recordMetrics('error', Date.now() - startTime);
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.getKey(key);
      const serializedValue = this.compressData(value);
      const cacheTtl = ttl || this.config.ttl;

      if (this.redis && this.isConnected) {
        await this.redis.setex(cacheKey, cacheTtl, serializedValue);
        return true;
      }

      // Fallback to memory cache
      this.fallbackCache.set(cacheKey, {
        value,
        expires: Date.now() + (cacheTtl * 1000)
      });

      // Clean up expired entries periodically
      if (this.fallbackCache.size % 100 === 0) {
        this.cleanupFallbackCache();
      }

      return true;

    } catch (error) {
      await this.recordMetrics('error', Date.now() - startTime);
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key);

      if (this.redis && this.isConnected) {
        await this.redis.del(cacheKey);
      }

      this.fallbackCache.delete(cacheKey);
      return true;

    } catch (error) {
      await this.recordMetrics('error');
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key);

      if (this.redis && this.isConnected) {
        const result = await this.redis.exists(cacheKey);
        return result === 1;
      }

      const fallbackItem = this.fallbackCache.get(cacheKey);
      return fallbackItem !== undefined && fallbackItem.expires > Date.now();

    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Set multiple values at once
   */
  async mset(keyValuePairs: Record<string, any>, ttl?: number): Promise<boolean> {
    try {
      const cacheTtl = ttl || this.config.ttl;

      if (this.redis && this.isConnected) {
        const pipeline = this.redis.pipeline();
        
        Object.entries(keyValuePairs).forEach(([key, value]) => {
          const cacheKey = this.getKey(key);
          const serializedValue = this.compressData(value);
          pipeline.setex(cacheKey, cacheTtl, serializedValue);
        });

        await pipeline.exec();
        return true;
      }

      // Fallback to memory cache
      const expiresAt = Date.now() + (cacheTtl * 1000);
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        const cacheKey = this.getKey(key);
        this.fallbackCache.set(cacheKey, { value, expires: expiresAt });
      });

      return true;

    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  }

  /**
   * Get multiple values at once
   */
  async mget<T = any>(keys: string[]): Promise<Record<string, T | null>> {
    const result: Record<string, T | null> = {};

    try {
      const cacheKeys = keys.map(key => this.getKey(key));

      if (this.redis && this.isConnected) {
        const values = await this.redis.mget(...cacheKeys);
        
        keys.forEach((key, index) => {
          const value = values[index];
          result[key] = value ? this.decompressData(value) : null;
        });

        return result;
      }

      // Fallback to memory cache
      keys.forEach(key => {
        const cacheKey = this.getKey(key);
        const fallbackItem = this.fallbackCache.get(cacheKey);
        result[key] = (fallbackItem && fallbackItem.expires > Date.now()) 
          ? fallbackItem.value 
          : null;
      });

      return result;

    } catch (error) {
      console.error('Cache mget error:', error);
      keys.forEach(key => result[key] = null);
      return result;
    }
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string, amount: number = 1): Promise<number> {
    try {
      const cacheKey = this.getKey(key);

      if (this.redis && this.isConnected) {
        if (amount === 1) {
          return await this.redis.incr(cacheKey);
        } else {
          return await this.redis.incrby(cacheKey, amount);
        }
      }

      // Fallback to memory cache
      const current = await this.get<number>(key) || 0;
      const newValue = current + amount;
      await this.set(key, newValue);
      return newValue;

    } catch (error) {
      console.error('Cache incr error:', error);
      return 0;
    }
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key);

      if (this.redis && this.isConnected) {
        const result = await this.redis.expire(cacheKey, ttl);
        return result === 1;
      }

      // Update expiration in fallback cache
      const item = this.fallbackCache.get(cacheKey);
      if (item) {
        item.expires = Date.now() + (ttl * 1000);
        return true;
      }

      return false;

    } catch (error) {
      console.error('Cache expire error:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries with prefix
   */
  async clear(pattern?: string): Promise<boolean> {
    try {
      if (this.redis && this.isConnected) {
        const searchPattern = pattern 
          ? this.getKey(pattern) 
          : `${this.config.keyPrefix}*`;
        
        const keys = await this.redis.keys(searchPattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      // Clear fallback cache
      if (pattern) {
        const searchKey = this.getKey(pattern);
        for (const key of this.fallbackCache.keys()) {
          if (key.includes(searchKey)) {
            this.fallbackCache.delete(key);
          }
        }
      } else {
        this.fallbackCache.clear();
      }

      return true;

    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  /**
   * Cache wrapper for functions
   */
  async wrap<T>(
    key: string, 
    fn: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<boolean> {
    try {
      for (const tag of tags) {
        await this.clear(`tag:${tag}:*`);
      }
      return true;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return false;
    }
  }

  /**
   * Clean up expired entries in fallback cache
   */
  private cleanupFallbackCache() {
    const now = Date.now();
    for (const [key, item] of this.fallbackCache.entries()) {
      if (item.expires <= now) {
        this.fallbackCache.delete(key);
      }
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics & { hitRate: number; isConnected: boolean } {
    const hitRate = this.metrics.totalOperations > 0 
      ? (this.metrics.hits / this.metrics.totalOperations) * 100 
      : 0;

    return {
      ...this.metrics,
      hitRate,
      isConnected: this.isConnected
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalOperations: 0,
      averageLatency: 0
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    redis: boolean;
    fallback: boolean;
    metrics: CacheMetrics & { hitRate: number };
  }> {
    let redisHealthy = false;

    try {
      if (this.redis && this.isConnected) {
        await this.redis.ping();
        redisHealthy = true;
      }
    } catch (error) {
      redisHealthy = false;
    }

    return {
      redis: redisHealthy,
      fallback: true,
      metrics: this.getMetrics()
    };
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.fallbackCache.clear();
  }
}

export default new CacheService();