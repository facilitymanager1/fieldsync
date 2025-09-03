/**
 * Comprehensive Redis Caching Strategy Service
 * Provides high-performance caching for sessions, data queries, and application optimization
 */

import Redis from 'ioredis';
import { promisify } from 'util';
import loggingService from './loggingService';
import { monitoring } from './monitoringService';
import { recordBusinessEvent } from '../middleware/monitoringMiddleware';

// Cache Configuration
export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  defaultTTL: number;
  maxRetries: number;
  retryDelayOnFailover: number;
  enableOfflineQueue: boolean;
  lazyConnect: boolean;
  keepAlive: number;
  family: 4 | 6;
  compression: boolean;
  encryption: boolean;
}

// Cache Strategy Types
export enum CacheStrategy {
  CACHE_ASIDE = 'cache_aside',
  WRITE_THROUGH = 'write_through',
  WRITE_BEHIND = 'write_behind',
  REFRESH_AHEAD = 'refresh_ahead'
}

// Cache Patterns
export enum CachePattern {
  SESSION = 'session',
  QUERY_RESULT = 'query_result',
  COMPUTED_DATA = 'computed_data',
  RATE_LIMIT = 'rate_limit',
  TEMPORARY = 'temporary',
  DISTRIBUTED_LOCK = 'distributed_lock',
  REAL_TIME = 'real_time',
  USER_PREFERENCES = 'user_preferences'
}

// Cache Entry Metadata
export interface CacheMetadata {
  key: string;
  pattern: CachePattern;
  strategy: CacheStrategy;
  ttl: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  size: number;
  tags: string[];
  dependencies: string[];
  version: number;
}

// Cache Statistics
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
  evictions: number;
  operations: {
    get: number;
    set: number;
    delete: number;
    expire: number;
  };
  patterns: Record<CachePattern, {
    count: number;
    hitRate: number;
    avgSize: number;
  }>;
}

class RedisService {
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private config: CacheConfig;
  private stats: CacheStats;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor() {
    this.config = this.loadConfig();
    this.stats = this.initializeStats();
    this.initializeClients();
  }

