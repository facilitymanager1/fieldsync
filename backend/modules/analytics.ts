/**
 * Comprehensive Time Tracking and Analytics Module
 * Handles KPIs, charts, exports, event tracking, and time-based reporting
 */

import { Request, Response } from 'express';
import { AdvancedShiftModel, ShiftState } from '../models/shift';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';

// Analytics Interfaces
export interface TimeTrackingReport {
  period: {
    start: Date;
    end: Date;
    periodType: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  };
  totals: {
    totalShifts: number;
    totalWorkingTime: number; // minutes
    totalBreakTime: number; // minutes
    totalOvertimeTime: number; // minutes
    totalSiteTime: number; // minutes
    totalTravelTime: number; // minutes
    averageShiftDuration: number; // minutes
    averageEfficiency: number; // percentage
  };
  breakdown: {
    byUser: UserTimeBreakdown[];
    bySite: SiteTimeBreakdown[];
    byDay: DailyTimeBreakdown[];
  };
}

export interface UserTimeBreakdown {
  userId: string;
  userName?: string;
  shiftsCount: number;
  totalWorkingTime: number;
  totalBreakTime: number;
  totalOvertimeTime: number;
  efficiency: number;
  compliance: number;
  averageShiftDuration: number;
}

export interface SiteTimeBreakdown {
  siteId: string;
  siteName?: string;
  visitsCount: number;
  totalTimeOnSite: number;
  averageTimePerVisit: number;
  tasksCompleted: number;
  efficiency: number;
}

export interface DailyTimeBreakdown {
  date: string;
  shiftsCount: number;
  totalWorkingTime: number;
  totalBreakTime: number;
  totalOvertimeTime: number;
  averageEfficiency: number;
}

export interface OvertimeReport {
  users: Array<{
    userId: string;
    userName?: string;
    totalOvertime: number; // minutes
    overtimeShifts: number;
    averageOvertimePerShift: number;
    overtimeEvents: Array<{
      shiftId: string;
      date: Date;
      plannedDuration: number;
      actualDuration: number;
      overtimeMinutes: number;
      reason?: string;
    }>;
  }>;
  summary: {
    totalOvertime: number;
    totalOvertimeShifts: number;
    averageOvertimePerUser: number;
    costImpact?: number;
  };
}

export interface BreakAnalysisReport {
  summary: {
    totalBreaks: number;
    totalBreakTime: number; // minutes
    averageBreakDuration: number; // minutes
    authorizedBreakTime: number;
    unauthorizedBreakTime: number;
    complianceRate: number; // percentage
  };
  byType: Array<{
    type: string;
    count: number;
    totalDuration: number;
    averageDuration: number;
    complianceRate: number;
  }>;
  byUser: Array<{
    userId: string;
    userName?: string;
    totalBreaks: number;
    totalBreakTime: number;
    authorizedBreakTime: number;
    unauthorizedBreakTime: number;
    complianceRate: number;
  }>;
}

export interface EfficiencyMetrics {
  overall: {
    averageEfficiency: number;
    tasksCompletionRate: number;
    onTimeShiftRate: number;
    siteVisitEfficiency: number;
  };
  trends: Array<{
    period: string;
    efficiency: number;
    tasksCompleted: number;
    tasksTotal: number;
    onTimeShifts: number;
    totalShifts: number;
  }>;
  topPerformers: Array<{
    userId: string;
    userName?: string;
    efficiency: number;
    tasksCompletionRate: number;
    consistency: number;
  }>;
  underperformers: Array<{
    userId: string;
    userName?: string;
    efficiency: number;
    issues: string[];
    recommendations: string[];
  }>;
}

/**
 * Get comprehensive time tracking analytics
 */
