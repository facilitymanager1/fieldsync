import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  UserRole,
  Permission,
  AccessContext,
  PermissionRule,
  ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  SecurityConfig,
  DEFAULT_SECURITY_CONFIG,
  ResourceType
} from '../types/permissions';

export interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
  conditions?: Record<string, any>;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  granted: boolean;
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

class PermissionService {
  private currentUser: User | null = null;
  private securityConfig: SecurityConfig = DEFAULT_SECURITY_CONFIG;
  private auditLogs: AuditLogEntry[] = [];

  constructor() {
    this.loadSecurityConfig();
  }

  /**
   * Initialize the permission service with current user
   */
  async initialize(user: User): Promise<void> {
    this.currentUser = user;
    await this.loadUserPermissions(user.id);
    await this.loadAuditLogs();
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(
    permission: Permission,
    context?: Partial<AccessContext>
  ): Promise<PermissionCheckResult> {
    if (!this.currentUser) {
      return { granted: false, reason: 'User not authenticated' };
    }

    const fullContext: AccessContext = {
      user: this.currentUser,
      action: permission,
      ...context
    };

    const result = await this.checkPermission(fullContext);
    
    // Log the permission check
    await this.logAccess(fullContext, result.granted, result.reason);
    
    return result;
  }

  /**
   * Check if user can access a specific resource
   */
  async canAccessResource(
    resourceType: ResourceType,
    resourceId: string,
    action: Permission,
    resourceData?: any
  ): Promise<PermissionCheckResult> {
    return this.hasPermission(action, {
      resource: {
        type: resourceType,
        id: resourceId,
        data: resourceData
      }
    });
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(permissions: Permission[]): Promise<PermissionCheckResult> {
    for (const permission of permissions) {
      const result = await this.hasPermission(permission);
      if (result.granted) {
        return result;
      }
    }
    
    return { 
      granted: false, 
      reason: `User lacks any of the required permissions: ${permissions.join(', ')}` 
    };
  }

  /**
   * Check if user has all specified permissions
   */
  async hasAllPermissions(permissions: Permission[]): Promise<PermissionCheckResult> {
    for (const permission of permissions) {
      const result = await this.hasPermission(permission);
      if (!result.granted) {
        return { 
          granted: false, 
          reason: `Missing required permission: ${permission}` 
        };
      }
    }
    
    return { granted: true };
  }

  /**
   * Get user's role level in hierarchy
   */
  getUserRoleLevel(role: UserRole): number {
    const hierarchy = ROLE_HIERARCHY.find(h => h.role === role);
    return hierarchy ? hierarchy.level : 0;
  }

  /**
   * Check if user role is higher than specified role
   */
  isHigherRole(userRole: UserRole, compareRole: UserRole): boolean {
    return this.getUserRoleLevel(userRole) > this.getUserRoleLevel(compareRole);
  }

  /**
   * Get all permissions for a user (including inherited)
   */
  getUserPermissions(user: User): Permission[] {
    const directPermissions = ROLE_PERMISSIONS[user.role] || [];
    const inheritedPermissions: Permission[] = [];

    // Get inherited permissions from role hierarchy
    const hierarchy = ROLE_HIERARCHY.find(h => h.role === user.role);
    if (hierarchy) {
      hierarchy.inheritsFrom.forEach(inheritedRole => {
        inheritedPermissions.push(...(ROLE_PERMISSIONS[inheritedRole] || []));
      });
    }

    // Combine and deduplicate
    const allPermissions = [...directPermissions, ...inheritedPermissions, ...user.permissions];
    return [...new Set(allPermissions)];
  }

  /**
   * Core permission checking logic
   */
  private async checkPermission(context: AccessContext): Promise<PermissionCheckResult> {
    const { user, action, resource } = context;

    // Get all user permissions
    const userPermissions = this.getUserPermissions(user);

    // Check if user has the required permission
    if (!userPermissions.includes(action)) {
      return { 
        granted: false, 
        reason: `User role ${user.role} does not have permission ${action}` 
      };
    }

    // Apply resource-specific checks
    if (resource) {
      const resourceCheck = await this.checkResourceAccess(context);
      if (!resourceCheck.granted) {
        return resourceCheck;
      }
    }

    // Apply conditional checks
    const conditionalCheck = await this.checkConditionalPermissions(context);
    if (!conditionalCheck.granted) {
      return conditionalCheck;
    }

    return { granted: true };
  }

  /**
   * Check resource-specific access permissions
   */
  private async checkResourceAccess(context: AccessContext): Promise<PermissionCheckResult> {
    const { user, resource, action } = context;
    
    if (!resource) return { granted: true };

    switch (resource.type) {
      case ResourceType.EMPLOYEE:
        return this.checkEmployeeAccess(user, resource, action);
      
      case ResourceType.SALARY:
        return this.checkSalaryAccess(user, resource, action);
      
      case ResourceType.DOCUMENT:
        return this.checkDocumentAccess(user, resource, action);
      
      case ResourceType.SITE:
        return this.checkSiteAccess(user, resource, action);
      
      default:
        return { granted: true };
    }
  }

  /**
   * Check employee-specific access
   */
  private checkEmployeeAccess(
    user: User,
    resource: any,
    action: Permission
  ): PermissionCheckResult {
    // Users can always access their own data
    if (resource.data?.userId === user.id || resource.id === user.id) {
      return { granted: true };
    }

    // Check site-based access
    if (user.sites.length > 0 && resource.data?.siteId) {
      if (!user.sites.includes(resource.data.siteId)) {
        return { 
          granted: false, 
          reason: 'User does not have access to employee\'s site' 
        };
      }
    }

    // Check department-based access
    if (user.departments.length > 0 && resource.data?.departmentId) {
      if (!user.departments.includes(resource.data.departmentId)) {
        return { 
          granted: false, 
          reason: 'User does not have access to employee\'s department' 
        };
      }
    }

    return { granted: true };
  }

  /**
   * Check salary-specific access
   */
  private checkSalaryAccess(
    user: User,
    resource: any,
    action: Permission
  ): PermissionCheckResult {
    // Only HR and above can edit salaries
    if (action === Permission.EDIT_SALARY || action === Permission.APPROVE_SALARY) {
      if (![UserRole.HR, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
        return { 
          granted: false, 
          reason: 'Insufficient role for salary modifications' 
        };
      }
    }

    // Check if salary requires approval based on amount
    if (resource.data?.netSalary > 100000 && action === Permission.EDIT_SALARY) {
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
        return { 
          granted: false, 
          reason: 'High salary modifications require admin approval' 
        };
      }
    }

    return { granted: true };
  }

  /**
   * Check document-specific access
   */
  private checkDocumentAccess(
    user: User,
    resource: any,
    action: Permission
  ): PermissionCheckResult {
    // Check document sensitivity
    const sensitiveDocuments = ['AADHAAR', 'PAN', 'BANK_PASSBOOK'];
    
    if (sensitiveDocuments.includes(resource.data?.documentType)) {
      if (action === Permission.VIEW_DOCUMENTS) {
        const requiredPermissions = [
          Permission.VIEW_FULL_AADHAAR,
          Permission.VIEW_FULL_PAN,
          Permission.VIEW_BANK_DETAILS
        ];
        
        const userPermissions = this.getUserPermissions(user);
        const hasRequiredPermission = requiredPermissions.some(p => 
          userPermissions.includes(p)
        );
        
        if (!hasRequiredPermission) {
          return { 
            granted: false, 
            reason: 'Insufficient permissions for sensitive document access' 
          };
        }
      }
    }

    return { granted: true };
  }

  /**
   * Check site-specific access
   */
  private checkSiteAccess(
    user: User,
    resource: any,
    action: Permission
  ): PermissionCheckResult {
    if (user.sites.length > 0 && !user.sites.includes(resource.id)) {
      return { 
        granted: false, 
        reason: 'User does not have access to this site' 
      };
    }

    return { granted: true };
  }

  /**
   * Check conditional permissions based on business rules
   */
  private async checkConditionalPermissions(context: AccessContext): Promise<PermissionCheckResult> {
    const { user, action, resource } = context;

    // Example: ESI form visibility based on salary
    if (action === Permission.VIEW_EMPLOYEE && resource?.data) {
      const netSalary = resource.data.netSalary;
      if (netSalary && netSalary < 18000) {
        // Hide ESI-related fields for low salary employees
        return { 
          granted: true, 
          conditions: { hideESIFields: true } 
        };
      }
    }

    // Time-based restrictions
    const currentHour = new Date().getHours();
    if (action === Permission.EDIT_SALARY && (currentHour < 9 || currentHour > 18)) {
      if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
        return { 
          granted: false, 
          reason: 'Salary modifications only allowed during business hours' 
        };
      }
    }

    return { granted: true };
  }

  /**
   * Mask sensitive data based on user permissions
   */
  maskSensitiveData(data: any, permission: Permission): any {
    if (!this.securityConfig.enableDataMasking || !this.currentUser) {
      return data;
    }

    const userPermissions = this.getUserPermissions(this.currentUser);
    const maskedData = { ...data };

    // Mask Aadhaar number
    if (maskedData.aadhaarNumber && !userPermissions.includes(Permission.VIEW_FULL_AADHAAR)) {
      maskedData.aadhaarNumber = this.maskString(maskedData.aadhaarNumber, 4, 4);
    }

    // Mask PAN number
    if (maskedData.panNumber && !userPermissions.includes(Permission.VIEW_FULL_PAN)) {
      maskedData.panNumber = this.maskString(maskedData.panNumber, 3, 1);
    }

    // Mask bank account
    if (maskedData.bankAccountNumber && !userPermissions.includes(Permission.VIEW_BANK_DETAILS)) {
      maskedData.bankAccountNumber = this.maskString(maskedData.bankAccountNumber, 0, 4);
    }

    // Mask phone numbers (partial)
    if (maskedData.phoneNumber && permission !== Permission.VIEW_PERSONAL_INFO) {
      maskedData.phoneNumber = this.maskString(maskedData.phoneNumber, 3, 3);
    }

    return maskedData;
  }

  /**
   * Mask string with asterisks
   */
  private maskString(str: string, visibleStart: number, visibleEnd: number): string {
    if (!str || str.length <= visibleStart + visibleEnd) {
      return str;
    }

    const start = str.substring(0, visibleStart);
    const end = str.substring(str.length - visibleEnd);
    const masked = '*'.repeat(str.length - visibleStart - visibleEnd);
    
    return start + masked + end;
  }

  /**
   * Log access attempts for audit
   */
  private async logAccess(
    context: AccessContext,
    granted: boolean,
    reason?: string
  ): Promise<void> {
    if (!this.securityConfig.enableAuditLogging) {
      return;
    }

    const logEntry: AuditLogEntry = {
      id: this.generateId(),
      userId: context.user.id,
      action: context.action,
      resource: context.resource?.type || 'SYSTEM',
      resourceId: context.resource?.id,
      granted,
      reason,
      metadata: context.metadata,
      timestamp: new Date()
    };

    this.auditLogs.push(logEntry);
    
    // Keep only last 1000 entries
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }

    await this.saveAuditLogs();
  }

