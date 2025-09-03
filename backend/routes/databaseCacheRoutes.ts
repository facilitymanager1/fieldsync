/**
 * Database Cache Management Routes
 * Provides endpoints for cache monitoring, management, and optimization
 */

import { Router, Request, Response } from 'express';
import { databaseCacheService } from '../services/databaseCacheService';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { httpCache, cacheInvalidation } from '../middleware/cacheMiddleware';
import { optimizeQueries, warmQueryCache } from '../middleware/queryPerformanceMiddleware';
import { validateRequest } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';

const router = Router();

// Apply authentication and authorization
router.use(authenticate);
router.use(authorize(['Admin', 'Supervisor'])); // Only admin and supervisors can manage cache

/**
 * Get database cache statistics and performance metrics
 */
router.get('/stats',
  httpCache('computed', { ttl: 30 }), // Cache for 30 seconds
  async (req: Request, res: Response) => {
    try {
      const stats = await databaseCacheService.getStatistics();
      const queryMetadata = databaseCacheService.getQueryMetadata();
      
      // Aggregate performance insights
      const performanceInsights = {
        totalCacheSavings: stats.totalCacheSavings,
        averageCacheTime: stats.averageCacheTime,
        averageExecutionTime: stats.averageExecutionTime,
        efficiencyRatio: stats.averageExecutionTime > 0 
          ? stats.averageCacheTime / stats.averageExecutionTime 
          : 0,
        recommendations: generateCacheRecommendations(stats, queryMetadata)
      };
      
      // Model-specific insights
      const modelInsights = Object.entries(stats.modelStats).map(([model, modelStats]) => ({
        model,
        queryCount: modelStats.queryCount,
        hitRate: modelStats.hitRate,
        averageTime: modelStats.averageTime,
        performance: modelStats.hitRate > 0.8 ? 'excellent' : 
                    modelStats.hitRate > 0.6 ? 'good' : 
                    modelStats.hitRate > 0.3 ? 'fair' : 'poor'
      }));

      res.json({
        success: true,
        data: {
          overview: {
            totalQueries: stats.totalQueries,
            cachedQueries: stats.cachedQueries,
            cacheHitRate: stats.cacheHitRate,
            status: stats.cacheHitRate > 0.8 ? 'excellent' : 
                   stats.cacheHitRate > 0.6 ? 'good' : 
                   stats.cacheHitRate > 0.3 ? 'fair' : 'needs_improvement'
          },
          performance: performanceInsights,
          models: modelInsights,
          topQueries: stats.topCachedQueries,
          queryMetadata: queryMetadata.slice(0, 20) // Limit to top 20 for performance
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Failed to get database cache statistics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve cache statistics'
      });
    }
  }
);

/**
 * Get detailed query performance analysis
 */
router.get('/analysis',
  [
    query('model').optional().isString().withMessage('Model must be a string'),
    query('timeframe').optional().isIn(['1h', '6h', '24h', '7d']).withMessage('Invalid timeframe'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { model, timeframe = '24h', limit = 50 } = req.query;
      
      const queryMetadata = databaseCacheService.getQueryMetadata();
      let filteredMetadata = queryMetadata;
      
      // Filter by model if specified
      if (model) {
        filteredMetadata = queryMetadata.filter(meta => 
          meta.model.toLowerCase() === (model as string).toLowerCase()
        );
      }
      
      // Filter by timeframe
      const timeframeMsMap = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000
      };
      
      const timeframeMs = timeframeMsMap[timeframe as keyof typeof timeframeMsMap];
      const cutoffTime = new Date(Date.now() - timeframeMs);
      
      filteredMetadata = filteredMetadata.filter(meta => 
        meta.lastAccessed >= cutoffTime
      );
      
      // Sort by access count and limit
      const limitedMetadata = filteredMetadata
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, parseInt(limit as string));
      
      // Generate analysis
      const analysis = {
        queryCount: filteredMetadata.length,
        totalExecutionTime: filteredMetadata.reduce((sum, meta) => sum + (meta.executionTime || 0), 0),
        averageExecutionTime: filteredMetadata.length > 0 
          ? filteredMetadata.reduce((sum, meta) => sum + (meta.executionTime || 0), 0) / filteredMetadata.length 
          : 0,
        complexityDistribution: getComplexityDistribution(filteredMetadata),
        sizeDistribution: getSizeDistribution(filteredMetadata),
        optimizationOpportunities: identifyOptimizationOpportunities(filteredMetadata)
      };

      res.json({
        success: true,
        data: {
          analysis,
          queries: limitedMetadata,
          timeframe,
          model: model || 'all'
        }
      });

    } catch (error) {
      loggingService.error('Failed to generate query analysis', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate query analysis'
      });
    }
  }
);