export async function getTimeTrackingReport(req: Request, res: Response): Promise<void> {
  try {
    const {
      startDate,
      endDate,
      userId,
      siteId,
      periodType = 'month'
    } = req.query;

    const timer = monitoring.startTimer('time_tracking_report_generation');

    // Build query
    const query: any = {};
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    query.actualStartTime = { $gte: start, $lte: end };
    query.state = { $ne: ShiftState.CANCELLED };

    if (userId) query.userId = userId;

    // Get shifts with aggregation
    const shifts = await AdvancedShiftModel.aggregate([
      { $match: query },
      {
        $addFields: {
          shiftDuration: {
            $cond: {
              if: { $and: ['$actualStartTime', '$actualEndTime'] },
              then: { $subtract: ['$actualEndTime', '$actualStartTime'] },
              else: 0
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalShifts: { $sum: 1 },
          totalWorkingTime: { $sum: '$metrics.workingTime' },
          totalBreakTime: { $sum: '$metrics.breakTime' },
          totalOvertimeTime: { $sum: '$metrics.overtime' },
          totalSiteTime: { $sum: '$metrics.siteTime' },
          totalTravelTime: { $sum: '$metrics.travelTime' },
          averageEfficiency: { $avg: '$metrics.efficiency' },
          averageShiftDuration: { $avg: '$metrics.totalDuration' }
        }
      }
    ]);

    const totals = shifts[0] || {
      totalShifts: 0,
      totalWorkingTime: 0,
      totalBreakTime: 0,
      totalOvertimeTime: 0,
      totalSiteTime: 0,
      totalTravelTime: 0,
      averageEfficiency: 0,
      averageShiftDuration: 0
    };

    // Get user breakdown
    const userBreakdown = await AdvancedShiftModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$userId',
          shiftsCount: { $sum: 1 },
          totalWorkingTime: { $sum: '$metrics.workingTime' },
          totalBreakTime: { $sum: '$metrics.breakTime' },
          totalOvertimeTime: { $sum: '$metrics.overtime' },
          efficiency: { $avg: '$metrics.efficiency' },
          compliance: { $avg: '$complianceScore' },
          averageShiftDuration: { $avg: '$metrics.totalDuration' }
        }
      },
      { $sort: { totalWorkingTime: -1 } }
    ]);

    // Get site breakdown
    const siteBreakdown = await AdvancedShiftModel.aggregate([
      { $match: query },
      { $unwind: '$siteVisits' },
      {
        $group: {
          _id: '$siteVisits.siteId',
          siteName: { $first: '$siteVisits.siteName' },
          visitsCount: { $sum: 1 },
          totalTimeOnSite: { $sum: '$siteVisits.timeOnSite' },
          tasksCompleted: { $sum: { $size: { $ifNull: ['$siteVisits.tasks', []] } } }
        }
      },
      {
        $addFields: {
          averageTimePerVisit: { $divide: ['$totalTimeOnSite', '$visitsCount'] },
          efficiency: { $multiply: [{ $divide: ['$tasksCompleted', '$visitsCount'] }, 100] }
        }
      },
      { $sort: { totalTimeOnSite: -1 } }
    ]);

    // Get daily breakdown
    const dailyBreakdown = await AdvancedShiftModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$actualStartTime' } },
          shiftsCount: { $sum: 1 },
          totalWorkingTime: { $sum: '$metrics.workingTime' },
          totalBreakTime: { $sum: '$metrics.breakTime' },
          totalOvertimeTime: { $sum: '$metrics.overtime' },
          averageEfficiency: { $avg: '$metrics.efficiency' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const report: TimeTrackingReport = {
      period: {
        start,
        end,
        periodType: periodType as any
      },
      totals,
      breakdown: {
        byUser: userBreakdown.map(user => ({
          userId: user._id,
          shiftsCount: user.shiftsCount,
          totalWorkingTime: user.totalWorkingTime,
          totalBreakTime: user.totalBreakTime,
          totalOvertimeTime: user.totalOvertimeTime,
          efficiency: Math.round(user.efficiency * 100) / 100,
          compliance: Math.round(user.compliance * 100) / 100,
          averageShiftDuration: Math.round(user.averageShiftDuration)
        })),
        bySite: siteBreakdown.map(site => ({
          siteId: site._id,
          siteName: site.siteName,
          visitsCount: site.visitsCount,
          totalTimeOnSite: Math.round(site.totalTimeOnSite / 60), // Convert to minutes
          averageTimePerVisit: Math.round(site.averageTimePerVisit / 60),
          tasksCompleted: site.tasksCompleted,
          efficiency: Math.round(site.efficiency * 100) / 100
        })),
        byDay: dailyBreakdown.map(day => ({
          date: day._id,
          shiftsCount: day.shiftsCount,
          totalWorkingTime: day.totalWorkingTime,
          totalBreakTime: day.totalBreakTime,
          totalOvertimeTime: day.totalOvertimeTime,
          averageEfficiency: Math.round(day.averageEfficiency * 100) / 100
        }))
      }
    };

    timer();
    monitoring.incrementCounter('time_tracking_reports_generated', 1);

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    loggingService.error('Failed to generate time tracking report', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate time tracking report'
    });
  }
}

/**
 * Get overtime analysis report
 */
