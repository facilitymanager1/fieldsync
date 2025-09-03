/**
 * Database Index Optimization Service
 * Comprehensive database indexing and query optimization for MongoDB collections
 */

import mongoose from 'mongoose';
import loggingService from './loggingService';
import { monitoring } from './monitoringService';

interface IndexDefinition {
  collection: string;
  name: string;
  fields: Record<string, 1 | -1 | 'text' | '2dsphere'>;
  options?: {
    unique?: boolean;
    sparse?: boolean;
    partialFilterExpression?: Record<string, any>;
    expireAfterSeconds?: number;
    background?: boolean;
    collation?: Record<string, any>;
  };
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface AggregationPipeline {
  collection: string;
  name: string;
  pipeline: any[];
  description: string;
  useCase: string;
  estimatedPerformanceGain: string;
}

/**
 * Database Index Service for performance optimization
 */
export class DatabaseIndexService {
  private indexDefinitions: IndexDefinition[] = [];
  private aggregationPipelines: AggregationPipeline[] = [];

  constructor() {
    this.initializeIndexDefinitions();
    this.initializeAggregationPipelines();
  }

  /**
   * Initialize comprehensive index definitions
   */
  private initializeIndexDefinitions(): void {
    this.indexDefinitions = [
      // User Collection Indexes
      {
        collection: 'users',
        name: 'email_unique',
        fields: { email: 1 },
        options: { unique: true, background: true },
        description: 'Unique index on email for authentication',
        priority: 'critical'
      },
      {
        collection: 'users',
        name: 'role_active_compound',
        fields: { role: 1, isActive: 1 },
        options: { background: true },
        description: 'Compound index for role-based queries with active status',
        priority: 'high'
      },
      {
        collection: 'users',
        name: 'lastLogin_active',
        fields: { lastLogin: -1, isActive: 1 },
        options: { background: true },
        description: 'Index for user activity tracking and reporting',
        priority: 'medium'
      },
      {
        collection: 'users',
        name: 'staffId_clientId',
        fields: { staffId: 1, clientId: 1 },
        options: { sparse: true, background: true },
        description: 'Index for linking users to staff/client profiles',
        priority: 'medium'
      },

      // Shift Collection Indexes
      {
        collection: 'advancedshifts',
        name: 'user_date_compound',
        fields: { userId: 1, startTime: -1 },
        options: { background: true },
        description: 'Primary index for shift queries by user and date',
        priority: 'critical'
      },
      {
        collection: 'advancedshifts',
        name: 'status_startTime',
        fields: { status: 1, startTime: -1 },
        options: { background: true },
        description: 'Index for filtering shifts by status and time',
        priority: 'high'
      },
      {
        collection: 'advancedshifts',
        name: 'site_visits_compound',
        fields: { 'siteVisits.siteId': 1, 'siteVisits.enterTime': -1 },
        options: { background: true },
        description: 'Index for site visit tracking and reporting',
        priority: 'high'
      },
      {
        collection: 'advancedshifts',
        name: 'geolocation_2dsphere',
        fields: { 'currentLocation.coordinates': '2dsphere' },
        options: { background: true },
        description: 'Geospatial index for location-based queries',
        priority: 'high'
      },
      {
        collection: 'advancedshifts',
        name: 'break_periods_analysis',
        fields: { 'breakPeriods.startTime': -1, 'breakPeriods.type': 1 },
        options: { background: true },
        description: 'Index for break analysis and compliance reporting',
        priority: 'medium'
      },

      // Ticket Collection Indexes
      {
        collection: 'tickets',
        name: 'assignee_status_priority',
        fields: { assignedTo: 1, status: 1, priority: -1 },
        options: { background: true },
        description: 'Compound index for ticket assignment and prioritization',
        priority: 'critical'
      },
      {
        collection: 'tickets',
        name: 'site_created_compound',
        fields: { siteId: 1, createdAt: -1 },
        options: { background: true },
        description: 'Index for site-specific ticket queries',
        priority: 'high'
      },
      {
        collection: 'tickets',
        name: 'due_date_status',
        fields: { dueDate: 1, status: 1 },
        options: { 
          background: true,
          partialFilterExpression: { dueDate: { $exists: true } }
        },
        description: 'Index for deadline tracking and overdue tickets',
        priority: 'high'
      },
      {
        collection: 'tickets',
        name: 'text_search',
        fields: { title: 'text', description: 'text', tags: 'text' },
        options: { background: true },
        description: 'Full-text search index for ticket content',
        priority: 'medium'
      },

      // Site Collection Indexes
      {
        collection: 'sites',
        name: 'client_active_compound',
        fields: { clientId: 1, isActive: 1 },
        options: { background: true },
        description: 'Index for client site queries',
        priority: 'high'
      },
      {
        collection: 'sites',
        name: 'location_2dsphere',
        fields: { 'location.coordinates': '2dsphere' },
        options: { background: true },
        description: 'Geospatial index for proximity-based site queries',
        priority: 'high'
      },
      {
        collection: 'sites',
        name: 'geofence_compound',
        fields: { 'geofence.enabled': 1, 'geofence.radius': 1 },
        options: { 
          background: true,
          partialFilterExpression: { 'geofence.enabled': true }
        },
        description: 'Index for geofence-enabled sites',
        priority: 'high'
      },

      // Staff Collection Indexes
      {
        collection: 'staffs',
        name: 'user_active_compound',
        fields: { userId: 1, isActive: 1 },
        options: { background: true },
        description: 'Index for active staff member queries',
        priority: 'high'
      },
      {
        collection: 'staffs',
        name: 'department_role_compound',
        fields: { department: 1, role: 1, isActive: 1 },
        options: { background: true },
        description: 'Index for organizational structure queries',
        priority: 'medium'
      },
      {
        collection: 'staffs',
        name: 'skills_certifications_text',
        fields: { 'skills.name': 'text', 'certifications.name': 'text' },
        options: { background: true },
        description: 'Text search for skills and certifications matching',
        priority: 'medium'
      },

      // Client Collection Indexes
      {
        collection: 'clients',
        name: 'active_tier_compound',
        fields: { isActive: 1, tier: 1 },
        options: { background: true },
        description: 'Index for client categorization and status',
        priority: 'medium'
      },

      // Audit Log Indexes (already comprehensive in auditLog.ts)
      {
        collection: 'auditlogs',
        name: 'compliance_query_compound',
        fields: { complianceFlags: 1, timestamp: -1, severity: 1 },
        options: { background: true },
        description: 'Compound index for compliance reporting queries',
        priority: 'high'
      },

      // SLA Collection Indexes
      {
        collection: 'slatrackers',
        name: 'entity_status_compound',
        fields: { entityType: 1, entityId: 1, status: 1 },
        options: { background: true },
        description: 'Index for SLA tracking by entity',
        priority: 'high'
      },
      {
        collection: 'slatrackers',
        name: 'breach_detection_compound',
        fields: { 'metrics.remainingTime': 1, status: 1, breached: 1 },
        options: { background: true },
        description: 'Index for SLA breach detection and monitoring',
        priority: 'critical'
      },

      // Meeting Minutes Indexes
      {
        collection: 'meetingminutes',
        name: 'date_type_compound',
        fields: { meetingDate: -1, meetingType: 1 },
        options: { background: true },
        description: 'Index for meeting queries by date and type',
        priority: 'medium'
      },

      // Analytics and Performance Indexes
      {
        collection: 'analytics',
        name: 'metric_date_compound',
        fields: { metricType: 1, date: -1 },
        options: { background: true },
        description: 'Index for analytics data retrieval',
        priority: 'medium'
      },

      // Notification Indexes
      {
        collection: 'notifications',
        name: 'recipient_unread_compound',
        fields: { recipientId: 1, read: 1, createdAt: -1 },
        options: { background: true },
        description: 'Index for user notification queries',
        priority: 'high'
      },

      // TTL Indexes for temporary data
      {
        collection: 'syncpayloads',
        name: 'ttl_cleanup',
        fields: { createdAt: 1 },
        options: { 
          expireAfterSeconds: 86400, // 24 hours
          background: true 
        },
        description: 'TTL index for automatic sync payload cleanup',
        priority: 'medium'
      }
    ];
  }

