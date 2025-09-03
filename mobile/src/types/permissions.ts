// Role-based Access Control Types and Interfaces

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  HR = 'HR',
  MANAGER = 'MANAGER',
  SUPERVISOR = 'SUPERVISOR',
  VERIFIER = 'VERIFIER',
  EMPLOYEE = 'EMPLOYEE',
  READONLY = 'READONLY'
}

export enum Permission {
  // Employee Management
  CREATE_EMPLOYEE = 'CREATE_EMPLOYEE',
  VIEW_EMPLOYEE = 'VIEW_EMPLOYEE',
  EDIT_EMPLOYEE = 'EDIT_EMPLOYEE',
  DELETE_EMPLOYEE = 'DELETE_EMPLOYEE',
  APPROVE_EMPLOYEE = 'APPROVE_EMPLOYEE',
  REJECT_EMPLOYEE = 'REJECT_EMPLOYEE',
  
  // Document Management
  UPLOAD_DOCUMENTS = 'UPLOAD_DOCUMENTS',
  VIEW_DOCUMENTS = 'VIEW_DOCUMENTS',
  VERIFY_DOCUMENTS = 'VERIFY_DOCUMENTS',
  DELETE_DOCUMENTS = 'DELETE_DOCUMENTS',
  
  // Salary & Compensation
  VIEW_SALARY = 'VIEW_SALARY',
  EDIT_SALARY = 'EDIT_SALARY',
  APPROVE_SALARY = 'APPROVE_SALARY',
  
  // Sensitive Data Access
  VIEW_FULL_AADHAAR = 'VIEW_FULL_AADHAAR',
  VIEW_FULL_PAN = 'VIEW_FULL_PAN',
  VIEW_BANK_DETAILS = 'VIEW_BANK_DETAILS',
  VIEW_PERSONAL_INFO = 'VIEW_PERSONAL_INFO',
  
  // Verification
  EMPLOYMENT_VERIFICATION = 'EMPLOYMENT_VERIFICATION',
  POLICE_VERIFICATION = 'POLICE_VERIFICATION',
  BACKGROUND_VERIFICATION = 'BACKGROUND_VERIFICATION',
  
  // Administrative
  MANAGE_SITES = 'MANAGE_SITES',
  MANAGE_DEPARTMENTS = 'MANAGE_DEPARTMENTS',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  EXPORT_DATA = 'EXPORT_DATA',
  
  // System
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  AUDIT_LOGS = 'AUDIT_LOGS'
}

export enum ResourceType {
  EMPLOYEE = 'EMPLOYEE',
  DOCUMENT = 'DOCUMENT',
  SALARY = 'SALARY',
  SITE = 'SITE',
  DEPARTMENT = 'DEPARTMENT',
  USER = 'USER'
}

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: Permission[];
  sites: string[]; // Site IDs user has access to
  departments: string[]; // Department IDs user manages
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionRule {
  role: UserRole;
  permissions: Permission[];
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'in' | 'not_in' | 'greater_than' | 'less_than';
  value: any;
}

export interface AccessContext {
  user: User;
  resource?: {
    type: ResourceType;
    id: string;
    data: any;
  };
  action: Permission;
  metadata?: Record<string, any>;
}

export interface RoleHierarchy {
  role: UserRole;
  inheritsFrom: UserRole[];
  level: number;
}

// Role hierarchy definition (higher level = more permissions)
export const ROLE_HIERARCHY: RoleHierarchy[] = [
  { role: UserRole.SUPER_ADMIN, inheritsFrom: [], level: 100 },
  { role: UserRole.ADMIN, inheritsFrom: [UserRole.HR, UserRole.MANAGER], level: 90 },
  { role: UserRole.HR, inheritsFrom: [UserRole.SUPERVISOR], level: 80 },
  { role: UserRole.MANAGER, inheritsFrom: [UserRole.SUPERVISOR], level: 70 },
  { role: UserRole.SUPERVISOR, inheritsFrom: [UserRole.VERIFIER], level: 60 },
  { role: UserRole.VERIFIER, inheritsFrom: [UserRole.EMPLOYEE], level: 50 },
  { role: UserRole.EMPLOYEE, inheritsFrom: [UserRole.READONLY], level: 40 },
  { role: UserRole.READONLY, inheritsFrom: [], level: 10 }
];

