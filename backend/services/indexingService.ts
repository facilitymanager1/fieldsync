import mongoose from 'mongoose';

export interface IndexConfig {
  collection: string;
  indexes: Array<{
    fields: Record<string, 1 | -1 | 'text'>;
    options?: mongoose.IndexOptions;
    priority: 'high' | 'medium' | 'low';
    description: string;
  }>;
}

class IndexingService {
  private indexConfigurations: IndexConfig[] = [
    {
      collection: 'users',
      indexes: [
        {
          fields: { email: 1 },
          options: { unique: true, background: true },
          priority: 'high',
          description: 'Unique email lookup for authentication'
        },
        {
          fields: { role: 1, isActive: 1 },
          options: { background: true },
          priority: 'high',
          description: 'Role-based queries with active status'
        },
        {
          fields: { lastLogin: -1 },
          options: { background: true },
          priority: 'medium',
          description: 'Recent login tracking'
        },
        {
          fields: { 'profile.department': 1, 'profile.designation': 1 },
          options: { background: true },
          priority: 'medium',
          description: 'Department and designation filtering'
        }
      ]
    },
    {
      collection: 'tickets',
      indexes: [
        {
          fields: { status: 1, priority: 1, createdAt: -1 },
          options: { background: true },
          priority: 'high',
          description: 'Ticket dashboard queries'
        },
        {
          fields: { assignedTo: 1, status: 1 },
          options: { background: true },
          priority: 'high',
          description: 'User assigned tickets'
        },
        {
          fields: { createdBy: 1, createdAt: -1 },
          options: { background: true },
          priority: 'medium',
          description: 'User created tickets timeline'
        },
        {
          fields: { 'location.coordinates': '2dsphere' },
          options: { background: true },
          priority: 'medium',
          description: 'Geospatial ticket queries'
        },
        {
          fields: { title: 'text', description: 'text', tags: 'text' },
          options: { background: true },
          priority: 'low',
          description: 'Full-text search on tickets'
        }
      ]
    },
    {
      collection: 'shifts',
      indexes: [
        {
          fields: { userId: 1, startTime: -1 },
          options: { background: true },
          priority: 'high',
          description: 'User shift history'
        },
        {
          fields: { status: 1, startTime: 1 },
          options: { background: true },
          priority: 'high',
          description: 'Active shifts monitoring'
        },
        {
          fields: { 'geofence.id': 1, startTime: -1 },
          options: { background: true },
          priority: 'medium',
          description: 'Geofence-based shift queries'
        }
      ]
    },
    {
      collection: 'locations',
      indexes: [
        {
          fields: { userId: 1, timestamp: -1 },
          options: { background: true },
          priority: 'high',
          description: 'User location tracking'
        },
        {
          fields: { coordinates: '2dsphere' },
          options: { background: true },
          priority: 'high',
          description: 'Geospatial location queries'
        },
        {
          fields: { timestamp: -1 },
          options: { background: true, expireAfterSeconds: 2592000 }, // 30 days
          priority: 'medium',
          description: 'Location data TTL'
        }
      ]
    },
    {
      collection: 'geofences',
      indexes: [
        {
          fields: { 'area.coordinates': '2dsphere' },
          options: { background: true },
          priority: 'high',
          description: 'Geofence area queries'
        },
        {
          fields: { isActive: 1, type: 1 },
          options: { background: true },
          priority: 'high',
          description: 'Active geofence filtering'
        }
      ]
    },
    {
      collection: 'auditlogs',
      indexes: [
        {
          fields: { userId: 1, timestamp: -1 },
          options: { background: true },
          priority: 'medium',
          description: 'User audit trail'
        },
        {
          fields: { action: 1, timestamp: -1 },
          options: { background: true },
          priority: 'medium',
          description: 'Action-based audit queries'
        },
        {
          fields: { timestamp: -1 },
          options: { background: true, expireAfterSeconds: 7776000 }, // 90 days
          priority: 'low',
          description: 'Audit log TTL'
        }
      ]
    },
    {
      collection: 'notifications',
      indexes: [
        {
          fields: { userId: 1, isRead: 1, createdAt: -1 },
          options: { background: true },
          priority: 'high',
          description: 'User notification queries'
        },
        {
          fields: { scheduledFor: 1, status: 1 },
          options: { background: true },
          priority: 'medium',
          description: 'Scheduled notification processing'
        }
      ]
    },
    {
      collection: 'expenses',
      indexes: [
        {
          fields: { userId: 1, submittedAt: -1 },
          options: { background: true },
          priority: 'high',
          description: 'User expense reports'
        },
        {
          fields: { status: 1, submittedAt: -1 },
          options: { background: true },
          priority: 'high',
          description: 'Expense approval workflow'
        },
        {
          fields: { 'expense.category': 1, submittedAt: -1 },
          options: { background: true },
          priority: 'medium',
          description: 'Category-based expense analysis'
        }
      ]
    },
    {
      collection: 'meetings',
      indexes: [
        {
          fields: { 'attendees.userId': 1, scheduledAt: -1 },
          options: { background: true },
          priority: 'high',
          description: 'User meeting schedule'
        },
        {
          fields: { status: 1, scheduledAt: 1 },
          options: { background: true },
          priority: 'high',
          description: 'Upcoming meetings'
        }
      ]
    },
    {
      collection: 'slas',
      indexes: [
        {
          fields: { ticketId: 1 },
          options: { unique: true, background: true },
          priority: 'high',
          description: 'SLA per ticket'
        },
        {
          fields: { status: 1, dueDate: 1 },
          options: { background: true },
          priority: 'high',
          description: 'SLA monitoring'
        }
      ]
    }
  ];