  /**
   * Initialize optimized aggregation pipelines
   */
  private initializeAggregationPipelines(): void {
    this.aggregationPipelines = [
      {
        collection: 'advancedshifts',
        name: 'shift_analytics_by_user',
        pipeline: [
          {
            $match: {
              startTime: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
              status: { $in: ['completed', 'in_progress'] }
            }
          },
          {
            $group: {
              _id: '$userId',
              totalShifts: { $sum: 1 },
              totalHours: { $sum: '$totalHours' },
              avgBreakTime: { $avg: '$totalBreakTime' },
              sitesVisited: { $addToSet: '$siteVisits.siteId' },
              lastShift: { $max: '$startTime' }
            }
          },
          {
            $addFields: {
              sitesCount: { $size: '$sitesVisited' },
              avgHoursPerShift: { $divide: ['$totalHours', '$totalShifts'] }
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'userInfo'
            }
          },
          {
            $sort: { totalHours: -1 }
          }
        ],
        description: 'User productivity analytics with shift summaries',
        useCase: 'Performance dashboards and reporting',
        estimatedPerformanceGain: '70% faster than individual queries'
      },

      {
        collection: 'tickets',
        name: 'sla_compliance_report',
        pipeline: [
          {
            $match: {
              createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }
          },
          {
            $lookup: {
              from: 'slatrackers',
              localField: '_id',
              foreignField: 'entityId',
              as: 'slaData'
            }
          },
          {
            $unwind: { path: '$slaData', preserveNullAndEmptyArrays: true }
          },
          {
            $group: {
              _id: '$priority',
              totalTickets: { $sum: 1 },
              breachedTickets: {
                $sum: { $cond: [{ $eq: ['$slaData.breached', true] }, 1, 0] }
              },
              avgResolutionTime: { $avg: '$slaData.metrics.elapsedTime' },
              onTimeTickets: {
                $sum: { $cond: [{ $eq: ['$slaData.breached', false] }, 1, 0] }
              }
            }
          },
          {
            $addFields: {
              complianceRate: {
                $multiply: [
                  { $divide: ['$onTimeTickets', '$totalTickets'] },
                  100
                ]
              }
            }
          },
          {
            $sort: { _id: 1 }
          }
        ],
        description: 'SLA compliance reporting by ticket priority',
        useCase: 'Performance monitoring and compliance reporting',
        estimatedPerformanceGain: '85% faster than separate queries'
      },

      {
        collection: 'sites',
        name: 'site_utilization_analysis',
        pipeline: [
          {
            $lookup: {
              from: 'advancedshifts',
              localField: '_id',
              foreignField: 'siteVisits.siteId',
              as: 'visits'
            }
          },
          {
            $addFields: {
              totalVisits: { $size: '$visits' },
              recentVisits: {
                $size: {
                  $filter: {
                    input: '$visits',
                    cond: {
                      $gte: [
                        '$$this.startTime',
                        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                      ]
                    }
                  }
                }
              }
            }
          },
          {
            $lookup: {
              from: 'tickets',
              localField: '_id',
              foreignField: 'siteId',
              as: 'tickets'
            }
          },
          {
            $addFields: {
              activeTickets: {
                $size: {
                  $filter: {
                    input: '$tickets',
                    cond: {
                      $in: ['$$this.status', ['open', 'in_progress', 'pending']]
                    }
                  }
                }
              }
            }
          },
          {
            $project: {
              name: 1,
              location: 1,
              clientId: 1,
              totalVisits: 1,
              recentVisits: 1,
              activeTickets: 1,
              utilizationScore: {
                $add: [
                  { $multiply: ['$recentVisits', 0.6] },
                  { $multiply: ['$activeTickets', 0.4] }
                ]
              }
            }
          },
          {
            $sort: { utilizationScore: -1 }
          }
        ],
        description: 'Site utilization and activity analysis',
        useCase: 'Resource allocation and site management',
        estimatedPerformanceGain: '60% faster than multiple collection queries'
      },

      {
        collection: 'users',
        name: 'user_activity_summary',
        pipeline: [
          {
            $match: { isActive: true }
          },
          {
            $lookup: {
              from: 'advancedshifts',
              localField: '_id',
              foreignField: 'userId',
              as: 'shifts'
            }
          },
          {
            $lookup: {
              from: 'tickets',
              localField: '_id',
              foreignField: 'assignedTo',
              as: 'assignedTickets'
            }
          },
          {
            $addFields: {
              recentShifts: {
                $size: {
                  $filter: {
                    input: '$shifts',
                    cond: {
                      $gte: [
                        '$$this.startTime',
                        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      ]
                    }
                  }
                }
              },
              activeTickets: {
                $size: {
                  $filter: {
                    input: '$assignedTickets',
                    cond: {
                      $in: ['$$this.status', ['open', 'in_progress', 'pending']]
                    }
                  }
                }
              }
            }
          },
          {
            $project: {
              email: 1,
              role: 1,
              'profile.firstName': 1,
              'profile.lastName': 1,
              lastLogin: 1,
              recentShifts: 1,
              activeTickets: 1,
              activityScore: {
                $add: [
                  { $multiply: ['$recentShifts', 2] },
                  '$activeTickets'
                ]
              }
            }
          },
          {
            $sort: { activityScore: -1 }
          }
        ],
        description: 'User activity and engagement summary',
        useCase: 'Team management and performance tracking',
        estimatedPerformanceGain: '75% faster than individual user queries'
      }
    ];
  }