// Default permissions for each role
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    // All permissions
    ...Object.values(Permission)
  ],
  
  [UserRole.ADMIN]: [
    Permission.CREATE_EMPLOYEE,
    Permission.VIEW_EMPLOYEE,
    Permission.EDIT_EMPLOYEE,
    Permission.DELETE_EMPLOYEE,
    Permission.APPROVE_EMPLOYEE,
    Permission.REJECT_EMPLOYEE,
    Permission.UPLOAD_DOCUMENTS,
    Permission.VIEW_DOCUMENTS,
    Permission.VERIFY_DOCUMENTS,
    Permission.DELETE_DOCUMENTS,
    Permission.VIEW_SALARY,
    Permission.EDIT_SALARY,
    Permission.APPROVE_SALARY,
    Permission.VIEW_FULL_AADHAAR,
    Permission.VIEW_FULL_PAN,
    Permission.VIEW_BANK_DETAILS,
    Permission.VIEW_PERSONAL_INFO,
    Permission.EMPLOYMENT_VERIFICATION,
    Permission.POLICE_VERIFICATION,
    Permission.BACKGROUND_VERIFICATION,
    Permission.MANAGE_SITES,
    Permission.MANAGE_DEPARTMENTS,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA,
    Permission.USER_MANAGEMENT,
    Permission.AUDIT_LOGS
  ],
  
  [UserRole.HR]: [
    Permission.CREATE_EMPLOYEE,
    Permission.VIEW_EMPLOYEE,
    Permission.EDIT_EMPLOYEE,
    Permission.APPROVE_EMPLOYEE,
    Permission.REJECT_EMPLOYEE,
    Permission.UPLOAD_DOCUMENTS,
    Permission.VIEW_DOCUMENTS,
    Permission.VERIFY_DOCUMENTS,
    Permission.VIEW_SALARY,
    Permission.EDIT_SALARY,
    Permission.APPROVE_SALARY,
    Permission.VIEW_FULL_AADHAAR,
    Permission.VIEW_FULL_PAN,
    Permission.VIEW_BANK_DETAILS,
    Permission.VIEW_PERSONAL_INFO,
    Permission.EMPLOYMENT_VERIFICATION,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_DATA
  ],
  
  [UserRole.MANAGER]: [
    Permission.CREATE_EMPLOYEE,
    Permission.VIEW_EMPLOYEE,
    Permission.EDIT_EMPLOYEE,
    Permission.APPROVE_EMPLOYEE,
    Permission.UPLOAD_DOCUMENTS,
    Permission.VIEW_DOCUMENTS,
    Permission.VIEW_SALARY,
    Permission.EDIT_SALARY,
    Permission.VIEW_PERSONAL_INFO,
    Permission.EMPLOYMENT_VERIFICATION,
    Permission.VIEW_ANALYTICS
  ],
  
  [UserRole.SUPERVISOR]: [
    Permission.VIEW_EMPLOYEE,
    Permission.EDIT_EMPLOYEE,
    Permission.UPLOAD_DOCUMENTS,
    Permission.VIEW_DOCUMENTS,
    Permission.VIEW_SALARY,
    Permission.VIEW_PERSONAL_INFO,
    Permission.EMPLOYMENT_VERIFICATION
  ],
  
  [UserRole.VERIFIER]: [
    Permission.VIEW_EMPLOYEE,
    Permission.VIEW_DOCUMENTS,
    Permission.VERIFY_DOCUMENTS,
    Permission.EMPLOYMENT_VERIFICATION,
    Permission.POLICE_VERIFICATION,
    Permission.BACKGROUND_VERIFICATION
  ],
  
  [UserRole.EMPLOYEE]: [
    Permission.VIEW_EMPLOYEE, // Own data only
    Permission.UPLOAD_DOCUMENTS, // Own documents only
    Permission.VIEW_DOCUMENTS // Own documents only
  ],
  
  [UserRole.READONLY]: [
    Permission.VIEW_EMPLOYEE // Limited view only
  ]
};

export interface SecurityConfig {
  enableFieldLevelSecurity: boolean;
  enableAuditLogging: boolean;
  enableDataMasking: boolean;
  sessionTimeout: number; // in minutes
  maxFailedAttempts: number;
  lockoutDuration: number; // in minutes
  requireMFA: boolean;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number; // in days
  };
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  enableFieldLevelSecurity: true,
  enableAuditLogging: true,
  enableDataMasking: true,
  sessionTimeout: 30,
  maxFailedAttempts: 5,
  lockoutDuration: 15,
  requireMFA: false,
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90
  }
};