  /**
   * Get audit logs for review
   */
  async getAuditLogs(
    filters?: {
      userId?: string;
      action?: Permission;
      startDate?: Date;
      endDate?: Date;
      granted?: boolean;
    }
  ): Promise<AuditLogEntry[]> {
    let logs = [...this.auditLogs];

    if (filters) {
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId);
      }
      if (filters.action) {
        logs = logs.filter(log => log.action === filters.action);
      }
      if (filters.startDate) {
        logs = logs.filter(log => log.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        logs = logs.filter(log => log.timestamp <= filters.endDate!);
      }
      if (filters.granted !== undefined) {
        logs = logs.filter(log => log.granted === filters.granted);
      }
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Validate password against policy
   */
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const { passwordPolicy } = this.securityConfig;
    const errors: string[] = [];

    if (password.length < passwordPolicy.minLength) {
      errors.push(`Password must be at least ${passwordPolicy.minLength} characters long`);
    }

    if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (passwordPolicy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (passwordPolicy.requireSpecialChars && !/[!@#$%^&*]/.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*)');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Load user permissions from storage
   */
  private async loadUserPermissions(userId: string): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(`permissions_${userId}`);
      if (stored && this.currentUser) {
        const permissions = JSON.parse(stored) as Permission[];
        this.currentUser.permissions = permissions;
      }
    } catch (error) {
      console.error('Error loading user permissions:', error);
    }
  }

  /**
   * Load security configuration
   */
  private async loadSecurityConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('security_config');
      if (stored) {
        this.securityConfig = { ...DEFAULT_SECURITY_CONFIG, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading security config:', error);
    }
  }

  /**
   * Load audit logs from storage
   */
  private async loadAuditLogs(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('audit_logs');
      if (stored) {
        this.auditLogs = JSON.parse(stored).map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    }
  }

  /**
   * Save audit logs to storage
   */
  private async saveAuditLogs(): Promise<void> {
    try {
      await AsyncStorage.setItem('audit_logs', JSON.stringify(this.auditLogs));
    } catch (error) {
      console.error('Error saving audit logs:', error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Clear all stored data (for logout)
   */
  async clearStoredData(): Promise<void> {
    this.currentUser = null;
    this.auditLogs = [];
    await AsyncStorage.multiRemove(['audit_logs', 'security_config']);
  }
}

export default new PermissionService();