/**
 * Invalidate cache manually
 */
router.post('/invalidate',
  [
    body('pattern').optional().isString().withMessage('Pattern must be a string'),
    body('model').optional().isString().withMessage('Model must be a string'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('confirmAll').optional().isBoolean().withMessage('ConfirmAll must be a boolean')
  ],
  validateRequest,
  cacheInvalidation({
    patterns: ['query_result'],
    onMethods: ['POST']
  }),
  async (req: Request, res: Response) => {
    try {
      const { pattern, model, tags, confirmAll } = req.body;
      const user = (req as any).user;
      
      let invalidatedCount = 0;
      
      if (confirmAll === true) {
        // Invalidate all cache - requires explicit confirmation
        invalidatedCount = await databaseCacheService.invalidateCache();
        
        loggingService.warn('All database cache invalidated', {
          userId: user.id,
          userName: user.name,
          reason: 'Manual invalidation - all cache'
        });
        
      } else if (model) {
        // Invalidate specific model cache
        await databaseCacheService.invalidateModel(model, 'update');
        invalidatedCount = 1; // Approximate
        
        loggingService.info('Model cache invalidated', {
          model,
          userId: user.id,
          userName: user.name
        });
        
      } else if (pattern || tags) {
        // Invalidate by pattern or tags
        invalidatedCount = await databaseCacheService.invalidateCache(pattern, tags);
        
        loggingService.info('Cache invalidated by pattern/tags', {
          pattern,
          tags,
          invalidatedCount,
          userId: user.id,
          userName: user.name
        });
      } else {
        return res.status(400).json({
          success: false,
          error: 'Must specify pattern, model, tags, or confirmAll=true'
        });
      }
      
      monitoring.incrementCounter('manual_cache_invalidations_total', 1, {
        type: confirmAll ? 'all' : model ? 'model' : 'pattern',
        userId: user.id
      });

      res.json({
        success: true,
        data: {
          invalidatedCount,
          message: `Successfully invalidated ${invalidatedCount} cache entries`
        }
      });

    } catch (error) {
      loggingService.error('Failed to invalidate cache', error);
      res.status(500).json({
        success: false,
        error: 'Failed to invalidate cache'
      });
    }
  }
);

/**
 * Warm cache with frequently used queries
 */
router.post('/warm',
  [
    body('models').optional().isArray().withMessage('Models must be an array'),
    body('queries').optional().isArray().withMessage('Queries must be an array'),
    body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { models, queries, priority = 'medium' } = req.body;
      const user = (req as any).user;
      
      // Default warming queries for common models
      const defaultWarmingQueries = [
        {
          model: 'User',
          queryType: 'find' as const,
          query: { status: 'active' },
          options: { limit: 50, sort: { lastLogin: -1 } }
        },
        {
          model: 'Shift',
          queryType: 'find' as const,
          query: { status: 'active' },
          options: { populate: 'user', limit: 20 }
        },
        {
          model: 'Ticket',
          queryType: 'find' as const,
          query: { status: { $in: ['open', 'in_progress'] } },
          options: { populate: 'assignedTo', limit: 30 }
        }
      ];
      
      let warmingQueries = queries || defaultWarmingQueries;
      
      // Filter by models if specified
      if (models && models.length > 0) {
        warmingQueries = warmingQueries.filter((q: any) => 
          models.includes(q.model)
        );
      }
      
      // Start cache warming in background
      const warmingPromise = databaseCacheService.warmCache(warmingQueries);
      
      loggingService.info('Cache warming initiated', {
        queriesCount: warmingQueries.length,
        models: models || 'all',
        priority,
        userId: user.id,
        userName: user.name
      });
      
      // Don't wait for completion for high priority requests
      if (priority === 'high') {
        res.json({
          success: true,
          data: {
            message: 'Cache warming initiated in background',
            queriesCount: warmingQueries.length,
            status: 'in_progress'
          }
        });
      } else {
        // Wait for completion for lower priority
        await warmingPromise;
        
        res.json({
          success: true,
          data: {
            message: 'Cache warming completed',
            queriesCount: warmingQueries.length,
            status: 'completed'
          }
        });
      }
      
      monitoring.incrementCounter('cache_warming_requests_total', 1, {
        priority,
        queriesCount: warmingQueries.length.toString()
      });

    } catch (error) {
      loggingService.error('Failed to warm cache', error);
      res.status(500).json({
        success: false,
        error: 'Failed to warm cache'
      });
    }
  }
);

/**
 * Get cache health status
 */
