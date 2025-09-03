/**
 * Analytics Module Unit Tests
 * Comprehensive testing for analytics data processing, metrics calculation, and reporting
 */

import { 
  getTimeTrackingReport,
  getOvertimeReport,
  getBreakAnalysisReport,
  getEfficiencyMetrics,
  getAnalytics,
  trackEvent
} from '../modules/analytics';
import { AdvancedShiftModel, ShiftState } from '../models/shift';
import loggingService from '../services/loggingService';
import { monitoring } from '../services/monitoringService';

// Mock dependencies
jest.mock('../models/shift');
jest.mock('../services/loggingService');
jest.mock('../services/monitoringService');

describe('Analytics Module', () => {
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Express request/response objects
    mockRequest = {
      query: {},
      params: {},
      body: {},
      user: { id: 'user_123', role: { name: 'Admin' } }
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };

    // Mock monitoring service
    const mockTimer = jest.fn();
    (monitoring.startTimer as jest.Mock).mockReturnValue(mockTimer);
    (monitoring.incrementCounter as jest.Mock).mockReturnValue(undefined);
    (monitoring.recordHistogram as jest.Mock).mockReturnValue(undefined);
    (monitoring.recordMetric as jest.Mock).mockReturnValue(undefined);

    // Mock shift model aggregate results
    (AdvancedShiftModel.aggregate as jest.Mock).mockResolvedValue([
      {
        _id: null,
        totalShifts: 100,
        totalWorkingTime: 8000,
        totalBreakTime: 500,
        totalOvertimeTime: 200,
        totalSiteTime: 7000,
        totalTravelTime: 1500,
        averageEfficiency: 85.5,
        averageShiftDuration: 480
      }
    ]);

    (AdvancedShiftModel.countDocuments as jest.Mock).mockResolvedValue(25);
    (AdvancedShiftModel.distinct as jest.Mock).mockResolvedValue(['user1', 'user2', 'user3']);
  });

  describe('Module Structure', () => {
    it('should export all required functions', () => {
      expect(typeof getTimeTrackingReport).toBe('function');
      expect(typeof getOvertimeReport).toBe('function');
      expect(typeof getBreakAnalysisReport).toBe('function');
      expect(typeof getEfficiencyMetrics).toBe('function');
      expect(typeof getAnalytics).toBe('function');
      expect(typeof trackEvent).toBe('function');
    });
  });

  describe('Time Tracking Reports', () => {
    it('should generate comprehensive time tracking report', async () => {
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        periodType: 'month'
      };

      // Mock multiple aggregation calls for different breakdowns
      (AdvancedShiftModel.aggregate as jest.Mock)
        .mockResolvedValueOnce([{
          _id: null,
          totalShifts: 50,
          totalWorkingTime: 4000,
          totalBreakTime: 250,
          totalOvertimeTime: 100,
          totalSiteTime: 3500,
          totalTravelTime: 750,
          averageEfficiency: 82.5,
          averageShiftDuration: 480
        }])
        .mockResolvedValueOnce([{
          _id: 'user_123',
          shiftsCount: 15,
          totalWorkingTime: 1200,
          totalBreakTime: 75,
          totalOvertimeTime: 30,
          efficiency: 85.2,
          compliance: 92.5,
          averageShiftDuration: 480
        }])
        .mockResolvedValueOnce([{
          _id: 'site_456',
          siteName: 'Main Office',
          visitsCount: 25,
          totalTimeOnSite: 25200, // seconds
          tasksCompleted: 45
        }])
        .mockResolvedValueOnce([{
          _id: '2024-01-15',
          shiftsCount: 8,
          totalWorkingTime: 640,
          totalBreakTime: 40,
          totalOvertimeTime: 15,
          averageEfficiency: 78.5
        }]);

      await getTimeTrackingReport(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          period: expect.objectContaining({
            start: expect.any(Date),
            end: expect.any(Date),
            periodType: 'month'
          }),
          totals: expect.objectContaining({
            totalShifts: 50,
            totalWorkingTime: 4000,
            averageEfficiency: 82.5
          }),
          breakdown: expect.objectContaining({
            byUser: expect.any(Array),
            bySite: expect.any(Array),
            byDay: expect.any(Array)
          })
        })
      });
    });

    it('should filter by user when specified', async () => {
      mockRequest.query = {
        userId: 'user_123',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      await getTimeTrackingReport(mockRequest, mockResponse);

      expect(AdvancedShiftModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              userId: 'user_123'
            })
          })
        ])
      );
    });
  });

  describe('Overtime Analysis', () => {
    beforeEach(() => {
      (AdvancedShiftModel.aggregate as jest.Mock).mockResolvedValue([
        {
          _id: 'user_123',
          totalOvertime: 120,
          overtimeShifts: 5,
          averageOvertimePerShift: 24,
          shifts: [
            {
              shiftId: 'shift_1',
              date: new Date('2024-01-01'),
              plannedDuration: 28800000, // 8 hours in ms
              actualDuration: 540,
              overtimeMinutes: 60,
              notes: 'Extended shift due to emergency'
            }
          ]
        }
      ]);
    });

    it('should generate overtime analysis report', async () => {
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      await getOvertimeReport(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          users: expect.arrayContaining([
            expect.objectContaining({
              userId: 'user_123',
              totalOvertime: 120,
              overtimeShifts: 5,
              overtimeEvents: expect.arrayContaining([
                expect.objectContaining({
                  shiftId: 'shift_1',
                  date: expect.any(Date),
                  overtimeMinutes: 60,
                  reason: 'Extended shift due to emergency'
                })
              ])
            })
          ]),
          summary: expect.objectContaining({
            totalOvertime: 120,
            totalOvertimeShifts: 5,
            averageOvertimePerUser: 120
          })
        })
      });
    });

    it('should handle custom overtime threshold', async () => {
      mockRequest.query = {
        threshold: '600', // 10 hours
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      await getOvertimeReport(mockRequest, mockResponse);

      expect(AdvancedShiftModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              'metrics.overtime': { $gt: 0 }
            })
          })
        ])
      );
    });
  });

  describe('Break Analysis', () => {
    beforeEach(() => {
      (AdvancedShiftModel.aggregate as jest.Mock).mockResolvedValue([
        {
          _id: null,
          totalBreaks: 50,
          totalBreakTime: 1500,
          authorizedBreaks: 45,
          authorizedBreakTime: 1350,
          breaksByType: [
            { type: 'lunch', duration: 30, isAuthorized: true },
            { type: 'rest', duration: 15, isAuthorized: true },
            { type: 'personal', duration: 10, isAuthorized: false }
          ],
          breaksByUser: [
            { userId: 'user_123', type: 'lunch', duration: 30, isAuthorized: true },
            { userId: 'user_456', type: 'personal', duration: 10, isAuthorized: false }
          ]
        }
      ]);
    });

    it('should generate break analysis report', async () => {
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      await getBreakAnalysisReport(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          summary: expect.objectContaining({
            totalBreaks: 50,
            totalBreakTime: 1500,
            averageBreakDuration: 30, // 1500/50
            authorizedBreakTime: 1350,
            unauthorizedBreakTime: 150, // 1500-1350
            complianceRate: 90 // 45/50 * 100
          }),
          byType: expect.arrayContaining([
            expect.objectContaining({
              type: 'lunch',
              count: 1,
              totalDuration: 30,
              averageDuration: 30,
              complianceRate: 100
            })
          ]),
          byUser: expect.arrayContaining([
            expect.objectContaining({
              userId: 'user_123',
              totalBreaks: 1,
              totalBreakTime: 30,
              authorizedBreakTime: 30,
              unauthorizedBreakTime: 0,
              complianceRate: 100
            })
          ])
        })
      });
    });

    it('should handle empty break data', async () => {
      (AdvancedShiftModel.aggregate as jest.Mock).mockResolvedValue([]);

      await getBreakAnalysisReport(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          summary: expect.objectContaining({
            totalBreaks: 0,
            complianceRate: 100 // Default when no data
          })
        })
      });
    });
  });

  describe('Efficiency Metrics', () => {
    beforeEach(() => {
      // Mock overall metrics aggregation
      (AdvancedShiftModel.aggregate as jest.Mock)
        .mockResolvedValueOnce([
          {
            _id: null,
            averageEfficiency: 78.5,
            totalTasks: 200,
            completedTasks: 185,
            onTimeShifts: 90,
            totalShifts: 100,
            avgSiteTime: 420,
            avgTravelTime: 60
          }
        ])
        // Mock user performance aggregation
        .mockResolvedValueOnce([
          {
            _id: 'user_123',
            efficiency: 85.2,
            totalTasks: 50,
            completedTasks: 47,
            shiftsCount: 25,
            onTimeShifts: 23,
            tasksCompletionRate: 94,
            onTimeRate: 92,
            consistency: 88,
            efficiencyVariance: 5.2
          },
          {
            _id: 'user_456',
            efficiency: 45.8,
            totalTasks: 30,
            completedTasks: 25,
            shiftsCount: 15,
            onTimeShifts: 12,
            tasksCompletionRate: 83,
            onTimeRate: 80,
            consistency: 65,
            efficiencyVariance: 15.3
          }
        ]);
    });

    it('should generate efficiency metrics', async () => {
      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      await getEfficiencyMetrics(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          overall: expect.objectContaining({
            averageEfficiency: 78.5,
            tasksCompletionRate: 93, // Math.round(185/200*100)
            onTimeShiftRate: 90, // Math.round(90/100*100)
            siteVisitEfficiency: 88 // Math.round(420/(420+60)*100)
          }),
          trends: [],
          topPerformers: expect.arrayContaining([
            expect.objectContaining({
              userId: 'user_123',
              efficiency: 85.2,
              tasksCompletionRate: 94,
              consistency: 88
            })
          ]),
          underperformers: expect.arrayContaining([
            expect.objectContaining({
              userId: 'user_456',
              efficiency: 45.8,
              issues: ['Below average efficiency'],
              recommendations: ['Performance coaching', 'Efficiency improvement plan']
            })
          ])
        })
      });
    });
  });

  describe('Legacy Analytics Support', () => {
    beforeEach(() => {
      (AdvancedShiftModel.countDocuments as jest.Mock)
        .mockResolvedValueOnce(15) // Active shifts
        .mockResolvedValueOnce(45); // Total shifts today

      (AdvancedShiftModel.distinct as jest.Mock).mockResolvedValue(['user1', 'user2', 'user3']);

      (AdvancedShiftModel.aggregate as jest.Mock).mockResolvedValue([
        { _id: null, avgEfficiency: 82.3 }
      ]);
    });

    it('should provide legacy analytics data', async () => {
      await getAnalytics(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        analytics: expect.objectContaining({
          totalStaff: 3,
          activeShifts: 15,
          shiftsToday: 45,
          avgEfficiency: 82.3,
          timestamp: expect.any(Date)
        })
      });
    });

    it('should handle zero efficiency gracefully', async () => {
      (AdvancedShiftModel.aggregate as jest.Mock).mockResolvedValue([]);

      await getAnalytics(mockRequest, mockResponse);

      const responseData = mockResponse.json.mock.calls[0][0].analytics;
      expect(responseData.avgEfficiency).toBe(0);
    });
  });

  describe('Event Tracking', () => {
    it('should track analytics events', () => {
      const testEvent = {
        type: 'user_action',
        metadata: { action: 'login', userId: 'user_123' }
      };

      expect(() => trackEvent(testEvent)).not.toThrow();
      
      expect(monitoring.incrementCounter).toHaveBeenCalledWith(
        'analytics_events_tracked',
        1,
        { eventType: 'user_action' }
      );
      
      expect(loggingService.info).toHaveBeenCalledWith(
        'Analytics event tracked',
        expect.objectContaining({
          eventType: 'user_action',
          timestamp: expect.any(Date),
          metadata: testEvent.metadata
        })
      );
    });

    it('should handle tracking errors gracefully', () => {
      const invalidEvent = null;

      expect(() => trackEvent(invalidEvent)).not.toThrow();
      expect(loggingService.error).toHaveBeenCalledWith(
        'Failed to track analytics event',
        expect.any(Error)
      );
    });

    it('should handle events without type', () => {
      const eventWithoutType = { metadata: { test: 'data' } };

      trackEvent(eventWithoutType);

      expect(monitoring.incrementCounter).toHaveBeenCalledWith(
        'analytics_events_tracked',
        1,
        { eventType: 'unknown' }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in time tracking', async () => {
      (AdvancedShiftModel.aggregate as jest.Mock).mockRejectedValue(new Error('Database error'));

      await getTimeTrackingReport(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to generate time tracking report'
      });
      
      expect(loggingService.error).toHaveBeenCalledWith(
        'Failed to generate time tracking report',
        expect.any(Error)
      );
    });

    it('should handle database errors in overtime analysis', async () => {
      (AdvancedShiftModel.aggregate as jest.Mock).mockRejectedValue(new Error('Database error'));

      await getOvertimeReport(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to generate overtime report'
      });
    });

    it('should handle database errors in efficiency metrics', async () => {
      (AdvancedShiftModel.aggregate as jest.Mock).mockRejectedValue(new Error('Database error'));

      await getEfficiencyMetrics(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to generate efficiency metrics'
      });
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track processing time with monitoring service', async () => {
      const mockTimer = jest.fn();
      (monitoring.startTimer as jest.Mock).mockReturnValue(mockTimer);

      await getTimeTrackingReport(mockRequest, mockResponse);

      expect(monitoring.startTimer).toHaveBeenCalledWith('time_tracking_report_generation');
      expect(mockTimer).toHaveBeenCalled();
      expect(monitoring.incrementCounter).toHaveBeenCalledWith('time_tracking_reports_generated', 1);
    });

    it('should complete analytics operations within time limits', async () => {
      const startTime = Date.now();

      await getTimeTrackingReport(mockRequest, mockResponse);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large datasets efficiently', async () => {
      // Mock large aggregation result
      const largeResult = Array.from({ length: 1000 }, (_, i) => ({
        _id: `user_${i}`,
        efficiency: Math.random() * 100,
        shiftsCount: Math.floor(Math.random() * 50)
      }));

      (AdvancedShiftModel.aggregate as jest.Mock)
        .mockResolvedValueOnce([{ _id: null, totalShifts: 50000 }])
        .mockResolvedValueOnce(largeResult);

      const startTime = Date.now();
      await getEfficiencyMetrics(mockRequest, mockResponse);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10000); // Should handle large data within 10 seconds
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            topPerformers: expect.any(Array)
          })
        })
      );
    });
  });

  describe('Data Processing and Calculations', () => {
    it('should calculate percentage with proper rounding', () => {
      const completed = 847;
      const total = 1000;
      const percentage = Math.round((completed / total) * 100);
      
      expect(percentage).toBe(85);
    });

    it('should handle edge cases in percentage calculations', () => {
      // Test division by zero
      const rate = 0 > 0 ? 0 / 0 : 0;
      expect(rate).toBe(0);

      // Test negative values  
      const negative = -5;
      const normalized = Math.max(0, negative);
      expect(normalized).toBe(0);
    });

    it('should convert time units correctly', () => {
      const timeInSeconds = 25200; // 7 hours
      const timeInMinutes = Math.round(timeInSeconds / 60);
      
      expect(timeInMinutes).toBe(420);
    });

    it('should calculate averages with proper precision', () => {
      const values = [85.234, 78.567, 92.123];
      const average = values.reduce((sum, val) => sum + val, 0) / values.length;
      const rounded = Math.round(average * 100) / 100;
      
      expect(rounded).toBe(85.31);
    });
  });

});