/**
 * Database Index Management Routes
 * Provides endpoints for index analysis, optimization, and management
 */

import { Router, Request, Response } from 'express';
import { databaseIndexingService } from '../services/databaseIndexingService';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { httpCache, cacheInvalidation } from '../middleware/cacheMiddleware';
import { validateRequest } from '../middleware/validation';
import { body, query, param } from 'express-validator';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';

const router = Router();

// Apply authentication and authorization - only admin can manage indexes
router.use(authenticate);
router.use(authorize(['Admin'])); // Only admins can manage database indexes

/**
 * Get comprehensive index statistics and analysis
 */
router.get('/stats',
  httpCache('computed', { ttl: 60 }), // Cache for 1 minute
  async (req: Request, res: Response) => {
    try {
      const stats = await databaseIndexingService.getIndexStatistics();
      const usage = await databaseIndexingService.analyzeIndexUsage();
      
      // Calculate health score
      const healthScore = calculateIndexHealthScore(stats, usage);
      
      // Generate insights
      const insights = generateIndexInsights(stats, usage);
      
      res.json({
        success: true,
        data: {
          overview: {
            totalIndexes: stats.totalIndexes,
            compoundIndexes: stats.compoundIndexes,
            unusedIndexes: usage.unused.length,
            redundantIndexes: usage.redundant.length,
            efficiency: stats.indexEfficiency,
            healthScore,
            status: healthScore > 0.8 ? 'excellent' : 
                   healthScore > 0.6 ? 'good' : 
                   healthScore > 0.4 ? 'fair' : 'poor'
          },
          statistics: stats,
          usage: {
            unused: usage.unused,
            redundant: usage.redundant,
            recommendations: usage.recommendations
          },
          insights,
          performance: {
            totalIndexSize: stats.totalIndexSize,
            storageEfficiency: calculateStorageEfficiency(stats),
            maintenanceOverhead: calculateMaintenanceOverhead(stats)
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      loggingService.error('Failed to get index statistics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve index statistics'
      });
    }
  }
);

/**
 * Generate index recommendations based on query patterns
 */
router.get('/recommendations',
  [
    query('model').optional().isString().withMessage('Model must be a string'),
    query('priority').optional().isIn(['critical', 'high', 'medium', 'low']).withMessage('Invalid priority'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
  ],
  validateRequest,
  httpCache('computed', { ttl: 300 }), // Cache for 5 minutes
  async (req: Request, res: Response) => {
    try {
      const { model, priority, limit = 20 } = req.query;
      
      let recommendations = await databaseIndexingService.generateRecommendations(
        model as string
      );
      
      // Filter by priority if specified
      if (priority) {
        recommendations = recommendations.filter(rec => 
          rec.indexConfig.priority === priority
        );
      }
      
      // Limit results
      recommendations = recommendations.slice(0, parseInt(limit as string));
      
      // Categorize recommendations
      const categorized = {
        critical: recommendations.filter(r => r.indexConfig.priority === 'critical'),
        high: recommendations.filter(r => r.indexConfig.priority === 'high'),
        medium: recommendations.filter(r => r.indexConfig.priority === 'medium'),
        low: recommendations.filter(r => r.indexConfig.priority === 'low')
      };
      
      // Calculate potential impact
      const totalImpact = recommendations.reduce((sum, rec) => 
        sum + rec.estimatedImpact.performanceGain, 0
      );
      
      const totalStorageIncrease = recommendations.reduce((sum, rec) => 
        sum + rec.estimatedImpact.storageIncrease, 0
      );

      res.json({
        success: true,
        data: {
          total: recommendations.length,
          recommendations,
          categorized,
          impact: {
            totalPerformanceGain: totalImpact,
            totalStorageIncrease,
            averageWriteImpact: recommendations.length > 0 
              ? recommendations.reduce((sum, rec) => sum + rec.estimatedImpact.writePerformanceImpact, 0) / recommendations.length
              : 0
          },
          filters: {
            model: model || 'all',
            priority: priority || 'all'
          }
        }
      });

    } catch (error) {
      loggingService.error('Failed to generate index recommendations', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate index recommendations'
      });
    }
  }
);

/**
 * Analyze and optimize indexes for a specific model
 */
router.get('/analyze/:model',
  [
    param('model').isString().withMessage('Model name is required')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { model } = req.params;
      
      const analysis = await databaseIndexingService.optimizeModelIndexes(model);
      
      // Generate optimization summary
      const summary = {
        currentIndexes: analysis.usage.unused.length + analysis.usage.redundant.length,
        recommendations: analysis.recommendations.length,
        optimizationPotential: calculateOptimizationPotential(analysis),
        actions: generateOptimizationActions(analysis)
      };

      res.json({
        success: true,
        data: {
          model,
          summary,
          analysis,
          recommendations: analysis.recommendations.map(rec => ({
            ...rec,
            priority: rec.indexConfig.priority,
            estimatedImpact: rec.estimatedImpact
          }))
        }
      });

    } catch (error) {
      loggingService.error('Failed to analyze model indexes', error, {
        model: req.params.model
      });
      res.status(500).json({
        success: false,
        error: 'Failed to analyze model indexes'
      });
    }
  }
);

/**
 * Create recommended indexes
 */
router.post('/create',
  [
    body('recommendations').isArray().withMessage('Recommendations must be an array'),
    body('options.dryRun').optional().isBoolean().withMessage('DryRun must be a boolean'),
    body('options.background').optional().isBoolean().withMessage('Background must be a boolean'),
    body('options.maxConcurrent').optional().isInt({ min: 1, max: 10 }).withMessage('MaxConcurrent must be between 1 and 10'),
    body('confirmCreation').isBoolean().withMessage('ConfirmCreation is required')
  ],
  validateRequest,
  cacheInvalidation({
    patterns: ['query_result', 'computed_data'],
    onMethods: ['POST']
  }),
  async (req: Request, res: Response) => {
    try {
      const { recommendations, options = {}, confirmCreation } = req.body;
      const user = (req as any).user;
      
      if (!confirmCreation) {
        return res.status(400).json({
          success: false,
          error: 'Must confirm index creation by setting confirmCreation=true'
        });
      }
      
      // Validate recommendations format
      if (!Array.isArray(recommendations) || recommendations.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Must provide valid recommendations array'
        });
      }
      
      const defaultOptions = {
        dryRun: false,
        background: true,
        maxConcurrent: 3,
        ...options
      };
      
      // Log the operation
      loggingService.info('Index creation initiated', {
        recommendationsCount: recommendations.length,
        options: defaultOptions,
        userId: user.id,
        userName: user.name
      });
      
      const results = await databaseIndexingService.createRecommendedIndexes(
        recommendations,
        defaultOptions
      );
      
      // Calculate success rate
      const total = results.created.length + results.failed.length + results.skipped.length;
      const successRate = total > 0 ? results.created.length / total : 0;
      
      monitoring.incrementCounter('database_indexes_creation_requests_total', 1, {
        dryRun: defaultOptions.dryRun.toString(),
        userId: user.id
      });
      
      monitoring.recordHistogram('database_indexes_created_count', results.created.length);

      res.json({
        success: true,
        data: {
          results,
          summary: {
            total: recommendations.length,
            created: results.created.length,
            failed: results.failed.length,
            skipped: results.skipped.length,
            successRate: (successRate * 100).toFixed(1) + '%'
          },
          options: defaultOptions,
          message: defaultOptions.dryRun 
            ? 'Dry run completed - no indexes were actually created'
            : `Index creation completed: ${results.created.length} created, ${results.failed.length} failed, ${results.skipped.length} skipped`
        }
      });

    } catch (error) {
      loggingService.error('Failed to create indexes', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create indexes'
      });
    }
  }
);

