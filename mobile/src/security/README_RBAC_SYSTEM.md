# Role-Based Access Control (RBAC) System

## Overview

The RBAC system provides comprehensive role-based permissions and access control for the FieldSync mobile onboarding application. It ensures secure access to features and data based on user roles and permissions.

## Architecture

### Core Components

1. **Types & Interfaces** (`types/permissions.ts`)
   - User roles, permissions, and security configurations
   - Role hierarchy definitions
   - Permission rules and conditions

2. **Permission Service** (`services/permissionService.ts`)
   - Core permission checking logic
   - Data masking and security controls
   - Audit logging functionality

3. **Authentication Context** (`context/AuthContext.tsx`)
   - User authentication state management
   - Session handling and token management
   - Permission wrapper methods

4. **Permission Components** (`components/PermissionGate.tsx`)
   - Declarative permission checking
   - Conditional rendering based on access
   - Higher-order components for protection

## User Roles & Hierarchy

### Role Definitions (by level - higher = more permissions)

```typescript
SUPER_ADMIN (100)  // Full system access
    ↓
ADMIN (90)         // Administrative functions
    ↓
HR (80)           // Human resources operations
    ↓
MANAGER (70)      // Department management
    ↓
SUPERVISOR (60)   // Team supervision
    ↓
VERIFIER (50)     // Document verification
    ↓
EMPLOYEE (40)     // Basic employee access
    ↓
READONLY (10)     // View-only access
```

### Role Inheritance
- Higher roles inherit permissions from lower roles
- ADMIN inherits from both HR and MANAGER
- Flexible hierarchy supports organizational structures

## Permission System

### Permission Categories

1. **Employee Management**
   - `CREATE_EMPLOYEE` - Create new employee records
   - `VIEW_EMPLOYEE` - View employee information
   - `EDIT_EMPLOYEE` - Modify employee data
   - `DELETE_EMPLOYEE` - Remove employee records
   - `APPROVE_EMPLOYEE` - Approve employee onboarding
   - `REJECT_EMPLOYEE` - Reject employee applications

2. **Document Management**
   - `UPLOAD_DOCUMENTS` - Upload employee documents
   - `VIEW_DOCUMENTS` - View uploaded documents
   - `VERIFY_DOCUMENTS` - Verify document authenticity
   - `DELETE_DOCUMENTS` - Remove documents

3. **Sensitive Data Access**
   - `VIEW_FULL_AADHAAR` - View complete Aadhaar numbers
   - `VIEW_FULL_PAN` - View complete PAN numbers
   - `VIEW_BANK_DETAILS` - Access banking information
   - `VIEW_PERSONAL_INFO` - View personal details

4. **Salary & Compensation**
   - `VIEW_SALARY` - View salary information
   - `EDIT_SALARY` - Modify compensation details
   - `APPROVE_SALARY` - Approve salary changes

5. **Verification Functions**
   - `EMPLOYMENT_VERIFICATION` - Verify employment history
   - `POLICE_VERIFICATION` - Conduct police verification
   - `BACKGROUND_VERIFICATION` - Background checks

6. **Administrative Functions**
   - `MANAGE_SITES` - Manage company sites
   - `MANAGE_DEPARTMENTS` - Department administration
   - `VIEW_ANALYTICS` - Access analytics dashboard
   - `EXPORT_DATA` - Export system data
   - `USER_MANAGEMENT` - Manage user accounts
   - `AUDIT_LOGS` - Access audit trails

## Security Features

### Data Masking
```typescript
// Automatic data masking based on permissions
maskSensitiveData(data, permission)

// Examples:
Aadhaar: 1234-****-5678  (VIEW_FULL_AADHAAR required for full view)
PAN: ABC***9Z  (VIEW_FULL_PAN required for full view)
Bank: ****1234  (VIEW_BANK_DETAILS required for full view)
```

### Field-Level Security
- Conditional field visibility based on permissions
- ESI fields hidden when salary < ₹18,000
- Admin-only fields for salary modifications
- Role-based form section access

### Audit Logging
```typescript
interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  granted: boolean;
  reason?: string;
  timestamp: Date;
}
```

### Session Management
- Automatic session timeout (30 minutes default)
- Token refresh capabilities
- Account lockout after failed attempts
- Session validation on sensitive operations

