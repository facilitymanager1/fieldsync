/**
 * Database Indexing Service for Performance Optimization
 * Analyzes query patterns and creates optimized compound indexes
 */

import mongoose, { Schema, Model, Connection } from 'mongoose';
import loggingService from './loggingService';
import { monitoring } from './monitoringService';
import { redisService, CachePattern, CacheStrategy } from './redisService';

// Index configuration
interface IndexConfig {
  name: string;
  fields: Record<string, 1 | -1 | 'text' | '2dsphere'>;
  options?: {
    unique?: boolean;
    sparse?: boolean;
    background?: boolean;
    partialFilterExpression?: any;
    expireAfterSeconds?: number;
    collation?: any;
  };
  priority: 'critical' | 'high' | 'medium' | 'low';
  usage: {
    frequency: number;
    avgExecutionTime: number;
    lastUsed: Date;
  };
  impact: {
    estimatedSpeedup: number;
    storageOverhead: number;
    maintenanceCost: number;
  };
}

// Query pattern analysis
interface QueryPattern {
  fields: string[];
  operations: string[];
  frequency: number;
  averageTime: number;
  modelName: string;
  sortFields?: string[];
  filterFields?: string[];
  projectionFields?: string[];
}

// Index recommendation
interface IndexRecommendation {
  modelName: string;
  indexConfig: IndexConfig;
  reasoning: string[];
  benefits: string[];
  costs: string[];
  estimatedImpact: {
    performanceGain: number;
    storageIncrease: number;
    writePerformanceImpact: number;
  };
}

// Index statistics
interface IndexStats {
  totalIndexes: number;
  compoundIndexes: number;
  unusedIndexes: number;
  redundantIndexes: number;
  totalIndexSize: number;
  indexEfficiency: number;
  recommendationsCount: number;
  modelStats: Record<string, {
    indexCount: number;
    totalSize: number;
    efficiency: number;
    recommendations: number;
  }>;
}

class DatabaseIndexingService {
  private connection: Connection;
  private queryPatterns = new Map<string, QueryPattern>();
  private existingIndexes = new Map<string, IndexConfig[]>();
  private recommendations = new Map<string, IndexRecommendation[]>();
  private stats: IndexStats;

  constructor() {
    this.connection = mongoose.connection;
    this.stats = this.initializeStats();
    this.initialize();
  }

  /**
   * Initialize the indexing service
   */
  private async initialize(): Promise<void> {
    try {
      await this.analyzeExistingIndexes();
      await this.loadQueryPatterns();
      this.setupQueryPatternTracking();
      this.setupPeriodicAnalysis();
      
      loggingService.info('Database indexing service initialized', {
        totalIndexes: this.stats.totalIndexes,
        modelsAnalyzed: Object.keys(this.existingIndexes).length
      });
    } catch (error) {
      loggingService.error('Failed to initialize database indexing service', error);
    }
  }

  /**
   * Analyze existing indexes across all collections
   */
  async analyzeExistingIndexes(): Promise<void> {
    try {
      const collections = await this.connection.db.listCollections().toArray();
      
      for (const collection of collections) {
        const collectionName = collection.name;
        const indexes = await this.connection.db.collection(collectionName).indexes();
        
        const indexConfigs: IndexConfig[] = indexes.map(index => ({
          name: index.name,
          fields: index.key,
          options: {
            unique: index.unique,
            sparse: index.sparse,
            background: index.background,
            partialFilterExpression: index.partialFilterExpression,
            expireAfterSeconds: index.expireAfterSeconds
          },
          priority: this.calculateIndexPriority(index),
          usage: {
            frequency: 0,
            avgExecutionTime: 0,
            lastUsed: new Date()
          },
          impact: {
            estimatedSpeedup: 0,
            storageOverhead: 0,
            maintenanceCost: 0
          }
        }));
        
        this.existingIndexes.set(collectionName, indexConfigs);
      }
      
      await this.updateIndexStats();
      
    } catch (error) {
      loggingService.error('Failed to analyze existing indexes', error);
    }
  }

