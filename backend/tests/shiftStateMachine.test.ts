/**
 * Shift State Machine Unit Tests
 * Comprehensive testing for shift state transitions, geofencing, and business logic
 */

import { shiftStateMachine } from '../modules/shiftStateMachine';
import { AdvancedShift } from '../models/shift';
import User from '../models/user';
import { recordAuditLog } from '../modules/auditLog';

// Mock dependencies
jest.mock('../models/shift');
jest.mock('../models/user');
jest.mock('../modules/auditLog');

// Mock geofencing service
jest.mock('../services/geofencingService', () => ({
  isWithinGeofence: jest.fn(),
  getGeofenceInfo: jest.fn(),
  validateLocation: jest.fn().mockResolvedValue({ isValid: true, accuracy: 5 })
}));

// Mock notification service
jest.mock('../modules/notification', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendShiftNotification: jest.fn(),
    sendShiftAlert: jest.fn()
  }))
}));

describe('Shift State Machine', () => {
  let mockShift: any;
  let mockUser: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock shift object
    mockShift = {
      _id: 'shift_123',
      staffId: 'user_456',
      siteId: 'site_789',
      currentState: 'idle',
      scheduledStart: new Date('2024-01-01T09:00:00Z'),
      scheduledEnd: new Date('2024-01-01T17:00:00Z'),
      actualStart: null,
      actualEnd: null,
      location: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 5
      },
      stateHistory: [],
      isActive: true,
      geofenceRequired: true,
      geofenceId: 'geofence_123',
      breakHistory: [],
      save: jest.fn().mockResolvedValue(true)
    };

    // Mock user object
    mockUser = {
      _id: 'user_456',
      firstName: 'John',
      lastName: 'Doe',
      role: 'FieldTech',
      isActive: true,
      currentShift: null,
      save: jest.fn().mockResolvedValue(true)
    };

    // Mock model methods
    (AdvancedShiftModel.findById as jest.Mock).mockResolvedValue(mockShift);
    (AdvancedShiftModel.findOne as jest.Mock).mockResolvedValue(mockShift);
    (UserModel.findById as jest.Mock).mockResolvedValue(mockUser);
  });

  describe('State Transitions', () => {
    describe('Idle to In-Shift', () => {
      it('should start shift successfully when conditions are met', async () => {
        const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
        
        const result = await shiftStateMachine.startShift('user_123', 'shift_123', location);

        expect(result).toBeDefined();
        expect(result.state).toBe('in-shift');
        expect(mockShift.actualStart).toBeDefined();
        expect(mockShift.save).toHaveBeenCalled();
      });

      it('should reject shift start if user is already in shift', async () => {
        mockUser.currentShift = 'another_shift_456';
        
        const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
        try {
          const result = await shiftStateMachine.startShift('user_123', 'shift_123', location);
          expect(result).toBeUndefined(); // Should throw error
        } catch (error) {
          expect(error.message).toContain('already in an active shift');
        }
      });

      it('should enforce geofencing when required', async () => {
        const { isWithinGeofence } = require('../services/geofencingService');
        isWithinGeofence.mockResolvedValue(false);

        const location = { latitude: 41.0000, longitude: -75.0000, accuracy: 3 };
        const result = await shiftStateMachine.startShift('shift_123', location);

        expect(result.success).toBe(false);
        expect(result.message).toContain('outside required geofence');
      });

      it('should allow shift start when geofencing is disabled', async () => {
        mockShift.geofenceRequired = false;
        
        const location = { latitude: 41.0000, longitude: -75.0000, accuracy: 3 };
        const result = await shiftStateMachine.startShift('shift_123', location);

        expect(result.success).toBe(true);
      });

      it('should validate GPS accuracy before starting shift', async () => {
        const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 50 }; // Poor accuracy
        
        const result = await shiftStateMachine.startShift('shift_123', location);

        expect(result.success).toBe(false);
        expect(result.message).toContain('GPS accuracy too low');
      });
    });

    describe('In-Shift to Break', () => {
      beforeEach(() => {
        mockShift.currentState = 'in-shift';
        mockShift.actualStart = new Date('2024-01-01T09:15:00Z');
      });

      it('should start break successfully', async () => {
        const breakData = {
          type: 'lunch',
          plannedDuration: 60,
          reason: 'Scheduled lunch break'
        };

        const result = await shiftStateMachine.startBreak('shift_123', breakData);

        expect(result.success).toBe(true);
        expect(result.data.newState).toBe('on-break');
        expect(mockShift.currentBreak).toBeDefined();
      });

      it('should track break history correctly', async () => {
        const breakData = { type: 'short', plannedDuration: 15 };

        await shiftStateMachine.startBreak('shift_123', breakData);

        expect(mockShift.breakHistory).toContainEqual(
          expect.objectContaining({
            type: 'short',
            startTime: expect.any(Date),
            plannedDuration: 15
          })
        );
      });

      it('should enforce maximum break duration policies', async () => {
        // Assuming lunch breaks can't exceed 90 minutes
        const breakData = { type: 'lunch', plannedDuration: 120 };

        const result = await shiftStateMachine.startBreak('shift_123', breakData);

        expect(result.success).toBe(false);
        expect(result.message).toContain('exceeds maximum allowed duration');
      });
    });

    describe('Break to In-Shift', () => {
      beforeEach(() => {
        mockShift.currentState = 'on-break';
        mockShift.currentBreak = {
          type: 'lunch',
          startTime: new Date('2024-01-01T12:00:00Z'),
          plannedDuration: 60
        };
        mockShift.breakHistory = [mockShift.currentBreak];
      });

      it('should end break and return to in-shift', async () => {
        const result = await shiftStateMachine.endBreak('shift_123');

        expect(result.success).toBe(true);
        expect(result.data.newState).toBe('in-shift');
        expect(mockShift.currentBreak.endTime).toBeDefined();
        expect(mockShift.currentBreak.actualDuration).toBeDefined();
      });

      it('should calculate actual break duration correctly', async () => {
        // Mock current time to be 45 minutes after break start
        const mockNow = new Date('2024-01-01T12:45:00Z');
        jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

        const result = await shiftStateMachine.endBreak('shift_123');

        expect(result.success).toBe(true);
        expect(mockShift.currentBreak.actualDuration).toBe(45); // minutes
      });

      it('should flag extended breaks', async () => {
        // Mock break that went over planned duration
        const mockNow = new Date('2024-01-01T13:30:00Z'); // 90 minutes later
        jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

        const result = await shiftStateMachine.endBreak('shift_123');

        expect(result.success).toBe(true);
        expect(result.data.extendedBreak).toBe(true);
        expect(result.data.overageMinutes).toBe(30);
      });
    });

    describe('In-Shift to Post-Shift', () => {
      beforeEach(() => {
        mockShift.currentState = 'in-shift';
        mockShift.actualStart = new Date('2024-01-01T09:15:00Z');
      });

      it('should end shift successfully with location validation', async () => {
        const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 4 };
        
        const result = await shiftStateMachine.endShift('shift_123', location);

        expect(result.success).toBe(true);
        expect(result.data.newState).toBe('post-shift');
        expect(mockShift.actualEnd).toBeDefined();
        expect(mockShift.totalHours).toBeDefined();
      });

      it('should calculate total shift hours correctly', async () => {
        const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 4 };
        
        // Mock current time to be 8 hours after start
        const mockNow = new Date('2024-01-01T17:15:00Z');
        jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

        const result = await shiftStateMachine.endShift('shift_123', location);

        expect(result.success).toBe(true);
        expect(result.data.totalHours).toBe(8);
      });

      it('should handle early shift endings', async () => {
        const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 4 };
        
        // Mock ending shift 2 hours early
        const mockNow = new Date('2024-01-01T15:00:00Z');
        jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

        const result = await shiftStateMachine.endShift('shift_123', location);

        expect(result.success).toBe(true);
        expect(result.data.earlyEnd).toBe(true);
        expect(result.data.scheduledHours).toBe(8);
        expect(result.data.actualHours).toBe(5.75); // 9:15 to 15:00
      });

      it('should require end location when geofencing is enabled', async () => {
        const { isWithinGeofence } = require('../services/geofencingService');
        isWithinGeofence.mockResolvedValue(false);

        const location = { latitude: 41.0000, longitude: -75.0000, accuracy: 4 };
        
        const result = await shiftStateMachine.endShift('shift_123', location);

        expect(result.success).toBe(false);
        expect(result.message).toContain('outside required geofence');
      });
    });

    describe('Post-Shift to Complete', () => {
      beforeEach(() => {
        mockShift.currentState = 'post-shift';
        mockShift.actualStart = new Date('2024-01-01T09:15:00Z');
        mockShift.actualEnd = new Date('2024-01-01T17:15:00Z');
        mockShift.totalHours = 8;
      });

      it('should complete shift after post-shift activities', async () => {
        const completionData = {
          summary: 'Completed all assigned tasks',
          issues: [],
          nextShiftNotes: 'Equipment ready for next shift'
        };

        const result = await shiftStateMachine.completeShift('shift_123', completionData);

        expect(result.success).toBe(true);
        expect(result.data.newState).toBe('completed');
        expect(mockShift.completedAt).toBeDefined();
        expect(mockShift.summary).toBe(completionData.summary);
      });

      it('should require summary for shift completion', async () => {
        const completionData = {}; // Missing required summary

        const result = await shiftStateMachine.completeShift('shift_123', completionData);

        expect(result.success).toBe(false);
        expect(result.message).toContain('Summary is required');
      });

      it('should handle overtime calculations', async () => {
        mockShift.totalHours = 10; // 2 hours overtime
        
        const completionData = { summary: 'Worked overtime to complete project' };

        const result = await shiftStateMachine.completeShift('shift_123', completionData);

        expect(result.success).toBe(true);
        expect(result.data.overtimeHours).toBe(2);
        expect(result.data.requiresApproval).toBe(true);
      });
    });
  });

  describe('Invalid State Transitions', () => {
    it('should reject invalid state transitions', async () => {
      mockShift.currentState = 'completed';
      
      const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
      const result = await shiftStateMachine.startShift('shift_123', location);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid state transition');
    });

    it('should reject break start when not in shift', async () => {
      mockShift.currentState = 'idle';
      
      const breakData = { type: 'short', plannedDuration: 15 };
      const result = await shiftStateMachine.startBreak('shift_123', breakData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot start break');
    });

    it('should reject shift end when on break', async () => {
      mockShift.currentState = 'on-break';
      
      const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
      const result = await shiftStateMachine.endShift('shift_123', location);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot end shift while on break');
    });
  });

  describe('Business Logic Validation', () => {
    it('should enforce minimum shift duration', async () => {
      mockShift.currentState = 'in-shift';
      mockShift.actualStart = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago

      const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
      const result = await shiftStateMachine.endShift('shift_123', location);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Minimum shift duration');
    });

    it('should limit maximum consecutive break time', async () => {
      // Mock shift with multiple breaks
      mockShift.currentState = 'in-shift';
      mockShift.breakHistory = [
        { type: 'short', actualDuration: 15, endTime: new Date() },
        { type: 'short', actualDuration: 15, endTime: new Date() },
        { type: 'lunch', actualDuration: 60, endTime: new Date() }
      ];

      const breakData = { type: 'short', plannedDuration: 15 };
      const result = await shiftStateMachine.startBreak('shift_123', breakData);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Maximum daily break time exceeded');
    });

    it('should validate scheduled shift times', async () => {
      // Mock shift that's being started too early
      mockShift.scheduledStart = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours in future

      const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
      const result = await shiftStateMachine.startShift('shift_123', location);

      expect(result.success).toBe(false);
      expect(result.message).toContain('too early');
    });
  });

  describe('State History Tracking', () => {
    it('should record state transitions in history', async () => {
      const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
      
      await shiftStateMachine.startShift('shift_123', location);

      expect(mockShift.stateHistory).toContainEqual(
        expect.objectContaining({
          fromState: 'idle',
          toState: 'in-shift',
          timestamp: expect.any(Date),
          trigger: 'manual',
          location: location
        })
      );
    });

    it('should track automatic state transitions', async () => {
      // Mock automatic transition due to geofence exit
      const result = await shiftStateMachine.handleGeofenceExit('shift_123');

      expect(result.success).toBe(true);
      expect(mockShift.stateHistory).toContainEqual(
        expect.objectContaining({
          trigger: 'automatic',
          reason: 'geofence_exit'
        })
      );
    });

    it('should include metadata in state history', async () => {
      const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
      
      await shiftStateMachine.startShift('shift_123', location);

      const lastTransition = mockShift.stateHistory[mockShift.stateHistory.length - 1];
      expect(lastTransition.metadata).toEqual(
        expect.objectContaining({
          gpsAccuracy: 3,
          deviceId: expect.any(String),
          appVersion: expect.any(String)
        })
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database errors gracefully', async () => {
      (AdvancedShiftModel.findById as jest.Mock).mockRejectedValue(new Error('Database error'));

      const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
      const result = await shiftStateMachine.startShift('shift_123', location);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Database error');
    });

    it('should handle missing shift records', async () => {
      (AdvancedShiftModel.findById as jest.Mock).mockResolvedValue(null);

      const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
      const result = await shiftStateMachine.startShift('nonexistent_shift', location);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Shift not found');
    });

    it('should recover from corrupted state', async () => {
      mockShift.currentState = 'invalid_state';

      const result = await shiftStateMachine.recoverShiftState('shift_123');

      expect(result.success).toBe(true);
      expect(result.data.recoveredState).toBeDefined();
      expect(result.data.correctionApplied).toBe(true);
    });
  });

  describe('Geofencing Integration', () => {
    beforeEach(() => {
      const geofencingService = require('../services/geofencingService');
      geofencingService.isWithinGeofence.mockResolvedValue(true);
      geofencingService.getGeofenceInfo.mockResolvedValue({
        id: 'geofence_123',
        name: 'Office Building',
        radius: 100
      });
    });

    it('should handle geofence entry events', async () => {
      const result = await shiftStateMachine.handleGeofenceEntry('shift_123');

      expect(result.success).toBe(true);
      expect(result.data.autoStartAvailable).toBe(true);
    });

    it('should handle geofence exit events', async () => {
      mockShift.currentState = 'in-shift';
      
      const result = await shiftStateMachine.handleGeofenceExit('shift_123');

      expect(result.success).toBe(true);
      expect(result.data.alertSent).toBe(true);
    });

    it('should provide geofence status information', async () => {
      const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
      
      const result = await shiftStateMachine.getGeofenceStatus('shift_123', location);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('isWithinGeofence');
      expect(result.data).toHaveProperty('distance');
      expect(result.data).toHaveProperty('geofenceInfo');
    });
  });

  describe('Audit and Compliance', () => {
    it('should record audit logs for all state changes', async () => {
      const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
      
      await shiftStateMachine.startShift('shift_123', location);

      expect(recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'shift_state_transition',
          entityType: 'Shift',
          entityId: 'shift_123'
        })
      );
    });

    it('should maintain compliance data for reporting', async () => {
      const result = await shiftStateMachine.getComplianceReport('shift_123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('stateTransitions');
      expect(result.data).toHaveProperty('breakCompliance');
      expect(result.data).toHaveProperty('geofenceCompliance');
      expect(result.data).toHaveProperty('auditTrail');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track state machine performance metrics', async () => {
      const startTime = Date.now();
      
      const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
      const result = await shiftStateMachine.startShift('shift_123', location);

      expect(result.success).toBe(true);
      expect(result.processingTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle concurrent state transitions safely', async () => {
      const location = { latitude: 40.7128, longitude: -74.0060, accuracy: 3 };
      
      // Simulate concurrent requests
      const promises = [
        shiftStateMachine.startShift('shift_123', location),
        shiftStateMachine.startShift('shift_123', location)
      ];

      const results = await Promise.allSettled(promises);
      
      // Only one should succeed due to state locking
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      expect(successCount).toBe(1);
    });
  });
});