export async function getOvertimeReport(req: Request, res: Response): Promise<void> {
  try {
    const {
      startDate,
      endDate,
      userId,
      threshold = 480 // 8 hours in minutes
    } = req.query;

    const timer = monitoring.startTimer('overtime_report_generation');

    const query: any = {
      'metrics.overtime': { $gt: 0 },
      state: { $ne: ShiftState.CANCELLED }
    };

    if (startDate || endDate) {
      query.actualStartTime = {};
      if (startDate) query.actualStartTime.$gte = new Date(startDate as string);
      if (endDate) query.actualStartTime.$lte = new Date(endDate as string);
    }

    if (userId) query.userId = userId;

    const overtimeData = await AdvancedShiftModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$userId',
          totalOvertime: { $sum: '$metrics.overtime' },
          overtimeShifts: { $sum: 1 },
          shifts: {
            $push: {
              shiftId: '$_id',
              date: '$actualStartTime',
              plannedDuration: { 
                $cond: {
                  if: { $and: ['$plannedStartTime', '$plannedEndTime'] },
                  then: { $subtract: ['$plannedEndTime', '$plannedStartTime'] },
                  else: null
                }
              },
              actualDuration: '$metrics.totalDuration',
              overtimeMinutes: '$metrics.overtime',
              notes: '$notes'
            }
          }
        }
      },
      {
        $addFields: {
          averageOvertimePerShift: { $divide: ['$totalOvertime', '$overtimeShifts'] }
        }
      },
      { $sort: { totalOvertime: -1 } }
    ]);

    const summary = {
      totalOvertime: overtimeData.reduce((sum, user) => sum + user.totalOvertime, 0),
      totalOvertimeShifts: overtimeData.reduce((sum, user) => sum + user.overtimeShifts, 0),
      averageOvertimePerUser: overtimeData.length > 0 
        ? overtimeData.reduce((sum, user) => sum + user.totalOvertime, 0) / overtimeData.length 
        : 0
    };

    const report: OvertimeReport = {
      users: overtimeData.map(user => ({
        userId: user._id,
        totalOvertime: user.totalOvertime,
        overtimeShifts: user.overtimeShifts,
        averageOvertimePerShift: Math.round(user.averageOvertimePerShift),
        overtimeEvents: user.shifts.map((shift: any) => ({
          shiftId: shift.shiftId,
          date: shift.date,
          plannedDuration: shift.plannedDuration ? Math.round(shift.plannedDuration / 60000) : null,
          actualDuration: shift.actualDuration,
          overtimeMinutes: shift.overtimeMinutes,
          reason: shift.notes
        }))
      })),
      summary
    };

    timer();
    monitoring.incrementCounter('overtime_reports_generated', 1);

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    loggingService.error('Failed to generate overtime report', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate overtime report'
    });
  }
}

/**
 * Get break analysis report
 */
