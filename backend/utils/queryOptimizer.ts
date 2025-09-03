/**
 * Database Query Optimizer Utility
 * Provides advanced query optimization patterns and performance utilities
 */

import mongoose from 'mongoose';
import DatabaseService from '../services/DatabaseService';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';

// Query optimization patterns
export interface QueryOptimizationPattern {
  pattern: string;
  optimization: (query: any, options?: any) => any;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

// Query performance analysis result
export interface QueryAnalysis {
  query: any;
  collection: string;
  estimatedCost: number;
  suggestedIndexes: any[];
  optimizedQuery: any;
  recommendations: string[];
}

export class QueryOptimizer {
  private databaseService: DatabaseService;
  private optimizationPatterns: Map<string, QueryOptimizationPattern> = new Map();

  constructor() {
    this.databaseService = DatabaseService.getInstance();
    this.initializeOptimizationPatterns();
  }

  /**
   * Initialize common query optimization patterns
   */
  private initializeOptimizationPatterns(): void {
    const patterns: QueryOptimizationPattern[] = [
      {
        pattern: 'limit_without_sort',
        optimization: (query, options) => {
          if (options?.limit && !options?.sort) {
            return { ...options, sort: { _id: 1 } }; // Add stable sort
          }
          return options;
        },
        description: 'Add stable sort when using limit to ensure consistent results',
        impact: 'medium'
      },
      {
        pattern: 'regex_optimization',
        optimization: (query) => {
          const optimized = { ...query };
          for (const [key, value] of Object.entries(query)) {
            if (value && typeof value === 'object' && value.$regex) {
              // Convert case-insensitive regex to indexed prefix search when possible
              const regex = value.$regex as string;
              if (regex.startsWith('^') && !regex.includes('[') && !regex.includes('*')) {
                const prefix = regex.replace('^', '').replace('\\', '');
                optimized[key] = {
                  $gte: prefix,
                  $lt: prefix + '\uffff'
                };
              }
            }
          }
          return optimized;
        },
        description: 'Convert regex patterns to range queries when possible for better index usage',
        impact: 'high'
      },
      {
        pattern: 'or_to_in_optimization',
        optimization: (query) => {
          if (query.$or && Array.isArray(query.$or)) {
            const sameFieldOrs = this.groupOrsByField(query.$or);
            for (const [field, values] of sameFieldOrs.entries()) {
              if (values.length > 1) {
                delete query.$or;
                query[field] = { $in: values };
              }
            }
          }
          return query;
        },
        description: 'Convert $or queries on the same field to $in for better performance',
        impact: 'high'
      },
      {
        pattern: 'projection_optimization',
        optimization: (query, options) => {
          if (!options?.select && !options?.lean) {
            // Suggest lean queries for large result sets
            return { ...options, lean: true };
          }
          return options;
        },
        description: 'Use lean queries for large result sets to reduce memory usage',
        impact: 'medium'
      },
      {
        pattern: 'pagination_optimization',
        optimization: (query, options) => {
          if (options?.skip && options.skip > 10000) {
            // Warn about inefficient pagination
            loggingService.warn('Inefficient pagination detected', {
              skip: options.skip,
              collection: 'unknown'
            });
          }
          return options;
        },
        description: 'Warn about inefficient pagination with large skip values',
        impact: 'high'
      }
    ];

    patterns.forEach(pattern => {
      this.optimizationPatterns.set(pattern.pattern, pattern);
    });
  }

  /**
   * Optimize a query using registered patterns
   */
  optimizeQuery(query: any, options?: any): { query: any; options: any; appliedOptimizations: string[] } {
    let optimizedQuery = { ...query };
    let optimizedOptions = { ...options };
    const appliedOptimizations: string[] = [];

    for (const [patternName, pattern] of this.optimizationPatterns.entries()) {
      try {
        const newQuery = pattern.optimization(optimizedQuery, optimizedOptions);
        if (newQuery !== optimizedQuery || newQuery !== optimizedOptions) {
          if (typeof newQuery === 'object' && 'limit' in newQuery) {
            optimizedOptions = newQuery;
          } else {
            optimizedQuery = newQuery;
          }
          appliedOptimizations.push(patternName);
        }
      } catch (error) {
        loggingService.error('Query optimization pattern failed', error, {
          pattern: patternName,
          query: JSON.stringify(query)
        });
      }
    }

    return {
      query: optimizedQuery,
      options: optimizedOptions,
      appliedOptimizations
    };
  }