## Usage Examples

### Basic Permission Checking

```typescript
import { useAuth } from '../context/AuthContext';
import { Permission } from '../types/permissions';

const { hasPermission } = useAuth();

// Check single permission
const canEdit = await hasPermission(Permission.EDIT_EMPLOYEE);
if (canEdit.granted) {
  // Allow editing
}

// Check multiple permissions (ANY)
const canManage = await hasAnyPermission([
  Permission.EDIT_EMPLOYEE,
  Permission.APPROVE_EMPLOYEE
]);

// Check multiple permissions (ALL)
const canFullyManage = await hasAllPermissions([
  Permission.VIEW_EMPLOYEE,
  Permission.EDIT_EMPLOYEE,
  Permission.APPROVE_EMPLOYEE
]);
```

### Resource-Specific Access

```typescript
// Check access to specific employee record
const canViewEmployee = await canAccessResource(
  ResourceType.EMPLOYEE,
  'employee_123',
  Permission.VIEW_EMPLOYEE,
  { siteId: 'site_1', departmentId: 'dept_1' }
);
```

### Declarative Permission Gates

```typescript
import PermissionGate from '../components/PermissionGate';

// Single permission gate
<PermissionGate permission={Permission.EDIT_SALARY}>
  <SalaryEditForm />
</PermissionGate>

// Multiple permissions (requires ANY)
<PermissionGate 
  permissions={[Permission.HR, Permission.ADMIN]}
  requireAll={false}
>
  <HRDashboard />
</PermissionGate>

// Resource-specific gate
<PermissionGate
  permission={Permission.VIEW_DOCUMENTS}
  resource={{
    type: ResourceType.DOCUMENT,
    id: documentId,
    data: { documentType: 'AADHAAR' }
  }}
>
  <DocumentViewer />
</PermissionGate>
```

### Permission Hooks

```typescript
import { usePermissionCheck } from '../components/PermissionGate';

const MyComponent = () => {
  const { hasAccess, isLoading } = usePermissionCheck(
    Permission.VIEW_SALARY
  );

  if (isLoading) return <LoadingSpinner />;
  
  return hasAccess ? <SalaryDetails /> : <AccessDenied />;
};
```

### Higher-Order Components

```typescript
import { withPermission } from '../components/PermissionGate';

const ProtectedSalaryForm = withPermission(
  SalaryForm,
  Permission.EDIT_SALARY,
  UnauthorizedComponent
);
```

## Business Rules Implementation

### Conditional Permissions

```typescript
// ESI form visibility based on salary
if (netSalary < 18000) {
  // Hide ESI fields
  return { granted: true, conditions: { hideESIFields: true } };
}

// Time-based restrictions
const currentHour = new Date().getHours();
if (action === Permission.EDIT_SALARY && (currentHour < 9 || currentHour > 18)) {
  if (![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(user.role)) {
    return { granted: false, reason: 'Salary modifications only allowed during business hours' };
  }
}
```

### Site & Department Access Control

```typescript
// Users can only access employees in their assigned sites/departments
const checkEmployeeAccess = (user, employee) => {
  if (user.sites.length > 0 && !user.sites.includes(employee.siteId)) {
    return { granted: false, reason: 'User does not have access to employee\'s site' };
  }
  
  if (user.departments.length > 0 && !user.departments.includes(employee.departmentId)) {
    return { granted: false, reason: 'User does not have access to employee\'s department' };
  }
  
  return { granted: true };
};
```

## Configuration

### Security Configuration

```typescript
interface SecurityConfig {
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
```

### Default Configuration

```typescript
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
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
```

## Integration with Onboarding Screens

### Protected Screen Navigation

```typescript
const onboardingSteps = [
  {
    id: 'basic_details',
    title: 'Basic Details',
    requiredPermissions: [Permission.CREATE_EMPLOYEE, Permission.VIEW_EMPLOYEE],
    component: BasicDetailsScreen,
  },
  {
    id: 'salary_details',
    title: 'Salary Information',
    requiredPermissions: [Permission.VIEW_SALARY, Permission.EDIT_SALARY],
    component: SalaryDetailsScreen,
  },
  // ... more steps
];

// Render with permission gates
{onboardingSteps.map(step => (
  <PermissionGate
    key={step.id}
    permissions={step.requiredPermissions}
    requireAll={false}
  >
    <NavigationButton step={step} />
  </PermissionGate>
))}
```