  /**
   * Track query patterns for index optimization
   */
  recordQueryPattern(
    modelName: string,
    query: any,
    options: any,
    executionTime: number
  ): void {
    try {
      const pattern = this.extractQueryPattern(modelName, query, options);
      const patternKey = this.generatePatternKey(pattern);
      
      const existing = this.queryPatterns.get(patternKey);
      if (existing) {
        existing.frequency++;
        existing.averageTime = (existing.averageTime + executionTime) / existing.frequency;
      } else {
        this.queryPatterns.set(patternKey, {
          ...pattern,
          frequency: 1,
          averageTime: executionTime
        });
      }
      
      // Cache patterns for persistence
      this.cacheQueryPatterns();
      
    } catch (error) {
      loggingService.error('Failed to record query pattern', error, {
        modelName,
        executionTime
      });
    }
  }

  /**
   * Generate index recommendations based on query patterns
   */
  async generateRecommendations(modelName?: string): Promise<IndexRecommendation[]> {
    try {
      const models = modelName ? [modelName] : Array.from(this.queryPatterns.values())
        .map(p => p.modelName)
        .filter((name, index, arr) => arr.indexOf(name) === index);
      
      const allRecommendations: IndexRecommendation[] = [];
      
      for (const model of models) {
        const modelPatterns = Array.from(this.queryPatterns.values())
          .filter(p => p.modelName === model);
        
        const recommendations = await this.generateModelRecommendations(model, modelPatterns);
        allRecommendations.push(...recommendations);
        
        this.recommendations.set(model, recommendations);
      }
      
      // Sort by impact
      allRecommendations.sort((a, b) => 
        b.estimatedImpact.performanceGain - a.estimatedImpact.performanceGain
      );
      
      loggingService.info('Generated index recommendations', {
        totalRecommendations: allRecommendations.length,
        models: models.length
      });
      
      return allRecommendations;
      
    } catch (error) {
      loggingService.error('Failed to generate index recommendations', error);
      return [];
    }
  }

  /**
   * Create recommended indexes
   */
  async createRecommendedIndexes(
    recommendations: IndexRecommendation[],
    options?: {
      dryRun?: boolean;
      background?: boolean;
      maxConcurrent?: number;
    }
  ): Promise<{
    created: string[];
    failed: string[];
    skipped: string[];
  }> {
    const { dryRun = false, background = true, maxConcurrent = 3 } = options || {};
    const results = {
      created: [] as string[],
      failed: [] as string[],
      skipped: [] as string[]
    };
    
    try {
      // Process recommendations in batches
      const batches = this.chunkArray(recommendations, maxConcurrent);
      
      for (const batch of batches) {
        const promises = batch.map(async (recommendation) => {
          try {
            return await this.createIndex(
              recommendation.modelName,
              recommendation.indexConfig,
              { dryRun, background }
            );
          } catch (error) {
            loggingService.error('Failed to create index', error, {
              model: recommendation.modelName,
              index: recommendation.indexConfig.name
            });
            results.failed.push(`${recommendation.modelName}.${recommendation.indexConfig.name}`);
            return null;
          }
        });
        
        const batchResults = await Promise.allSettled(promises);
        
        batchResults.forEach((result, index) => {
          const recommendation = batch[index];
          const indexName = `${recommendation.modelName}.${recommendation.indexConfig.name}`;
          
          if (result.status === 'fulfilled' && result.value) {
            if (result.value.created) {
              results.created.push(indexName);
            } else {
              results.skipped.push(indexName);
            }
          } else {
            results.failed.push(indexName);
          }
        });
      }
      
      if (!dryRun) {
        await this.analyzeExistingIndexes(); // Refresh index analysis
      }
      
      loggingService.info('Index creation completed', {
        created: results.created.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        dryRun
      });
      
      monitoring.incrementCounter('database_indexes_created_total', results.created.length);
      
      return results;
      
    } catch (error) {
      loggingService.error('Failed to create recommended indexes', error);
      throw error;
    }
  }

