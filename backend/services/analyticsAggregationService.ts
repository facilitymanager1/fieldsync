/**
 * Analytics Aggregation Service
 * Optimized MongoDB aggregation pipelines for business intelligence and reporting
 */

import mongoose from 'mongoose';
import loggingService from './loggingService';
import { monitoring } from './monitoringService';
import businessCacheService from './businessCacheService';

interface AggregationResult {
  data: any[];
  metadata: {
    executionTime: number;
    documentCount: number;
    cached: boolean;
    cacheKey?: string;
  };
}

interface TimeRangeFilter {
  startDate: Date;
  endDate: Date;
}

interface AnalyticsFilters {
  userId?: string;
  siteId?: string;
  clientId?: string;
  role?: string;
  department?: string;
  timeRange?: TimeRangeFilter;
}

/**
 * Analytics Aggregation Service for optimized business intelligence queries
 */
export class AnalyticsAggregationService {

  /**
   * Get comprehensive shift analytics with performance metrics
   */
  async getShiftAnalytics(filters: AnalyticsFilters = {}): Promise<AggregationResult> {
    const timer = monitoring.startTimer('shift_analytics_aggregation_duration');
    const cacheKey = `shift_analytics_${JSON.stringify(filters)}`;
    
    try {
      // Check cache first
      const cached = await businessCacheService.getAnalyticsReport(cacheKey);
      if (cached) {
        timer();
        return {
          data: cached.data,
          metadata: {
            executionTime: 0,
            documentCount: cached.data.length,
            cached: true,
            cacheKey
          }
        };
      }

      const matchStage: any = {
        status: { $in: ['completed', 'in_progress'] }
      };

      if (filters.timeRange) {
        matchStage.startTime = {
          $gte: filters.timeRange.startDate,
          $lte: filters.timeRange.endDate
        };
      }

      if (filters.userId) {
        matchStage.userId = new mongoose.Types.ObjectId(filters.userId);
      }

      const pipeline = [
        { $match: matchStage },
        
        // Lookup user information
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },

        // Lookup site information for site visits
        {
          $lookup: {
            from: 'sites',
            localField: 'siteVisits.siteId',
            foreignField: '_id',
            as: 'siteInfo'
          }
        },

        // Group by user for comprehensive analytics
        {
          $group: {
            _id: '$userId',
            userEmail: { $first: '$user.email' },
            userName: { 
              $first: { 
                $concat: ['$user.profile.firstName', ' ', '$user.profile.lastName'] 
              }
            },
            userRole: { $first: '$user.role' },
            department: { $first: '$user.profile.department' },
            
            // Shift metrics
            totalShifts: { $sum: 1 },
            totalHours: { $sum: '$totalHours' },
            totalBreakTime: { $sum: '$totalBreakTime' },
            averageShiftLength: { $avg: '$totalHours' },
            
            // Site visit metrics
            totalSiteVisits: { $sum: { $size: '$siteVisits' } },
            uniqueSitesVisited: { $addToSet: '$siteVisits.siteId' },
            totalTimeOnSite: { $sum: { $sum: '$siteVisits.timeOnSite' } },
            
            // Break analysis
            totalBreaks: { $sum: { $size: '$breakPeriods' } },
            lunchBreaks: {
              $sum: {
                $size: {
                  $filter: {
                    input: '$breakPeriods',
                    cond: { $eq: ['$$this.type', 'lunch'] }
                  }
                }
              }
            },
            unauthorizedBreaks: {
              $sum: {
                $size: {
                  $filter: {
                    input: '$breakPeriods',
                    cond: { $eq: ['$$this.type', 'unauthorized'] }
                  }
                }
              }
            },
            
            // Performance metrics
            completedTasks: {
              $sum: {
                $sum: {
                  $map: {
                    input: '$siteVisits',
                    as: 'visit',
                    in: {
                      $size: {
                        $filter: {
                          input: '$$visit.tasks',
                          cond: { $eq: ['$$this.status', 'completed'] }
                        }
                      }
                    }
                  }
                }
              }
            },
            totalTasks: {
              $sum: {
                $sum: {
                  $map: {
                    input: '$siteVisits',
                    as: 'visit',
                    in: { $size: '$$visit.tasks' }
                  }
                }
              }
            },
            
            // Time tracking
            firstShiftDate: { $min: '$startTime' },
            lastShiftDate: { $max: '$startTime' },
            avgCheckInTime: { $avg: { $hour: '$startTime' } },
            avgCheckOutTime: { $avg: { $hour: '$endTime' } }
          }
        },

        // Calculate derived metrics
        {
          $addFields: {
            uniqueSitesCount: { $size: '$uniqueSitesVisited' },
            taskCompletionRate: {
              $cond: [
                { $gt: ['$totalTasks', 0] },
                { $multiply: [{ $divide: ['$completedTasks', '$totalTasks'] }, 100] },
                0
              ]
            },
            averageTimePerSite: {
              $cond: [
                { $gt: ['$totalSiteVisits', 0] },
                { $divide: ['$totalTimeOnSite', '$totalSiteVisits'] },
                0
              ]
            },
            breakTimePercentage: {
              $cond: [
                { $gt: ['$totalHours', 0] },
                { $multiply: [{ $divide: ['$totalBreakTime', '$totalHours'] }, 100] },
                0
              ]
            },
            productivityScore: {
              $multiply: [
                { $divide: ['$completedTasks', { $add: ['$totalTasks', 1] }] },
                100
              ]
            }
          }
        },

        // Sort by productivity score
        { $sort: { productivityScore: -1 } },

        // Project final structure
        {
          $project: {
            userId: '$_id',
            userEmail: 1,
            userName: 1,
            userRole: 1,
            department: 1,
            metrics: {
              shifts: {
                total: '$totalShifts',
                totalHours: { $round: ['$totalHours', 2] },
                averageLength: { $round: ['$averageShiftLength', 2] },
                firstDate: '$firstShiftDate',
                lastDate: '$lastShiftDate'
              },
              sites: {
                totalVisits: '$totalSiteVisits',
                uniqueSites: '$uniqueSitesCount',
                averageTimePerSite: { $round: [{ $divide: ['$averageTimePerSite', 3600] }, 2] } // Convert to hours
              },
              tasks: {
                completed: '$completedTasks',
                total: '$totalTasks',
                completionRate: { $round: ['$taskCompletionRate', 2] }
              },
              breaks: {
                total: '$totalBreaks',
                totalTime: { $round: ['$totalBreakTime', 2] },
                lunchBreaks: '$lunchBreaks',
                unauthorizedBreaks: '$unauthorizedBreaks',
                breakTimePercentage: { $round: ['$breakTimePercentage', 2] }
              },
              performance: {
                productivityScore: { $round: ['$productivityScore', 2] },
                avgCheckInTime: { $round: ['$avgCheckInTime', 0] },
                avgCheckOutTime: { $round: ['$avgCheckOutTime', 0] }
              }
            }
          }
        }
      ];

      const db = mongoose.connection.db;
      const collection = db.collection('advancedshifts');
      
      const startTime = Date.now();
      const result = await collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
      const executionTime = Date.now() - startTime;

      timer();

      // Cache the result
      await businessCacheService.setAnalyticsReport(cacheKey, {
        data: result,
        generatedAt: new Date(),
        filters
      });

      monitoring.incrementCounter('analytics_aggregations_total', 1, {
        type: 'shift_analytics',
        status: 'success'
      });

      loggingService.info('Shift analytics aggregation completed', {
        executionTime,
        documentCount: result.length,
        filters
      });

      return {
        data: result,
        metadata: {
          executionTime,
          documentCount: result.length,
          cached: false,
          cacheKey
        }
      };

    } catch (error) {
      timer();
      loggingService.error('Shift analytics aggregation failed', error, { filters });
      monitoring.incrementCounter('analytics_aggregations_total', 1, {
        type: 'shift_analytics',
        status: 'error'
      });
      throw error;
    }
  }

  /**
   * Get site performance analytics
   */
  async getSiteAnalytics(filters: AnalyticsFilters = {}): Promise<AggregationResult> {
    const timer = monitoring.startTimer('site_analytics_aggregation_duration');
    const cacheKey = `site_analytics_${JSON.stringify(filters)}`;

    try {
      const cached = await businessCacheService.getAnalyticsReport(cacheKey);
      if (cached) {
        timer();
        return {
          data: cached.data,
          metadata: {
            executionTime: 0,
            documentCount: cached.data.length,
            cached: true,
            cacheKey
          }
        };
      }

      const matchStage: any = { isActive: true };

      if (filters.clientId) {
        matchStage.clientId = new mongoose.Types.ObjectId(filters.clientId);
      }

      const pipeline = [
        { $match: matchStage },

        // Lookup client information
        {
          $lookup: {
            from: 'clients',
            localField: 'clientId',
            foreignField: '_id',
            as: 'client'
          }
        },
        { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },

        // Lookup recent shifts for this site
        {
          $lookup: {
            from: 'advancedshifts',
            let: { siteId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ['$$siteId', '$siteVisits.siteId'] },
                  ...(filters.timeRange ? {
                    startTime: {
                      $gte: filters.timeRange.startDate,
                      $lte: filters.timeRange.endDate
                    }
                  } : {})
                }
              }
            ],
            as: 'shifts'
          }
        },

        // Lookup tickets for this site
        {
          $lookup: {
            from: 'tickets',
            localField: '_id',
            foreignField: 'siteId',
            as: 'tickets'
          }
        },

        // Calculate site metrics
        {
          $addFields: {
            totalShifts: { $size: '$shifts' },
            totalVisits: {
              $sum: {
                $map: {
                  input: '$shifts',
                  as: 'shift',
                  in: {
                    $size: {
                      $filter: {
                        input: '$$shift.siteVisits',
                        cond: { $eq: ['$$this.siteId', '$_id'] }
                      }
                    }
                  }
                }
              }
            },
            totalTimeOnSite: {
              $sum: {
                $map: {
                  input: '$shifts',
                  as: 'shift',
                  in: {
                    $sum: {
                      $map: {
                        input: {
                          $filter: {
                            input: '$$shift.siteVisits',
                            cond: { $eq: ['$$this.siteId', '$_id'] }
                          }
                        },
                        as: 'visit',
                        in: '$$visit.timeOnSite'
                      }
                    }
                  }
                }
              }
            },
            uniqueWorkers: {
              $size: {
                $setUnion: {
                  $map: {
                    input: '$shifts',
                    as: 'shift',
                    in: '$$shift.userId'
                  }
                }
              }
            },
            openTickets: {
              $size: {
                $filter: {
                  input: '$tickets',
                  cond: { $in: ['$$this.status', ['open', 'in_progress', 'pending']] }
                }
              }
            },
            totalTickets: { $size: '$tickets' },
            urgentTickets: {
              $size: {
                $filter: {
                  input: '$tickets',
                  cond: { $eq: ['$$this.priority', 'urgent'] }
                }
              }
            }
          }
        },

        // Calculate performance scores
        {
          $addFields: {
            utilizationScore: {
              $multiply: [
                {
                  $cond: [
                    { $gt: ['$totalVisits', 0] },
                    { $add: [
                      { $multiply: ['$totalVisits', 0.4] },
                      { $multiply: ['$uniqueWorkers', 0.3] },
                      { $multiply: [{ $divide: ['$totalTimeOnSite', 3600] }, 0.3] }
                    ]},
                    0
                  ]
                },
                10
              ]
            },
            ticketResolutionRate: {
              $cond: [
                { $gt: ['$totalTickets', 0] },
                { 
                  $multiply: [
                    { 
                      $divide: [
                        { $subtract: ['$totalTickets', '$openTickets'] },
                        '$totalTickets'
                      ]
                    },
                    100
                  ]
                },
                100
              ]
            },
            averageTimePerVisit: {
              $cond: [
                { $gt: ['$totalVisits', 0] },
                { $divide: ['$totalTimeOnSite', '$totalVisits'] },
                0
              ]
            }
          }
        },

        // Sort by utilization score
        { $sort: { utilizationScore: -1 } },

        // Project final structure
        {
          $project: {
            siteId: '$_id',
            name: 1,
            address: 1,
            'location.coordinates': 1,
            clientName: '$client.name',
            clientTier: '$client.tier',
            contactInfo: {
              primaryContact: '$contacts.primary',
              phone: '$contacts.phone',
              email: '$contacts.email'
            },
            metrics: {
              activity: {
                totalShifts: '$totalShifts',
                totalVisits: '$totalVisits',
                totalTimeOnSite: { $round: [{ $divide: ['$totalTimeOnSite', 3600] }, 2] }, // Convert to hours
                uniqueWorkers: '$uniqueWorkers',
                averageTimePerVisit: { $round: [{ $divide: ['$averageTimePerVisit', 3600] }, 2] }
              },
              tickets: {
                total: '$totalTickets',
                open: '$openTickets',
                urgent: '$urgentTickets',
                resolutionRate: { $round: ['$ticketResolutionRate', 2] }
              },
              performance: {
                utilizationScore: { $round: ['$utilizationScore', 2] }
              }
            },
            geofence: {
              enabled: '$geofence.enabled',
              radius: '$geofence.radius'
            },
            isActive: 1,
            createdAt: 1
          }
        }
      ];

      const db = mongoose.connection.db;
      const collection = db.collection('sites');
      
      const startTime = Date.now();
      const result = await collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
      const executionTime = Date.now() - startTime;

      timer();

      // Cache the result
      await businessCacheService.setAnalyticsReport(cacheKey, {
        data: result,
        generatedAt: new Date(),
        filters
      });

      monitoring.incrementCounter('analytics_aggregations_total', 1, {
        type: 'site_analytics',
        status: 'success'
      });

      return {
        data: result,
        metadata: {
          executionTime,
          documentCount: result.length,
          cached: false,
          cacheKey
        }
      };

    } catch (error) {
      timer();
      loggingService.error('Site analytics aggregation failed', error, { filters });
      monitoring.incrementCounter('analytics_aggregations_total', 1, {
        type: 'site_analytics',
        status: 'error'
      });
      throw error;
    }
  }

  /**
   * Get SLA compliance analytics
   */
  async getSLAAnalytics(filters: AnalyticsFilters = {}): Promise<AggregationResult> {
    const timer = monitoring.startTimer('sla_analytics_aggregation_duration');
    const cacheKey = `sla_analytics_${JSON.stringify(filters)}`;

    try {
      const cached = await businessCacheService.getAnalyticsReport(cacheKey);
      if (cached) {
        timer();
        return {
          data: cached.data,
          metadata: {
            executionTime: 0,
            documentCount: cached.data.length,
            cached: true,
            cacheKey
          }
        };
      }

      const matchStage: any = {};

      if (filters.timeRange) {
        matchStage.createdAt = {
          $gte: filters.timeRange.startDate,
          $lte: filters.timeRange.endDate
        };
      }

      const pipeline = [
        { $match: matchStage },

        // Lookup associated tickets
        {
          $lookup: {
            from: 'tickets',
            localField: 'entityId',
            foreignField: '_id',
            as: 'ticket'
          }
        },
        { $unwind: { path: '$ticket', preserveNullAndEmptyArrays: true } },

        // Group by entity type and priority
        {
          $group: {
            _id: {
              entityType: '$entityType',
              priority: '$ticket.priority'
            },
            totalSLAs: { $sum: 1 },
            breachedSLAs: {
              $sum: { $cond: [{ $eq: ['$breached', true] }, 1, 0] }
            },
            metSLAs: {
              $sum: { $cond: [{ $eq: ['$breached', false] }, 1, 0] }
            },
            totalElapsedTime: { $sum: '$metrics.elapsedTime' },
            totalTargetTime: { $sum: '$metrics.targetTime' },
            averageElapsedTime: { $avg: '$metrics.elapsedTime' },
            averageTargetTime: { $avg: '$metrics.targetTime' },
            minElapsedTime: { $min: '$metrics.elapsedTime' },
            maxElapsedTime: { $max: '$metrics.elapsedTime' },
            
            // Breach analysis
            breachReasons: { $addToSet: '$breachDetails.reason' },
            escalationCount: {
              $sum: { 
                $cond: [
                  { $gt: [{ $size: { $ifNull: ['$escalationHistory', []] } }, 0] },
                  1,
                  0
                ]
              }
            }
          }
        },

        // Calculate compliance metrics
        {
          $addFields: {
            complianceRate: {
              $multiply: [
                { $divide: ['$metSLAs', '$totalSLAs'] },
                100
              ]
            },
            breachRate: {
              $multiply: [
                { $divide: ['$breachedSLAs', '$totalSLAs'] },
                100
              ]
            },
            averagePerformanceRatio: {
              $cond: [
                { $gt: ['$averageTargetTime', 0] },
                { $divide: ['$averageElapsedTime', '$averageTargetTime'] },
                0
              ]
            },
            escalationRate: {
              $multiply: [
                { $divide: ['$escalationCount', '$totalSLAs'] },
                100
              ]
            }
          }
        },

        // Sort by compliance rate (descending)
        { $sort: { complianceRate: -1 } },

        // Project final structure
        {
          $project: {
            entityType: '$_id.entityType',
            priority: '$_id.priority',
            metrics: {
              total: '$totalSLAs',
              met: '$metSLAs',
              breached: '$breachedSLAs',
              complianceRate: { $round: ['$complianceRate', 2] },
              breachRate: { $round: ['$breachRate', 2] },
              escalationRate: { $round: ['$escalationRate', 2] }
            },
            timing: {
              averageElapsed: { $round: [{ $divide: ['$averageElapsedTime', 3600] }, 2] }, // Convert to hours
              averageTarget: { $round: [{ $divide: ['$averageTargetTime', 3600] }, 2] },
              performanceRatio: { $round: ['$averagePerformanceRatio', 2] },
              minElapsed: { $round: [{ $divide: ['$minElapsedTime', 3600] }, 2] },
              maxElapsed: { $round: [{ $divide: ['$maxElapsedTime', 3600] }, 2] }
            },
            analysis: {
              breachReasons: {
                $filter: {
                  input: '$breachReasons',
                  cond: { $ne: ['$$this', null] }
                }
              }
            }
          }
        }
      ];

      const db = mongoose.connection.db;
      const collection = db.collection('slatrackers');
      
      const startTime = Date.now();
      const result = await collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
      const executionTime = Date.now() - startTime;

      timer();

      // Cache the result
      await businessCacheService.setAnalyticsReport(cacheKey, {
        data: result,
        generatedAt: new Date(),
        filters
      });

      monitoring.incrementCounter('analytics_aggregations_total', 1, {
        type: 'sla_analytics',
        status: 'success'
      });

      return {
        data: result,
        metadata: {
          executionTime,
          documentCount: result.length,
          cached: false,
          cacheKey
        }
      };

    } catch (error) {
      timer();
      loggingService.error('SLA analytics aggregation failed', error, { filters });
      monitoring.incrementCounter('analytics_aggregations_total', 1, {
        type: 'sla_analytics',
        status: 'error'
      });
      throw error;
    }
  }

  /**
   * Get comprehensive dashboard analytics
   */
  async getDashboardAnalytics(filters: AnalyticsFilters = {}): Promise<{
    overview: any;
    shifts: any;
    sites: any;
    sla: any;
    metadata: any;
  }> {
    const timer = monitoring.startTimer('dashboard_analytics_aggregation_duration');

    try {
      // Execute all analytics in parallel for better performance
      const [shiftAnalytics, siteAnalytics, slaAnalytics] = await Promise.all([
        this.getShiftAnalytics(filters),
        this.getSiteAnalytics(filters),
        this.getSLAAnalytics(filters)
      ]);

      // Calculate overview metrics
      const overview = {
        totalActiveUsers: shiftAnalytics.data.length,
        totalSites: siteAnalytics.data.length,
        totalSLAs: slaAnalytics.data.reduce((sum, item) => sum + item.metrics.total, 0),
        averageCompliance: slaAnalytics.data.length > 0 
          ? slaAnalytics.data.reduce((sum, item) => sum + item.metrics.complianceRate, 0) / slaAnalytics.data.length 
          : 0,
        topPerformers: shiftAnalytics.data.slice(0, 5),
        underperformingSites: siteAnalytics.data
          .filter(site => site.metrics.performance.utilizationScore < 50)
          .slice(0, 5)
      };

      timer();

      const totalExecutionTime = 
        shiftAnalytics.metadata.executionTime +
        siteAnalytics.metadata.executionTime +
        slaAnalytics.metadata.executionTime;

      return {
        overview,
        shifts: shiftAnalytics.data,
        sites: siteAnalytics.data,
        sla: slaAnalytics.data,
        metadata: {
          totalExecutionTime,
          cacheStatus: {
            shifts: shiftAnalytics.metadata.cached,
            sites: siteAnalytics.metadata.cached,
            sla: slaAnalytics.metadata.cached
          },
          documentCounts: {
            shifts: shiftAnalytics.metadata.documentCount,
            sites: siteAnalytics.metadata.documentCount,
            sla: slaAnalytics.metadata.documentCount
          }
        }
      };

    } catch (error) {
      timer();
      loggingService.error('Dashboard analytics aggregation failed', error, { filters });
      throw error;
    }
  }
}

// Export singleton instance
export const analyticsAggregationService = new AnalyticsAggregationService();
export default analyticsAggregationService;