router.get('/health',
  async (req: Request, res: Response) => {
    try {
      const stats = await databaseCacheService.getStatistics();
      
      const health = {
        status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
        checks: {
          cacheHitRate: {
            value: stats.cacheHitRate,
            status: stats.cacheHitRate > 0.7 ? 'healthy' : 
                   stats.cacheHitRate > 0.4 ? 'degraded' : 'unhealthy',
            threshold: 0.7
          },
          totalQueries: {
            value: stats.totalQueries,
            status: 'healthy'
          },
          averageExecutionTime: {
            value: stats.averageExecutionTime,
            status: stats.averageExecutionTime < 500 ? 'healthy' : 
                   stats.averageExecutionTime < 1000 ? 'degraded' : 'unhealthy',
            threshold: 500
          },
          cacheSavings: {
            value: stats.totalCacheSavings,
            status: stats.totalCacheSavings > 1000 ? 'healthy' : 'degraded',
            threshold: 1000
          }
        },
        recommendations: generateHealthRecommendations(stats)
      };
      
      // Determine overall health
      const checkStatuses = Object.values(health.checks).map(check => check.status);
      if (checkStatuses.includes('unhealthy')) {
        health.status = 'unhealthy';
      } else if (checkStatuses.includes('degraded')) {
        health.status = 'degraded';
      }

      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        success: true,
        data: health,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Failed to get cache health status', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cache health status'
      });
    }
  }
);

// Helper functions

function generateCacheRecommendations(stats: any, queryMetadata: any[]): string[] {
  const recommendations: string[] = [];
  
  if (stats.cacheHitRate < 0.5) {
    recommendations.push('Consider increasing cache TTL for frequently accessed data');
    recommendations.push('Review query patterns to identify cacheable operations');
  }
  
  if (stats.totalQueries > 1000 && stats.cachedQueries < stats.totalQueries * 0.3) {
    recommendations.push('Low cache utilization - consider enabling caching for more query types');
  }
  
  const slowQueries = queryMetadata.filter(meta => (meta.executionTime || 0) > 1000);
  if (slowQueries.length > 0) {
    recommendations.push(`${slowQueries.length} slow queries detected - consider optimization or caching`);
  }
  
  const largeResults = queryMetadata.filter(meta => (meta.resultSize || 0) > 100000);
  if (largeResults.length > 0) {
    recommendations.push('Large result sets detected - consider pagination or result filtering');
  }
  
  return recommendations;
}

function generateHealthRecommendations(stats: any): string[] {
  const recommendations: string[] = [];
  
  if (stats.cacheHitRate < 0.7) {
    recommendations.push('Improve cache hit rate by optimizing cache strategy');
  }
  
  if (stats.averageExecutionTime > 500) {
    recommendations.push('Optimize slow queries or add database indexes');
  }
  
  if (stats.totalCacheSavings < 1000) {
    recommendations.push('Increase cache usage to improve performance benefits');
  }
  
  return recommendations;
}

function getComplexityDistribution(metadata: any[]): Record<string, number> {
  const distribution = { low: 0, medium: 0, high: 0 };
  
  metadata.forEach(meta => {
    if (meta.complexity < 50) {
      distribution.low++;
    } else if (meta.complexity < 100) {
      distribution.medium++;
    } else {
      distribution.high++;
    }
  });
  
  return distribution;
}

function getSizeDistribution(metadata: any[]): Record<string, number> {
  const distribution = { small: 0, medium: 0, large: 0 };
  
  metadata.forEach(meta => {
    const size = meta.resultSize || 0;
    if (size < 10000) {
      distribution.small++;
    } else if (size < 100000) {
      distribution.medium++;
    } else {
      distribution.large++;
    }
  });
  
  return distribution;
}

function identifyOptimizationOpportunities(metadata: any[]): Array<{
  type: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  count: number;
}> {
  const opportunities: Array<{
    type: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    count: number;
  }> = [];
  
  const slowQueries = metadata.filter(meta => (meta.executionTime || 0) > 1000);
  if (slowQueries.length > 0) {
    opportunities.push({
      type: 'slow_queries',
      description: 'Optimize slow queries with indexes or query restructuring',
      impact: 'high',
      count: slowQueries.length
    });
  }
  
  const uncachedFrequent = metadata.filter(meta => meta.accessCount > 10 && (meta.executionTime || 0) > 100);
  if (uncachedFrequent.length > 0) {
    opportunities.push({
      type: 'uncached_frequent',
      description: 'Cache frequently accessed queries',
      impact: 'medium',
      count: uncachedFrequent.length
    });
  }
  
  const largeResults = metadata.filter(meta => (meta.resultSize || 0) > 100000);
  if (largeResults.length > 0) {
    opportunities.push({
      type: 'large_results',
      description: 'Implement pagination for large result sets',
      impact: 'medium',
      count: largeResults.length
    });
  }
  
  return opportunities;
}

export default router;