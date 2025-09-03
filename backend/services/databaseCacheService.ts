/**
 * Database Query Result Caching Service
 * Provides intelligent caching for database queries with automatic invalidation
 */

import { Model, Document, FilterQuery, QueryOptions, UpdateQuery } from 'mongoose';
import { redisService, CachePattern, CacheStrategy } from './redisService';
import loggingService from './loggingService';
import { monitoring } from './monitoringService';
import crypto from 'crypto';

// Query cache configuration
interface QueryCacheConfig {
  enabled: boolean;
  defaultTTL: number;
  maxQueryComplexity: number;
  cacheThreshold: number; // Minimum execution time to cache (ms)
  enableStatistics: boolean;
  autoInvalidation: boolean;
  compressionEnabled: boolean;
  keyPrefix: string;
}

// Cache key metadata
interface CacheKeyMetadata {
  query: string;
  model: string;
  params: any;
  hash: string;
  complexity: number;
  executionTime?: number;
  resultSize?: number;
  createdAt: Date;
  accessCount: number;
  lastAccessed: Date;
  tags: string[];
  dependencies: string[];
}

// Query statistics
interface QueryStats {
  totalQueries: number;
  cachedQueries: number;
  cacheHitRate: number;
  averageExecutionTime: number;
  averageCacheTime: number;
  totalCacheSavings: number;
  topCachedQueries: Array<{
    query: string;
    hitCount: number;
    averageTime: number;
    totalSavings: number;
  }>;
  modelStats: Record<string, {
    queryCount: number;
    hitRate: number;
    averageTime: number;
  }>;
}

// Query complexity analyzer
class QueryComplexityAnalyzer {
  /**
   * Analyze query complexity to determine cacheability
   */
  static analyzeComplexity(query: any, options?: any): {
    score: number;
    factors: string[];
    cacheable: boolean;
  } {
    let score = 0;
    const factors: string[] = [];

    // Basic query complexity
    if (query) {
      const queryString = JSON.stringify(query);
      score += Math.min(queryString.length / 100, 50); // Max 50 points for query size
      
      // Check for complex operators
      if (queryString.includes('$regex')) {
        score += 30;
        factors.push('regex_search');
      }
      
      if (queryString.includes('$text')) {
        score += 25;
        factors.push('text_search');
      }
      
      if (queryString.includes('$geoNear') || queryString.includes('$near')) {
        score += 40;
        factors.push('geo_query');
      }
      
      if (queryString.includes('$lookup')) {
        score += 35;
        factors.push('aggregation_lookup');
      }
      
      if (queryString.includes('$group')) {
        score += 30;
        factors.push('aggregation_group');
      }
    }

    // Options complexity
    if (options) {
      if (options.sort) {
        score += 10;
        factors.push('sorting');
      }
      
      if (options.populate) {
        score += 20;
        factors.push('population');
      }
      
      if (options.limit && options.limit > 1000) {
        score += 15;
        factors.push('large_limit');
      }
    }

    return {
      score,
      factors,
      cacheable: score >= 10 && score <= 200 // Cache medium complexity queries
    };
  }
}

// Intelligent cache invalidation
class CacheInvalidationManager {
  private static dependencyMap = new Map<string, Set<string>>();
  
  /**
   * Register cache dependencies for automatic invalidation
   */
  static registerDependency(cacheKey: string, dependency: string): void {
    if (!this.dependencyMap.has(dependency)) {
      this.dependencyMap.set(dependency, new Set());
    }
    this.dependencyMap.get(dependency)!.add(cacheKey);
  }
  
