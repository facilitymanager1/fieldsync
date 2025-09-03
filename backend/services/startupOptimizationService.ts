/**
 * Startup Optimization Service
 * Automated database optimization during application startup
 */

import databaseIndexService from './databaseIndexService';
import loggingService from './loggingService';
import { monitoring } from './monitoringService';

interface OptimizationConfig {
  createIndexes: boolean;
  analyzeExistingIndexes: boolean;
  optimizeSlowQueries: boolean;
  skipOnProduction: boolean;
}

/**
 * Startup Optimization Service for automated database optimization
 */
export class StartupOptimizationService {
  private config: OptimizationConfig;

  constructor() {
    this.config = {
      createIndexes: process.env.AUTO_CREATE_INDEXES !== 'false',
      analyzeExistingIndexes: process.env.AUTO_ANALYZE_INDEXES !== 'false',
      optimizeSlowQueries: process.env.AUTO_OPTIMIZE_QUERIES !== 'false',
      skipOnProduction: process.env.SKIP_STARTUP_OPTIMIZATION === 'true'
    };
  }

  /**
   * Run startup optimization tasks
   */
  async optimize(): Promise<{
    success: boolean;
    results: {
      indexCreation?: any;
      indexAnalysis?: any;
      queryOptimization?: any;
    };
    duration: number;
  }> {
    const startTime = Date.now();
    const timer = monitoring.startTimer('startup_optimization_duration');

    try {
      loggingService.info('Starting database optimization', {
        environment: process.env.NODE_ENV,
        config: this.config
      });

      // Skip optimization in production if configured
      if (process.env.NODE_ENV === 'production' && this.config.skipOnProduction) {
        loggingService.info('Skipping startup optimization in production');
        timer();
        return {
          success: true,
          results: {},
          duration: Date.now() - startTime
        };
      }

      const results: any = {};

      // Create indexes if enabled
      if (this.config.createIndexes) {
        try {
          loggingService.info('Creating database indexes...');
          results.indexCreation = await databaseIndexService.createIndexes();
          
          if (results.indexCreation.success) {
            loggingService.info('Database indexes created successfully', {
              created: results.indexCreation.created,
              failed: results.indexCreation.failed
            });
          } else {
            loggingService.warn('Some database indexes failed to create', {
              created: results.indexCreation.created,
              failed: results.indexCreation.failed
            });
          }

          monitoring.incrementCounter('startup_optimization_tasks_total', 1, {
            task: 'index_creation',
            status: results.indexCreation.success ? 'success' : 'partial_failure'
          });

        } catch (error) {
          loggingService.error('Index creation failed during startup', error);
          monitoring.incrementCounter('startup_optimization_tasks_total', 1, {
            task: 'index_creation',
            status: 'error'
          });
        }
      }

      // Analyze existing indexes if enabled
      if (this.config.analyzeExistingIndexes) {
        try {
          loggingService.info('Analyzing existing database indexes...');
          results.indexAnalysis = await databaseIndexService.analyzeIndexes();
          
          loggingService.info('Database index analysis completed', {
            totalCollections: results.indexAnalysis.collections.length,
            totalIndexes: results.indexAnalysis.collections.reduce((sum: number, col: any) => sum + col.totalIndexes, 0),
            recommendations: results.indexAnalysis.recommendations.length
          });

          // Log recommendations if any
          if (results.indexAnalysis.recommendations.length > 0) {
            loggingService.info('Index optimization recommendations available', {
              recommendations: results.indexAnalysis.recommendations
            });
          }

          monitoring.incrementCounter('startup_optimization_tasks_total', 1, {
            task: 'index_analysis',
            status: 'success'
          });

        } catch (error) {
          loggingService.error('Index analysis failed during startup', error);
          monitoring.incrementCounter('startup_optimization_tasks_total', 1, {
            task: 'index_analysis',
            status: 'error'
          });
        }
      }

      // Optimize slow queries if enabled (only in development)
      if (this.config.optimizeSlowQueries && process.env.NODE_ENV !== 'production') {
        try {
          loggingService.info('Analyzing slow queries...');
          results.queryOptimization = await databaseIndexService.optimizeSlowQueries();
          
          loggingService.info('Slow query analysis completed', {
            analyzed: results.queryOptimization.analyzed,
            optimized: results.queryOptimization.optimized,
            recommendations: results.queryOptimization.recommendations.length
          });

          monitoring.incrementCounter('startup_optimization_tasks_total', 1, {
            task: 'query_optimization',
            status: 'success'
          });

        } catch (error) {
          loggingService.error('Query optimization failed during startup', error);
          monitoring.incrementCounter('startup_optimization_tasks_total', 1, {
            task: 'query_optimization',
            status: 'error'
          });
        }
      }

      const duration = Date.now() - startTime;
      timer();

      loggingService.info('Database optimization completed', {
        duration: `${duration}ms`,
        tasks: Object.keys(results)
      });

      monitoring.incrementCounter('startup_optimizations_total', 1, {
        status: 'success',
        environment: process.env.NODE_ENV || 'development'
      });

      return {
        success: true,
        results,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      timer();

      loggingService.error('Database optimization failed', error, {
        duration: `${duration}ms`
      });

      monitoring.incrementCounter('startup_optimizations_total', 1, {
        status: 'error',
        environment: process.env.NODE_ENV || 'development'
      });

      return {
        success: false,
        results: {},
        duration
      };
    }
  }

  /**
   * Run periodic optimization (for background maintenance)
   */
  async runPeriodicOptimization(): Promise<void> {
    try {
      loggingService.info('Starting periodic database optimization');

      // Only run index analysis periodically (less intrusive)
      const analysis = await databaseIndexService.analyzeIndexes();
      
      // Check for unused indexes
      const unusedIndexes = analysis.collections.flatMap(col => 
        col.indexes.filter(idx => 
          idx.name !== '_id_' && (!idx.usage || idx.usage.ops === 0)
        ).map(idx => ({ collection: col.name, index: idx.name }))
      );

      if (unusedIndexes.length > 0) {
        loggingService.warn('Unused indexes detected', {
          count: unusedIndexes.length,
          indexes: unusedIndexes
        });
      }

      // Log recommendations
      if (analysis.recommendations.length > 0) {
        loggingService.info('New optimization recommendations available', {
          count: analysis.recommendations.length,
          recommendations: analysis.recommendations.slice(0, 5) // Log first 5
        });
      }

      monitoring.incrementCounter('periodic_optimizations_total', 1, {
        status: 'success',
        unused_indexes: unusedIndexes.length.toString()
      });

    } catch (error) {
      loggingService.error('Periodic optimization failed', error);
      monitoring.incrementCounter('periodic_optimizations_total', 1, {
        status: 'error'
      });
    }
  }

  /**
   * Schedule periodic optimization
   */
  schedulePeriodicOptimization(): void {
    // Run every 6 hours
    const interval = 6 * 60 * 60 * 1000;
    
    setInterval(() => {
      this.runPeriodicOptimization();
    }, interval);

    loggingService.info('Periodic database optimization scheduled', {
      intervalHours: 6
    });
  }

  /**
   * Get optimization status
   */
  getOptimizationStatus(): {
    config: OptimizationConfig;
    environment: string;
    lastRun?: Date;
  } {
    return {
      config: this.config,
      environment: process.env.NODE_ENV || 'development',
      // lastRun could be stored in cache/database for tracking
    };
  }

  /**
   * Update optimization configuration
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    loggingService.info('Optimization configuration updated', {
      newConfig: this.config
    });
  }
}

// Export singleton instance
export const startupOptimizationService = new StartupOptimizationService();
export default startupOptimizationService;