  /**
   * Analyze index usage and identify unused indexes
   */
  async analyzeIndexUsage(): Promise<{
    unused: Array<{ collection: string; index: string; reason: string }>;
    redundant: Array<{ collection: string; indexes: string[]; reason: string }>;
    recommendations: string[];
  }> {
    try {
      const unused: Array<{ collection: string; index: string; reason: string }> = [];
      const redundant: Array<{ collection: string; indexes: string[]; reason: string }> = [];
      const recommendations: string[] = [];
      
      for (const [collectionName, indexes] of this.existingIndexes) {
        // Get index stats from MongoDB
        const stats = await this.getIndexUsageStats(collectionName);
        
        for (const index of indexes) {
          const indexStats = stats.find(s => s.name === index.name);
          
          // Check for unused indexes
          if (indexStats && indexStats.accesses.ops === 0 && index.name !== '_id_') {
            unused.push({
              collection: collectionName,
              index: index.name,
              reason: 'Index has never been used'
            });
          }
          
          // Check for low usage indexes
          if (indexStats && indexStats.accesses.ops < 10 && index.name !== '_id_') {
            unused.push({
              collection: collectionName,
              index: index.name,
              reason: `Low usage: ${indexStats.accesses.ops} operations`
            });
          }
        }
        
        // Check for redundant indexes
        const redundantIndexes = this.findRedundantIndexes(indexes);
        redundant.push(...redundantIndexes.map(group => ({
          collection: collectionName,
          indexes: group,
          reason: 'Redundant index - covered by another index'
        })));
      }
      
      // Generate recommendations
      if (unused.length > 0) {
        recommendations.push(`Remove ${unused.length} unused indexes to save storage space`);
      }
      
      if (redundant.length > 0) {
        recommendations.push(`Consolidate ${redundant.length} redundant index groups`);
      }
      
      return { unused, redundant, recommendations };
      
    } catch (error) {
      loggingService.error('Failed to analyze index usage', error);
      return { unused: [], redundant: [], recommendations: [] };
    }
  }

  /**
   * Get comprehensive index statistics
   */
  async getIndexStatistics(): Promise<IndexStats> {
    try {
      await this.updateIndexStats();
      
      // Calculate efficiency metrics
      this.stats.indexEfficiency = this.calculateOverallEfficiency();
      this.stats.recommendationsCount = Array.from(this.recommendations.values())
        .reduce((sum, recs) => sum + recs.length, 0);
      
      return { ...this.stats };
      
    } catch (error) {
      loggingService.error('Failed to get index statistics', error);
      return this.stats;
    }
  }

  /**
   * Optimize indexes for a specific model
   */
  async optimizeModelIndexes(modelName: string): Promise<{
    recommendations: IndexRecommendation[];
    usage: any;
    optimization: {
      suggested: number;
      redundant: number;
      unused: number;
    };
  }> {
    try {
      const recommendations = await this.generateRecommendations(modelName);
      const usage = await this.analyzeIndexUsage();
      
      const modelUsage = usage.unused.filter(u => u.collection === modelName.toLowerCase() + 's');
      const modelRedundant = usage.redundant.filter(r => r.collection === modelName.toLowerCase() + 's');
      
      return {
        recommendations,
        usage: {
          unused: modelUsage,
          redundant: modelRedundant
        },
        optimization: {
          suggested: recommendations.length,
          redundant: modelRedundant.length,
          unused: modelUsage.length
        }
      };
      
    } catch (error) {
      loggingService.error('Failed to optimize model indexes', error, { modelName });
      throw error;
    }
  }

  // Private helper methods

  private initializeStats(): IndexStats {
    return {
      totalIndexes: 0,
      compoundIndexes: 0,
      unusedIndexes: 0,
      redundantIndexes: 0,
      totalIndexSize: 0,
      indexEfficiency: 0,
      recommendationsCount: 0,
      modelStats: {}
    };
  }

  private calculateIndexPriority(index: any): 'critical' | 'high' | 'medium' | 'low' {
    if (index.name === '_id_') return 'critical';
    if (index.unique) return 'high';
    if (Object.keys(index.key).length > 2) return 'medium';
    return 'low';
  }

  private extractQueryPattern(modelName: string, query: any, options: any): Omit<QueryPattern, 'frequency' | 'averageTime'> {
    const filterFields = this.extractFields(query);
    const sortFields = options?.sort ? Object.keys(options.sort) : [];
    const projectionFields = options?.select ? Object.keys(options.select) : [];
    
    return {
      fields: [...new Set([...filterFields, ...sortFields])],
      operations: this.extractOperations(query),
      modelName,
      sortFields,
      filterFields,
      projectionFields
    };
  }

