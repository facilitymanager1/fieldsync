/**
 * Query Performance Monitoring Middleware
 * Tracks database query performance and provides optimization insights
 */

import { Request, Response, NextFunction } from 'express';
import { databaseCacheService } from '../services/databaseCacheService';
import { databaseIndexingService } from '../services/databaseIndexingService';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';
import mongoose from 'mongoose';

// Query performance metrics
interface QueryPerformanceMetrics {
  requestId: string;
  endpoint: string;
  method: string;
  userId?: string;
  startTime: number;
  endTime: number;
  duration: number;
  queries: Array<{
    model: string;
    operation: string;
    executionTime: number;
    fromCache: boolean;
    resultCount?: number;
    indexesUsed: string[];
    planSummary?: any;
  }>;
  totalQueries: number;
  cacheHitRate: number;
  dbConnectionTime: number;
}

// Slow query detection
interface SlowQueryAlert {
  query: any;
  model: string;
  executionTime: number;
  threshold: number;
  suggestions: string[];
  indexRecommendations: string[];
}

class QueryPerformanceTracker {
  private static activeRequests = new Map<string, QueryPerformanceMetrics>();
  private static slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'); // 1 second
  
  /**
   * Start tracking query performance for a request
   */
  static startTracking(req: Request): string {
    const requestId = (req as any).requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const user = (req as any).user;
    
    const metrics: QueryPerformanceMetrics = {
      requestId,
      endpoint: req.route?.path || req.path,
      method: req.method,
      userId: user?.id,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      queries: [],
      totalQueries: 0,
      cacheHitRate: 0,
      dbConnectionTime: 0
    };
    
    this.activeRequests.set(requestId, metrics);
    
    // Attach query interceptor to mongoose for this request
    this.attachQueryInterceptor(requestId);
    
    return requestId;
  }
  
  /**
   * Stop tracking and generate performance report
   */
  static stopTracking(requestId: string): QueryPerformanceMetrics | null {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) return null;
    
    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.totalQueries = metrics.queries.length;
    
    if (metrics.totalQueries > 0) {
      const cacheHits = metrics.queries.filter(q => q.fromCache).length;
      metrics.cacheHitRate = cacheHits / metrics.totalQueries;
    }
    
    // Clean up
    this.activeRequests.delete(requestId);
    
    // Generate performance insights
    this.analyzePerformance(metrics);
    