export async function getBreakAnalysisReport(req: Request, res: Response): Promise<void> {
  try {
    const { startDate, endDate, userId } = req.query;

    const timer = monitoring.startTimer('break_analysis_report_generation');

    const query: any = {
      'breaks.0': { $exists: true },
      state: { $ne: ShiftState.CANCELLED }
    };

    if (startDate || endDate) {
      query.actualStartTime = {};
      if (startDate) query.actualStartTime.$gte = new Date(startDate as string);
      if (endDate) query.actualStartTime.$lte = new Date(endDate as string);
    }

    if (userId) query.userId = userId;

    const breakData = await AdvancedShiftModel.aggregate([
      { $match: query },
      { $unwind: '$breaks' },
      {
        $group: {
          _id: null,
          totalBreaks: { $sum: 1 },
          totalBreakTime: { $sum: '$breaks.duration' },
          authorizedBreaks: {
            $sum: { $cond: ['$breaks.isAuthorized', 1, 0] }
          },
          authorizedBreakTime: {
            $sum: { $cond: ['$breaks.isAuthorized', '$breaks.duration', 0] }
          },
          breaksByType: {
            $push: {
              type: '$breaks.type',
              duration: '$breaks.duration',
              isAuthorized: '$breaks.isAuthorized'
            }
          },
          breaksByUser: {
            $push: {
              userId: '$userId',
              type: '$breaks.type',
              duration: '$breaks.duration',
              isAuthorized: '$breaks.isAuthorized'
            }
          }
        }
      }
    ]);

    const data = breakData[0] || {
      totalBreaks: 0,
      totalBreakTime: 0,
      authorizedBreaks: 0,
      authorizedBreakTime: 0,
      breaksByType: [],
      breaksByUser: []
    };

    // Process break types
    const typeBreakdown: { [key: string]: any } = {};
    data.breaksByType.forEach((breakItem: any) => {
      if (!typeBreakdown[breakItem.type]) {
        typeBreakdown[breakItem.type] = {
          count: 0,
          totalDuration: 0,
          authorizedCount: 0
        };
      }
      typeBreakdown[breakItem.type].count++;
      typeBreakdown[breakItem.type].totalDuration += breakItem.duration;
      if (breakItem.isAuthorized) {
        typeBreakdown[breakItem.type].authorizedCount++;
      }
    });

    // Process user breakdown
    const userBreakdown: { [key: string]: any } = {};
    data.breaksByUser.forEach((breakItem: any) => {
      if (!userBreakdown[breakItem.userId]) {
        userBreakdown[breakItem.userId] = {
          totalBreaks: 0,
          totalBreakTime: 0,
          authorizedBreakTime: 0
        };
      }
      userBreakdown[breakItem.userId].totalBreaks++;
      userBreakdown[breakItem.userId].totalBreakTime += breakItem.duration;
      if (breakItem.isAuthorized) {
        userBreakdown[breakItem.userId].authorizedBreakTime += breakItem.duration;
      }
    });

    const report: BreakAnalysisReport = {
      summary: {
        totalBreaks: data.totalBreaks,
        totalBreakTime: data.totalBreakTime,
        averageBreakDuration: data.totalBreaks > 0 ? Math.round(data.totalBreakTime / data.totalBreaks) : 0,
        authorizedBreakTime: data.authorizedBreakTime,
        unauthorizedBreakTime: data.totalBreakTime - data.authorizedBreakTime,
        complianceRate: data.totalBreaks > 0 ? Math.round((data.authorizedBreaks / data.totalBreaks) * 100) : 100
      },
      byType: Object.entries(typeBreakdown).map(([type, data]: [string, any]) => ({
        type,
        count: data.count,
        totalDuration: data.totalDuration,
        averageDuration: Math.round(data.totalDuration / data.count),
        complianceRate: Math.round((data.authorizedCount / data.count) * 100)
      })),
      byUser: Object.entries(userBreakdown).map(([userId, data]: [string, any]) => ({
        userId,
        totalBreaks: data.totalBreaks,
        totalBreakTime: data.totalBreakTime,
        authorizedBreakTime: data.authorizedBreakTime,
        unauthorizedBreakTime: data.totalBreakTime - data.authorizedBreakTime,
        complianceRate: Math.round((data.authorizedBreakTime / data.totalBreakTime) * 100)
      }))
    };

    timer();
    monitoring.incrementCounter('break_analysis_reports_generated', 1);

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    loggingService.error('Failed to generate break analysis report', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate break analysis report'
    });
  }
}

/**
 * Get efficiency metrics
 */
