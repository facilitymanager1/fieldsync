import PermissionService from '../../src/services/permissionService';
import {
  User,
  UserRole,
  Permission,
  ResourceType,
  ValidationSeverity,
} from '../../src/types/permissions';
import { TestUtils } from '../setup';

describe('PermissionService', () => {
  let mockUser: User;
  let mockAdmin: User;
  let mockEmployee: User;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup test users
    mockUser = {
      id: 'user123',
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.HR,
      permissions: [],
      sites: ['site1', 'site2'],
      departments: ['dept1'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockAdmin = {
      ...mockUser,
      id: 'admin123',
      role: UserRole.ADMIN,
      sites: ['site1', 'site2', 'site3'],
      departments: ['dept1', 'dept2'],
    };

    mockEmployee = {
      ...mockUser,
      id: 'emp123',
      role: UserRole.EMPLOYEE,
      sites: ['site1'],
      departments: [],
    };

    await PermissionService.initialize(mockUser);
  });

  afterEach(async () => {
    await PermissionService.clearStoredData();
  });

  describe('Initialization', () => {
    it('should initialize with user successfully', async () => {
      await PermissionService.initialize(mockUser);
      const currentUser = PermissionService.getCurrentUser();
      
      expect(currentUser).toEqual(mockUser);
    });

    it('should clear stored data on logout', async () => {
      await PermissionService.clearStoredData();
      const currentUser = PermissionService.getCurrentUser();
      
      expect(currentUser).toBeNull();
    });
  });

  describe('Basic Permission Checks', () => {
    it('should grant permission for user with required role', async () => {
      await PermissionService.initialize(mockUser); // HR role
      
      const result = await PermissionService.hasPermission(Permission.VIEW_EMPLOYEE);
      
      expect(result.granted).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny permission for user without required role', async () => {
      await PermissionService.initialize(mockEmployee); // Employee role
      
      const result = await PermissionService.hasPermission(Permission.EDIT_SALARY);
      
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('does not have permission');
    });

    it('should handle unauthenticated user', async () => {
      await PermissionService.clearStoredData();
      
      const result = await PermissionService.hasPermission(Permission.VIEW_EMPLOYEE);
      
      expect(result.granted).toBe(false);
      expect(result.reason).toBe('User not authenticated');
    });
  });

  describe('Role Hierarchy', () => {
    it('should respect role hierarchy levels', () => {
      const adminLevel = PermissionService.getUserRoleLevel(UserRole.ADMIN);
      const hrLevel = PermissionService.getUserRoleLevel(UserRole.HR);
      const employeeLevel = PermissionService.getUserRoleLevel(UserRole.EMPLOYEE);
      
      expect(adminLevel).toBeGreaterThan(hrLevel);
      expect(hrLevel).toBeGreaterThan(employeeLevel);
    });

    it('should check if role is higher than another', () => {
      expect(PermissionService.isHigherRole(UserRole.ADMIN, UserRole.HR)).toBe(true);
      expect(PermissionService.isHigherRole(UserRole.HR, UserRole.EMPLOYEE)).toBe(true);
      expect(PermissionService.isHigherRole(UserRole.EMPLOYEE, UserRole.ADMIN)).toBe(false);
    });

    it('should inherit permissions from lower roles', () => {
      const adminPermissions = PermissionService.getUserPermissions(mockAdmin);
      const hrPermissions = PermissionService.getUserPermissions(mockUser);
      
      // Admin should have all HR permissions plus more
      const hrSpecificPermissions = hrPermissions.filter(p => 
        [Permission.VIEW_EMPLOYEE, Permission.EDIT_EMPLOYEE].includes(p)
      );
      
      hrSpecificPermissions.forEach(permission => {
        expect(adminPermissions).toContain(permission);
      });
    });
  });

  describe('Multiple Permission Checks', () => {
    it('should check if user has any of specified permissions', async () => {
      await PermissionService.initialize(mockUser); // HR role
      
      const result = await PermissionService.hasAnyPermission([
        Permission.EDIT_SALARY, // HR has this
        Permission.DELETE_EMPLOYEE, // HR doesn't have this
      ]);
      
      expect(result.granted).toBe(true);
    });

    it('should check if user has all specified permissions', async () => {
      await PermissionService.initialize(mockUser); // HR role
      
      const result = await PermissionService.hasAllPermissions([
        Permission.VIEW_EMPLOYEE, // HR has this
        Permission.EDIT_EMPLOYEE, // HR has this
        Permission.DELETE_EMPLOYEE, // HR doesn't have this
      ]);
      
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('Missing required permission');
    });

    it('should pass when user has all required permissions', async () => {
      await PermissionService.initialize(mockAdmin); // Admin role
      
      const result = await PermissionService.hasAllPermissions([
        Permission.VIEW_EMPLOYEE,
        Permission.EDIT_EMPLOYEE,
        Permission.DELETE_EMPLOYEE,
      ]);
      
      expect(result.granted).toBe(true);
    });
  });

  describe('Resource-specific Access Control', () => {
    it('should allow access to own employee data', async () => {
      await PermissionService.initialize(mockEmployee);
      
      const result = await PermissionService.canAccessResource(
        ResourceType.EMPLOYEE,
        mockEmployee.id,
        Permission.VIEW_EMPLOYEE,
        { userId: mockEmployee.id }
      );
      
      expect(result.granted).toBe(true);
    });

    it('should check site-based access', async () => {
      await PermissionService.initialize(mockUser); // Has access to site1, site2
      
      const allowedResult = await PermissionService.canAccessResource(
        ResourceType.EMPLOYEE,
        'emp456',
        Permission.VIEW_EMPLOYEE,
        { siteId: 'site1' }
      );
      
      const deniedResult = await PermissionService.canAccessResource(
        ResourceType.EMPLOYEE,
        'emp789',
        Permission.VIEW_EMPLOYEE,
        { siteId: 'site3' }
      );
      
      expect(allowedResult.granted).toBe(true);
      expect(deniedResult.granted).toBe(false);
      expect(deniedResult.reason).toContain('does not have access to employee\'s site');
    });

    it('should check department-based access', async () => {
      await PermissionService.initialize(mockUser); // Has access to dept1
      
      const allowedResult = await PermissionService.canAccessResource(
        ResourceType.EMPLOYEE,
        'emp456',
        Permission.VIEW_EMPLOYEE,
        { departmentId: 'dept1' }
      );
      
      const deniedResult = await PermissionService.canAccessResource(
        ResourceType.EMPLOYEE,
        'emp789',
        Permission.VIEW_EMPLOYEE,
        { departmentId: 'dept2' }
      );
      
      expect(allowedResult.granted).toBe(true);
      expect(deniedResult.granted).toBe(false);
      expect(deniedResult.reason).toContain('does not have access to employee\'s department');
    });
  });

  describe('Salary-specific Access Control', () => {
    it('should allow HR to edit regular salaries', async () => {
      await PermissionService.initialize(mockUser); // HR role
      
      const result = await PermissionService.canAccessResource(
        ResourceType.SALARY,
        'salary123',
        Permission.EDIT_SALARY,
        { netSalary: 50000 }
      );
      
      expect(result.granted).toBe(true);
    });

    it('should restrict high salary modifications to admin only', async () => {
      await PermissionService.initialize(mockUser); // HR role
      
      const result = await PermissionService.canAccessResource(
        ResourceType.SALARY,
        'salary123',
        Permission.EDIT_SALARY,
        { netSalary: 150000 } // High salary
      );
      
      expect(result.granted).toBe(false);
      expect(result.reason).toContain('High salary modifications require admin approval');
    });

    it('should allow admin to edit high salaries', async () => {
      await PermissionService.initialize(mockAdmin); // Admin role
      
      const result = await PermissionService.canAccessResource(
        ResourceType.SALARY,
        'salary123',
        Permission.EDIT_SALARY,
        { netSalary: 150000 }
      );
      
      expect(result.granted).toBe(true);
    });
  });

  describe('Document Access Control', () => {
    it('should allow viewing non-sensitive documents', async () => {
      await PermissionService.initialize(mockUser);
      
      const result = await PermissionService.canAccessResource(
        ResourceType.DOCUMENT,
        'doc123',
        Permission.VIEW_DOCUMENTS,
        { documentType: 'RESUME' }
      );
      
      expect(result.granted).toBe(true);
    });

    it('should restrict sensitive document access', async () => {
      await PermissionService.initialize(mockEmployee); // Employee role
      
      const aadhaarResult = await PermissionService.canAccessResource(
        ResourceType.DOCUMENT,
        'doc123',
        Permission.VIEW_DOCUMENTS,
        { documentType: 'AADHAAR' }
      );
      
      expect(aadhaarResult.granted).toBe(false);
      expect(aadhaarResult.reason).toContain('Insufficient permissions for sensitive document access');
    });

    it('should allow HR to view sensitive documents', async () => {
      await PermissionService.initialize(mockUser); // HR role
      
      const result = await PermissionService.canAccessResource(
        ResourceType.DOCUMENT,
        'doc123',
        Permission.VIEW_DOCUMENTS,
        { documentType: 'AADHAAR' }
      );
      
      expect(result.granted).toBe(true);
    });
  });

  describe('Data Masking', () => {
    beforeEach(() => {
      // Enable data masking for tests
      PermissionService.setConfig({ enableDataMasking: true });
    });

    it('should mask Aadhaar for users without full access', async () => {
      await PermissionService.initialize(mockEmployee);
      
      const data = { aadhaarNumber: '123456789012' };
      const maskedData = PermissionService.maskSensitiveData(data, Permission.VIEW_EMPLOYEE);
      
      expect(maskedData.aadhaarNumber).toBe('1234****9012');
    });

    it('should not mask Aadhaar for users with full access', async () => {
      await PermissionService.initialize(mockUser); // HR has VIEW_FULL_AADHAAR
      
      const data = { aadhaarNumber: '123456789012' };
      const maskedData = PermissionService.maskSensitiveData(data, Permission.VIEW_EMPLOYEE);
      
      expect(maskedData.aadhaarNumber).toBe('123456789012');
    });

    it('should mask PAN numbers appropriately', async () => {
      await PermissionService.initialize(mockEmployee);
      
      const data = { panNumber: 'ABCDE1234F' };
      const maskedData = PermissionService.maskSensitiveData(data, Permission.VIEW_EMPLOYEE);
      
      expect(maskedData.panNumber).toBe('ABC***4F');
    });

    it('should mask bank account numbers', async () => {
      await PermissionService.initialize(mockEmployee);
      
      const data = { bankAccountNumber: '1234567890123456' };
      const maskedData = PermissionService.maskSensitiveData(data, Permission.VIEW_EMPLOYEE);
      
      expect(maskedData.bankAccountNumber).toBe('****123456');
    });

    it('should partially mask phone numbers', async () => {
      await PermissionService.initialize(mockEmployee);
      
      const data = { phoneNumber: '9876543210' };
      const maskedData = PermissionService.maskSensitiveData(data, Permission.VIEW_EMPLOYEE);
      
      expect(maskedData.phoneNumber).toBe('987***3210');
    });
  });

  describe('Audit Logging', () => {
    beforeEach(() => {
      PermissionService.setConfig({ enableAuditLogging: true });
    });

    it('should log successful permission checks', async () => {
      await PermissionService.initialize(mockUser);
      
      await PermissionService.hasPermission(Permission.VIEW_EMPLOYEE);
      
      const logs = await PermissionService.getAuditLogs();
      expect(logs.length).toBeGreaterThan(0);
      
      const lastLog = logs[0];
      expect(lastLog.userId).toBe(mockUser.id);
      expect(lastLog.action).toBe(Permission.VIEW_EMPLOYEE);
      expect(lastLog.granted).toBe(true);
    });

    it('should log failed permission checks', async () => {
      await PermissionService.initialize(mockEmployee);
      
      await PermissionService.hasPermission(Permission.DELETE_EMPLOYEE);
      
      const logs = await PermissionService.getAuditLogs();
      const lastLog = logs[0];
      
      expect(lastLog.granted).toBe(false);
      expect(lastLog.reason).toBeDefined();
    });

    it('should filter audit logs by criteria', async () => {
      await PermissionService.initialize(mockUser);
      
      // Generate some logs
      await PermissionService.hasPermission(Permission.VIEW_EMPLOYEE);
      await PermissionService.hasPermission(Permission.EDIT_EMPLOYEE);
      
      const filteredLogs = await PermissionService.getAuditLogs({
        userId: mockUser.id,
        action: Permission.VIEW_EMPLOYEE,
        granted: true,
      });
      
      expect(filteredLogs.length).toBeGreaterThan(0);
      filteredLogs.forEach(log => {
        expect(log.userId).toBe(mockUser.id);
        expect(log.action).toBe(Permission.VIEW_EMPLOYEE);
        expect(log.granted).toBe(true);
      });
    });

    it('should limit audit log entries', async () => {
      await PermissionService.initialize(mockUser);
      
      // Generate many logs (more than the limit)
      for (let i = 0; i < 1100; i++) {
        await PermissionService.hasPermission(Permission.VIEW_EMPLOYEE);
      }
      
      const logs = await PermissionService.getAuditLogs();
      expect(logs.length).toBeLessThanOrEqual(1000); // Should be limited to 1000
    });
  });

  describe('Password Validation', () => {
    it('should validate strong passwords', () => {
      const strongPassword = 'StrongPass123!';
      const result = PermissionService.validatePassword(strongPassword);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        '123', // too short
        'password', // no uppercase, numbers, or special chars
        'PASSWORD', // no lowercase, numbers, or special chars
        'Password', // no numbers or special chars
        'Password123', // no special chars
      ];

      weakPasswords.forEach(password => {
        const result = PermissionService.validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should provide specific error messages', () => {
      const result = PermissionService.validatePassword('abc');
      
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.errors).toContain('Password must contain at least one special character (!@#$%^&*)');
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration settings', () => {
      const newConfig = {
        enableDataMasking: false,
        enableAuditLogging: false,
        sessionTimeout: 60,
      };
      
      PermissionService.setConfig(newConfig);
      
      const stats = PermissionService.getValidationStats();
      expect(stats.config.enableDataMasking).toBe(false);
      expect(stats.config.enableAuditLogging).toBe(false);
      expect(stats.config.sessionTimeout).toBe(60);
    });

    it('should merge configuration with defaults', () => {
      const partialConfig = { sessionTimeout: 120 };
      
      PermissionService.setConfig(partialConfig);
      
      const stats = PermissionService.getValidationStats();
      expect(stats.config.sessionTimeout).toBe(120);
      expect(stats.config.enableDataMasking).toBe(true); // Should keep default
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user roles gracefully', async () => {
      const invalidUser = { ...mockUser, role: 'INVALID_ROLE' as UserRole };
      
      await PermissionService.initialize(invalidUser);
      const result = await PermissionService.hasPermission(Permission.VIEW_EMPLOYEE);
      
      // Should handle gracefully and deny permission
      expect(result.granted).toBe(false);
    });

    it('should handle storage errors gracefully', async () => {
      // Mock storage failure
      const originalStorage = require('@react-native-async-storage/async-storage');
      originalStorage.getItem = jest.fn().mockRejectedValue(new Error('Storage error'));
      
      // Should not throw error
      await expect(PermissionService.initialize(mockUser)).resolves.not.toThrow();
      
      // Restore mock
      jest.clearAllMocks();
    });
  });

  describe('Performance', () => {
    it('should handle multiple concurrent permission checks', async () => {
      await PermissionService.initialize(mockUser);
      
      const permissions = [
        Permission.VIEW_EMPLOYEE,
        Permission.EDIT_EMPLOYEE,
        Permission.VIEW_DOCUMENTS,
        Permission.UPLOAD_DOCUMENTS,
        Permission.VIEW_SALARY,
      ];

      const results = await Promise.all(
        permissions.map(permission => PermissionService.hasPermission(permission))
      );

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('granted');
      });
    });

    it('should maintain performance with large audit logs', async () => {
      PermissionService.setConfig({ enableAuditLogging: true });
      await PermissionService.initialize(mockUser);
      
      const start = Date.now();
      
      // Generate many permission checks
      for (let i = 0; i < 100; i++) {
        await PermissionService.hasPermission(Permission.VIEW_EMPLOYEE);
      }
      
      const duration = Date.now() - start;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
    });
  });
});