/**
 * Remove unused or redundant indexes
 */
router.post('/cleanup',
  [
    body('removeUnused').optional().isBoolean().withMessage('RemoveUnused must be a boolean'),
    body('removeRedundant').optional().isBoolean().withMessage('RemoveRedundant must be a boolean'),
    body('models').optional().isArray().withMessage('Models must be an array'),
    body('dryRun').optional().isBoolean().withMessage('DryRun must be a boolean'),
    body('confirmCleanup').isBoolean().withMessage('ConfirmCleanup is required')
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { 
        removeUnused = true, 
        removeRedundant = false, 
        models, 
        dryRun = false,
        confirmCleanup 
      } = req.body;
      const user = (req as any).user;
      
      if (!confirmCleanup) {
        return res.status(400).json({
          success: false,
          error: 'Must confirm cleanup by setting confirmCleanup=true'
        });
      }
      
      const usage = await databaseIndexingService.analyzeIndexUsage();
      
      let indexesToRemove: Array<{ collection: string; index: string; reason: string }> = [];
      
      if (removeUnused) {
        indexesToRemove.push(...usage.unused);
      }
      
      if (removeRedundant) {
        // Add redundant indexes (simplified - take first index from each group)
        usage.redundant.forEach(group => {
          if (group.indexes.length > 1) {
            indexesToRemove.push({
              collection: group.collection,
              index: group.indexes[1], // Keep first, remove second
              reason: 'Redundant index'
            });
          }
        });
      }
      
      // Filter by models if specified
      if (models && models.length > 0) {
        indexesToRemove = indexesToRemove.filter(item => 
          models.includes(item.collection.replace(/s$/, '')) // Remove plural 's'
        );
      }
      
      if (indexesToRemove.length === 0) {
        return res.json({
          success: true,
          data: {
            message: 'No indexes found for cleanup',
            removed: [],
            summary: { total: 0, removed: 0, failed: 0 }
          }
        });
      }
      
      loggingService.info('Index cleanup initiated', {
        indexesToRemove: indexesToRemove.length,
        removeUnused,
        removeRedundant,
        models: models || 'all',
        dryRun,
        userId: user.id,
        userName: user.name
      });
      
      const results = {
        removed: [] as string[],
        failed: [] as string[]
      };
      
      // Perform cleanup (or simulate if dry run)
      for (const item of indexesToRemove) {
        try {
          if (!dryRun) {
            // Actually remove the index
            await removeIndex(item.collection, item.index);
          }
          
          results.removed.push(`${item.collection}.${item.index}`);
          
          loggingService.info('Index removed', {
            collection: item.collection,
            index: item.index,
            reason: item.reason,
            dryRun
          });
          
        } catch (error) {
          results.failed.push(`${item.collection}.${item.index}`);
          loggingService.error('Failed to remove index', error, {
            collection: item.collection,
            index: item.index
          });
        }
      }
      
      monitoring.incrementCounter('database_indexes_cleanup_requests_total', 1, {
        dryRun: dryRun.toString(),
        userId: user.id
      });

      res.json({
        success: true,
        data: {
          results,
          summary: {
            total: indexesToRemove.length,
            removed: results.removed.length,
            failed: results.failed.length
          },
          message: dryRun 
            ? 'Dry run completed - no indexes were actually removed'
            : `Cleanup completed: ${results.removed.length} removed, ${results.failed.length} failed`
        }
      });

    } catch (error) {
      loggingService.error('Failed to cleanup indexes', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup indexes'
      });
    }
  }
);