export async function getEfficiencyMetrics(req: Request, res: Response): Promise<void> {
  try {
    const { startDate, endDate, userId } = req.query;

    const timer = monitoring.startTimer('efficiency_metrics_generation');

    const query: any = {
      state: { $ne: ShiftState.CANCELLED }
    };

    if (startDate || endDate) {
      query.actualStartTime = {};
      if (startDate) query.actualStartTime.$gte = new Date(startDate as string);
      if (endDate) query.actualStartTime.$lte = new Date(endDate as string);
    }

    if (userId) query.userId = userId;

    // Overall metrics
    const overallMetrics = await AdvancedShiftModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          averageEfficiency: { $avg: '$metrics.efficiency' },
          totalTasks: { $sum: '$metrics.tasksTotal' },
          completedTasks: { $sum: '$metrics.tasksCompleted' },
          onTimeShifts: {
            $sum: {
              $cond: [
                { $lte: ['$metrics.totalDuration', { $multiply: [8, 60] }] }, // 8 hours
                1,
                0
              ]
            }
          },
          totalShifts: { $sum: 1 },
          avgSiteTime: { $avg: '$metrics.siteTime' },
          avgTravelTime: { $avg: '$metrics.travelTime' }
        }
      }
    ]);

    const overall = overallMetrics[0] || {
      averageEfficiency: 0,
      totalTasks: 0,
      completedTasks: 0,
      onTimeShifts: 0,
      totalShifts: 0,
      avgSiteTime: 0,
      avgTravelTime: 0
    };

    // User performance
    const userPerformance = await AdvancedShiftModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$userId',
          efficiency: { $avg: '$metrics.efficiency' },
          totalTasks: { $sum: '$metrics.tasksTotal' },
          completedTasks: { $sum: '$metrics.tasksCompleted' },
          shiftsCount: { $sum: 1 },
          onTimeShifts: {
            $sum: {
              $cond: [
                { $lte: ['$metrics.totalDuration', { $multiply: [8, 60] }] },
                1,
                0
              ]
            }
          },
          efficiencyVariance: { $stdDevPop: '$metrics.efficiency' }
        }
      },
      {
        $addFields: {
          tasksCompletionRate: {
            $cond: [
              { $gt: ['$totalTasks', 0] },
              { $multiply: [{ $divide: ['$completedTasks', '$totalTasks'] }, 100] },
              0
            ]
          },
          onTimeRate: {
            $cond: [
              { $gt: ['$shiftsCount', 0] },
              { $multiply: [{ $divide: ['$onTimeShifts', '$shiftsCount'] }, 100] },
              0
            ]
          },
          consistency: {
            $subtract: [100, { $multiply: [{ $ifNull: ['$efficiencyVariance', 0] }, 2] }]
          }
        }
      },
      { $sort: { efficiency: -1 } }
    ]);

    const metrics: EfficiencyMetrics = {
      overall: {
        averageEfficiency: Math.round(overall.averageEfficiency * 100) / 100,
        tasksCompletionRate: overall.totalTasks > 0 
          ? Math.round((overall.completedTasks / overall.totalTasks) * 100)
          : 0,
        onTimeShiftRate: overall.totalShifts > 0
          ? Math.round((overall.onTimeShifts / overall.totalShifts) * 100)
          : 0,
        siteVisitEfficiency: Math.round((overall.avgSiteTime / (overall.avgSiteTime + overall.avgTravelTime)) * 100)
      },
      trends: [], // Would need time-series data for trends
      topPerformers: userPerformance.slice(0, 5).map(user => ({
        userId: user._id,
        efficiency: Math.round(user.efficiency * 100) / 100,
        tasksCompletionRate: Math.round(user.tasksCompletionRate),
        consistency: Math.max(0, Math.round(user.consistency))
      })),
      underperformers: userPerformance.filter(user => user.efficiency < 50).map(user => ({
        userId: user._id,
        efficiency: Math.round(user.efficiency * 100) / 100,
        issues: user.efficiency < 30 ? ['Low task completion', 'Excessive overtime'] : ['Below average efficiency'],
        recommendations: user.efficiency < 30 
          ? ['Additional training required', 'Review task assignments', 'Manager intervention needed']
          : ['Performance coaching', 'Efficiency improvement plan']
      }))
    };

    timer();
    monitoring.incrementCounter('efficiency_metrics_generated', 1);

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    loggingService.error('Failed to generate efficiency metrics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate efficiency metrics'
    });
  }
}

/**
 * Legacy analytics function - enhanced with real data
 */
export async function getAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const activeShiftsCount = await AdvancedShiftModel.countDocuments({
      state: { $in: [ShiftState.IN_SHIFT, ShiftState.ON_BREAK] }
    });

    const totalShiftsToday = await AdvancedShiftModel.countDocuments({
      actualStartTime: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999))
      }
    });

    const avgEfficiencyToday = await AdvancedShiftModel.aggregate([
      {
        $match: {
          actualStartTime: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      },
      {
        $group: {
          _id: null,
          avgEfficiency: { $avg: '$metrics.efficiency' }
        }
      }
    ]);

    res.json({
      success: true,
      analytics: {
        totalStaff: await AdvancedShiftModel.distinct('userId').then(users => users.length),
        activeShifts: activeShiftsCount,
        shiftsToday: totalShiftsToday,
        avgEfficiency: Math.round((avgEfficiencyToday[0]?.avgEfficiency || 0) * 100) / 100,
        timestamp: new Date()
      }
    });
  } catch (error) {
    loggingService.error('Failed to get analytics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics'
    });
  }
}

/**
 * Track analytics events
 */
export function trackEvent(event: any): void {
  try {
    monitoring.incrementCounter('analytics_events_tracked', 1, {
      eventType: event.type || 'unknown'
    });

    loggingService.info('Analytics event tracked', {
      eventType: event.type,
      timestamp: new Date(),
      metadata: event.metadata
    });
  } catch (error) {
    loggingService.error('Failed to track analytics event', error);
  }
}