  /**
   * Analyze query performance and suggest improvements
   */
  async analyzeQuery(
    model: mongoose.Model<any>,
    query: any,
    options?: any
  ): Promise<QueryAnalysis> {
    try {
      // Get query execution plan
      const explainResult = await model.find(query, null, options).explain('executionStats');
      const executionStats = explainResult.executionStats;

      // Calculate estimated cost (simplified)
      const estimatedCost = this.calculateQueryCost(executionStats);

      // Suggest indexes based on query pattern
      const suggestedIndexes = this.suggestIndexes(query, executionStats);

      // Apply optimizations
      const optimization = this.optimizeQuery(query, options);

      // Generate recommendations
      const recommendations = this.generateRecommendations(query, options, executionStats);

      return {
        query,
        collection: model.collection.name,
        estimatedCost,
        suggestedIndexes,
        optimizedQuery: optimization.query,
        recommendations: [
          ...recommendations,
          ...optimization.appliedOptimizations.map(opt => 
            `Applied optimization: ${this.optimizationPatterns.get(opt)?.description}`
          )
        ]
      };

    } catch (error) {
      loggingService.error('Query analysis failed', error, {
        collection: model.collection.name,
        query: JSON.stringify(query)
      });

      return {
        query,
        collection: model.collection.name,
        estimatedCost: -1,
        suggestedIndexes: [],
        optimizedQuery: query,
        recommendations: ['Query analysis failed - unable to provide recommendations']
      };
    }
  }

  /**
   * Execute query with automatic optimization
   */
  async executeOptimizedQuery<T>(
    model: mongoose.Model<any>,
    query: any,
    options?: any
  ): Promise<T> {
    const optimization = this.optimizeQuery(query, options);

    if (optimization.appliedOptimizations.length > 0) {
      loggingService.info('Query optimizations applied', {
        collection: model.collection.name,
        optimizations: optimization.appliedOptimizations,
        originalQuery: JSON.stringify(query),
        optimizedQuery: JSON.stringify(optimization.query)
      });

      monitoring.incrementCounter('query_optimizations_applied', 1, {
        collection: model.collection.name
      });
    }

    return this.databaseService.executeQuery<T>(
      model,
      'optimized_find',
      optimization.query,
      optimization.options
    );
  }

  /**
   * Create aggregation pipeline optimizer
   */
  optimizeAggregationPipeline(pipeline: any[]): { 
    pipeline: any[]; 
    optimizations: string[];
    estimatedImprovement: number;
  } {
    const optimizedPipeline = [...pipeline];
    const optimizations: string[] = [];
    let estimatedImprovement = 0;

    // Move $match stages to the beginning
    const matchStages = [];
    const otherStages = [];
    
    for (const stage of pipeline) {
      if (stage.$match) {
        matchStages.push(stage);
      } else {
        otherStages.push(stage);
      }
    }

    if (matchStages.length > 0 && pipeline.indexOf(matchStages[0]) > 0) {
      optimizedPipeline.splice(0, pipeline.length, ...matchStages, ...otherStages);
      optimizations.push('Moved $match stages to beginning of pipeline');
      estimatedImprovement += 30; // 30% estimated improvement
    }

    // Optimize $sort + $limit combinations
    for (let i = 0; i < optimizedPipeline.length - 1; i++) {
      const currentStage = optimizedPipeline[i];
      const nextStage = optimizedPipeline[i + 1];

      if (currentStage.$sort && nextStage.$limit) {
        // MongoDB automatically optimizes this, but ensure $limit comes after $sort
        optimizations.push('Verified $sort + $limit optimization');
        estimatedImprovement += 10;
      }
    }

    // Add $allowDiskUse for large aggregations
    const hasLargeOperations = pipeline.some(stage => 
      stage.$group || stage.$sort || stage.$lookup
    );

    if (hasLargeOperations && pipeline.length > 3) {
      optimizations.push('Recommend using allowDiskUse for large aggregation');
      estimatedImprovement += 15;
    }

    return {
      pipeline: optimizedPipeline,
      optimizations,
      estimatedImprovement
    };
  }

  /**
   * Generate index creation scripts based on query patterns
   */
  generateIndexCreationScript(queryPatterns: any[]): string {
    const indexMap = new Map<string, any>();
    
    for (const pattern of queryPatterns) {
      const indexes = this.extractIndexHints(pattern.query);
      for (const index of indexes) {
        const indexKey = JSON.stringify(index);
        if (!indexMap.has(indexKey)) {
          indexMap.set(indexKey, {
            index,
            collections: new Set([pattern.collection]),
            frequency: 1
          });
        } else {
          const existing = indexMap.get(indexKey)!;
          existing.collections.add(pattern.collection);
          existing.frequency++;
        }
      }
    }

    let script = '// Generated index creation script\n\n';
    
    for (const [indexKey, data] of indexMap.entries()) {
      if (data.frequency >= 5) { // Only create indexes for frequently used patterns
        for (const collection of data.collections) {
          script += `db.${collection}.createIndex(${indexKey}, { background: true });\n`;
        }
        script += '\n';
      }
    }

    return script;
  }