  /**
   * Invalidate caches based on model changes
   */
  static async invalidateByModel(modelName: string, operation: 'create' | 'update' | 'delete', documentId?: string): Promise<void> {
    try {
      const patterns = [
        `${modelName}:*`,
        `${modelName.toLowerCase()}:*`
      ];
      
      if (documentId) {
        patterns.push(`*:${documentId}:*`);
      }
      
      for (const pattern of patterns) {
        await redisService.invalidate({ prefix: pattern });
      }
      
      // Invalidate dependent caches
      const dependency = `model:${modelName}`;
      const dependentKeys = this.dependencyMap.get(dependency);
      
      if (dependentKeys) {
        for (const key of dependentKeys) {
          await redisService.delete(CachePattern.QUERY_RESULT, key);
        }
      }
      
      loggingService.debug('Cache invalidated for model changes', {
        modelName,
        operation,
        documentId,
        invalidatedPatterns: patterns.length
      });
      
    } catch (error) {
      loggingService.error('Failed to invalidate cache by model', error, {
        modelName,
        operation,
        documentId
      });
    }
  }
  
  /**
   * Invalidate caches based on field changes
   */
  static async invalidateByFields(modelName: string, fields: string[]): Promise<void> {
    try {
      for (const field of fields) {
        const pattern = `${modelName}:*:${field}:*`;
        await redisService.invalidate({ prefix: pattern });
      }
      
      loggingService.debug('Cache invalidated for field changes', {
        modelName,
        fields
      });
      
    } catch (error) {
      loggingService.error('Failed to invalidate cache by fields', error, {
        modelName,
        fields
      });
    }
  }
}

// Main database cache service
export class DatabaseCacheService {
  private config: QueryCacheConfig;
  private stats: QueryStats;
  private queryMetadata = new Map<string, CacheKeyMetadata>();

  constructor() {
    this.config = this.loadConfig();
    this.stats = this.initializeStats();
    this.setupMonitoring();
  }

  /**
   * Load cache configuration
   */
  private loadConfig(): QueryCacheConfig {
    return {
      enabled: process.env.DB_CACHE_ENABLED !== 'false',
      defaultTTL: parseInt(process.env.DB_CACHE_TTL || '600'), // 10 minutes
      maxQueryComplexity: parseInt(process.env.DB_CACHE_MAX_COMPLEXITY || '200'),
      cacheThreshold: parseInt(process.env.DB_CACHE_THRESHOLD || '50'), // 50ms
      enableStatistics: process.env.DB_CACHE_STATS === 'true',
      autoInvalidation: process.env.DB_CACHE_AUTO_INVALIDATION !== 'false',
      compressionEnabled: process.env.DB_CACHE_COMPRESSION === 'true',
      keyPrefix: process.env.DB_CACHE_KEY_PREFIX || 'dbcache'
    };
  }

  /**
   * Initialize statistics
   */
  private initializeStats(): QueryStats {
    return {
      totalQueries: 0,
      cachedQueries: 0,
      cacheHitRate: 0,
      averageExecutionTime: 0,
      averageCacheTime: 0,
      totalCacheSavings: 0,
      topCachedQueries: [],
      modelStats: {}
    };
  }