    return metrics;
  }
  
  /**
   * Record individual query performance
   */
  static recordQuery(requestId: string, queryData: {
    model: string;
    operation: string;
    executionTime: number;
    fromCache: boolean;
    resultCount?: number;
    query?: any;
  }): void {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) return;
    
    metrics.queries.push({
      model: queryData.model,
      operation: queryData.operation,
      executionTime: queryData.executionTime,
      fromCache: queryData.fromCache,
      resultCount: queryData.resultCount,
      indexesUsed: [], // Would be populated from explain() in production
      planSummary: undefined
    });
    
    // Check for slow queries
    if (queryData.executionTime > this.slowQueryThreshold && !queryData.fromCache) {
      this.handleSlowQuery(queryData, requestId);
    }
  }
  
  /**
   * Attach query interceptor to mongoose
   */
  private static attachQueryInterceptor(requestId: string): void {
    // Store original mongoose methods
    const originalExec = mongoose.Query.prototype.exec;
    const originalAggregate = mongoose.Aggregate.prototype.exec;
    
    // Override exec method
    mongoose.Query.prototype.exec = async function(this: any) {
      const startTime = Date.now();
      const modelName = this.model?.modelName || 'Unknown';
      const operation = this.op || 'unknown';
      
      try {
        const result = await originalExec.call(this);
        const executionTime = Date.now() - startTime;
        
        QueryPerformanceTracker.recordQuery(requestId, {
          model: modelName,
          operation,
          executionTime,
          fromCache: false,
          resultCount: Array.isArray(result) ? result.length : result ? 1 : 0,
          query: this.getQuery()
        });
        
        // Record query pattern for index optimization
        if (executionTime > 100) { // Only track queries > 100ms
          databaseIndexingService.recordQueryPattern(
            modelName,
            this.getQuery(),
            this.getOptions(),
            executionTime
          );
        }
        
        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        
        QueryPerformanceTracker.recordQuery(requestId, {
          model: modelName,
          operation,
          executionTime,
          fromCache: false,
          query: this.getQuery()
        });
        
        throw error;
      }
    };
    
    // Override aggregate exec method
    mongoose.Aggregate.prototype.exec = async function(this: any) {
      const startTime = Date.now();
      const modelName = this._model?.modelName || 'Unknown';
      
      try {
        const result = await originalAggregate.call(this);
        const executionTime = Date.now() - startTime;
        
        QueryPerformanceTracker.recordQuery(requestId, {
          model: modelName,
          operation: 'aggregate',
          executionTime,
          fromCache: false,
          resultCount: Array.isArray(result) ? result.length : result ? 1 : 0,
          query: this._pipeline
        });
        
        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        
        QueryPerformanceTracker.recordQuery(requestId, {
          model: modelName,
          operation: 'aggregate',
          executionTime,
          fromCache: false,
          query: this._pipeline
        });
        
        throw error;
      }
    };
    
    // Restore original methods after request completes
    setTimeout(() => {
      mongoose.Query.prototype.exec = originalExec;
      mongoose.Aggregate.prototype.exec = originalAggregate;
    }, 30000); // 30 second timeout
  }
  
  /**
   * Handle slow query detection
   */
  private static handleSlowQuery(queryData: any, requestId: string): void {
    const alert: SlowQueryAlert = {
      query: queryData.query,
      model: queryData.model,
      executionTime: queryData.executionTime,
      threshold: this.slowQueryThreshold,
      suggestions: this.generateOptimizationSuggestions(queryData),
      indexRecommendations: this.generateIndexRecommendations(queryData)
    };
    
    // Log slow query
    loggingService.warn('Slow query detected', {
      requestId,
      model: queryData.model,
      operation: queryData.operation,
      executionTime: queryData.executionTime,
      threshold: this.slowQueryThreshold,
      suggestions: alert.suggestions
    });
    
    // Record monitoring metric
    monitoring.incrementCounter('slow_queries_total', 1, {
      model: queryData.model,
      operation: queryData.operation
    });
    
    monitoring.recordHistogram('slow_query_duration', queryData.executionTime);
  }
  
  /**
   * Generate optimization suggestions
   */
  private static generateOptimizationSuggestions(queryData: any): string[] {
    const suggestions: string[] = [];
    
    if (queryData.query) {
      const queryString = JSON.stringify(queryData.query);
      
      // Check for regex usage
      if (queryString.includes('$regex')) {
        suggestions.push('Consider using text indexes for text search instead of regex');
        suggestions.push('Ensure regex patterns are anchored (start with ^) when possible');
      }
      
      // Check for unindexed fields
      if (queryString.includes('$or')) {
        suggestions.push('$or queries can be slow - consider compound indexes');
      }
      
      // Check for sorting without indexes
      if (queryData.operation === 'find' && queryString.includes('sort')) {
        suggestions.push('Ensure sort fields are indexed');
      }
      
      // Check for large skip values
      if (queryString.includes('"skip"') && queryString.includes('1000')) {
        suggestions.push('Large skip values are inefficient - consider cursor-based pagination');
      }
    }
    
    // Generic suggestions based on execution time
    if (queryData.executionTime > 5000) {
      suggestions.push('Consider breaking down complex queries into smaller parts');
      suggestions.push('Evaluate if query result caching would be beneficial');
    }
    
    return suggestions;
  }
  
  /**
   * Generate index recommendations
   */
  private static generateIndexRecommendations(queryData: any): string[] {
    const recommendations: string[] = [];
    
    if (queryData.query) {
      const query = queryData.query;
      
      // Extract fields from query
      const fields = this.extractQueryFields(query);
      
      if (fields.length > 0) {
        if (fields.length === 1) {
          recommendations.push(`Consider adding single field index on: ${fields[0]}`);
        } else {
          recommendations.push(`Consider adding compound index on: ${fields.join(', ')}`);
        }
      }
    }
    
    return recommendations;
  }
  
  /**
   * Extract fields from query object
   */
  private static extractQueryFields(query: any, prefix = ''): string[] {
    const fields: string[] = [];
    
    if (typeof query !== 'object' || query === null) {
      return fields;
    }
    
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('$')) {
        // MongoDB operator - recurse into value
        if (Array.isArray(value)) {
          for (const item of value) {
            fields.push(...this.extractQueryFields(item, prefix));
          }
        } else if (typeof value === 'object') {
          fields.push(...this.extractQueryFields(value, prefix));
        }
      } else {
        // Field name
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        fields.push(fieldPath);
        
        // Recurse into nested objects
        if (typeof value === 'object' && !Array.isArray(value)) {
          fields.push(...this.extractQueryFields(value, fieldPath));
        }
      }
    }
    
    return [...new Set(fields)]; // Remove duplicates
  }
  
  /**
   * Analyze performance and generate insights
   */
  private static analyzePerformance(metrics: QueryPerformanceMetrics): void {
    try {
      // Record performance metrics
      monitoring.recordHistogram('request_duration_with_db', metrics.duration);
      monitoring.recordHistogram('request_query_count', metrics.totalQueries);
      monitoring.recordHistogram('request_cache_hit_rate', metrics.cacheHitRate);
      
      // Check for performance issues
      const issues: string[] = [];
      
      if (metrics.duration > 5000) {
        issues.push('High request duration');
      }
      
      if (metrics.totalQueries > 20) {
        issues.push('High query count - consider query optimization or eager loading');
      }
      
      if (metrics.cacheHitRate < 0.5 && metrics.totalQueries > 5) {
        issues.push('Low cache hit rate - consider caching strategy optimization');
      }
      
      const slowQueries = metrics.queries.filter(q => q.executionTime > 500 && !q.fromCache);
      if (slowQueries.length > 0) {
        issues.push(`${slowQueries.length} slow queries detected`);
      }
      
      // Log performance summary
      if (issues.length > 0 || metrics.duration > 2000) {
        loggingService.info('Request performance analysis', {
          requestId: metrics.requestId,
          endpoint: metrics.endpoint,
          duration: metrics.duration,
          totalQueries: metrics.totalQueries,
          cacheHitRate: metrics.cacheHitRate,
          issues,
          slowQueries: slowQueries.length
        });
      }
      
      // Update aggregated performance stats
      this.updatePerformanceStats(metrics);
      
    } catch (error) {
      loggingService.error('Failed to analyze query performance', error);
    }
  }
  
  /**
   * Update aggregated performance statistics
   */
  private static updatePerformanceStats(metrics: QueryPerformanceMetrics): void {
    // This would typically update a performance database or cache
    // For now, we'll just log aggregated metrics
    
    const dbTime = metrics.queries.reduce((total, query) => total + query.executionTime, 0);
    const cacheTime = metrics.duration - dbTime;
    
    monitoring.setGauge('avg_request_db_time', dbTime);
    monitoring.setGauge('avg_request_cache_time', cacheTime);
    monitoring.setGauge('avg_queries_per_request', metrics.totalQueries);
  }
}