  /**
   * Load Redis configuration from environment
   */
  private loadConfig(): CacheConfig {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'fieldsync:',
      defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL || '3600'), // 1 hour
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
      enableOfflineQueue: process.env.REDIS_OFFLINE_QUEUE === 'true',
      lazyConnect: process.env.REDIS_LAZY_CONNECT === 'true',
      keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE || '30000'),
      family: (process.env.REDIS_FAMILY as '4' | '6') || 4,
      compression: process.env.REDIS_COMPRESSION === 'true',
      encryption: process.env.REDIS_ENCRYPTION === 'true'
    };
  }

  /**
   * Initialize Redis clients with advanced configuration
   */
  private initializeClients(): void {
    const baseConfig = {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      keyPrefix: this.config.keyPrefix,
      maxRetriesPerRequest: this.config.maxRetries,
      retryDelayOnFailover: this.config.retryDelayOnFailover,
      enableOfflineQueue: this.config.enableOfflineQueue,
      lazyConnect: this.config.lazyConnect,
      keepAlive: this.config.keepAlive,
      family: this.config.family,
      connectTimeout: 10000,
      commandTimeout: 5000,
      maxmemoryPolicy: 'allkeys-lru'
    };

    // Main client for caching operations
    this.client = new Redis(baseConfig);
    
    // Subscriber client for pub/sub operations
    this.subscriber = new Redis({
      ...baseConfig,
      db: this.config.db + 1 // Use different DB for pub/sub
    });
    
    // Publisher client for pub/sub operations
    this.publisher = new Redis({
      ...baseConfig,
      db: this.config.db + 1
    });

    this.setupEventHandlers();
    this.setupHealthMonitoring();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    // Main client events
    this.client.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      loggingService.info('Redis client connected');
      monitoring.incrementCounter('redis_connections_total', 1, { type: 'main' });
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      loggingService.error('Redis client error', error);
      monitoring.incrementCounter('redis_errors_total', 1, { type: 'connection' });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      loggingService.warn('Redis client connection closed');
    });

    this.client.on('reconnecting', (delay) => {
      this.reconnectAttempts++;
      loggingService.info('Redis client reconnecting', { delay, attempts: this.reconnectAttempts });
      
      if (this.reconnectAttempts > this.maxReconnectAttempts) {
        loggingService.error('Redis max reconnection attempts exceeded');
        monitoring.incrementCounter('redis_connection_failures_total', 1);
      }
    });

    // Subscriber events
    this.subscriber.on('connect', () => {
      loggingService.info('Redis subscriber connected');
    });

    this.subscriber.on('error', (error) => {
      loggingService.error('Redis subscriber error', error);
    });

    // Publisher events
    this.publisher.on('connect', () => {
      loggingService.info('Redis publisher connected');
    });

    this.publisher.on('error', (error) => {
      loggingService.error('Redis publisher error', error);
    });
  }

  /**
   * Setup health monitoring for Redis
   */
  private setupHealthMonitoring(): void {
    // Monitor Redis health every 30 seconds
    setInterval(async () => {
      try {
        const startTime = Date.now();
        await this.client.ping();
        const latency = Date.now() - startTime;
        
        monitoring.recordHistogram('redis_ping_duration', latency);
        monitoring.setGauge('redis_connection_status', this.isConnected ? 1 : 0);
        
        // Update cache statistics
        await this.updateCacheStatistics();
        
      } catch (error) {
        loggingService.error('Redis health check failed', error);
        monitoring.incrementCounter('redis_health_check_failures_total', 1);
      }
    }, 30000);
  }

  /**
   * Initialize cache statistics
   */
  private initializeStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
      memoryUsage: 0,
      evictions: 0,
      operations: {
        get: 0,
        set: 0,
        delete: 0,
        expire: 0
      },
      patterns: Object.values(CachePattern).reduce((acc, pattern) => {
        acc[pattern] = { count: 0, hitRate: 0, avgSize: 0 };
        return acc;
      }, {} as any)
    };
  }

  /**
   * Generate cache key with pattern and metadata
   */
  private generateKey(pattern: CachePattern, identifier: string, tags?: string[]): string {
    const timestamp = Date.now();
    const tagSuffix = tags && tags.length > 0 ? `:${tags.join(':')}` : '';
    return `${pattern}:${identifier}${tagSuffix}`;
  }

  /**
   * Serialize data with compression and encryption if enabled
   */
  private async serializeData(data: any): Promise<string> {
    try {
      let serialized = JSON.stringify(data);
      
      if (this.config.compression) {
        const zlib = require('zlib');
        const compressed = await promisify(zlib.gzip)(serialized);
        serialized = compressed.toString('base64');
      }
      
      if (this.config.encryption) {
        const crypto = require('crypto');
        const algorithm = 'aes-256-gcm';
        const key = process.env.REDIS_ENCRYPTION_KEY || 'defaultkey1234567890123456789012';
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(algorithm, key);
        
        let encrypted = cipher.update(serialized, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        serialized = `${iv.toString('hex')}:${encrypted}`;
      }
      
      return serialized;
    } catch (error) {
      loggingService.error('Failed to serialize cache data', error);
      throw error;
    }
  }

  /**
   * Deserialize data with decompression and decryption if enabled
   */
  private async deserializeData(serialized: string): Promise<any> {
    try {
      let data = serialized;
      
      if (this.config.encryption) {
        const crypto = require('crypto');
        const algorithm = 'aes-256-gcm';
        const key = process.env.REDIS_ENCRYPTION_KEY || 'defaultkey1234567890123456789012';
        const [ivHex, encrypted] = data.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipher(algorithm, key);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        data = decrypted;
      }
      
      if (this.config.compression) {
        const zlib = require('zlib');
        const buffer = Buffer.from(data, 'base64');
        const decompressed = await promisify(zlib.gunzip)(buffer);
        data = decompressed.toString();
      }
      
      return JSON.parse(data);
    } catch (error) {
      loggingService.error('Failed to deserialize cache data', error);
      throw error;
    }
  }

  /**
   * Get data from cache with comprehensive metrics
   */
  public async get<T>(
    pattern: CachePattern,
    key: string,
    tags?: string[]
  ): Promise<T | null> {
    const timer = monitoring.startTimer('redis_get_duration');
    
    try {
      const cacheKey = this.generateKey(pattern, key, tags);
      const serializedData = await this.client.get(cacheKey);
      
      this.stats.operations.get++;
      
      if (serializedData === null) {
        this.stats.misses++;
        this.stats.patterns[pattern].hitRate = this.calculateHitRate(pattern);
        
        monitoring.incrementCounter('redis_cache_misses_total', 1, { pattern });
        timer();
        return null;
      }
      
      const data = await this.deserializeData(serializedData);
      
      // Update access metadata
      await this.updateAccessMetadata(cacheKey);
      
      this.stats.hits++;
      this.stats.hitRate = this.stats.hits / (this.stats.hits + this.stats.misses);
      this.stats.patterns[pattern].hitRate = this.calculateHitRate(pattern);
      
      monitoring.incrementCounter('redis_cache_hits_total', 1, { pattern });
      timer();
      
      loggingService.debug('Cache hit', { pattern, key: cacheKey });
      return data;
      
    } catch (error) {
      timer();
      loggingService.error('Failed to get from cache', error, { pattern, key });
      monitoring.incrementCounter('redis_operation_errors_total', 1, { operation: 'get' });
      return null;
    }
  }

  /**
   * Set data in cache with advanced options
   */
  public async set<T>(
    pattern: CachePattern,
    key: string,
    data: T,
    options?: {
      ttl?: number;
      tags?: string[];
      dependencies?: string[];
      strategy?: CacheStrategy;
      version?: number;
    }
  ): Promise<boolean> {
    const timer = monitoring.startTimer('redis_set_duration');
    
    try {
      const cacheKey = this.generateKey(pattern, key, options?.tags);
      const serializedData = await this.serializeData(data);
      const ttl = options?.ttl || this.config.defaultTTL;
      
      // Create metadata
      const metadata: CacheMetadata = {
        key: cacheKey,
        pattern,
        strategy: options?.strategy || CacheStrategy.CACHE_ASIDE,
        ttl,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        size: serializedData.length,
        tags: options?.tags || [],
        dependencies: options?.dependencies || [],
        version: options?.version || 1
      };
      
      // Use Redis pipeline for atomic operations
      const pipeline = this.client.pipeline();
      pipeline.setex(cacheKey, ttl, serializedData);
      pipeline.setex(`${cacheKey}:metadata`, ttl, JSON.stringify(metadata));
      
      // Add to pattern index
      pipeline.sadd(`pattern:${pattern}`, cacheKey);
      
      // Add tags for cache invalidation
      if (options?.tags) {
        for (const tag of options.tags) {
          pipeline.sadd(`tag:${tag}`, cacheKey);
          pipeline.expire(`tag:${tag}`, ttl);
        }
      }
      
      // Add dependencies for cascading invalidation
      if (options?.dependencies) {
        for (const dep of options.dependencies) {
          pipeline.sadd(`dep:${dep}`, cacheKey);
          pipeline.expire(`dep:${dep}`, ttl);
        }
      }
      
      await pipeline.exec();
      
      this.stats.operations.set++;
      this.stats.patterns[pattern].count++;
      
      monitoring.incrementCounter('redis_cache_sets_total', 1, { pattern });
      monitoring.recordHistogram('redis_cache_entry_size', serializedData.length);
      timer();
      
      loggingService.debug('Cache set', { 
        pattern, 
        key: cacheKey, 
        size: serializedData.length,
        ttl 
      });
      
      return true;
      
    } catch (error) {
      timer();
      loggingService.error('Failed to set cache', error, { pattern, key });
      monitoring.incrementCounter('redis_operation_errors_total', 1, { operation: 'set' });
      return false;
    }
  }

  /**
   * Delete from cache with cascade support
   */
  public async delete(
    pattern: CachePattern,
    key: string,
    options?: {
      tags?: string[];
      cascade?: boolean;
    }
  ): Promise<boolean> {
    const timer = monitoring.startTimer('redis_delete_duration');
    
    try {
      const cacheKey = this.generateKey(pattern, key, options?.tags);
      
      const pipeline = this.client.pipeline();
      pipeline.del(cacheKey);
      pipeline.del(`${cacheKey}:metadata`);
      pipeline.srem(`pattern:${pattern}`, cacheKey);
      
      // Remove from tag indices
      if (options?.tags) {
        for (const tag of options.tags) {
          pipeline.srem(`tag:${tag}`, cacheKey);
        }
      }
      
      // Cascade delete if requested
      if (options?.cascade) {
        const dependentKeys = await this.client.smembers(`dep:${cacheKey}`);
        for (const depKey of dependentKeys) {
          pipeline.del(depKey);
          pipeline.del(`${depKey}:metadata`);
        }
        pipeline.del(`dep:${cacheKey}`);
      }
      
      await pipeline.exec();
      
      this.stats.operations.delete++;
      monitoring.incrementCounter('redis_cache_deletes_total', 1, { pattern });
      timer();
      
      loggingService.debug('Cache delete', { pattern, key: cacheKey, cascade: options?.cascade });
      return true;
      
    } catch (error) {
      timer();
      loggingService.error('Failed to delete from cache', error, { pattern, key });
      monitoring.incrementCounter('redis_operation_errors_total', 1, { operation: 'delete' });
      return false;
    }
  }

  /**
   * Invalidate cache by pattern or tags
   */
  public async invalidate(options: {
    pattern?: CachePattern;
    tags?: string[];
    dependencies?: string[];
    prefix?: string;
  }): Promise<number> {
    const timer = monitoring.startTimer('redis_invalidate_duration');
    
    try {
      let keysToDelete: string[] = [];
      
      if (options.pattern) {
        const patternKeys = await this.client.smembers(`pattern:${options.pattern}`);
        keysToDelete.push(...patternKeys);
      }
      
      if (options.tags) {
        for (const tag of options.tags) {
          const tagKeys = await this.client.smembers(`tag:${tag}`);
          keysToDelete.push(...tagKeys);
        }
      }
      
      if (options.dependencies) {
        for (const dep of options.dependencies) {
          const depKeys = await this.client.smembers(`dep:${dep}`);
          keysToDelete.push(...depKeys);
        }
      }
      
      if (options.prefix) {
        const keys = await this.client.keys(`${this.config.keyPrefix}${options.prefix}*`);
        keysToDelete.push(...keys.map(k => k.replace(this.config.keyPrefix, '')));
      }
      
      // Remove duplicates
      keysToDelete = Array.from(new Set(keysToDelete));
      
      if (keysToDelete.length === 0) {
        timer();
        return 0;
      }
      
      // Delete keys in batches to avoid blocking Redis
      const batchSize = 100;
      let deletedCount = 0;
      
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize);
        const pipeline = this.client.pipeline();
        
        for (const key of batch) {
          pipeline.del(key);
          pipeline.del(`${key}:metadata`);
        }
        
        const results = await pipeline.exec();
        deletedCount += results?.filter(([err, result]) => !err && result === 1).length || 0;
      }
      
      monitoring.incrementCounter('redis_cache_invalidations_total', 1);
      monitoring.recordHistogram('redis_invalidation_keys_count', deletedCount);
      timer();
      
      loggingService.info('Cache invalidated', { 
        ...options, 
        keysDeleted: deletedCount 
      });
      
      return deletedCount;
      
    } catch (error) {
      timer();
      loggingService.error('Failed to invalidate cache', error, options);
      monitoring.incrementCounter('redis_operation_errors_total', 1, { operation: 'invalidate' });
      return 0;
    }
  }

  /**
   * Distributed locking for critical sections
   */
  public async acquireLock(
    lockKey: string,
    ttl: number = 30000,
    retryCount: number = 3,
    retryDelay: number = 100
  ): Promise<string | null> {
    const lockId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const key = this.generateKey(CachePattern.DISTRIBUTED_LOCK, lockKey);
    
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        const result = await this.client.set(key, lockId, 'PX', ttl, 'NX');
        
        if (result === 'OK') {
          monitoring.incrementCounter('redis_locks_acquired_total', 1);
          loggingService.debug('Lock acquired', { lockKey, lockId, ttl });
          return lockId;
        }
        
        if (attempt < retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
      } catch (error) {
        loggingService.error('Failed to acquire lock', error, { lockKey, attempt });
      }
    }
    
    monitoring.incrementCounter('redis_lock_acquisition_failures_total', 1);
    return null;
  }

  /**
   * Release distributed lock
   */
  public async releaseLock(lockKey: string, lockId: string): Promise<boolean> {
    const key = this.generateKey(CachePattern.DISTRIBUTED_LOCK, lockKey);
    
    try {
      // Lua script for atomic lock release
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.client.eval(script, 1, key, lockId);
      
      const released = result === 1;
      
      monitoring.incrementCounter('redis_locks_released_total', 1, { 
        success: released.toString() 
      });
      
      loggingService.debug('Lock release attempt', { lockKey, lockId, released });
      return released;
      
    } catch (error) {
      loggingService.error('Failed to release lock', error, { lockKey, lockId });
      monitoring.incrementCounter('redis_lock_release_failures_total', 1);
      return false;
    }
  }

  /**
   * Cache-aside pattern with automatic refresh
   */
  public async cacheAside<T>(
    pattern: CachePattern,
    key: string,
    fetchFunction: () => Promise<T>,
    options?: {
      ttl?: number;
      tags?: string[];
      refreshThreshold?: number; // Percentage of TTL at which to trigger refresh
    }
  ): Promise<T> {
    const timer = monitoring.startTimer('redis_cache_aside_duration');
    
    try {
      // Try to get from cache first
      const cached = await this.get<T>(pattern, key, options?.tags);
      
      if (cached !== null) {
        // Check if refresh is needed (refresh-ahead pattern)
        if (options?.refreshThreshold) {
          const metadata = await this.getCacheMetadata(pattern, key, options.tags);
          if (metadata && this.shouldRefresh(metadata, options.refreshThreshold)) {
            // Trigger background refresh
            setImmediate(async () => {
              try {
                const fresh = await fetchFunction();
                await this.set(pattern, key, fresh, {
                  ttl: options?.ttl,
                  tags: options?.tags,
                  strategy: CacheStrategy.REFRESH_AHEAD
                });
              } catch (error) {
                loggingService.error('Background refresh failed', error, { pattern, key });
              }
            });
          }
        }
        
        timer();
        return cached;
      }
      
      // Cache miss - fetch from source
      const fresh = await fetchFunction();
      
      // Store in cache
      await this.set(pattern, key, fresh, {
        ttl: options?.ttl,
        tags: options?.tags,
        strategy: CacheStrategy.CACHE_ASIDE
      });
      
      timer();
      return fresh;
      
    } catch (error) {
      timer();
      loggingService.error('Cache-aside operation failed', error, { pattern, key });
      monitoring.incrementCounter('redis_cache_aside_errors_total', 1);
      
      // Fallback to direct fetch
      return await fetchFunction();
    }
  }

  /**
   * Pub/Sub for real-time cache invalidation
   */
  public async publish(channel: string, message: any): Promise<number> {
    try {
      const serialized = JSON.stringify(message);
      const subscribers = await this.publisher.publish(channel, serialized);
      
      monitoring.incrementCounter('redis_messages_published_total', 1, { channel });
      return subscribers;
      
    } catch (error) {
      loggingService.error('Failed to publish message', error, { channel });
      monitoring.incrementCounter('redis_publish_errors_total', 1);
      return 0;
    }
  }

  /**
   * Subscribe to cache invalidation events
   */
  public async subscribe(
    channels: string | string[],
    callback: (channel: string, message: any) => void
  ): Promise<void> {
    try {
      await this.subscriber.subscribe(channels);
      
      this.subscriber.on('message', (channel: string, message: string) => {
        try {
          const parsed = JSON.parse(message);
          callback(channel, parsed);
          monitoring.incrementCounter('redis_messages_received_total', 1, { channel });
        } catch (error) {
          loggingService.error('Failed to parse pub/sub message', error, { channel });
        }
      });
      
      loggingService.info('Subscribed to Redis channels', { channels });
      
    } catch (error) {
      loggingService.error('Failed to subscribe to channels', error, { channels });
      throw error;
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  public async getStats(): Promise<CacheStats> {
    try {
      await this.updateCacheStatistics();
      return { ...this.stats };
    } catch (error) {
      loggingService.error('Failed to get cache statistics', error);
      return this.stats;
    }
  }

  /**
   * Health check for Redis service
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    memoryUsage: number;
    connectedClients: number;
    keyspaceInfo: any;
  }> {
    try {
      const startTime = Date.now();
      await this.client.ping();
      const latency = Date.now() - startTime;
      
      const info = await this.client.info();
      const lines = info.split('\r\n');
      
      const memoryUsage = this.parseInfoLine(lines, 'used_memory:');
      const connectedClients = this.parseInfoLine(lines, 'connected_clients:');
      const keyspaceInfo = this.parseKeyspaceInfo(lines);
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      
      if (latency > 1000 || !this.isConnected) {
        status = 'unhealthy';
      } else if (latency > 100 || memoryUsage > 1000000000) { // 1GB
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      return {
        status,
        latency,
        memoryUsage,
        connectedClients,
        keyspaceInfo
      };
      
    } catch (error) {
      loggingService.error('Redis health check failed', error);
      return {
        status: 'unhealthy',
        latency: -1,
        memoryUsage: -1,
        connectedClients: -1,
        keyspaceInfo: {}
      };
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    try {
      loggingService.info('Shutting down Redis service');
      
      await Promise.all([
        this.client.quit(),
        this.subscriber.quit(),
        this.publisher.quit()
      ]);
      
      this.isConnected = false;
      loggingService.info('Redis service shut down successfully');
      
    } catch (error) {
      loggingService.error('Error during Redis shutdown', error);
    }
  }

  // Private helper methods
  private async updateAccessMetadata(cacheKey: string): Promise<void> {
    try {
      const metadataKey = `${cacheKey}:metadata`;
      const metadata = await this.client.get(metadataKey);
      
      if (metadata) {
        const parsed: CacheMetadata = JSON.parse(metadata);
        parsed.lastAccessed = new Date();
        parsed.accessCount++;
        
        await this.client.setex(metadataKey, parsed.ttl, JSON.stringify(parsed));
      }
    } catch (error) {
      // Silently fail for metadata updates
    }
  }

  private async getCacheMetadata(
    pattern: CachePattern,
    key: string,
    tags?: string[]
  ): Promise<CacheMetadata | null> {
    try {
      const cacheKey = this.generateKey(pattern, key, tags);
      const metadataKey = `${cacheKey}:metadata`;
      const metadata = await this.client.get(metadataKey);
      
      return metadata ? JSON.parse(metadata) : null;
    } catch (error) {
      return null;
    }
  }

  private shouldRefresh(metadata: CacheMetadata, threshold: number): boolean {
    const now = Date.now();
    const created = metadata.createdAt.getTime();
    const ttlMs = metadata.ttl * 1000;
    const elapsed = now - created;
    const percentageElapsed = (elapsed / ttlMs) * 100;
    
    return percentageElapsed >= threshold;
  }

  private calculateHitRate(pattern: CachePattern): number {
    const patternStats = this.stats.patterns[pattern];
    const total = patternStats.count;
    const hits = total * (patternStats.hitRate || 0);
    
    return total > 0 ? hits / total : 0;
  }

  private async updateCacheStatistics(): Promise<void> {
    try {
      const info = await this.client.info('stats');
      const lines = info.split('\r\n');
      
      this.stats.totalKeys = this.parseInfoLine(lines, 'keyspace_hits:') + this.parseInfoLine(lines, 'keyspace_misses:');
      this.stats.memoryUsage = this.parseInfoLine(lines, 'used_memory:');
      this.stats.evictions = this.parseInfoLine(lines, 'evicted_keys:');
      
    } catch (error) {
      // Silently fail for statistics updates
    }
  }

  private parseInfoLine(lines: string[], key: string): number {
    const line = lines.find(l => l.startsWith(key));
    return line ? parseInt(line.split(':')[1]) || 0 : 0;
  }

  private parseKeyspaceInfo(lines: string[]): any {
    const keyspaceLines = lines.filter(l => l.startsWith('db'));
    const keyspaceInfo: any = {};
    
    for (const line of keyspaceLines) {
      const [db, info] = line.split(':');
      const stats = info.split(',').reduce((acc, stat) => {
        const [key, value] = stat.split('=');
        acc[key] = parseInt(value) || 0;
        return acc;
      }, {} as any);
      
      keyspaceInfo[db] = stats;
    }
    
    return keyspaceInfo;
  }
}

// Export singleton instance
export const redisService = new RedisService();

// Export types and enums
export {
  CacheStrategy,
  CachePattern,
  CacheConfig,
  CacheMetadata,
  CacheStats
};

export default redisService;