  /**
   * Create all indexes for optimal performance
   */
  async createAllIndexes(): Promise<void> {
    console.log('🔍 Starting index creation process...');
    
    const results = await Promise.allSettled(
      this.indexConfigurations.map(config => this.createIndexesForCollection(config))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Index creation completed: ${successful} successful, ${failed} failed`);
    
    if (failed > 0) {
      console.warn('⚠️ Some indexes failed to create. Check logs for details.');
    }
  }

  /**
   * Create indexes for a specific collection
   */
  private async createIndexesForCollection(config: IndexConfig): Promise<void> {
    try {
      const db = mongoose.connection.db;
      const collection = db.collection(config.collection);

      console.log(`📊 Creating indexes for ${config.collection}...`);

      // Sort by priority: high > medium > low
      const sortedIndexes = config.indexes.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      for (const indexConfig of sortedIndexes) {
        try {
          await collection.createIndex(indexConfig.fields, indexConfig.options);
          console.log(`  ✅ ${indexConfig.description}`);
        } catch (error) {
          console.error(`  ❌ Failed to create index: ${indexConfig.description}`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to create indexes for collection ${config.collection}:`, error);
      throw error;
    }
  }

  /**
   * Analyze index usage and performance
   */
  async analyzeIndexUsage(): Promise<any> {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const analysis: any = {};

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      try {
        const collection = db.collection(collectionName);
        const indexStats = await collection.aggregate([{ $indexStats: {} }]).toArray();
        
        analysis[collectionName] = {
          totalIndexes: indexStats.length,
          indexUsage: indexStats.map(stat => ({
            name: stat.name,
            usageCount: stat.accesses?.ops || 0,
            lastUsed: stat.accesses?.since || null,
            size: stat.size || 0
          }))
        };
      } catch (error) {
        console.error(`Error analyzing indexes for ${collectionName}:`, error);
      }
    }

    return analysis;
  }

  /**
   * Get slow operations from MongoDB profiler
   */
  async getSlowOperations(minMs: number = 100): Promise<any[]> {
    try {
      const db = mongoose.connection.db;
      
      // Enable profiling for slow operations
      await db.command({ profile: 2, slowms: minMs });
      
      // Get slow operations from system.profile
      const slowOps = await db.collection('system.profile')
        .find({ ts: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
        .sort({ ts: -1 })
        .limit(100)
        .toArray();

      return slowOps.map(op => ({
        operation: op.command,
        duration: op.millis,
        timestamp: op.ts,
        namespace: op.ns,
        planSummary: op.planSummary
      }));
    } catch (error) {
      console.error('Error getting slow operations:', error);
      return [];
    }
  }

  /**
   * Suggest additional indexes based on query patterns
   */
  async suggestIndexes(): Promise<string[]> {
    const suggestions: string[] = [];
    const slowOps = await this.getSlowOperations(50);

    // Analyze slow operations for index suggestions
    slowOps.forEach(op => {
      if (op.operation?.find && !op.planSummary?.includes('IXSCAN')) {
        const filter = op.operation.find;
        const fields = Object.keys(filter || {});
        
        if (fields.length > 0) {
          suggestions.push(
            `Consider adding index on ${op.namespace}: { ${fields.map(f => `"${f}": 1`).join(', ')} }`
          );
        }
      }
    });

    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Drop unused indexes to save space
   */
  async dropUnusedIndexes(dryRun: boolean = true): Promise<string[]> {
    const analysis = await this.analyzeIndexUsage();
    const toDrop: string[] = [];

    for (const [collection, stats] of Object.entries(analysis as any)) {
      const unusedIndexes = stats.indexUsage.filter((index: any) => 
        index.usageCount === 0 && 
        index.name !== '_id_' && // Never drop _id index
        !index.name.includes('unique') // Keep unique indexes
      );

      for (const index of unusedIndexes) {
        const dropCommand = `db.${collection}.dropIndex("${index.name}")`;
        toDrop.push(dropCommand);

        if (!dryRun) {
          try {
            const db = mongoose.connection.db;
            await db.collection(collection).dropIndex(index.name);
            console.log(`Dropped unused index: ${collection}.${index.name}`);
          } catch (error) {
            console.error(`Failed to drop index ${collection}.${index.name}:`, error);
          }
        }
      }
    }

    if (dryRun && toDrop.length > 0) {
      console.log('Unused indexes that could be dropped:');
      toDrop.forEach(cmd => console.log(`  ${cmd}`));
    }

    return toDrop;
  }

  /**
   * Generate index creation script
   */
  generateIndexScript(): string {
    let script = '// MongoDB Index Creation Script\n// Generated by FieldSync Indexing Service\n\n';
    
    this.indexConfigurations.forEach(config => {
      script += `// ${config.collection.toUpperCase()} COLLECTION\n`;
      
      config.indexes.forEach(index => {
        script += `// ${index.description} (Priority: ${index.priority})\n`;
        script += `db.${config.collection}.createIndex(`;
        script += JSON.stringify(index.fields, null, 2);
        
        if (index.options && Object.keys(index.options).length > 0) {
          script += `, ${JSON.stringify(index.options, null, 2)}`;
        }
        
        script += ');\n\n';
      });
      
      script += '\n';
    });

    return script;
  }

  /**
   * Health check for indexing service
   */
  async healthCheck(): Promise<{
    isHealthy: boolean;
    collections: number;
    totalIndexes: number;
    issues: string[];
  }> {
    try {
      const analysis = await this.analyzeIndexUsage();
      const collections = Object.keys(analysis).length;
      const totalIndexes = Object.values(analysis as any)
        .reduce((sum: number, stats: any) => sum + stats.totalIndexes, 0);

      const issues: string[] = [];
      
      // Check for collections without proper indexes
      this.indexConfigurations.forEach(config => {
        if (!analysis[config.collection]) {
          issues.push(`Collection ${config.collection} not found or has no indexes`);
        }
      });

      return {
        isHealthy: issues.length === 0,
        collections,
        totalIndexes,
        issues
      };
    } catch (error) {
      return {
        isHealthy: false,
        collections: 0,
        totalIndexes: 0,
        issues: [`Health check failed: ${error}`]
      };
    }
  }

  /**
   * Get index configuration for a specific collection
   */
  getIndexConfig(collection: string): IndexConfig | undefined {
    return this.indexConfigurations.find(config => config.collection === collection);
  }

  /**
   * Add or update index configuration
   */
  updateIndexConfig(collection: string, indexes: IndexConfig['indexes']): void {
    const existingIndex = this.indexConfigurations.findIndex(config => config.collection === collection);
    
    if (existingIndex >= 0) {
      this.indexConfigurations[existingIndex].indexes = indexes;
    } else {
      this.indexConfigurations.push({ collection, indexes });
    }
  }
}

export default new IndexingService();