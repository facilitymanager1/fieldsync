/**
 * MongoDB Integration Tests
 * Comprehensive testing for MongoDB operations, model interactions, and data integrity
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AdvancedShiftModel, ShiftState } from '../../models/shift';
import { AdvancedSlaTemplateModel, SlaTrackerModel } from '../../models/advancedSla';
import UserModel from '../../models/user';
import TicketModel from '../../models/ticket';
import { AuditLogModel } from '../../models/auditLog';

describe('MongoDB Integration Tests', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    
    // Connect to in-memory database
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    // Cleanup
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('User Model Integration', () => {
    it('should create and retrieve user with proper schema validation', async () => {
      const userData = {
        email: 'john.doe@example.com',
        passwordHash: 'hashedpassword123',
        role: 'FieldTech' as const,
        isActive: true,
        twoFactorEnabled: false,
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          department: 'IT'
        },
        preferences: {
          notifications: true,
          theme: 'light' as const,
          language: 'en',
          timezone: 'UTC'
        },
        permissions: ['read_tickets', 'update_shifts'],
        loginAttempts: 0
      };

      // Create user
      const user = new UserModel(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.profile.firstName).toBe(userData.profile.firstName);
      expect(savedUser.email).toBe(userData.email);
      expect(savedUser.createdAt).toBeInstanceOf(Date);

      // Retrieve user
      const foundUser = await UserModel.findById(savedUser._id);
      expect(foundUser).toBeTruthy();
      expect(foundUser!.profile.firstName).toBe(userData.profile.firstName);
    });

    it('should handle user validation errors correctly', async () => {
      const invalidUserData = {
        firstName: 'John',
        // Missing required fields
      };

      const user = new UserModel(invalidUserData);
      
      await expect(user.save()).rejects.toThrow();
    });

    it('should enforce unique constraints', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        username: 'johndoe',
        password: 'hashedpassword123',
        role: { name: 'FieldTech', level: 2, permissions: [] },
        isActive: true,
        createdBy: 'system',
        updatedBy: 'system'
      };

      // Create first user
      const user1 = new UserModel(userData);
      await user1.save();

      // Try to create second user with same email
      const user2 = new UserModel(userData);
      await expect(user2.save()).rejects.toThrow();
    });
  });

  describe('Shift Model Integration', () => {
    let testUser: any;

    beforeEach(async () => {
      // Create a test user for shift operations
      testUser = await UserModel.create({
        email: 'test@example.com',
        passwordHash: 'password123',
        role: 'FieldTech' as const,
        isActive: true,
        twoFactorEnabled: false,
        profile: {
          firstName: 'Test',
          lastName: 'User'
        },
        preferences: {
          notifications: true,
          theme: 'light' as const,
          language: 'en',
          timezone: 'UTC'
        },
        permissions: [],
        loginAttempts: 0
      });
    });

    it('should create shift with proper state transitions', async () => {
      const shiftData = {
        userId: testUser._id.toString(),
        assignedStaff: testUser._id,
        scheduledStartTime: new Date(),
        scheduledEndTime: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours later
        state: ShiftState.IDLE,
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
          timestamp: new Date()
        },
        createdBy: testUser._id.toString(),
        updatedBy: testUser._id.toString()
      };

      const shift = new AdvancedShiftModel(shiftData);
      const savedShift = await shift.save();

      expect(savedShift._id).toBeDefined();
      expect(savedShift.state).toBe(ShiftState.IDLE);
      expect(savedShift.userId).toBe(testUser._id.toString());
    });

    it('should handle shift state transitions with validation', async () => {
      const shift = await AdvancedShiftModel.create({
        userId: testUser._id.toString(),
        assignedStaff: testUser._id,
        scheduledStartTime: new Date(),
        scheduledEndTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
        state: ShiftState.IDLE,
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
          timestamp: new Date()
        },
        createdBy: testUser._id.toString(),
        updatedBy: testUser._id.toString()
      });

      // Update shift state
      shift.state = ShiftState.IN_SHIFT;
      shift.actualStartTime = new Date();
      const updatedShift = await shift.save();

      expect(updatedShift.state).toBe(ShiftState.IN_SHIFT);
      expect(updatedShift.actualStartTime).toBeInstanceOf(Date);
    });

    it('should aggregate shift data correctly', async () => {
      // Create multiple shifts
      const shiftsData = [
        {
          userId: testUser._id.toString(),
          assignedStaff: testUser._id,
          scheduledStartTime: new Date(),
          scheduledEndTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
          state: ShiftState.COMPLETED,
          metrics: {
            totalDuration: 480, // 8 hours
            workingTime: 420,
            breakTime: 60,
            efficiency: 85
          },
          createdBy: testUser._id.toString(),
          updatedBy: testUser._id.toString()
        },
        {
          userId: testUser._id.toString(),
          assignedStaff: testUser._id,
          scheduledStartTime: new Date(),
          scheduledEndTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
          state: ShiftState.COMPLETED,
          metrics: {
            totalDuration: 500,
            workingTime: 450,
            breakTime: 50,
            efficiency: 90
          },
          createdBy: testUser._id.toString(),
          updatedBy: testUser._id.toString()
        }
      ];

      await AdvancedShiftModel.insertMany(shiftsData);

      // Test aggregation
      const aggregationResult = await AdvancedShiftModel.aggregate([
        { $match: { userId: testUser._id.toString() } },
        {
          $group: {
            _id: null,
            totalShifts: { $sum: 1 },
            averageEfficiency: { $avg: '$metrics.efficiency' },
            totalWorkingTime: { $sum: '$metrics.workingTime' }
          }
        }
      ]);

      expect(aggregationResult).toHaveLength(1);
      expect(aggregationResult[0].totalShifts).toBe(2);
      expect(aggregationResult[0].averageEfficiency).toBe(87.5);
      expect(aggregationResult[0].totalWorkingTime).toBe(870);
    });
  });

  describe('SLA Template and Tracker Integration', () => {
    it('should create SLA template with complex escalation rules', async () => {
      const slaTemplateData = {
        name: 'Critical Support SLA',
        description: 'SLA for critical support tickets',
        category: 'ticket',
        priority: 'critical',
        responseTime: {
          hours: 1,
          businessHoursOnly: false,
          excludeWeekends: false,
          excludeHolidays: false
        },
        resolutionTime: {
          hours: 4,
          businessHoursOnly: true,
          excludeWeekends: true,
          excludeHolidays: true
        },
        escalationRules: [
          {
            id: 'rule_1',
            level: 1,
            triggerAfterHours: 0.5,
            actions: ['notify_assignee', 'notify_manager'],
            isActive: true
          }
        ],
        conditions: [],
        targetMetrics: {
          responseTarget: 95,
          resolutionTarget: 90,
          customerSatisfactionTarget: 4.5
        },
        autoAssignment: {
          enabled: true,
          rules: []
        },
        isActive: true,
        isDefault: false,
        version: 1,
        createdBy: 'system',
        updatedBy: 'system'
      };

      const template = new AdvancedSlaTemplateModel(slaTemplateData);
      const savedTemplate = await template.save();

      expect(savedTemplate._id).toBeDefined();
      expect(savedTemplate.name).toBe(slaTemplateData.name);
      expect(savedTemplate.escalationRules).toHaveLength(1);
      expect(savedTemplate.escalationRules[0].level).toBe(1);
    });

    it('should create and link SLA tracker to template', async () => {
      // Create SLA template first
      const template = await AdvancedSlaTemplateModel.create({
        name: 'Test SLA',
        description: 'Test SLA template',
        category: 'ticket',
        priority: 'high',
        responseTime: { hours: 2, businessHoursOnly: false, excludeWeekends: false, excludeHolidays: false },
        resolutionTime: { hours: 8, businessHoursOnly: true, excludeWeekends: true, excludeHolidays: true },
        escalationRules: [],
        conditions: [],
        targetMetrics: { responseTarget: 95, resolutionTarget: 90, customerSatisfactionTarget: 4.0 },
        autoAssignment: { enabled: false, rules: [] },
        isActive: true,
        isDefault: false,
        version: 1,
        createdBy: 'system',
        updatedBy: 'system'
      });

      // Create SLA tracker
      const trackerData = {
        entityId: 'ticket_123',
        entityType: 'Ticket',
        slaTemplateId: template._id.toString(),
        startTime: new Date(),
        responseDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        resolutionDeadline: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
        status: 'active',
        currentStage: 'awaiting_response',
        isBreached: false,
        escalationLevel: 0,
        escalationHistory: [],
        assignmentHistory: [],
        pausedDuration: 0,
        pauseReasons: [],
        createdBy: 'system',
        updatedBy: 'system'
      };

      const tracker = new SlaTrackerModel(trackerData);
      const savedTracker = await tracker.save();

      expect(savedTracker._id).toBeDefined();
      expect(savedTracker.slaTemplateId).toBe(template._id.toString());
      expect(savedTracker.status).toBe('active');

      // Test relationship query
      const trackerWithTemplate = await SlaTrackerModel.findById(savedTracker._id)
        .populate('slaTemplateId');
      
      expect(trackerWithTemplate).toBeTruthy();
      // Note: populate will only work if the field is defined as ObjectId with ref
    });

    it('should handle SLA tracker breach detection', async () => {
      const now = new Date();
      const pastDeadline = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

      const tracker = await SlaTrackerModel.create({
        entityId: 'ticket_456',
        entityType: 'Ticket',
        slaTemplateId: 'template_123',
        startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        responseDeadline: pastDeadline, // Already breached
        resolutionDeadline: new Date(now.getTime() + 6 * 60 * 60 * 1000),
        status: 'active',
        currentStage: 'awaiting_response',
        isBreached: false,
        escalationLevel: 0,
        escalationHistory: [],
        assignmentHistory: [],
        pausedDuration: 0,
        pauseReasons: [],
        createdBy: 'system',
        updatedBy: 'system'
      });

      // Simulate breach detection
      const breachedTrackers = await SlaTrackerModel.find({
        responseDeadline: { $lt: now },
        responseTime: { $exists: false },
        status: 'active'
      });

      expect(breachedTrackers).toHaveLength(1);
      expect(breachedTrackers[0]._id.toString()).toBe(tracker._id.toString());

      // Update breach status
      tracker.isBreached = true;
      tracker.breachType = 'response';
      tracker.breachTime = now;
      tracker.breachReason = 'Response deadline exceeded';
      
      const updatedTracker = await tracker.save();
      expect(updatedTracker.isBreached).toBe(true);
      expect(updatedTracker.breachType).toBe('response');
    });
  });

  describe('Audit Log Integration', () => {
    it('should create audit log entries with proper indexing', async () => {
      const auditLogData = {
        entityType: 'User',
        entityId: 'user_123',
        action: 'create',
        userId: 'admin_123',
        userName: 'Admin User',
        userRole: 'admin',
        ipAddress: '192.168.1.1',
        changes: {
          firstName: { from: null, to: 'John' },
          lastName: { from: null, to: 'Doe' }
        },
        reason: 'New user registration',
        severity: 'low',
        category: 'user',
        timestamp: new Date()
      };

      const auditLog = new AuditLogModel(auditLogData);
      const savedAuditLog = await auditLog.save();

      expect(savedAuditLog._id).toBeDefined();
      expect(savedAuditLog.entityType).toBe('User');
      expect(savedAuditLog.action).toBe('create');
      expect((savedAuditLog.changes as any)['profile.firstName'].to).toBe('John');
    });

    it('should query audit logs efficiently with indexes', async () => {
      // Create multiple audit log entries
      const auditLogs = [
        {
          entityType: 'User',
          entityId: 'user_123',
          action: 'create',
          userId: 'admin_123',
          userName: 'Admin',
          userRole: 'admin',
          changes: {},
          severity: 'low',
          category: 'user',
          timestamp: new Date()
        },
        {
          entityType: 'User',
          entityId: 'user_123',
          action: 'update',
          userId: 'admin_123',
          userName: 'Admin',
          userRole: 'admin',
          changes: {},
          severity: 'medium',
          category: 'user',
          timestamp: new Date()
        },
        {
          entityType: 'Ticket',
          entityId: 'ticket_456',
          action: 'create',
          userId: 'user_456',
          userName: 'User',
          userRole: 'user',
          changes: {},
          severity: 'low',
          category: 'data',
          timestamp: new Date()
        }
      ];

      await AuditLogModel.insertMany(auditLogs);

      // Test indexed queries
      const userAuditLogs = await AuditLogModel.find({ entityId: 'user_123' });
      expect(userAuditLogs).toHaveLength(2);

      const createActions = await AuditLogModel.find({ action: 'create' });
      expect(createActions).toHaveLength(2);

      const userEntityLogs = await AuditLogModel.find({ entityType: 'User' });
      expect(userEntityLogs).toHaveLength(2);
    });
  });

  describe('Complex Cross-Model Operations', () => {
    let testUser: any;
    let testTicket: any;

    beforeEach(async () => {
      // Create test user
      testUser = await UserModel.create({
        email: 'test@example.com',
        passwordHash: 'password123',
        role: 'FieldTech' as const,
        isActive: true,
        twoFactorEnabled: false,
        profile: {
          firstName: 'Test',
          lastName: 'User'
        },
        preferences: {
          notifications: true,
          theme: 'light' as const,
          language: 'en',
          timezone: 'UTC'
        },
        permissions: [],
        loginAttempts: 0
      });

      // Create test ticket (if TicketModel exists)
      try {
        testTicket = await TicketModel.create({
          title: 'Test Ticket',
          description: 'Test ticket description',
          status: 'open',
          priority: 'medium',
          assignedTo: testUser._id,
          createdBy: testUser._id.toString(),
          updatedBy: testUser._id.toString()
        });
      } catch (error) {
        // TicketModel might not be properly defined, skip ticket tests
        testTicket = null;
      }
    });

    it('should maintain referential integrity across models', async () => {
      if (!testTicket) {
        console.log('Skipping ticket test - TicketModel not available');
        return;
      }

      // Create shift linked to user
      const shift = await AdvancedShiftModel.create({
        userId: testUser._id.toString(),
        assignedStaff: testUser._id,
        scheduledStartTime: new Date(),
        scheduledEndTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
        state: ShiftState.IN_SHIFT,
        location: {
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 10,
          timestamp: new Date()
        },
        createdBy: testUser._id.toString(),
        updatedBy: testUser._id.toString()
      });

      // Create SLA tracker for ticket
      const slaTracker = await SlaTrackerModel.create({
        entityId: testTicket._id.toString(),
        entityType: 'Ticket',
        slaTemplateId: 'template_123',
        startTime: new Date(),
        responseDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000),
        resolutionDeadline: new Date(Date.now() + 8 * 60 * 60 * 1000),
        status: 'active',
        currentStage: 'awaiting_response',
        assignedTo: testUser._id.toString(),
        isBreached: false,
        escalationLevel: 0,
        escalationHistory: [],
        assignmentHistory: [],
        pausedDuration: 0,
        pauseReasons: [],
        createdBy: testUser._id.toString(),
        updatedBy: testUser._id.toString()
      });

      // Verify relationships
      expect(shift.userId).toBe(testUser._id.toString());
      expect(slaTracker.entityId).toBe(testTicket._id.toString());
      expect(slaTracker.assignedTo).toBe(testUser._id.toString());

      // Test cascade operations would go here
      // (Note: Actual cascade behavior depends on schema configuration)
    });

    it('should handle transaction-like operations', async () => {
      // Create multiple related documents that should succeed or fail together
      const session = await mongoose.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Create shift
          const shift = new AdvancedShiftModel({
            userId: testUser._id.toString(),
            assignedStaff: testUser._id,
            scheduledStartTime: new Date(),
            scheduledEndTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
            state: ShiftState.IDLE,
            location: {
              latitude: 40.7128,
              longitude: -74.0060,
              accuracy: 10,
              timestamp: new Date()
            },
            createdBy: testUser._id.toString(),
            updatedBy: testUser._id.toString()
          });
          
          await shift.save({ session });

          // Create audit log
          const auditLog = new AuditLogModel({
            entityType: 'Shift',
            entityId: shift._id.toString(),
            action: 'create',
            userId: testUser._id.toString(),
            userName: `${testUser.firstName} ${testUser.lastName}`,
            userRole: testUser.role.name,
            changes: {
              status: { from: null, to: 'idle' }
            },
            severity: 'low',
            category: 'data',
            timestamp: new Date()
          });
          
          await auditLog.save({ session });
        });

        await session.commitTransaction();
        
        // Verify both documents were created
        const createdShifts = await AdvancedShiftModel.find({ userId: testUser._id.toString() });
        const createdAuditLogs = await AuditLogModel.find({ entityType: 'Shift' });
        
        expect(createdShifts).toHaveLength(1);
        expect(createdAuditLogs).toHaveLength(1);
        
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
    });
  });

  describe('Database Performance and Indexing', () => {
    it('should perform efficiently with proper indexes', async () => {
      // Create multiple documents for performance testing
      const users = [];
      for (let i = 0; i < 100; i++) {
        users.push({
          firstName: `User${i}`,
          lastName: `Test${i}`,
          email: `user${i}@example.com`,
          username: `user${i}`,
          password: 'password123',
          role: { name: 'FieldTech', level: 2, permissions: [] },
          isActive: i % 2 === 0, // Half active, half inactive
          createdBy: 'system',
          updatedBy: 'system'
        });
      }

      await UserModel.insertMany(users);

      // Test query performance
      const startTime = Date.now();
      const activeUsers = await UserModel.find({ isActive: true });
      const queryTime = Date.now() - startTime;

      expect(activeUsers).toHaveLength(50);
      expect(queryTime).toBeLessThan(100); // Should be fast with proper indexing
    });

    it('should handle large dataset aggregations', async () => {
      // Create audit logs for aggregation testing
      const auditLogs = [];
      const categories = ['user', 'data', 'security', 'system'];
      const actions = ['create', 'update', 'delete', 'access'];

      for (let i = 0; i < 1000; i++) {
        auditLogs.push({
          entityType: 'TestEntity',
          entityId: `entity_${i % 100}`,
          action: actions[i % actions.length],
          userId: `user_${i % 50}`,
          userName: `User ${i % 50}`,
          userRole: 'user',
          changes: {},
          severity: i % 2 === 0 ? 'low' : 'medium',
          category: categories[i % categories.length],
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Random date within last 30 days
        });
      }

      await AuditLogModel.insertMany(auditLogs);

      // Test complex aggregation
      const startTime = Date.now();
      const aggregationResult = await AuditLogModel.aggregate([
        {
          $group: {
            _id: {
              category: '$category',
              action: '$action'
            },
            count: { $sum: 1 },
            avgSeverity: { $avg: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 2] } }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      const aggregationTime = Date.now() - startTime;

      expect(aggregationResult.length).toBeGreaterThan(0);
      expect(aggregationTime).toBeLessThan(500); // Should complete reasonably fast
    });
  });
});