  /**
   * Cache database query result with intelligent caching strategy
   */
  async cacheQuery<T>(
    model: Model<any>,
    queryType: 'find' | 'findOne' | 'aggregate' | 'count',
    query: FilterQuery<T>,
    options?: QueryOptions,
    customTTL?: number
  ): Promise<{
    execute: () => Promise<T>;
    fromCache: boolean;
    executionTime: number;
  }> {
    const timer = monitoring.startTimer('db_cache_operation_duration');
    
    try {
      if (!this.config.enabled) {
        return {
          execute: () => this.executeQuery(model, queryType, query, options),
          fromCache: false,
          executionTime: 0
        };
      }

      // Analyze query complexity
      const complexity = QueryComplexityAnalyzer.analyzeComplexity(query, options);
      
      if (!complexity.cacheable || complexity.score > this.config.maxQueryComplexity) {
        loggingService.debug('Query not cacheable', {
          model: model.modelName,
          complexity: complexity.score,
          factors: complexity.factors
        });
        
        return {
          execute: () => this.executeQuery(model, queryType, query, options),
          fromCache: false,
          executionTime: 0
        };
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(model.modelName, queryType, query, options);
      
      // Try to get from cache
      const startTime = Date.now();
      const cached = await redisService.get<T>(CachePattern.QUERY_RESULT, cacheKey);
      const cacheTime = Date.now() - startTime;

      if (cached !== null) {
        // Cache hit
        this.updateHitStatistics(model.modelName, cacheTime);
        timer();
        
        monitoring.incrementCounter('db_cache_hits_total', 1, {
          model: model.modelName,
          queryType
        });

        return {
          execute: async () => cached,
          fromCache: true,
          executionTime: cacheTime
        };
      }

      // Cache miss - execute query and cache result
      return {
        execute: async () => {
          const execStartTime = Date.now();
          const result = await this.executeQuery(model, queryType, query, options);
          const executionTime = Date.now() - execStartTime;

          // Only cache if execution time meets threshold
          if (executionTime >= this.config.cacheThreshold) {
            await this.cacheResult(
              cacheKey,
              result,
              model.modelName,
              queryType,
              query,
              options,
              customTTL || this.config.defaultTTL,
              complexity,
              executionTime
            );
          }

          this.updateMissStatistics(model.modelName, executionTime);
          timer();
          
          monitoring.incrementCounter('db_cache_misses_total', 1, {
            model: model.modelName,
            queryType
          });

          return result;
        },
        fromCache: false,
        executionTime: 0
      };

    } catch (error) {
      timer();
      loggingService.error('Database cache operation failed', error, {
        model: model.modelName,
        queryType
      });
      
      monitoring.incrementCounter('db_cache_errors_total', 1);
      
      return {
        execute: () => this.executeQuery(model, queryType, query, options),
        fromCache: false,
        executionTime: 0
      };
    }
  }

  /**
   * Cached find operation
   */
  async find<T>(
    model: Model<T>,
    query: FilterQuery<T>,
    options?: QueryOptions,
    ttl?: number
  ): Promise<T[]> {
    const operation = await this.cacheQuery(model, 'find', query, options, ttl);
    return operation.execute() as Promise<T[]>;
  }

  /**
   * Cached findOne operation
   */
  async findOne<T>(
    model: Model<T>,
    query: FilterQuery<T>,
    options?: QueryOptions,
    ttl?: number
  ): Promise<T | null> {
    const operation = await this.cacheQuery(model, 'findOne', query, options, ttl);
    return operation.execute() as Promise<T | null>;
  }

  /**
   * Cached count operation
   */
  async count<T>(
    model: Model<T>,
    query: FilterQuery<T>,
    ttl?: number
  ): Promise<number> {
    const operation = await this.cacheQuery(model, 'count', query, undefined, ttl);
    return operation.execute() as Promise<number>;
  }

  /**
   * Cached aggregate operation
   */
  async aggregate<T>(
    model: Model<any>,
    pipeline: any[],
    ttl?: number
  ): Promise<T[]> {
    const operation = await this.cacheQuery(model, 'aggregate', { pipeline }, undefined, ttl);
    return operation.execute() as Promise<T[]>;
  }

  /**
   * Invalidate cache for model operations
   */
  async invalidateModel(
    modelName: string,
    operation: 'create' | 'update' | 'delete',
    documentId?: string,
    fields?: string[]
  ): Promise<void> {
    if (!this.config.autoInvalidation) {
      return;
    }

    await CacheInvalidationManager.invalidateByModel(modelName, operation, documentId);
    
    if (fields && fields.length > 0) {
      await CacheInvalidationManager.invalidateByFields(modelName, fields);
    }
  }

  /**
   * Manual cache invalidation
   */
  async invalidateCache(pattern?: string, tags?: string[]): Promise<number> {
    try {
      const invalidated = await redisService.invalidate({
        pattern: pattern ? CachePattern.QUERY_RESULT : undefined,
        prefix: pattern,
        tags
      });

      loggingService.info('Manual cache invalidation completed', {
        pattern,
        tags,
        invalidated
      });

      return invalidated;

    } catch (error) {
      loggingService.error('Manual cache invalidation failed', error, {
        pattern,
        tags
      });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStatistics(): Promise<QueryStats> {
    if (this.config.enableStatistics) {
      await this.updateStatistics();
    }
    return { ...this.stats };
  }

  /**
   * Get query metadata for analysis
   */
  getQueryMetadata(): CacheKeyMetadata[] {
    return Array.from(this.queryMetadata.values());
  }

  /**
   * Warm cache with frequently used queries
   */
  async warmCache(queries: Array<{
    model: Model<any>;
    queryType: 'find' | 'findOne' | 'aggregate' | 'count';
    query: any;
    options?: any;
  }>): Promise<void> {
    loggingService.info('Starting cache warming', { queriesCount: queries.length });

    const promises = queries.map(async ({ model, queryType, query, options }) => {
      try {
        const operation = await this.cacheQuery(model, queryType, query, options);
        await operation.execute();
      } catch (error) {
        loggingService.warn('Cache warming failed for query', error, {
          model: model.modelName,
          queryType
        });
      }
    });

    await Promise.allSettled(promises);
    loggingService.info('Cache warming completed');
  }

  // Private methods

  private generateCacheKey(
    modelName: string,
    queryType: string,
    query: any,
    options?: any
  ): string {
    const keyData = {
      model: modelName,
      type: queryType,
      query,
      options: options ? {
        sort: options.sort,
        limit: options.limit,
        skip: options.skip,
        select: options.select,
        populate: options.populate
      } : undefined
    };

    const keyString = JSON.stringify(keyData);
    const hash = crypto.createHash('md5').update(keyString).digest('hex');
    
    return `${this.config.keyPrefix}:${modelName}:${queryType}:${hash}`;
  }

  private async executeQuery<T>(
    model: Model<any>,
    queryType: 'find' | 'findOne' | 'aggregate' | 'count',
    query: FilterQuery<T>,
    options?: QueryOptions
  ): Promise<T> {
    switch (queryType) {
      case 'find':
        return model.find(query, undefined, options).lean().exec() as Promise<T>;
      case 'findOne':
        return model.findOne(query, undefined, options).lean().exec() as Promise<T>;
      case 'count':
        return model.countDocuments(query).exec() as Promise<T>;
      case 'aggregate':
        const pipeline = (query as any).pipeline;
        return model.aggregate(pipeline).exec() as Promise<T>;
      default:
        throw new Error(`Unsupported query type: ${queryType}`);
    }
  }

  private async cacheResult<T>(
    cacheKey: string,
    result: T,
    modelName: string,
    queryType: string,
    query: any,
    options: any,
    ttl: number,
    complexity: any,
    executionTime: number
  ): Promise<void> {
    try {
      // Calculate result size
      const resultSize = JSON.stringify(result).length;
      
      // Create metadata
      const metadata: CacheKeyMetadata = {
        query: JSON.stringify(query),
        model: modelName,
        params: options,
        hash: cacheKey,
        complexity: complexity.score,
        executionTime,
        resultSize,
        createdAt: new Date(),
        accessCount: 0,
        lastAccessed: new Date(),
        tags: [`model:${modelName}`, `type:${queryType}`],
        dependencies: [`model:${modelName}`]
      };

      // Cache the result
      await redisService.set(
        CachePattern.QUERY_RESULT,
        cacheKey,
        result,
        {
          ttl,
          tags: metadata.tags,
          dependencies: metadata.dependencies,
          strategy: CacheStrategy.CACHE_ASIDE
        }
      );

      // Store metadata
      this.queryMetadata.set(cacheKey, metadata);

      // Register dependencies
      for (const dep of metadata.dependencies) {
        CacheInvalidationManager.registerDependency(cacheKey, dep);
      }

      monitoring.recordHistogram('db_cache_result_size', resultSize);
      monitoring.recordHistogram('db_cache_execution_time', executionTime);

    } catch (error) {
      loggingService.error('Failed to cache query result', error, {
        cacheKey,
        modelName,
        queryType
      });
    }
  }

  private updateHitStatistics(modelName: string, cacheTime: number): void {
    this.stats.cachedQueries++;
    this.stats.averageCacheTime = 
      (this.stats.averageCacheTime + cacheTime) / this.stats.cachedQueries;
    
    if (!this.stats.modelStats[modelName]) {
      this.stats.modelStats[modelName] = {
        queryCount: 0,
        hitRate: 0,
        averageTime: 0
      };
    }
    
    const modelStats = this.stats.modelStats[modelName];
    modelStats.queryCount++;
    modelStats.averageTime = (modelStats.averageTime + cacheTime) / modelStats.queryCount;
    
    this.updateHitRate();
  }

  private updateMissStatistics(modelName: string, executionTime: number): void {
    this.stats.totalQueries++;
    this.stats.averageExecutionTime = 
      (this.stats.averageExecutionTime + executionTime) / this.stats.totalQueries;
    
    if (!this.stats.modelStats[modelName]) {
      this.stats.modelStats[modelName] = {
        queryCount: 0,
        hitRate: 0,
        averageTime: 0
      };
    }
    
    const modelStats = this.stats.modelStats[modelName];
    modelStats.queryCount++;
    modelStats.averageTime = (modelStats.averageTime + executionTime) / modelStats.queryCount;
    
    this.updateHitRate();
  }

  private updateHitRate(): void {
    this.stats.cacheHitRate = this.stats.totalQueries > 0 
      ? this.stats.cachedQueries / this.stats.totalQueries 
      : 0;
    
    // Update model hit rates
    Object.keys(this.stats.modelStats).forEach(modelName => {
      const modelStats = this.stats.modelStats[modelName];
      modelStats.hitRate = modelStats.queryCount > 0 
        ? this.stats.cachedQueries / modelStats.queryCount 
        : 0;
    });
  }

  private async updateStatistics(): Promise<void> {
    try {
      // Calculate cache savings
      this.stats.totalCacheSavings = 
        this.stats.cachedQueries * (this.stats.averageExecutionTime - this.stats.averageCacheTime);

      // Update top cached queries
      const sortedQueries = Array.from(this.queryMetadata.values())
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 10);

      this.stats.topCachedQueries = sortedQueries.map(metadata => ({
        query: metadata.query.substring(0, 100),
        hitCount: metadata.accessCount,
        averageTime: metadata.executionTime || 0,
        totalSavings: metadata.accessCount * ((metadata.executionTime || 0) - this.stats.averageCacheTime)
      }));

    } catch (error) {
      loggingService.error('Failed to update cache statistics', error);
    }
  }

  private setupMonitoring(): void {
    // Monitor cache performance every minute
    setInterval(async () => {
      try {
        monitoring.setGauge('db_cache_hit_rate', this.stats.cacheHitRate);
        monitoring.setGauge('db_cache_total_queries', this.stats.totalQueries);
        monitoring.setGauge('db_cache_cached_queries', this.stats.cachedQueries);
        monitoring.setGauge('db_cache_total_savings', this.stats.totalCacheSavings);
        
      } catch (error) {
        loggingService.error('Failed to update cache monitoring metrics', error);
      }
    }, 60000);
  }
}

// Export singleton instance
export const databaseCacheService = new DatabaseCacheService();

// Export helper decorators
export function CachedQuery(ttl?: number) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const modelName = this.constructor.modelName || this.constructor.name;
      
      try {
        // Extract query parameters
        const [query, options] = args;
        
        const operation = await databaseCacheService.cacheQuery(
          this,
          'find',
          query,
          options,
          ttl
        );
        
        return await operation.execute();
        
      } catch (error) {
        loggingService.warn('Cached query decorator failed, falling back to direct execution', error);
        return await method.apply(this, args);
      }
    };

    return descriptor;
  };
}

export default databaseCacheService;