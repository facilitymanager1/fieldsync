/**
 * Performance Test Suite
 * Comprehensive performance benchmarking for FieldSync backend
 */

import request from 'supertest';
import app from '../../index';
import UserModel from '../../models/user';
import { AdvancedShiftModel } from '../../models/shift';
import TicketModel from '../../models/ticket';
import { AuditLogModel } from '../../models/auditLog';
import jwt from 'jsonwebtoken';

// Helper function to generate test tokens
function generateToken(payload: any, expiresIn = '1h') {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign(payload, secret, { expiresIn });
}
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { performance } from 'perf_hooks';

describe('Performance Test Suite', () => {
  let mongoServer: MongoMemoryServer;
  let testUser: any;
  let adminToken: string;
  const PERFORMANCE_THRESHOLDS = {
    API_RESPONSE_MS: 500,
    DATABASE_QUERY_MS: 100,
    CONCURRENT_REQUESTS: 50,
    BULK_OPERATION_MS: 2000,
    MEMORY_USAGE_MB: 100
  };

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create test user and token
    testUser = await UserModel.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      username: 'adminuser',
      password: '$2b$10$hashedpassword',
      role: { name: 'Admin', level: 5, permissions: ['*'] },
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system'
    });

    adminToken = generateToken({ 
      id: testUser._id.toString(), 
      username: testUser.username,
      role: testUser.role 
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear test data but keep test user
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      if (key !== 'users') {
        await collections[key].deleteMany({});
      }
    }
  });

  describe('API Response Time Performance', () => {
    it('should respond to health check within threshold', async () => {
      const start = performance.now();
      
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      const duration = performance.now() - start;
      
      expect(response.body.success).toBe(true);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_MS);
    });

    it('should handle authentication requests efficiently', async () => {
      const start = performance.now();
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'password123'
        });

      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_MS);
    });

    it('should handle user profile requests efficiently', async () => {
      const start = performance.now();
      
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const duration = performance.now() - start;
      
      expect(response.body.success).toBe(true);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_MS);
    });
  });

  describe('Database Query Performance', () => {
    beforeEach(async () => {
      // Create test data for performance testing
      const users = [];
      for (let i = 0; i < 100; i++) {
        users.push({
          firstName: `User${i}`,
          lastName: `Test${i}`,
          email: `user${i}@example.com`,
          username: `user${i}`,
          password: '$2b$10$hashedpassword',
          role: { name: 'FieldTech', level: 2, permissions: ['read_tickets'] },
          isActive: i % 2 === 0,
          createdBy: 'system',
          updatedBy: 'system'
        });
      }
      await UserModel.insertMany(users);
    });

    it('should query users efficiently with indexes', async () => {
      const start = performance.now();
      
      const users = await UserModel.find({ isActive: true }).limit(50).exec();
      
      const duration = performance.now() - start;
      
      expect(users.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DATABASE_QUERY_MS);
    });

    it('should perform aggregation queries efficiently', async () => {
      const start = performance.now();
      
      const stats = await UserModel.aggregate([
        {
          $group: {
            _id: '$isActive',
            count: { $sum: 1 },
            roles: { $addToSet: '$role.name' }
          }
        }
      ]).exec();
      
      const duration = performance.now() - start;
      
      expect(stats.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DATABASE_QUERY_MS);
    });

    it('should handle complex queries with multiple conditions', async () => {
      const start = performance.now();
      
      const users = await UserModel.find({
        isActive: true,
        'role.name': 'FieldTech',
        email: { $regex: '@example.com$' }
      }).sort({ createdAt: -1 }).limit(20).exec();
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DATABASE_QUERY_MS);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent API requests', async () => {
      const start = performance.now();
      const requests = [];
      
      // Create multiple concurrent requests
      for (let i = 0; i < PERFORMANCE_THRESHOLDS.CONCURRENT_REQUESTS; i++) {
        requests.push(
          request(app)
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${adminToken}`)
        );
      }
      
      const responses = await Promise.all(requests);
      const duration = performance.now() - start;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
      
      // Average response time should be reasonable
      const avgResponseTime = duration / PERFORMANCE_THRESHOLDS.CONCURRENT_REQUESTS;
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_MS);
    });

    it('should handle concurrent database operations', async () => {
      const start = performance.now();
      const operations = [];
      
      // Create multiple concurrent database operations
      for (let i = 0; i < 20; i++) {
        operations.push(
          UserModel.findById(testUser._id).exec()
        );
      }
      
      const results = await Promise.all(operations);
      const duration = performance.now() - start;
      
      // All operations should succeed
      results.forEach(result => {
        expect(result).toBeTruthy();
        expect(result!._id.toString()).toBe(testUser._id.toString());
      });
      
      expect(duration).toBeLessThan(1000); // 1 second for 20 concurrent ops
    });
  });

  describe('Bulk Operations Performance', () => {
    it('should handle bulk user creation efficiently', async () => {
      const users = [];
      for (let i = 0; i < 500; i++) {
        users.push({
          firstName: `BulkUser${i}`,
          lastName: `Test${i}`,
          email: `bulkuser${i}@example.com`,
          username: `bulkuser${i}`,
          password: '$2b$10$hashedpassword',
          role: { name: 'FieldTech', level: 2, permissions: [] },
          isActive: true,
          createdBy: 'system',
          updatedBy: 'system'
        });
      }
      
      const start = performance.now();
      const createdUsers = await UserModel.insertMany(users);
      const duration = performance.now() - start;
      
      expect(createdUsers.length).toBe(500);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_MS);
    });

    it('should handle bulk updates efficiently', async () => {
      // Create test data first
      const users = [];
      for (let i = 0; i < 100; i++) {
        users.push({
          firstName: `UpdateUser${i}`,
          lastName: `Test${i}`,
          email: `updateuser${i}@example.com`,
          username: `updateuser${i}`,
          password: '$2b$10$hashedpassword',
          role: { name: 'FieldTech', level: 2, permissions: [] },
          isActive: true,
          createdBy: 'system',
          updatedBy: 'system'
        });
      }
      await UserModel.insertMany(users);
      
      const start = performance.now();
      const updateResult = await UserModel.updateMany(
        { firstName: { $regex: '^UpdateUser' } },
        { $set: { isActive: false, updatedBy: 'bulk_update' } }
      ).exec();
      const duration = performance.now() - start;
      
      expect(updateResult.modifiedCount).toBe(100);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_MS);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage during operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive operation
      const largeDataSet = [];
      for (let i = 0; i < 1000; i++) {
        largeDataSet.push({
          id: i,
          data: 'x'.repeat(1000), // 1KB per record
          timestamp: new Date()
        });
      }
      
      // Process the data
      const processed = largeDataSet.map(item => ({
        ...item,
        processed: true,
        processedAt: new Date()
      }));
      
      const finalMemory = process.memoryUsage();
      const memoryDiff = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB
      
      expect(processed.length).toBe(1000);
      expect(memoryDiff).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB);
    });

    it('should clean up memory after bulk operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform bulk operation
      const users = [];
      for (let i = 0; i < 1000; i++) {
        users.push({
          firstName: `MemoryUser${i}`,
          lastName: `Test${i}`,
          email: `memoryuser${i}@example.com`,
          username: `memoryuser${i}`,
          password: '$2b$10$hashedpassword',
          role: { name: 'FieldTech', level: 2, permissions: [] },
          isActive: true,
          createdBy: 'system',
          updatedBy: 'system'
        });
      }
      
      await UserModel.insertMany(users);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryDiff = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB
      
      // Memory increase should be reasonable
      expect(memoryDiff).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB);
    });
  });

  describe('Audit Log Performance', () => {
    it('should write audit logs efficiently', async () => {
      const auditEntries = [];
      for (let i = 0; i < 1000; i++) {
        auditEntries.push({
          entityType: 'User',
          entityId: `user_${i}`,
          action: 'create',
          userId: testUser._id.toString(),
          userName: 'Admin User',
          userRole: 'admin',
          changes: {
            status: { from: null, to: 'active' }
          },
          severity: 'low',
          category: 'data',
          timestamp: new Date()
        });
      }
      
      const start = performance.now();
      await AuditLogModel.insertMany(auditEntries);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_MS);
    });

    it('should query audit logs efficiently with indexes', async () => {
      // Create test audit logs
      const auditEntries = [];
      for (let i = 0; i < 500; i++) {
        auditEntries.push({
          entityType: i % 2 === 0 ? 'User' : 'Ticket',
          entityId: `entity_${i}`,
          action: ['create', 'update', 'delete'][i % 3],
          userId: testUser._id.toString(),
          userName: 'Admin User',
          userRole: 'admin',
          changes: {},
          severity: ['low', 'medium', 'high'][i % 3],
          category: 'data',
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
        });
      }
      await AuditLogModel.insertMany(auditEntries);
      
      const start = performance.now();
      const results = await AuditLogModel.find({
        entityType: 'User',
        action: 'create',
        severity: 'low'
      }).limit(50).exec();
      const duration = performance.now() - start;
      
      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DATABASE_QUERY_MS);
    });
  });

  describe('Real-world Scenario Performance', () => {
    it('should handle typical user workflow efficiently', async () => {
      const start = performance.now();
      
      // Simulate typical user workflow
      // 1. Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'password123'
        });
      
      const userToken = loginResponse.body.data.token;
      
      // 2. Get user profile
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`);
      
      // 3. Get user's shifts
      await request(app)
        .get('/api/shifts/my-shifts')
        .set('Authorization', `Bearer ${userToken}`);
      
      // 4. Create a new shift
      await request(app)
        .post('/api/shifts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          scheduledStartTime: new Date(),
          scheduledEndTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
          location: {
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 10
          }
        });
      
      // 5. Update shift status
      await request(app)
        .patch('/api/shifts/current/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'in_progress' });
      
      const duration = performance.now() - start;
      
      // Entire workflow should complete within reasonable time
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_MS);
    });

    it('should handle dashboard data loading efficiently', async () => {
      // Create test data for dashboard
      const shifts = [];
      for (let i = 0; i < 50; i++) {
        shifts.push({
          userId: testUser._id.toString(),
          assignedStaff: testUser._id,
          scheduledStartTime: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          scheduledEndTime: new Date(),
          state: ['idle', 'in_shift', 'completed'][i % 3],
          location: {
            latitude: 40.7128 + Math.random() * 0.1,
            longitude: -74.0060 + Math.random() * 0.1,
            accuracy: 10,
            timestamp: new Date()
          },
          createdBy: testUser._id.toString(),
          updatedBy: testUser._id.toString()
        });
      }
      await AdvancedShiftModel.insertMany(shifts);
      
      const start = performance.now();
      
      // Simulate dashboard API calls
      const dashboardData = await Promise.all([
        request(app)
          .get('/api/dashboard/stats')
          .set('Authorization', `Bearer ${adminToken}`),
        request(app)
          .get('/api/shifts?limit=10')
          .set('Authorization', `Bearer ${adminToken}`),
        request(app)
          .get('/api/analytics/summary')
          .set('Authorization', `Bearer ${adminToken}`)
      ]);
      
      const duration = performance.now() - start;
      
      // All dashboard requests should succeed
      dashboardData.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_OPERATION_MS);
    });
  });

  describe('Stress Testing', () => {
    it('should maintain performance under sustained load', async () => {
      const iterations = 100;
      const results = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${adminToken}`);
        
        const duration = performance.now() - start;
        results.push(duration);
        
        expect(response.status).toBe(200);
      }
      
      // Calculate performance statistics
      const avgResponseTime = results.reduce((a, b) => a + b, 0) / results.length;
      const maxResponseTime = Math.max(...results);
      const p95ResponseTime = results.sort((a, b) => a - b)[Math.floor(results.length * 0.95)];
      
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_MS);
      expect(maxResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_MS * 2);
      expect(p95ResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_MS * 1.5);
    });
  });
});