  /**
   * Create all defined indexes
   */
  async createIndexes(): Promise<{
    success: boolean;
    created: number;
    failed: number;
    details: Array<{ collection: string; name: string; status: string; error?: string }>;
  }> {
    const timer = monitoring.startTimer('database_index_creation_duration');
    const results = {
      success: true,
      created: 0,
      failed: 0,
      details: [] as Array<{ collection: string; name: string; status: string; error?: string }>
    };

    try {
      loggingService.info('Starting database index creation', {
        totalIndexes: this.indexDefinitions.length
      });

      for (const indexDef of this.indexDefinitions) {
        try {
          const collection = mongoose.connection.db.collection(indexDef.collection);
          
          // Check if index already exists
          const existingIndexes = await collection.indexes();
          const indexExists = existingIndexes.some(idx => idx.name === indexDef.name);

          if (indexExists) {
            results.details.push({
              collection: indexDef.collection,
              name: indexDef.name,
              status: 'already_exists'
            });
            continue;
          }

          // Create the index
          await collection.createIndex(indexDef.fields, {
            name: indexDef.name,
            ...indexDef.options
          });

          results.created++;
          results.details.push({
            collection: indexDef.collection,
            name: indexDef.name,
            status: 'created'
          });

          loggingService.debug('Index created successfully', {
            collection: indexDef.collection,
            name: indexDef.name,
            priority: indexDef.priority
          });

        } catch (error) {
          results.failed++;
          results.success = false;
          results.details.push({
            collection: indexDef.collection,
            name: indexDef.name,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          loggingService.error('Failed to create index', error, {
            collection: indexDef.collection,
            name: indexDef.name
          });
        }
      }

      timer();
      monitoring.incrementCounter('database_indexes_created_total', results.created);
      monitoring.incrementCounter('database_indexes_failed_total', results.failed);

      loggingService.info('Database index creation completed', {
        created: results.created,
        failed: results.failed,
        total: this.indexDefinitions.length
      });

      return results;

    } catch (error) {
      timer();
      loggingService.error('Database index creation failed', error);
      results.success = false;
      return results;
    }
  }

  /**
   * Analyze existing indexes
   */
  async analyzeIndexes(): Promise<{
    collections: Array<{
      name: string;
      indexes: Array<{
        name: string;
        keys: Record<string, any>;
        size: number;
        usage?: any;
      }>;
      totalSize: number;
      totalIndexes: number;
    }>;
    recommendations: string[];
  }> {
    try {
      const timer = monitoring.startTimer('database_index_analysis_duration');
      const collections = [];
      const recommendations: string[] = [];

      const db = mongoose.connection.db;
      const collectionNames = await db.listCollections().toArray();

      for (const collInfo of collectionNames) {
        const collName = collInfo.name;
        const collection = db.collection(collName);

        try {
          // Get index information
          const indexes = await collection.indexes();
          const indexStats = await collection.aggregate([
            { $indexStats: {} }
          ]).toArray();

          let totalSize = 0;
          const indexDetails = indexes.map(idx => {
            const stats = indexStats.find(stat => stat.name === idx.name);
            const size = stats?.size || 0;
            totalSize += size;

            return {
              name: idx.name,
              keys: idx.key,
              size,
              usage: stats?.accesses
            };
          });

          collections.push({
            name: collName,
            indexes: indexDetails,
            totalSize,
            totalIndexes: indexes.length
          });

          // Generate recommendations
          if (indexes.length === 1) { // Only default _id index
            recommendations.push(`Consider adding performance indexes to collection: ${collName}`);
          }

          const unusedIndexes = indexDetails.filter(idx => 
            idx.name !== '_id_' && (!idx.usage || idx.usage.ops === 0)
          );
          
          if (unusedIndexes.length > 0) {
            recommendations.push(`Unused indexes in ${collName}: ${unusedIndexes.map(idx => idx.name).join(', ')}`);
          }

        } catch (error) {
          loggingService.warn('Failed to analyze collection indexes', error, { collection: collName });
        }
      }

      timer();
      
      return {
        collections,
        recommendations
      };

    } catch (error) {
      loggingService.error('Index analysis failed', error);
      return {
        collections: [],
        recommendations: ['Failed to analyze indexes - check database connection']
      };
    }
  }

  /**
   * Get optimized aggregation pipeline
   */
  getAggregationPipeline(collection: string, name: string): any[] | null {
    const pipeline = this.aggregationPipelines.find(
      p => p.collection === collection && p.name === name
    );
    return pipeline ? pipeline.pipeline : null;
  }

  /**
   * Execute optimized aggregation
   */
  async executeAggregation(
    collection: string, 
    pipelineName: string, 
    options?: any
  ): Promise<any[]> {
    const timer = monitoring.startTimer('aggregation_execution_duration');
    
    try {
      const pipeline = this.getAggregationPipeline(collection, pipelineName);
      if (!pipeline) {
        throw new Error(`Pipeline ${pipelineName} not found for collection ${collection}`);
      }

      const db = mongoose.connection.db;
      const coll = db.collection(collection);
      
      const result = await coll.aggregate(pipeline, {
        allowDiskUse: true,
        ...options
      }).toArray();

      timer();
      monitoring.incrementCounter('aggregation_executions_total', 1, {
        collection,
        pipeline: pipelineName,
        status: 'success'
      });

      loggingService.debug('Aggregation executed successfully', {
        collection,
        pipeline: pipelineName,
        resultCount: result.length
      });

      return result;

    } catch (error) {
      timer();
      monitoring.incrementCounter('aggregation_executions_total', 1, {
        collection,
        pipeline: pipelineName,
        status: 'error'
      });

      loggingService.error('Aggregation execution failed', error, {
        collection,
        pipeline: pipelineName
      });
      throw error;
    }
  }

  /**
   * Get all available aggregation pipelines
   */
  getAvailablePipelines(): Array<{
    collection: string;
    name: string;
    description: string;
    useCase: string;
    estimatedPerformanceGain: string;
  }> {
    return this.aggregationPipelines.map(({ pipeline, ...info }) => info);
  }

  /**
   * Optimize slow queries
   */
  async optimizeSlowQueries(): Promise<{
    analyzed: number;
    optimized: number;
    recommendations: string[];
  }> {
    try {
      const timer = monitoring.startTimer('slow_query_optimization_duration');
      const db = mongoose.connection.db;
      
      // Enable profiling for slow operations
      await db.admin().command({
        profile: 2,
        slowms: 100 // Profile operations slower than 100ms
      });

      // Get slow operations from profiler
      const profilerData = await db.collection('system.profile')
        .find({ ts: { $gte: new Date(Date.now() - 3600000) } }) // Last hour
        .sort({ ts: -1 })
        .limit(100)
        .toArray();

      const recommendations: string[] = [];
      let optimized = 0;

      for (const op of profilerData) {
        if (op.command && op.command.find) {
          const collection = op.command.find;
          const query = op.command.filter || {};
          
          // Analyze query patterns and suggest indexes
          const queryFields = Object.keys(query);
          if (queryFields.length > 0) {
            recommendations.push(
              `Consider compound index on ${collection}: {${queryFields.map(f => `${f}: 1`).join(', ')}}`
            );
          }
        }
      }

      // Disable profiling
      await db.admin().command({ profile: 0 });

      timer();
      
      return {
        analyzed: profilerData.length,
        optimized,
        recommendations: [...new Set(recommendations)] // Remove duplicates
      };

    } catch (error) {
      loggingService.error('Slow query optimization failed', error);
      return {
        analyzed: 0,
        optimized: 0,
        recommendations: ['Failed to analyze slow queries']
      };
    }
  }

  /**
   * Get index recommendations based on query patterns
   */
  getIndexRecommendations(): Array<{
    collection: string;
    suggestedIndex: Record<string, any>;
    reason: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
  }> {
    return [
      {
        collection: 'users',
        suggestedIndex: { 'profile.department': 1, role: 1, isActive: 1 },
        reason: 'Optimize department-based user queries with role filtering',
        priority: 'medium'
      },
      {
        collection: 'advancedshifts',
        suggestedIndex: { 'siteVisits.tasks.status': 1, 'siteVisits.siteId': 1 },
        reason: 'Improve task completion tracking across sites',
        priority: 'medium'
      },
      {
        collection: 'tickets',
        suggestedIndex: { tags: 1, status: 1, priority: 1 },
        reason: 'Enhanced ticket filtering and categorization',
        priority: 'high'
      }
    ];
  }
}

// Export singleton instance
export const databaseIndexService = new DatabaseIndexService();
export default databaseIndexService;