### Dynamic Form Fields

```typescript
const renderSalaryFields = () => (
  <PermissionGate permission={Permission.EDIT_SALARY}>
    <SalaryInputField />
  </PermissionGate>
);

const renderSensitiveFields = () => (
  <PermissionGate permission={Permission.VIEW_FULL_AADHAAR}>
    <AadhaarDisplayField />
  </PermissionGate>
);
```

## Testing

### Unit Tests

```typescript
describe('PermissionService', () => {
  test('should grant access for valid permission', async () => {
    const user = { role: UserRole.HR, permissions: [] };
    await PermissionService.initialize(user);
    
    const result = await PermissionService.hasPermission(Permission.VIEW_EMPLOYEE);
    expect(result.granted).toBe(true);
  });

  test('should deny access for insufficient permission', async () => {
    const user = { role: UserRole.READONLY, permissions: [] };
    await PermissionService.initialize(user);
    
    const result = await PermissionService.hasPermission(Permission.EDIT_SALARY);
    expect(result.granted).toBe(false);
  });
});
```

### Integration Tests

```typescript
describe('PermissionGate Component', () => {
  test('should render children when permission granted', () => {
    const { getByText } = render(
      <PermissionGate permission={Permission.VIEW_EMPLOYEE}>
        <Text>Protected Content</Text>
      </PermissionGate>
    );
    
    expect(getByText('Protected Content')).toBeTruthy();
  });

  test('should render fallback when permission denied', () => {
    const { getByText } = render(
      <PermissionGate
        permission={Permission.ADMIN_ONLY}
        fallback={<Text>Access Denied</Text>}
      >
        <Text>Protected Content</Text>
      </PermissionGate>
    );
    
    expect(getByText('Access Denied')).toBeTruthy();
  });
});
```

## Best Practices

### 1. Principle of Least Privilege
- Grant minimum necessary permissions
- Regular permission audits
- Role-based assignment

### 2. Defense in Depth
- Multiple layers of security
- Client and server-side validation
- Audit logging for accountability

### 3. Fail-Safe Defaults
- Default to deny access
- Explicit permission grants
- Clear error messages

### 4. Separation of Concerns
- Permission logic separate from UI
- Centralized permission management
- Consistent enforcement

## Monitoring & Maintenance

### Audit Reports
```typescript
// Generate permission audit report
const auditReport = await PermissionService.getAuditLogs({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  action: Permission.VIEW_SALARY
});
```

### Performance Monitoring
- Track permission check performance
- Monitor session creation/destruction
- Log security events

### Regular Reviews
- Quarterly permission audits
- Role definition reviews
- Security configuration updates
- User access reviews

## Troubleshooting

### Common Issues

1. **Permission Denied Unexpectedly**
   - Check user role assignments
   - Verify permission inheritance
   - Review conditional logic

2. **Data Not Masked Properly**
   - Confirm data masking is enabled
   - Check permission levels
   - Verify mask implementation

3. **Session Timeouts**
   - Review session configuration
   - Check token refresh logic
   - Monitor network connectivity

### Debug Mode

```typescript
// Enable debug logging
const DEBUG_PERMISSIONS = __DEV__;

if (DEBUG_PERMISSIONS) {
  console.log('Permission check:', {
    user: user.role,
    permission,
    result: result.granted,
    reason: result.reason
  });
}
```

## Future Enhancements

1. **Multi-Factor Authentication**
   - SMS/Email OTP
   - Biometric authentication
   - Hardware tokens

2. **Advanced Analytics**
   - Permission usage statistics
   - Security violation reports
   - User behavior analysis

3. **Dynamic Permissions**
   - Context-based permissions
   - Temporary elevated access
   - Workflow-based grants

4. **Integration Improvements**
   - Single Sign-On (SSO)
   - LDAP/Active Directory
   - OAuth 2.0 providers

This RBAC system provides a robust foundation for secure mobile onboarding with fine-grained access control and comprehensive audit capabilities.