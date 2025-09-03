import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../../../context/AuthContext';
import PermissionGate, { usePermissionCheck } from '../../../components/PermissionGate';
import { Permission, UserRole, ResourceType } from '../../../types/permissions';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  requiredPermissions: Permission[];
  component: React.ComponentType<any>;
  icon: string;
  color: string;
}

interface EmployeeData {
  id: string;
  name: string;
  role: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  siteId: string;
  departmentId: string;
}

const RoleBasedOnboardingScreen: React.FC = () => {
  const { user, getUserRole, hasPermission } = useAuth();
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [auditMode, setAuditMode] = useState(false);

  const userRole = getUserRole();

  // Permission checks for different features
  const { hasAccess: canCreateEmployee } = usePermissionCheck(Permission.CREATE_EMPLOYEE);
  const { hasAccess: canViewSalary } = usePermissionCheck(Permission.VIEW_SALARY);
  const { hasAccess: canEditSalary } = usePermissionCheck(Permission.EDIT_SALARY);
  const { hasAccess: canViewFullAadhaar } = usePermissionCheck(Permission.VIEW_FULL_AADHAAR);
  const { hasAccess: canViewAnalytics } = usePermissionCheck(Permission.VIEW_ANALYTICS);

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'basic_details',
      title: 'Basic Details',
      description: 'Personal information and contact details',
      requiredPermissions: [Permission.CREATE_EMPLOYEE, Permission.VIEW_EMPLOYEE],
      component: BasicDetailsComponent,
      icon: 'person',
      color: '#4CAF50',
    },
    {
      id: 'documents',
      title: 'Document Verification',
      description: 'Upload and verify identity documents',
      requiredPermissions: [Permission.UPLOAD_DOCUMENTS, Permission.VIEW_DOCUMENTS],
      component: DocumentsComponent,
      icon: 'description',
      color: '#2196F3',
    },
    {
      id: 'salary',
      title: 'Salary Details',
      description: 'Compensation and benefits information',
      requiredPermissions: [Permission.VIEW_SALARY, Permission.EDIT_SALARY],
      component: SalaryComponent,
      icon: 'monetization-on',
      color: '#FF9800',
    },
    {
      id: 'verification',
      title: 'Background Verification',
      description: 'Employment and police verification',
      requiredPermissions: [Permission.EMPLOYMENT_VERIFICATION, Permission.POLICE_VERIFICATION],
      component: VerificationComponent,
      icon: 'verified',
      color: '#9C27B0',
    },
    {
      id: 'approval',
      title: 'Final Approval',
      description: 'Review and approve employee onboarding',
      requiredPermissions: [Permission.APPROVE_EMPLOYEE],
      component: ApprovalComponent,
      icon: 'check-circle',
      color: '#4CAF50',
    },
  ];

  const mockEmployee: EmployeeData = {
    id: 'emp_001',
    name: 'John Doe',
    role: 'Software Engineer',
    status: 'pending',
    siteId: 'site_1',
    departmentId: 'dept_1',
  };

  useEffect(() => {
    setSelectedEmployee(mockEmployee);
  }, []);

  const renderRoleInfo = () => (
    <View style={styles.roleInfoCard}>
      <View style={styles.roleHeader}>
        <Icon name="badge" size={24} color="#007bff" />
        <View style={styles.roleDetails}>
          <Text style={styles.roleTitle}>Current Role: {userRole}</Text>
          <Text style={styles.roleSubtitle}>
            {user?.firstName} {user?.lastName}
          </Text>
        </View>
      </View>
      
      <View style={styles.permissionsGrid}>
        <PermissionIndicator
          label="Create Employee"
          hasPermission={canCreateEmployee}
          icon="person-add"
        />
        <PermissionIndicator
          label="View Salary"
          hasPermission={canViewSalary}
          icon="monetization-on"
        />
        <PermissionIndicator
          label="Edit Salary"
          hasPermission={canEditSalary}
          icon="edit"
        />
        <PermissionIndicator
          label="View Aadhaar"
          hasPermission={canViewFullAadhaar}
          icon="credit-card"
        />
        <PermissionIndicator
          label="View Analytics"
          hasPermission={canViewAnalytics}
          icon="analytics"
        />
      </View>
    </View>
  );

  const renderOnboardingSteps = () => (
    <View style={styles.stepsContainer}>
      <Text style={styles.sectionTitle}>Onboarding Steps</Text>
      <Text style={styles.sectionSubtitle}>
        Steps available based on your role permissions
      </Text>
      
      {onboardingSteps.map(step => (
        <PermissionGate
          key={step.id}
          permissions={step.requiredPermissions}
          requireAll={false}
          fallback={
            <View style={[styles.stepCard, styles.stepCardDisabled]}>
              <View style={[styles.stepIcon, { backgroundColor: '#ccc' }]}>
                <Icon name={step.icon} size={20} color="white" />
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, styles.stepTitleDisabled]}>
                  {step.title}
                </Text>
                <Text style={styles.stepDescriptionDisabled}>
                  {step.description}
                </Text>
                <Text style={styles.permissionRequired}>
                  Permission required
                </Text>
              </View>
              <Icon name="lock" size={16} color="#ccc" />
            </View>
          }
        >
          <TouchableOpacity
            style={[styles.stepCard, { borderLeftColor: step.color }]}
            onPress={() => handleStepPress(step)}
          >
            <View style={[styles.stepIcon, { backgroundColor: step.color }]}>
              <Icon name={step.icon} size={20} color="white" />
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
            <Icon name="arrow-forward-ios" size={16} color="#666" />
          </TouchableOpacity>
        </PermissionGate>
      ))}
    </View>
  );

  const renderSensitiveDataControls = () => (
    <View style={styles.controlsCard}>
      <Text style={styles.controlsTitle}>Security Controls</Text>
      
      <PermissionGate
        permission={Permission.VIEW_FULL_AADHAAR}
        fallback={
          <View style={styles.controlItemDisabled}>
            <Text style={styles.controlLabelDisabled}>Show Sensitive Data</Text>
            <Text style={styles.permissionRequired}>Admin access required</Text>
          </View>
        }
      >
        <View style={styles.controlItem}>
          <Text style={styles.controlLabel}>Show Sensitive Data</Text>
          <Switch
            value={showSensitiveData}
            onValueChange={setShowSensitiveData}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={showSensitiveData ? '#f5dd4b' : '#f4f3f4'}
          />
        </View>
      </PermissionGate>

      <PermissionGate
        permission={Permission.AUDIT_LOGS}
        fallback={
          <View style={styles.controlItemDisabled}>
            <Text style={styles.controlLabelDisabled}>Audit Mode</Text>
            <Text style={styles.permissionRequired}>Super admin access required</Text>
          </View>
        }
      >
        <View style={styles.controlItem}>
          <Text style={styles.controlLabel}>Audit Mode</Text>
          <Switch
            value={auditMode}
            onValueChange={setAuditMode}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={auditMode ? '#f5dd4b' : '#f4f3f4'}
          />
        </View>
      </PermissionGate>
    </View>
  );

  const renderEmployeeInfo = () => {
    if (!selectedEmployee) return null;

    return (
      <View style={styles.employeeCard}>
        <Text style={styles.employeeName}>{selectedEmployee.name}</Text>
        <Text style={styles.employeeRole}>{selectedEmployee.role}</Text>
        
        <PermissionGate
          resource={{
            type: ResourceType.EMPLOYEE,
            id: selectedEmployee.id,
            data: selectedEmployee
          }}
          permission={Permission.VIEW_PERSONAL_INFO}
          fallback={
            <Text style={styles.restrictedInfo}>
              Personal information restricted
            </Text>
          }
        >
          <Text style={styles.employeeStatus}>
            Status: {selectedEmployee.status.toUpperCase()}
          </Text>
          {showSensitiveData && (
            <View style={styles.sensitiveInfo}>
              <Text style={styles.sensitiveLabel}>Employee ID:</Text>
              <Text style={styles.sensitiveValue}>{selectedEmployee.id}</Text>
              <Text style={styles.sensitiveLabel}>Aadhaar (masked):</Text>
              <Text style={styles.sensitiveValue}>****-****-1234</Text>
            </View>
          )}
        </PermissionGate>
      </View>
    );
  };

  const handleStepPress = (step: OnboardingStep) => {
    Alert.alert(
      step.title,
      `Navigate to ${step.title} screen`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open', onPress: () => console.log(`Opening ${step.id}`) }
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Role-Based Onboarding</Text>
        <Text style={styles.headerSubtitle}>
          Features available based on your permissions
        </Text>
      </View>

      {renderRoleInfo()}
      {renderEmployeeInfo()}
      {renderSensitiveDataControls()}
      {renderOnboardingSteps()}
    </ScrollView>
  );
};