/**
 * Get index health status
 */
router.get('/health',
  async (req: Request, res: Response) => {
    try {
      const stats = await databaseIndexingService.getIndexStatistics();
      const usage = await databaseIndexingService.analyzeIndexUsage();
      
      const health = {
        status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
        checks: {
          indexEfficiency: {
            value: stats.indexEfficiency,
            status: stats.indexEfficiency > 0.8 ? 'healthy' : 
                   stats.indexEfficiency > 0.6 ? 'degraded' : 'unhealthy',
            threshold: 0.8
          },
          unusedIndexes: {
            value: usage.unused.length,
            status: usage.unused.length < 5 ? 'healthy' : 
                   usage.unused.length < 10 ? 'degraded' : 'unhealthy',
            threshold: 5
          },
          redundantIndexes: {
            value: usage.redundant.length,
            status: usage.redundant.length === 0 ? 'healthy' : 
                   usage.redundant.length < 3 ? 'degraded' : 'unhealthy',
            threshold: 0
          },
          totalIndexSize: {
            value: stats.totalIndexSize,
            status: stats.totalIndexSize < 1000000000 ? 'healthy' : // 1GB
                   stats.totalIndexSize < 5000000000 ? 'degraded' : 'unhealthy', // 5GB
            threshold: 1000000000
          }
        },
        recommendations: generateHealthRecommendations(stats, usage)
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
      loggingService.error('Failed to get index health status', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get index health status'
      });
    }
  }
);

// Helper functions