  private extractFields(query: any, prefix = ''): string[] {
    const fields: string[] = [];
    
    if (typeof query !== 'object' || query === null) {
      return fields;
    }
    
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('$')) {
        if (Array.isArray(value)) {
          for (const item of value) {
            fields.push(...this.extractFields(item, prefix));
          }
        } else if (typeof value === 'object') {
          fields.push(...this.extractFields(value, prefix));
        }
      } else {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        fields.push(fieldPath);
        
        if (typeof value === 'object' && !Array.isArray(value)) {
          fields.push(...this.extractFields(value, fieldPath));
        }
      }
    }
    
    return fields;
  }

  private extractOperations(query: any): string[] {
    const operations: string[] = [];
    const queryString = JSON.stringify(query);
    
    const operatorPattern = /\$(\w+)/g;
    let match;
    
    while ((match = operatorPattern.exec(queryString)) !== null) {
      operations.push(match[1]);
    }
    
    return [...new Set(operations)];
  }

  private generatePatternKey(pattern: Omit<QueryPattern, 'frequency' | 'averageTime'>): string {
    return `${pattern.modelName}:${pattern.fields.sort().join(',')}:${pattern.operations.sort().join(',')}`;
  }

  private async generateModelRecommendations(
    modelName: string,
    patterns: QueryPattern[]
  ): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];
    
    // Group patterns by field combinations
    const fieldGroups = new Map<string, QueryPattern[]>();
    
    for (const pattern of patterns) {
      const key = pattern.fields.sort().join(',');
      if (!fieldGroups.has(key)) {
        fieldGroups.set(key, []);
      }
      fieldGroups.get(key)!.push(pattern);
    }
    
    // Generate recommendations for each field group
    for (const [fieldCombo, groupPatterns] of fieldGroups) {
      const totalFrequency = groupPatterns.reduce((sum, p) => sum + p.frequency, 0);
      const avgTime = groupPatterns.reduce((sum, p) => sum + p.averageTime, 0) / groupPatterns.length;
      
      // Skip if low impact
      if (totalFrequency < 10 || avgTime < 100) continue;
      
      const fields = fieldCombo.split(',');
      const recommendation = await this.createIndexRecommendation(
        modelName,
        fields,
        groupPatterns,
        totalFrequency,
        avgTime
      );
      
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }
    
    return recommendations;
  }

  private async createIndexRecommendation(
    modelName: string,
    fields: string[],
    patterns: QueryPattern[],
    frequency: number,
    avgTime: number
  ): Promise<IndexRecommendation | null> {
    try {
      // Check if index already exists
      const collectionName = modelName.toLowerCase() + 's';
      const existingIndexes = this.existingIndexes.get(collectionName) || [];
      
      const indexFields = this.optimizeFieldOrder(fields, patterns);
      const indexKey = indexFields.reduce((acc, field) => {
        acc[field] = 1;
        return acc;
      }, {} as Record<string, 1>);
      
      // Check for existing similar indexes
      const similarIndex = existingIndexes.find(index => 
        this.indexCoversFields(index.fields, indexKey)
      );
      
      if (similarIndex) {
        return null; // Index already exists or is covered
      }
      
      const indexConfig: IndexConfig = {
        name: `idx_${fields.join('_')}`,
        fields: indexKey,
        options: {
          background: true
        },
        priority: this.calculateRecommendationPriority(frequency, avgTime),
        usage: {
          frequency,
          avgExecutionTime: avgTime,
          lastUsed: new Date()
        },
        impact: {
          estimatedSpeedup: this.estimateSpeedup(avgTime, fields.length),
          storageOverhead: this.estimateStorageOverhead(fields.length),
          maintenanceCost: this.estimateMaintenanceCost(fields.length)
        }
      };
      
      const reasoning = this.generateReasoningForIndex(patterns, frequency, avgTime);
      const benefits = this.generateBenefitsForIndex(indexConfig);
      const costs = this.generateCostsForIndex(indexConfig);
      
      return {
        modelName,
        indexConfig,
        reasoning,
        benefits,
        costs,
        estimatedImpact: {
          performanceGain: indexConfig.impact.estimatedSpeedup,
          storageIncrease: indexConfig.impact.storageOverhead,
          writePerformanceImpact: indexConfig.impact.maintenanceCost
        }
      };
      
    } catch (error) {
      loggingService.error('Failed to create index recommendation', error);
      return null;
    }
  }

  private optimizeFieldOrder(fields: string[], patterns: QueryPattern[]): string[] {
    // Order fields by selectivity and usage patterns
    const fieldStats = fields.map(field => {
      const usageCount = patterns.filter(p => p.filterFields?.includes(field)).length;
      const sortUsage = patterns.filter(p => p.sortFields?.includes(field)).length;
      
      return {
        field,
        filterUsage: usageCount,
        sortUsage,
        totalUsage: usageCount + sortUsage
      };
    });
    
    // Sort by total usage, then by filter usage
    return fieldStats
      .sort((a, b) => {
        if (b.totalUsage !== a.totalUsage) {
          return b.totalUsage - a.totalUsage;
        }
        return b.filterUsage - a.filterUsage;
      })
      .map(stat => stat.field);
  }

  private calculateRecommendationPriority(
    frequency: number,
    avgTime: number
  ): 'critical' | 'high' | 'medium' | 'low' {
    const impact = frequency * avgTime;
    
    if (impact > 100000) return 'critical';
    if (impact > 50000) return 'high';
    if (impact > 10000) return 'medium';
    return 'low';
  }

  private estimateSpeedup(avgTime: number, fieldCount: number): number {
    // Simplified speedup estimation
    const baseSpeedup = Math.min(avgTime / 100, 10); // Cap at 10x speedup
    const complexityFactor = Math.max(1, fieldCount / 3);
    return baseSpeedup * complexityFactor;
  }

  private estimateStorageOverhead(fieldCount: number): number {
    // Estimate storage overhead in MB
    return fieldCount * 0.5;
  }

  private estimateMaintenanceCost(fieldCount: number): number {
    // Estimate write performance impact (percentage)
    return Math.min(fieldCount * 2, 15);
  }

  private indexCoversFields(existingFields: any, newFields: any): boolean {
    const existingKeys = Object.keys(existingFields);
    const newKeys = Object.keys(newFields);
    
    // Check if all new fields are covered by existing index (in order)
    let existingIndex = 0;
    for (const newKey of newKeys) {
      while (existingIndex < existingKeys.length && existingKeys[existingIndex] !== newKey) {
        existingIndex++;
      }
      if (existingIndex >= existingKeys.length) {
        return false;
      }
      existingIndex++;
    }
    
    return true;
  }

  private generateReasoningForIndex(patterns: QueryPattern[], frequency: number, avgTime: number): string[] {
    const reasoning: string[] = [];
    
    reasoning.push(`Query executed ${frequency} times with average duration ${avgTime}ms`);
    
    const hasFilters = patterns.some(p => p.filterFields && p.filterFields.length > 0);
    const hasSorting = patterns.some(p => p.sortFields && p.sortFields.length > 0);
    
    if (hasFilters) {
      reasoning.push('Queries include filter conditions that would benefit from indexing');
    }
    
    if (hasSorting) {
      reasoning.push('Queries include sorting that would benefit from indexed field order');
    }
    
    const avgImpact = frequency * avgTime;
    if (avgImpact > 50000) {
      reasoning.push('High impact query pattern - significant performance improvement expected');
    }
    
    return reasoning;
  }

  private generateBenefitsForIndex(config: IndexConfig): string[] {
    const benefits: string[] = [];
    
    benefits.push(`Estimated ${config.impact.estimatedSpeedup}x speedup for matching queries`);
    benefits.push('Reduced CPU usage for query execution');
    benefits.push('Improved application response times');
    
    if (config.priority === 'critical' || config.priority === 'high') {
      benefits.push('High-impact performance improvement');
    }
    
    return benefits;
  }

  private generateCostsForIndex(config: IndexConfig): string[] {
    const costs: string[] = [];
    
    costs.push(`Estimated ${config.impact.storageOverhead}MB additional storage`);
    costs.push(`${config.impact.maintenanceCost}% impact on write operations`);
    costs.push('Additional memory usage for index maintenance');
    
    return costs;
  }

  private async createIndex(
    modelName: string,
    config: IndexConfig,
    options: { dryRun?: boolean; background?: boolean }
  ): Promise<{ created: boolean; reason?: string }> {
    try {
      const collectionName = modelName.toLowerCase() + 's';
      
      if (options.dryRun) {
        loggingService.info('Dry run: would create index', {
          collection: collectionName,
          index: config.name,
          fields: config.fields
        });
        return { created: false, reason: 'Dry run mode' };
      }
      
      const indexOptions = {
        ...config.options,
        background: options.background ?? true,
        name: config.name
      };
      
      await this.connection.db.collection(collectionName).createIndex(config.fields, indexOptions);
      
      loggingService.info('Index created successfully', {
        collection: collectionName,
        index: config.name,
        fields: config.fields
      });
      
      return { created: true };
      
    } catch (error) {
      loggingService.error('Failed to create index', error, {
        modelName,
        indexName: config.name
      });
      throw error;
    }
  }

  private async updateIndexStats(): Promise<void> {
    try {
      let totalIndexes = 0;
      let compoundIndexes = 0;
      let totalSize = 0;
      
      for (const [collectionName, indexes] of this.existingIndexes) {
        totalIndexes += indexes.length;
        compoundIndexes += indexes.filter(idx => Object.keys(idx.fields).length > 1).length;
        
        // Get collection stats
        const stats = await this.connection.db.collection(collectionName).stats();
        totalSize += stats.totalIndexSize || 0;
        
        // Update model stats
        this.stats.modelStats[collectionName] = {
          indexCount: indexes.length,
          totalSize: stats.totalIndexSize || 0,
          efficiency: this.calculateModelEfficiency(indexes),
          recommendations: this.recommendations.get(collectionName)?.length || 0
        };
      }
      
      this.stats.totalIndexes = totalIndexes;
      this.stats.compoundIndexes = compoundIndexes;
      this.stats.totalIndexSize = totalSize;
      
    } catch (error) {
      loggingService.error('Failed to update index stats', error);
    }
  }

  private calculateModelEfficiency(indexes: IndexConfig[]): number {
    if (indexes.length === 0) return 0;
    
    const usedIndexes = indexes.filter(idx => idx.usage.frequency > 0).length;
    return usedIndexes / indexes.length;
  }

  private calculateOverallEfficiency(): number {
    const modelEfficiencies = Object.values(this.stats.modelStats).map(stats => stats.efficiency);
    
    if (modelEfficiencies.length === 0) return 0;
    
    return modelEfficiencies.reduce((sum, eff) => sum + eff, 0) / modelEfficiencies.length;
  }

  private async getIndexUsageStats(collectionName: string): Promise<any[]> {
    try {
      const result = await this.connection.db.collection(collectionName).aggregate([
        { $indexStats: {} }
      ]).toArray();
      
      return result;
    } catch (error) {
      loggingService.warn('Failed to get index usage stats', error, { collectionName });
      return [];
    }
  }

  private findRedundantIndexes(indexes: IndexConfig[]): string[][] {
    const redundantGroups: string[][] = [];
    
    for (let i = 0; i < indexes.length; i++) {
      for (let j = i + 1; j < indexes.length; j++) {
        const index1 = indexes[i];
        const index2 = indexes[j];
        
        if (this.isRedundant(index1, index2)) {
          redundantGroups.push([index1.name, index2.name]);
        }
      }
    }
    
    return redundantGroups;
  }

  private isRedundant(index1: IndexConfig, index2: IndexConfig): boolean {
    const keys1 = Object.keys(index1.fields);
    const keys2 = Object.keys(index2.fields);
    
    // Simple redundancy check - one index covers another
    return this.indexCoversFields(index1.fields, index2.fields) ||
           this.indexCoversFields(index2.fields, index1.fields);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async loadQueryPatterns(): Promise<void> {
    try {
      const cached = await redisService.get<Record<string, QueryPattern>>(
        CachePattern.COMPUTED_DATA,
        'db_query_patterns'
      );
      
      if (cached) {
        this.queryPatterns = new Map(Object.entries(cached));
        loggingService.debug('Loaded query patterns from cache', {
          patternsCount: this.queryPatterns.size
        });
      }
    } catch (error) {
      loggingService.warn('Failed to load query patterns from cache', error);
    }
  }

  private async cacheQueryPatterns(): Promise<void> {
    try {
      await redisService.set(
        CachePattern.COMPUTED_DATA,
        'db_query_patterns',
        Object.fromEntries(this.queryPatterns),
        {
          ttl: 3600, // 1 hour
          tags: ['database', 'patterns'],
          strategy: CacheStrategy.WRITE_THROUGH
        }
      );
    } catch (error) {
      loggingService.warn('Failed to cache query patterns', error);
    }
  }

  private setupQueryPatternTracking(): void {
    // This would integrate with the query performance middleware
    // to automatically track query patterns
  }

  private setupPeriodicAnalysis(): void {
    // Run analysis every hour
    setInterval(async () => {
      try {
        await this.generateRecommendations();
        await this.analyzeIndexUsage();
        
        monitoring.setGauge('database_total_indexes', this.stats.totalIndexes);
        monitoring.setGauge('database_index_efficiency', this.stats.indexEfficiency);
        monitoring.setGauge('database_index_recommendations', this.stats.recommendationsCount);
        
      } catch (error) {
        loggingService.error('Periodic index analysis failed', error);
      }
    }, 3600000); // 1 hour
  }
}

// Export singleton instance
export const databaseIndexingService = new DatabaseIndexingService();

export default databaseIndexingService;