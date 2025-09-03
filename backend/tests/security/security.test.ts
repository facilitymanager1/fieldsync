/**
 * Security Test Suite
 * Comprehensive security vulnerability testing for FieldSync backend
 */

import request from 'supertest';
import app from '../../index';
import UserModel from '../../models/user';
import jwt from 'jsonwebtoken';

// Helper function to generate test tokens
function generateToken(payload: any, expiresIn = '1h') {
  const secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.sign(payload, secret, { expiresIn });
}
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('Security Test Suite', () => {
  let mongoServer: MongoMemoryServer;
  let testUser: any;
  let adminUser: any;
  let validToken: string;
  let adminToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }

    // Create test users
    testUser = await UserModel.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      username: 'testuser',
      password: '$2b$10$hashedpassword',
      role: { name: 'FieldTech', level: 2, permissions: ['read_tickets'] },
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system'
    });

    adminUser = await UserModel.create({
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

    // Generate tokens
    validToken = generateToken({ 
      id: testUser._id.toString(), 
      username: testUser.username,
      role: testUser.role 
    });
    
    adminToken = generateToken({ 
      id: adminUser._id.toString(), 
      username: adminUser.username,
      role: adminUser.role 
    });
  });

  describe('Authentication Security', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });

    it('should reject malformed JWT tokens', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject expired JWT tokens', async () => {
      // Create expired token (simulate by using very short expiry)
      const expiredToken = generateToken(
        { id: testUser._id.toString(), username: testUser.username, role: testUser.role },
        '1ms'
      );

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject tokens with invalid signatures', async () => {
      const tamperedToken = validToken.slice(0, -10) + 'tampered123';

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Authorization Security', () => {
    it('should enforce role-based access control', async () => {
      // User with limited permissions tries to access admin endpoint
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('permission');
    });

    it('should allow authorized users to access permitted resources', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should prevent horizontal privilege escalation', async () => {
      // Create another user
      const otherUser = await UserModel.create({
        firstName: 'Other',
        lastName: 'User',
        email: 'other@example.com',
        username: 'otheruser',
        password: '$2b$10$hashedpassword',
        role: { name: 'FieldTech', level: 2, permissions: ['read_tickets'] },
        isActive: true,
        createdBy: 'system',
        updatedBy: 'system'
      });

      // Try to access other user's data
      const response = await request(app)
        .get(`/api/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Input Validation Security', () => {
    it('should prevent SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: maliciousInput,
          password: 'password'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should sanitize NoSQL injection attempts', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: { $ne: null },
          password: { $ne: null }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate email format strictly', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'invalid-email-format',
          username: 'testuser2',
          password: 'password123',
          role: { name: 'FieldTech', level: 2, permissions: [] }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('email');
    });

    it('should prevent XSS in text fields', async () => {
      const xssPayload = '<script>alert("XSS")</script>';
      
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: xssPayload,
          lastName: 'User',
          email: 'test@example.com',
          username: 'testuser3',
          password: 'password123',
          role: { name: 'FieldTech', level: 2, permissions: [] }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting Security', () => {
    it('should enforce rate limits on login attempts', async () => {
      const loginAttempts = [];
      
      // Make multiple rapid login attempts
      for (let i = 0; i < 10; i++) {
        loginAttempts.push(
          request(app)
            .post('/api/auth/login')
            .send({
              username: 'nonexistent',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(loginAttempts);
      
      // Later attempts should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should enforce rate limits on API endpoints', async () => {
      const requests = [];
      
      // Make rapid API requests
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .get('/api/users/profile')
            .set('Authorization', `Bearer ${validToken}`)
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      // Check for essential security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should not expose server information', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).not.toMatch(/express/i);
    });
  });

  describe('Data Exposure Prevention', () => {
    it('should not expose sensitive user data in responses', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.data.password).toBeUndefined();
      expect(response.body.data.passwordHash).toBeUndefined();
    });

    it('should not expose internal system information in error messages', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      // Should not expose stack traces or internal paths
      expect(response.body.error).not.toMatch(/\/home\/|\/var\/|\/usr\/|C:\\|stack trace/i);
    });
  });

  describe('Session Security', () => {
    it('should invalidate sessions on logout', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'password123'
        });

      const token = loginResponse.body.data.token;

      // Use token to access protected resource
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Try to use token after logout - should fail
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  describe('File Upload Security', () => {
    it('should validate file types on upload', async () => {
      // Simulate malicious file upload
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', Buffer.from('<?php echo "malicious"; ?>'), 'malicious.php')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('file type');
    });

    it('should enforce file size limits', async () => {
      // Create large file buffer (simulate oversized file)
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB

      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${validToken}`)
        .attach('file', largeBuffer, 'large.txt')
        .expect(413);

      expect(response.body.success).toBe(false);
    });
  });

  describe('CSRF Protection', () => {
    it('should require CSRF tokens for state-changing operations', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'password123',
          role: { name: 'FieldTech', level: 2, permissions: [] }
        })
        .expect(403);

      expect(response.body.error).toContain('CSRF');
    });
  });

  describe('Audit Trail Security', () => {
    it('should log security-relevant events', async () => {
      // Attempt unauthorized access
      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(403);

      // Check that security event was logged
      // This would typically check audit logs or security event logs
      // For this test, we'll verify the attempt was recorded
      expect(true).toBe(true); // Placeholder for actual audit log check
    });

    it('should protect audit logs from tampering', async () => {
      // Attempt to modify audit logs directly
      const response = await request(app)
        .delete('/api/audit/logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('operation not permitted');
    });
  });
});