interface PermissionIndicatorProps {
  label: string;
  hasPermission: boolean;
  icon: string;
}

const PermissionIndicator: React.FC<PermissionIndicatorProps> = ({
  label,
  hasPermission,
  icon
}) => (
  <View style={[
    styles.permissionIndicator,
    hasPermission ? styles.permissionGranted : styles.permissionDenied
  ]}>
    <Icon 
      name={icon} 
      size={16} 
      color={hasPermission ? '#4CAF50' : '#F44336'} 
    />
    <Text style={[
      styles.permissionLabel,
      hasPermission ? styles.permissionLabelGranted : styles.permissionLabelDenied
    ]}>
      {label}
    </Text>
    <Icon 
      name={hasPermission ? 'check-circle' : 'cancel'} 
      size={14} 
      color={hasPermission ? '#4CAF50' : '#F44336'} 
    />
  </View>
);

// Placeholder components for onboarding steps
const BasicDetailsComponent: React.FC = () => <View />;
const DocumentsComponent: React.FC = () => <View />;
const SalaryComponent: React.FC = () => <View />;
const VerificationComponent: React.FC = () => <View />;
const ApprovalComponent: React.FC = () => <View />;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 24,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  roleInfoCard: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  roleDetails: {
    marginLeft: 12,
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  roleSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  permissionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  permissionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 100,
    gap: 4,
  },
  permissionGranted: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4CAF50',
  },
  permissionDenied: {
    backgroundColor: '#ffeaea',
    borderColor: '#F44336',
  },
  permissionLabel: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  permissionLabelGranted: {
    color: '#2e7d32',
  },
  permissionLabelDenied: {
    color: '#c62828',
  },
  employeeCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  employeeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  employeeRole: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  employeeStatus: {
    fontSize: 14,
    color: '#007bff',
    marginTop: 8,
    fontWeight: '500',
  },
  restrictedInfo: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 8,
    fontStyle: 'italic',
  },
  sensitiveInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  sensitiveLabel: {
    fontSize: 12,
    color: '#856404',
    fontWeight: '500',
  },
  sensitiveValue: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  controlsCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  controlsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  controlItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  controlItemDisabled: {
    paddingVertical: 8,
    opacity: 0.5,
  },
  controlLabel: {
    fontSize: 14,
    color: '#333',
  },
  controlLabelDisabled: {
    fontSize: 14,
    color: '#666',
  },
  permissionRequired: {
    fontSize: 12,
    color: '#F44336',
    fontStyle: 'italic',
    marginTop: 2,
  },
  stepsContainer: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  stepCard: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
  },
  stepCardDisabled: {
    backgroundColor: '#f5f5f5',
    elevation: 1,
    shadowOpacity: 0.05,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  stepTitleDisabled: {
    color: '#999',
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  stepDescriptionDisabled: {
    color: '#999',
  },
});

export default RoleBasedOnboardingScreen;