function calculateIndexHealthScore(stats: any, usage: any): number {
  let score = 0;
  
  // Efficiency score (40% weight)
  score += stats.indexEfficiency * 0.4;
  
  // Unused index penalty (20% weight)
  const unusedPenalty = Math.min(usage.unused.length / 10, 1);
  score += (1 - unusedPenalty) * 0.2;
  
  // Redundant index penalty (20% weight)
  const redundantPenalty = Math.min(usage.redundant.length / 5, 1);
  score += (1 - redundantPenalty) * 0.2;
  
  // Coverage score (20% weight)
  const coverageScore = stats.recommendationsCount === 0 ? 1 : 
                       Math.max(0, 1 - (stats.recommendationsCount / 20));
  score += coverageScore * 0.2;
  
  return Math.max(0, Math.min(1, score));
}

function calculateStorageEfficiency(stats: any): number {
  if (stats.totalIndexSize === 0) return 1;
  
  // Simplified efficiency calculation
  const avgIndexSize = stats.totalIndexSize / stats.totalIndexes;
  const efficiency = Math.min(1, 50000 / avgIndexSize); // Assume 50KB is efficient
  
  return efficiency;
}

function calculateMaintenanceOverhead(stats: any): number {
  // Estimate maintenance overhead as percentage
  return Math.min(stats.compoundIndexes * 2, 20);
}

function generateIndexInsights(stats: any, usage: any): Array<{
  type: 'info' | 'warning' | 'error';
  message: string;
  action?: string;
}> {
  const insights: Array<{
    type: 'info' | 'warning' | 'error';
    message: string;
    action?: string;
  }> = [];
  
  if (stats.indexEfficiency > 0.8) {
    insights.push({
      type: 'info',
      message: 'Index efficiency is excellent',
    });
  } else if (stats.indexEfficiency < 0.5) {
    insights.push({
      type: 'warning',
      message: 'Low index efficiency detected',
      action: 'Review and optimize index usage'
    });
  }
  
  if (usage.unused.length > 5) {
    insights.push({
      type: 'warning',
      message: `${usage.unused.length} unused indexes found`,
      action: 'Consider removing unused indexes to save storage'
    });
  }
  
  if (usage.redundant.length > 0) {
    insights.push({
      type: 'warning',
      message: `${usage.redundant.length} redundant index groups found`,
      action: 'Consolidate redundant indexes'
    });
  }
  
  if (stats.recommendationsCount > 10) {
    insights.push({
      type: 'info',
      message: `${stats.recommendationsCount} optimization opportunities available`,
      action: 'Review and implement index recommendations'
    });
  }
  
  return insights;
}

function calculateOptimizationPotential(analysis: any): number {
  let potential = 0;
  
  // Add potential from recommendations
  potential += analysis.recommendations.length * 0.1;
  
  // Add potential from removing unused indexes
  potential += analysis.usage.unused.length * 0.05;
  
  // Add potential from consolidating redundant indexes
  potential += analysis.usage.redundant.length * 0.03;
  
  return Math.min(1, potential);
}

function generateOptimizationActions(analysis: any): string[] {
  const actions: string[] = [];
  
  if (analysis.recommendations.length > 0) {
    actions.push(`Create ${analysis.recommendations.length} recommended indexes`);
  }
  
  if (analysis.usage.unused.length > 0) {
    actions.push(`Remove ${analysis.usage.unused.length} unused indexes`);
  }
  
  if (analysis.usage.redundant.length > 0) {
    actions.push(`Consolidate ${analysis.usage.redundant.length} redundant index groups`);
  }
  
  if (actions.length === 0) {
    actions.push('No optimization actions needed');
  }
  
  return actions;
}

function generateHealthRecommendations(stats: any, usage: any): string[] {
  const recommendations: string[] = [];
  
  if (stats.indexEfficiency < 0.8) {
    recommendations.push('Improve index efficiency by removing unused indexes');
  }
  
  if (usage.unused.length > 5) {
    recommendations.push('Remove unused indexes to reduce storage overhead');
  }
  
  if (usage.redundant.length > 0) {
    recommendations.push('Consolidate redundant indexes to improve maintenance');
  }
  
  if (stats.totalIndexSize > 1000000000) { // 1GB
    recommendations.push('Monitor index size growth and optimize storage usage');
  }
  
  return recommendations;
}

async function removeIndex(collectionName: string, indexName: string): Promise<void> {
  const db = require('mongoose').connection.db;
  await db.collection(collectionName).dropIndex(indexName);
}

export default router;