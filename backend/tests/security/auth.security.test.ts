/**
 * Authentication & Authorization Security Tests
 * Focused testing for authentication flows and authorization controls
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
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

describe('Authentication & Authorization Security', () => {
  let mongoServer: MongoMemoryServer;
  let adminUser: any;
  let fieldTechUser: any;
  let supervisorUser: any;
  let clientUser: any;
  let inactiveUser: any;

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

    // Create test users with different roles
    adminUser = await UserModel.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@fieldsync.com',
      username: 'admin',
      password: await bcrypt.hash('AdminPass123!', 10),
      role: { 
        name: 'Admin', 
        level: 5, 
        permissions: ['*'] 
      },
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system'
    });

    fieldTechUser = await UserModel.create({
      firstName: 'Field',
      lastName: 'Tech',
      email: 'fieldtech@fieldsync.com',
      username: 'fieldtech',
      password: await bcrypt.hash('FieldPass123!', 10),
      role: { 
        name: 'FieldTech', 
        level: 2, 
        permissions: ['read_tickets', 'update_shifts', 'create_reports'] 
      },
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system'
    });

    supervisorUser = await UserModel.create({
      firstName: 'Super',
      lastName: 'Visor',
      email: 'supervisor@fieldsync.com',
      username: 'supervisor',
      password: await bcrypt.hash('SuperPass123!', 10),
      role: { 
        name: 'Supervisor', 
        level: 3, 
        permissions: ['read_tickets', 'update_tickets', 'manage_team', 'view_analytics'] 
      },
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system'
    });

    clientUser = await UserModel.create({
      firstName: 'Client',
      lastName: 'User',
      email: 'client@company.com',
      username: 'client',
      password: await bcrypt.hash('ClientPass123!', 10),
      role: { 
        name: 'Client', 
        level: 1, 
        permissions: ['read_own_tickets', 'create_tickets'] 
      },
      isActive: true,
      createdBy: 'system',
      updatedBy: 'system'
    });

    inactiveUser = await UserModel.create({
      firstName: 'Inactive',
      lastName: 'User',
      email: 'inactive@fieldsync.com',
      username: 'inactive',
      password: await bcrypt.hash('InactivePass123!', 10),
      role: { 
        name: 'FieldTech', 
        level: 2, 
        permissions: ['read_tickets'] 
      },
      isActive: false,
      createdBy: 'system',
      updatedBy: 'system'
    });
  });

  describe('Authentication Flow Security', () => {
    it('should authenticate valid admin credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.role.name).toBe('Admin');
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should reject invalid username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'AdminPass123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'WrongPassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject inactive user login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'inactive',
          password: 'InactivePass123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('account is disabled');
    });

    it('should enforce strong password requirements', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Weak',
          lastName: 'Password',
          email: 'weak@test.com',
          username: 'weakpass',
          password: '123', // Weak password
          role: { name: 'FieldTech', level: 2, permissions: [] }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('password');
    });

    it('should prevent brute force attacks with account lockout', async () => {
      // Attempt multiple failed logins
      const attempts = [];
      for (let i = 0; i < 6; i++) {
        attempts.push(
          request(app)
            .post('/api/auth/login')
            .send({
              username: 'admin',
              password: 'WrongPassword'
            })
        );
      }

      const responses = await Promise.all(attempts);
      
      // Later attempts should be blocked
      const blockedAttempts = responses.filter(res => 
        res.status === 429 || res.body.error?.includes('locked')
      );
      
      expect(blockedAttempts.length).toBeGreaterThan(0);
    });
  });

  describe('JWT Token Security', () => {
    let validToken: string;

    beforeEach(async () => {
      validToken = generateToken({
        id: adminUser._id.toString(),
        username: adminUser.username,
        role: adminUser.role
      });
    });

    it('should validate JWT token structure', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('admin');
    });

    it('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'invalid.token.format',
        'Bearer invalid',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        ''
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      }
    });

    it('should reject tokens with tampered payload', async () => {
      // Create a token with tampered payload
      const header = jwt.decode(validToken, { complete: true })?.header;
      const tamperedPayload = {
        id: adminUser._id.toString(),
        username: 'hacker',
        role: { name: 'SuperAdmin', level: 10, permissions: ['*'] }
      };

      const tamperedToken = jwt.sign(tamperedPayload, 'wrong-secret');

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should enforce token expiration', async () => {
      // Create token with very short expiry
      const shortLivedToken = generateToken({
        id: adminUser._id.toString(),
        username: adminUser.username,
        role: adminUser.role
      }, '1ms');

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${shortLivedToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate token against user existence', async () => {
      // Create token for non-existent user
      const nonExistentToken = generateToken({
        id: new mongoose.Types.ObjectId().toString(),
        username: 'nonexistent',
        role: { name: 'Admin', level: 5, permissions: ['*'] }
      });

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${nonExistentToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    let adminToken: string;
    let supervisorToken: string;
    let fieldTechToken: string;
    let clientToken: string;

    beforeEach(async () => {
      adminToken = generateToken({
        id: adminUser._id.toString(),
        username: adminUser.username,
        role: adminUser.role
      });

      supervisorToken = generateToken({
        id: supervisorUser._id.toString(),
        username: supervisorUser.username,
        role: supervisorUser.role
      });

      fieldTechToken = generateToken({
        id: fieldTechUser._id.toString(),
        username: fieldTechUser.username,
        role: fieldTechUser.role
      });

      clientToken = generateToken({
        id: clientUser._id.toString(),
        username: clientUser.username,
        role: clientUser.role
      });
    });

    it('should allow admin access to all resources', async () => {
      const adminOnlyEndpoints = [
        '/api/admin/users',
        '/api/admin/system/config',
        '/api/admin/audit/logs'
      ];

      for (const endpoint of adminOnlyEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).not.toBe(403); // Should not be forbidden
      }
    });

    it('should restrict supervisor access appropriately', async () => {
      // Should have access to team management
      const teamResponse = await request(app)
        .get('/api/teams/my-team')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(200);

      expect(teamResponse.body.success).toBe(true);

      // Should NOT have access to admin-only resources
      const adminResponse = await request(app)
        .get('/api/admin/system/config')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(403);

      expect(adminResponse.body.success).toBe(false);
    });

    it('should restrict field tech access to job-related functions', async () => {
      // Should have access to own shifts
      const shiftsResponse = await request(app)
        .get('/api/shifts/my-shifts')
        .set('Authorization', `Bearer ${fieldTechToken}`)
        .expect(200);

      expect(shiftsResponse.body.success).toBe(true);

      // Should NOT have access to team management
      const teamResponse = await request(app)
        .get('/api/teams/all')
        .set('Authorization', `Bearer ${fieldTechToken}`)
        .expect(403);

      expect(teamResponse.body.success).toBe(false);
    });

    it('should restrict client access to own data only', async () => {
      // Should have access to own tickets
      const ticketsResponse = await request(app)
        .get('/api/tickets/my-tickets')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(ticketsResponse.body.success).toBe(true);

      // Should NOT have access to other user data
      const usersResponse = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(403);

      expect(usersResponse.body.success).toBe(false);
    });

    it('should prevent privilege escalation', async () => {
      // Field tech tries to modify their role
      const response = await request(app)
        .patch(`/api/users/${fieldTechUser._id}`)
        .set('Authorization', `Bearer ${fieldTechToken}`)
        .send({
          role: { name: 'Admin', level: 5, permissions: ['*'] }
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('permission');
    });

    it('should enforce permission-level granular access', async () => {
      // Test specific permission requirements
      const permissionTests = [
        {
          endpoint: '/api/reports/analytics',
          permission: 'view_analytics',
          allowedRoles: ['Admin', 'Supervisor'],
          deniedRoles: ['FieldTech', 'Client']
        },
        {
          endpoint: '/api/tickets/assign',
          permission: 'manage_tickets',
          allowedRoles: ['Admin', 'Supervisor'],
          deniedRoles: ['FieldTech', 'Client']
        }
      ];

      for (const test of permissionTests) {
        // Test allowed roles
        if (test.allowedRoles.includes('Admin')) {
          const response = await request(app)
            .get(test.endpoint)
            .set('Authorization', `Bearer ${adminToken}`);
          expect(response.status).not.toBe(403);
        }

        if (test.allowedRoles.includes('Supervisor')) {
          const response = await request(app)
            .get(test.endpoint)
            .set('Authorization', `Bearer ${supervisorToken}`);
          expect(response.status).not.toBe(403);
        }

        // Test denied roles
        if (test.deniedRoles.includes('FieldTech')) {
          const response = await request(app)
            .get(test.endpoint)
            .set('Authorization', `Bearer ${fieldTechToken}`)
            .expect(403);
          expect(response.body.success).toBe(false);
        }

        if (test.deniedRoles.includes('Client')) {
          const response = await request(app)
            .get(test.endpoint)
            .set('Authorization', `Bearer ${clientToken}`)
            .expect(403);
          expect(response.body.success).toBe(false);
        }
      }
    });
  });

  describe('Session Management Security', () => {
    it('should invalidate session on logout', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass123!'
        })
        .expect(200);

      const token = loginResponse.body.data.token;

      // Verify token works
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Token should no longer work
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('should support multiple concurrent sessions', async () => {
      // Login from multiple "devices"
      const login1 = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass123!'
        })
        .expect(200);

      const login2 = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass123!'
        })
        .expect(200);

      const token1 = login1.body.data.token;
      const token2 = login2.body.data.token;

      // Both tokens should work
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);

      // Logout one session
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      // First token should be invalid, second should still work
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token1}`)
        .expect(401);

      await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token2}`)
        .expect(200);
    });

    it('should revoke all sessions on password change', async () => {
      // Login and get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'fieldtech',
          password: 'FieldPass123!'
        })
        .expect(200);

      const token = loginResponse.body.data.token;

      // Change password
      await request(app)
        .patch('/api/users/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'FieldPass123!',
          newPassword: 'NewFieldPass123!'
        })
        .expect(200);

      // Original token should no longer work
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });

  describe('Account Security Features', () => {
    it('should enforce unique usernames and emails', async () => {
      // Try to create user with existing username
      const usernameResponse = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Duplicate',
          lastName: 'Username',
          email: 'new@test.com',
          username: 'admin', // Already exists
          password: 'ValidPass123!',
          role: { name: 'FieldTech', level: 2, permissions: [] }
        })
        .expect(409);

      expect(usernameResponse.body.success).toBe(false);
      expect(usernameResponse.body.error).toContain('username');

      // Try to create user with existing email
      const emailResponse = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Duplicate',
          lastName: 'Email',
          email: 'admin@fieldsync.com', // Already exists
          username: 'newuser',
          password: 'ValidPass123!',
          role: { name: 'FieldTech', level: 2, permissions: [] }
        })
        .expect(409);

      expect(emailResponse.body.success).toBe(false);
      expect(emailResponse.body.error).toContain('email');
    });

    it('should hash passwords securely', async () => {
      // Verify password is hashed in database
      const user = await UserModel.findOne({ username: 'admin' });
      expect(user?.password).not.toBe('AdminPass123!');
      expect(user?.password.startsWith('$2b$')).toBe(true);
    });

    it('should validate password complexity on change', async () => {
      const token = generateToken({
        id: fieldTechUser._id.toString(),
        username: fieldTechUser.username,
        role: fieldTechUser.role
      });

      const weakPasswords = [
        '123456',
        'password',
        'qwerty',
        'abc123',
        'Password1', // Missing special character
        'password123!', // Missing uppercase
        'PASSWORD123!', // Missing lowercase
        'Password!', // Too short
      ];

      for (const weakPassword of weakPasswords) {
        const response = await request(app)
          .patch('/api/users/change-password')
          .set('Authorization', `Bearer ${token}`)
          .send({
            currentPassword: 'FieldPass123!',
            newPassword: weakPassword
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('password');
      }
    });
  });
});