  /**
   * Monitor query performance in real-time
   */
  startQueryPerformanceMonitoring(): void {
    setInterval(async () => {
      try {
        const queryHistory = this.databaseService.queryHistory;
        const recentQueries = queryHistory.filter(
          q => q.timestamp > new Date(Date.now() - 60000) // Last minute
        );

        if (recentQueries.length === 0) return;

        // Analyze performance trends
        const avgDuration = recentQueries.reduce((sum, q) => sum + q.duration, 0) / recentQueries.length;
        const slowQueries = recentQueries.filter(q => q.duration > 100);
        
        monitoring.setGauge('query_performance_avg_duration', avgDuration);
        monitoring.setGauge('query_performance_slow_count', slowQueries.length);

        // Generate alerts for performance degradation
        if (avgDuration > 200) {
          loggingService.warn('Query performance degradation detected', {
            averageDuration: avgDuration,
            slowQueries: slowQueries.length,
            totalQueries: recentQueries.length
          });

          monitoring.incrementCounter('query_performance_alerts', 1, {
            type: 'slow_average'
          });
        }

        // Check for queries not using indexes
        const noIndexQueries = recentQueries.filter(q => !q.indexesUsed || q.indexesUsed.length === 0);
        if (noIndexQueries.length > recentQueries.length * 0.3) {
          loggingService.warn('High percentage of queries not using indexes', {
            noIndexQueries: noIndexQueries.length,
            totalQueries: recentQueries.length,
            percentage: (noIndexQueries.length / recentQueries.length) * 100
          });

          monitoring.incrementCounter('query_performance_alerts', 1, {
            type: 'missing_indexes'
          });
        }

      } catch (error) {
        loggingService.error('Query performance monitoring failed', error);
      }
    }, 60000); // Monitor every minute
  }

  // Private helper methods

  private groupOrsByField(orConditions: any[]): Map<string, any[]> {
    const fieldGroups = new Map<string, any[]>();
    
    for (const condition of orConditions) {
      for (const [field, value] of Object.entries(condition)) {
        if (!fieldGroups.has(field)) {
          fieldGroups.set(field, []);
        }
        fieldGroups.get(field)!.push(value);
      }
    }
    
    return fieldGroups;
  }

  private calculateQueryCost(executionStats: any): number {
    if (!executionStats) return 0;
    
    const totalDocsExamined = executionStats.totalDocsExamined || 0;
    const totalDocsReturned = executionStats.totalDocsReturned || 0;
    const executionTimeMillis = executionStats.executionTimeMillis || 0;
    
    // Simple cost calculation based on docs examined and time
    return (totalDocsExamined * 0.1) + (executionTimeMillis * 0.5) + 
           ((totalDocsExamined - totalDocsReturned) * 0.2);
  }

  private suggestIndexes(query: any, executionStats: any): any[] {
    const indexes = [];
    
    // Extract fields from query
    const queryFields = this.extractQueryFields(query);
    
    // Suggest compound index for multiple field queries
    if (queryFields.length > 1) {
      indexes.push(queryFields.reduce((acc, field) => {
        acc[field] = 1;
        return acc;
      }, {} as any));
    }
    
    // Suggest individual indexes for single field queries
    for (const field of queryFields) {
      indexes.push({ [field]: 1 });
    }
    
    return indexes;
  }

  private extractQueryFields(query: any, prefix = ''): string[] {
    const fields: string[] = [];
    
    for (const [key, value] of Object.entries(query)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      if (key.startsWith('$')) {
        // Handle operators
        if (key === '$and' || key === '$or') {
          if (Array.isArray(value)) {
            for (const subQuery of value) {
              fields.push(...this.extractQueryFields(subQuery, prefix));
            }
          }
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle nested objects
        if (Object.keys(value).some(k => k.startsWith('$'))) {
          // Query operator on this field
          fields.push(fieldPath);
        } else {
          // Nested document query
          fields.push(...this.extractQueryFields(value, fieldPath));
        }
      } else {
        // Simple field query
        fields.push(fieldPath);
      }
    }
    
    return fields;
  }

  private extractIndexHints(query: any): any[] {
    const queryFields = this.extractQueryFields(query);
    const indexes = [];
    
    // Single field indexes
    for (const field of queryFields) {
      indexes.push({ [field]: 1 });
    }
    
    // Compound index for multi-field queries
    if (queryFields.length > 1) {
      const compoundIndex = queryFields.reduce((acc, field) => {
        acc[field] = 1;
        return acc;
      }, {} as any);
      indexes.push(compoundIndex);
    }
    
    return indexes;
  }

  private generateRecommendations(query: any, options: any, executionStats: any): string[] {
    const recommendations: string[] = [];
    
    if (executionStats) {
      const docsExamined = executionStats.totalDocsExamined || 0;
      const docsReturned = executionStats.totalDocsReturned || 0;
      const executionTime = executionStats.executionTimeMillis || 0;
      
      if (docsExamined > docsReturned * 10) {
        recommendations.push('Query examines many more documents than returned - consider adding indexes');
      }
      
      if (executionTime > 100) {
        recommendations.push('Query execution time is high - consider optimization');
      }
      
      if (!executionStats.indexName) {
        recommendations.push('Query is not using an index - consider creating appropriate indexes');
      }
    }
    
    if (options?.skip && options.skip > 1000) {
      recommendations.push('Large skip value detected - consider cursor-based pagination');
    }
    
    if (!options?.limit) {
      recommendations.push('Consider adding a limit to prevent large result sets');
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const queryOptimizer = new QueryOptimizer();

export default queryOptimizer;