/**
 * Query Performance Monitoring Middleware
 */
export function queryPerformanceMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Start tracking for this request
    const requestId = QueryPerformanceTracker.startTracking(req);
    
    // Store request ID for later use
    (req as any).performanceRequestId = requestId;
    
    // Override response end to capture completion
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      // Stop tracking and get metrics
      const metrics = QueryPerformanceTracker.stopTracking(requestId);
      
      if (metrics) {
        // Add performance headers for debugging
        res.set('X-Query-Count', metrics.totalQueries.toString());
        res.set('X-Cache-Hit-Rate', (metrics.cacheHitRate * 100).toFixed(1));
        res.set('X-DB-Time', metrics.queries.reduce((total, q) => total + q.executionTime, 0).toString());
      }
      
      // Call original end method
      originalEnd.apply(this, args);
    };
    
    next();
  };
}

/**
 * Database query optimization middleware for specific routes
 */
export function optimizeQueries(options?: {
  enableCaching?: boolean;
  maxQueries?: number;
  maxDuration?: number;
}) {
  const config = {
    enableCaching: options?.enableCaching ?? true,
    maxQueries: options?.maxQueries ?? 50,
    maxDuration: options?.maxDuration ?? 10000
  };
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).performanceRequestId;
    
    if (!requestId) {
      return next();
    }
    
    // Set query limits
    (req as any).queryLimits = config;
    
    // Continue with request
    next();
  };
}

/**
 * Query cache warming middleware for critical routes
 */
export function warmQueryCache(queries: Array<{
  model: string;
  query: any;
  options?: any;
}>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Warm cache in background for critical queries
      setImmediate(async () => {
        for (const queryConfig of queries) {
          try {
            const model = mongoose.model(queryConfig.model);
            await databaseCacheService.find(model, queryConfig.query, queryConfig.options);
          } catch (error) {
            loggingService.debug('Cache warming failed for query', error, {
              model: queryConfig.model
            });
          }
        }
      });
      
      next();
    } catch (error) {
      loggingService.error('Query cache warming middleware error', error);
      next();
    }
  };
}

export default {
  queryPerformanceMonitoring,
  optimizeQueries,
  warmQueryCache,
  QueryPerformanceTracker
};